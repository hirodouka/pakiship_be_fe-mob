import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Platform, Modal, ActivityIndicator, Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { ReceiveParcelHeader } from "../components/ReceiveParcelHeader";
import { COLORS } from "../types/colors";
import { fetchPendingParcels, receiveParcel, fetchHubSummary } from "../services/operatorApi";

interface HubParcel {
  id: string;
  trackingNumber: string;
  sender: string;
  recipient: string;
  packageSize: string;
  status: string;
  arrivalTime?: string;
  storageLocation: string | null;
}

const SIZE_COLORS: Record<string, { text: string; bg: string }> = {
  Small: { text: COLORS.green, bg: COLORS.greenLight },
  Medium: { text: COLORS.blue, bg: COLORS.blueLight },
  Large: { text: COLORS.purple, bg: COLORS.purpleLight },
};

function SizeBadge({ size }: { size: string }) {
  const cfg = SIZE_COLORS[size] ?? SIZE_COLORS.Medium;
  return (
    <View style={[styles.sizeBadge, { backgroundColor: cfg.bg }]}>
      <Text style={[styles.sizeBadgeText, { color: cfg.text }]}>{size}</Text>
    </View>
  );
}

function StatBox({ iconBg, icon, value, label, valueColor }: { iconBg: string; icon: React.ReactNode; value: string; label: string; valueColor?: string }) {
  return (
    <View style={styles.statBox}>
      <View style={[styles.statBoxIconWrap, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={[styles.statBoxValue, valueColor ? { color: valueColor } : {}]}>{value}</Text>
      <Text style={styles.statBoxLabel}>{label}</Text>
    </View>
  );
}

export default function ReceiveParcelScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  const [search, setSearch] = useState("");
  const [parcels, setParcels] = useState<HubParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [hubName, setHubName] = useState("Your Hub");
  const [scanParcel, setScanParcel] = useState<HubParcel | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [processing, setProcessing] = useState(false);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [parcelsRes, summaryRes] = await Promise.all([
        fetchPendingParcels(),
        fetchHubSummary().catch(() => null),
      ]);
      setParcels(parcelsRes.parcels ?? []);
      if (summaryRes?.hubName) setHubName(summaryRes.hubName);
    } catch (e) {
      console.error("ReceiveParcelScreen load failed:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const pending = parcels.filter((p) => p.status === "incoming");
  const received = parcels.filter((p) => p.status === "stored" || p.status === "picked-up");

  const q = search.toLowerCase();
  const filteredPending = pending.filter(
    (p) => q === "" || p.trackingNumber.toLowerCase().includes(q) || p.recipient.toLowerCase().includes(q) || p.sender.toLowerCase().includes(q)
  );
  const filteredReceived = received.filter(
    (p) => q === "" || p.trackingNumber.toLowerCase().includes(q) || p.recipient.toLowerCase().includes(q) || p.sender.toLowerCase().includes(q)
  );

  async function handleScanConfirmed() {
    if (!scanParcel) return;
    try {
      setProcessing(true);
      await receiveParcel(scanParcel.id);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setShowSuccess(true);
      loadData();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not receive parcel.");
      setScanParcel(null);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <View style={styles.container}>
      <ReceiveParcelHeader title="Receive Parcel" subtitle={hubName} />

      {/* QR Scan Modal */}
      <Modal visible={!!scanParcel && !showSuccess} transparent animationType="slide" onRequestClose={() => setScanParcel(null)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setScanParcel(null)} />
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.scannerFrame}>
              <View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} />
              <View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} />
              <View style={styles.qrIconWrap}>
                {processing ? <ActivityIndicator size="large" color={COLORS.white} /> : <Feather name="maximize" size={26} color={COLORS.white} />}
              </View>
            </View>
            <View style={styles.scannedBox}>
              <Text style={styles.scannedLabel}>PARCEL</Text>
              <Text style={styles.scannedTracking}>{scanParcel?.trackingNumber}</Text>
              <Text style={styles.scannedRecipient}>To: {scanParcel?.recipient}</Text>
            </View>
            <Text style={styles.scanTitle}>Scanning QR Code...</Text>
            <Text style={styles.scanSubtitle}>{"Hold the customer's QR code to the camera"}</Text>
            <TouchableOpacity onPress={() => { if (!processing) { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); handleScanConfirmed(); } }} style={styles.confirmScanBtn} activeOpacity={0.85}>
              <Text style={styles.confirmScanText}>Confirm Receive</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setScanParcel(null)} style={styles.cancelTextBtn}><Text style={styles.cancelTextBtnText}>Cancel</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Success Modal */}
      <Modal visible={showSuccess} transparent animationType="slide" onRequestClose={() => { setShowSuccess(false); setScanParcel(null); }}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => { setShowSuccess(false); setScanParcel(null); }} />
          <View style={styles.modalSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.successIconWrap}><Feather name="check-circle" size={36} color={COLORS.green} /></View>
            <View style={styles.scannedBox}>
              <Text style={styles.scannedLabel}>TRACKING NUMBER</Text>
              <Text style={styles.scannedTracking}>{scanParcel?.trackingNumber}</Text>
            </View>
            <Text style={styles.successTitle}>Parcel Received!</Text>
            <Text style={styles.successSubtitle}>Parcel has been received and logged into the system.</Text>
            <TouchableOpacity style={styles.doneBtn} onPress={() => { setShowSuccess(false); setScanParcel(null); }} activeOpacity={0.85}>
              <Text style={styles.doneBtnText}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        {/* Stats — live from API */}
        <View style={styles.statsGrid}>
          <StatBox iconBg="#EFF6FF" icon={<Feather name="clock" size={20} color={COLORS.blue} />} value={String(pending.length)} label="PENDING DROP-OFFS" valueColor={COLORS.blue} />
          <StatBox iconBg={COLORS.primaryLight} icon={<MaterialCommunityIcons name="qrcode-scan" size={20} color={COLORS.primary} />} value={String(parcels.filter(p => p.status === "incoming").length)} label="INCOMING" valueColor={COLORS.primary} />
          <StatBox iconBg={COLORS.greenLight} icon={<Feather name="check-circle" size={20} color={COLORS.green} />} value={String(received.length)} label="STORED TODAY" valueColor={COLORS.green} />
          <StatBox iconBg={COLORS.primaryLight} icon={<Feather name="package" size={20} color={COLORS.primary} />} value={String(parcels.length)} label="TOTAL PARCELS" valueColor={COLORS.text} />
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Feather name="search" size={16} color={COLORS.textMuted} />
          <TextInput style={styles.searchInput} placeholder="Search by tracking number, sender, or recipient" placeholderTextColor={COLORS.textMuted} value={search} onChangeText={setSearch} />
        </View>

        {/* Pending Drop-offs */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Feather name="clock" size={18} color={COLORS.blue} />
            <View>
              <Text style={styles.sectionTitle}>Pending Drop-offs</Text>
              <Text style={styles.sectionSubtitle}>{filteredPending.length} parcels awaiting</Text>
            </View>
          </View>
          <View style={styles.pendingBadge}><Text style={styles.pendingBadgeText}>{filteredPending.length} pending</Text></View>
        </View>

        {loading ? (
          <View style={styles.loadingWrap}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : filteredPending.length === 0 ? (
          <View style={styles.emptyCard}>
            <Feather name="package" size={32} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No pending drop-offs</Text>
          </View>
        ) : filteredPending.map((parcel) => (
          <View key={parcel.id} style={styles.parcelCard}>
            <View style={styles.parcelCardHeader}>
              <View style={styles.trackingPill}><Text style={styles.parcelTrack}>{parcel.trackingNumber}</Text></View>
              <SizeBadge size={parcel.packageSize} />
            </View>
            <View style={styles.parcelDetailRow}>
              <Feather name="user" size={13} color={COLORS.textMuted} />
              <Text style={styles.parcelDetailText}>To: <Text style={styles.parcelDetailBold}>{parcel.recipient}</Text></Text>
            </View>
            <View style={styles.parcelDetailRow}>
              <Feather name="map-pin" size={13} color={COLORS.textMuted} />
              <Text style={styles.parcelDetailText}>From: {parcel.sender}</Text>
            </View>
            {parcel.arrivalTime && (
              <View style={styles.parcelDetailRow}>
                <Feather name="clock" size={13} color={COLORS.primary} />
                <Text style={[styles.parcelDetailText, { color: COLORS.primary, fontWeight: "600" }]}>Arrived: {parcel.arrivalTime}</Text>
              </View>
            )}
            <TouchableOpacity style={styles.scanBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setScanParcel(parcel); }} activeOpacity={0.85}>
              <MaterialCommunityIcons name="qrcode-scan" size={16} color={COLORS.white} />
              <Text style={styles.scanBtnText}>Scan & Receive</Text>
              <Feather name="chevron-right" size={16} color={COLORS.white} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Received / Stored */}
        <View style={styles.sectionHeader}>
          <View style={styles.sectionTitleRow}>
            <Feather name="check-circle" size={18} color={COLORS.green} />
            <View>
              <Text style={styles.sectionTitle}>Received Today</Text>
              <Text style={styles.sectionSubtitle}>{filteredReceived.length} parcels processed</Text>
            </View>
          </View>
          <Text style={styles.receivedCount}>{filteredReceived.length} received</Text>
        </View>

        {filteredReceived.map((parcel) => (
          <View key={parcel.id} style={styles.receivedCard}>
            <View style={styles.receivedCardLeft}>
              <View style={styles.receivedCardHeader}>
                <View style={styles.trackingPill}><Text style={styles.parcelTrack}>{parcel.trackingNumber}</Text></View>
                <SizeBadge size={parcel.packageSize} />
              </View>
              <View style={styles.parcelDetailRow}>
                <Feather name="user" size={13} color={COLORS.textMuted} />
                <Text style={styles.parcelDetailText}>To: <Text style={styles.parcelDetailBold}>{parcel.recipient}</Text></Text>
              </View>
              <View style={styles.parcelDetailRow}>
                <Feather name="map-pin" size={13} color={COLORS.textMuted} />
                <Text style={styles.parcelDetailText}>From: {parcel.sender}</Text>
              </View>
            </View>
            <View style={styles.receivedRight}>
              <Feather name="check-circle" size={16} color={COLORS.green} />
              <Text style={styles.receivedStatus}>{parcel.status === "stored" ? "Stored" : "Picked Up"}</Text>
              {parcel.arrivalTime && <Text style={styles.receivedTime}>{parcel.arrivalTime}</Text>}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, gap: 14 },
  loadingWrap: { alignItems: "center", paddingVertical: 32 },
  emptyCard: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 13, fontWeight: "500", color: COLORS.textMuted },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statBox: { width: "47%", backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 8, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  statBoxIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  statBoxValue: { fontSize: 28, fontWeight: "700", color: COLORS.text },
  statBoxLabel: { fontSize: 10, fontWeight: "600", color: COLORS.textMuted, letterSpacing: 0.3 },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.cardBg, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, fontSize: 13, fontWeight: "400", color: COLORS.text },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  sectionTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  sectionTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  sectionSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textMuted, marginTop: 1 },
  pendingBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  pendingBadgeText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  receivedCount: { fontSize: 13, fontWeight: "600", color: COLORS.green },
  parcelCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, gap: 8, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  parcelCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  trackingPill: { borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  parcelTrack: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  sizeBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8 },
  sizeBadgeText: { fontSize: 12, fontWeight: "600" },
  parcelDetailRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  parcelDetailText: { fontSize: 13, fontWeight: "400", color: COLORS.text },
  parcelDetailBold: { fontWeight: "700", color: COLORS.text },
  scanBtn: { backgroundColor: COLORS.primary, borderRadius: 30, paddingVertical: 14, paddingHorizontal: 20, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginTop: 4 },
  scanBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  receivedCard: { backgroundColor: COLORS.cardBg, borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 1, shadowRadius: 6, elevation: 2 },
  receivedCardLeft: { flex: 1, gap: 8 },
  receivedCardHeader: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  receivedRight: { alignItems: "flex-end", gap: 2, marginLeft: 12 },
  receivedStatus: { fontSize: 13, fontWeight: "700", color: COLORS.green },
  receivedTime: { fontSize: 12, fontWeight: "400", color: COLORS.textMuted },
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
  scannedBox: { width: "100%", backgroundColor: COLORS.primaryLight, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 16, alignItems: "center", gap: 4 },
  scannedLabel: { fontSize: 10, fontWeight: "600", color: COLORS.primary, letterSpacing: 0.5 },
  scannedTracking: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  scannedRecipient: { fontSize: 12, fontWeight: "400", color: "rgba(0,0,0,0.6)" },
  scanTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  scanSubtitle: { fontSize: 13, fontWeight: "400", color: "rgba(0,0,0,0.6)", textAlign: "center" },
  confirmScanBtn: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  confirmScanText: { fontSize: 15, fontWeight: "600", color: COLORS.white },
  cancelTextBtn: { paddingVertical: 8 },
  cancelTextBtnText: { fontSize: 15, fontWeight: "500", color: "rgba(0,0,0,0.6)" },
  successIconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.greenLight, alignItems: "center", justifyContent: "center", marginVertical: 8 },
  successTitle: { fontSize: 18, fontWeight: "700", color: COLORS.green, textAlign: "center" },
  successSubtitle: { fontSize: 13, fontWeight: "400", color: "rgba(0,0,0,0.6)", textAlign: "center" },
  doneBtn: { width: "100%", backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 15, alignItems: "center" },
  doneBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.white },
});
