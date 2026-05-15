import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Search, Package, ChevronRight, Calendar, MapPin, Clock, History as HistoryIcon, ArrowRight } from 'lucide-react-native';
import { CustomerPageHeader } from '@/features/shared/components/CustomerPageHeader';
import { TransactionDetailsModal } from '@/features/history/components/TransactionDetailsModal';

import { parcelApi } from '@/features/services/parcelApi';

type TabType = 'all' | 'active' | 'completed';

export default function History() {
  const navigation = useNavigation<any>();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [selectedTransaction, setSelectedTransaction] = useState<any>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await parcelApi.getHistory();
      setTransactions(res.transactions || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const filtered = transactions.filter(t => {
    const matchesSearch =
      (t.id || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.from || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.to || '').toLowerCase().includes(searchTerm.toLowerCase());
    if (activeTab === 'active') return matchesSearch && t.isLive;
    if (activeTab === 'completed') return matchesSearch && !t.isLive;
    return matchesSearch;
  });

  return (
    <View style={styles.container}>
      <CustomerPageHeader title="Tracking" subtitle="Complete tracking history" icon={HistoryIcon as any} onBack={() => navigation.goBack()} />

      <View style={styles.searchCard}>
        <View style={styles.searchRow}>
          <Search size={16} color="#ccc" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by ID or destination..."
            value={searchTerm}
            onChangeText={setSearchTerm}
          />
        </View>
        <View style={styles.tabsRow}>
          {(['all', 'active', 'completed'] as TabType[]).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeTab === tab && styles.tabActive]}
              onPress={() => setActiveTab(tab)}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <View style={styles.listHeader}>
        <Text style={styles.listLabel}>PARCEL RECORDS</Text>
        <View style={styles.countBadge}><Text style={styles.countText}>{filtered.length} results</Text></View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingTop: 0, paddingBottom: 32, gap: 12 }}>
        {filtered.map(transaction => (
          <TouchableOpacity key={transaction.id} style={styles.card} onPress={() => setSelectedTransaction(transaction)} activeOpacity={0.85}>
            {/* Header */}
            <View style={styles.cardTop}>
              <View style={styles.cardTopLeft}>
                <View style={[styles.pkgIcon, { backgroundColor: transaction.isLive ? 'rgba(57,181,168,0.1)' : '#f1f5f9' }]}>
                  <Package size={22} color={transaction.isLive ? '#39B5A8' : '#aaa'} />
                </View>
                <View>
                  <View style={styles.idRow}>
                    <Text style={styles.cardId}>{transaction.id}</Text>
                    {transaction.isLive && (
                      <View style={styles.liveBadge}><Text style={styles.liveText}>● LIVE</Text></View>
                    )}
                  </View>
                  <Text style={styles.cardType}>{transaction.type}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={styles.cardAmount}>{transaction.amount}</Text>
                <View style={[styles.statusBadge, { backgroundColor: transaction.isLive ? '#39B5A8' : '#f1f5f9' }]}>
                  <Text style={[styles.statusText, { color: transaction.isLive ? '#fff' : '#888' }]}>{transaction.status}</Text>
                </View>
              </View>
            </View>

            {/* Route */}
            <View style={styles.routeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.routeLabel}>From</Text>
                <View style={styles.routeAddrRow}>
                  <MapPin size={10} color="#ccc" />
                  <Text style={styles.routeAddr}>{transaction.from}</Text>
                </View>
              </View>
              <View style={styles.arrowCircle}><ArrowRight size={14} color="#39B5A8" /></View>
              <View style={{ flex: 1, alignItems: 'flex-end' }}>
                <Text style={styles.routeLabel}>To</Text>
                <View style={styles.routeAddrRow}>
                  <Text style={styles.routeAddr}>{transaction.to}</Text>
                  <MapPin size={10} color="#39B5A8" />
                </View>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.footerLeft}>
                <Calendar size={12} color="#aaa" />
                <Text style={styles.footerMeta}>{transaction.date}</Text>
                {transaction.isLive && (
                  <View style={styles.arrivalBadge}>
                    <Clock size={10} color="#d97706" />
                    <Text style={styles.arrivalText}>Arrival Today</Text>
                  </View>
                )}
              </View>
              <View style={styles.detailsLink}>
                <Text style={styles.detailsLinkText}>View Details</Text>
                <ChevronRight size={12} color="#39B5A8" />
              </View>
            </View>
          </TouchableOpacity>
        ))}

        {filtered.length === 0 && (
          <View style={styles.emptyState}>
            <Package size={48} color="#ccc" />
            <Text style={styles.emptyTitle}>No shipments found</Text>
            <Text style={styles.emptySubtitle}>Adjust your search or filters.</Text>
            <TouchableOpacity style={styles.clearBtn} onPress={() => { setSearchTerm(''); setActiveTab('all'); }}>
              <Text style={styles.clearBtnText}>Clear Filters</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {selectedTransaction && (
        <TransactionDetailsModal transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFB' },
  searchCard: { margin: 16, marginTop: 12, backgroundColor: '#fff', borderRadius: 20, padding: 8, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#f8fafc', borderRadius: 14, paddingHorizontal: 14, height: 46, marginBottom: 6 },
  searchInput: { flex: 1, fontSize: 13, fontWeight: '600', color: '#374151' },
  tabsRow: { flexDirection: 'row', gap: 4, padding: 2 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  tabActive: { backgroundColor: '#39B5A8' },
  tabText: { fontSize: 10, fontWeight: '800', color: '#aaa', textTransform: 'uppercase', letterSpacing: 0.5 },
  tabTextActive: { color: '#fff' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 10 },
  listLabel: { fontSize: 9, fontWeight: '900', color: '#aaa', letterSpacing: 2 },
  countBadge: { backgroundColor: '#f1f5f9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  countText: { fontSize: 10, fontWeight: '700', color: '#888' },
  card: { backgroundColor: '#fff', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#f1f5f9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardTopLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pkgIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  idRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 },
  cardId: { fontSize: 15, fontWeight: '900', color: '#1e293b' },
  liveBadge: { backgroundColor: '#ecfdf5', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#a7f3d0' },
  liveText: { fontSize: 8, fontWeight: '900', color: '#059669' },
  cardType: { fontSize: 9, fontWeight: '800', color: '#aaa', textTransform: 'uppercase', letterSpacing: 1 },
  cardAmount: { fontSize: 16, fontWeight: '900', color: '#1A5D56', marginBottom: 6 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  statusText: { fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  routeRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f8fafc', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#f1f5f9', marginBottom: 14 },
  routeLabel: { fontSize: 8, fontWeight: '900', color: '#aaa', textTransform: 'uppercase', marginBottom: 4, letterSpacing: 1 },
  routeAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  routeAddr: { fontSize: 13, fontWeight: '800', color: '#374151' },
  arrowCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e2e8f0', alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footerLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  footerMeta: { fontSize: 10, fontWeight: '700', color: '#aaa' },
  arrivalBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#fffbeb', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  arrivalText: { fontSize: 9, fontWeight: '800', color: '#d97706' },
  detailsLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  detailsLinkText: { fontSize: 11, fontWeight: '800', color: '#39B5A8' },
  emptyState: { alignItems: 'center', padding: 40, backgroundColor: '#fff', borderRadius: 24, borderWidth: 2, borderStyle: 'dashed', borderColor: '#f1f5f9' },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#1A5D56', marginTop: 16 },
  emptySubtitle: { fontSize: 12, color: '#aaa', marginTop: 6, marginBottom: 24 },
  clearBtn: { backgroundColor: '#1A5D56', paddingHorizontal: 30, paddingVertical: 14, borderRadius: 16 },
  clearBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
});
