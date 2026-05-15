import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { Trash2, ShoppingCart, ShieldCheck, ChevronRight, Package, Smartphone, Laptop, Shirt, Utensils, FileText, AlertTriangle } from 'lucide-react-native';

interface CartItem { 
  id: string; 
  size: string; 
  itemType: string; 
  quantity: number; 
  weight?: string;
  deliveryGuarantee?: string;
}

interface Props {
  items: CartItem[];
  onUpdateQuantity: (id: string, q: number) => void;
  onRemoveItem: (id: string) => void;
  onContinue: () => void;
}

const getItemIcon = (type: string) => {
  const t = type.toLowerCase();
  if (t.includes('cloth')) return <Shirt size={22} color="#39B5A8" />;
  if (t.includes('electr')) return <Smartphone size={22} color="#39B5A8" />;
  if (t.includes('food')) return <Utensils size={22} color="#39B5A8" />;
  if (t.includes('doc')) return <FileText size={22} color="#39B5A8" />;
  if (t.includes('fragile')) return <AlertTriangle size={22} color="#39B5A8" />;
  return <Package size={22} color="#39B5A8" />;
};

export default function ParcelCart({ items, onRemoveItem, onContinue }: Props) {
  // Note: The screenshot doesn't show quantity buttons in the summary, just "Qty: 1"
  // For simplicity and matching the UI exactly, I'll focus on the summary view.
  
  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Main Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryHeader}>
            <View>
              <Text style={styles.summaryTitle}>Order summary</Text>
              <View style={styles.itemBadge}>
                <Text style={styles.itemBadgeText}>{items.length} {items.length === 1 ? 'Item' : 'Items'}</Text>
              </View>
            </View>
            <View style={styles.cartIconCircle}>
              <ShoppingCart size={20} color="#39B5A8" />
            </View>
          </View>

          {/* Items List */}
          {items.map(item => (
            <View key={item.id} style={styles.itemCard}>
              <View style={styles.itemHeader}>
                <View style={styles.itemIconBox}>
                   {getItemIcon(item.itemType)}
                </View>
                <View style={styles.itemMainInfo}>
                  <Text style={styles.itemName}>{item.itemType.charAt(0).toUpperCase() + item.itemType.slice(1)}</Text>
                  <Text style={styles.itemSub}>Qty: {item.quantity} • Parcel details</Text>
                </View>
                <TouchableOpacity onPress={() => onRemoveItem(item.id)} style={styles.deleteBtn}>
                  <Trash2 size={18} color="#D1D5DB" />
                </TouchableOpacity>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailsGrid}>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>SIZE</Text>
                  <Text style={styles.detailValue}>Parcel {item.size}</Text>
                </View>
                <View style={styles.detailCol}>
                  <Text style={styles.detailLabel}>WEIGHT</Text>
                  <Text style={styles.detailValue}>{item.weight || 'Up to 5kg'}</Text>
                </View>
              </View>

              <View style={styles.protectionRow}>
                <ShieldCheck size={14} color="#39B5A8" />
                <Text style={styles.protectionText}>
                  {item.deliveryGuarantee ? `${item.deliveryGuarantee.charAt(0).toUpperCase() + item.deliveryGuarantee.slice(1)} Protection` : 'Basic Protection'}
                </Text>
              </View>
            </View>
          ))}

          {items.length === 0 && (
            <Text style={styles.emptyText}>No items in summary.</Text>
          )}

          {/* PakiShip Shield Banner */}
          <View style={styles.shieldBanner}>
            <View style={styles.shieldIconBox}>
              <ShieldCheck size={18} color="#39B5A8" />
            </View>
            <View style={styles.shieldContent}>
               <Text style={styles.shieldText}>
                 All parcels in your cart are covered by <Text style={styles.bold}>PakiShip Shield</Text>. You can review your items before final checkout.
               </Text>
            </View>
          </View>
        </View>

      </ScrollView>

      {/* Footer Navigation is usually handled by the parent send-parcel.tsx footer, 
          but per the screenshot it seems to be part of the screen. 
          The parent SendParcel already provides a footer, so we'll ensure they combine correctly.
      */}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },

  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 32,
    padding: 24,
    // Native shadow
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
  },
  summaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  summaryTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#041614',
    marginBottom: 6,
  },
  itemBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  itemBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#9CA3AF',
  },
  cartIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F0F9F8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(57,181,168,0.1)',
  },

  // Item Card
  itemCard: {
    backgroundColor: '#F8FBFA', // Very light tint
    borderRadius: 24,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#F0F9F8',
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  itemIconBox: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  itemMainInfo: {
    flex: 1,
    marginLeft: 12,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '900',
    color: '#041614',
  },
  itemSub: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9CA3AF',
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(57,181,168,0.05)',
    marginVertical: 12,
  },
  detailsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  detailCol: {
    flex: 1,
  },
  detailLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#041614',
  },
  protectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  protectionText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#39B5A8',
  },

  // Shield Banner
  shieldBanner: {
    backgroundColor: '#F0F9F8',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    borderWidth: 1,
    borderColor: 'rgba(57,181,168,0.1)',
  },
  shieldIconBox: {
    marginRight: 12,
  },
  shieldContent: {
    flex: 1,
  },
  shieldText: {
    fontSize: 11,
    color: '#1A5D56',
    lineHeight: 16,
    fontWeight: '600',
  },
  bold: {
    fontWeight: '900',
  },
  emptyText: {
    textAlign: 'center',
    color: '#9CA3AF',
    marginVertical: 20,
    fontWeight: '700',
  },
});
