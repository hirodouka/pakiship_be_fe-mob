import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Platform, Modal, TextInput, KeyboardAvoidingView, ActivityIndicator, Alert,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { CameraView, useCameraPermissions } from "expo-camera";
import { TourOverlay } from "../components/TourOverlay";
import { COLORS } from "../types/colors";
import {
  fetchPendingParcels, receiveParcel, markPickedUp, reportLostParcel, dispatchParcel,
} from "../services/operatorApi";

type ParcelStatus = "incoming" | "stored" | "picked-up" | "dispatched";

interface HubParcel {
  id: string;
  trackingNumber: string;
  sender: string;
  recipient: string;
  recipientPhone: string | null;
  packageSize: string;
  status: ParcelStatus;
  arrivalTime?: string;
  storageLocation: string | null;
  draftId: string | null;
}

type FilterType = "all" | "incoming" | "stored";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  incoming: { label: "Incoming", color: COLORS.blue, bg: COLORS.blueLight, icon: "arrow-down-left" },
  stored: { label: "Stored", color: COLORS.primary, bg: COLORS.primaryLight, icon: "package" },
  "picked-up": { label: "Picked Up", color: COLORS.green, bg: COLORS.greenLight, icon: "check-circle" },
  dispatched: { label: "Dispatched", color: COLORS.orange, bg: COLORS.orangeLight, icon: "truck" },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = (STATUS_CONFIG[status] || STATUS_CONFIG.incoming) as { label: string; color: string; bg: string; icon: string };
  return (
    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
      <Feather name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

function ScanModal({ visible, onCancel, onScanned }: {
  visible: boolean; onCancel: () => void; onScanned: (data: string) => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    if (visible && (!permission || !permission.granted)) {
      requestPermission();
    }
    if (visible) {
      setScanned(false); // reset on open so camera is always ready
    }
  }, [visible, permission]);

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onScanned(data);
    // Reset after 2s so operator can re-scan if wrong QR
    setTimeout(() => setScanned(false), 2000);
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onCancel} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          
          <View style={styles.scannerWrapper}>
            {permission?.granted ? (
              <CameraView
                style={styles.scannerCamera}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                  barcodeTypes: ["qr", "ean13", "code128"],
                }}
              >
                <View style={styles.scannerFrame}>
                  <View style={[styles.corner, styles.cornerTL]} /><View style={[styles.corner, styles.cornerTR]} />
                  <View style={[styles.corner, styles.cornerBL]} /><View style={[styles.corner, styles.cornerBR]} />
                  <View style={styles.scanLine} />
                </View>
              </CameraView>
            ) : (
              <View style={styles.permissionBox}>
                <Feather name="camera-off" size={48} color={COLORS.textMuted} />
                <Text style={styles.permissionText}>Camera permission is required to scan parcels.</Text>
                <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
                  <Text style={styles.permissionBtnText}>Enable Camera</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>

          <Text style={styles.scanTitle}>Scan Parcel QR Code</Text>
          <Text style={styles.scanSubtitle}>Align the barcode or QR code within the frame</Text>
          
          <TouchableOpacity onPress={onCancel} style={styles.cancelTextBtn}>
            <Text style={styles.cancelTextBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ScanSuccessModal({ visible, trackingNumber, onDone }: { visible: boolean; trackingNumber: string; onDone: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onDone} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <View style={styles.successIconWrap}><Feather name="check-circle" size={36} color={COLORS.green} /></View>
          <View style={styles.scannedBox}>
            <Text style={styles.scannedLabel}>TRACKING NUMBER</Text>
            <Text style={styles.scannedTracking}>{trackingNumber}</Text>
          </View>
          <Text style={styles.successTitle}>Parcel Received!</Text>
          <Text style={styles.scanSubtitle}>Parcel has been logged and stored at the hub.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}><Text style={styles.doneBtnText}>Done</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function PickupSuccessModal({ visible, parcel, onDone }: { visible: boolean; parcel: HubParcel | null; onDone: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onDone} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <View style={styles.successIconWrap}><Feather name="check-circle" size={36} color={COLORS.green} /></View>
          <Text style={styles.successTitle}>Pickup Successful!</Text>
          <View style={styles.scannedBox}>
            <Text style={styles.scannedLabel}>TRACKING NUMBER</Text>
            <Text style={styles.scannedTracking}>{parcel?.trackingNumber}</Text>
          </View>
          <Text style={styles.handedToText}>Handed to: <Text style={styles.handedToName}>{parcel?.recipient}</Text></Text>
          <Text style={styles.scanSubtitle}>The parcel has been successfully picked up and logged.</Text>
          <TouchableOpacity style={styles.doneBtn} onPress={onDone} activeOpacity={0.85}><Text style={styles.doneBtnText}>Done</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function DispatchSuccessModal({ visible, parcel, onDone }: { visible: boolean; parcel: HubParcel | null; onDone: () => void }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDone}>
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={onDone} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <View style={[styles.successIconWrap, { backgroundColor: COLORS.blueLight }]}>
            <Feather name="send" size={36} color={COLORS.blue} />
          </View>
          <Text style={[styles.successTitle, { color: COLORS.blue }]}>Dispatched to Driver!</Text>
          <View style={styles.scannedBox}>
            <Text style={styles.scannedLabel}>TRACKING NUMBER</Text>
            <Text style={styles.scannedTracking}>{parcel?.trackingNumber}</Text>
          </View>
          <Text style={styles.scanSubtitle}>
            A driver job has been created. A driver will pick up this parcel from the hub and deliver it.
          </Text>
          <TouchableOpacity style={[styles.doneBtn, { backgroundColor: COLORS.blue }]} onPress={onDone} activeOpacity={0.85}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function ReportLostModal({ visible, onClose, onSubmitted }: { visible: boolean; onClose: () => void; onSubmitted: () => void }) {
  const [tracking, setTracking] = useState("");
  const [details, setDetails] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedTracking, setSubmittedTracking] = useState("");

  async function handleSubmit() {
    if (!tracking.trim()) return;
    try {
      setSubmitting(true);
      await reportLostParcel(tracking.trim(), details.trim());
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmittedTracking(tracking.trim());
      setTracking(""); setDetails("");
      setSubmitted(true);
      onSubmitted();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not submit report. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    setTracking(""); setDetails(""); setSubmitted(false);
    onClose();
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={handleClose} />
        {submitted ? (
          <View style={styles.reportSuccessSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.reportSuccessIconWrap}><Feather name="alert-triangle" size={32} color={COLORS.orange} /></View>
            <Text style={styles.reportSuccessTitle}>Report Submitted</Text>
            <Text style={styles.reportSuccessTracking}>Tracking: <Text style={{ fontWeight: "700" }}>{submittedTracking}</Text></Text>
            <Text style={styles.reportSuccessBody}>Our team has been notified and will investigate shortly.</Text>
            <TouchableOpacity style={[styles.doneBtn, { width: "100%" }]} onPress={handleClose} activeOpacity={0.85}><Text style={styles.doneBtnText}>Close</Text></TouchableOpacity>
          </View>
        ) : (
          <View style={styles.reportModalSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}><Feather name="alert-triangle" size={20} color={COLORS.orange} /></View>
              <View style={styles.modalHeaderText}>
                <Text style={styles.modalTitleText}>Report Lost Parcel</Text>
                <Text style={styles.modalSubtitle}>Fill in the details below</Text>
              </View>
              <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose} activeOpacity={0.7}><Feather name="x" size={18} color={COLORS.textSecondary} /></TouchableOpacity>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TRACKING NUMBER</Text>
              <View style={styles.inputRow}>
                <Feather name="search" size={16} color={COLORS.textMuted} />
                <TextInput style={styles.textInput} placeholder="PKS-20260519-XXXXXXXX" placeholderTextColor={COLORS.textMuted} value={tracking} onChangeText={setTracking} autoCapitalize="characters" />
              </View>
            </View>
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>ADDITIONAL DETAILS</Text>
              <TextInput style={styles.textArea} placeholder="Describe when and where the parcel was last seen..." placeholderTextColor={COLORS.textMuted} value={details} onChangeText={setDetails} multiline numberOfLines={4} textAlignVertical="top" />
            </View>
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={handleClose} activeOpacity={0.75}><Text style={styles.cancelBtnText}>Cancel</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.submitBtn, (!tracking.trim() || submitting) && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={!tracking.trim() || submitting} activeOpacity={0.85}>
                {submitting ? <ActivityIndicator size="small" color={COLORS.white} /> : <Text style={styles.submitBtnText}>Submit Report</Text>}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

function ParcelCard({ parcel, onReceive, onPickup, onDispatch, processing }: { parcel: HubParcel; onReceive: (p: HubParcel) => void; onPickup: (p: HubParcel) => void; onDispatch: (p: HubParcel) => void; processing?: boolean }) {
  const isIncoming = parcel.status === "incoming";
  const isStored = parcel.status === "stored";
  return (
    <View style={styles.parcelCard}>
      <View style={styles.parcelHeader}>
        <Text style={styles.trackingNumber}>{parcel.trackingNumber}</Text>
        {parcel.storageLocation && (
          <View style={styles.shelfBadge}><Text style={styles.shelfText}>SHELF: {parcel.storageLocation}</Text></View>
        )}
      </View>
      <View style={styles.parcelDetail}><Text style={styles.parcelLabel}>FROM:</Text><Text style={styles.parcelName}>{parcel.sender.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')}</Text></View>
      <View style={styles.parcelDetail}><Text style={styles.parcelLabel}>TO:</Text><Text style={styles.parcelName}>{parcel.recipient.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()).join(' ')}</Text></View>
      {parcel.arrivalTime && (
        <View style={styles.parcelTimeRow}>
          <Feather name="clock" size={12} color={COLORS.textMuted} />
          <Text style={styles.parcelTime}>{isIncoming ? "Arrived" : isStored ? "Arrived" : "Processed"}: {parcel.arrivalTime}</Text>
        </View>
      )}
      <View style={styles.parcelFooter}>
        <StatusBadge status={parcel.status} />
        {isIncoming && (
          <TouchableOpacity
            style={[styles.scanBtn, processing && { opacity: 0.5 }]}
            onPress={() => { if (!processing) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onReceive(parcel); } }}
            activeOpacity={0.85}
            disabled={processing}
          >
            {processing
              ? <ActivityIndicator size="small" color={COLORS.white} />
              : <Feather name="maximize" size={14} color={COLORS.white} />
            }
            <Text style={styles.scanBtnText}>{processing ? "Processing..." : "Scan & Receive"}</Text>
            {!processing && <Feather name="chevron-right" size={14} color={COLORS.white} />}
          </TouchableOpacity>
        )}
      </View>
      {isStored && (
        <View style={styles.storedActions}>
          <TouchableOpacity style={styles.processBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onPickup(parcel); }} activeOpacity={0.85}>
            <Feather name="user-check" size={14} color={COLORS.primary} />
            <Text style={styles.processBtnText}>Customer Pickup</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.dispatchBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); onDispatch(parcel); }} activeOpacity={0.85}>
            <Feather name="send" size={14} color={COLORS.white} />
            <Text style={styles.dispatchBtnText}>Dispatch Driver</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

export default function InventoryScreen({
  showTour = false, onTourNext, onTourBack, onCloseTour,
}: {
  showTour?: boolean; onTourNext?: () => void; onTourBack?: () => void; onCloseTour?: () => void;
}) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [parcels, setParcels] = useState<HubParcel[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);  // global lock — prevents duplicate requests
  const [reportModalVisible, setReportModalVisible] = useState(false);
  const [scanParcel, setScanParcel] = useState<HubParcel | null>(null);
  const [showScanSuccess, setShowScanSuccess] = useState(false);
  const [pickupParcel, setPickupParcel] = useState<HubParcel | null>(null);
  const [showPickupSuccess, setShowPickupSuccess] = useState(false);
  const [dispatchParcelItem, setDispatchParcelItem] = useState<HubParcel | null>(null);
  const [showDispatchSuccess, setShowDispatchSuccess] = useState(false);
  const [parcelSpotlight, setParcelSpotlight] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const firstCardRef = useRef<View>(null);
  const insets = useSafeAreaInsets();
  const bottomPad = Platform.OS === "web" ? 84 + 34 : insets.bottom + 80;

  const loadParcels = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetchPendingParcels();
      setParcels(res.parcels ?? []);
    } catch (e) {
      console.error("Failed to load parcels:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadParcels(); }, [loadParcels]);

  useEffect(() => {
    if (!showTour) return;
    setParcelSpotlight(null);
    const t = setTimeout(() => {
      firstCardRef.current?.measureInWindow((x, y, w, h) => {
        if (w > 0 && h > 0) setParcelSpotlight({ x, y, width: w, height: h });
      });
    }, 500);
    return () => clearTimeout(t);
  }, [showTour]);

  async function handleReceive(parcel: HubParcel) {
    setScanParcel(parcel);
  }

  async function handleScanConfirmed(scannedData?: string) {
    if (!scanParcel || processing) return;

    const recordId = scanParcel.id ?? (scanParcel.draftId ? `incoming-${scanParcel.draftId}` : null);
    if (!recordId) {
      Alert.alert("Error", "Cannot identify this parcel. Please try manual entry.");
      setScanParcel(null);
      return;
    }

    // If a QR was scanned, verify it matches this parcel's tracking number
    if (scannedData) {
      let scannedTracking = scannedData.trim();
      try {
        const parsed = JSON.parse(scannedData);
        if (parsed.trackingNumber) scannedTracking = parsed.trackingNumber;
      } catch { /* plain string */ }

      if (
        scanParcel.trackingNumber &&
        scannedTracking.toUpperCase() !== scanParcel.trackingNumber.toUpperCase()
      ) {
        Alert.alert(
          "Wrong Parcel",
          `Scanned QR is for ${scannedTracking}, but selected parcel is ${scanParcel.trackingNumber}. Please scan the correct QR code.`,
        );
        return;
      }
    }

    try {
      setProcessing(true);
      console.log(`[InventoryScreen] calling receiveParcel with recordId="${recordId}"`);
      await receiveParcel(recordId);
      setShowScanSuccess(true);
      loadParcels();
    } catch (e: any) {
      console.error(`[InventoryScreen] receiveParcel failed:`, e?.message, e);
      Alert.alert("Error", e?.message ?? "Could not receive parcel.");
      setScanParcel(null);
    } finally {
      setProcessing(false);
    }
  }

  async function handlePickupConfirmed(parcel: HubParcel) {
    const recordId = parcel.id ?? (parcel.draftId ? `incoming-${parcel.draftId}` : null);
    if (!recordId) {
      Alert.alert("Error", "Cannot identify this parcel.");
      return;
    }
    try {
      await markPickedUp(recordId);
      setPickupParcel(parcel);
      setShowPickupSuccess(true);
      loadParcels();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not process pickup.");
    }
  }

  async function handleDispatch(parcel: HubParcel) {
    const recordId = parcel.id ?? (parcel.draftId ? `incoming-${parcel.draftId}` : null);
    if (!recordId) {
      Alert.alert("Error", "Cannot identify this parcel.");
      return;
    }
    try {
      await dispatchParcel(recordId);
      setDispatchParcelItem(parcel);
      setShowDispatchSuccess(true);
      loadParcels();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not dispatch parcel. " + (e?.message ?? ""));
    }
  }

  const filteredParcels = parcels.filter((p) => {
    if (filter === "all") return true;
    if (filter === "incoming") return p.status === "incoming";
    if (filter === "stored") return p.status === "stored";
    return true;
  });

  const incomingCount = parcels.filter((p) => p.status === "incoming").length;
  const storedCount = parcels.filter((p) => p.status === "stored").length;

  const filters: { key: FilterType; label: string; count?: number }[] = [
    { key: "all", label: "ALL", count: parcels.length },
    { key: "incoming", label: "INCOMING", count: incomingCount },
    { key: "stored", label: "STORED", count: storedCount },
  ];

  return (
    <View style={styles.container}>
      <TourOverlay
        visible={showTour}
        steps={[{ step: 4, totalSteps: 5, title: "Parcel Management", body: "Manage all parcels. Use 'Scan & Receive' to receive incoming ones!", mascot: require("../../../assets/mascot-star.png"), spotlight: parcelSpotlight, cardPosition: "bottom", isLast: false, onNext: onTourNext ?? onCloseTour, onBack: onTourBack ?? onCloseTour }]}
        onClose={onCloseTour || (() => {})}
      />
      <ReportLostModal visible={reportModalVisible} onClose={() => setReportModalVisible(false)} onSubmitted={loadParcels} />
      <ScanModal
        visible={!!scanParcel && !showScanSuccess}
        onCancel={() => { if (!processing) setScanParcel(null); }}
        onScanned={(data) => handleScanConfirmed(data)}
      />
      <ScanSuccessModal
        visible={showScanSuccess}
        trackingNumber={scanParcel?.trackingNumber ?? ""}
        onDone={() => { setShowScanSuccess(false); setScanParcel(null); }}
      />
      <PickupSuccessModal
        visible={showPickupSuccess}
        parcel={pickupParcel}
        onDone={() => { setShowPickupSuccess(false); setPickupParcel(null); }}
      />
      <DispatchSuccessModal
        visible={showDispatchSuccess}
        parcel={dispatchParcelItem}
        onDone={() => { setShowDispatchSuccess(false); setDispatchParcelItem(null); }}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}>
        <View style={styles.titleSection}>
          <Text style={styles.pageTitle}>Parcel Management</Text>
          <Text style={styles.pageSubtitle}>Track and organize current inventory</Text>
        </View>

        <View style={styles.filterRow}>
          {filters.map((f) => (
            <TouchableOpacity key={f.key} style={[styles.filterBtn, filter === f.key && styles.filterBtnActive]} onPress={() => { Haptics.selectionAsync(); setFilter(f.key); }}>
              <Text style={[styles.filterBtnText, filter === f.key && styles.filterBtnTextActive]}>{f.label} {f.count !== undefined ? `(${f.count})` : ""}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <View style={styles.emptyState}><ActivityIndicator size="large" color={COLORS.primary} /></View>
        ) : filteredParcels.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="package" size={40} color={COLORS.textMuted} />
            <Text style={styles.emptyText}>No parcels found</Text>
          </View>
        ) : (
          filteredParcels.map((p, idx) => (
            <View key={`parcel-${p.id ?? p.draftId ?? 'none'}-${idx}`} ref={idx === 0 ? firstCardRef : undefined}>
              <ParcelCard parcel={p} onReceive={handleReceive} onPickup={handlePickupConfirmed} onDispatch={handleDispatch} processing={processing} />
            </View>
          ))
        )}

        <TouchableOpacity style={styles.reportBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setReportModalVisible(true); }}>
          <Feather name="alert-triangle" size={14} color={COLORS.orange} />
          <Text style={styles.reportBtnText}>REPORT LOST PARCEL</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { padding: 16, gap: 14 },
  titleSection: { alignItems: "center", marginBottom: 10, marginTop: 8 },
  pageTitle: { fontSize: 22, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  pageSubtitle: { fontSize: 12, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2, textAlign: "center" },
  filterRow: {
    flexDirection: "row",
    backgroundColor: COLORS.cardBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 4,
    marginBottom: 8,
    alignItems: "center",
  },
  filterBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBtnActive: {
    backgroundColor: COLORS.primary,
  },
  filterBtnText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
  },
  filterBtnTextActive: {
    color: COLORS.white,
  },
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60, gap: 12 },
  emptyText: { fontSize: 15, fontWeight: "500", color: COLORS.textMuted },
  parcelCard: { backgroundColor: COLORS.cardBg, borderRadius: 18, padding: 16, gap: 12, marginBottom: 14, shadowColor: COLORS.shadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 1, shadowRadius: 10, elevation: 3 },
  parcelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  trackingNumber: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  shelfBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  shelfText: { fontSize: 10, fontWeight: "700", color: COLORS.primary },
  parcelDetail: { flexDirection: "row", alignItems: "center" },
  parcelLabel: { fontSize: 11, fontWeight: "600", color: COLORS.textMuted, width: 60 },
  parcelName: { fontSize: 14, fontWeight: "600", color: COLORS.text },
  parcelTimeRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  parcelTime: { fontSize: 12, color: COLORS.textMuted },
  parcelFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  badge: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  badgeText: { fontSize: 11, fontWeight: "700", letterSpacing: 0.3 },
  scanBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  scanBtnText: { fontSize: 13, fontWeight: "700", color: COLORS.white },
  storedActions: { flexDirection: "row", gap: 8, marginTop: 8 },
  processBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.primaryLight, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  processBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  dispatchBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: COLORS.primary, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12 },
  dispatchBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.white },
  reportBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: COLORS.orange, borderStyle: "dashed" },
  reportBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.orange, letterSpacing: 0.5 },
  modalOverlay: { flex: 1, justifyContent: "flex-end" },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.6)" },
  modalSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24, gap: 16 },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: "center", marginBottom: 8 },
  scannerWrapper: { width: "100%", height: 300, backgroundColor: COLORS.black, borderRadius: 24, overflow: "hidden", marginBottom: 8 },
  scannerCamera: { flex: 1 },
  scannerFrame: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "transparent" },
  scanLine: { width: "80%", height: 2, backgroundColor: COLORS.primary, position: "absolute" },
  permissionBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 16 },
  permissionText: { fontSize: 14, color: COLORS.textMuted, textAlign: "center", lineHeight: 20 },
  permissionBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 12 },
  permissionBtnText: { color: COLORS.white, fontWeight: "700" },
  scanTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  scanSubtitle: { fontSize: 14, color: COLORS.textSecondary, textAlign: "center", marginBottom: 10 },
  cancelTextBtn: { paddingVertical: 12, alignItems: "center" },
  cancelTextBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.textMuted },
  scannedBox: { backgroundColor: COLORS.primaryLight, padding: 16, borderRadius: 16, alignItems: "center", gap: 4 },
  scannedLabel: { fontSize: 10, fontWeight: "700", color: COLORS.primary, letterSpacing: 1 },
  scannedTracking: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  successIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.greenLight, alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 20 },
  successTitle: { fontSize: 22, fontWeight: "800", color: COLORS.green, textAlign: "center" },
  successSubtitle: { fontSize: 15, color: COLORS.textSecondary, textAlign: "center", marginBottom: 20 },
  doneBtn: { backgroundColor: COLORS.primary, paddingVertical: 16, borderRadius: 16, alignItems: "center" },
  doneBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  // Report modal styles
  reportModalSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 20 },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalIconWrap: { width: 40, height: 40, borderRadius: 12, backgroundColor: COLORS.orangeLight, alignItems: "center", justifyContent: "center" },
  modalHeaderText: { flex: 1 },
  modalTitleText: { fontSize: 18, fontWeight: "800", color: COLORS.text },
  modalCloseBtn: { padding: 4 },
  fieldGroup: { gap: 8 },
  cancelBtn: { flex: 1, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  cancelBtnText: { fontSize: 15, fontWeight: "500", color: COLORS.textSecondary },
  submitBtn: { flex: 2, backgroundColor: COLORS.orange, borderRadius: 14, paddingVertical: 14, alignItems: "center", justifyContent: "center" },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.white },
  reportSuccessTitle: { fontSize: 20, fontWeight: "700", color: COLORS.text, textAlign: "center" },
  reportSuccessTracking: { fontSize: 14, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center" },
  reportSuccessBody: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, textAlign: "center", lineHeight: 20 },
  reportSuccessIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: "#FFF0E6", alignItems: "center", justifyContent: "center", alignSelf: "center", marginVertical: 8 },
  corner: { position: "absolute", width: 28, height: 28, borderColor: COLORS.primary, borderWidth: 3 },
  cornerTL: { top: 12, left: 12, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 12, right: 12, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 12, left: 12, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 12, right: 12, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },
  handedToText: { fontSize: 14, fontWeight: "500", color: COLORS.textSecondary, textAlign: "center", marginTop: 4 },
  handedToName: { fontWeight: "700", color: COLORS.text },
  reportSuccessSheet: { backgroundColor: COLORS.cardBg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, gap: 20 },
  modalSubtitle: { fontSize: 13, fontWeight: "400", color: COLORS.textSecondary, marginTop: 2 },
  fieldLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.5 },
  inputRow: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.background, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, gap: 10, borderWidth: 1, borderColor: COLORS.border },
  textInput: { flex: 1, fontSize: 14, fontWeight: "400", color: COLORS.text },
  textArea: { backgroundColor: COLORS.background, borderRadius: 14, padding: 14, fontSize: 14, fontWeight: "400", color: COLORS.text, minHeight: 100, borderWidth: 1, borderColor: COLORS.border },
  modalActions: { flexDirection: "row", gap: 10, marginTop: 8 },
});
