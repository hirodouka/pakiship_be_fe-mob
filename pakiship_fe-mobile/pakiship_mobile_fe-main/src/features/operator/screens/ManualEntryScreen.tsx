import React, { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import * as Haptics from "expo-haptics";
import { COLORS } from "../types/colors";

export default function ManualEntryScreen() {
  const navigation = useNavigation();
  const [trackingNumber, setTrackingNumber] = useState("");
  const inputRef = useRef<TextInput>(null);

  function handleConfirm() {
    if (!trackingNumber.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  }

  function handleCancel() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    navigation.goBack();
  }

  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Tap-outside overlay to dismiss */}
      <Pressable style={styles.overlay} onPress={handleCancel} />

      <View style={[styles.container, { paddingBottom: insets.bottom + 16 }]}>
        {/* Drag handle */}
        <View style={styles.handle} />

        {/* Header row */}
        <View style={styles.headerRow}>
          <View style={styles.headerText}>
            <Text style={styles.title}>Manual Entry</Text>
            <Text style={styles.subtitle}>Enter the tracking number below</Text>
          </View>
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={handleCancel}
            activeOpacity={0.7}
          >
            <Feather name="x" size={18} color={COLORS.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* Input */}
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => inputRef.current?.focus()}
          style={styles.inputWrapper}
        >
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="e.g. PKS-20260519-F62D36DD"
            placeholderTextColor={COLORS.textMuted}
            value={trackingNumber}
            onChangeText={setTrackingNumber}
            autoCorrect={false}
            autoCapitalize="characters"
            returnKeyType="done"
            onSubmitEditing={handleConfirm}
          />
        </TouchableOpacity>

        {/* Confirm button */}
        <TouchableOpacity
          style={[
            styles.confirmBtn,
            !trackingNumber.trim() && styles.confirmBtnDisabled,
          ]}
          onPress={handleConfirm}
          activeOpacity={0.85}
        >
          <Text style={styles.confirmText}>Confirm Entry</Text>
        </TouchableOpacity>

        {/* Cancel link */}
        <TouchableOpacity onPress={handleCancel} activeOpacity={0.7}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 12,
    gap: 16,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 8,
  },

  /* Header */
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textSecondary,
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 12,
  },

  /* Input */
  inputWrapper: {
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    overflow: "hidden",
  },
  input: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.text,
  },

  /* Confirm */
  confirmBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },

  /* Cancel */
  cancelText: {
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.textSecondary,
    textAlign: "center",
  },
});
