import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../types/colors";

type StatCardProps = { icon: React.ReactNode; value: string; label: string; iconBg: string };
function StatCard({ icon, value, label, iconBg }: StatCardProps) {
  return (
    <View style={styles.statCard}>
      <View style={[styles.statIconCircle, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

export default function AnalyticsScreen({ hubSummary }: { hubSummary?: any }) {
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;

  const kpis = hubSummary?.kpis || { incomingToday: 0, currentlyStored: 0, pickedUpToday: 0, customersServed: 0 };
  const earnings = hubSummary?.earnings || { totalEarned: 0, weeklyIncrease: 0, incentives: 0, bonusesEarned: 0 };

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Title */}
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Hub Analytics</Text>
          <Text style={styles.pageSubtitle}>Real-time performance and hub insights</Text>
        </View>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard icon={<Feather name="arrow-down-left" size={20} color={COLORS.blue} />} value={String(kpis.incomingToday)} label="INCOMING TODAY" iconBg={COLORS.blueLight} />
          <StatCard icon={<Feather name="package" size={20} color={COLORS.primary} />} value={String(kpis.currentlyStored)} label="CURRENTLY STORED" iconBg={COLORS.primaryLight} />
          <StatCard icon={<Feather name="arrow-up-right" size={20} color={COLORS.green} />} value={String(kpis.pickedUpToday)} label="PICKED UP TODAY" iconBg={COLORS.greenLight} />
          <StatCard icon={<Feather name="users" size={20} color={COLORS.orange} />} value={kpis.customersServed > 0 ? `${kpis.customersServed}` : "0"} label="CUSTOMERS SERVED" iconBg={COLORS.orangeLight} />
        </View>

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
              <Text style={[styles.cellValue, { color: COLORS.orange }]}>₱{earnings.incentives.toLocaleString()}</Text>
              <View style={styles.bonusRow}>
                <Feather name="gift" size={12} color={COLORS.orange} />
                <Text style={styles.bonusText}>{earnings.bonusesEarned} bonuses earned</Text>
              </View>
            </View>
          </View>
        </View>

        {/* This Week + Performance (Static for now as backend doesn't provide yet, but we've removed explicit mock constants) */}
        <View style={styles.bottomRow}>
          <View style={styles.weekCard}>
            <View style={styles.weekTitleRow}>
              <Feather name="calendar" size={14} color={COLORS.textSecondary} />
              <Text style={styles.weekTitle}>This Week</Text>
            </View>
            <View style={styles.weekStats}>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>TOTAL PARCELS</Text>
                <Text style={styles.weekStatValue}>{kpis.incomingToday + kpis.pickedUpToday}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>AVG. WAIT TIME</Text>
                <Text style={styles.weekStatValue}>{hubSummary?.avgWaitTime || "N/A"}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>HUB VISITS</Text>
                <Text style={styles.weekStatValue}>{kpis.customersServed}</Text>
              </View>
              <View style={styles.weekStat}>
                <Text style={styles.weekStatLabel}>REVENUE SHARE</Text>
                <Text style={[styles.weekStatValue, { color: COLORS.primary }]}>
                  ₱{earnings.totalEarned > 0 ? (earnings.totalEarned * 0.4).toLocaleString() : "0"}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles.performanceCard}>
            <View style={styles.performanceTop}>
              <Feather name="star" size={16} color="rgba(255,255,255,0.75)" />
              <Text style={styles.ratingNumber}>{hubSummary?.rating || "0.0"}</Text>
              <Text style={styles.ratingLabel}>AVG RATING</Text>
            </View>
            <Text style={styles.performanceTitle}>{hubSummary?.performanceTitle || "Hub\nStatus"}</Text>
            <Text style={styles.performanceSub}>
              {hubSummary?.performanceNote || "Complete more deliveries to see your hub's performance ranking!"}
            </Text>
            <View style={styles.growthRow}>
              <Feather name="trending-up" size={12} color="rgba(255,255,255,0.85)" />
              <Text style={styles.growthText}>{hubSummary?.growthLabel || "NO RECENT CHANGE"}</Text>
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

  titleSection: { alignItems: "center", marginBottom: 10, marginTop: 8 },
  pageTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  pageSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center", marginTop: 2 },

  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, justifyContent: "center" },
  statCard: { width: "48%", flexShrink: 1, backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, gap: 8, alignItems: "center" },
  statIconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  statValue: { fontSize: 30, fontWeight: "900", color: COLORS.text, lineHeight: 34, textAlign: "center" },
  statLabel: { fontSize: 10, fontWeight: "900", color: COLORS.textMuted, letterSpacing: 1, textAlign: "center", textTransform: "uppercase" },

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
