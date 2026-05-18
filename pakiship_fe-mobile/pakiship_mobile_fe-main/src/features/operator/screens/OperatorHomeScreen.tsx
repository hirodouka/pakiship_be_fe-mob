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
import { OperatorHeader } from "../components/OperatorHeader";
import { TourOverlay, shouldShowTour } from "../components/TourOverlay";
import { COLORS } from "../types/colors";
import { useAuthSession } from "../../context/AuthSessionContext";
import { apiRequest } from "../../services/api";
import type { RootStackParamList } from "../../../lib/navigation/types";
import AnalyticsScreen from "./AnalyticsScreen";

type TabType = "home" | "inventory" | "analytics";

const MOCK_TRACKING = "PKS-2026-001241";

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

export default function OperatorHomeScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser } = useAuthSession();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;
  
  const [activeTab, setActiveTab] = useState<TabType>("home");
  const [showScan, setShowScan] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourInitialStep, setTourInitialStep] = useState(0);
  const [hubSummary, setHubSummary] = useState<any>(null);

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
        setTourInitialStep(0);
        setShowTour(true);
      }, 600);
    }
  };

  return (
    <View style={styles.container}>
      <OperatorHeader />
      <TourOverlay
        visible={showTour}
        steps={[
          { step: 1, title: "Welcome to PakiSHIP!", body: "Hi there! I'm your guide. Let's get you familiar with your workspace.", mascot: require("../../../assets/mascot-parcel.png"), totalSteps: 3 },
          { step: 2, title: "Quick Actions", body: "Scan parcels, do manual entry, or update statuses right from here!", mascot: require("../../../assets/no 2.png"), totalSteps: 3 },
          { step: 3, title: "Need Help Again?", body: "You can restart this guide anytime by clicking the Guide button.", mascot: require("../../../assets/mascot-shield.png"), totalSteps: 3 },
        ]}
        onClose={() => setShowTour(false)}
      />

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "home" && styles.tabBtnActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("home"); }}
        >
          <MaterialCommunityIcons name="view-dashboard-outline" size={22} color={activeTab === "home" ? COLORS.primary : "#C1CBD8"} />
          <Text style={[styles.tabLabel, activeTab === "home" && styles.tabLabelActive]}>HOME</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "inventory" && styles.tabBtnActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("inventory"); }}
        >
          <MaterialCommunityIcons name="package-variant-closed" size={22} color={activeTab === "inventory" ? COLORS.primary : "#C1CBD8"} />
          <Text style={[styles.tabLabel, activeTab === "inventory" && styles.tabLabelActive]}>INVENTORY</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "analytics" && styles.tabBtnActive]}
          onPress={() => { Haptics.selectionAsync(); setActiveTab("analytics"); }}
        >
          <MaterialCommunityIcons name="chart-bar" size={22} color={activeTab === "analytics" ? COLORS.primary : "#C1CBD8"} />
          <Text style={[styles.tabLabel, activeTab === "analytics" && styles.tabLabelActive]}>ANALYTICS</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {activeTab === "home" && (
          <View style={styles.viewWrap}>
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

            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={styles.scanParcelBtn}
                onPress={() => navigation.navigate("ReceiveParcel")}
                activeOpacity={0.85}
              >
                <MaterialCommunityIcons name="qrcode-scan" size={48} color={COLORS.white} />
                <Text style={styles.scanParcelLabel}>SCAN PARCEL</Text>
                <Text style={styles.scanParcelSub}>Register via QR code</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.manualEntryBtn}
                onPress={() => {}}
                activeOpacity={0.85}
              >
                <Feather name="smartphone" size={44} color={COLORS.primary} />
                <Text style={styles.manualEntryLabel}>MANUAL ENTRY</Text>
                <Text style={styles.manualEntrySub}>Type tracking number</Text>
              </TouchableOpacity>
            </View>

            {/* Capacity Card */}
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
          </View>
        )}

        {activeTab === "inventory" && (
          <View style={styles.viewWrap}>
            <Text style={styles.pageTitle}>Parcel Management</Text>
            <Text style={styles.pageSubtitle}>Track and organize current inventory</Text>
            <TouchableOpacity
              style={styles.goToInventoryBtn}
              onPress={() => navigation.navigate("ReceiveParcel")}
            >
              <Text style={styles.goToInventoryText}>Go to Full Inventory</Text>
              <Feather name="arrow-right" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        )}

        {activeTab === "analytics" && (
          <AnalyticsScreen hubSummary={hubSummary} />
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  tabBar: { flexDirection: "row", backgroundColor: COLORS.cardBg, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 8 },
  tabBtn: { flex: 1, alignItems: "center", paddingTop: 12 },
  tabBtnActive: {},
  tabLabel: { fontSize: 9, fontWeight: "800", color: "#C1CBD8", letterSpacing: 0.5, marginTop: 4 },
  tabLabelActive: { color: COLORS.primary },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  viewWrap: { flex: 1 },
  
  greetingCard: { backgroundColor: COLORS.background, borderRadius: 16, borderWidth: 1.5, borderColor: "rgba(43,169,155,0.4)", padding: 16, paddingBottom: 0, gap: 14 },
  greetingRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "flex-start", gap: 12, paddingLeft: 4 },
  dot: { width: 11, height: 11, borderRadius: 6, backgroundColor: COLORS.primary, marginTop: 10 },
  greeting: { fontSize: 28, fontWeight: "900", color: COLORS.text, lineHeight: 32, letterSpacing: -1 },
  greetingAccent: { color: COLORS.primary, fontWeight: "900" },
  
  dropOffOuter: { marginTop: 4, borderTopWidth: 1, borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 0, borderStyle: "dashed", borderColor: "rgba(43,169,155,0.45)", borderTopLeftRadius: 12, borderTopRightRadius: 12, paddingBottom: 16 },
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
  manualEntryLabel: { fontSize: 13, fontWeight: "900", color: COLORS.text, letterSpacing: 0.5, textTransform: "uppercase" },
  manualEntrySub: { fontSize: 11, fontWeight: "400", color: COLORS.textSecondary },
  
  capacityCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 12, borderWidth: 1, borderColor: COLORS.border },
  capacityTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  capacityLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  capacityIconWrap: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  capacityTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  capacitySubtitle: { fontSize: 11, fontWeight: "400", color: COLORS.textSecondary },
  capacityPct: { fontSize: 24, fontWeight: "700" },
  progressWrapper: { position: "relative", paddingTop: 36 },
  progressTrack: { height: 14, backgroundColor: COLORS.background, borderRadius: 7, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 7, backgroundColor: COLORS.orange },
  progressLabels: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  progressEdge: { fontSize: 11, fontWeight: "400", color: COLORS.textMuted },
  warningRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  warningText: { fontSize: 11, fontWeight: "500", color: COLORS.orange },
  mascotImg: { position: "absolute", top: 0, width: 52, height: 52, zIndex: 1 },
  
  readyRow: { alignItems: "center", justifyContent: "center", gap: 14, paddingVertical: 16, marginTop: -8 },
  readyText: { fontSize: 13, fontWeight: "700", color: "rgba(43,169,155,0.22)", letterSpacing: 3 },
  
  pageTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  pageSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2, textAlign: "center", marginBottom: 20 },
  goToInventoryBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  goToInventoryText: { fontSize: 15, fontWeight: "600", color: COLORS.white },
  
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: { width: "48%", flexShrink: 1, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8, alignItems: "center" },
  statIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 30, fontWeight: "700", color: COLORS.text, lineHeight: 34, textAlign: "center" },
  statLabel: { fontSize: 10, fontWeight: "500", color: COLORS.textMuted, letterSpacing: 0.6, textAlign: "center" },
});
