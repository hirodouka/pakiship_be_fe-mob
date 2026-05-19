import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, ActivityIndicator, Linking,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Search, Package, MapPin, Clock, AlertCircle, Phone, PhoneOff, List, Map as MapIcon } from 'lucide-react-native';
import { CustomerPageHeader } from '@features/shared/components/CustomerPageHeader';
import MapPreview from '@features/parcel/components/MapPreview';

import { parcelApi } from '../../services/parcelApi';

export default function TrackPackage() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const [trackingNumber, setTrackingNumber] = useState(route.params?.trackingNumber || '');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [trackingResult, setTrackingResult] = useState<any>(null);

  React.useEffect(() => {
    if (route.params?.trackingNumber) {
      fetchTrackingData(route.params.trackingNumber);
    }
  }, [route.params?.trackingNumber]);
  const [activeTab, setActiveTab] = useState<'timeline' | 'map'>('timeline');

  const fetchTrackingData = async (id: string) => {
    setIsSearching(true);
    setError(null);
    setTrackingResult(null);
    
    try {
      const res = await parcelApi.getTrackingDetails(id.trim());
      if (res) {
        setTrackingResult(res);
      } else {
        setError('Parcel Not Found. Check the number and try again.');
      }
    } catch (err: any) {
      console.error('Tracking failed:', err);
      setError(err?.message || 'Failed to fetch tracking details. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const fetchTrackingDataQuietly = async (id: string) => {
    try {
      const res = await parcelApi.getTrackingDetails(id.trim());
      if (res) {
        setTrackingResult(res);
      }
    } catch (err) {
      console.log('Quiet poll failed:', err);
    }
  };

  React.useEffect(() => {
    let pollInterval: any = null;
    const isOngoing = trackingResult && !['Delivered', 'Cancelled', 'Lost'].includes(trackingResult.status);
    
    if (isOngoing && trackingNumber) {
      pollInterval = setInterval(() => {
        fetchTrackingDataQuietly(trackingNumber);
      }, 15000); // Poll every 15s
    }
    
    return () => {
      if (pollInterval) clearInterval(pollInterval);
    };
  }, [trackingResult?.status, trackingNumber]);

  return (
    <View style={styles.container}>
      <CustomerPageHeader 
        title="Tracking" 
        subtitle="Real-time delivery updates" 
        icon={Package as any} 
        onBack={() => navigation.goBack()} 
      />

      <View style={styles.searchBox}>
        <Search size={16} color="#aaa" />
        <TextInput
          style={styles.searchInput}
          placeholder="Enter Tracking ID (e.g. PKS-20260519-F62D36DD)"
          value={trackingNumber}
          onChangeText={setTrackingNumber}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={[styles.trackBtn, (!trackingNumber || isSearching) && styles.trackBtnDisabled]}
          onPress={() => trackingNumber.trim() && fetchTrackingData(trackingNumber)}
          disabled={!trackingNumber || isSearching}
        >
          {isSearching ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.trackBtnText}>Track</Text>}
        </TouchableOpacity>
      </View>

      {error && (
        <View style={styles.errorRow}>
          <AlertCircle size={14} color="#ef4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {trackingResult ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, gap: 12 }}>
          {/* Status Card */}
          <View style={styles.statusCard}>
            <Text style={styles.trackingId}>#{trackingResult.trackingNumber}</Text>
            <View style={styles.etaBadge}><Text style={styles.etaText}>ETA: {trackingResult.estimatedDelivery}</Text></View>
            <View style={styles.statusRow}>
              <Package size={20} color="#39B5A8" />
              <Text style={styles.statusText}>{trackingResult.status}</Text>
            </View>
          </View>

          {/* Tab switcher */}
          <View style={styles.tabRow}>
            <TouchableOpacity style={[styles.tab, activeTab === 'timeline' && styles.tabActive]} onPress={() => setActiveTab('timeline')}>
              <List size={14} color={activeTab === 'timeline' ? '#39B5A8' : '#aaa'} />
              <Text style={[styles.tabText, activeTab === 'timeline' && styles.tabTextActive]}>Timeline</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.tab, activeTab === 'map' && styles.tabActive]} onPress={() => setActiveTab('map')}>
              <MapIcon size={14} color={activeTab === 'map' ? '#39B5A8' : '#aaa'} />
              <Text style={[styles.tabText, activeTab === 'map' && styles.tabTextActive]}>Live Map</Text>
            </TouchableOpacity>
          </View>

          {/* Timeline */}
          {activeTab === 'timeline' && (
            <View style={styles.card}>
              <Text style={styles.sectionTitle}><Clock size={13} color="#39B5A8" /> Status History</Text>
              {trackingResult.timeline.map((event: any, i: number) => (
                <View key={i} style={styles.timelineItem}>
                  <View style={styles.timelineLeft}>
                    <View style={[styles.timelineCircle, event.completed && styles.timelineCircleDone]}>
                      <Text style={styles.timelineCircleText}>{event.completed ? '✓' : i + 1}</Text>
                    </View>
                    {i < trackingResult.timeline.length - 1 && <View style={[styles.timelineLine, event.completed && styles.timelineLineDone]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 20 }}>
                    <Text style={[styles.timelineStatus, !event.completed && styles.dimText]}>{event.status}</Text>
                    <Text style={styles.timelineLocation}>{event.location}</Text>
                    <Text style={styles.timelineTime}>{event.timestamp}</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Map */}
          {activeTab === 'map' && (
            <View style={[styles.card, { height: 300 }]}>
              <MapPreview 
                pickupLocation={trackingResult.pickupLocation} 
                deliveryLocation={trackingResult.deliveryLocation}
                driverLocation={trackingResult.assignedDriver?.location}
                pickupAddress={trackingResult.origin}
                deliveryAddress={trackingResult.destination}
              />
            </View>
          )}

          {/* Driver card */}
          {trackingResult.assignedDriver && (
            <View style={styles.driverCard}>
              <View>
                <Text style={styles.driverRole}>ASSIGNED RIDER</Text>
                <Text style={styles.driverName}>{trackingResult.assignedDriver.name.split(' ').map((s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')}</Text>
                <Text style={styles.driverMeta}>
                  {trackingResult.assignedDriver.vehicleType} · {trackingResult.assignedDriver.plateNumber || 'TBD'}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.callBtn}
                onPress={() => {
                  const phone = trackingResult?.assignedDriver?.phone;
                  if (phone) {
                    Linking.openURL(`tel:${phone}`);
                  }
                }}
              >
                <Phone size={18} color="#fff" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      ) : (
        <View style={styles.emptyState}>
          <Package size={52} color="#39B5A8" />
          <Text style={styles.emptyTitle}>Ready to track?</Text>
          <Text style={styles.emptySubtitle}>Enter your tracking ID above.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9F8' },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: 8, margin: 16, backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
  searchInput: { flex: 1, height: 40, fontSize: 13, fontWeight: '700', color: '#041614' },
  trackBtn: { backgroundColor: '#39B5A8', paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12 },
  trackBtnDisabled: { opacity: 0.5 },
  trackBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fecaca', borderRadius: 12, padding: 10, marginBottom: 8 },
  errorText: { fontSize: 11, fontWeight: '700', color: '#ef4444', flex: 1 },
  statusCard: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)' },
  trackingId: { fontSize: 10, fontWeight: '900', color: '#aaa', letterSpacing: 1, marginBottom: 6 },
  etaBadge: { alignSelf: 'flex-start', backgroundColor: '#F0F9F8', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: 'rgba(57,181,168,0.2)', marginBottom: 8 },
  etaText: { fontSize: 10, fontWeight: '700', color: '#39B5A8' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusText: { fontSize: 18, fontWeight: '900', color: '#1A5D56' },
  tabRow: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.6)', padding: 4, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8, borderRadius: 12 },
  tabActive: { backgroundColor: '#fff', shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  tabText: { fontSize: 10, fontWeight: '900', color: '#aaa', textTransform: 'uppercase' },
  tabTextActive: { color: '#39B5A8' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)', overflow: 'hidden' },
  sectionTitle: { fontSize: 10, fontWeight: '900', color: '#1A5D56', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 14 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center' },
  timelineCircle: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  timelineCircleDone: { backgroundColor: '#39B5A8' },
  timelineCircleText: { fontSize: 10, fontWeight: '900', color: '#fff' },
  timelineLine: { width: 2, flex: 1, backgroundColor: '#e5e7eb', marginVertical: 2 },
  timelineLineDone: { backgroundColor: '#39B5A8' },
  timelineStatus: { fontSize: 12, fontWeight: '900', color: '#1A5D56' },
  timelineLocation: { fontSize: 10, color: '#888', marginTop: 2 },
  timelineTime: { fontSize: 9, fontWeight: '700', color: '#39B5A8', marginTop: 2 },
  dimText: { color: '#ccc' },
  driverCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#1A5D56', borderRadius: 20, padding: 16 },
  driverRole: { fontSize: 8, fontWeight: '900', color: '#39B5A8', letterSpacing: 2, marginBottom: 4 },
  driverName: { fontSize: 16, fontWeight: '900', color: '#fff' },
  driverMeta: { fontSize: 10, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  callBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#39B5A8', alignItems: 'center', justifyContent: 'center' },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  emptyTitle: { fontSize: 18, fontWeight: '900', color: '#1A5D56', marginTop: 16 },
  emptySubtitle: { fontSize: 12, color: '#aaa', marginTop: 6 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,93,86,0.85)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  callingCard: { backgroundColor: '#fff', borderRadius: 30, padding: 32, alignItems: 'center', width: '100%' },
  callingIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#39B5A8', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  callingName: { fontSize: 18, fontWeight: '900', color: '#1A5D56' },
  callingNumber: { fontSize: 14, color: '#39B5A8', fontWeight: '800', marginTop: 4, letterSpacing: 0.5 },
  callingStatus: { fontSize: 10, color: '#aaa', fontWeight: '700', letterSpacing: 1, marginTop: 12, marginBottom: 32 },
  endCallBtn: { width: '100%', height: 50, backgroundColor: '#ef4444', borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  endCallText: { color: '#fff', fontWeight: '900', fontSize: 14 },
});
