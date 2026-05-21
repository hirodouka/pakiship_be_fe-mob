import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useEffect, useState, useMemo } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '../context/AuthSessionContext';
import type { RootStackParamList } from '../../lib/navigation/types';
import { apiRequest } from '../services/api';
import { authApi } from '../services/authApi';

type TabType = 'home' | 'parcels' | 'analytics';

type DropoffStatus = 'pending' | 'processing' | 'received';

interface DropoffParcel {
  id: string;
  trackingNumber: string;
  sender: string;
  recipient: string;
  expectedArrival: string;
  status: DropoffStatus;
  packageSize: 'Small' | 'Medium' | 'Large';
  origin: string;
  receivedAt?: string;
}

const palette = {
  appBg: '#F8FBFB',
  shell: '#F8FBFB',
  card: '#FFFFFF',
  cardBorder: '#E1F2F0',
  primary: '#39B5A8',
  primarySoft: '#EBF9F7',
  text: '#041614',
  subtext: '#6B7A77',
  success: '#10B981',
  successSoft: '#ECFDF5',
  warning: '#F59E0B',
  warningSoft: '#FFFBEB',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
  info: '#3B82F6',
  infoSoft: '#EFF6FF',
};

const logoImg = require('../../assets/images/logo.png');

export default function OperatorHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'OperatorHome'>>();
  const { currentUser, clearCurrentUser } = useAuthSession();
  const [activeTab, setActiveTab] = useState<TabType>('home');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hubSummary, setHubSummary] = useState<any>(null);

  const [pendingParcels, setPendingParcels] = useState<DropoffParcel[]>([]);
  const [receivedParcels, setReceivedParcels] = useState<DropoffParcel[]>([]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [summaryRes, parcelsRes] = await Promise.all([
        apiRequest('/pakiship/mobile/operator/hub-summary'),
        apiRequest('/pakiship/mobile/operator/pending-parcels'),
      ]);
      setHubSummary(summaryRes);
      setPendingParcels(parcelsRes.parcels);
    } catch (error) {
      console.error('Failed to fetch operator dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const userName = useMemo(() => currentUser?.fullName?.trim() || 'Operator', [currentUser]);
  const hubName = hubSummary?.hubName || 'Loading Hub...';

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch (e) {
      console.log('Logout failed:', e);
    } finally {
      clearCurrentUser();
      navigation.reset({
        index: 0,
        routes: [{ name: 'Login' }],
      });
    }
  };

  const handleReceiveParcel = async (parcel: DropoffParcel) => {
    try {
      await apiRequest(`/pakiship/mobile/operator/receive/${parcel.id}`, { method: 'POST' });
      const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const updated: DropoffParcel = { ...parcel, status: 'received', receivedAt: timeStr };
      setPendingParcels((prev) => prev.filter((p) => p.id !== parcel.id));
      setReceivedParcels((prev) => [updated, ...prev]);
    } catch (error) {
      console.error('Failed to receive parcel:', error);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.phoneShell}>
        <View style={styles.header}>
          <Image source={logoImg} style={styles.brandLogo} resizeMode="contain" />
          <View style={styles.headerActions}>
            <HeaderButton icon="bell-outline" />
            <HeaderButton icon="logout" danger onPress={() => setShowLogoutModal(true)} />
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {activeTab === 'home' && (
            <HomeView
              userName={userName}
              hubName={hubName}
              navigation={navigation}
              capacity={hubSummary?.capacityPercentage || 0}
            />
          )}

          {activeTab === 'parcels' && (
            <ParcelsView
              pending={pendingParcels}
              received={receivedParcels}
              onReceive={handleReceiveParcel}
            />
          )}

          {activeTab === 'analytics' && <AnalyticsView summary={hubSummary} />}
        </ScrollView>

        <BottomNav current={activeTab} onChange={setActiveTab} />
      </View>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

function HomeView({ userName, hubName, navigation, capacity }: any) {
  return (
    <View style={styles.viewWrap}>
      <View style={styles.welcomeCard}>
        <Text style={styles.welcomeSub}>MABUHAY,</Text>
        <Text style={styles.welcomeTitle}>
          {userName}
          <Text style={styles.primaryText}>!</Text>
        </Text>

        <View style={styles.hubBadge}>
          <View style={styles.hubIconWrap}>
            <MaterialCommunityIcons name="map-marker" size={18} color={palette.primary} />
          </View>
          <View>
            <Text style={styles.hubLabel}>ACTIVE HUB FACILITY</Text>
            <Text style={styles.hubName}>{hubName}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.sectionLabel}>QUICK ACTIONS</Text>
      <View style={styles.actionsGrid}>
        <ActionCard
          icon="barcode-scan"
          label="Receive Parcel"
          bg={palette.successSoft}
          color={palette.success}
          onPress={() => navigation.navigate('ReceiveParcel')}
        />
        <ActionCard
          icon="account-group-outline"
          label="Assign Driver"
          bg={palette.infoSoft}
          color={palette.info}
          onPress={() => {}}
        />
      </View>

      <Text style={styles.sectionLabel}>HUB CAPACITY STATUS</Text>
      <View style={styles.capacityCard}>
        <View style={styles.capacityHeader}>
          <Text style={styles.capacityTitle}>Storage Capacity</Text>
          <Text style={styles.capacityPercent}>{capacity}% Full</Text>
        </View>
        <View style={styles.progressBarBg}>
          <View style={[styles.progressBarFill, { width: `${capacity}%` }]} />
        </View>
        <View style={styles.capacityFootnoteWrap}>
          <MaterialCommunityIcons name="information-outline" size={14} color={palette.warning} />
          <Text style={styles.capacityFootnote}>
            {capacity > 70 ? "Section B is nearing full capacity." : "Capacity is optimal."}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ParcelsView({ pending, received, onReceive }: { pending: DropoffParcel[]; received: DropoffParcel[]; onReceive: (parcel: DropoffParcel) => void }) {
  return (
    <View style={styles.viewWrap}>
      <Text style={styles.sectionLabel}>PENDING DROP-OFFS ({pending.length})</Text>
      {pending.length === 0 ? (
        <View style={styles.emptyCard}>
          <MaterialCommunityIcons name="package-variant" size={32} color={palette.subtext} />
          <Text style={styles.emptyText}>No pending drop-offs</Text>
        </View>
      ) : (
        pending.map((p, idx) => (
          <View key={`pending-${p.id ?? 'none'}-${idx}`} style={styles.parcelCard}>
            <View style={styles.parcelHeader}>
              <View style={styles.trackingPill}>
                <Text style={styles.trackingText}>{p.trackingNumber}</Text>
              </View>
              <View style={[styles.sizePill, p.packageSize === 'Small' ? styles.sizeSmall : p.packageSize === 'Medium' ? styles.sizeMed : styles.sizeLarge]}>
                <Text style={styles.sizeText}>{p.packageSize.toUpperCase()}</Text>
              </View>
            </View>

            <View style={styles.parcelMeta}>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="account-outline" size={15} color={palette.subtext} />
                <Text style={styles.metaLabel}>Recipient: <Text style={styles.metaValue}>{p.recipient}</Text></Text>
              </View>
              <View style={styles.metaRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={15} color={palette.subtext} />
                <Text style={styles.metaLabel}>Origin: <Text style={styles.metaValue}>{p.origin}</Text></Text>
              </View>
            </View>

            <Pressable style={styles.receiveButton} onPress={() => onReceive(p)}>
              <MaterialCommunityIcons name="barcode-scan" size={16} color={palette.card} />
              <Text style={styles.receiveButtonText}>Scan & Receive</Text>
            </Pressable>
          </View>
        ))
      )}

      <Text style={[styles.sectionLabel, { marginTop: 20 }]}>RECEIVED TODAY ({received.length})</Text>
      {received.map((r, idx) => (
        <View key={`received-${r.id ?? 'none'}-${idx}`} style={[styles.parcelCard, styles.parcelReceivedCard]}>
          <View style={styles.receivedRow}>
            <View style={styles.receivedIconWrap}>
              <MaterialCommunityIcons name="check-circle-outline" size={22} color={palette.success} />
            </View>
            <View style={styles.receivedContent}>
              <Text style={styles.receivedTracking}>{r.trackingNumber}</Text>
              <Text style={styles.receivedMeta}>To: {r.recipient}</Text>
              <Text style={styles.receivedAt}>Processed at {r.receivedAt}</Text>
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}

function AnalyticsView({ summary }: any) {
  const earnings = summary?.earnings?.totalEarned || 0;
  const incoming = summary?.kpis?.incomingToday || 0;
  const pickedUp = summary?.kpis?.pickedUpToday || 0;

  return (
    <View style={styles.viewWrap}>
      <Text style={styles.sectionLabel}>FACILITY ANALYTICS</Text>
      
      <View style={styles.earningsCard}>
        <Text style={styles.earningsLabel}>TOTAL FACILITY EARNINGS</Text>
        <Text style={styles.earningsValue}>₱{earnings.toLocaleString() || '0.00'}</Text>
        <View style={styles.earningsGrowth}>
          <MaterialCommunityIcons name="trending-up" size={16} color="#34D399" />
          <Text style={styles.growthText}>+12.5% vs last week</Text>
        </View>
      </View>

      <View style={styles.analyticsGrid}>
        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: palette.infoSoft }]}>
            <MaterialCommunityIcons name="arrow-down-left" size={20} color={palette.info} />
          </View>
          <Text style={styles.statValue}>{incoming}</Text>
          <Text style={styles.statLabel}>INCOMING PARCELS</Text>
        </View>

        <View style={styles.statBox}>
          <View style={[styles.statIconWrap, { backgroundColor: palette.successSoft }]}>
            <MaterialCommunityIcons name="arrow-up-right" size={20} color={palette.success} />
          </View>
          <Text style={styles.statValue}>{pickedUp}</Text>
          <Text style={styles.statLabel}>PICKED UP PARCELS</Text>
        </View>
      </View>
    </View>
  );
}

function ActionCard({ icon, label, bg, color, onPress }: any) {
  return (
    <Pressable style={styles.actionCard} onPress={onPress}>
      <View style={[styles.actionIconWrap, { backgroundColor: bg }]}>
        <MaterialCommunityIcons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
    </Pressable>
  );
}

function HeaderButton({
  icon,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable style={styles.headerButton} onPress={onPress}>
      <MaterialCommunityIcons
        name={icon}
        size={19}
        color={danger ? palette.danger : palette.primary}
      />
    </Pressable>
  );
}

function LogoutModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.logoutIconWrap}>
            <MaterialCommunityIcons name="logout" size={32} color={palette.danger} />
          </View>
          <Text style={styles.modalTitle}>Sign Out?</Text>
          <Text style={styles.modalBody}>Are you sure you want to return to the login screen?</Text>

          <View style={styles.modalActions}>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmText}>Yes, Logout</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function BottomNav({
  current,
  onChange,
  }: {
  current: TabType;
  onChange: (tab: TabType) => void;
}) {
  return (
    <View style={styles.bottomNav}>
      <NavButton
        icon="view-dashboard-outline"
        label="HOME"
        active={current === 'home'}
        onPress={() => onChange('home')}
      />
      <NavButton
        icon="package-variant-closed"
        label="PARCELS"
        active={current === 'parcels'}
        onPress={() => onChange('parcels')}
      />
      <NavButton
        icon="chart-bar"
        label="STATS"
        active={current === 'analytics'}
        onPress={() => onChange('analytics')}
      />
    </View>
  );
}

function NavButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.navButton}>
      <View style={[styles.navIconWrap, active ? styles.navIconWrapActive : null]}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={active ? palette.primary : '#C1CBD8'}
        />
      </View>
      <Text style={[styles.navLabel, active ? styles.navLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.appBg,
  },
  phoneShell: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: '#E9F5F3',
    zIndex: 10,
  },
  brandLogo: {
    width: 78,
    height: 34,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 10,
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.card,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 28,
  },
  viewWrap: {
    flex: 1,
  },
  welcomeCard: {
    backgroundColor: palette.primarySoft,
    borderRadius: 28,
    padding: 22,
    borderWidth: 1,
    borderColor: '#D4F0EB',
    marginBottom: 20,
  },
  welcomeSub: {
    color: palette.subtext,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  welcomeTitle: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '900',
    marginTop: 2,
    marginBottom: 16,
  },
  primaryText: {
    color: palette.primary,
  },
  hubBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 16,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: 'rgba(57, 181, 168, 0.15)',
  },
  hubIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hubLabel: {
    color: '#8CA09D',
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  hubName: {
    color: palette.text,
    fontSize: 14,
    fontWeight: '800',
    marginTop: 1,
  },
  sectionLabel: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    gap: 14,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 24,
    padding: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.cardBorder,
    shadowColor: '#A8D9D4',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  actionIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  actionLabel: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '800',
  },
  capacityCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 20,
    shadowColor: '#A8D9D4',
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
    marginBottom: 20,
  },
  capacityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  capacityTitle: {
    color: palette.text,
    fontSize: 15,
    fontWeight: '800',
  },
  capacityPercent: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '900',
  },
  progressBarBg: {
    height: 10,
    backgroundColor: '#EEF6F5',
    borderRadius: 999,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: palette.primary,
    borderRadius: 999,
  },
  capacityFootnoteWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  capacityFootnote: {
    color: '#8A9E9A',
    fontSize: 11,
    fontWeight: '600',
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
  },
  emptyText: {
    color: palette.subtext,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 8,
  },
  parcelCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 16,
    marginBottom: 12,
  },
  parcelReceivedCard: {
    borderColor: '#DCFCE7',
    backgroundColor: palette.successSoft,
  },
  parcelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  trackingPill: {
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
  },
  trackingText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  sizePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  sizeSmall: { backgroundColor: '#EFF6FF' },
  sizeMed: { backgroundColor: '#FFFBEB' },
  sizeLarge: { backgroundColor: '#FEF2F2' },
  sizeText: {
    fontSize: 10,
    fontWeight: '900',
    color: palette.subtext,
  },
  parcelMeta: {
    gap: 8,
    marginBottom: 16,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metaLabel: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '600',
  },
  metaValue: {
    color: palette.text,
    fontWeight: '800',
  },
  receiveButton: {
    backgroundColor: palette.primary,
    borderRadius: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  receiveButtonText: {
    color: palette.card,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  receivedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  receivedIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: palette.card,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#BBEFCD',
  },
  receivedContent: {
    flex: 1,
  },
  receivedTracking: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
  },
  receivedMeta: {
    color: palette.subtext,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  receivedAt: {
    color: palette.success,
    fontSize: 10,
    fontWeight: '800',
    marginTop: 4,
  },
  earningsCard: {
    backgroundColor: '#041614',
    borderRadius: 28,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#041614',
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 4,
  },
  earningsLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  earningsValue: {
    color: palette.card,
    fontSize: 34,
    fontWeight: '900',
    marginTop: 4,
  },
  earningsGrowth: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    marginTop: 12,
  },
  growthText: {
    color: '#34D399',
    fontSize: 11,
    fontWeight: '700',
  },
  analyticsGrid: {
    flexDirection: 'row',
    gap: 14,
  },
  statBox: {
    flex: 1,
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 18,
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  statValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 4,
  },
  statLabel: {
    color: palette.subtext,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 22, 20, 0.45)',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
  },
  logoutIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalBody: {
    color: palette.subtext,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    backgroundColor: palette.danger,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    color: palette.card,
    fontSize: 14,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: palette.subtext,
    fontSize: 14,
    fontWeight: '700',
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    paddingBottom: 24,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#E9F5F3',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
  },
  navIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  navIconWrapActive: {
    backgroundColor: palette.primarySoft,
  },
  navLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#C1CBD8',
    letterSpacing: 0.5,
  },
  navLabelActive: {
    color: palette.primary,
  },
});
