import React, { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Image, Modal, ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Star, MessageSquare, Zap, ShieldCheck, UserCheck, Package, Clock, CheckCircle2, AlertCircle, X, ChevronDown, History } from 'lucide-react-native';
import { CustomerPageHeader } from '@features/shared/components/CustomerPageHeader';
import { apiRequest } from '@features/services/api';
import { parcelApi } from '@features/services/parcelApi';

const MASCOTS: Record<number, { src: any; label: string }> = {
  1: { src: require('../../../assets/mascot-parcel.png'), label: 'Poor' },
  2: { src: require('../../../assets/no 2.png'), label: 'Fair' },
  3: { src: require('../../../assets/mascot-analytics.png'), label: 'Good' },
  4: { src: require('../../../assets/mascot-shield.png'), label: 'Very Good' },
  5: { src: require('../../../assets/mascot-rate.png'), label: 'Excellent' },
};

const quickTags = [
  { id: 'fast', label: 'Fast', Icon: Zap },
  { id: 'secured', label: 'Secured', Icon: ShieldCheck },
  { id: 'friendly', label: 'Friendly', Icon: UserCheck },
  { id: 'perfect', label: 'Perfect', Icon: Package },
  { id: 'ontime', label: 'On Time', Icon: Clock },
];

const recentFeedback = [
  { id: 'PKS-002', text: 'Excellent service! Driver was professional.', tag: 'SECURED' },
  { id: 'PKS-003', text: 'On time and very polite rider.', tag: 'FAST' },
  { id: 'PKS-004', text: 'Package handled with great care.', tag: 'PERFECT' },
];

