import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../types/colors";
import { apiRequest } from "../../services/api";

type KPIs = {
  incomingToday: number;
  currentlyStored: number;
  pickedUpToday: number;
  customersServed: number;
  receivedToday: number;
};

type Earnings = {
  totalEarned: number;
  weeklyIncrease: number;
  incentives: number;
  bonusesEarned: number;
};

type StatCardProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  iconBg: string;
  valueColor?: string;
};

function StatCard({ icon, value, label, iconBg, valueColor }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AnalyticsScreen({ hubSummary }: { hubSummary?: any }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;

  const [kpis, setKpis] = useState<KPIs>({
    incomingToday: 0,
    currentlyStored: 0,
    pickedUpToday: 0,
    customersServed: 0,
    receivedToday: 0,
  });
  const [earnings, setEarnings] = useState<Earnings>({
    totalEarned: 0,
    weeklyIncrease: 0,
    incentives: 0,
    bonusesEarned: 0,
  });
  const [hubName, setHubName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest("/pakiship/mobile/operator/hub-summary");

      // KPIs come from hub-summary which calls getDashboard → loadKpiMetrics
      const liveKpis = res.kpis ?? {};
      const liveEarnings = res.earnings ?? {};

      setKpis({
        incomingToday: liveKpis.incomingToday ?? 0,
        currentlyStored: liveKpis.currentlyStored ?? 0,
        pickedUpToday: liveKpis.pickedUpToday ?? 0,
        customersServed: liveKpis.customersServed ?? 0,
        receivedToday: liveKpis.receivedToday ?? 0,
      });
      setEarnings({
        totalEarned: liveEarnings.totalEarned ?? 0,
        weeklyIncrease: liveEarnings.weeklyIncrease ?? 0,
        incentives: liveEarnings.incentives ?? 0,
        bonusesEarned: liveEarnings.bonusesEarned ?? 0,
      });
      setHubName(res.hubName ?? "");
      setLastRefreshed(new Date());
    } catch (e) {
      console.error("[AnalyticsScreen] fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount
  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Also sync from parent hubSummary if it updates (e.g. after a scan)
  useEffect(() => {
    if (!hubSummary) return;
    const liveKpis = hubSummary.kpis ?? {};
    const liveEarnings = hubSummary.earnings ?? {};
    setKpis({
      incomingToday: liveKpis.incomingToday ?? 0,
      currentlyStored: liveKpis.currentlyStored ?? 0,
      pickedUpToday: liveKpis.pickedUpToday ?? 0,
      customersServed: liveKpis.customersServed ?? 0,
      receivedToday: liveKpis.receivedToday ?? 0,
    });
    setEarnings({
      totalEarned: liveEarnings.totalEarned ?? 0,
      weeklyIncrease: liveEarnings.weeklyIncrease ?? 0,
      incentives: liveEarnings.incentives ?? 0,
      bonusesEarned: liveEarnings.bonusesEarned ?? 0,
    });
    if (hubSummary.hubName) setHubName(hubSummary.hubName);
  }, [hubSummary]);

  const totalParcels = kpis.incomingToday + kpis.pickedUpToday + kpis.currentlyStored;

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Title + refresh */}
        <View style={styles.titleSection}>
          <View style={styles.titleRow}>
            <View>
              <Text style={styles.pageTitle}>Hub Analytics</Text>
              <Text style={styles.pageSubtitle}>
                {hubName ? `${hubName} · ` : ""}Real-time performance
              </Text>
            </View>
            <TouchableOpacity
              style={styles.refreshBtn}
              onPress={fetchAnalytics}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator size="small" color={COLORS.primary} />
                : <Feather name="refresh-cw" size={16} color={COLORS.primary} />
              }
            </TouchableOpacity>
          </View>
          {lastRefreshed && (
            <Text style={styles.lastRefreshed}>
              Updated {lastRefreshed.toLocaleTimeString("en-PH", { hour: "2-digit", minute: "2-digit" })}
            </Text>
          )}
        </View>

        {/* Stats Grid — all live from DB */}
        <View style={styles.statsGrid}>
          <StatCard
            icon={<Feather name="arrow-down-left" size={20} color={COLORS.blue} />}
            value={String(kpis.incomingToday)}
            label="INCOMING"
            iconBg={COLORS.blueLight}
            valueColor={COLORS.blue}
          />
          <StatCard
            icon={<Feather name="package" size={20} color={COLORS.primary} />}
            value={String(kpis.currentlyStored)}
            label="STORED"
            iconBg={COLORS.primaryLight}
            valueColor={COLORS.primary}
          />
          <StatCard
            icon={<Feather name="check-circle" size={20} color={COLORS.green} />}
            value={String(kpis.pickedUpToday)}
            label="PICKED UP TODAY"
            iconBg={COLORS.greenLight}
            valueColor={COLORS.green}
          />
          <StatCard
            icon={<Feather name="users" size={20} color={COLORS.orange} />}
            value={String(kpis.customersServed)}
            label="CUSTOMERS SERVED"
            iconBg={COLORS.orangeLight}
            valueColor={COLORS.orange}
          />
        </View>

        {/* Received today banner */}
        {kpis.receivedToday > 0 && (
          <View style={styles.receivedBanner}>
            <View style={styles.receivedBannerLeft}>
              <Feather name="inbox" size={18} color={COLORS.primary} />
              <Text style={styles.receivedBannerText}>
                <Text style={styles.receivedBannerCount}>{kpis.receivedToday}</Text>
                {" "}parcel{kpis.receivedToday !== 1 ? "s" : ""} received at hub today
              </Text>
            </View>
            <View style={styles.receivedDot} />
          </View>
        )}

        {/* Earnings & Incentives */}
        <View style={styles.earningsCard}>
          <View style={styles.earningsHeader}>
            <View style={styles.earningsIconCircle}>
              <Text style={styles.pesoSymbol}>₱</Text>
            </View>
            <View>
              <Text style={styles.earningsTitle}>Earnings & Incentives</Text>
              <Text style={styles.earningsSub}>This month</Text>
            </View>
          </View>
          <View style={styles.earningsRow}>
            <View style={styles.earningsCell}>
              <Text style={styles.cellLabel}>TOTAL EARNED</Text>
              <Text style={styles.cellValue}>₱{earnings.totalEarned.toLocaleString()}</Text>
              <Text style={styles.cellGrowth}>+₱{earnings.weeklyIncrease.toLocaleString()} this week</Text>
            </View>
            <View style={[styles.earningsCell, styles.incentivesCell]}>
              <Text style={styles.cellLabel}>INCENTIVES</Text>
              <Text style={[styles.cellValue, { color: COLORS.orange }]}>
                ₱{earnings.incentives.toLocaleString()}
              </Text>
              <View style={styles.bonusRow}>
                <Feather name="gift" size={12} color={COLORS.orange} />
                <Text style={styles.bonusText}>{earnings.bonusesEarned} bonuses earned</Text>
              </View>
            </View>
          </View>
        </View>

        {/* This Week summary */}
        <View style={styles.bottomRow}>
          <View style={styles.weekCard}>
            <View style={styles.weekTitleRow}>
              <Feather name="calendar" size={14} color={COLORS.textSecondary} />
              <Text style={styles.weekTitle}>Summary</Text>
            </View>
            <View style={styles.weekStats}>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>TOTAL PARCELS</Text>
                <Text style={styles.weekStatValue}>{totalParcels}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>RECEIVED TODAY</Text>
                <Text style={styles.weekStatValue}>{kpis.receivedToday}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>HUB VISITS</Text>
                <Text style={styles.weekStatValue}>{kpis.customersServed}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>REVENUE SHARE</Text>
                <Text style={[styles.weekStatValue, { color: COLORS.primary }]}>
                  ₱{earnings.totalEarned > 0
                    ? Math.round(earnings.totalEarned * 0.4).toLocaleString()
                    : "0"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <View style={styles.performanceTop}>
              <Feather name="activity" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.ratingNumber}>{totalParcels}</Text>
              <Text style={styles.ratingLabel}>TOTAL PARCELS</Text>
            </View>
            <Text style={styles.performanceTitle}>
              {kpis.currentlyStored > 0 ? `${kpis.currentlyStored} in\nStorage` : "Hub\nReady"}
            </Text>
            <Text style={styles.performanceSub}>
              {kpis.incomingToday > 0
                ? `${kpis.incomingToday} parcel${kpis.incomingToday !== 1 ? "s" : ""} waiting to be received.`
                : "No pending incoming parcels right now."}
            </Text>
            <View style={styles.growthRow}>
              <Feather name="trending-up" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.growthText}>
                {kpis.pickedUpToday > 0
                  ? `${kpis.pickedUpToday} PICKED UP TODAY`
                  : "NO PICKUPS YET TODAY"}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },

  titleSection: { marginBottom: 4, marginTop: 8, gap: 4 },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  pageTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text },
  pageSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2 },
  refreshBtn: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  lastRefreshed: { fontSize: 10, fontWeight: "600", color: COLORS.textMuted },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  statCard: {
    width: "48%", flexShrink: 1,
    backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16,
    borderWidth: 1, borderColor: COLORS.border, gap: 8, alignItems: "center",
  },
  statIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 30, fontWeight: "900", color: COLORS.text, lineHeight: 34, textAlign: "center" },
  statLabel: { fontSize: 10, fontWeight: "900", color: COLORS.textMuted, letterSpacing: 1, textAlign: "center", textTransform: "uppercase" },

  receivedBanner: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    borderWidth: 1, borderColor: "rgba(43,169,155,0.2)",
  },
  receivedBannerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  receivedBannerText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  receivedBannerCount: { fontWeight: "900", color: COLORS.primary },
  receivedDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },

  earningsCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  earningsHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  earningsIconCircle: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center" },
  pesoSymbol: { fontSize: 17, fontWeight: "900", color: COLORS.primary },
  earningsTitle: { fontSize: 15, fontWeight: "900", color: COLORS.text },
  earningsSub: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, marginTop: 1 },
  earningsRow: { flexDirection: "row", gap: 10 },
  earningsCell: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 12, gap: 5 },
  incentivesCell: { backgroundColor: "#FFF3E8" },
  cellLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.4, marginBottom: 2 },
  cellValue: { fontSize: 24, fontWeight: "800", color: COLORS.text, lineHeight: 28, paddingLeft: 4 },
  cellGrowth: { fontSize: 11, fontWeight: "400", color: COLORS.green, paddingLeft: 4 },
  bonusRow: { flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 4 },
  bonusText: { fontSize: 11, fontWeight: "400", color: COLORS.orange },

  bottomRow: { flexDirection: "row", gap: 10, alignItems: "stretch" },
  weekCard: { flex: 1, backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 14, gap: 14, borderWidth: 1, borderColor: COLORS.border },
  weekTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  weekTitle: { fontSize: 13, fontWeight: "800", color: COLORS.text },
  weekStats: { gap: 12 },
  weekStat: { gap: 2 },
  weekStatLabel: { fontSize: 9, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.4 },
  weekStatValue: { fontSize: 20, fontWeight: "800", color: COLORS.text, lineHeight: 24, paddingLeft: 6 },

  performanceCard: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 18, padding: 14, justifyContent: "space-between", gap: 8 },
  performanceTop: { alignItems: "flex-end", gap: 1 },
  ratingNumber: { fontSize: 26, fontWeight: "800", color: COLORS.white, lineHeight: 30 },
  ratingLabel: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.7)", letterSpacing: 0.8 },
  performanceTitle: { fontSize: 21, fontWeight: "800", color: COLORS.white, lineHeight: 26 },
  performanceSub: { fontSize: 10, fontWeight: "400", color: "rgba(255,255,255,0.82)", lineHeight: 15 },
  growthRow: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(255,255,255,0.15)", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, marginTop: 4 },
  growthText: { fontSize: 10, fontWeight: "600", color: "rgba(255,255,255,0.9)" },
});
