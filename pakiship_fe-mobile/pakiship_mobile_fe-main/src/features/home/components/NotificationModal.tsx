import React from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, StyleSheet, Pressable, Dimensions } from 'react-native';
import { X, Package, Gift, ShieldAlert, Clock } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiRequest } from '@/features/services/api';

interface NotificationItem {
  id: string;
  title: string;
  desc: string;
  time: string;
  type: 'delivery' | 'promo' | 'security';
}

const NOTIFICATIONS: NotificationItem[] = [
  { 
    id: '1', 
    title: 'Package In Transit', 
    desc: 'Your parcel PKS-2024-001 is on its way to Makati City.', 
    time: '2 mins ago', 
    type: 'delivery' 
  },
  { 
    id: '2', 
    title: 'Weekend Flash Sale!', 
    desc: 'Get 20% off on all inter-city deliveries this Saturday.', 
    time: '1 hour ago', 
    type: 'promo' 
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function NotificationModal({ isOpen, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [loading, setLoading] = React.useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/pakiship/mobile/customer/notifications');
      setNotifications(res.notifications || []);
      
      // Mark all as read when opening
      await apiRequest('/pakiship/mobile/customer/notifications/read-all', { method: 'PATCH' });
    } catch (error) {
      console.error('Failed to fetch notifications:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);
  
  const getIcon = (type: string) => {
    switch (type) {
      case 'delivery': return { icon: Package, color: '#39B5A8', bg: '#F0F9F8' };
      case 'promo': return { icon: Gift, color: '#A855F7', bg: '#F3E8FF' };
      case 'security': return { icon: ShieldAlert, color: '#F59E0B', bg: '#FEF3C7' };
      default: return { icon: Package, color: '#9CA3AF', bg: '#F3F4F6' };
    }
  };

  return (
    <Modal visible={isOpen} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.overlay}>
        {/* Backdrop Pressable */}
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        
        {/* Modal Box - Positioned Absolute for Top-Right placement */}
        <View style={[styles.modalContainer, { top: insets.top + 60 }]}>
          <View style={styles.header}>
            <Text style={styles.title}>NOTIFICATIONS ({notifications.length})</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {notifications.map((item) => {
              const { icon: Icon, color, bg } = getIcon(item.type);
              
              return (
                <TouchableOpacity key={item.id} style={styles.card}>
                  <View style={[styles.iconBox, { backgroundColor: bg }]}>
                    <Icon size={20} color={color} />
                  </View>
                  <View style={styles.content}>
                    <Text style={styles.itemTitle}>{item.title}</Text>
                    <Text style={styles.itemDesc}>{item.desc}</Text>
                    <View style={styles.timeRow}>
                       <Clock size={10} color="#9CA3AF" />
                       <Text style={styles.itemTime}>{item.time}</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
            {notifications.length === 0 && !loading && (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No notifications yet.</Text>
              </View>
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
    // Premium Shadow
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
    paddingVertical: 40,
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#9CA3AF',
  },
});
