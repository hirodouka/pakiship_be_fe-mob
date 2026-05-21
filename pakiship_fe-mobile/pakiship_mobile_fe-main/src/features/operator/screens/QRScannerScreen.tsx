import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from "react-native";
import { CameraView, useCameraPermissions, BarcodeScanningResult } from "expo-camera";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { COLORS } from "../types/colors";
import { scanQrCode } from "../services/operatorApi";

type ScanState = "scanning" | "processing" | "success" | "error";

export default function QRScannerScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanState, setScanState] = useState<ScanState>("scanning");
  const [scannedParcel, setScannedParcel] = useState<{
    trackingNumber: string;
    recipient: string;
    sender: string;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const lastScannedRef = useRef<string | null>(null);
  const cooldownRef = useRef(false);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, []);

  async function handleBarCodeScanned({ data }: BarcodeScanningResult) {
    // Debounce: ignore repeated scans of the same code within 3 seconds
    if (cooldownRef.current || data === lastScannedRef.current) return;
    cooldownRef.current = true;
    lastScannedRef.current = data;

    setScanState("processing");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const result = await scanQrCode(data);
      const parcel = result?.parcel;

      setScannedParcel({
        trackingNumber: parcel?.trackingNumber ?? data,
        recipient: parcel?.recipient ?? "Unknown Recipient",
        sender: parcel?.sender ?? "Unknown Sender",
      });
      setScanState("success");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      setErrorMessage(err?.message ?? "Could not process this QR code.");
      setScanState("error");
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      // Allow re-scan after 3 seconds
      setTimeout(() => {
        cooldownRef.current = false;
      }, 3000);
    }
  }

  function handleReset() {
    setScanState("scanning");
    setScannedParcel(null);
    setErrorMessage("");
    lastScannedRef.current = null;
    cooldownRef.current = false;
  }

  function handleDone() {
    navigation.goBack();
  }

  if (!permission) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top + 16 }]}>
        <MaterialCommunityIcons name="camera-off" size={48} color={COLORS.textMuted} />
        <Text style={styles.permissionTitle}>Camera Access Required</Text>
        <Text style={styles.permissionSubtitle}>
          Allow camera access to scan QR codes from the web operator dashboard.
        </Text>
        <TouchableOpacity style={styles.permissionBtn} onPress={requestPermission}>
          <Text style={styles.permissionBtnText}>Grant Permission</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cancelTextBtn} onPress={() => navigation.goBack()}>
          <Text style={styles.cancelTextBtnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={20} color={COLORS.white} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Scan QR Code</Text>
          <Text style={styles.headerSubtitle}>Point camera at the web dashboard QR</Text>
        </View>
      </View>

      {/* Camera */}
      {scanState === "scanning" || scanState === "processing" ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          onBarcodeScanned={scanState === "scanning" ? handleBarCodeScanned : undefined}
        >
          {/* Overlay */}
          <View style={styles.overlay}>
            {/* Top dark area */}
            <View style={styles.overlayTop} />

            {/* Middle row */}
            <View style={styles.overlayMiddle}>
              <View style={styles.overlaySide} />

              {/* Scan frame */}
              <View style={styles.scanFrame}>
                <View style={[styles.corner, styles.cornerTL]} />
                <View style={[styles.corner, styles.cornerTR]} />
                <View style={[styles.corner, styles.cornerBL]} />
                <View style={[styles.corner, styles.cornerBR]} />

                {scanState === "processing" && (
                  <View style={styles.processingOverlay}>
                    <ActivityIndicator size="large" color={COLORS.white} />
                    <Text style={styles.processingText}>Processing...</Text>
                  </View>
                )}
              </View>

              <View style={styles.overlaySide} />
            </View>

            {/* Bottom dark area with instructions */}
            <View style={styles.overlayBottom}>
              <Text style={styles.scanInstruction}>
                Align the QR code from the web operator dashboard within the frame
              </Text>
              <TouchableOpacity style={styles.manualBtn} onPress={() => navigation.navigate("ManualEntry" as never)}>
                <Feather name="edit-3" size={14} color={COLORS.primary} />
                <Text style={styles.manualBtnText}>Enter tracking number manually</Text>
              </TouchableOpacity>
            </View>
          </View>
        </CameraView>
      ) : null}

      {/* Success Sheet */}
      {scanState === "success" && scannedParcel && (
        <View style={styles.resultSheet}>
          <View style={styles.successIconWrap}>
            <Feather name="check-circle" size={40} color={COLORS.green} />
          </View>
          <Text style={styles.resultTitle}>Parcel Received!</Text>
          <Text style={styles.resultSubtitle}>
            The parcel has been logged into your hub.
          </Text>

          <View style={styles.parcelInfoCard}>
            <View style={styles.parcelInfoRow}>
              <Text style={styles.parcelInfoLabel}>TRACKING NUMBER</Text>
              <Text style={styles.parcelInfoValue}>{scannedParcel.trackingNumber}</Text>
            </View>
            <View style={styles.parcelInfoDivider} />
            <View style={styles.parcelInfoRow}>
              <Text style={styles.parcelInfoLabel}>RECIPIENT</Text>
              <Text style={styles.parcelInfoValue}>{scannedParcel.recipient}</Text>
            </View>
            <View style={styles.parcelInfoDivider} />
            <View style={styles.parcelInfoRow}>
              <Text style={styles.parcelInfoLabel}>SENDER</Text>
              <Text style={styles.parcelInfoValue}>{scannedParcel.sender}</Text>
            </View>
          </View>

          <TouchableOpacity style={styles.scanAnotherBtn} onPress={handleReset}>
            <MaterialCommunityIcons name="qrcode-scan" size={16} color={COLORS.white} />
            <Text style={styles.scanAnotherText}>Scan Another</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Error Sheet */}
      {scanState === "error" && (
        <View style={styles.resultSheet}>
          <View style={styles.errorIconWrap}>
            <Feather name="alert-circle" size={40} color="#EF4444" />
          </View>
          <Text style={styles.errorTitle}>Scan Failed</Text>
          <Text style={styles.errorSubtitle}>{errorMessage}</Text>

          <TouchableOpacity style={styles.scanAnotherBtn} onPress={handleReset}>
            <MaterialCommunityIcons name="qrcode-scan" size={16} color={COLORS.white} />
            <Text style={styles.scanAnotherText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
            <Text style={styles.doneBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const FRAME_SIZE = 260;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, backgroundColor: COLORS.background, gap: 16 },

  // Header
  header: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.white },
  headerSubtitle: { fontSize: 12, fontWeight: "400", color: "rgba(255,255,255,0.7)", marginTop: 1 },

  // Camera overlay
  overlay: { flex: 1 },
  overlayTop: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  overlayMiddle: { flexDirection: "row", height: FRAME_SIZE },
  overlaySide: { flex: 1, backgroundColor: "rgba(0,0,0,0.6)" },
  overlayBottom: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
  },

  // Scan frame
  scanFrame: {
    width: FRAME_SIZE,
    height: FRAME_SIZE,
    position: "relative",
  },
  corner: {
    position: "absolute",
    width: 32,
    height: 32,
    borderColor: COLORS.primary,
    borderWidth: 3.5,
  },
  cornerTL: { top: 0, left: 0, borderRightWidth: 0, borderBottomWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 0, right: 0, borderLeftWidth: 0, borderBottomWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 0, left: 0, borderRightWidth: 0, borderTopWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 0, right: 0, borderLeftWidth: 0, borderTopWidth: 0, borderBottomRightRadius: 6 },

  processingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    borderRadius: 4,
  },
  processingText: { color: COLORS.white, fontSize: 14, fontWeight: "600" },

  scanInstruction: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
  },
  manualBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  manualBtnText: { color: COLORS.primary, fontSize: 13, fontWeight: "600" },

  // Result sheet (success / error)
  resultSheet: {
    flex: 1,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 16,
  },
  successIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.greenLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  errorIconWrap: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  resultTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  resultSubtitle: { fontSize: 14, fontWeight: "400", color: COLORS.textMuted, textAlign: "center" },
  errorTitle: { fontSize: 22, fontWeight: "800", color: "#EF4444" },
  errorSubtitle: { fontSize: 14, fontWeight: "400", color: COLORS.textMuted, textAlign: "center" },

  parcelInfoCard: {
    width: "100%",
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    gap: 0,
    marginTop: 4,
  },
  parcelInfoRow: { paddingVertical: 10, gap: 4 },
  parcelInfoDivider: { height: 1, backgroundColor: COLORS.border },
  parcelInfoLabel: { fontSize: 10, fontWeight: "700", color: COLORS.textMuted, letterSpacing: 0.5 },
  parcelInfoValue: { fontSize: 15, fontWeight: "700", color: COLORS.text },

  scanAnotherBtn: {
    width: "100%",
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  scanAnotherText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  doneBtn: {
    width: "100%",
    paddingVertical: 12,
    alignItems: "center",
  },
  doneBtnText: { fontSize: 15, fontWeight: "500", color: COLORS.textMuted },

  // Permission screen
  permissionTitle: { fontSize: 20, fontWeight: "800", color: COLORS.text, textAlign: "center" },
  permissionSubtitle: { fontSize: 14, fontWeight: "400", color: COLORS.textMuted, textAlign: "center", lineHeight: 20 },
  permissionBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  permissionBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  cancelTextBtn: { paddingVertical: 8 },
  cancelTextBtnText: { fontSize: 14, fontWeight: "500", color: COLORS.textMuted },
});
