import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useState, useEffect } from 'react';
import {
  Alert,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapPreview from '../parcel/components/MapPreview';

import { apiRequest } from '../services/api';

const palette = {
  appBg: '#EDF6F5',
  shell: '#F7FBFB',
  card: '#FFFFFF',
  cardBorder: '#D8F0EE',
  primary: '#42BDB4',
  primaryDark: '#163733',
  primarySoft: '#E7F8F6',
  text: '#08211E',
  subtext: '#7F91A6',
  danger: '#FF6464',
};

const motorMascotImage = require('../../assets/images/logo.png'); // Fallback to logo if mascot missing

type Nav = NativeStackNavigationProp<RootStackParamList, 'JobDetails'>;

export default function JobDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute();
  const params = route.params as RootStackParamList['JobDetails'];
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showAcceptModal, setShowAcceptModal] = useState(false);

  const [distanceInfo, setDistanceInfo] = useState<any>(null);

  const fetchDistance = async (jobId: string) => {
    try {
      // Mocking driver location for now, in real app use Expo Location
      const mockLat = 14.5547;
      const mockLng = 121.0244;
      
      const res = await apiRequest(`/pakiship/mobile/driver/jobs/${jobId}/distance?lat=${mockLat}&lng=${mockLng}`);
      setDistanceInfo(res);
    } catch (error) {
      console.error('Failed to fetch distance info:', error);
    }
  };

  const fetchJobDetail = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/pakiship/mobile/driver/jobs/${params.id}`);
      
      // Adapt API response to UI model
      const mappedJob = {
        id: params.id,
        tag: res.jobNumber,
        status: res.status,
        pickup: res.pickup,
        dropoff: res.dropoff,
        distance: res.distance,
        earnings: res.earnings,
        customer: res.customerName || 'Customer',
        customerPhone: res.customerPhone || '',
        customerAvatar: res.customerAvatar || null,
        receiverName: res.receiverName || 'Recipient',
        receiverPhone: res.receiverPhone || '',
        eta: res.timeLimit || 'TBD',
        packageDescription: res.packageDescription || 'Standard Parcel',
        specialInstructions: res.specialInstructions || 'None',
        size: res.packageSize || 'Medium',
        pickupLocation: res.pickupLocation,
        dropoffLocation: res.dropoffLocation,
      };
      setJob(mappedJob);
      
      if (mappedJob.status !== 'completed') {
        fetchDistance(params.id);
      }
    } catch (error) {
      console.error('Failed to fetch job detail:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetail();
  }, [params.id]);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <Text style={{ textAlign: 'center', marginTop: 20 }}>Loading Job Details...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!job) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.screen}>
          <View style={styles.header}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <MaterialCommunityIcons name="arrow-left" size={22} color={palette.primary} />
            </Pressable>
            <Text style={styles.headerTitle}>Job Details</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>Job not found.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const status = job.status?.toLowerCase() || '';
  const currentStep = status === 'available' ? 1 : status === 'in-progress' ? 2 : 3;
  const destination = status === 'available' ? job.pickup : job.dropoff;

  const openMaps = async () => {
    const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(destination)}`;
    await Linking.openURL(url);
  };

  const callCustomer = async () => {
    if (!job.customerPhone) {
      return;
    }

    await Linking.openURL(`tel:${job.customerPhone}`);
  };

  const handleAcceptJob = async () => {
    try {
      // Real API call to accept the job
      await apiRequest(`/pakiship/mobile/driver/jobs/${job.id}/accept`, { method: 'POST' });
      setShowAcceptModal(false);
      fetchJobDetail(); // Refresh to show in-progress state
    } catch (error: any) {
      console.log('Failed to accept job:', error?.message || error);
      setShowAcceptModal(false);
      
      const errorMsg = error?.message || '';
      if (errorMsg) {
        Alert.alert(
          'Active Delivery Conflict',
          errorMsg,
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert(
          'Failed to Accept Job',
          'An unexpected error occurred while accepting this job.',
          [{ text: 'OK' }]
        );
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screen}>
        {showCallModal ? (
          <CallModal
            customerName={job.customer}
            customerPhone={job.customerPhone}
            onClose={() => setShowCallModal(false)}
            onCallNow={async () => {
              await callCustomer();
              setShowCallModal(false);
            }}
          />
        ) : null}

        {showAcceptModal ? (
          <AcceptJobModal
            jobTag={job.tag}
            pickup={job.pickup}
            earnings={job.earnings}
            distance={job.distance}
            onCancel={() => setShowAcceptModal(false)}
            onConfirm={handleAcceptJob}
          />
        ) : null}

        <View style={styles.header}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <MaterialCommunityIcons name="arrow-left" size={22} color={palette.primary} />
          </Pressable>
          <Text style={styles.headerTitle}>Job Details</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <View style={styles.topRow}>
              <View style={styles.idRow}>
                <Text style={styles.jobTag}>{job.tag}</Text>
                <View style={styles.statusPill}>
                  <Text style={styles.statusPillText}>
                    {job.status === 'in-progress' ? 'IN PROGRESS' : job.status.toUpperCase()}
                  </Text>
                </View>
              </View>
              <View>
                <Text style={styles.earningsValue}>{job.earnings}</Text>
                <Text style={styles.earningsLabel}>EARNINGS</Text>
              </View>
            </View>

            <View style={styles.progressWrap}>
              <ProgressStep step={1} active={currentStep === 1} complete={currentStep > 1} label="PICKUP" />
              <View style={[styles.progressLine, currentStep > 1 ? styles.progressLineActive : null]} />
              <ProgressStep step={2} active={currentStep === 2} complete={currentStep > 2} label="IN TRANSIT" />
              <View style={[styles.progressLine, currentStep > 2 ? styles.progressLineActive : null]} />
              <ProgressStep step={3} active={currentStep === 3} complete={false} label="DELIVERY" />
            </View>

            {job.eta ? (
              <View style={styles.etaBox}>
                <MaterialCommunityIcons name="clock-outline" size={16} color={palette.primary} />
                <Text style={styles.etaText}>
                  Est. completion: <Text style={styles.etaHighlight}>{job.eta}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="map-outline" size={17} color={palette.primary} />
              <Text style={styles.sectionTitle}>Live Map</Text>
            </View>

            <View style={[styles.mapCard, { padding: 0, overflow: 'hidden', height: 200, marginBottom: 12 }]}>
              <MapPreview 
                pickupLocation={job.pickupLocation} 
                deliveryLocation={job.dropoffLocation}
                pickupAddress={job.pickup}
                deliveryAddress={job.dropoff}
              />
            </View>

            <Pressable style={styles.mapsButton} onPress={openMaps}>
              <MaterialCommunityIcons name="open-in-new" size={18} color={palette.card} />
              <Text style={styles.mapsButtonText}>Open Google Maps Navigation</Text>
            </Pressable>
          </View>

          <View style={styles.card}>
            <View style={[styles.sectionHeader, { flexDirection: "row", justifyContent: "space-between", alignItems: "center", width: "100%" }]}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="navigation-variant-outline" size={17} color={palette.primary} />
                <Text style={styles.sectionTitle}>Route</Text>
              </View>
              <Text style={{ fontSize: 13, fontWeight: "800", color: palette.primary }}>{job.distance}</Text>
            </View>

            <View style={styles.routeStop}>
              <View style={styles.pickupIcon}>
                <MaterialCommunityIcons name="map-marker-outline" size={17} color={palette.card} />
              </View>
              <View style={styles.routeMeta}>
                <Text style={styles.routeLabel}>PICKUP</Text>
                <Text style={styles.routeValue}>{job.pickup}</Text>
              </View>
            </View>

            <View style={{ height: 16 }} />

            <View style={styles.routeStop}>
              <View style={styles.dropoffIcon}>
                <MaterialCommunityIcons name="map-marker-outline" size={17} color={palette.card} />
              </View>
              <View style={styles.routeMeta}>
                <Text style={styles.routeLabel}>DROP-OFF</Text>
                <Text style={styles.routeValue}>{job.dropoff}</Text>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-outline" size={17} color={palette.primary} />
              <Text style={styles.sectionTitle}>Customer & Recipient</Text>
            </View>

            {/* Sender / Customer Section */}
            <View style={styles.customerRow}>
              <View style={styles.customerMetaRow}>
                <View style={styles.customerAvatar}>
                  {job.customerAvatar ? (
                    <Image source={{ uri: job.customerAvatar }} style={styles.customerAvatarImage} />
                  ) : (
                    <Text style={styles.customerAvatarText}>{job.customer.charAt(0)}</Text>
                  )}
                </View>
                <View>
                  <Text style={styles.customerName}>{job.customer}</Text>
                  {job.customerPhone ? <Text style={styles.customerPhone}>{job.customerPhone}</Text> : null}
                  <Text style={styles.roleLabelText}>SENDER / BOOKED BY</Text>
                </View>
              </View>

              <View style={styles.customerActions}>
                <Pressable style={styles.customerCallButton} onPress={() => setShowCallModal(true)}>
                  <MaterialCommunityIcons name="phone-outline" size={18} color={palette.card} />
                </Pressable>
                <Pressable style={styles.customerMessageButton}>
                  <MaterialCommunityIcons name="message-text-outline" size={18} color="#8593A8" />
                </Pressable>
              </View>
            </View>

            <View style={{ height: 16 }} />

            {/* Recipient / Receiver Section */}
            <View style={styles.customerRow}>
              <View style={styles.customerMetaRow}>
                <View style={[styles.customerAvatar, { backgroundColor: palette.danger }]}>
                  <Text style={styles.customerAvatarText}>{job.receiverName.charAt(0)}</Text>
                </View>
                <View>
                  <Text style={styles.customerName}>{job.receiverName}</Text>
                  {job.receiverPhone ? <Text style={styles.customerPhone}>{job.receiverPhone}</Text> : null}
                  <Text style={[styles.roleLabelText, { color: palette.danger }]}>RECIPIENT</Text>
                </View>
              </View>

              <View style={styles.customerActions}>
                <Pressable 
                  style={[styles.customerCallButton, { backgroundColor: palette.danger }]} 
                  onPress={() => Linking.openURL(`tel:${job.receiverPhone}`)}
                >
                  <MaterialCommunityIcons name="phone-outline" size={18} color={palette.card} />
                </Pressable>
                <Pressable style={styles.customerMessageButton}>
                  <MaterialCommunityIcons name="message-text-outline" size={18} color="#8593A8" />
                </Pressable>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="cube-outline" size={17} color={palette.primary} />
              <Text style={styles.sectionTitle}>Package Details</Text>
            </View>

            <View style={styles.packageStatsRow}>
              <View style={styles.packageStatBox}>
                <Text style={styles.packageStatLabel}>SIZE</Text>
                <Text style={styles.packageStatValue}>{job.size}</Text>
              </View>
              <View style={styles.packageStatBox}>
                <Text style={styles.packageStatLabel}>DISTANCE</Text>
                <Text style={styles.packageStatValue}>{job.distance}</Text>
              </View>
            </View>

            {job.packageDescription ? (
              <View style={styles.detailBox}>
                <Text style={styles.detailBoxLabel}>DESCRIPTION</Text>
                <Text style={styles.detailBoxValue}>{job.packageDescription}</Text>
              </View>
            ) : null}

            {job.specialInstructions ? (
              <View style={styles.instructionsBox}>
                <MaterialCommunityIcons name="alert-circle-outline" size={16} color="#F2A100" />
                <View style={styles.instructionsBody}>
                  <Text style={styles.instructionsLabel}>SPECIAL INSTRUCTIONS</Text>
                  <Text style={styles.instructionsText}>{job.specialInstructions}</Text>
                </View>
              </View>
            ) : null}
          </View>

          {status === 'available' ? (
            <View style={styles.actionSection}>
              <Pressable style={styles.backActionButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backActionText}>Go Back</Text>
              </Pressable>
              <Pressable style={styles.completedActionButton} onPress={() => setShowAcceptModal(true)}>
                <MaterialCommunityIcons name="check-circle-outline" size={18} color={palette.card} />
                <Text style={styles.primaryActionText}>Accept Job</Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'in-progress' ? (
            <View style={styles.actionSection}>
              <Pressable style={styles.secondaryActionButton} onPress={() => setShowCallModal(true)}>
                <MaterialCommunityIcons name="phone-outline" size={18} color={palette.primary} />
                <Text style={styles.secondaryActionText}>Call Customer</Text>
              </Pressable>
              <Pressable 
                style={styles.primaryActionButton}
                onPress={() => navigation.navigate('UpdateStatus', { id: job.id })}
              >
                <MaterialCommunityIcons name="refresh" size={18} color={palette.card} />
                <Text style={styles.primaryActionText}>Update Parcel Status</Text>
              </Pressable>
            </View>
          ) : null}

          {status === 'completed' ? (
            <View style={styles.actionSection}>
              <Pressable style={styles.completedActionButton} onPress={() => navigation.goBack()}>
                <Text style={styles.primaryActionText}>Back to Dashboard</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

function CallModal({
  customerName,
  customerPhone,
  onClose,
  onCallNow,
}: {
  customerName: string;
  customerPhone?: string;
  onClose: () => void;
  onCallNow: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.callModalCard}>
        <View style={styles.callAvatar}>
          <Text style={styles.callAvatarText}>{customerName.charAt(0)}</Text>
        </View>

        <Text style={styles.callName}>{customerName}</Text>
        {customerPhone ? <Text style={styles.callPhone}>{customerPhone}</Text> : null}

        <View style={styles.customerBadge}>
          <Text style={styles.customerBadgeText}>CUSTOMER</Text>
        </View>

        <Pressable style={styles.callNowButton} onPress={onCallNow}>
          <View style={styles.callNowIconBubble}>
            <MaterialCommunityIcons name="phone-outline" size={16} color={palette.card} />
          </View>
          <Text style={styles.callNowText}>Call Now</Text>
        </Pressable>

        <Pressable onPress={onClose} style={styles.cancelCallButton}>
          <Text style={styles.cancelCallText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function AcceptJobModal({
  jobTag,
  pickup,
  earnings,
  distance,
  onCancel,
  onConfirm,
}: {
  jobTag: string;
  pickup: string;
  earnings: string;
  distance: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <View style={styles.modalOverlay}>
      <Pressable style={styles.modalBackdrop} onPress={onCancel} />
      <View style={styles.acceptModalCard}>
        <View style={styles.acceptMascotWrap}>
          <Image source={motorMascotImage} style={styles.acceptMascotImage} resizeMode="contain" />
        </View>

        <Text style={styles.acceptTitle}>Accept this job?</Text>
        <Text style={styles.acceptSubtitle}>
          You're about to accept <Text style={styles.acceptTag}>{jobTag}</Text>. Pick up from{' '}
          <Text style={styles.acceptPickup}>{pickup}</Text>.
        </Text>

        <View style={styles.acceptStatsCard}>
          <View style={styles.acceptStatItem}>
            <Text style={styles.acceptStatLabel}>EARNINGS</Text>
            <Text style={styles.acceptStatValue}>{earnings}</Text>
          </View>
          <View style={styles.acceptStatItem}>
            <Text style={styles.acceptStatLabel}>DISTANCE</Text>
            <Text style={[styles.acceptStatValue, styles.acceptDistanceValue]}>{distance}</Text>
          </View>
        </View>

        <View style={styles.acceptDivider} />

        <View style={styles.acceptActions}>
          <Pressable style={styles.acceptCancelButton} onPress={onCancel}>
            <Text style={styles.acceptCancelText}>Cancel</Text>
          </Pressable>
          <Pressable style={styles.acceptConfirmButton} onPress={onConfirm}>
            <MaterialCommunityIcons name="check-circle-outline" size={16} color={palette.card} />
            <Text style={styles.acceptConfirmText}>Confirm & Accept</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function ProgressStep({
  step,
  active,
  complete,
  label,
}: {
  step: number;
  active: boolean;
  complete: boolean;
  label: string;
}) {
  return (
    <View style={styles.progressStep}>
      <View
        style={[
          styles.progressCircle,
          complete ? styles.progressCircleComplete : null,
          active ? styles.progressCircleActive : null,
        ]}
      >
        {complete ? (
          <MaterialCommunityIcons name="check" size={16} color={palette.card} />
        ) : (
          <Text style={[styles.progressNumber, active ? styles.progressNumberActive : null]}>{step}</Text>
        )}
      </View>
      <Text style={[styles.progressLabel, active ? styles.progressLabelActive : null]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.appBg,
  },
  screen: {
    flex: 1,
    backgroundColor: palette.shell,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: '#E7F1F0',
  },
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(32, 51, 49, 0.45)',
  },
  callModalCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    backgroundColor: palette.card,
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 26,
    paddingBottom: 22,
    shadowColor: '#607875',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  callAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#65CAC2',
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 7 },
    elevation: 4,
  },
  callAvatarText: {
    color: palette.card,
    fontSize: 32,
    fontWeight: '900',
  },
  callName: {
    color: palette.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  callPhone: {
    color: palette.primary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 12,
  },
  customerBadge: {
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 22,
  },
  customerBadgeText: {
    color: '#B0B8C6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  callNowButton: {
    width: '100%',
    height: 50,
    borderRadius: 14,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 18,
    shadowColor: '#63C9C0',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  callNowIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callNowText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  cancelCallButton: {
    paddingVertical: 4,
  },
  cancelCallText: {
    color: '#8D98A8',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptModalCard: {
    width: '100%',
    maxWidth: 324,
    borderRadius: 28,
    backgroundColor: palette.card,
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 28,
    paddingBottom: 26,
    shadowColor: '#607875',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  acceptMascotWrap: {
    marginBottom: 14,
  },
  acceptMascotImage: {
    width: 82,
    height: 82,
  },
  acceptTitle: {
    color: palette.text,
    fontSize: 19,
    fontWeight: '800',
    marginBottom: 10,
  },
  acceptSubtitle: {
    color: '#6C7A8D',
    fontSize: 15,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 20,
  },
  acceptTag: {
    color: palette.primary,
    fontWeight: '800',
  },
  acceptPickup: {
    color: '#3A4657',
    fontWeight: '700',
  },
  acceptStatsCard: {
    width: '100%',
    borderRadius: 16,
    backgroundColor: '#F0F9F8',
    paddingVertical: 16,
    paddingHorizontal: 22,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  acceptStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  acceptStatLabel: {
    color: '#A1ACBC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  acceptStatValue: {
    color: palette.primary,
    fontSize: 20,
    fontWeight: '900',
  },
  acceptDistanceValue: {
    color: palette.text,
  },
  acceptDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#EEF2F5',
    marginBottom: 18,
  },
  acceptActions: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  acceptCancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  acceptCancelText: {
    color: '#8D98A8',
    fontSize: 14,
    fontWeight: '700',
  },
  acceptConfirmButton: {
    minWidth: 182,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    shadowColor: '#63C9C0',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  acceptConfirmText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  backButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 34,
  },
  content: {
    padding: 14,
    gap: 14,
    paddingBottom: 28,
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyStateText: {
    color: palette.subtext,
    fontSize: 16,
    fontWeight: '700',
  },
  card: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 16,
    shadowColor: '#98CEC9',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  idRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  jobTag: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  statusPill: {
    backgroundColor: '#EAF0FF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  statusPillText: {
    color: '#4E79FF',
    fontSize: 10,
    fontWeight: '900',
  },
  earningsValue: {
    color: palette.primary,
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'right',
  },
  earningsLabel: {
    color: '#9BA8BC',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'right',
  },
  progressWrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  progressStep: {
    alignItems: 'center',
  },
  progressCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: palette.card,
    borderWidth: 1.5,
    borderColor: '#DCE3EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressCircleComplete: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  progressCircleActive: {
    backgroundColor: '#051614',
    borderColor: '#051614',
  },
  progressNumber: {
    color: '#A2ADBD',
    fontSize: 14,
    fontWeight: '900',
  },
  progressNumberActive: {
    color: palette.card,
  },
  progressLabel: {
    color: '#A2ADBD',
    fontSize: 11,
    fontWeight: '800',
    marginTop: 8,
  },
  progressLabelActive: {
    color: palette.text,
  },
  progressLine: {
    flex: 1,
    height: 3,
    backgroundColor: '#E2E7EF',
    marginTop: 17,
    marginHorizontal: 6,
  },
  progressLineActive: {
    backgroundColor: palette.primary,
  },
  etaBox: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#BCE6E1',
    backgroundColor: '#F7FEFD',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  etaText: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '700',
  },
  etaHighlight: {
    color: palette.primary,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  mapCard: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#AEE1DD',
    marginBottom: 12,
  },
  mapEtaBubble: {
    position: 'absolute',
    top: 12,
    left: 12,
    zIndex: 2,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  mapEtaLabel: {
    color: '#A4AFBD',
    fontSize: 9,
    fontWeight: '800',
  },
  mapEtaValue: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '900',
  },
  mapGrid: {
    height: 168,
    backgroundColor: '#AEE1DD',
  },
  mapLineHorizontal: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  mapLineVertical: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  driverMarker: {
    position: 'absolute',
    left: 78,
    top: 52,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: palette.primary,
    borderWidth: 2,
    borderColor: palette.card,
  },
  destinationBadge: {
    position: 'absolute',
    bottom: 38,
    left: 102,
    backgroundColor: '#051614',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  destinationBadgeText: {
    color: palette.card,
    fontSize: 10,
    fontWeight: '800',
  },
  pinMarker: {
    position: 'absolute',
    bottom: 22,
    left: 138,
  },
  mapPreviewBadge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mapPreviewText: {
    color: '#94A3B8',
    fontSize: 9,
    fontWeight: '800',
  },
  mapsButton: {
    backgroundColor: palette.primary,
    borderRadius: 16,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  mapsButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  routeStop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  pickupIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropoffIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
  },
  routeMeta: {
    flex: 1,
  },
  routeLabel: {
    color: '#A2ADBD',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 4,
  },
  routeValue: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  routeDividerWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    marginVertical: 6,
  },
  routeDivider: {
    width: 2,
    height: 32,
    backgroundColor: '#CFE9E6',
  },
  routeDistance: {
    color: '#8D9BB0',
    fontSize: 13,
    fontWeight: '700',
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  customerMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  customerAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerAvatarText: {
    color: palette.card,
    fontSize: 18,
    fontWeight: '900',
  },
  customerName: {
    color: '#000',
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 3,
  },
  customerPhone: {
    color: '#8C9AAF',
    fontSize: 13,
    fontWeight: '600',
  },
  customerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  customerCallButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  customerMessageButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F2F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  packageStatsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  packageStatBox: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#F0F9F8',
    padding: 14,
  },
  packageStatLabel: {
    color: '#A1ACBC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  packageStatValue: {
    color: '#000',
    fontSize: 17,
    fontWeight: '800',
  },
  detailBox: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E8EEF4',
    padding: 14,
    marginBottom: 12,
  },
  detailBoxLabel: {
    color: '#A1ACBC',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  detailBoxValue: {
    color: '#000',
    fontSize: 15,
    fontWeight: '700',
  },
  instructionsBox: {
    flexDirection: 'row',
    gap: 10,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#F5D67A',
    backgroundColor: '#FFF8E7',
    padding: 14,
  },
  instructionsBody: {
    flex: 1,
  },
  instructionsLabel: {
    color: '#B88100',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 4,
  },
  instructionsText: {
    color: '#8A5600',
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  actionSection: {
    gap: 10,
    paddingBottom: 10,
  },
  backActionButton: {
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F7FBFB',
  },
  backActionText: {
    color: '#3E4A5D',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActionButton: {
    height: 52,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.primary,
    backgroundColor: palette.card,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryActionText: {
    color: palette.primary,
    fontSize: 16,
    fontWeight: '800',
  },
  primaryActionButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: '#051614',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  completedActionButton: {
    height: 52,
    borderRadius: 16,
    backgroundColor: palette.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    shadowColor: '#63C9C0',
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  primaryActionText: {
    color: palette.card,
    fontSize: 16,
    fontWeight: '800',
  },
  customerAvatarImage: {
    width: 42,
    height: 42,
    borderRadius: 21,
  },
  roleLabelText: {
    fontSize: 9,
    fontWeight: '900',
    color: palette.primary,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  flowDividerRow: {
    alignItems: 'flex-start',
    marginVertical: 4,
  },
  flowDividerLineContainer: {
    width: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowDividerLine: {
    width: 2,
    height: 10,
    backgroundColor: '#E2E8F0',
  },
  flowDividerArrowBox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#E6F7F5',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BFECE8',
  },
});
