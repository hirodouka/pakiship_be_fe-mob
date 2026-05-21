import React, { useEffect, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Pressable, Dimensions, ActivityIndicator } from 'react-native';
import { X, Package, Gift, ShieldAlert, Clock, BellOff } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '../services/api';

interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  type: 'delivery' | 'promo' | 'system';
  isRead: boolean;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationModal({ isOpen, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  
  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/pakiship/mobile/customer/notifications');
      setNotifications(res.notifications || []);
      
      // Mark all as read if there are unread notifications
      if ((res.notifications || []).some((n: any) => !n.isRead)) {
        await apiRequest('/pakiship/mobile/customer/notifications/read-all', { method: 'PATCH' });
      }
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'delivery': return { icon: Package, color: '#39B5A8', bg: '#F0F9F8' };
      case 'promo': return { icon: Gift, color: '#A855F7', bg: '#F3E8FF' };
      case 'system': return { icon: ShieldAlert, color: '#F59E0B', bg: '#FEF3C7' };
      default: return { icon: Package, color: '#9CA3AF', bg: '#F3F4F6' };
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        <View style={[styles.modalContainer, { top: insets.top + 60 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>NOTIFICATIONS ({notifications.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {loading ? (
              <ActivityIndicator size="small" color="#39B5A8" style={{ marginVertical: 40 }} />
            ) : notifications.length === 0 ? (
              <View style={styles.emptyState}>
                <BellOff size={40} color="#E2E8F0" />
                <Text style={styles.emptyText}>No notifications yet</Text>
              </View>
            ) : (
              notifications.map((item) => {
                const { icon: Icon, color, bg } = getIcon(item.type);
                
                return (
                  <TouchableOpacity key={item.id} style={styles.card}>
                    <View style={[styles.iconBox, { backgroundColor: bg }]}>
                      <Icon size={20} color={color} />
                    </View>
                    <View style={styles.content}>
                      <Text style={styles.itemTitle}>{item.title}</Text>
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
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.3)', 
  },
  modalContainer: {
    position: 'absolute',
    right: 16,
    width: Dimensions.get('window').width * 0.82,
    maxWidth: 340, 
    backgroundColor: '#fff', 
    borderRadius: 28, 
    padding: 22,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  header: {
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 24,
  },
  title: {
    fontSize: 14, 
    fontWeight: '900', 
    color: '#041614', 
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  closeBtn: {
    padding: 4,
  },
  list: {
    maxHeight: 450,
  },
  card: {
    flexDirection: 'row', 
    gap: 14, 
    marginBottom: 24,
  },
  iconBox: {
    width: 46, 
    height: 46, 
    borderRadius: 16, 
    alignItems: 'center', 
    justifyContent: 'center',
  },
  content: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 15, 
    fontWeight: '900', 
    color: '#041614', 
    marginBottom: 2,
  },
  itemDesc: {
    fontSize: 12, 
    fontWeight: '600', 
    color: '#6B7280', 
    lineHeight: 18, 
    marginBottom: 6,
  },
  timeRow: {
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 5,
  },
  itemTime: {
    fontSize: 11, 
    fontWeight: '800', 
    color: '#9CA3AF',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginTop: 12,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#39B5A8',
    marginTop: 6,
  },
});
