import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import type { RefObject } from 'react';
import {
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Location from 'expo-location';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '../context/AuthSessionContext';
import { apiRequest } from '../services/api';
import { authApi } from '../services/authApi';
import { LogoutModal } from '../shared/components/LogoutModal';
import type { RootStackParamList } from '../../lib/navigation/types';

export type JobStatus = 'available' | 'in-progress' | 'completed';
export type DeliveryType = 'direct' | 'relay';

export type DriverJob = {
  id: string;
  tag: string;
  size: 'Small' | 'Medium' | 'Large';
  eta?: string;
  pickup: string;
  dropoff: string;
  distance: string;
  customer: string;
  customerPhone?: string;
  earnings: string;
  status: JobStatus;
  deliveryType: DeliveryType;
  relayPoint?: string;
  qrCode?: string;
  packageDescription?: string;
  specialInstructions?: string;
};

export const initialJobs: DriverJob[] = [
  {
    id: '1',
    tag: 'JOB-2026-5647',
    size: 'Small',
    eta: '30 mins',
    pickup: 'BGC, Taguig City',
    dropoff: 'Makati Avenue, Makati',
    distance: '3.2 km',
    customer: 'Maria Santos',
    customerPhone: '+63 912 345 6789',
    earnings: 'P85',
    status: 'available',
    deliveryType: 'direct',
    packageDescription: 'Documents and papers',
    specialInstructions: 'Please handle with care. Ring doorbell twice.',
  },
  {
    id: '2',
    tag: 'JOB-2026-5648',
    size: 'Medium',
    eta: '25 mins',
    pickup: 'SM Megamall, Mandaluyong',
    dropoff: 'Ortigas Center, Pasig',
    distance: '2.8 km',
    customer: 'Juan Reyes',
    customerPhone: '+63 917 234 5678',
    earnings: 'P120',
    status: 'in-progress',
    deliveryType: 'direct',
    packageDescription: 'Electronics - Laptop',
    specialInstructions: 'Fragile item. Call upon arrival.',
  },
  {
    id: '3',
    tag: 'JOB-2026-5645',
    size: 'Small',
    pickup: 'Quezon City Hall',
    dropoff: 'UP Diliman, QC',
    distance: '4.5 km',
    customer: 'Anna Cruz',
    customerPhone: '+63 915 876 5432',
    earnings: 'P95',
    status: 'completed',
    deliveryType: 'direct',
    packageDescription: 'Books and stationery',
    specialInstructions: 'Leave at security desk if not home.',
  },
  {
    id: '4',
    tag: 'R-2026-3401',
    size: 'Small',
    eta: '20 mins',
    pickup: '7-Eleven Frassati Gate',
    dropoff: 'Mini Stop Commonwealth Ave',
    distance: '2.1 km',
    customer: 'Jose Garcia',
    customerPhone: '+63 918 765 4321',
    earnings: 'P65',
    status: 'available',
    deliveryType: 'relay',
    relayPoint: '7-Eleven Frassati Gate',
    qrCode: 'PKS-RELAY-3401',
    packageDescription: 'Clothing package',
    specialInstructions: 'Scan the customer QR code at the pickup point to confirm.',
  },
  {
    id: '5',
    tag: 'R-2026-3398',
    size: 'Small',
    eta: '15 mins',
    pickup: '7-Eleven Frassati Gate',
    dropoff: 'FamilyMart Near Frassati',
    distance: '1.2 km',
    customer: 'Rosa Martinez',
    customerPhone: '+63 921 234 5678',
    earnings: 'P50',
    status: 'in-progress',
    deliveryType: 'relay',
    relayPoint: '7-Eleven Frassati Gate',
    qrCode: 'PKS-RELAY-3398',
    packageDescription: 'Snacks and beverages',
    specialInstructions: 'Quick relay handoff, perishable items inside.',
  },
  {
    id: '6',
    tag: 'R-2026-3395',
    size: 'Medium',
    pickup: 'Mini Stop Commonwealth Ave',
    dropoff: 'Alfamart Frassati Corner',
    distance: '2.3 km',
    customer: 'Carlos Diaz',
    customerPhone: '+63 922 345 6789',
    earnings: 'P60',
    status: 'completed',
    deliveryType: 'relay',
    relayPoint: 'Mini Stop Commonwealth Ave',
    qrCode: 'PKS-RELAY-3395',
    packageDescription: 'Office supplies',
    specialInstructions: 'Package was picked up and delivered successfully.',
  },
];

type StatItem = {
  key: string;
  label: string;
  value: string;
  footnote: string;
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  highlighted?: boolean;
};

const palette = {
  appBg: '#FFFFFF',
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

const logoImage = require('../../assets/images/logo.png');
const tutorialHelloImage = require('../../assets/images/Pakiship Hello.png');
const tutorialHistoryImage = require('../../assets/images/Pakiship History.png');
const tutorialSendParcelImage = require('../../assets/images/Pakiship Send Parcel.png');
const tutorialEarningImage = require('../../assets/images/Pakiship Earning.png');
const tutorialTrackImage = require('../../assets/images/Pakiship Track.png');
const tutorialFindJobsImage = require('../../assets/images/Pakiship History.png');

type HighlightRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type TutorialStepConfig = {
  title: string;
  body: string;
  image: number;
};

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

export default function DriverHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'DriverHome'>>();
  const { currentUser, clearCurrentUser } = useAuthSession();
  const [jobsState, setJobsState] = useState<DriverJob[]>([]);
  const driverName = useMemo(() => currentUser?.fullName?.trim() || 'Driver', [currentUser]);
  const [tab, setTab] = useState<'home' | 'jobs'>('home');
  const [deliveryTypeFilter, setDeliveryTypeFilter] = useState<DeliveryType>('direct');
  const [jobFilter, setJobFilter] = useState<JobStatus>('available');
  const [isOnline, setIsOnline] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [driverRating, setDriverRating] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [hasUnreadNotifications, setHasUnreadNotifications] = useState(true);
  const [callJob, setCallJob] = useState<DriverJob | null>(null);
  const [showStatusErrorModal, setShowStatusErrorModal] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false); // Default to false for real logic
  const [tutorialStep, setTutorialStep] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StatItem[]>([]);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const [earningsRes, jobsRes, profileRes] = await Promise.all([
        apiRequest('/pakiship/mobile/driver/earnings?period=today'),
        apiRequest('/pakiship/mobile/driver/jobs'),
        apiRequest('/pakiship/mobile/driver/profile'),
      ]);

      setIsOnline(profileRes.isOnline);
      setProfileImageUri(profileRes.profilePicture);
      
      // Pull real average rating from customer reviews (via jobs metrics)
      setDriverRating(jobsRes.metrics?.ratingAverage || 0);

      // Map stats
      const newStats: StatItem[] = [
        {
          key: 'earnings',
          label: "TODAY'S EARNINGS",
          value: `P${earningsRes.totalAmount}`,
          footnote: `From ${earningsRes.completedJobs} jobs`,
          icon: 'currency-php',
          highlighted: true,
        },
        {
          key: 'deliveries',
          label: 'DELIVERIES TODAY',
          value: String(earningsRes.completedJobs),
          footnote: 'Target: 10',
          icon: 'cube-outline',
        },
        {
          key: 'acceptance',
          label: 'ACCEPTANCE RATE',
          value: `${Math.round(profileRes.acceptanceRate * 100)}%`,
          footnote: profileRes.acceptanceRate > 0.9 ? 'High' : 'Normal',
          icon: 'trending-up',
        },
        {
          key: 'online',
          label: 'DOCUMENT STATUS',
          value: profileRes.documentsStatus.toUpperCase(),
          footnote: 'Verified',
          icon: 'shield-check-outline',
        },
      ];
      setStats(newStats);

      // Map jobs
      const mappedJobs: DriverJob[] = (jobsRes.jobs || []).map((job: any) => ({
        id: job.id,
        tag: job.jobNumber,
        size: job.packageSize,
        pickup: job.pickup,
        dropoff: job.dropoff,
        distance: job.distance,
        customer: job.customerName,
        customerPhone: job.customerPhone,
        earnings: job.earnings,
        status: job.status,
        deliveryType: 'direct',
        packageDescription: job.packageDescription,
        specialInstructions: job.specialInstructions,
      }));
      setJobsState(mappedJobs);

    } catch (error) {
      console.error('Failed to fetch driver dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [])
  );

  const handleToggleOnline = async () => {
    try {
      const res = await apiRequest('/pakiship/mobile/driver/online-status', {
        method: 'PATCH',
        body: JSON.stringify({ isOnline: !isOnline }),
      });
      setIsOnline(res.presence.isOnline);
    } catch (error) {
      console.error('Failed to toggle online status:', error);
      setShowStatusErrorModal(true);
    }
  };

  const previousTutorialStepRef = useRef(0);
  const scrollViewRef = useRef<ScrollView | null>(null);
  const onlineToggleRef = useRef<View | null>(null);
  const activeDeliveryRef = useRef<View | null>(null);
  const statsGridRef = useRef<View | null>(null);
  const navJobsRef = useRef<View | null>(null);

  const jobsForDeliveryType = useMemo(
    () => jobsState.filter((job) => job.deliveryType === deliveryTypeFilter),
    [deliveryTypeFilter, jobsState],
  );
  const filteredJobs = useMemo(
    () => jobsForDeliveryType.filter((job) => job.status === jobFilter),
    [jobFilter, jobsForDeliveryType],
  );

  const activeJob = useMemo(() => jobsState.find((job) => job.status === 'in-progress'), [jobsState]);
  const availableJobsCount = useMemo(
    () => jobsState.filter((job) => job.status === 'available').length,
    [jobsState],
  );

  useEffect(() => {
    if (!showTutorial) {
      return;
    }

    setTab('home');
    scrollViewRef.current?.scrollTo({ y: 0, animated: false });
  }, [showTutorial, tutorialStep]);

  useEffect(() => {
    previousTutorialStepRef.current = tutorialStep;
  }, [tutorialStep]);

  // LIVE LOCATION TRACKING
  useEffect(() => {
    let locationWatcher: Location.LocationSubscription | null = null;

    async function startTracking() {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.warn('Location permission denied');
        return;
      }

      locationWatcher = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // Every 10 seconds
          distanceInterval: 10, // Or every 10 meters
        },
        async (location) => {
          try {
            await apiRequest('/pakiship/mobile/driver/location', {
              method: 'PATCH',
              body: JSON.stringify({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
              }),
            });
          } catch (err) {
            console.error('Failed to report location:', err);
          }
        }
      );
    }

    if (isOnline) {
      startTracking();
    }

    return () => {
      if (locationWatcher) {
        locationWatcher.remove();
      }
    };
  }, [isOnline]);


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

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" />
      <View style={styles.phoneShell}>
        {showTutorial ? (
          <WelcomeTutorial
            step={tutorialStep}
            targetRef={onlineToggleRef}
            activeDeliveryRef={activeDeliveryRef}
            statsGridRef={statsGridRef}
            navJobsRef={navJobsRef}
            scrollViewRef={scrollViewRef}
            activeJob={activeJob ?? null}
            isOnline={isOnline}
            onPrev={() => setTutorialStep((current) => Math.max(0, current - 1))}
            onNext={() => {
              if (tutorialStep < 4) {
                setTutorialStep((current) => current + 1);
                return;
              }

              setShowTutorial(false);
            }}
            onClose={() => setShowTutorial(false)}
          />
        ) : null}

        {callJob ? (
          <CallModal
            customerName={callJob.customer}
            customerPhone={callJob.customerPhone}
            onClose={() => setCallJob(null)}
            onCallNow={async () => {
              if (callJob.customerPhone) {
                await Linking.openURL(`tel:${callJob.customerPhone}`);
              }
              setCallJob(null);
            }}
          />
        ) : null}

        {showStatusErrorModal ? (
          <StatusErrorModal onClose={() => setShowStatusErrorModal(false)} />
        ) : null}

        <Header
          availableJobsCount={availableJobsCount}
          showNotifications={showNotifications}
          hasUnreadNotifications={hasUnreadNotifications}
          onToggleNotifications={() => {
            setShowNotifications((current) => !current);
            setHasUnreadNotifications(false);
          }}
          onCloseNotifications={() => setShowNotifications(false)}
          onPressHelp={() => {
            setTutorialStep(0);
            setShowTutorial(true);
          }}
          onPressProfile={() => navigation.navigate('DriverProfile')}
          onPressLogout={() => setShowLogoutModal(true)}
        />
        
        <LogoutModal 
          visible={showLogoutModal}
          onClose={() => setShowLogoutModal(false)}
          onConfirm={handleLogout}
        />
        
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <ProfileCard
            driverName={driverName}
            isOnline={isOnline}
            profileImageUri={profileImageUri}
            onToggleOnline={handleToggleOnline}
            onlineToggleRef={onlineToggleRef}
            rating={driverRating}
          />

          {tab === 'home' ? (
            <>
              {activeJob ? (
                <View ref={activeDeliveryRef} collapsable={false}>
                  <ActiveDeliveryCard
                    job={activeJob}
                    onOpenJob={() => navigation.navigate('JobDetails', { id: activeJob.id })}
                  />
                </View>
              ) : null}

              <View ref={statsGridRef} collapsable={false} style={styles.statsGrid}>
                {stats.map((stat) => (
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
            </>
          ) : (
            <>
              <View style={styles.deliveryTypeControl}>
                {(['direct', 'relay'] as DeliveryType[]).map((value) => (
                  <DeliveryTypeChip
                    key={value}
                    type={value}
                    active={deliveryTypeFilter === value}
                    onPress={() => setDeliveryTypeFilter(value)}
                  />
                ))}
              </View>

              <View style={styles.segmentedControl}>
                {(['available', 'in-progress', 'completed'] as JobStatus[]).map((value) => (
                  <FilterChip
                    key={value}
                    label={`${labelForStatus(value)} (${jobsForDeliveryType.filter((job) => job.status === value).length})`}
                    active={jobFilter === value}
                    onPress={() => setJobFilter(value)}
                  />
                ))}
              </View>

              <View style={styles.jobList}>
                {filteredJobs.map((job) => (
                  <JobCard
                    key={job.id}
                    job={job}
                    onOpenJob={() => navigation.navigate('JobDetails', { id: job.id })}
                    onCallJob={() => setCallJob(job)}
                    onUpdateStatus={() => navigation.navigate('UpdateStatus', { id: job.id })}
                  />
                ))}
              </View>
            </>
          )}
        </ScrollView>

        <BottomNav current={tab} onChange={setTab} navJobsRef={navJobsRef} />
      </View>
    </SafeAreaView>
  );
}

function WelcomeTutorial({
  step,
  onPrev,
  onNext,
  onClose,
  targetRef,
  activeDeliveryRef,
  statsGridRef,
  navJobsRef,
  scrollViewRef,
  activeJob,
  isOnline,
}: {
  step: number;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  targetRef: RefObject<View | null>;
  activeDeliveryRef: RefObject<View | null>;
  statsGridRef: RefObject<View | null>;
  navJobsRef: RefObject<View | null>;
  scrollViewRef: RefObject<ScrollView | null>;
  activeJob: DriverJob | null;
  isOnline: boolean;
}) {
  const [highlightRect, setHighlightRect] = useState<HighlightRect | null>(null);
  const previousStepRef = useRef(step);
  const steps: TutorialStepConfig[] = [
    {
      title: 'Welcome to PakiSHIP!',
      body: "Hi there! I'm your guide. Let me show you around your dashboard.",
      image: tutorialHelloImage,
    },
    {
      title: 'Go Online',
      body: 'Toggle this to start receiving delivery requests near you.',
      image: tutorialTrackImage,
    },
    {
      title: 'Active Delivery',
      body: 'When you have a job, navigation stays right here for quick access.',
      image: tutorialSendParcelImage,
    },
    {
      title: 'Daily Stats',
      body: 'Keep an eye on your earnings and your performance rating!',
      image: tutorialEarningImage,
    },
    {
      title: 'Find Jobs',
      body: "Browse available jobs in this tab whenever you're ready for more!",
      image: tutorialFindJobsImage,
    },
  ] as const;
  const currentStep = steps[step] ?? steps[0]!;
  const isTopPosition = step >= 3;
  const usesSpotlightCutout = step === 1 || step === 2 || step === 3 || step === 4;
  const previousStep = previousStepRef.current;
  const isReturningFromStatsToActiveDelivery = previousStep === 3 && step === 2;
  const needsScrollBeforeMeasure = step === 2 || step === 3 || step === 4;

  useEffect(() => {
    const currentRef =
      step === 1
        ? targetRef
        : step === 2
          ? activeDeliveryRef
          : step === 3
            ? statsGridRef
            : step === 4
              ? navJobsRef
              : null;

    if (!currentRef?.current) {
      setHighlightRect(null);
      return;
    }

    const updateHighlight = () => {
      currentRef.current?.measureInWindow((x, y, width, height) => {
        setHighlightRect(
          step === 1 || step === 2 || step === 3 || step === 4
            ? { x: x - 10, y: y - 8, width: width + 20, height: height + 16 }
            : step === 0
            ? { x: x - 10, y: y - 8, width: width + 20, height: height + 16 }
            : { x: x - 6, y: y - 6, width: width + 12, height: height + 12 },
        );
      });
    };

    if (step === 2) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    } else if (step === 3) {
      scrollViewRef.current?.scrollTo({ y: 260, animated: true });
    } else if (step === 4) {
      scrollViewRef.current?.scrollTo({ y: 0, animated: true });
    }

    if (!needsScrollBeforeMeasure) {
      updateHighlight();
    }

    const timeout = setTimeout(
      updateHighlight,
      isReturningFromStatsToActiveDelivery ? 650 : step === 2 || step === 3 ? 450 : 300,
    );

    return () => clearTimeout(timeout);
  }, [
    step,
    targetRef,
    activeDeliveryRef,
    statsGridRef,
    navJobsRef,
    scrollViewRef,
    needsScrollBeforeMeasure,
    isReturningFromStatsToActiveDelivery,
  ]);

  useEffect(() => {
    previousStepRef.current = step;
  }, [step]);

  return (
    <Modal transparent visible animationType="fade">
      <View style={styles.tutorialOverlay}>
        <Pressable style={styles.tutorialBackdrop} onPress={onClose} />

        {!usesSpotlightCutout ? <View pointerEvents="none" style={styles.tutorialFullShade} /> : null}

        {usesSpotlightCutout && highlightRect ? (
          <>
            <View style={[styles.tutorialShade, { left: 0, top: 0, right: 0, height: highlightRect.y }]} />
            <View
              style={[
                styles.tutorialShade,
                {
                  left: 0,
                  top: highlightRect.y,
                  width: highlightRect.x,
                  height: highlightRect.height,
                },
              ]}
            />
            <View
              style={[
                styles.tutorialShade,
                {
                  top: highlightRect.y,
                  left: highlightRect.x + highlightRect.width,
                  right: 0,
                  height: highlightRect.height,
                },
              ]}
            />
            <View
              style={[
                styles.tutorialShade,
                {
                  left: 0,
                  right: 0,
                  top: highlightRect.y + highlightRect.height,
                  bottom: 0,
                },
              ]}
            />
            <View
              pointerEvents="none"
              style={[
                styles.tutorialNavSpotlight,
                {
                  left: highlightRect.x,
                  top: highlightRect.y,
                  width: highlightRect.width,
                  height: highlightRect.height,
                },
              ]}
            />
          </>
        ) : null}

        <View style={[styles.tutorialWrap, isTopPosition ? styles.tutorialWrapTop : null]}>
          <View style={[styles.tutorialMascotWrap, isTopPosition ? styles.tutorialMascotWrapTop : null]}>
            <Image source={currentStep.image} style={styles.tutorialMascot} resizeMode="contain" />
          </View>

          <View style={[styles.tutorialCard, isTopPosition ? styles.tutorialCardTop : null]}>
            <View style={styles.tutorialHeaderRow}>
              <Text style={styles.tutorialStepPill}>{`Step ${step + 1}/5`}</Text>
              <Pressable onPress={onClose} hitSlop={8}>
                <MaterialCommunityIcons name="close" size={20} color="#C3CCD8" />
              </Pressable>
            </View>

            <Text style={styles.tutorialTitle}>{currentStep.title}</Text>
            <Text style={styles.tutorialBody}>{currentStep.body}</Text>

            <View style={styles.tutorialActions}>
              {step > 0 ? (
                <Pressable onPress={onPrev} style={styles.tutorialBackButton}>
                  <MaterialCommunityIcons name="arrow-left" size={16} color={palette.primary} />
                  <Text style={styles.tutorialBackText}>Back</Text>
                </Pressable>
              ) : (
                <View />
              )}
              <Pressable style={styles.tutorialNextButton} onPress={onNext}>
                <Text style={styles.tutorialNextText}>{step === 4 ? 'Finish' : 'Next'}</Text>
                <MaterialCommunityIcons name="arrow-right" size={16} color={palette.card} />
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
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
    <View style={styles.callModalOverlay}>
      <Pressable style={styles.callModalBackdrop} onPress={onClose} />
      <View style={styles.callModalCard}>
        <View style={styles.callAvatar}>
          <Text style={styles.callAvatarText}>{customerName.charAt(0)}</Text>
        </View>
        <Text style={styles.callName}>{customerName}</Text>
        {customerPhone ? <Text style={styles.callPhone}>{customerPhone}</Text> : null}
        <View style={styles.callBadge}>
          <Text style={styles.callBadgeText}>CUSTOMER</Text>
        </View>
        <Pressable style={styles.callPrimaryButton} onPress={onCallNow}>
          <View style={styles.callPrimaryIconWrap}>
            <MaterialCommunityIcons name="phone-outline" size={16} color={palette.card} />
          </View>
          <Text style={styles.callPrimaryText}>Call Now</Text>
        </Pressable>
        <Pressable onPress={onClose} style={styles.callCancelButton}>
          <Text style={styles.callCancelText}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Header({
  availableJobsCount,
  showNotifications,
  hasUnreadNotifications,
  onToggleNotifications,
  onCloseNotifications,
  onPressHelp,
  onPressProfile,
  onPressLogout,
}: {
  availableJobsCount: number;
  showNotifications: boolean;
  hasUnreadNotifications: boolean;
  onToggleNotifications: () => void;
  onCloseNotifications: () => void;
  onPressHelp: () => void;
  onPressProfile: () => void;
  onPressLogout: () => void;
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
          <HeaderButton icon="help-circle-outline" onPress={onPressHelp} />
          <HeaderButton icon="account-outline" onPress={onPressProfile} />
          <HeaderButton icon="logout" danger onPress={onPressLogout} />
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
  driverName,
  isOnline,
  profileImageUri,
  onToggleOnline,
  onlineToggleRef,
  rating,
}: {
  driverName: string;
  isOnline: boolean;
  profileImageUri: string | null;
  onToggleOnline: () => void;
  onlineToggleRef: RefObject<View | null>;
  rating: number;
}) {
  return (
    <View style={styles.profileCard}>
      <View style={styles.avatarWrap}>
        <View style={styles.avatarCircle}>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profileAvatarImage} />
          ) : (
            <MaterialCommunityIcons name="account-outline" size={34} color={palette.primary} />
          )}
        </View>
      </View>

      <View style={styles.profileContent}>
        <View style={styles.profileHeaderRow}>
          <Text style={styles.profileName}>{driverName}</Text>
          <Pressable
            ref={onlineToggleRef}
            collapsable={false}
            onPress={onToggleOnline}
            style={[styles.onlinePill, isOnline ? styles.onlinePillActive : styles.onlinePillOffline]}
          >
            <View style={[styles.onlineDot, isOnline ? styles.onlineDotActive : styles.onlineDotOffline]} />
            <Text style={styles.onlineText}>{isOnline ? 'ONLINE' : 'OFFLINE'}</Text>
          </Pressable>
        </View>
        <Text style={styles.profileMeta}>PakiShip Partner Driver · {rating.toFixed(1)} Rating</Text>
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

function DeliveryTypeChip({
  type,
  active,
  onPress,
}: {
  type: DeliveryType;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.deliveryTypeChip, active ? styles.deliveryTypeChipActive : null]}
    >
      <MaterialCommunityIcons
        name={iconForDeliveryType(type)}
        size={16}
        color={active ? palette.card : '#97A2B3'}
      />
      <Text style={[styles.deliveryTypeChipText, active ? styles.deliveryTypeChipTextActive : null]}>
        {labelForDeliveryType(type)}
      </Text>
    </Pressable>
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
  onCallJob,
  onUpdateStatus,
}: {
  job: DriverJob;
  onOpenJob: () => void;
  onCallJob: () => void;
  onUpdateStatus: () => void;
}) {
  return (
    <View style={styles.jobCard}>
      {job.deliveryType === 'relay' ? (
        <View style={styles.relayRequestBadge}>
          <MaterialCommunityIcons name="layers-outline" size={11} color={palette.card} />
          <Text style={styles.relayRequestBadgeText}>RELAY REQUEST</Text>
        </View>
      ) : null}

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
          {job.deliveryType === 'relay' && job.relayPoint ? (
            <View style={styles.relayPointRow}>
              <MaterialCommunityIcons name="map-marker-outline" size={11} color={palette.primary} />
              <Text style={styles.relayPointText}>{job.relayPoint}</Text>
            </View>
          ) : null}
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
          <Pressable style={styles.jobSecondaryButton} onPress={onCallJob}>
            <MaterialCommunityIcons name="phone-outline" size={18} color={palette.primary} />
            <Text style={styles.jobSecondaryButtonText}>Call</Text>
          </Pressable>
          <Pressable style={styles.jobDarkButton} onPress={onUpdateStatus}>
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
  navJobsRef,
}: {
  current: 'home' | 'jobs';
  onChange: (value: 'home' | 'jobs') => void;
  navJobsRef: RefObject<View | null>;
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
        itemRef={navJobsRef}
      />
    </View>
  );
}

