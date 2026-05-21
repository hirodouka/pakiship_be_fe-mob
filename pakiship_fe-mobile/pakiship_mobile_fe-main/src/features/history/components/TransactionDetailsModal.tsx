import React from 'react';
import { View, Text, TouchableOpacity, Modal, ScrollView, StyleSheet } from 'react-native';
import { X, MapPin, Package, Calendar, DollarSign } from 'lucide-react-native';

interface Props {
  transaction: any;
  onClose: () => void;
}

export function TransactionDetailsModal({ transaction, onClose }: Props) {
  if (!transaction) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>#{transaction.id}</Text>
          <TouchableOpacity onPress={onClose}><X size={22} color="#555" /></TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1, padding: 20 }}>
          <View style={styles.row}><Package size={16} color="#39B5A8" /><Text style={styles.field}>Type</Text><Text style={styles.val}>{transaction.type}</Text></View>
          <View style={styles.row}><MapPin size={16} color="#39B5A8" /><Text style={styles.field}>From</Text><Text style={styles.val}>{transaction.from}</Text></View>
          <View style={styles.row}><MapPin size={16} color="#FDB833" /><Text style={styles.field}>To</Text><Text style={styles.val}>{transaction.to}</Text></View>
          <View style={styles.row}><Calendar size={16} color="#39B5A8" /><Text style={styles.field}>Date</Text><Text style={styles.val}>{transaction.date}</Text></View>
          <View style={styles.row}><DollarSign size={16} color="#39B5A8" /><Text style={styles.field}>Amount</Text><Text style={styles.val}>{transaction.amount}</Text></View>
          <View style={[styles.statusBadge, { backgroundColor: transaction.isLive ? '#39B5A8' : '#e5e7eb' }]}>
            <Text style={{ color: transaction.isLive ? '#fff' : '#555', fontWeight: '800' }}>{transaction.status}</Text>
          </View>
        </ScrollView>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}><Text style={styles.closeTxt}>Close</Text></TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9F8' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 24, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: 'rgba(57,181,168,0.1)' },
  title: { fontSize: 18, fontWeight: '900', color: '#041614' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  field: { flex: 1, fontSize: 13, color: '#888', fontWeight: '700' },
  val: { fontSize: 13, fontWeight: '800', color: '#1A5D56' },
  statusBadge: { alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginTop: 20 },
  closeBtn: { margin: 20, backgroundColor: '#1A5D56', borderRadius: 16, height: 52, alignItems: 'center', justifyContent: 'center' },
  closeTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
