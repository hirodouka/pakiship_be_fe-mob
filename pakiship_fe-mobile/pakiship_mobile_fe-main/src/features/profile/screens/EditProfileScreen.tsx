import React, { useState, useRef } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, TextInput,
  StyleSheet, Modal, Switch, Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  User, Mail, Phone, MapPin, Calendar, Save,
  Lock, ShieldCheck, Bell, MessageSquare, RefreshCw, X, Eye, EyeOff,
  ArrowLeft, Camera, Upload, FileCheck, LogOut
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'react-native';

type TabType = 'profile' | 'discount' | 'preferences';

import { authApi } from '@/features/services/authApi';
import { profileApi } from '@/features/services/profileApi';
import { LogoutModal } from '@/features/shared/components/LogoutModal';

export default function EditProfile() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showPass, setShowPass] = useState({ current: false, new: false });
  const [toast, setToast] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    dob: '',
    profilePicture: null as string | null,
  });

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsUpdates: true,
    autoExtend: false,
    twoFactor: false,
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await profileApi.getProfile();
      const p = res.profile;
      setFormData({
        name: p?.fullName || '',
        email: p?.email || '',
        phone: p?.phone || '',
        address: p?.address || '',
        dob: p?.dob || '',
        profilePicture: p?.profilePicture || null,
      });
      setPreferences({
        emailNotifications: p?.preferences?.emailNotifications ?? true,
        smsUpdates: p?.preferences?.smsUpdates ?? true,
        autoExtend: p?.preferences?.autoExtend ?? false,
        twoFactor: p?.preferences?.twoFactor ?? false,
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, []);

  const handleSave = async () => {
    try {
      setLoading(true);
      await profileApi.updateProfile({
        fullName: formData.name,
        email: formData.email,
        phone: formData.phone,
        address: formData.address,
        dob: formData.dob,
        preferences,
      });
      showToast('Profile updated successfully!');
      setTimeout(() => navigation.navigate('Home'), 1500);
    } catch (error: any) {
      showToast(error.message || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const handlePickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });

      if (!result.canceled && result.assets[0].uri) {
        setLoading(true);
        const asset = result.assets[0];
        
        const avatarData = new FormData();
        avatarData.append('file', {
          uri: asset.uri,
          name: asset.fileName || 'avatar.jpg',
          type: asset.mimeType || 'image/jpeg',
        } as any);

        const res = await profileApi.uploadAvatar(avatarData);
        setFormData(prev => ({ ...prev, profilePicture: res.profilePicture }));
        showToast('Profile photo updated!');
      }
    } catch (error: any) {
      showToast('Failed to upload image.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const [passwordData, setPasswordData] = useState({ current: '', new: '' });
  const [discountIdUploaded, setDiscountIdUploaded] = useState(false);

  const userInitials = formData.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'U';

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const togglePref = (key: keyof typeof preferences) => {
    setPreferences(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBack}>
          <ArrowLeft size={24} color="#39B5A8" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Profile Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Toast */}
      {toast && (
        <View style={styles.toast}><Text style={styles.toastText}>{toast}</Text></View>
      )}

      {/* Scroll Content */}
      <ScrollView 
        keyboardShouldPersistTaps="handled"
        style={styles.scrollContainer} 
        contentContainerStyle={{ padding: 16, paddingBottom: 160 }}
      >
        {/* Avatar Card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatarBox}>
              {formData.profilePicture ? (
                <Image source={{ uri: formData.profilePicture }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>{userInitials}</Text>
              )}
            </View>
            <TouchableOpacity 
              style={styles.cameraBtn} 
              activeOpacity={0.8}
              onPress={handlePickImage}
              disabled={loading}
            >
              <Camera size={14} color="#fff" />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={styles.avatarName}>{formData.name}</Text>
            <Text style={styles.avatarRole}>Customer Account</Text>
          </View>
        </View>

        {/* Tabs */}
        <View style={styles.tabsRow}>
          {(['profile', 'discount', 'preferences'] as TabType[]).map(tab => (
            <TouchableOpacity 
              key={tab} 
              style={[styles.tab, activeTab === tab && styles.tabActive]} 
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                {tab === 'discount' ? 'Special Discount' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Main Settings Card */}
        <View style={styles.mainCard}>
          
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <View>
              <Text style={styles.cardTitle}>Personal Details</Text>
              <View style={styles.formGrid}>
                <FormInput icon={<User size={18} color="#39B5A8" />} label="Full Name" value={formData.name} onChange={(v: string) => setFormData({ ...formData, name: v })} />
                <FormInput icon={<Mail size={18} color="#39B5A8" />} label="Email Address" value={formData.email} onChange={(v: string) => setFormData({ ...formData, email: v })} keyboardType="email-address" />
                <FormInput icon={<Phone size={18} color="#39B5A8" />} label="Phone Number" value={formData.phone} onChange={(v: string) => setFormData({ ...formData, phone: v })} keyboardType="phone-pad" />
                <FormInput icon={<Calendar size={18} color="#39B5A8" />} label="Birth Date" value={formData.dob} onChange={(v: string) => setFormData({ ...formData, dob: v })} placeholder="dd/mm/yyyy" />
                <View style={{ marginTop: 2 }}>
                  <FormInput icon={<MapPin size={18} color="#39B5A8" />} label="Primary Address" value={formData.address} onChange={(v: string) => setFormData({ ...formData, address: v })} />
                </View>
              </View>
            </View>
          )}

          {/* Discount Tab */}
          {activeTab === 'discount' && (
            <View>
              <View style={styles.discountHeader}>
                <View style={styles.discountIconBox}><FileCheck size={24} color="#39B5A8" /></View>
                <View>
                  <Text style={styles.cardTitle}>Special Discount</Text>
                  <Text style={styles.cardSubtitle}>Upload valid ID for automatic discounts.</Text>
                </View>
              </View>

              {discountIdUploaded ? (
                <View style={styles.uploadedBox}>
                  <ShieldCheck size={48} color="#39B5A8" style={{ marginBottom: 12 }} />
                  <Text style={styles.uploadedTitle}>ID Uploaded Successfully</Text>
                  <Text style={styles.uploadedSub}>Pending admin verification.</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.uploadBox} activeOpacity={0.7} onPress={() => showToast('Uploading...')}>
                  <Upload size={48} color="#d1d5db" style={{ marginBottom: 16 }} />
                  <Text style={styles.uploadTitle}>Tap to Upload ID Document</Text>
                  <Text style={styles.uploadSub}>Supports JPG, PNG or PDF (Max 5MB)</Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Preferences Tab */}
          {activeTab === 'preferences' && (
            <View>
              <View style={styles.discountHeader}>
                <View style={styles.discountIconBox}><Bell size={24} color="#39B5A8" /></View>
                <View><Text style={styles.cardTitle}>Preferences</Text></View>
              </View>
              <View style={{ marginTop: 10 }}>
                <PrefRow icon={<Mail size={22} color="#39B5A8" />} label="Email Notifications" desc="Booking confirmations and updates via email." value={preferences.emailNotifications} onChange={() => togglePref('emailNotifications')} />
                <PrefRow icon={<MessageSquare size={22} color="#39B5A8" />} label="SMS Updates" desc="Real-time text alerts for deliveries." value={preferences.smsUpdates} onChange={() => togglePref('smsUpdates')} />
                <PrefRow icon={<RefreshCw size={22} color="#39B5A8" />} label="Auto-Extend Booking" desc="Automatically extend expiring storage." value={preferences.autoExtend} onChange={() => togglePref('autoExtend')} hideBorder />
              </View>
              
              <TouchableOpacity 
                style={styles.btnLogoutMain} 
                onPress={() => setShowLogoutModal(true)}
              >
                <LogOut size={20} color="#ef4444" />
                <Text style={styles.btnLogoutText}>Log Out of Account</Text>
              </TouchableOpacity>
            </View>
          )}

        </View>
      </ScrollView>

      <LogoutModal 
        visible={showLogoutModal}
        onClose={() => setShowLogoutModal(false)}
        onConfirm={async () => {
          try {
            await authApi.logout();
          } catch (e) {
            console.log('Logout failed:', e);
          } finally {
            setShowLogoutModal(false);
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          }
        }}
      />

      {/* Fixed Bottom Action Bar */}
      <View style={[styles.bottomBar, { paddingBottom: Math.max(insets.bottom, 24) }]}>
        
        <View style={styles.twoFASecurityBox}>
          <View style={styles.twoFARow}>
            <ShieldCheck size={20} color="#39B5A8" />
            <Text style={styles.twoFAText}>2FA Security</Text>
          </View>
          <Switch trackColor={{ false: '#e5e7eb', true: '#39B5A8' }} thumbColor="#fff" value={preferences.twoFactor} onValueChange={() => setShow2FAModal(true)} />
        </View>

        <View style={styles.bottomButtonsRow}>
          <TouchableOpacity 
            style={styles.btnPassword} 
            activeOpacity={0.7} 
            onPress={() => setShowPasswordModal(true)}
          >
            <Lock size={18} color="#39B5A8" />
            <Text style={styles.btnPasswordText}>Password</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.btnSaveFull} 
            activeOpacity={0.8} 
            onPress={handleSave}
          >
            <Save size={18} color="#fff" />
            <Text style={styles.btnSaveFullText}>SAVE ALL</Text>
          </TouchableOpacity>
        </View>

      </View>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalDragIndicator} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Security Update</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}><X size={24} color="#9ca3af" /></TouchableOpacity>
            </View>
            
            <View style={styles.modalSpace}>
              <Text style={styles.modalFieldLabel}>CURRENT PASSWORD</Text>
              <View style={styles.passRow}>
                <TextInput style={styles.passInput} secureTextEntry={!showPass.current} value={passwordData.current} onChangeText={v => setPasswordData({ ...passwordData, current: v })} />
                <TouchableOpacity onPress={() => setShowPass(p => ({ ...p, current: !p.current }))}>
                  {showPass.current ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
                </TouchableOpacity>
              </View>

              <Text style={styles.modalFieldLabel}>NEW PASSWORD</Text>
              <View style={styles.passRow}>
                <TextInput style={styles.passInput} secureTextEntry={!showPass.new} value={passwordData.new} onChangeText={v => setPasswordData({ ...passwordData, new: v })} />
                <TouchableOpacity onPress={() => setShowPass(p => ({ ...p, new: !p.new }))}>
                  {showPass.new ? <EyeOff size={20} color="#9ca3af" /> : <Eye size={20} color="#9ca3af" />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowPasswordModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUpdateBtn} onPress={() => { showToast('Password updated!'); setShowPasswordModal(false); }}>
                <Text style={styles.modalUpdateText}>Update</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* 2FA Modal */}
      <Modal visible={show2FAModal} animationType="fade" transparent>
        <View style={styles.modalOverlayCentered}>
          <View style={styles.modalCardCentered}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Enable 2FA</Text>
              <TouchableOpacity onPress={() => setShow2FAModal(false)}><X size={24} color="#9ca3af" /></TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>Two-factor authentication adds an extra layer of security to your account.</Text>
            
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShow2FAModal(false)}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalUpdateBtnTop} onPress={() => {
                togglePref('twoFactor');
                showToast('2FA enabled!');
                setShow2FAModal(false);
              }}>
                <Text style={styles.modalUpdateText}>Enable</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
  );
}