function StatusErrorModal({ onClose }: { onClose: () => void }) {
  return (
    <View style={styles.statusErrorOverlay}>
      <Pressable style={styles.statusErrorBackdrop} onPress={onClose} />
      <View style={styles.statusErrorCard}>
        <View style={styles.statusErrorIconWrap}>
          <MaterialCommunityIcons name="alert-circle-outline" size={34} color={palette.danger} />
        </View>
        <Text style={styles.statusErrorTitle}>Error 404</Text>
        <Text style={styles.statusErrorMessage}>
          Parcel status details could not be found right now. Please try again later.
        </Text>
        <Pressable style={styles.statusErrorButton} onPress={onClose}>
          <Text style={styles.statusErrorButtonText}>Close</Text>
        </Pressable>
      </View>
    </View>
  );
}

function BottomNavItem({
  icon,
  label,
  active,
  onPress,
  itemRef,
}: {
  icon: React.ComponentProps<typeof MaterialCommunityIcons>['name'];
  label: string;
  active: boolean;
  onPress: () => void;
  itemRef?: RefObject<View | null>;
}) {
  return (
    <View ref={itemRef} collapsable={false}>
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
    </View>
  );
}

function labelForStatus(status: JobStatus) {
  if (status === 'in-progress') {
    return 'IN-PROGRESS';
  }

  return status.toUpperCase();
}

