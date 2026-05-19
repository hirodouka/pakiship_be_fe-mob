import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Modal,
  Animated,
  Image,
  TextInput,
  KeyboardAvoidingView,
  Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Header } from "../components/Header";
import { TourOverlay, shouldShowTour } from "../components/TourOverlay";
import { COLORS } from "../types/colors";
import { useAuthSession } from "../../context/AuthSessionContext";
import { apiRequest } from "../../services/api";
import { registerManualEntry, scanQrCode } from "../services/operatorApi";
import type { RootStackParamList } from "../../../lib/navigation/types";
import { CameraView, useCameraPermissions } from "expo-camera";
import HomeTabScreen from "./HomeTabScreen";
import InventoryScreen from "./InventoryScreen";
import AnalyticsScreen from "./AnalyticsScreen";

type TabType = "home" | "inventory" | "analytics";



function BlinkingDot() {
  const opacity = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.15, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    ).start();
  }, []);
  return <Animated.View style={[styles.dot, { opacity }]} />;
}

function CameraModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: (trackingNumber: string) => void }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && !permission?.granted) {
      requestPermission();
    }
    if (visible) {
      setScanned(false);
    }
  }, [visible, permission]);

  const handleBarcodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSuccess(data);
  };

  if (!permission) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.cameraSheet}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Scan Parcel QR</Text>
            <TouchableOpacity onPress={onClose} style={styles.cameraCloseBtn}>
              <Feather name="x" size={24} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          
          {!permission.granted ? (
            <View style={styles.cameraPermissionBox}>
              <Text style={styles.cameraPermissionText}>Camera permission is required to scan parcels.</Text>
              <TouchableOpacity style={styles.cameraPermissionBtn} onPress={requestPermission}>
                <Text style={styles.cameraPermissionBtnText}>Grant Permission</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cameraContainer}>
              <CameraView
                style={StyleSheet.absoluteFillObject}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "code128", "code39", "ean13"],
                }}
                onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              />
              <View style={styles.cameraOverlay}>
                <View style={styles.cameraTargetBox} />
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

