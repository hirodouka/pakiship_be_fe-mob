import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { jobs, type DriverJob, type JobStatus } from '@features/services/driverData';
import type { RootStackParamList } from '@navigation/types';

type StatItem = {
  key: string;
  label: string;
  value: string;
  footnote: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  highlighted?: boolean;
};

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
  success: '#19C566',
  warning: '#FF8C39',
  danger: '#FF6464',
};

const logoImage = require('../../assets/logo.png');

const topStats: StatItem[] = [
  {
    key: 'earnings',
    label: "TODAY'S EARNINGS",
    value: 'P95',
    footnote: '+P120 in progress',
    icon: 'currency-php',
    highlighted: true,
  },
  {
    key: 'deliveries',
    label: 'DELIVERIES TODAY',
    value: '2',
    footnote: '+1 in progress',
    icon: 'cube-outline',
  },
  {
    key: 'acceptance',
    label: 'ACCEPTANCE RATE',
    value: '96%',
    footnote: 'High',
    icon: 'trending-up',
  },
  {
    key: 'online',
    label: 'ONLINE TIME',
    value: '5h 32m',
    footnote: 'Active',
    icon: 'clock-outline',
  },
];

export function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'DriverHome'>>();
  const [tab, setTab] = useState<'home' | 'jobs'>('home');
  const [jobFilter, setJobFilter] = useState<JobStatus>('available');
  const [isOnline, setIsOnline] = useState(true);
  const [showNotifications, setShowNotifications] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);

  const filteredJobs = useMemo(
    () => jobs.filter((job) => job.status === jobFilter),
    [jobFilter],
  );

  const activeJob = useMemo(() => jobs.find((job) => job.status === 'in-progress'), []);
  const availableJobsCount = useMemo(
    () => jobs.filter((job: DriverJob) => job.status === 'available').length,
    [],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.phoneShell}>
        <Header
          availableJobsCount={availableJobsCount}
          showNotifications={showNotifications}
          hasUnreadNotifications={hasUnreadNotifications}
          onToggleNotifications={() => {
            setShowNotifications((current) => !current);
            setHasUnreadNotifications(false);
          }}
          onCloseNotifications={() => setShowNotifications(false)}
          onPressProfile={() => navigation.navigate('DriverProfile')}
        />
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ProfileCard isOnline={isOnline} onToggleOnline={() => setIsOnline((current) => !current)} />

          {tab === 'home' ? (
            <>
              <View style={styles.statsGrid}>
                {topStats.map((stat) => (
                  <StatCard
                    key={stat.key}
                    label={stat.label}
                    value={stat.value}
                    footnote={stat.footnote}
                    icon={stat.icon}
                    highlighted={stat.highlighted}
                  />
                ))}
              </View>

              {activeJob ? (
                <ActiveDeliveryCard
                  job={activeJob}
                  onOpenJob={() => navigation.navigate('JobDetails', { id: activeJob.id })}
                />
              ) : null}
            </>
          ) : (
            <>
              <View style={styles.segmentedControl}>
                {(['available', 'in-progress', 'completed'] as JobStatus[]).map((value) => (
                  <FilterChip
                    key={value}
                    label={`${labelForStatus(value)} (${jobs.filter((job: DriverJob) => job.status === value).length})`}
                    active={jobFilter === value}
                    onPress={() => setJobFilter(value)}
                  />
                ))}
              </View>

              <View style={styles.jobList}>
                {filteredJobs.map((job: DriverJob) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpenJob={() => navigation.navigate('JobDetails', { id: job.id })}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <BottomNav current={tab} onChange={setTab} />
      </View>
    </SafeAreaView>
  );
}

function Header({
  availableJobsCount,
  showNotifications,
  hasUnreadNotifications,
  onToggleNotifications,
  onCloseNotifications,
  onPressProfile,
}: {
  availableJobsCount: number;
  showNotifications: boolean;
  hasUnreadNotifications: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onPressProfile: () => void;
}) {
  return (
    <View style={styles.headerWrap}>
      {showNotifications ? (
        <Pressable style={styles.notificationsBackdrop} onPress={onCloseNotifications} />
      ) : null}

      <View style={styles.header}>
        <Image source={logoImage} style={styles.brandLogo} resizeMode="contain" />
        <View style={styles.headerActions}>
          <HeaderButton
            icon="bell-outline"
            badge={hasUnreadNotifications}
            onPress={onToggleNotifications}
          />
          <HeaderButton icon="help-circle-outline" />
          <HeaderButton icon="account-outline" onPress={onPressProfile} />
          <HeaderButton icon="logout" danger />
        </View>
      </View>

      {showNotifications ? (
        <NotificationMenu availableJobsCount={availableJobsCount} onClose={onCloseNotifications} />
      ) : null}
    </View>
  );
}

function HeaderButton({
  icon,
  badge,
  danger,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  badge?: boolean;
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
      {badge ? <View style={styles.notificationDot} /> : null}
    </Pressable>
  );
}

function NotificationMenu({
  availableJobsCount,
  onClose,
}: {
  availableJobsCount: number;
  onClose: () => void;
}) {
  return (
    <View style={styles.notificationMenu}>
      <View style={styles.notificationHeader}>
        <Text style={styles.notificationTitle}>NOTIFICATIONS</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <MaterialCommunityIcons name="close" size={16} color="#C4CBD5" />
        </Pressable>
      </View>

      <View style={styles.notificationItem}>
        <View style={[styles.notificationIconBubble, styles.notificationIconPrimary]}>
          <MaterialCommunityIcons name="cube-outline" size={15} color={palette.primary} />
        </View>
        <View style={styles.notificationBody}>
          <Text style={styles.notificationItemTitle}>Jobs Available!</Text>
          <Text style={styles.notificationItemText}>{availableJobsCount} requests near you.</Text>
          <Text style={styles.notificationTime}>JUST NOW</Text>
        </View>
      </View>

      <View style={styles.notificationItem}>
        <View style={[styles.notificationIconBubble, styles.notificationIconSecondary]}>
          <MaterialCommunityIcons name="refresh" size={15} color="#6E97FF" />
        </View>
        <View style={styles.notificationBody}>
          <Text style={styles.notificationItemTitle}>System Update</Text>
          <Text style={styles.notificationItemText}>Profile picture update now active.</Text>
          <Text style={styles.notificationTime}>2H AGO</Text>
        </View>
      </View>
    </View>
  );
}

function ProfileCard({
  isOnline,
  onToggleOnline,
}: {
  isOnline: boolean;
  onToggleOnline: () => void;
}) {
  return (
    <View style={styles.profileCard}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          <MaterialCommunityIcons name="account-outline" size={34} color={palette.primary} />
        </View>
        <View style={styles.cameraBadge}>
          <MaterialCommunityIcons name="camera-outline" size={14} color={palette.card} />
        </View>
      </View>

      <View style={styles.profileContent}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.profileName}>User</Text>
          <Pressable
            onPress={onToggleOnline}
            style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillOffline]}
          >
            <View style={[styles.onlineDot, isOnline ? styles.onlineDotActive : styles.onlineDotOffline]} />
            <Text style={styles.onlineText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </Pressable>
        </View>
        <Text style={styles.profileMeta}>PakiShip Partner Driver · 4.8 Rating</Text>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  footnote,
  icon,
  highlighted,
}: {
  label: string;
  value: string;
  footnote: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  highlighted?: boolean;
}) {
  return (
    <View style={[styles.statCard, highlighted ? styles.primaryStatCard : null]}>
      <View style={[styles.statIcon, highlighted ? styles.primaryStatIcon : null]}>
        <MaterialCommunityIcons
          name={icon}
          size={20}
          color={highlighted ? palette.card : palette.primary}
        />
      </View>
      <Text style={[styles.statValue, highlighted ? styles.primaryStatText : null]}>{value}</Text>
      <Text style={[styles.statLabel, highlighted ? styles.primaryStatLabel : null]}>{label}</Text>
      <Text style={[styles.statFootnote, highlighted ? styles.primaryStatFootnote : null]}>
        {footnote}
      </Text>
    </View>
  );
}