export default function RateReview() {
  const navigation = useNavigation<any>();
  const [trackingNumber, setTrackingNumber] = useState('');
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [toast, setToast] = useState<{ show: boolean; message: string; type: 'error' | 'success' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [myReviews, setMyReviews] = useState<any[]>([]);
  const [historyParcels, setHistoryParcels] = useState<any[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);

  React.useEffect(() => {
    fetchMyReviews();
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      setLoadingHistory(true);
      const res = await parcelApi.getHistory();
      setHistoryParcels(res.transactions || []);
    } catch (e) {
      console.log('Failed to fetch history:', e);
    } finally {
      setLoadingHistory(false);
    }
  };

  const fetchMyReviews = async () => {
    try {
      const res = await apiRequest('/customer/feedback/my-reviews');
      setMyReviews(res);
    } catch (e) {
      console.log('Failed to fetch reviews:', e);
    }
  };

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toggleTag = (label: string) => {
    setSelectedTags(prev => prev.includes(label) ? prev.filter(t => t !== label) : [...prev, label]);
  };

  const handleSubmit = async () => {
    if (rating === 0) { showToast('Please select a star rating.', 'error'); return; }
    if (!trackingNumber.trim()) { showToast('Please enter your tracking number.', 'error'); return; }
    
    try {
      setIsSubmitting(true);
      await apiRequest('/customer/feedback', {
        method: 'POST',
        body: JSON.stringify({
          trackingNumber: trackingNumber.trim(),
          rating,
          review: review.trim() || undefined,
          tags: selectedTags
        })
      });
      showToast('Feedback submitted! Thank you! 🎉', 'success');
      fetchMyReviews();
      setTimeout(() => navigation.reset({ index: 0, routes: [{ name: 'Home' }] }), 2200);
    } catch (err: any) {
      showToast(err.message || 'Failed to submit feedback. Ensure your tracking number is correct.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <CustomerPageHeader title="Rate & Review" subtitle="Help us improve" icon={MessageSquare as any} onBack={() => navigation.goBack()} />

      {/* Toast */}
      {toast && (
        <View style={[styles.toast, toast.type === 'error' ? styles.toastError : styles.toastSuccess]}>
          {toast.type === 'error' ? <AlertCircle size={16} color="#ef4444" /> : <CheckCircle2 size={16} color="#39B5A8" />}
          <Text style={styles.toastText}>{toast.message}</Text>
          <TouchableOpacity onPress={() => setToast(null)}><X size={14} color="#aaa" /></TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
        {/* Form Card */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Delivery Feedback</Text>
            <Text style={styles.formSubtitle}>Rate your recent PKS experience.</Text>
          </View>

          {/* Tracking Number */}
          <Text style={styles.fieldLabel}>TRACKING #</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInputIntegrated}
              placeholder="PKS-20260519-F62D36DD"
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              autoCapitalize="characters"
            />
            <TouchableOpacity 
              style={styles.dropdownIntegrated} 
              onPress={() => setShowHistoryModal(true)}
              activeOpacity={0.7}
            >
              <ChevronDown size={20} color="#39B5A8" />
            </TouchableOpacity>
          </View>
          <TouchableOpacity onPress={() => setShowHistoryModal(true)}>
            <Text style={styles.helperLink}>Or select from your recent parcels</Text>
          </TouchableOpacity>

          {/* Star Rating */}
          <Text style={styles.fieldLabel}>RATING</Text>
          <View style={styles.ratingBox}>
            {rating > 0 && MASCOTS[rating as 1|2|3|4|5] && (
              <Image source={MASCOTS[rating as 1|2|3|4|5]!.src} style={styles.mascot} resizeMode="contain" />
            )}
            <View style={styles.starsRow}>
              {[1,2,3,4,5].map(star => (
                <TouchableOpacity key={star} onPress={() => setRating(star)}>
                  <Star size={32} color="#39B5A8" fill={star <= rating ? '#39B5A8' : 'transparent'} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.ratingLabel}>{rating === 0 ? 'Tap to Rate' : MASCOTS[rating as 1|2|3|4|5]?.label}</Text>
          </View>

          {/* Quick Tags */}
          <Text style={styles.fieldLabel}>WHAT WENT WELL?</Text>
          <View style={styles.tagsRow}>
            {quickTags.map(tag => {
              const Icon = tag.Icon;
              const sel = selectedTags.includes(tag.label);
              return (
                <TouchableOpacity key={tag.id} style={[styles.tagChip, sel && styles.tagChipActive]} onPress={() => toggleTag(tag.label)}>
                  <Icon size={12} color={sel ? '#fff' : '#888'} />
                  <Text style={[styles.tagText, sel && styles.tagTextActive]}>{tag.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Review */}
          <View style={styles.reviewHeader}>
            <Text style={styles.fieldLabel}>REVIEW</Text>
            <Text style={styles.charCount}>{review.length}/500</Text>
          </View>
          <TextInput
            style={styles.reviewInput}
            placeholder="Share your experience..."
            value={review}
            onChangeText={t => t.length <= 500 && setReview(t)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          {/* Action buttons */}
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => navigation.goBack()}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.submitBtn, isSubmitting && { opacity: 0.7 }]} 
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent feedback */}
        <Text style={styles.recentTitle}>MY RECENT FEEDBACK</Text>
        {myReviews.map((item, idx) => (
          <View key={item.reviewId || idx} style={styles.feedbackCard}>
            <View style={styles.feedbackTop}>
              <Text style={styles.feedbackId}>{item.trackingNumber}</Text>
              <View style={styles.starsRowSmall}>
                {[1,2,3,4,5].map(s => (
                  <Star key={s} size={10} color="#39B5A8" fill={s <= item.rating ? "#39B5A8" : "transparent"} />
                ))}
              </View>
            </View>
            {item.review ? <Text style={styles.feedbackText}>"{item.review}"</Text> : null}
            <View style={styles.feedbackTagsContainer}>
              {item.tags?.map((tag: string) => (
                <View key={tag} style={styles.feedbackTag}><Text style={styles.feedbackTagText}>{tag.toUpperCase()}</Text></View>
              ))}
            </View>
          </View>
        ))}

        {myReviews.length === 0 && (
          <Text style={{ textAlign: 'center', color: '#aaa', fontSize: 12, marginTop: 10 }}>You haven't submitted any reviews yet.</Text>
        )}
      </ScrollView>

      {/* History Selection Modal */}
      <Modal visible={showHistoryModal} transparent animationType="slide" onRequestClose={() => setShowHistoryModal(false)}>
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setShowHistoryModal(false)} />
          <View style={styles.historySheet}>
            <View style={styles.dragHandle} />
            <View style={styles.historyHeader}>
              <History size={18} color="#39B5A8" />
              <Text style={styles.historyTitle}>Select Completed Parcel</Text>
              <TouchableOpacity onPress={() => setShowHistoryModal(false)}><X size={20} color="#aaa" /></TouchableOpacity>
            </View>
            
            <ScrollView style={styles.historyList}>
              {loadingHistory ? (
                <ActivityIndicator size="small" color="#39B5A8" style={{ marginTop: 20 }} />
              ) : historyParcels.filter(p => p.status && (p.status.toLowerCase().includes('delivered') || p.status.toLowerCase().includes('completed'))).length > 0 ? (
                historyParcels.filter(p => p.status && (p.status.toLowerCase().includes('delivered') || p.status.toLowerCase().includes('completed'))).map((p) => (
                  <TouchableOpacity 
                    key={p.id} 
                    style={styles.historyItem} 
                    onPress={() => {
                      setTrackingNumber(p.id);
                      setShowHistoryModal(false);
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <View style={styles.historyItemTop}>
                        <Text style={styles.historyItemId}>{p.id}</Text>
                        <Text style={styles.historyItemDate}>{p.date}</Text>
                      </View>
                      <Text style={styles.historyItemMeta}>{p.from} → {p.to}</Text>
                    </View>
                    <View style={styles.selectCircle}>
                      <ChevronDown size={14} color="#39B5A8" style={{ transform: [{ rotate: '-90deg' }] }} />
                    </View>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={styles.emptyHistoryText}>No completed parcels found to review.</Text>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9F8' },
  toast: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 4, borderRadius: 14, padding: 12, borderWidth: 1 },
  toastError: { backgroundColor: '#fff', borderColor: '#fecaca' },
  toastSuccess: { backgroundColor: '#fff', borderColor: 'rgba(57,181,168,0.3)' },
  toastText: { flex: 1, fontSize: 12, fontWeight: '700', color: '#374151' },
  formCard: { backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(57,181,168,0.15)', marginBottom: 20 },
  formHeader: { borderLeftWidth: 4, borderLeftColor: '#39B5A8', paddingLeft: 12, marginBottom: 18 },
  formTitle: { fontSize: 20, fontWeight: '900', color: '#1A5D56' },
  formSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  fieldLabel: { fontSize: 9, fontWeight: '900', color: '#39B5A8', letterSpacing: 1.5, marginBottom: 6, marginTop: 14 },
  textInput: { backgroundColor: '#F0F9F8', borderRadius: 12, borderWidth: 2, borderColor: 'rgba(57,181,168,0.15)', paddingHorizontal: 14, height: 46, fontSize: 14, fontWeight: '700', color: '#041614' },
  ratingBox: { alignItems: 'center', backgroundColor: '#F0F9F8', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)' },
  mascot: { width: 72, height: 72, marginBottom: 8 },
  starsRow: { flexDirection: 'row', gap: 8 },
  ratingLabel: { fontSize: 10, fontWeight: '800', color: '#1A5D56', marginTop: 6, textTransform: 'uppercase', letterSpacing: 1 },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tagChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#e5e7eb' },
  tagChipActive: { backgroundColor: '#39B5A8', borderColor: '#39B5A8' },
  tagText: { fontSize: 11, fontWeight: '700', color: '#888' },
  tagTextActive: { color: '#fff' },
  reviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  charCount: { fontSize: 10, color: '#aaa', fontWeight: '700' },
  reviewInput: { backgroundColor: '#F0F9F8', borderRadius: 12, borderWidth: 2, borderColor: 'rgba(57,181,168,0.15)', padding: 14, fontSize: 13, fontWeight: '600', color: '#041614', minHeight: 100 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 14, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: '#888', fontWeight: '800', fontSize: 14 },
  submitBtn: { flex: 2, height: 48, borderRadius: 14, backgroundColor: '#39B5A8', alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  recentTitle: { fontSize: 9, fontWeight: '900', color: '#aaa', letterSpacing: 2, marginBottom: 12 },
  feedbackCard: { backgroundColor: '#1A5D56', borderRadius: 18, padding: 14, marginBottom: 10 },
  feedbackTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  feedbackId: { fontSize: 9, fontWeight: '900', color: '#39B5A8', letterSpacing: 1 },
  starsRowSmall: { flexDirection: 'row', gap: 2 },
  feedbackText: { fontSize: 12, color: 'rgba(255,255,255,0.8)', fontStyle: 'italic', lineHeight: 18 },
  feedbackTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(57,181,168,0.2)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(57,181,168,0.3)' },
  feedbackTagText: { fontSize: 8, fontWeight: '900', color: '#39B5A8', letterSpacing: 1 },
  feedbackTagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9F8', borderRadius: 12, borderWidth: 2, borderColor: 'rgba(57,181,168,0.15)', overflow: 'hidden' },
  textInputIntegrated: { flex: 1, paddingHorizontal: 14, height: 46, fontSize: 14, fontWeight: '700', color: '#041614' },
  dropdownIntegrated: { width: 46, height: 46, alignItems: 'center', justifyContent: 'center', borderLeftWidth: 1, borderLeftColor: 'rgba(57,181,168,0.1)' },
  helperLink: { fontSize: 11, fontWeight: '700', color: '#39B5A8', marginTop: 6, textDecorationLine: 'underline' },
  historySheet: { backgroundColor: '#fff', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 20, maxHeight: '75%', width: '100%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb', alignSelf: 'center', marginBottom: 15 },
  historyHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  historyTitle: { flex: 1, fontSize: 16, fontWeight: '900', color: '#1A5D56' },
  historyList: { gap: 10 },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 12 },
  historyItemTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  historyItemId: { fontSize: 14, fontWeight: '800', color: '#1e293b' },
  historyItemDate: { fontSize: 10, color: '#aaa', fontWeight: '600' },
  historyItemMeta: { fontSize: 11, color: '#888' },
  selectCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#F0F9F8', alignItems: 'center', justifyContent: 'center' },
  emptyHistoryText: { textAlign: 'center', color: '#aaa', marginTop: 20, fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(26,93,86,0.85)', justifyContent: 'flex-end' },
});