// Sub-components
function FormInput({ icon, label, value, onChange, keyboardType = 'default', placeholder }: any) {
  return (
    <View style={fi.wrap}>
      <Text style={fi.label}>{label}</Text>
      <View style={fi.relative}>
        <View style={fi.iconBox}>{icon}</View>
        <TextInput 
          style={fi.input} 
          value={value} 
          onChangeText={onChange} 
          keyboardType={keyboardType} 
          placeholder={placeholder} 
          placeholderTextColor="#9ca3af"
        />
      </View>
    </View>
  );
}

const fi = StyleSheet.create({
  wrap: { marginBottom: 16 },
  label: { fontSize: 10, fontWeight: '900', color: '#39B5A8', letterSpacing: 1.5, marginBottom: 4, marginLeft: 4 },
  relative: { position: 'relative', justifyContent: 'center' },
  iconBox: { position: 'absolute', left: 16, zIndex: 10, opacity: 0.6 },
  input: { 
    backgroundColor: '#F0F9F8', borderRadius: 16, height: 48,
    paddingLeft: 46, paddingRight: 16,
    fontSize: 14, fontWeight: '700', color: '#041614',
    borderWidth: 2, borderColor: 'transparent'
  },
});

function PrefRow({ icon, label, desc, value, onChange, hideBorder = false }: any) {
  return (
    <View style={[pr.row, hideBorder && { borderBottomWidth: 0 }]}>
      <View style={pr.icon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={pr.label}>{label}</Text>
        <Text style={pr.desc}>{desc}</Text>
      </View>
      <Switch trackColor={{ false: '#e5e7eb', true: '#39B5A8' }} thumbColor="#fff" value={value} onValueChange={onChange} />
    </View>
  );
}
const pr = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 18, borderBottomWidth: 1, borderBottomColor: '#f3f4f6', gap: 16 },
  icon: { marginTop: 2, opacity: 0.9 },
  label: { fontSize: 15, fontWeight: '900', color: '#041614', letterSpacing: -0.3 },
  desc: { fontSize: 12, color: '#6b7280', marginTop: 3, fontWeight: '500' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9F8' },
  header: {
    height: 64, backgroundColor: 'transparent',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, zIndex: 50
  },
  headerBack: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 18, fontWeight: '900', color: '#041614' },
  toast: { backgroundColor: '#1A5D56', marginHorizontal: 20, borderRadius: 12, padding: 12 },
  toastText: { color: '#fff', fontWeight: '800', fontSize: 13, textAlign: 'center' },
  scrollContainer: { flex: 1 },
  
  avatarCard: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20,
    borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)', shadowOpacity: 0.05, shadowRadius: 10, shadowOffset: { width: 0, height: 2 },
    flexDirection: 'row', alignItems: 'center', marginBottom: 16
  },
  avatarWrap: { position: 'relative' },
  avatarBox: {
    width: 68, height: 68, borderRadius: 20, backgroundColor: '#1A5D56',
    borderWidth: 3, borderColor: '#F0F9F8',
    alignItems: 'center', justifyContent: 'center'
  },
  avatarText: { fontSize: 28, fontWeight: '900', color: '#fff' },
  avatarImage: { width: '100%', height: '100%', borderRadius: 17 },
  cameraBtn: {
    position: 'absolute', bottom: -4, right: -4,
    backgroundColor: '#39B5A8', padding: 6, borderRadius: 12,
    borderWidth: 2, borderColor: '#fff'
  },
  avatarName: { fontSize: 20, fontWeight: '900', color: '#041614' },
  avatarRole: { fontSize: 12, color: '#39B5A8', fontWeight: '800', marginTop: 2 },
  
  tabsRow: {
    flexDirection: 'row', backgroundColor: '#fff', padding: 6, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)', shadowOpacity: 0.02,
    marginBottom: 20
  },
  tab: { flex: 1, paddingVertical: 12, borderRadius: 14, alignItems: 'center' },
  tabActive: { backgroundColor: '#F0F9F8' },
  tabText: { fontSize: 12, fontWeight: '800', color: '#9ca3af' },
  tabTextActive: { color: '#39B5A8' },

  mainCard: {
    backgroundColor: '#fff', borderRadius: 28, padding: 24, paddingBottom: 32,
    borderWidth: 1, borderColor: 'rgba(57,181,168,0.1)', shadowOpacity: 0.05, shadowRadius: 15, shadowOffset: { width: 0, height: 4 },
  },
  cardTitle: { fontSize: 22, fontWeight: '900', color: '#041614', marginBottom: 18 },
  formGrid: { marginTop: 4 },

  discountHeader: { flexDirection: 'row', gap: 12, marginBottom: 4 },
  discountIconBox: { backgroundColor: '#F0F9F8', padding: 12, borderRadius: 16, height: 48 },
  cardSubtitle: { fontSize: 13, color: '#6b7280', marginTop: -14, marginBottom: 20, fontWeight: '500' },
  uploadBox: {
    alignItems: 'center', borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(57,181,168,0.3)',
    borderRadius: 24, padding: 32, backgroundColor: '#F9FCFC', marginTop: 8
  },
  uploadTitle: { fontSize: 16, fontWeight: '900', color: '#041614', marginTop: 12 },
  uploadSub: { fontSize: 12, color: '#9ca3af', marginTop: 4, fontWeight: '600' },
  uploadedBox: {
    alignItems: 'center', backgroundColor: '#F0F9F8', borderRadius: 24, padding: 32,
    borderWidth: 1, borderColor: 'rgba(57,181,168,0.2)', marginTop: 8
  },
  uploadedTitle: { fontSize: 18, fontWeight: '900', color: '#1A5D56' },
  uploadedSub: { fontSize: 14, color: '#39B5A8', fontWeight: 'bold', marginTop: 4 },

  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: 'rgba(57,181,168,0.1)',
    paddingHorizontal: 20, paddingTop: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.06, shadowRadius: 20, elevation: 15
  },
  twoFASecurityBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: 'rgba(240, 249, 248, 0.4)', borderWidth: 2, borderColor: 'rgba(57,181,168,0.1)',
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 12
  },
  twoFARow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  twoFAText: { fontSize: 14, fontWeight: '900', color: '#39B5A8' },

  bottomButtonsRow: { flexDirection: 'row', gap: 10 },
  btnPassword: {
    flex: 1, height: 56, backgroundColor: '#fff', borderRadius: 16,
    borderWidth: 2, borderColor: 'rgba(57,181,168,0.1)',
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8
  },
  btnPasswordText: { color: '#39B5A8', fontWeight: '900', fontSize: 14 },
  btnSaveFull: {
    flex: 1.5, height: 56, backgroundColor: '#39B5A8', borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10,
    shadowColor: '#39B5A8', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
  },
  btnSaveFullText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
  modalDragIndicator: { width: 48, height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '900', color: '#041614' },
  modalSpace: { marginTop: 10 },
  modalFieldLabel: { fontSize: 11, fontWeight: '900', color: '#9ca3af', letterSpacing: 1.5, marginBottom: 8, marginTop: 16 },
  passRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9F8', borderRadius: 16, paddingHorizontal: 16, height: 52 },
  passInput: { flex: 1, fontSize: 16, fontWeight: '800', color: '#041614' },
  
  modalOverlayCentered: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalCardCentered: { backgroundColor: '#fff', borderRadius: 32, padding: 24, width: '90%', maxWidth: 400 },
  modalDesc: { fontSize: 15, color: '#666', lineHeight: 24, marginBottom: 24 },
  
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  modalCancelBtn: { flex: 1, height: 52, borderRadius: 16, borderWidth: 2, borderColor: '#e5e7eb', alignItems: 'center', justifyContent: 'center' },
  modalCancelText: { color: '#6b7280', fontWeight: '800', fontSize: 15 },
  modalUpdateBtn: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#041614', alignItems: 'center', justifyContent: 'center' },
  modalUpdateBtnTop: { flex: 1, height: 52, borderRadius: 16, backgroundColor: '#39B5A8', alignItems: 'center', justifyContent: 'center' },
  modalUpdateText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnLogoutMain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 16,
    paddingVertical: 14,
    marginTop: 20,
    gap: 10,
  },
  btnLogoutText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '900',
  },
});