function ManualEntryModal({ visible, onClose, onSuccess }: { visible: boolean; onClose: () => void; onSuccess: () => void }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<TextInput>(null);

  async function handleConfirm() {
    if (!trackingNumber.trim() || loading) return;
    try {
      setLoading(true);
      await registerManualEntry(trackingNumber);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTrackingNumber("");
      onSuccess();
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to register manual entry.");
    } finally {
      setLoading(false);
    }
  }

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTrackingNumber("");
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
      <KeyboardAvoidingView
        style={styles.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleCancel} />
        <View style={styles.manualEntrySheet}>
          <View style={styles.dragHandle} />
          <View style={styles.manualEntryHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.manualEntryTitle}>Manual Entry</Text>
              <Text style={styles.manualEntrySub2}>Enter the tracking number below</Text>
            </View>
            <TouchableOpacity style={styles.manualEntryCloseBtn} onPress={handleCancel} activeOpacity={0.7}>
              <Feather name="x" size={18} color={COLORS.textSecondary} />
            </TouchableOpacity>
          </View>
          <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()} style={styles.manualEntryInputWrapper}>
            <TextInput
              ref={inputRef}
              style={styles.manualEntryInput}
              placeholder="e.g. PKS-20260519-F62D36DD"
              placeholderTextColor={COLORS.textMuted}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCorrect={false}
              autoCapitalize="characters"
              returnKeyType="done"
              onSubmitEditing={handleConfirm}
              autoFocus
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.manualEntryConfirmBtn, (!trackingNumber.trim() || loading) && styles.manualEntryConfirmBtnDisabled]}
            onPress={handleConfirm}
            activeOpacity={0.85}
            disabled={loading}
          >
            <Text style={styles.manualEntryConfirmText}>{loading ? "Processing..." : "Confirm Entry"}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
            <Text style={styles.manualEntryCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function OperatorHomeScreenWithTabs() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser } = useAuthSession();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;
  
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);
  // inventoryTourVisible controls the tour shown ON the inventory tab (step 4)
  const [inventoryTourVisible, setInventoryTourVisible] = useState(false);
  const [hubSummary, setHubSummary] = useState<any>(null);
  const [actionsSpotlight, setActionsSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [statsSpotlight, setStatsSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [helpSpotlight, setHelpSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const actionsRef = useRef<View>(null);
  const statsRef = useRef<View>(null);

  const fullName = currentUser?.fullName?.trim() || "Operator";
  const nameParts = fullName.split(" ");
  const firstName = nameParts[0];
  const lastName = nameParts.slice(1).join(" ");
  const hubName = hubSummary?.hubName || "Your Assigned Hub";

  useEffect(() => {
    fetchDashboard();
    checkFirstLaunch();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await apiRequest('/pakiship/mobile/operator/hub-summary');
      setHubSummary(res);
    } catch (error) {
      console.error('Failed to fetch operator dashboard:', error);
    }
  };

  const checkFirstLaunch = async () => {
    const show = await shouldShowTour();
    if (show) {
      setTimeout(() => {
        measureAll();
        setTourInitialStep(0);
        setShowTour(true);
      }, 600);
    }
  };

  function measureActions() {
    actionsRef.current?.measureInWindow((x, y, width, height) => {
      setActionsSpotlight({ x, y, width, height });
    });
  }

  function measureStats() {
    statsRef.current?.measureInWindow((x, y, width, height) => {
      setStatsSpotlight({ x, y, width, height });
    });
  }

  function measureAll() {
    measureActions();
    measureStats();
  }

  // HOME tab tour steps (steps 1, 2, 3, 5)
  const homeTourSteps = [
    { 
      step: 1, 
      title: "Welcome to PakiSHIP!", 
      body: "Hi there! I'm your guide. Let's get you familiar with your workspace.", 
      mascot: require("../../../assets/mascot-parcel.png"), 
      spotlight: null, 
      totalSteps: 5 
    },
    { 
      step: 2, 
      title: "Quick Actions", 
      body: "Scan parcels, do manual entry, or update statuses right from here!", 
      mascot: require("../../../assets/no 2.png"), 
      spotlight: actionsSpotlight, 
      totalSteps: 5 
    },
    { 
      step: 3, 
      title: "Statistics Overview", 
      body: "Track incoming, stored, and picked-up parcels in real time.", 
      mascot: require("../../../assets/mascot-tracking.png"), 
      spotlight: statsSpotlight, 
      cardPosition: "top" as const, 
      totalSteps: 5,
      onNext: () => {
        // Go to inventory tab and show step 4 there
        setShowTour(false);
        setActiveTab("inventory");
        setTimeout(() => {
          setInventoryTourVisible(true);
        }, 600);
      }
    },
    { 
      step: 5, 
      title: "Need Help Again?", 
      body: "You can restart this guide anytime by clicking the Guide button.", 
      mascot: require("../../../assets/mascot-shield.png"), 
      spotlight: helpSpotlight, 
      cardPosition: "bottom" as const, 
      totalSteps: 5,
      onBack: () => {
        // Go back to inventory tab and show step 4
        setShowTour(false);
        setActiveTab("inventory");
        setTimeout(() => {
          setInventoryTourVisible(true);
        }, 600);
      }
    },
  ];

  return (
    <View style={styles.container}>
      <Header
        onHelpPress={() => { 
          // From any tab, go to home and restart tour from step 1
          setInventoryTourVisible(false);
          setShowTour(false);
          setActiveTab("home");
          setTimeout(() => {
            measureActions(); 
            measureStats(); 
            setTourInitialStep(0); 
            setShowTour(true);
          }, 150);
        }}
        onHelpMeasure={(rect) => setHelpSpotlight(rect)}
      />
      <TourOverlay visible={showTour} steps={homeTourSteps} initialStep={tourInitialStep} key={`home-tour-${tourInitialStep}`} onClose={() => setShowTour(false)} />
      <ManualEntryModal 
        visible={showManualEntry} 
        onClose={() => setShowManualEntry(false)} 
        onSuccess={() => {
          setShowManualEntry(false);
          fetchDashboard(); // Refresh capacity and stats
          Alert.alert("Success", "Parcel successfully registered to the hub.", [
            { text: "OK", onPress: () => navigation.navigate("ReceiveParcel") }
          ]);
        }} 
      />
      <CameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onSuccess={async (qrPayload) => {
          setShowCamera(false);
          try {
            // Use scanQrCode which handles web QR format (JSON, tracking number, or UUID)
            const result = await scanQrCode(qrPayload);
            const parcel = result?.parcel;
            fetchDashboard(); // refresh analytics + capacity
            Alert.alert(
              "Parcel Received!",
              `Tracking: ${parcel?.trackingNumber ?? qrPayload}\nRecipient: ${parcel?.recipient ?? "Unknown"}`,
              [{ text: "OK", onPress: () => navigation.navigate("ReceiveParcel") }]
            );
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to register scanned parcel.");
          }
        }}
      />

      {activeTab === "home" ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
        >
          <View style={styles.greetingCard}>
            <View style={styles.greetingRow}>
              <BlinkingDot />
              <Text style={styles.greeting}>
                Kumusta,  <Text style={styles.greetingAccent}>{firstName}</Text>{"\n"}
                {lastName ? <Text style={styles.greetingAccent}>{lastName}!</Text> : "!"}
              </Text>
            </View>

            <View style={styles.dropOffOuter}>
              <View style={styles.dropOffCard}>
                <View style={[styles.dropOffIconWrap, { marginLeft: -24 }]}>
                  <Feather name="map-pin" size={28} color={COLORS.primary} />
                </View>
                <View style={styles.dropOffText}>
                  <Text style={styles.dropOffLabel}>DROP OFF POINT</Text>
                  <Text style={styles.dropOffName}>{hubName}</Text>
                  <Text style={styles.dropOffSub}>Taguig City, Metro Manila</Text>
                </View>
              </View>
            </View>
          </View>

          <View
            ref={actionsRef}
            style={styles.actionsRow}
            onLayout={measureActions}
          >
            <TouchableOpacity
              style={styles.scanParcelBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setShowCamera(true); }}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons name="qrcode-scan" size={48} color={COLORS.white} />
              <Text style={styles.scanParcelLabel}>SCAN PARCEL</Text>
              <Text style={styles.scanParcelSub}>Register via QR code</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.manualEntryBtn}
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowManualEntry(true); }}
              activeOpacity={0.85}
            >
              <Feather name="smartphone" size={44} color={COLORS.primary} />
              <Text style={styles.manualEntryLabel}>MANUAL ENTRY</Text>
              <Text style={styles.manualEntrySub}>Type tracking number</Text>
            </TouchableOpacity>
          </View>

          {(() => {
            const pct = hubSummary?.capacity ?? 0;
            const fillColor = pct >= 90 ? COLORS.red : pct >= 70 ? COLORS.orange : COLORS.primary;
            const pctColor = pct >= 90 ? COLORS.red : pct >= 70 ? COLORS.orange : COLORS.primary;
            const warningIcon = pct >= 90 ? "alert-triangle" : "alert-circle";
            const warningLabel = pct >= 90 ? "Almost Full!" : pct >= 70 ? "Getting Full" : "Good Capacity";
            return (
              <View style={styles.capacityCard}>
                <View style={styles.capacityTopRow}>
                  <View style={styles.capacityLeft}>
                    <View style={styles.capacityIconWrap}>
                      <Feather name="package" size={16} color={COLORS.primary} />
                    </View>
                    <View>
                      <Text style={styles.capacityTitle}>Delivery Bin Capacity</Text>
                      <Text style={styles.capacitySubtitle}>{hubName} — Bin A</Text>
                    </View>
                  </View>
                  <Text style={[styles.capacityPct, { color: pctColor }]}>{pct}%</Text>
                </View>
                <View style={styles.progressWrapper}>
                  <Image
                    source={require("../../../assets/mascot-analytics.png")}
                    style={[styles.mascotImg, { left: `${pct}%` as any, transform: [{ translateX: -26 }] }]}
                    resizeMode="contain"
                  />
                  <View style={styles.progressTrack}>
                    <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: fillColor }]} />
                  </View>
                </View>
                <View style={styles.progressLabels}>
                  <Text style={styles.progressEdge}>0%</Text>
                  <View style={styles.warningRow}>
                    <Feather name={warningIcon as any} size={11} color={pctColor} />
                    <Text style={[styles.warningText, { color: pctColor }]}>{warningLabel}</Text>
                  </View>
                  <Text style={styles.progressEdge}>100%</Text>
                </View>
              </View>
            );
          })()}

          <View style={styles.readyRow}>
            <Feather name="package" size={52} color="rgba(43,169,155,0.18)" />
            <Text style={styles.readyText}>READY FOR OPERATIONS</Text>
          </View>
        </ScrollView>
      ) : activeTab === "inventory" ? (
        <InventoryScreen 
          showTour={inventoryTourVisible}
          onTourNext={() => {
            // Step 4 Next → go to home tab, show step 5 (index 3 in homeTourSteps)
            setInventoryTourVisible(false);
            setActiveTab("home");
            setTimeout(() => {
              measureActions();
              measureStats();
              setTourInitialStep(3);
              setShowTour(true);
            }, 600);
          }}
          onTourBack={() => {
            // Step 4 Back → go to home tab, show step 3 (index 2 in homeTourSteps)
            setInventoryTourVisible(false);
            setActiveTab("home");
            setTimeout(() => {
              measureActions();
              measureStats();
              setTourInitialStep(2);
              setShowTour(true);
            }, 600);
          }}
          onCloseTour={() => setInventoryTourVisible(false)}
        />
      ) : (
        <AnalyticsScreen hubSummary={hubSummary} />
      )}

      {/* BOTTOM TAB BAR */}
      <View style={[styles.tabBar, { paddingBottom: Platform.OS === "web" ? 0 : insets.bottom }]}>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("home"); }}
        >
          <MaterialCommunityIcons name="view-grid" size={22} color={activeTab === "home" ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("inventory"); }}
        >
          <Feather name="package" size={22} color={activeTab === "inventory" ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabLabel, activeTab === "inventory" && styles.tabLabelActive]}>INVENTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.tabBtn}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("analytics"); }}
        >
          <Feather name="bar-chart-2" size={22} color={activeTab === "analytics" ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabLabel, activeTab === "analytics" && styles.tabLabelActive]}>ANALYTICS</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  greetingCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "rgba(43,169,155,0.4)",
    padding: 16,
    paddingBottom: 0,
    gap: 14,
  },
  greetingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start", gap: 12, paddingLeft: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary, marginTop: 10 },
  greeting: { fontSize: 28, fontWeight: "900", color: COLORS.text, lineHeight: 32, letterSpacing: -1 },
  greetingAccent: { color: COLORS.primary, fontWeight: "900" },

  dropOffOuter: {
    marginTop: 4,
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 0,
    borderStyle: "dashed",
    borderColor: "rgba(43,169,155,0.45)",
    borderTopLeftRadius: 12,
    borderTopRightRadius: 12,
    paddingBottom: 16,
  },
  dropOffCard: { backgroundColor: "transparent", paddingVertical: 20, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 16 },
  dropOffIconWrap: { width: 64, height: 64, borderRadius: 18, backgroundColor: COLORS.cardBg, alignItems: "center", justifyContent: "center" },
  dropOffText: { alignItems: "flex-start" },
  dropOffLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 2, marginBottom: 4, textTransform: "uppercase" },
  dropOffName: { fontSize: 20, fontWeight: "900", color: COLORS.text, lineHeight: 24, letterSpacing: -0.2 },
  dropOffSub: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, marginTop: 3 },

  actionsRow: { flexDirection: "row", gap: 10 },
  scanParcelBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 32, paddingVertical: 40, alignItems: "center", justifyContent: "center", gap: 10 },
  scanParcelLabel: { fontSize: 13, fontWeight: "900", color: COLORS.white, letterSpacing: 0.5, textTransform: "uppercase" },
  scanParcelSub: { fontSize: 11, fontWeight: "400", color: "rgba(255,255,255,0.8)" },
  manualEntryBtn: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 32, paddingVertical: 40, alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: COLORS.border },
  manualEntryLabel: { fontSize: 13, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5 },
  manualEntrySub: { fontSize: 11, fontWeight: "400", color: COLORS.textSecondary },

  capacityCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  capacityTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  capacityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  capacityIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  capacityTitle: { fontSize: 14, fontWeight: "900", color: COLORS.text },
  capacitySubtitle: { fontSize: 11, fontWeight: "400", color: COLORS.textSecondary },
  capacityPct: { fontSize: 24, fontWeight: "900" },
  progressWrapper: { position: "relative", paddingTop: 36 },
  progressTrack: { height: 14, backgroundColor: COLORS.background, borderRadius: 7, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 7, backgroundColor: COLORS.orange },
  progressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressEdge: { fontSize: 11, fontWeight: "400", color: COLORS.textMuted },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  warningText: { fontSize: 11, fontWeight: "600", color: COLORS.orange },
  readyRow: { alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 16, marginTop: -8 },
  readyText: { fontSize: 13, fontWeight: "900", color: "rgba(43,169,155,0.22)", letterSpacing: 3 },
  mascotImg: { position: "absolute", top: 0, width: 52, height: 52, zIndex: 1 },

  titleSection: { alignItems: "center", marginBottom: 10, marginTop: 8 },
  pageTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  pageSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2, textAlign: "center" },
  goToInventoryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  goToInventoryText: { fontSize: 15, fontWeight: "700", color: COLORS.white },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", flexShrink: 1, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8, alignItems: "center" },
  statIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 30, fontWeight: "900", color: COLORS.text, lineHeight: 34, textAlign: "center" },
  statLabel: { fontSize: 10, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.6, textAlign: "center" },

  /* BOTTOM TAB BAR */
  tabBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    flexDirection: "row",
    paddingTop: 8,
    elevation: 8,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  tabBtn: { flex: 1, alignItems: "center", paddingBottom: 8 },
  tabLabel: { fontSize: 9, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.4, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary },

  /* Camera Modal */
  cameraSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: "85%",
    overflow: "hidden",
  },
  cameraHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    zIndex: 10,
  },
  cameraTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  cameraCloseBtn: { padding: 4 },
  cameraPermissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  cameraPermissionText: { fontSize: 16, color: COLORS.textSecondary, textAlign: "center", lineHeight: 24 },
  cameraPermissionBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12 },
  cameraPermissionBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  cameraContainer: { flex: 1, backgroundColor: "#000" },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  cameraTargetBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: COLORS.primary,
    backgroundColor: "transparent",
    borderRadius: 16,
  },

  /* Modals */
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 16,
    alignItems: "center",
  },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 4 },
  scannerFrame: { width: 210, height: 210, backgroundColor: COLORS.primaryLight, borderRadius: 20, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: COLORS.primary, borderWidth: 3 },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  qrIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  scanTitle: { fontSize: 18, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  scanSubtitle: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center" },
  cancelTextBtn: { paddingVertical: 8 },
  cancelTextBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.greenLight, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  scannedBox: { width: "100%", backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", gap: 4 },
  scannedLabel: { fontSize: 10, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5 },
  scannedTracking: { fontSize: 16, fontWeight: "900", color: COLORS.text },
  successTitle: { fontSize: 18, fontWeight: "900", color: COLORS.green, textAlign: "center" },
  successSubtitle: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center" },
  doneBtn: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },

  /* Manual Entry Modal */
  manualEntrySheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 16,
  },
  manualEntryHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  manualEntryTitle: { fontSize: 20, fontWeight: "900", color: COLORS.text },
  manualEntrySub2: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2 },
  manualEntryCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },
  manualEntryInputWrapper: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    overflow: "hidden",
  },
  manualEntryInput: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.text,
  },
  manualEntryConfirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  manualEntryConfirmBtnDisabled: { opacity: 0.55 },
  manualEntryConfirmText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  manualEntryCancelText: { fontSize: 14, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center" },
});
