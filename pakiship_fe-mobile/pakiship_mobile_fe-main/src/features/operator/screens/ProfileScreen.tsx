import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Platform,
  Modal,
  KeyboardAvoidingView,
  Image,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../lib/navigation/types";
import { Header } from "../components/Header";
import { COLORS } from "../types/colors";
import { useAuthSession } from "../../context/AuthSessionContext";
import { authApi } from "../../services/authApi";
import { LogoutModal } from "../../shared/components/LogoutModal";
import { apiRequest } from "../../services/api";
import { runtimeConfig } from "../../../lib/config/runtime";

interface InputFieldProps {
  label: string;
  value: string;
  onChangeText?: (text: string) => void;
  icon: React.ReactNode;
  editable?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad";
  isEditing?: boolean;
}

function InputField({
  label,
  value,
  onChangeText,
  icon,
  editable = true,
  keyboardType = "default",
  isEditing = false,
}: InputFieldProps) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={[styles.fieldInner, isEditing && editable && styles.fieldInnerActive]}>
        <View style={styles.fieldIcon}>{icon}</View>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          editable={isEditing && editable}
          keyboardType={keyboardType}
          placeholderTextColor={COLORS.textMuted}
        />
      </View>
    </View>
  );
}

export default function ProfileScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { currentUser, clearCurrentUser } = useAuthSession();
  const insets = useSafeAreaInsets();
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLogoutModal(true);
  }

  // Fetch saved profile picture on mount
  useEffect(() => {
    apiRequest('/pakiship/mobile/operator/profile')
      .then((res: any) => {
        if (res?.profilePicture) setAvatarUri(res.profilePicture);
        if (res?.fullName) setFullName(res.fullName);
        if (res?.email) setEmail(res.email);
        if (res?.phone) setPhone(res.phone);
      })
      .catch(() => {/* silently ignore — use defaults */});
  }, []);
  
  const [activeTab, setActiveTab] = useState<"profile" | "compliance" | "preferences">("profile");
  const [fullName, setFullName] = useState(currentUser?.name || "");
  const [email, setEmail] = useState(currentUser?.email || "");
  const [phone, setPhone] = useState("");
  const [twoFA, setTwoFA] = useState(false);
  const [prefToggles, setPrefToggles] = useState({ email: true, sms: true, parcel: true });
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [docs, setDocs] = useState<{ dti: string | null; permit: string | null; location: string | null }>({
    dti: "verified",
    permit: "verified",
    location: "verified",
  });
  const [refreshingDoc, setRefreshingDoc] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [birthDate, setBirthDate] = useState("06/01/2005");
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [tempMonth, setTempMonth] = useState("06");
  const [tempDay, setTempDay] = useState("01");
  const [tempYear, setTempYear] = useState("2005");
  
  const bottomPad = Platform.OS === "web" ? 34 : insets.bottom + 16;

  async function pickImage(onPicked: (uri: string) => void) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      onPicked(asset.uri); // optimistic local update

      // Upload to backend
      try {
        const formData = new FormData();
        // React Native requires this exact object shape for file uploads
        (formData as any).append("file", {
          uri: asset.uri,
          name: asset.fileName ?? `avatar-${Date.now()}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        });

        // Use raw fetch so we don't set Content-Type (multipart boundary must be auto-set)
        const baseUrl = runtimeConfig.apiBaseUrl.replace(/\/+$/, "");
        const response = await fetch(
          `${baseUrl}/pakiship/mobile/operator/profile/upload-avatar`,
          {
            method: "POST",
            credentials: "include",
            headers: { "Bypass-Tunnel-Reminder": "any" },
            body: formData,
          }
        );

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          throw new Error(err.message || `Upload failed (${response.status})`);
        }

        const res = await response.json();
        if (res?.profilePicture) {
          onPicked(res.profilePicture);
        }
      } catch (err) {
        console.error("Avatar upload failed:", err);
      }
    }
  }

  async function pickDocument(docKey: keyof typeof docs) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setDocs((prev) => ({ ...prev, [docKey]: result.assets[0].uri }));
    }
    setRefreshingDoc(null);
  }

  const tabs: { key: "profile" | "compliance" | "preferences"; label: string }[] = [
    { key: "profile", label: "Profile" },
    { key: "compliance", label: "Compliance" },
    { key: "preferences", label: "Preferences" },
  ];

  return (
    <View style={styles.container}>
      <Header showBack onBackPress={() => navigation.goBack()} />

      {/* Enable 2FA Modal */}
      <Modal visible={show2FAModal} transparent animationType="fade" onRequestClose={() => setShow2FAModal(false)}>
        <View style={styles.centeredOverlay}>
          <View style={styles.dialogBox}>
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Enable 2FA</Text>
              <TouchableOpacity onPress={() => setShow2FAModal(false)} style={styles.dialogClose}>
                <Feather name="x" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>
            <Text style={styles.dialogBody}>
              Two-factor authentication adds an extra layer of security to your account.
            </Text>
            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShow2FAModal(false)} activeOpacity={0.75}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.dialogConfirmBtn}
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setTwoFA(true); setShow2FAModal(false); }}
                activeOpacity={0.85}
              >
                <Text style={styles.dialogConfirmText}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide" onRequestClose={() => setShowPasswordModal(false)}>
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowPasswordModal(false)} />
          <View style={styles.passwordSheet}>
            <View style={styles.dragHandle} />
            <View style={styles.dialogHeader}>
              <Text style={styles.dialogTitle}>Security Update</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)} style={styles.dialogClose}>
                <Feather name="x" size={18} color={COLORS.textSecondary} />
              </TouchableOpacity>
            </View>

            <Text style={styles.pwFieldLabel}>CURRENT PASSWORD</Text>
            <View style={styles.pwInputRow}>
              <TextInput
                style={styles.pwInput}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry={!showCurrent}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity onPress={() => setShowCurrent(v => !v)}>
                <Feather name={showCurrent ? "eye-off" : "eye"} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={styles.pwFieldLabel}>NEW PASSWORD</Text>
            <View style={styles.pwInputRow}>
              <TextInput
                style={styles.pwInput}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry={!showNew}
                placeholderTextColor={COLORS.textMuted}
              />
              <TouchableOpacity onPress={() => setShowNew(v => !v)}>
                <Feather name={showNew ? "eye-off" : "eye"} size={18} color={COLORS.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.dialogActions}>
              <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowPasswordModal(false)} activeOpacity={0.75}>
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.pwUpdateBtn}
                onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setCurrentPassword(""); setNewPassword(""); setShowPasswordModal(false); }}
                activeOpacity={0.85}
              >
                <Text style={styles.dialogConfirmText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      {/* Date Picker Modal — Calendar Grid */}
      <Modal visible={showDatePicker} transparent animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
        <TouchableOpacity style={styles.modalBackdrop} activeOpacity={1} onPress={() => setShowDatePicker(false)} />
        <View style={styles.calendarSheet}>
          <View style={styles.dragHandle} />
          {(() => {
            const months = ["January","February","March","April","May","June","July","August","September","October","November","December"];
            const selMonth = parseInt(tempMonth) - 1;
            const selYear = parseInt(tempYear);
            const selDay = parseInt(tempDay);
            const firstDay = new Date(selYear, selMonth, 1).getDay();
            const daysInMonth = new Date(selYear, selMonth + 1, 0).getDate();
            const prevDays = new Date(selYear, selMonth, 0).getDate();
            const today = new Date();
            const cells: { day: number; cur: boolean }[] = [];
            for (let i = firstDay - 1; i >= 0; i--) cells.push({ day: prevDays - i, cur: false });
            for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, cur: true });
            while (cells.length % 7 !== 0) cells.push({ day: cells.length - daysInMonth - firstDay + 1, cur: false });
            const weeks: typeof cells[] = [];
            for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
            return (
              <>
                <View style={styles.calHeader}>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(selYear, selMonth - 1, 1);
                    setTempMonth(String(d.getMonth() + 1).padStart(2, "0"));
                    setTempYear(String(d.getFullYear()));
                  }}>
                    <Feather name="chevron-left" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                  <Text style={styles.calMonthYear}>{months[selMonth]} {selYear}</Text>
                  <TouchableOpacity onPress={() => {
                    const d = new Date(selYear, selMonth + 1, 1);
                    setTempMonth(String(d.getMonth() + 1).padStart(2, "0"));
                    setTempYear(String(d.getFullYear()));
                  }}>
                    <Feather name="chevron-right" size={20} color={COLORS.text} />
                  </TouchableOpacity>
                </View>
                <View style={styles.calDayNames}>
                  {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
                    <Text key={d} style={styles.calDayName}>{d}</Text>
                  ))}
                </View>
                {weeks.map((week, wi) => (
                  <View key={wi} style={styles.calWeek}>
                    {week.map((cell, ci) => {
                      const isSelected = cell.cur && cell.day === selDay;
                      const isToday = cell.cur && cell.day === today.getDate() && selMonth === today.getMonth() && selYear === today.getFullYear();
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.calDay, isSelected && styles.calDaySelected]}
                          onPress={() => { if (cell.cur) setTempDay(String(cell.day).padStart(2, "0")); }}
                          activeOpacity={cell.cur ? 0.7 : 1}
                        >
                          <Text style={[
                            styles.calDayText,
                            !cell.cur && styles.calDayTextOther,
                            isSelected && styles.calDayTextSelected,
                            isToday && !isSelected && styles.calDayTextToday,
                          ]}>{cell.day}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ))}
                <View style={styles.calFooter}>
                  <TouchableOpacity onPress={() => { setTempDay(""); setTempMonth(""); setTempYear(""); }}>
                    <Text style={styles.calFooterBtn}>Clear</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => {
                    const t = new Date();
                    setTempMonth(String(t.getMonth() + 1).padStart(2, "0"));
                    setTempDay(String(t.getDate()).padStart(2, "0"));
                    setTempYear(String(t.getFullYear()));
                  }}>
                    <Text style={styles.calFooterBtn}>Today</Text>
                  </TouchableOpacity>
                </View>
                <View style={styles.dialogActions}>
                  <TouchableOpacity style={styles.dialogCancelBtn} onPress={() => setShowDatePicker(false)} activeOpacity={0.75}>
                    <Text style={styles.dialogCancelText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.dialogConfirmBtn}
                    onPress={() => {
                      setBirthDate(`${tempMonth.padStart(2,"0")}/${tempDay.padStart(2,"0")}/${tempYear}`);
                      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      setShowDatePicker(false);
                    }}
                    activeOpacity={0.85}
                  >
                    <Text style={styles.dialogConfirmText}>Confirm</Text>
                  </TouchableOpacity>
                </View>
              </>
            );
          })()}
        </View>
      </Modal>
      <ScrollView
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: bottomPad }]}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              {avatarUri
                ? <Image source={{ uri: avatarUri }} style={styles.avatarImg} />
                : <Text style={styles.avatarText}>{fullName ? fullName.charAt(0).toUpperCase() : "OP"}</Text>
              }
            </View>
            <TouchableOpacity style={styles.cameraBadge} onPress={() => pickImage(setAvatarUri)}>
              <Feather name="camera" size={12} color={COLORS.white} />
            </TouchableOpacity>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{fullName}</Text>
            <Text style={styles.userRole}>Operator Account</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {tabs.map((t) => (
            <TouchableOpacity
              key={t.key}
              style={[styles.tabBtn, activeTab === t.key && styles.tabBtnActive]}
              onPress={() => {
                Haptics.selectionAsync();
                setActiveTab(t.key);
              }}
            >
              <Text
                style={[
                  styles.tabBtnText,
                  activeTab === t.key && styles.tabBtnTextActive,
                ]}
              >
                {t.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === "profile" && (
          <View style={styles.section}>
            <View style={styles.sectionTitleRow}>
              <Text style={styles.sectionTitle}>Personal Details</Text>
              <TouchableOpacity
                style={[styles.editBtn, isEditing && styles.editBtnActive]}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsEditing(v => !v); }}
                activeOpacity={0.8}
              >
                <Feather name="edit-2" size={16} color={isEditing ? COLORS.red : COLORS.primary} />
              </TouchableOpacity>
            </View>
            <InputField
              label="FULL NAME"
              value={fullName}
              onChangeText={setFullName}
              icon={<Feather name="user" size={16} color={COLORS.primary} />}
              editable={true}
              isEditing={isEditing}
            />
            <InputField
              label="EMAIL ADDRESS"
              value={email}
              onChangeText={setEmail}
              icon={<Feather name="mail" size={16} color={COLORS.primary} />}
              editable={true}
              keyboardType="email-address"
              isEditing={isEditing}
            />
            <InputField
              label="PHONE NUMBER"
              value={phone}
              onChangeText={setPhone}
              icon={<Feather name="phone" size={16} color={COLORS.primary} />}
              keyboardType="phone-pad"
              editable={true}
              isEditing={isEditing}
            />

            {/* Birth Date — calendar picker */}
            <View style={styles.fieldWrap}>
              <Text style={styles.fieldLabel}>BIRTH DATE</Text>
              <TouchableOpacity
                style={[styles.fieldInner, isEditing && styles.fieldInnerActive]}
                onPress={() => { if (isEditing) { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowDatePicker(true); } }}
                activeOpacity={isEditing ? 0.7 : 1}
              >
                <View style={styles.fieldIcon}>
                  <Feather name="calendar" size={16} color={COLORS.primary} />
                </View>
                <Text style={[styles.fieldInput, { paddingTop: 2 }]}>{birthDate}</Text>
                {isEditing && <Feather name="calendar" size={16} color={COLORS.text} />}
              </TouchableOpacity>
            </View>

            <InputField
              label="HUB LOCATION"
              value="7-Eleven, España Blvd, Sampaloc, Manila"
              icon={<Feather name="briefcase" size={16} color={COLORS.primary} />}
              editable={true}
              isEditing={isEditing}
            />
            <InputField
              label="HUB ADDRESS"
              value="Espana Blvd., Sampaloc Manila"
              icon={<Feather name="map-pin" size={16} color={COLORS.primary} />}
              editable={true}
              isEditing={isEditing}
            />
            <View style={styles.passwordLabelRow}>
              <Text style={styles.fieldLabel}>PASSWORD</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(true)}>
                <Text style={styles.resetPasswordText}>Reset Password</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.fieldInner}>
              <View style={styles.fieldIcon}>
                <Feather name="lock" size={16} color={COLORS.primary} />
              </View>
              <Text style={styles.fieldInput}>••••••••••</Text>
            </View>
          </View>
        )}

        {activeTab === "compliance" && (
          <View style={styles.section}>
            <View style={styles.idSectionHeader}>
              <View style={styles.idIconWrap}>
                <Feather name="shield" size={18} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Business Documents</Text>
            </View>

            {([
              { key: "dti", label: "DTI / SEC REGISTRATION", icon: "briefcase", fileType: "Image" },
              { key: "permit", label: "BUSINESS PERMIT (LGU)", icon: "file-text", fileType: "Image" },
              { key: "location", label: "PROOF OF LOCATION", icon: "file", fileType: "PDF" },
            ] as const).map((doc) => (
              <View key={doc.key} style={styles.docGroup}>
                <Text style={styles.fieldLabel}>{doc.label}</Text>
                <View style={styles.docRow}>
                  <View style={styles.docIconWrap}>
                    <Feather name={doc.icon} size={18} color={COLORS.white} />
                  </View>
                  <View style={styles.docInfo}>
                    <View style={styles.docVerifiedRow}>
                      <Text style={styles.docVerifiedText}>Document Verified</Text>
                      <Feather name="check-circle" size={14} color={COLORS.primary} />
                    </View>
                    <Text style={styles.docStoredAs}>Stored as {doc.fileType}</Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.docRefreshBtn, refreshingDoc === doc.key && styles.docRefreshBtnActive]}
                    onPressIn={() => setRefreshingDoc(doc.key)}
                    onPressOut={() => setRefreshingDoc(null)}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); pickDocument(doc.key); }}
                    activeOpacity={0.7}
                  >
                    <Feather name="refresh-cw" size={16} color={refreshingDoc === doc.key ? COLORS.white : COLORS.primary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.docRemoveBtn}
                    onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setDocs((prev) => ({ ...prev, [doc.key]: null })); }}
                    activeOpacity={0.7}
                  >
                    <Feather name="x" size={16} color={COLORS.red} />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        {activeTab === "preferences" && (
          <View style={styles.section}>
            {/* Header */}
            <View style={styles.prefHeader}>
              <View style={styles.prefIconWrap}>
                <Feather name="bell" size={26} color={COLORS.primary} />
              </View>
              <Text style={styles.sectionTitle}>Account Preferences</Text>
            </View>

            {/* Items card */}
            <View style={styles.prefCard}>
              {[
                { icon: "mail", label: "Email Notifications", sub: "Receive parcel processing updates", key: "email" },
                { icon: "message-square", label: "SMS Alerts", sub: "Get real-time hub notifications", key: "sms" },
                { icon: "package", label: "Parcel Alerts", sub: "Alert when new parcels arrive", key: "parcel" },
              ].map((item, idx, arr) => (
                <View key={item.key} style={[styles.prefRow, idx < arr.length - 1 && styles.prefRowBorder]}>
                  <View style={styles.prefRowLeft}>
                    <Feather name={item.icon as any} size={20} color={COLORS.primary} />
                    <View style={styles.prefRowText}>
                      <Text style={styles.prefRowLabel}>{item.label}</Text>
                      <Text style={styles.prefRowSub}>{item.sub}</Text>
                    </View>
                  </View>
                  <Switch
                    value={prefToggles[item.key as keyof typeof prefToggles]}
                    onValueChange={(v) => {
                      Haptics.selectionAsync();
                      setPrefToggles((prev) => ({ ...prev, [item.key]: v }));
                    }}
                    trackColor={{ false: COLORS.border, true: COLORS.primary }}
                    thumbColor={COLORS.white}
                  />
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Bar */}
      <View
        style={[
          styles.bottomBar,
          {
            paddingBottom: Platform.OS === "web" ? 34 : insets.bottom + 8,
          },
        ]}
      >
        <TouchableOpacity
          style={styles.twoFARow}
          onPress={() => {
            if (!twoFA) { setShow2FAModal(true); } else { Haptics.selectionAsync(); setTwoFA(false); }
          }}
          activeOpacity={0.8}
        >
          <Feather name="shield" size={16} color={COLORS.primary} />
          <Text style={styles.twoFAText}>2FA Security</Text>
          <Switch
            value={twoFA}
            onValueChange={(v) => { if (v) { setShow2FAModal(true); } else { Haptics.selectionAsync(); setTwoFA(false); } }}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor={COLORS.white}
          />
        </TouchableOpacity>

        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.passwordBtn}
            onPress={() => setShowPasswordModal(true)}
          >
            <Feather name="lock" size={16} color={COLORS.text} />
            <Text style={styles.passwordBtnText}>Password</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={() => { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); navigation.goBack(); }}
            activeOpacity={0.85}
          >
            <Feather name="save" size={16} color={COLORS.white} />
            <Text style={styles.saveBtnText}>SAVE ALL</Text>
          </TouchableOpacity>
        </View>
      </View>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          try {
            await authApi.logout();
          } catch (e) {
            console.log('Logout failed:', e);
          } finally {
            clearCurrentUser();
            setShowLogoutModal(false);
            navigation.reset({ index: 0, routes: [{ name: "Login" }] });
          }
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scroll: {
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  pageTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: COLORS.text,
    textAlign: "center",
  },
  avatarSection: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    backgroundColor: COLORS.cardBg,
    padding: 16,
    borderRadius: 16,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  avatarWrap: {
    position: "relative",
  },
  avatar: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.white,
  },
  avatarImg: {
    width: 64,
    height: 64,
    borderRadius: 16,
  },
  cameraBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  userInfo: {
    gap: 4,
  },
  userName: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  userRole: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.primary,
  },
  tabsRow: {
    flexDirection: "row",
    backgroundColor: COLORS.primaryLight,
    borderRadius: 14,
    padding: 4,
    gap: 2,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  tabBtnActive: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 10,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.primary,
    opacity: 0.5,
  },
  tabBtnTextActive: {
    fontWeight: "800",
    color: COLORS.primary,
    opacity: 1,
  },
  section: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    gap: 14,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 1,
    shadowRadius: 6,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 4,
  },
  sectionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  editBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  editBtnActive: {
    backgroundColor: "#FEE2E2",
  },
  fieldWrap: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.primary,
    letterSpacing: 0.8,
  },
  fieldInner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
    borderWidth: 1.5,
    borderColor: "transparent",
  },
  fieldInnerActive: {
    borderColor: COLORS.primary,
  },
  fieldIcon: {
    width: 20,
    alignItems: "center",
  },
  fieldInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: "400",
    color: COLORS.text,
  },
  passwordLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  resetPasswordText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },

  /* Calendar */
  calendarSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: 36,
    gap: 4,
  },
  calHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  calMonthYear: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
  },
  calDayNames: {
    flexDirection: "row",
    marginBottom: 4,
  },
  calDayName: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.textMuted,
    paddingVertical: 4,
  },
  calWeek: {
    flexDirection: "row",
  },
  calDay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
    borderRadius: 8,
  },
  calDaySelected: {
    backgroundColor: COLORS.blue,
    borderRadius: 8,
  },
  calDayText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  calDayTextOther: {
    color: COLORS.textMuted,
  },
  calDayTextSelected: {
    color: COLORS.white,
    fontWeight: "800",
  },
  calDayTextToday: {
    color: COLORS.primary,
    fontWeight: "800",
  },
  calFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    marginTop: 8,
    marginBottom: 4,
  },
  calFooterBtn: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  emptyTabState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 12,
  },
  emptyTabText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textMuted,
  },
  bottomBar: {
    backgroundColor: COLORS.cardBg,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 16,
    gap: 12,
  },
  twoFARow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  twoFAText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primary,
  },
  bottomActions: {
    flexDirection: "row",
    gap: 12,
  },
  passwordBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  passwordBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  logoutBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: COLORS.red,
  },
  logoutBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.red,
  },
  saveBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 14,
  },
  saveBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 0.5,
  },

  /* ID & Schedule */
  idSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 4,
  },
  idIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  idSectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
  },
  idSectionSubtitle: {
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.textSecondary,
    marginTop: 2,
    flexShrink: 1,
    flexWrap: "wrap",
  },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    borderRadius: 12,
    paddingVertical: 24,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryLight,
  },
  uploadText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },
  uploadPreview: {
    width: "100%",
    height: 120,
    borderRadius: 10,
  },
  scheduleBox: {
    backgroundColor: COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  scheduleLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  scheduleValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
  },

  /* Compliance */
  docGroup: { gap: 6 },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
  },
  docIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  docInfo: { flex: 1, gap: 2 },
  docVerifiedRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  docVerifiedText: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  docStoredAs: { fontSize: 11, fontWeight: "400", color: COLORS.textSecondary },
  docRefreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cardBg,
  },
  docRefreshBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  docRemoveBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: COLORS.redLight,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.cardBg,
  },

  /* Preferences */
  prefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    marginBottom: 4,
  },
  prefIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  prefCard: {
    backgroundColor: COLORS.background,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 4,
  },
  prefRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
  },
  prefRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  prefRowLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    flex: 1,
  },
  prefRowText: {
    flex: 1,
    gap: 3,
  },
  prefRowLabel: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  prefRowSub: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.textSecondary,
  },

  /* 2FA & Password Modals */
  centeredOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  dialogBox: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 20,
    padding: 24,
    width: "100%",
    gap: 14,
  },
  dialogHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
  },
  dialogClose: {
    width: 30,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  dialogBody: {
    fontSize: 13,
    fontWeight: "400",
    color: COLORS.textSecondary,
    lineHeight: 20,
  },
  dialogActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 4,
  },
  dialogCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  dialogCancelText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.textSecondary,
  },
  dialogConfirmBtn: {
    flex: 1,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
  dialogConfirmText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  passwordSheet: {
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingBottom: 36,
    paddingTop: 12,
    gap: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    alignSelf: "center",
    marginBottom: 4,
  },
  pwFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: COLORS.textMuted,
    letterSpacing: 0.5,
  },
  pwInputRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.background,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 10,
  },
  pwInput: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    color: COLORS.text,
  },
  pwUpdateBtn: {
    flex: 1,
    backgroundColor: COLORS.text,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: "center",
  },
});