function ActiveDeliveryCard({
  job,
  onOpenJob,
}: {
  job: DriverJob;
  onOpenJob: () => void;
}) {
  return (
    <View style={styles.deliveryCard}>
      <View style={styles.deliveryHeader}>
        <View style={styles.deliveryTitleRow}>
          <View style={styles.deliveryIconBubble}>
            <MaterialCommunityIcons name="truck-fast-outline" size={16} color={palette.primary} />
          </View>
          <Text style={styles.deliveryTitle}>ACTIVE DELIVERY</Text>
        </View>
        <View style={styles.progressTag}>
          <Text style={styles.progressTagText}>IN PROGRESS</Text>
        </View>
      </View>

      <Text style={styles.deliveryLabel}>CURRENT DROP-OFF</Text>
      <View style={styles.locationRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={18} color={palette.danger} />
        <Text style={styles.deliveryAddress}>{job.dropoff}</Text>
      </View>

      <Pressable style={styles.ctaButton} onPress={onOpenJob}>
        <MaterialCommunityIcons name="navigation-variant-outline" size={17} color={palette.card} />
        <Text style={styles.ctaButtonText}>OPEN NAVIGATION</Text>
      </Pressable>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.filterChip, active ? styles.filterChipActive : null]}>
      <Text style={[styles.filterChipText, active ? styles.filterChipTextActive : null]}>{label}</Text>
    </Pressable>
  );
}

