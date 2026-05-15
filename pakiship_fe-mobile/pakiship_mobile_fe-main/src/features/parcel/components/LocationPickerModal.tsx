import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Modal, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Search, X, MapPin, Map } from 'lucide-react-native';
import { profileApi } from '@/features/services/profileApi';


const SAMPLE_LOCATIONS: any[] = [];

export interface LocationData {
  address?: string;
  details?: string;
  lat?: number;
  lng?: number;
  action?: 'choose_on_map';
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (loc: LocationData) => void;
  type: 'pickup' | 'delivery';
}

export default function LocationPickerModal({ isOpen, onClose, onSelect, type }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Auto-clear when opened/closed to prevent stale search
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await profileApi.googleMapsAutocomplete(query);
        if (data.predictions) {
          setResults(data.predictions);
        }
      } catch (e) {
        console.error('Places API error:', e);
      } finally {
        setLoading(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectPlace = async (placeId: string, description: string) => {
    setLoading(true);
    try {
      const data = await profileApi.googleMapsDetails(placeId);
      const location = data.result?.geometry?.location;
      if (location) {
        onSelect({ address: description, lat: location.lat, lng: location.lng });
        onClose();
      }
    } catch (e) {
      console.error('Place details error:', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={isOpen} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>{type === 'pickup' ? 'Where from?' : 'Where to?'}</Text>
          <TouchableOpacity onPress={onClose}><X size={22} color="#555" /></TouchableOpacity>
        </View>
        <View style={styles.searchRow}>
          <Search size={16} color="#aaa" />
          <TextInput 
            style={styles.input} 
            placeholder="Search address or building..." 
            value={query} 
            onChangeText={setQuery} 
            autoCapitalize="none"
          />
        </View>
        
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
          {/* Lalamove style: Always offer "Choose on Map" as priority */}
          <TouchableOpacity style={styles.mapItem} onPress={() => { onSelect({ action: 'choose_on_map' }); onClose(); }}>
            <View style={styles.mapItemIcon}>
              <Map size={18} color="#1A5D56" />
            </View>
            <View>
               <Text style={styles.mapItemTitle}>Choose on map</Text>
               <Text style={styles.mapItemSub}>Locate using map pin</Text>
            </View>
          </TouchableOpacity>

          <View style={styles.divider} />

          {loading && <ActivityIndicator style={{ margin: 20 }} color="#39B5A8" />}
          
          {!loading && results.length > 0 && results.map(loc => (
            <TouchableOpacity key={loc.place_id} style={styles.item} onPress={() => handleSelectPlace(loc.place_id, loc.description)}>
              <View style={styles.iconCircle}>
                <MapPin size={16} color="#9CA3AF" />
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={styles.itemTitle} numberOfLines={1}>{loc.structured_formatting?.main_text || loc.description}</Text>
                 {loc.structured_formatting?.secondary_text && (
                   <Text style={styles.itemSub} numberOfLines={1}>{loc.structured_formatting.secondary_text}</Text>
                 )}
              </View>
            </TouchableOpacity>
          ))}

          {!query && !loading && (
             <View style={styles.historySection}>
               {/* Suggestions removed as requested */}
             </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  title: { fontSize: 18, fontWeight: '900', color: '#041614', letterSpacing: -0.5 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: '#E5E7EB', shadowColor: '#000', shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
  input: { flex: 1, fontSize: 16, color: '#041614', fontWeight: '600' },
  mapItem: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 18, backgroundColor: '#fff' },
  mapItemIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(57,181,168,0.1)', alignItems: 'center', justifyContent: 'center' },
  mapItemTitle: { fontSize: 16, fontWeight: '800', color: '#1A5D56', marginBottom: 2 },
  mapItemSub: { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  divider: { height: 8, backgroundColor: '#F3F4F6' },
  sectionHeader: { fontSize: 11, fontWeight: '900', color: '#9CA3AF', letterSpacing: 1, paddingHorizontal: 20, paddingVertical: 12, marginTop: 8 },
  historySection: { paddingBottom: 20 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' },
  itemTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 2 },
  itemSub: { fontSize: 13, fontWeight: '500', color: '#6B7280' },
});
