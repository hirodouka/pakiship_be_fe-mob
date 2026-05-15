import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, MapPin, Camera, UploadCloud, CheckCircle2, HeartPulse } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { RootStackParamList } from '@navigation/types';
import { authApi } from '../services/authApi';

interface UploadBoxProps {
  label: string;
  icon?: React.ReactNode;
  value: boolean;
  onPress: () => void;
}

type DocumentState = {
  dl: boolean;
  orcr: boolean;
  medical: boolean;
  dti: boolean;
  permit: boolean;
  location: boolean;
  selfie: boolean;
};

const UploadBox = ({ label, icon, value, onPress }: UploadBoxProps) => (
  <TouchableOpacity 
    onPress={onPress}
    activeOpacity={0.7}
    className={`w-full flex-row items-center justify-between p-5 border-2 border-dashed rounded-[24px] mb-4 ${
      value ? "border-[#39B5A8] bg-[#EAF5F3]" : "border-[#39B5A8]/30 bg-[#F4FBFA]"
    }`}
  >
    <View className="flex-row items-center space-x-4 flex-1">
      <View className="w-14 h-14 bg-white rounded-2xl items-center justify-center border-2 border-[#39B5A8]/10 shadow-sm">
        {value ? (
          <CheckCircle2 color="#10B981" size={28} />
        ) : (
          icon || <UploadCloud color="#0EA5E9" size={28} />
        )}
      </View>
      <View className="flex-1 pr-2">
        <Text className="text-[15px] font-bold text-[#041614] mb-1" numberOfLines={1}>
          {value ? `${label}_doc.jpg` : label}
        </Text>
        <Text className="text-[10px] text-[#39B5A8] font-bold uppercase tracking-widest">
          {value ? 'Uploaded' : 'Tap to Select'}
        </Text>
      </View>
    </View>
    {value && (
      <View className="bg-[#39B5A8] px-3 py-1 rounded-full shadow-sm">
        <Text className="text-[10px] font-bold text-white">124 KB</Text>
      </View>
    )}
  </TouchableOpacity>
);

export default function SignupStep3Screen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, 'SignupStep3'>>();
  const { role, fullName, dob, mobile, email, street, city, province, password } =
    route.params;

  // Form State (Mock documents)
  const [docs, setDocs] = useState<DocumentState>({
    dl: false,
    orcr: false,
    medical: false,
    dti: false,
    permit: false,
    location: false,
    selfie: false
  });
  
  const [agreed, setAgreed] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleDoc = (key: keyof DocumentState) => {
    // Mock the file pick logic
    Alert.alert(
      'Upload Document',
      `Simulating document upload for ${key}...`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Simulate Upload', onPress: () => setDocs(prev => ({ ...prev, [key]: true })) }
      ]
    );
  };

  // Determine required documents based on role
  const isDriver = role === 'driver' || role === 'parcel_sender'; // Fallback mapping in case parcel_sender acts like a driver role in the app flow (though usually driver is driver)

  // Validation
  const isFormValid = isDriver 
    ? (docs.dl && docs.orcr && docs.selfie && agreed) // Assuming medical is optional here, adjust if needed
    : (docs.dti && docs.permit && docs.location && docs.selfie && agreed); // Operator validation

  const handleSubmit = async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }

    try {
      setIsSubmitting(true);
      await authApi.signup({
        role,
        fullName,
        dob,
        mobile,
        email,
        street,
        city,
        province,
        password,
        documents: Object.keys(docs).filter(k => docs[k as keyof DocumentState]),
      });

      Alert.alert('Registration Complete', 'Welcome to PakiSHIP!', [
        { text: 'OK', onPress: () => navigation.navigate('Login' as never) }
      ]);
    } catch (error) {
      Alert.alert(
        'Signup failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 bg-white z-10">
        <TouchableOpacity className="p-2 -ml-2" onPress={() => navigation.canGoBack() && navigation.goBack()}>
          <ChevronLeft color="#39B5A8" size={28} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] font-bold text-dark text-center mr-8">
          Verify Identity
        </Text>
      </View>

      {/* Progress Bar (Step 3 is 3/3 complete) */}
      <View className="h-1.5 w-full bg-[#E5F3F1] flex-row">
        <View className="h-full w-full bg-[#39B5A8]" />
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }} className="flex-1 px-7 pt-10">
        <Text className="text-[11px] font-bold text-primary tracking-[3px] uppercase mb-2">
          Final Step
        </Text>
        <Text className="text-[26px] font-extrabold text-[#041614] tracking-tight mb-2">
          Verify your identity
        </Text>
        <Text className="text-[13px] font-medium text-[#B0BDBA] mb-8">
          Please upload clear photos of your documents.
        </Text>

        <View className="space-y-1">
          {isDriver ? (
            <>
              <UploadBox 
                label="Driver's License" 
                value={docs.dl} 
                onPress={() => toggleDoc('dl')} 
              />
              <UploadBox 
                label="Vehicle OR/CR" 
                value={docs.orcr} 
                onPress={() => toggleDoc('orcr')} 
              />
              <UploadBox 
                label="Medical Certificate" 
                icon={<HeartPulse color="#F43F5E" size={28} />}
                value={docs.medical} 
                onPress={() => toggleDoc('medical')} 
              />
            </>
          ) : (
            <>
              <UploadBox 
                label="DTI / SEC Certificate" 
                value={docs.dti} 
                onPress={() => toggleDoc('dti')} 
              />
              <UploadBox 
                label="Business Permit" 
                value={docs.permit} 
                onPress={() => toggleDoc('permit')} 
              />
              <UploadBox 
                label="Proof of Location" 
                icon={<MapPin color="#0EA5E9" size={28} />}
                value={docs.location} 
                onPress={() => toggleDoc('location')} 
              />
            </>
          )}

          <View className="mt-2" />
          <UploadBox 
            label="Selfie with ID" 
            icon={<Camera color="#0EA5E9" size={28} />}
            value={docs.selfie} 
            onPress={() => toggleDoc('selfie')} 
          />
        </View>

        {/* Terms & Conditions Checkbox */}
        <TouchableOpacity 
          activeOpacity={0.8}
          onPress={() => setAgreed(!agreed)}
          className="flex-row items-center bg-[#F4FBFA] border border-[#39B5A8]/20 p-5 rounded-[24px] mt-6"
        >
          <View className={`w-6 h-6 rounded-lg border-2 items-center justify-center mr-4 ${agreed ? 'bg-[#39B5A8] border-[#39B5A8]' : 'border-[#B0BDBA] bg-white'}`}>
            {agreed && <CheckCircle2 color="white" size={16} strokeWidth={3} />}
          </View>
          <Text className="flex-1 text-[12px] text-[#041614] font-medium leading-[18px]">
            I accept the <Text className="text-[#39B5A8] font-bold">Terms & Conditions</Text> and <Text className="text-[#39B5A8] font-bold">Privacy Policy</Text>. I confirm all uploaded documents are authentic.
          </Text>
        </TouchableOpacity>

      </ScrollView>

      <View className="px-6 py-6 border-t-[0px] border-transparent bg-white">
        <TouchableOpacity 
          onPress={handleSubmit}
          activeOpacity={0.8}
          disabled={!isFormValid || isSubmitting}
          className={`rounded-[24px] h-[60px] items-center justify-center shadow-sm ${isFormValid && !isSubmitting ? 'bg-[#39B5A8]' : 'bg-[#B0BDBA]'}`}
        >
          <Text className="text-white font-extrabold tracking-[2px] uppercase text-[13px]">
            {isSubmitting ? 'Submitting...' : 'Complete Signup'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
