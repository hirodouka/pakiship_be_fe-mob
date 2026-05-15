import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Banknote, Smartphone, Building2, ShieldCheck, CreditCard, ChevronRight } from 'lucide-react-native';

interface PaymentMethod {
  id: string;
  name: string;
  sub: string;
  icon: any;
  isSecure?: boolean;
}

const METHODS: PaymentMethod[] = [
  { id: 'cod', name: 'Cash on Delivery', sub: 'Pay upon arrival', icon: Banknote },
  { id: 'wallet', name: 'E-Wallet', sub: 'GCash or Maya', icon: Smartphone },
  { id: 'bank', name: 'Bank Transfer', sub: 'Direct secure payment', icon: Building2 },
  { id: 'securepay', name: 'SecurePay™', sub: 'Your payment is encrypted and secure.', icon: ShieldCheck, isSecure: true },
];

interface Props {
  selectedMethod: string;
  onSelect: (id: string) => void;
}

export default function PaymentMethodSelector({ selectedMethod, onSelect }: Props) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
         <View style={styles.iconCircle}>
            <CreditCard size={18} color="#39B5A8" />
         </View>
         <Text style={styles.headerTitle}>Payment Method</Text>
      </View>

      <View style={styles.methodList}>
        {METHODS.map((m) => {
          const Icon = m.icon;
          const isSelected = selectedMethod === m.id;
          
          return (
            <TouchableOpacity 
              key={m.id} 
              style={[styles.methodCard, isSelected && styles.methodCardActive]} 
              onPress={() => onSelect(m.id)}
            >
              <View style={[styles.methodIconBox, isSelected && styles.methodIconActive]}>
                <Icon size={20} color={isSelected ? '#39B5A8' : '#39B5A8'} />
              </View>
              
              <View style={styles.methodInfo}>
                <View style={styles.nameRow}>
                  <Text style={styles.methodName}>{m.name}</Text>
                  {m.isSecure && (
                    <View style={styles.sslBadge}>
                      <Text style={styles.sslText}>SSL</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.methodSub}>{m.sub}</Text>
              </View>

              <ChevronRight size={16} color="#D1D5DB" />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 18 },
  iconCircle: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#F0F9F8', alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '900', color: '#041614' },

  methodList: { gap: 12 },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 16,
    borderWidth: 1.5,
    borderColor: '#F9FAFB',
    // Subtle shadow
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 8,
    elevation: 1,
  },
  methodCardActive: {
    borderColor: 'rgba(57,181,168,0.15)',
    backgroundColor: '#fff',
  },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F0F9F8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodIconActive: {
    backgroundColor: '#F0F9F8',
    borderColor: 'rgba(57,181,168,0.1)',
    borderWidth: 1,
  },
  methodInfo: { flex: 1, marginLeft: 14 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  methodName: { fontSize: 15, fontWeight: '900', color: '#041614' },
  sslBadge: { backgroundColor: '#E0F2F1', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sslText: { fontSize: 8, fontWeight: '900', color: '#39B5A8' },
  methodSub: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', marginTop: 2 },
});
