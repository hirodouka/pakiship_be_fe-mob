import React, { useState, useRef } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Text,
  Modal,
  TouchableWithoutFeedback,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../types/colors";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../lib/navigation/types";
import * as Haptics from "expo-haptics";
import { useAuthSession } from "../../context/AuthSessionContext";
import { authApi } from "../../services/authApi";
import { LogoutModal } from "../../shared/components/LogoutModal";

interface Notification {
  id: string;
  title: string;
  body: string;
  time: string;
  icon: keyof typeof Feather.glyphMap;
  iconColor: string;
  iconBg: string;
  read: boolean;
}

const INITIAL_NOTIFICATIONS: Notification[] = [
  {
    id: "1",
    title: "New Parcel Arrived",
    body: "PKS-2026-001240 has arrived at your hub.",
    time: "2 mins ago",
    icon: "package",
    iconColor: COLORS.primary,
    iconBg: COLORS.primaryLight,
    read: false,
  },
  {
    id: "2",
    title: "Pickup Completed",
    body: "Maria Santos picked up PKS-2026-001189.",
    time: "15 mins ago",
    icon: "check-circle",
    iconColor: COLORS.green,
    iconBg: COLORS.greenLight,
    read: false,
  },
  {
    id: "3",
    title: "Storage Alert",
    body: "Storage section B is at 90% capacity.",
    time: "1 hour ago",
    icon: "alert-triangle",
    iconColor: COLORS.orange,
    iconBg: COLORS.orangeLight,
    read: true,
  },
];

interface HeaderProps {
  showBack?: boolean;
  onBackPress?: () => void;
  onHelpPress?: () => void;
  onHelpMeasure?: (rect: { x: number; y: number; width: number; height: number }) => void;
}

export function Header({ showBack, onBackPress, onHelpPress, onHelpMeasure }: HeaderProps) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { clearCurrentUser } = useAuthSession();
  const helpBtnRef = useRef<any>(null);
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const unreadCount = notifications.filter((n) => !n.read).length;

  function handleLogout() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setShowLogoutModal(true);
  }

  function handleMarkAllRead() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function handleBellPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifOpen(true);
  }

  return (
    <View style={[styles.container, { paddingTop: topPad + 10 }]}>
      <View style={styles.left}>
        {showBack ? (
          <TouchableOpacity
            onPress={onBackPress || (() => navigation.goBack())}
            style={styles.backBtn}
          >
            <Feather name="arrow-left" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        ) : (
          <Image
            source={require("../../../assets/pakiship-logo.png")}
            style={styles.logo}
            resizeMode="contain"
          />
        )}
      </View>
      {showBack && (
        <Text style={styles.headerTitle}>Profile Settings</Text>
      )}

      <View style={styles.right}>
        {/* Bell with notification dot */}
        {!showBack && <TouchableOpacity style={styles.circleBtn} onPress={handleBellPress}>
          <Feather name="bell" size={17} color={COLORS.primary} />
          {unreadCount > 0 && <View style={styles.notifDot} />}
        </TouchableOpacity>}

        {/* Help */}
        {!showBack && <TouchableOpacity
          ref={helpBtnRef}
          style={styles.circleBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            if (onHelpMeasure) {
              helpBtnRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                onHelpMeasure({ x, y, width, height });
              });
            }
            if (onHelpPress) {
              onHelpPress();
            }
          }}
        >
          <Feather name="help-circle" size={17} color={COLORS.primary} />
        </TouchableOpacity>}

        {/* Profile */}
        {!showBack && <TouchableOpacity
          style={styles.profileBtn}
          onPress={() => navigation.navigate("OperatorProfile")}
        >
          <Feather name="user" size={17} color={COLORS.primary} />
        </TouchableOpacity>}

        {/* Logout */}
        {!showBack && <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.7}>
          <Feather name="log-out" size={19} color={COLORS.red} />
        </TouchableOpacity>}
      </View>

      {/* Notification Dropdown */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setNotifOpen(false)}
      >
        <TouchableWithoutFeedback onPress={() => setNotifOpen(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>

        <View style={styles.dropdown}>
          {/* Dropdown header */}
          <View style={styles.dropdownHeader}>
            <Text style={styles.dropdownTitle}>
              NOTIFICATIONS {unreadCount > 0 ? `(${unreadCount})` : ""}
            </Text>
            {unreadCount > 0 && (
              <TouchableOpacity onPress={handleMarkAllRead}>
                <Text style={styles.markAllText}>Mark all read</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Notification items */}
          {notifications.map((n) => (
            <TouchableOpacity
              key={n.id}
              style={[styles.notifItem, n.read && styles.notifItemRead]}
              onPress={() => {
                if (!n.read) {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setNotifications((prev) => prev.map((item) => item.id === n.id ? { ...item, read: true } : item));
                }
              }}
              activeOpacity={0.75}
            >
              <View style={[styles.notifIconWrap, { backgroundColor: n.iconBg }]}>
                <Feather name={n.icon} size={16} color={n.iconColor} />
              </View>
              <View style={styles.notifContent}>
                <Text style={[styles.notifTitle, n.read && styles.notifTitleRead]}>
                  {n.title}
                </Text>
                <Text style={styles.notifBody}>{n.body}</Text>
                <Text style={styles.notifTime}>{n.time}</Text>
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </Modal>

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
    backgroundColor: COLORS.cardBg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingBottom: 10,
  },
  left: {
    flexDirection: "row",
    alignItems: "center",
    zIndex: 10,
  },
  logo: {
    width: 90,
    height: 36,
    marginLeft: 0,
  },
  backBtn: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.text,
    position: "absolute",
    left: 0,
    right: 0,
    textAlign: "center",
    bottom: 10,
  },
  right: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    zIndex: 10,
  },
  circleBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    backgroundColor: COLORS.cardBg,
    alignItems: "center",
    justifyContent: "center",
  },
  profileBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  logoutBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  notifDot: {
    position: "absolute",
    top: 5,
    right: 5,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.red,
    borderWidth: 1,
    borderColor: COLORS.white,
  },

  /* Modal overlay */
  modalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.15)",
  },

  /* Dropdown panel */
  dropdown: {
    position: "absolute",
    top: Platform.OS === "web" ? 77 : 100,
    right: 14,
    left: 14,
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 16,
    gap: 12,
    shadowColor: COLORS.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  dropdownTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.text,
    letterSpacing: 0.3,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primary,
  },

  /* Notification item */
  notifItem: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  notifItemRead: {
    opacity: 0.5,
  },
  notifIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  notifContent: {
    flex: 1,
    gap: 2,
  },
  notifTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.text,
  },
  notifTitleRead: {
    fontWeight: "600",
  },
  notifBody: {
    fontSize: 12,
    fontWeight: "400",
    color: COLORS.textSecondary,
  },
  notifTime: {
    fontSize: 11,
    fontWeight: "400",
    color: COLORS.textMuted,
    marginTop: 2,
  },
});
