import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

const palette = {
  card: '#FFFFFF',
  text: '#041614',
  subtext: '#6B7A77',
  primary: '#39B5A8',
  danger: '#EF4444',
  dangerSoft: '#FEF2F2',
};

interface LogoutModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function LogoutModal({ visible, onClose, onConfirm }: LogoutModalProps) {
  return (
    <Modal transparent visible={visible} animationType="fade">
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalBackdrop} onPress={onClose} />
        <View style={styles.modalCard}>
          <View style={styles.logoutIconWrap}>
            <MaterialCommunityIcons name="logout" size={32} color={palette.danger} />
          </View>
          <Text style={styles.modalTitle}>Sign Out?</Text>
          <Text style={styles.modalBody}>Are you sure you want to return to the login screen?</Text>

          <View style={styles.modalActions}>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmText}>Yes, Logout</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(4, 22, 20, 0.45)',
    padding: 20,
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  modalCard: {
    width: '100%',
    backgroundColor: palette.card,
    borderRadius: 32,
    padding: 28,
    alignItems: 'center',
  },
  logoutIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: palette.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: palette.text,
    fontSize: 20,
    fontWeight: '900',
    marginBottom: 8,
  },
  modalBody: {
    color: palette.subtext,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
  },
  modalActions: {
    width: '100%',
    gap: 12,
  },
  confirmButton: {
    backgroundColor: palette.danger,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmText: {
    color: palette.card,
    fontSize: 14,
    fontWeight: '800',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelText: {
    color: palette.subtext,
    fontSize: 14,
    fontWeight: '700',
  },
});
