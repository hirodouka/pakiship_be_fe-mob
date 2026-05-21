import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
  Text,
  Modal,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { Package, Gift, ShieldAlert, Clock, BellOff, CheckCheck } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../types/colors";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "../../../lib/navigation/types";
import * as Haptics from "expo-haptics";
import { useAuthSession } from "../../context/AuthSessionContext";
import { authApi } from "../../services/authApi";
import { LogoutModal } from "../../shared/components/LogoutModal";
import { apiRequest } from "../../services/api";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  time: string;
  isRead: boolean;
}

function getNotifStyle(type: string): { color: string; bg: string; Icon: any } {
  switch (type) {
    case "delivery": return { color: COLORS.primary, bg: COLORS.primaryLight, Icon: Package };
    case "promo":    return { color: "#A855F7", bg: "#F3E8FF", Icon: Gift };
    case "system":
    case "security": return { color: COLORS.orange, bg: COLORS.orangeLight, Icon: ShieldAlert };
    default:         return { color: COLORS.primary, bg: COLORS.primaryLight, Icon: Package };
  }
}

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
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const res = await apiRequest("/pakiship/mobile/operator/notifications");
      setNotifications(res.notifications ?? []);
    } catch (e) {
      console.error("[Header] failed to fetch notifications:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  async function handleMarkAllRead() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      await apiRequest("/pakiship/mobile/operator/notifications/read-all", { method: "PATCH" });
    } catch (e) {
      console.error("[Header] mark all read failed:", e);
    }
  }

  function handleBellPress() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setNotifOpen(true);
    fetchNotifications();
  }

  // Refresh unread count on mount
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

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

      {showBack && <Text style={styles.headerTitle}>Profile Settings</Text>}

      <View style={styles.right}>
        {!showBack && (
          <TouchableOpacity style={styles.circleBtn} onPress={handleBellPress}>
            <Feather name="bell" size={17} color={COLORS.primary} />
            {unreadCount > 0 && <View style={styles.notifDot} />}
          </TouchableOpacity>
        )}

        {!showBack && (
          <TouchableOpacity
            ref={helpBtnRef}
            style={styles.circleBtn}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (onHelpMeasure) {
                helpBtnRef.current?.measureInWindow((x: number, y: number, width: number, height: number) => {
                  onHelpMeasure({ x, y, width, height });
                });
              }
              if (onHelpPress) onHelpPress();
            }}
          >
            <Feather name="help-circle" size={17} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {!showBack && (
          <TouchableOpacity
            style={styles.profileBtn}
            onPress={() => navigation.navigate("OperatorProfile")}
          >
            <Feather name="user" size={17} color={COLORS.primary} />
          </TouchableOpacity>
        )}

        {!showBack && (
          <TouchableOpacity style={styles.logoutBtn} onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            setShowLogoutModal(true);
          }} activeOpacity={0.7}>
            <Feather name="log-out" size={19} color={COLORS.red} />
          </TouchableOpacity>
        )}
      </View>

      {/* Notification Modal — matches customer NotificationModal style */}
      <Modal
        visible={notifOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setNotifOpen(false)}
      >
        <View style={styles.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setNotifOpen(false)} />

          <View style={[styles.modalContainer, { top: (Platform.OS === "web" ? 67 : insets.top) + 60 }]}>
            {/* Header row */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                NOTIFICATIONS{unreadCount > 0 ? ` (${unreadCount})` : ""}
              </Text>
              <View style={styles.modalHeaderRight}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
                    <CheckCheck size={14} color={COLORS.primary} />
                    <Text style={styles.markAllText}>Mark all read</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setNotifOpen(false)} style={styles.closeBtn}>
                  <Feather name="x" size={18} color={COLORS.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            {/* List */}
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {loading ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                  style={{ marginVertical: 40 }}
                />
              ) : notifications.length === 0 ? (
                <View style={styles.emptyState}>
                  <BellOff size={40} color="#E2E8F0" />
                  <Text style={styles.emptyText}>No notifications yet</Text>
                </View>
              ) : (
                notifications.map((item) => {
                  const { color, bg, Icon } = getNotifStyle(item.type);
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={styles.card}
                      activeOpacity={0.75}
                      onPress={() => {
                        if (!item.isRead) {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          setNotifications((prev) =>
                            prev.map((n) => n.id === item.id ? { ...n, isRead: true } : n)
                          );
                        }
                      }}
                    >
                      <View style={[styles.iconBox, { backgroundColor: bg }]}>
                        <Icon size={20} color={color} />
                      </View>
                      <View style={styles.content}>
                        <Text style={[styles.itemTitle, item.isRead && styles.itemTitleRead]}>
                          {item.title}
                        </Text>
                        <Text style={styles.itemDesc}>{item.message}</Text>
                        <View style={styles.timeRow}>
                          <Clock size={10} color="#9CA3AF" />
                          <Text style={styles.itemTime}>{item.time}</Text>
                        </View>
                      </View>
                      {!item.isRead && <View style={styles.unreadDot} />}
                    </TouchableOpacity>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <LogoutModal
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          try {
            await authApi.logout();
          } catch (e) {
            console.log("Logout failed:", e);
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
  left: { flexDirection: "row", alignItems: "center", zIndex: 10 },
  logo: { width: 90, height: 36 },
  backBtn: { padding: 4 },
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
  right: { flexDirection: "row", alignItems: "center", gap: 6, zIndex: 10 },
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
  logoutBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
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

  // Modal overlay
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)" },

  // Modal container — matches customer NotificationModal exactly
  modalContainer: {
    position: "absolute",
    right: 14,
    left: 14,
    backgroundColor: "#fff",
    borderRadius: 28,
    padding: 22,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#041614",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  modalHeaderRight: { flexDirection: "row", alignItems: "center", gap: 10 },
  markAllBtn: { flexDirection: "row", alignItems: "center", gap: 4 },
  markAllText: { fontSize: 12, fontWeight: "700", color: COLORS.primary },
  closeBtn: { padding: 4 },

  list: { maxHeight: 420 },

  // Notification card — matches customer style
  card: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 20,
    alignItems: "flex-start",
  },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  content: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: "900", color: "#041614", marginBottom: 2 },
  itemTitleRead: { fontWeight: "600", color: COLORS.textSecondary },
  itemDesc: { fontSize: 12, fontWeight: "600", color: "#6B7280", lineHeight: 18, marginBottom: 6 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  itemTime: { fontSize: 11, fontWeight: "800", color: "#9CA3AF" },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 6,
    flexShrink: 0,
  },

  // Empty state
  emptyState: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { fontSize: 13, fontWeight: "700", color: "#9CA3AF", marginTop: 12 },
});
