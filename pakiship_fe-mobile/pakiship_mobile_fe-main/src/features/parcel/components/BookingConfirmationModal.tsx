import React from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet } from 'react-native';
import { CheckCircle } from 'lucide-react-native';

export default function BookingConfirmationModal({ isOpen, onClose, bookingDetails }: any) {
  if (!isOpen) return null;
  return (
    <Modal visible animationType="fade">
      <View style={s.c}>
        <CheckCircle size={64} color="#39B5A8" />
        <Text style={s.title}>Booking Confirmed!</Text>
        <Text style={s.id}>#{bookingDetails?.trackingNumber}</Text>
        <Text style={s.sub}>From {bookingDetails?.senderName} to {bookingDetails?.receiverName}</Text>
        <Text style={s.price}>Total: ₱{bookingDetails?.totalCost}</Text>
        <TouchableOpacity style={s.btn} onPress={onClose}><Text style={s.btxt}>Back to Home</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}
const s = StyleSheet.create({
  c: { flex: 1, backgroundColor: '#F0F9F8', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { fontSize: 24, fontWeight: '900', color: '#041614', marginTop: 16 },
  id: { fontSize: 13, color: '#39B5A8', fontWeight: '800', marginTop: 6 },
  sub: { fontSize: 13, color: '#777', marginTop: 8 },
  price: { fontSize: 22, fontWeight: '900', color: '#1A5D56', marginTop: 16 },
  btn: { marginTop: 40, backgroundColor: '#39B5A8', paddingHorizontal: 40, paddingVertical: 16, borderRadius: 30 },
  btxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