function JobCard({
  job,
  onOpenJob,
}: {
  job: DriverJob;
  onOpenJob: () => void;
}) {
  return (
    <View style={styles.jobCard}>
      <View style={styles.jobBadgeRow}>
        <View style={styles.jobTagPill}>
          <Text style={styles.jobTagPillText}>{job.tag}</Text>
        </View>
        <View style={styles.jobSizePill}>
          <Text style={styles.jobSizeText}>{job.size.toUpperCase()}</Text>
        </View>
        {job.eta ? (
          <View style={styles.jobEtaPill}>
            <MaterialCommunityIcons name="clock-outline" size={13} color={palette.card} />
            <Text style={styles.jobEtaText}>{job.eta}</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.stopRow}>
        <View style={styles.stopDot} />
        <View style={styles.stopTextWrap}>
          <Text style={styles.stopLabel}>PICKUP</Text>
          <Text style={styles.stopValue}>{job.pickup}</Text>
        </View>
      </View>

      <View style={styles.routeDivider} />

      <View style={styles.stopRow}>
        <MaterialCommunityIcons name="map-marker-outline" size={17} color={palette.danger} />
        <View style={styles.stopTextWrap}>
          <Text style={styles.stopLabel}>DROP-OFF</Text>
          <Text style={styles.stopValue}>{job.dropoff}</Text>
        </View>
      </View>

      <View style={styles.jobMetaRow}>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="map-outline" size={14} color={palette.subtext} />
          <Text style={styles.metaItemText}>{job.distance}</Text>
        </View>
        <View style={styles.metaItem}>
          <MaterialCommunityIcons name="account-outline" size={14} color={palette.subtext} />
          <Text style={styles.metaItemText}>{job.customer}</Text>
        </View>
      </View>

      <Text style={styles.jobEarnings}>{job.earnings}</Text>
      <Text style={styles.jobEarningsLabel}>EARNINGS</Text>

      {job.status === 'available' ? (
        <Pressable style={styles.jobPrimaryButton} onPress={onOpenJob}>
          <MaterialCommunityIcons name="information-outline" size={18} color={palette.card} />
          <Text style={styles.jobPrimaryButtonText}>View Full Information</Text>
        </Pressable>
      ) : null}

      {job.status === 'in-progress' ? (
        <View style={styles.jobActionRow}>
          <Pressable style={styles.jobSecondaryButton}>
            <MaterialCommunityIcons name="phone-outline" size={18} color={palette.primary} />
            <Text style={styles.jobSecondaryButtonText}>Call</Text>
          </Pressable>
          <Pressable style={styles.jobDarkButton}>
            <MaterialCommunityIcons name="refresh" size={18} color={palette.card} />
            <Text style={styles.jobDarkButtonText}>Update Status</Text>
          </Pressable>
        </View>
      ) : null}

      {job.status === 'completed' ? (
        <View style={styles.completedRow}>
          <View style={styles.completedBadge}>
            <MaterialCommunityIcons name="check-circle-outline" size={18} color={palette.success} />
            <Text style={styles.completedText}>Completed</Text>
          </View>
          <Pressable onPress={onOpenJob}>
            <Text style={styles.receiptLink}>View Receipt</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function BottomNav({
  current,
  onChange,
}: {
  current: 'home' | 'jobs';
  onChange: (value: 'home' | 'jobs') => void;
}) {
  return (
    <View style={styles.bottomNav}>
      <BottomNavItem
        icon="view-grid-outline"
        label="HOME"
        active={current === 'home'}
        onPress={() => onChange('home')}
      />
      <BottomNavItem
        icon="cube-outline"
        label="JOBS"
        active={current === 'jobs'}
        onPress={() => onChange('jobs')}
      />
    </View>
  );
}

function BottomNavItem({
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
    <Pressable onPress={onPress} style={styles.bottomNavItem}>
      <View style={[styles.bottomNavIconWrap, active ? styles.bottomNavIconWrapActive : null]}>
        <MaterialCommunityIcons
          name={icon}
          size={22}
          color={active ? palette.primary : '#C7D0DE'}
        />
      </View>
      <Text style={[styles.bottomNavLabel, active ? styles.bottomNavLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function labelForStatus(status: JobStatus) {
  if (status === 'in-progress') {
    return 'IN-PROGRESS';
  }

  return status.toUpperCase();
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.appBg,
  },
  phoneShell: {
    flex: 1,
    backgroundColor: palette.shell,
  },
  scrollContent: {
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 28,
    gap: 18,
  },
  headerWrap: {
    position: 'relative',
    zIndex: 20,
  },
  notificationsBackdrop: {
    ...StyleSheet.absoluteFillObject,
    top: 0,
    bottom: -1000,
    zIndex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: palette.card,
    borderBottomWidth: 1,
    borderBottomColor: '#E8F3F2',
    zIndex: 2,
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
  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 7,
    height: 7,
    borderRadius: 999,
    backgroundColor: palette.danger,
  },
  notificationMenu: {
    position: 'absolute',
    top: 58,
    right: 18,
    width: 198,
    borderRadius: 18,
    backgroundColor: palette.card,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    shadowColor: '#7FAEAA',
    shadowOpacity: 0.24,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
    zIndex: 3,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  notificationTitle: {
    color: palette.text,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 10,
    paddingVertical: 8,
  },
  notificationIconBubble: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  notificationIconPrimary: {
    backgroundColor: '#EAF9F7',
  },
  notificationIconSecondary: {
    backgroundColor: '#EDF3FF',
  },
  notificationBody: {
    flex: 1,
  },
  notificationItemTitle: {
    color: palette.text,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 1,
  },
  notificationItemText: {
    color: palette.subtext,
    fontSize: 11,
    fontWeight: '600',
    marginBottom: 5,
  },
  notificationTime: {
    color: '#C7CFD9',
    fontSize: 9,
    fontWeight: '800',
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 16,
    shadowColor: '#90CAC4',
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  avatarWrap: {
    position: 'relative',
    marginRight: 16,
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 3,
    borderColor: '#BFEDE7',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F8FFFE',
  },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: 0,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: palette.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: palette.card,
  },
  profileContent: {
    flex: 1,
  },
  profileHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 6,
  },
  profileName: {
    color: palette.text,
    fontSize: 18,
    fontWeight: '800',
  },
  onlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  onlinePillActive: {
    borderColor: '#9DE4BF',
    backgroundColor: '#F3FFF8',
  },
  onlinePillOffline: {
    borderColor: '#F5B5B5',
    backgroundColor: '#FFF5F5',
  },
  onlineDot: {
    width: 8,
    height: 8,
    borderRadius: 99,
  },
  onlineDotActive: {
    backgroundColor: palette.success,
  },
  onlineDotOffline: {
    backgroundColor: palette.danger,
  },
  onlineText: {
    color: '#091F1C',
    fontSize: 10,
    fontWeight: '800',
  },
  profileMeta: {
    color: palette.primary,
    fontSize: 13,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  statCard: {
    width: '47.8%',
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 16,
    minHeight: 128,
    shadowColor: '#A5DAD5',
    shadowOpacity: 0.16,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  primaryStatCard: {
    backgroundColor: palette.primary,
    borderColor: palette.primary,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.primarySoft,
    marginBottom: 18,
  },
  primaryStatIcon: {
    backgroundColor: 'rgba(255,255,255,0.16)',
  },
  statValue: {
    color: palette.text,
    fontSize: 22,
    fontWeight: '900',
    marginBottom: 6,
  },
  primaryStatText: {
    color: palette.card,
  },
  statLabel: {
    color: palette.subtext,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.1,
  },
  primaryStatLabel: {
    color: 'rgba(255,255,255,0.82)',
  },
  statFootnote: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 12,
  },
  primaryStatFootnote: {
    color: 'rgba(255,255,255,0.96)',
  },
  deliveryCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 18,
    shadowColor: '#9FD5CF',
    shadowOpacity: 0.16,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 2,
  },
  deliveryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  deliveryTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deliveryIconBubble: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: palette.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deliveryTitle: {
    color: palette.text,
    fontWeight: '800',
    fontSize: 13,
    letterSpacing: 0.8,
  },
  progressTag: {
    borderRadius: 999,
    backgroundColor: '#FFF3EA',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  progressTagText: {
    color: palette.warning,
    fontSize: 10,
    fontWeight: '900',
  },
  deliveryLabel: {
    color: palette.subtext,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.9,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginBottom: 20,
  },
  deliveryAddress: {
    flex: 1,
    color: palette.text,
    fontWeight: '800',
    fontSize: 26,
    lineHeight: 32,
  },
  ctaButton: {
    backgroundColor: palette.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  ctaButtonText: {
    color: palette.card,
    fontWeight: '800',
    fontSize: 14,
    letterSpacing: 0.8,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 5,
    gap: 6,
  },
  filterChip: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: palette.card,
  },
  filterChipActive: {
    backgroundColor: palette.primary,
  },
  filterChipText: {
    color: '#97A2B3',
    fontSize: 10,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: palette.card,
  },
  jobList: {
    gap: 16,
  },
  jobCard: {
    backgroundColor: palette.card,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: palette.cardBorder,
    padding: 18,
    shadowColor: '#9FD6D0',
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  jobBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
    marginBottom: 18,
  },
  jobTagPill: {
    backgroundColor: palette.primarySoft,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
  },
  jobTagPillText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
  },
  jobSizePill: {
    backgroundColor: '#F2F4F7',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  jobSizeText: {
    color: '#7E8AA0',
    fontSize: 10,
    fontWeight: '900',
  },
  jobEtaPill: {
    backgroundColor: palette.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  jobEtaText: {
    color: palette.card,
    fontSize: 10,
    fontWeight: '900',
  },
  stopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  stopDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    backgroundColor: palette.primary,
    marginTop: 4,
  },
  stopTextWrap: {
    flex: 1,
  },
  stopLabel: {
    color: '#9AA6B8',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  stopValue: {
    color: palette.text,
    fontSize: 26,
    fontWeight: '800',
    lineHeight: 31,
  },
  routeDivider: {
    height: 28,
    borderLeftWidth: 1,
    borderLeftColor: '#CDE8E4',
    borderStyle: 'dashed',
    marginLeft: 6,
    marginVertical: 8,
  },
  jobMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flexWrap: 'wrap',
    marginTop: 14,
    marginBottom: 18,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  metaItemText: {
    color: palette.subtext,
    fontSize: 13,
    fontWeight: '600',
  },
  jobEarnings: {
    color: palette.primary,
    fontSize: 34,
    fontWeight: '900',
    marginBottom: 2,
  },
  jobEarningsLabel: {
    color: '#98A7BA',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 18,
  },
  jobPrimaryButton: {
    backgroundColor: palette.primary,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  jobPrimaryButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  jobActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  jobSecondaryButton: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: palette.primary,
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  jobSecondaryButtonText: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  jobDarkButton: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: '#051614',
    paddingVertical: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  jobDarkButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    color: palette.success,
    fontSize: 15,
    fontWeight: '800',
  },
  receiptLink: {
    color: palette.primary,
    fontSize: 15,
    fontWeight: '800',
  },
  bottomNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: palette.card,
    borderTopWidth: 1,
    borderTopColor: '#E6F0F0',
    paddingTop: 10,
    paddingBottom: 14,
  },
  bottomNavItem: {
    alignItems: 'center',
    gap: 6,
    minWidth: 88,
  },
  bottomNavIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomNavIconWrapActive: {
    backgroundColor: palette.primarySoft,
  },
  bottomNavLabel: {
    color: '#C0CBD8',
    fontWeight: '800',
    fontSize: 10,
    letterSpacing: 1.1,
  },
  bottomNavLabelActive: {
    color: palette.primary,
  },
});