function labelForDeliveryType(type: DeliveryType) {
  return type.toUpperCase();
}

function iconForDeliveryType(type: DeliveryType): React.ComponentProps<
  typeof MaterialCommunityIcons
>['name'] {
  return type === 'direct' ? 'flash-outline' : 'layers-outline';
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: palette.appBg,
  },
  tutorialOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 40,
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tutorialBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  tutorialFullShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4, 22, 20, 0.6)',
  },
  tutorialShade: {
    position: 'absolute',
    backgroundColor: 'rgba(4, 22, 20, 0.6)',
  },
  tutorialNavSpotlight: {
    position: 'absolute',
    backgroundColor: 'transparent',
  },
  tutorialWrap: {
    alignSelf: 'stretch',
  },
  tutorialWrapTop: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 68,
  },
  tutorialMascotWrap: {
    alignItems: 'center',
    marginBottom: -24,
    zIndex: 2,
  },
  tutorialMascotWrapTop: {
    marginBottom: -18,
  },
  tutorialMascot: {
    width: 96,
    height: 96,
  },
  tutorialCard: {
    backgroundColor: palette.card,
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(57, 181, 168, 0.2)',
    paddingHorizontal: 20,
    paddingTop: 36,
    paddingBottom: 20,
    shadowColor: '#182D2A',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 12 },
    elevation: 10,
  },
  tutorialCardTop: {
    paddingTop: 30,
  },
  tutorialHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tutorialStepPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F0F9F8',
    color: palette.primary,
    fontSize: 9,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tutorialTitle: {
    color: '#041614',
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  tutorialBody: {
    color: '#6D7B8F',
    fontSize: 13,
    lineHeight: 21,
    fontWeight: '600',
    marginBottom: 18,
  },
  tutorialActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: '#EEF2F5',
    paddingTop: 16,
  },
  tutorialBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
  },
  tutorialBackText: {
    color: palette.primary,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  tutorialNextButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    backgroundColor: palette.primary,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  tutorialNextText: {
    color: palette.card,
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  statusErrorOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  statusErrorBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(32, 51, 49, 0.45)',
  },
  statusErrorCard: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 28,
    backgroundColor: palette.card,
    alignItems: 'center',
    paddingHorizontal: 26,
    paddingTop: 28,
    paddingBottom: 24,
    shadowColor: '#607875',
    shadowOpacity: 0.28,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  statusErrorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF2F2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  statusErrorTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 10,
  },
  statusErrorMessage: {
    color: '#6C7A8D',
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  statusErrorButton: {
    minWidth: 132,
    height: 46,
    borderRadius: 14,
    backgroundColor: palette.danger,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  statusErrorButtonText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  callModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 30,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 18,
  },
  callModalBackdrop: {
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
  callBadge: {
    borderRadius: 999,
    backgroundColor: '#F2F4F7',
    paddingHorizontal: 14,
    paddingVertical: 5,
    marginBottom: 22,
  },
  callBadgeText: {
    color: '#B0B8C6',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  callPrimaryButton: {
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
  callPrimaryIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callPrimaryText: {
    color: palette.card,
    fontSize: 15,
    fontWeight: '800',
  },
  callCancelButton: {
    paddingVertical: 4,
  },
  callCancelText: {
    color: '#8D98A8',
    fontSize: 14,
    fontWeight: '700',
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
    width: 260,
    borderRadius: 22,
    backgroundColor: palette.card,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 14,
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
    marginBottom: 12,
  },
  notificationTitle: {
    color: palette.text,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 10,
  },
  notificationIconBubble: {
    width: 30,
    height: 30,
    borderRadius: 15,
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
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 2,
  },
  notificationItemText: {
    color: palette.subtext,
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
  },
  notificationTime: {
    color: '#C7CFD9',
    fontSize: 10,
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
  profileAvatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
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
  deliveryTypeControl: {
    flexDirection: 'row',
    backgroundColor: palette.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#DDE9E8',
    padding: 4,
    gap: 6,
    shadowColor: '#A9D8D2',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  deliveryTypeChip: {
    flex: 1,
    minHeight: 40,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
  },
  deliveryTypeChipActive: {
    backgroundColor: palette.primary,
    shadowColor: '#67CAC2',
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  deliveryTypeChipText: {
    color: '#97A2B3',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  deliveryTypeChipTextActive: {
    color: palette.card,
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
    position: 'relative',
    overflow: 'hidden',
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
  relayRequestBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#051614',
    borderBottomLeftRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    zIndex: 1,
  },
  relayRequestBadgeText: {
    color: palette.card,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.6,
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
  relayPointRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  relayPointText: {
    color: palette.primary,
    fontSize: 11,
    fontWeight: '700',
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
