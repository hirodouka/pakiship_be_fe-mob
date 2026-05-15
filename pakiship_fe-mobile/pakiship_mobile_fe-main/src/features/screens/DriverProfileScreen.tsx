import { useEffect, useState, useRef, cloneElement } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Modal, 
  TextInput, 
  Pressable,
  Switch,
  Alert,
  Platform
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  ArrowLeft, ArrowRight, User, Mail, Phone, MapPin, Save,
  Camera, Lock, Eye, EyeOff, ShieldCheck,
  Bell, MessageSquare, Shield, AlertCircle, Bike, RefreshCw, CheckCircle2,
  Navigation, Upload, FileText, X, Pencil, Calendar,
  Building2, FileBadge, Map, AlertTriangle
} from 'lucide-react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthSession } from '../context/AuthSessionContext';
import { authApi } from '../services/authApi';
import { LogOut } from 'lucide-react-native';
import { LogoutModal } from '../shared/components/LogoutModal';

type TabType = 'profile' | 'vehicle' | 'preferences';

type PreferenceState = {
  jobNotifications: boolean;
  smsAlerts: boolean;
  autoAcceptJobs: boolean;
  emailNotifications: boolean;
  twoFactor: boolean;
};

type ToggleItemProps = {
  label: string;
  desc: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

// Mock/Stub for image compression and storage
const compressImage = async (uri: string) => uri;

import { apiRequest } from '../services/api';

export default function DriverProfileScreen() {
  const navigation = useNavigation<any>();
  const { currentUser, setCurrentUser } = useAuthSession();
  
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const insets = useSafeAreaInsets();
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    birthdate: '',
  });

  const [vehicleData, setVehicleData] = useState({
    vehicleType: 'Motorcycle',
    plateNumber: '',
    licenseNumber: '',
    driverId: '',
  });

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/pakiship/mobile/driver/profile');
      const [y, m, d] = (res.dob || '').split('-');
      const displayDob = m && d && y ? `${m}/${d}/${y}` : res.dob;

      setFormData({
        name: res.fullName,
        email: res.email,
        phone: res.phone,
        address: res.address,
        birthdate: displayDob,
      });
      setProfilePicture(res.profilePicture);
      setVehicleData({
        vehicleType: 'Motorcycle',
        plateNumber: res.plateNumber || 'N/A',
        licenseNumber: res.licenseNumber || 'N/A',
        driverId: (res.id || '').slice(0, 8).toUpperCase(),
      });
    } catch (error) {
      console.error('Failed to fetch profile:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const [preferences, setPreferences] = useState({
    jobNotifications: true,
    smsAlerts: true,
    autoAcceptJobs: false,
    emailNotifications: true,
    twoFactor: false,
  });

  const handleSave = async () => {
    try {
      setSaving(true);
      await apiRequest('/pakiship/mobile/driver/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          fullName: formData.name,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          dob: formData.birthdate,
        }),
      });
      setIsEditing(false);
      
      // Update global session name so it reflects on Home screen immediately
      if (currentUser) {
        setCurrentUser({
          ...currentUser,
          fullName: formData.name,
          email: formData.email,
        });
      }

      Alert.alert("Success", "Profile updated successfully!");
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert("Error", "Failed to save profile changes.");
    } finally {
      setSaving(false);
    }
  };

  const [passwordData, setPasswordData] = useState({ current: '', new: '' });
  const [showPass, setShowPass] = useState({ current: false, new: false });

  if (loading) return null;

  const pickImage = async (type: 'profile' | 'doc', docKey?: any) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (!asset) {
        return;
      }

      const uri = asset.uri;
      if (type === 'profile') {
        try {
          const avatarData = new FormData();
          avatarData.append('file', {
            uri: asset.uri,
            name: asset.fileName || 'avatar.jpg',
            type: asset.mimeType || 'image/jpeg',
          } as any);

          const res = await apiRequest('/pakiship/mobile/driver/profile/upload-avatar', {
            method: 'POST',
            body: avatarData,
          });

          if (res.profilePicture) {
            setProfilePicture(res.profilePicture);
          }
        } catch (error) {
          console.error('Avatar upload failed:', error);
          Alert.alert("Error", "Failed to upload profile picture.");
        }
      }
    }
  };

  const userInitials = formData.name 
    ? formData.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : 'US';

  return (
    <SafeAreaView className="flex-1 bg-[#F0F9F8]">
      {/* Header */}
      <View className="h-16 bg-white border-b border-[#39B5A8]/10 flex-row items-center px-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center gap-2">
          <ArrowLeft size={20} className="text-[#39B5A8]" />
          <Text className="font-bold text-[#39B5A8]">Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-[#041614] text-lg mr-10">Profile Settings</Text>
      </View>

      <ScrollView className="flex-1 px-4 pt-4 pb-20">
        {/* Profile Card */}
        <View className="bg-white rounded-[32px] p-5 border border-[#39B5A8]/10 shadow-sm flex-row items-center gap-4 mb-6">
          <View className="relative">
            <View className="w-20 h-20 rounded-[24px] bg-[#1A5D56] items-center justify-center overflow-hidden border-2 border-[#F0F9F8]">
              {profilePicture ? (
                <Image source={{ uri: profilePicture }} className="w-full h-full" />
              ) : (
                <Text className="text-3xl font-black text-white">{userInitials}</Text>
              )}
            </View>
            <TouchableOpacity 
              onPress={() => pickImage('profile')}
              className="absolute -bottom-1 -right-1 bg-[#39B5A8] p-1.5 rounded-lg border-2 border-white shadow-lg"
            >
              <Camera size={14} className="text-white" />
            </TouchableOpacity>
          </View>
          <View className="flex-1">
            <Text className="text-xl font-black text-[#041614] leading-tight">{formData.name}</Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <Text className="text-[10px] font-black text-[#39B5A8] uppercase tracking-widest">Driver Account</Text>
              <CheckCircle2 size={12} className="text-green-500" />
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="bg-white p-1 rounded-2xl border border-[#39B5A8]/10 shadow-sm flex-row mb-6">
          {(['profile', 'vehicle', 'preferences'] as TabType[]).map((tab) => (
            <TouchableOpacity 
              key={tab} 
              onPress={() => setActiveTab(tab)}
              className={`flex-1 py-2.5 rounded-xl items-center ${activeTab === tab ? 'bg-[#F0F9F8]' : ''}`}
            >
              <Text className={`text-xs font-bold capitalize ${activeTab === tab ? 'text-[#39B5A8]' : 'text-gray-400'}`}>
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'profile' && (
          <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-5">
            <View className="flex-row items-center justify-between mb-2">
              <Text className="text-2xl font-black text-[#041614]">Personal Details</Text>
              <TouchableOpacity 
                onPress={() => setIsEditing(!isEditing)}
                className={`p-2 rounded-xl border ${isEditing ? 'bg-red-50 border-red-200' : 'bg-[#39B5A8] border-[#39B5A8]'}`}
              >
                <Pencil size={18} className={isEditing ? 'text-red-500' : 'text-white'} />
              </TouchableOpacity>
            </View>

            <FormInput label="Full Name" value={formData.name} onChangeText={(v: string) => setFormData({...formData, name: v})} icon={<User />} readOnly={!isEditing} />
            <FormInput label="Email Address" value={formData.email} onChangeText={(v: string) => setFormData({...formData, email: v})} icon={<Mail />} readOnly={!isEditing} />
            <FormInput label="Phone Number" value={formData.phone} onChangeText={(v: string) => setFormData({...formData, phone: v})} icon={<Phone />} readOnly={!isEditing} />
            <FormInput label="Primary Address" value={formData.address} onChangeText={(v: string) => setFormData({...formData, address: v})} icon={<MapPin />} readOnly={!isEditing} />

             <View className="pt-4 mt-2 border-t border-gray-50">
               <TouchableOpacity 
                 onPress={() => setShowPasswordModal(true)}
                 className="flex-row items-center justify-between py-2"
               >
                 <View className="flex-row items-center gap-3">
                   <View className="p-2 bg-gray-50 rounded-lg"><Lock size={18} className="text-gray-400" /></View>
                   <Text className="font-bold text-[#041614]">Password & Security</Text>
                 </View>
                 <ArrowRight size={16} className="text-gray-300" />
               </TouchableOpacity>
            </View>

            {/* Logout Button */}
            <View className="pt-4 border-t border-gray-50">
               <TouchableOpacity 
                 onPress={() => setShowLogoutModal(true)}
                 className="flex-row items-center justify-between py-2"
               >
                 <View className="flex-row items-center gap-3">
                   <View className="p-2 bg-red-50 rounded-lg"><LogOut size={18} className="text-red-500" /></View>
                   <Text className="font-bold text-red-500">Log Out of Account</Text>
                 </View>
                 <ArrowRight size={16} className="text-gray-200" />
               </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'vehicle' && (
          <View className="space-y-6">
            <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-4">
              <Text className="text-xl font-black text-[#041614] mb-2">Verification Documents</Text>
              <DocItem label="Driver's License" status="Verified" icon={<Shield />} />
              <DocItem label="Vehicle OR/CR" status="Verified" icon={<FileText />} />
              <DocItem label="Selfie with ID" status="Verified" icon={<User />} />
            </View>

            <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-4">
              <Text className="text-xl font-black text-[#041614] mb-2">Vehicle Info</Text>
              <View className="flex-row gap-4">
                <View className="flex-1"><Text className="text-[10px] font-black text-[#39B5A8] uppercase mb-1">Type</Text><Text className="font-bold text-[#041614]">{vehicleData.vehicleType}</Text></View>
                <View className="flex-1"><Text className="text-[10px] font-black text-[#39B5A8] uppercase mb-1">Plate No.</Text><Text className="font-bold text-[#041614]">{vehicleData.plateNumber}</Text></View>
              </View>
              <View><Text className="text-[10px] font-black text-[#39B5A8] uppercase mb-1">License No.</Text><Text className="font-bold text-[#041614]">{vehicleData.licenseNumber}</Text></View>
              <View className="p-4 bg-amber-50 rounded-2xl border border-amber-100 mt-2">
                <Text className="text-[10px] text-amber-800 leading-tight">To update vehicle information, please contact support for re-verification.</Text>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'preferences' && (
          <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-4">
            <Text className="text-xl font-black text-[#041614] mb-4">App Preferences</Text>
            <ToggleItem 
              label="Job Notifications" 
              desc="Alerts for new requests" 
              value={preferences.jobNotifications} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, jobNotifications: val}))} 
            />
            <ToggleItem 
              label="Auto-accept" 
              desc="Instantly accept nearby jobs" 
              value={preferences.autoAcceptJobs} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, autoAcceptJobs: val}))} 
            />
            <ToggleItem 
              label="2FA Security" 
              desc="Dual-layer verification" 
              value={preferences.twoFactor} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, twoFactor: val}))} 
            />
          </View>
        )}

        <View className="h-20" />
      </ScrollView>

      {/* Fixed Bottom Action Bar */}
      <View 
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-[#39B5A8]/10 px-6 pt-4 pb-8 flex-row items-center"
        style={{ paddingBottom: Math.max(insets.bottom, 16) }}
      >
        <View className="flex-1 mr-2">
          <View className="flex-row items-center gap-1.5 mb-0.5">
            <ShieldCheck size={14} className="text-[#39B5A8]" />
            <Text className="text-[9px] font-black text-[#39B5A8] uppercase tracking-widest">2FA Security</Text>
          </View>
          <View className="flex-row items-center">
            <Text className="text-[11px] font-bold text-[#041614] flex-1 mr-2" numberOfLines={1}>Account Protection</Text>
            <Switch 
              trackColor={{ false: '#e4e4e7', true: '#39B5A8' }}
              thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
              value={preferences.twoFactor} 
              onValueChange={(val) => setPreferences((p) => ({...p, twoFactor: val}))} 
              style={{ transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }] }}
            />
          </View>
        </View>

        <TouchableOpacity 
          onPress={handleSave}
          disabled={saving}
          className={`bg-[#39B5A8] px-10 py-3.5 rounded-2xl items-center shadow-lg shadow-[#39B5A8]/30 ${saving ? 'opacity-50' : ''}`}
        >
          <Text className="text-white font-black uppercase tracking-widest text-[11px]">
            {saving ? 'Saving...' : 'Save All'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Security Modal */}
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
      <Modal transparent visible={showPasswordModal} animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-black text-[#041614]">Security Update</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}><X size={24} className="text-gray-300" /></TouchableOpacity>
            </View>
            <View className="space-y-4">
              <FormInput label="Current Password" value={passwordData.current} onChangeText={(v: string) => setPasswordData({...passwordData, current: v})} placeholder="Enter current password" secureTextEntry />
              <FormInput label="New Password" value={passwordData.new} onChangeText={(v: string) => setPasswordData({...passwordData, new: v})} placeholder="Enter new password" secureTextEntry />
            </View>
            <TouchableOpacity 
              className="bg-[#041614] py-4 rounded-2xl items-center mt-8"
              onPress={() => setShowPasswordModal(false)}
            >
              <Text className="text-white font-black uppercase tracking-widest text-sm">Update Password</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function FormInput({ label, icon, value, onChangeText, readOnly, placeholder, secureTextEntry }: any) {
  return (
    <View className="space-y-1">
      <Text className="text-[10px] font-black text-[#39B5A8] uppercase tracking-widest ml-1">{label}</Text>
      <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${readOnly ? 'bg-gray-50 border-gray-100' : 'bg-[#F0F9F8] border-transparent'}`}>
        <View className="text-[#39B5A8]/60 mr-3">{cloneElement(icon, { size: 18 })}</View>
        <TextInput 
          className={`flex-1 font-bold text-[#041614] ${readOnly ? 'text-gray-400' : ''}`}
          value={value}
          onChangeText={onChangeText}
          editable={!readOnly}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function DocItem({ label, status, icon }: any) {
  return (
    <View className="flex-row items-center justify-between p-4 bg-[#F0F9F8]/50 rounded-2xl border border-[#39B5A8]/05">
      <View className="flex-row items-center gap-3">
        <View className="p-2 bg-white rounded-xl shadow-sm text-[#39B5A8]">{cloneElement(icon, { size: 18 })}</View>
        <View>
          <Text className="font-bold text-[#041614] text-xs">{label}</Text>
          <Text className="text-[9px] text-gray-400 font-bold uppercase tracking-tight">{status}</Text>
        </View>
      </View>
      <CheckCircle2 size={16} className="text-green-500" />
    </View>
  );
}

function ToggleItem({ label, desc, value, onValueChange }: ToggleItemProps) {
  return (
    <View className="flex-row items-center justify-between py-2">
      <View className="flex-1 mr-4">
        <Text className="font-bold text-[#1A5D56]">{label}</Text>
        <Text className="text-[10px] text-gray-400 font-medium">{desc}</Text>
      </View>
      <Switch 
        value={value} 
        onValueChange={onValueChange}
        trackColor={{ false: '#e4e4e7', true: '#39B5A8' }}
        thumbColor={Platform.OS === 'ios' ? undefined : '#ffffff'}
      />
    </View>
  );
}
