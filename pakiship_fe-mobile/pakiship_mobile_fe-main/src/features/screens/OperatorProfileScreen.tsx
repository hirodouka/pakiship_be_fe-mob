import { useEffect, useState, useRef, cloneElement, isValidElement } from 'react';
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
  ArrowLeft, User, Mail, Phone, MapPin, Save,
  Camera, Lock, Eye, EyeOff, ShieldCheck,
  Bell, MessageSquare, Package, Shield, Upload, CheckCircle2,
  Briefcase, Clock, Calendar, FileCheck, FileText, X, RefreshCw, Pencil,
  Building2, FileBadge, Map, AlertTriangle
} from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthSession } from '../context/AuthSessionContext';

type TabType = 'profile' | 'compliance' | 'preferences';

type PreferenceState = {
  emailNotifications: boolean;
  smsAlerts: boolean;
  parcelAlerts: boolean;
  twoFactor: boolean;
};

type ToggleItemProps = {
  label: string;
  desc: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
};

import { apiRequest } from '../services/api';

export default function OperatorProfileScreen() {
  const navigation = useNavigation<any>();
  const { currentUser } = useAuthSession();
  
  const [activeTab, setActiveTab] = useState<TabType>('profile');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  
  const [profilePicture, setProfilePicture] = useState<string | null>(null);

  const [profileData, setProfileData] = useState({
    name: '',
    email: '',
    phone: 'N/A',
    birthDate: 'N/A',
    hubLocation: 'BGC Central Hub',
    hubAddress: 'Taguig City, Metro Manila',
  });

  const fetchHubData = async () => {
    try {
      setLoading(true);
      const hubRes = await apiRequest('/pakiship/mobile/operator/hub-summary');
      const [y, m, d] = (currentUser?.dob || '').split('-');
      const displayDob = m && d && y ? `${m}/${d}/${y}` : (currentUser?.dob || 'N/A');

      setProfileData(prev => ({
        ...prev,
        name: currentUser?.fullName || 'Operator',
        email: currentUser?.email || 'operator@pakiship.ph',
        birthDate: displayDob,
        hubLocation: hubRes.hubName,
      }));
    } catch (error) {
      console.error('Failed to fetch hub data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHubData();
  }, [currentUser]);

  const [preferences, setPreferences] = useState({
    emailNotifications: true,
    smsAlerts: true,
    parcelAlerts: true,
    twoFactor: false,
  });

  if (loading) return null;

  const [docs, setDocs] = useState({
    dti: { url: 'verified', type: 'image/png' },
    permit: { url: 'verified', type: 'image/png' },
    location: { url: 'verified', type: 'image/png' }
  });

  const handleSave = () => {
    setIsEditing(false);
    Alert.alert("Success", "Operator profile updated!");
    navigation.goBack();
  };

  const pickImage = async (type: 'profile' | 'doc', docKey?: keyof typeof docs) => {
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
        setProfilePicture(uri);
      } else if (docKey) {
        setDocs(prev => ({
          ...prev,
          [docKey]: { url: uri, type: 'image' }
        }));
      }
    }
  };

  const userInitials = profileData.name 
    ? profileData.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) 
    : 'OP';

  return (
    <SafeAreaView className="flex-1 bg-[#F0F9F8]">
      {/* Header */}
      <View className="h-16 bg-white border-b border-[#39B5A8]/10 flex-row items-center px-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="flex-row items-center gap-2">
          <ArrowLeft size={20} className="text-[#39B5A8]" />
          <Text className="font-bold text-[#39B5A8]">Back</Text>
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-[#041614] text-lg mr-10">Operator Profile</Text>
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
            <Text className="text-xl font-black text-[#041614] leading-tight">{profileData.name}</Text>
            <View className="flex-row items-center gap-1.5 mt-1">
              <Text className="text-[10px] font-black text-[#39B5A8] uppercase tracking-widest">Operator @ {profileData.hubLocation}</Text>
              <CheckCircle2 size={12} className="text-green-500" />
            </View>
          </View>
        </View>

        {/* Tabs */}
        <View className="bg-white p-1 rounded-2xl border border-[#39B5A8]/10 shadow-sm flex-row mb-6">
          {(['profile', 'compliance', 'preferences'] as TabType[]).map((tab) => (
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

            <FormInput label="Full Name" value={profileData.name} icon={<User />} readOnly={!isEditing} />
            <FormInput label="Email Address" value={profileData.email} icon={<Mail />} readOnly={!isEditing} />
            <FormInput label="Phone Number" value={profileData.phone} icon={<Phone />} readOnly={!isEditing} />
            <FormInput label="Hub Location" value={profileData.hubLocation} icon={<Briefcase />} readOnly={!isEditing} />
            <FormInput label="Hub Address" value={profileData.hubAddress} icon={<MapPin />} readOnly={!isEditing} />

            <View className="pt-4 mt-2 border-t border-gray-50">
               <TouchableOpacity 
                 onPress={() => setShowPasswordModal(true)}
                 className="flex-row items-center justify-between py-2"
               >
                 <View className="flex-row items-center gap-3">
                   <View className="p-2 bg-gray-50 rounded-lg"><Lock size={18} className="text-gray-400" /></View>
                   <Text className="font-bold text-[#041614]">Security Settings</Text>
                 </View>
                 <ChevronRight size={16} className="text-gray-300" />
               </TouchableOpacity>
            </View>
          </View>
        )}

        {activeTab === 'compliance' && (
          <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-4">
            <Text className="text-xl font-black text-[#041614] mb-2">Business Documents</Text>
            <DocUploadItem label="DTI Registration" status="Verified" icon={<Building2 />} />
            <DocUploadItem label="Business Permit" status="Verified" icon={<FileBadge />} />
            <DocUploadItem label="Proof of Location" status="Verified" icon={<Map />} />
            <View className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mt-2">
              <Text className="text-[10px] text-blue-800 leading-tight">Your hub is fully verified and authorized to process parcels.</Text>
            </View>
          </View>
        )}

        {activeTab === 'preferences' && (
          <View className="bg-white rounded-[32px] p-6 border border-[#39B5A8]/10 shadow-sm space-y-4">
            <Text className="text-xl font-black text-[#041614] mb-4">Notification Settings</Text>
            <ToggleItem 
              label="Email Notifications" 
              desc="Daily summary reports" 
              value={preferences.emailNotifications} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, emailNotifications: val}))} 
            />
            <ToggleItem 
              label="SMS Alerts" 
              desc="Urgent hub alerts" 
              value={preferences.smsAlerts} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, smsAlerts: val}))} 
            />
            <ToggleItem 
              label="Parcel Alerts" 
              desc="When new parcels arrive" 
              value={preferences.parcelAlerts} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, parcelAlerts: val}))} 
            />
            <ToggleItem 
              label="Two-Factor Auth" 
              desc="Extra account security" 
              value={preferences.twoFactor} 
              onValueChange={(val) => setPreferences((p: PreferenceState) => ({...p, twoFactor: val}))} 
            />
          </View>
        )}

        <View className="h-20" />
      </ScrollView>

      {/* Save Button */}
      {isEditing && (
        <View className="absolute bottom-6 left-6 right-6">
          <TouchableOpacity 
            onPress={handleSave}
            className="bg-[#39B5A8] py-4 rounded-2xl items-center shadow-lg"
          >
            <Text className="text-white font-black uppercase tracking-widest text-sm">Save Changes</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Security Modal */}
      <Modal transparent visible={showPasswordModal} animationType="slide">
        <View className="flex-1 bg-black/60 justify-end">
          <View className="bg-white rounded-t-[40px] p-8 pb-12">
            <View className="flex-row items-center justify-between mb-6">
              <Text className="text-2xl font-black text-[#041614]">Security Update</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}><X size={24} className="text-gray-300" /></TouchableOpacity>
            </View>
            <View className="space-y-4">
              <FormInput label="Current Password" value="..." readOnly secureTextEntry />
              <FormInput label="New Password" value="" placeholder="Enter new password" secureTextEntry />
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

function FormInput({ label, icon, value, readOnly, placeholder, secureTextEntry }: any) {
  return (
    <View className="space-y-1">
      <Text className="text-[10px] font-black text-[#39B5A8] uppercase tracking-widest ml-1">{label}</Text>
      <View className={`flex-row items-center border rounded-2xl px-4 h-14 ${readOnly ? 'bg-gray-50 border-gray-100' : 'bg-[#F0F9F8] border-transparent'}`}>
        {isValidElement(icon) ? (
          <View className="text-[#39B5A8]/60 mr-3">{cloneElement(icon, { size: 18 } as any)}</View>
        ) : null}
        <TextInput 
          className={`flex-1 font-bold text-[#041614] ${readOnly ? 'text-gray-400' : ''}`}
          value={value}
          editable={!readOnly}
          placeholder={placeholder}
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );
}

function DocUploadItem({ label, status, icon }: any) {
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

function ChevronRight({ size, className }: any) {
  return <ArrowLeft size={size} className={className} style={{ transform: [{ rotate: '180deg' }] }} />;
}
