import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { MapPin, X, Navigation, Info } from 'lucide-react-native';
import { parcelApi } from '../../services/parcelApi';

interface Hub {
  id: string;
  name: string;
  address: string;
  distance: string;
  status: string;
  capacity: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (hub: Hub) => void;
  pickupLat?: number;
  pickupLng?: number;
}

export default function DropOffPointSelector({ isOpen, onClose, onSelect, pickupLat, pickupLng }: Props) {
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadHubs();
    }
  }, [isOpen, pickupLat, pickupLng]);

  const loadHubs = async () => {
    console.log('[DropOffPointSelector] loadHubs input coordinates:', { pickupLat, pickupLng });
    setLoading(true);
    try {
      const res = await parcelApi.getHubs(pickupLat, pickupLng);
      setHubs(res.hubs || []);
    } catch (error) {
      console.log('Failed to load hubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (hub: Hub) => {
    onSelect(hub);
    onClose();
  };

  return (
    <Modal visible={isOpen} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View>
              <Text style={styles.title}>Select PakiHub</Text>
              <Text style={styles.sub}>Choose a drop-off point for PakiShare</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingArea}>
              <ActivityIndicator color="#39B5A8" size="large" />
              <Text style={styles.loadingText}>Finding nearby hubs...</Text>
            </View>
          ) : (
            <FlatList
              data={hubs}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.hubCard}
                  onPress={() => handleSelect(item)}
                >
                  <View style={styles.hubIcon}>
                    <MapPin size={20} color="#39B5A8" />
                  </View>
                  <View style={styles.hubInfo}>
                    <Text style={styles.hubName}>{item.name}</Text>
                    <Text style={styles.hubAddr} numberOfLines={1}>{item.address}</Text>
                    <View style={styles.hubMeta}>
                      <View style={styles.metaBadge}>
                        <Navigation size={10} color="#1A5D56" />
                        <Text style={styles.metaText}>{item.distance} away</Text>
                      </View>
                      <View style={[styles.statusBadge, item.status === 'Open' ? styles.statusOpen : styles.statusBusy]}>
                        <Text style={[styles.statusText, item.status === 'Open' ? styles.textOpen : styles.textBusy]}>{item.status}</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={() => (
                <View style={styles.emptyArea}>
                  <Info size={32} color="#D1D5DB" />
                  <Text style={styles.emptyText}>No hubs available in your area.</Text>
                </View>
              )}
            />
          )}

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 22, 20, 0.4)',
    justifyContent: 'flex-end',
  },
  modal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 40,
    maxHeight: '80%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '900',
    color: '#041614',
  },
  sub: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 2,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 20,
    gap: 12,
  },
  hubCard: {
    flexDirection: 'row',
    backgroundColor: '#F9FAFB',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  hubIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(57, 181, 168, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubInfo: {
    flex: 1,
    marginLeft: 16,
  },
  hubName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#041614',
    marginBottom: 2,
  },
  hubAddr: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 8,
  },
  hubMeta: {
    flexDirection: 'row',
    gap: 8,
  },
  metaBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(57, 181, 168, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  metaText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1A5D56',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusOpen: {
    backgroundColor: 'rgba(52, 211, 153, 0.1)',
  },
  statusBusy: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  textOpen: {
    color: '#059669',
  },
  textBusy: {
    color: '#D97706',
  },
  loadingArea: {
    padding: 60,
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
  },
  emptyArea: {
    padding: 60,
    alignItems: 'center',
    gap: 12,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#9CA3AF',
    textAlign: 'center',
  },
  cancelBtn: {
    marginTop: 20,
    height: 54,
    borderRadius: 18,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelBtnText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#6B7280',
  },
});
