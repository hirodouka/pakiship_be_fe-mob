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
import { registerManualEntry } from "../services/operatorApi";
import type { RootStackParamList } from "../../../lib/navigation/types";
import { CameraView, useCameraPermissions } from "expo-camera";

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

export default function HomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, firstName, lastName, hubSummary, fetchDashboard } = useAuthSession();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;
  const [showManualEntry, setShowManualEntry] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);
  const [actionsSpotlight, setActionsSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [statsSpotlight, setStatsSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [helpSpotlight, setHelpSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const actionsRef = useRef<View>(null);
  const statsRef = useRef<View>(null);

  useEffect(() => {
    shouldShowTour().then((show) => {
      if (show) setTimeout(() => { measureAll(); setTourInitialStep(0); setShowTour(true); }, 600);
    });
  }, []);

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

  const tourSteps = [
    { step: 1, title: "Welcome to PakiSHIP!", body: "Hi there! I'm your guide. Let's get you familiar with your workspace.", mascot: require("../../../assets/mascot-parcel.png"), spotlight: null, totalSteps: 5 },
    { step: 2, title: "Quick Actions", body: "Scan parcels, do manual entry, or update statuses right from here!", mascot: require("../../../assets/no 2.png"), spotlight: actionsSpotlight, totalSteps: 5 },
    { step: 3, title: "Statistics Overview", body: "Track incoming, stored, and picked-up parcels in real time.", mascot: require("../../../assets/mascot-tracking.png"), spotlight: statsSpotlight, cardPosition: "top" as const, totalSteps: 5 },
    { step: 5, title: "Need Help Again?", body: "You can restart this guide anytime by clicking the Guide button.", mascot: require("../../../assets/mascot-shield.png"), spotlight: helpSpotlight, cardPosition: "bottom" as const, totalSteps: 5 },
  ];

  return (
    <View style={styles.container}>
      <Header
        onHelpPress={() => { measureActions(); measureStats(); setTourInitialStep(0); setShowTour(true); }}
        onHelpMeasure={(rect) => setHelpSpotlight(rect)}
      />
      <TourOverlay visible={showTour} steps={tourSteps} initialStep={tourInitialStep} key={tourInitialStep} onClose={() => setShowTour(false)} />
      
      <CameraModal
        visible={showCamera}
        onClose={() => setShowCamera(false)}
        onSuccess={async (trackingNumber) => {
          setShowCamera(false);
          try {
            await registerManualEntry(trackingNumber);
            fetchDashboard();
            Alert.alert("Success", `Parcel ${trackingNumber} scanned and registered successfully.`, [
              { text: "OK", onPress: () => navigation.navigate("ReceiveParcel") }
            ]);
          } catch (e: any) {
            Alert.alert("Error", e?.message || "Failed to register scanned parcel.");
          }
        }}
      />

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
                <Text style={styles.dropOffName}>{hubSummary?.hubName || "Unassigned Hub"}</Text>
                <Text style={styles.dropOffSub}>{hubSummary?.hubAddress || "Taguig City, Metro Manila"}</Text>
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
            onPress={() => setShowManualEntry(true)}
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
            <View style={styles.capacityCard} ref={statsRef} onLayout={measureStats}>
              <View style={styles.capacityTopRow}>
                <View style={styles.capacityLeft}>
                  <View style={styles.capacityIconWrap}>
                    <Feather name="package" size={16} color={COLORS.primary} />
                  </View>
                  <View>
                    <Text style={styles.capacityTitle}>Delivery Bin Capacity</Text>
                    <Text style={styles.capacitySubtitle}>{hubSummary?.hubName || "Unassigned Hub"} — Bin A</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  greetingCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1.2,
    borderColor: "rgba(43,169,155,0.3)",
    padding: 16,
    paddingBottom: 0,
    gap: 14,
  },
  greetingRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingLeft: 4 },
  dot: { width: 13, height: 13, borderRadius: 7, backgroundColor: COLORS.primary, marginTop: 12 },
  greeting: { fontSize: 32, fontWeight: "900", color: COLORS.text, lineHeight: 36, letterSpacing: -1 },
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
  dropOffSub: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, marginTop: 3 },

  actionsRow: { flexDirection: "row", gap: 10 },
  scanParcelBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 28, paddingVertical: 40, alignItems: "center", justifyContent: "center", gap: 10 },
  scanParcelLabel: { fontSize: 15, fontWeight: "900", color: COLORS.white, letterSpacing: 0.5, textTransform: "uppercase" },
  scanParcelSub: { fontSize: 12, fontWeight: "500", color: "rgba(255,255,255,0.8)" },
  manualEntryBtn: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 28, paddingVertical: 40, alignItems: "center", justifyContent: "center", gap: 10, borderWidth: 1, borderColor: COLORS.border },
  manualEntryLabel: { fontSize: 15, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5, textTransform: "uppercase" },
  manualEntrySub: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },

  /* Delivery Bin Capacity */
  capacityCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  capacityTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  capacityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  capacityIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  capacityTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  capacitySubtitle: { fontSize: 12, fontWeight: "500", color: COLORS.textSecondary },
  capacityPct: { fontSize: 32, fontWeight: "800", letterSpacing: -1 },
  progressWrapper: { position: "relative", paddingTop: 36 },
  progressTrack: { height: 14, backgroundColor: COLORS.background, borderRadius: 7, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 7, backgroundColor: COLORS.orange },
  progressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressEdge: { fontSize: 11, fontWeight: "400", color: COLORS.textMuted },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  warningText: { fontSize: 11, fontWeight: "600", color: COLORS.orange },
  readyRow: { alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 16, marginTop: -8 },
  readyText: { fontSize: 13, fontWeight: "800", color: "rgba(43,169,155,0.22)", letterSpacing: 3 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", flexShrink: 1, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8, alignItems: "center" },
  statIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: COLORS.background, alignItems: "center", justifyContent: "center" },
  statIconRow: { marginBottom: 6 },
  statValue: { fontSize: 32, fontWeight: "800", color: COLORS.text, lineHeight: 36, textAlign: "center", letterSpacing: -1 },
  statLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.6, textAlign: "center", textTransform: 'uppercase' },
  mascotImg: { position: "absolute", top: 0, width: 52, height: 52, zIndex: 1 },

  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.4)" },
  modalSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 24, paddingBottom: 36, paddingTop: 12, gap: 16, alignItems: "center" },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 4 },
  scannerFrame: { width: 210, height: 210, backgroundColor: COLORS.primaryLight, borderRadius: 20, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: COLORS.primary, borderWidth: 3 },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  qrIconWrap: { width: 52, height: 52, borderRadius: 14, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  scanTitle: { fontSize: 18, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  scanSubtitle: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center" },
  cancelTextBtn: { paddingVertical: 8 },
  cancelTextBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.textSecondary },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.greenLight, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  scannedBox: { width: "100%", backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", gap: 4 },
  scannedLabel: { fontSize: 10, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5 },
  scannedTracking: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  successTitle: { fontSize: 18, fontWeight: "800", color: COLORS.green, textAlign: "center" },
  successSubtitle: { fontSize: 13, fontWeight: "500", color: COLORS.textSecondary, textAlign: "center" },
  doneBtn: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
});
