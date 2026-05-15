import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, Mail, Calendar } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/types';

export default function SignupScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'Signup'>>();
  const { role } = route.params;

  // Form State
  const [fullName, setFullName] = useState('');
  const [dob, setDob] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');

  const handleDobChange = (text: string) => {
    let cleaned = text.replace(/\D/g, '').substring(0, 8);
    let formatted = '';
    for (let i = 0; i < cleaned.length; i++) {
      if (i === 2 || i === 4) {
        formatted += '/';
      }
      formatted += cleaned[i];
    }
    setDob(formatted);
  };

  const handleMobileChange = (text: string) => {
    let cleaned = text.replace(/\D/g, '').substring(0, 10);
    let formatted = '';
    for (let i = 0; i < cleaned.length; i++) {
      if (i === 3 || i === 6) {
        formatted += ' ';
      }
      formatted += cleaned[i];
    }
    setMobile(formatted);
  };

  // Basic validation to enable button
  const isFormValid = fullName.trim() !== '' && dob.length === 10 && mobile.length === 12 && email.trim() !== '';

  const handleContinue = () => {
    if (isFormValid) {
      const [m, d, y] = dob.split('/');
      const isoDob = `${y}-${m}-${d}`;
      
      navigation.navigate('SignupStep2', {
        role,
        fullName: fullName.trim(),
        dob: isoDob,
        mobile,
        email: email.trim().toLowerCase(),
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
        
        {/* Header */}
        <View className="flex-row items-center px-4 py-3">
          <TouchableOpacity className="p-2 -ml-2" onPress={() => navigation.canGoBack() && navigation.goBack()}>
            <ChevronLeft color="#39B5A8" size={28} strokeWidth={2.5} />
          </TouchableOpacity>
          <Text className="flex-1 text-[17px] font-bold text-dark text-center mr-8">
            Personal Details
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="h-1.5 w-full bg-[#E5F3F1] flex-row">
          <View className="h-full w-1/3 bg-[#39B5A8]" />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1 px-7 pt-10">
          <Text className="text-[11px] font-bold text-primary tracking-[3px] uppercase mb-2">
            Step 1
          </Text>
          <Text className="text-[26px] font-extrabold text-dark tracking-tight mb-8">
            Tell us about yourself
          </Text>

          <View className="space-y-6">
            
            {/* Full Name */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Full Name</Text>
              <View className="flex-row items-center bg-[#FAFDDF]/0 border border-transparent bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16">
                <User color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="Juan Dela Cruz"
                  placeholderTextColor="#B0BDBA"
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={fullName}
                  onChangeText={setFullName}
                />
              </View>
            </View>

            {/* Date of Birth */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Date of Birth</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16">
                <Calendar color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="mm/dd/yyyy"
                  placeholderTextColor="#B0BDBA"
                  keyboardType="numeric"
                  maxLength={10}
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={dob}
                  onChangeText={handleDobChange}
                />
              </View>
            </View>

            {/* Mobile Number */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Mobile Number</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] h-16 overflow-hidden">
                <View className="bg-[#EEF7F6] h-full px-5 flex-row items-center justify-center border-r-[0px] border-transparent">
                  <Text className="text-[15px] font-bold text-[#041614] tracking-wider">+63</Text>
                </View>
                <TextInput
                  className="flex-1 px-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="912 345 6789"
                  placeholderTextColor="#B0BDBA"
                  keyboardType="numeric"
                  maxLength={12}
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={mobile}
                  onChangeText={handleMobileChange}
                />
              </View>
            </View>

            {/* Email Address */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Email Address</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16">
                <Mail color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="juandelacruz@email.com"
                  placeholderTextColor="#B0BDBA"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={email}
                  onChangeText={setEmail}
                />
              </View>
            </View>

          </View>
        </ScrollView>

        <View className="px-6 py-6 border-t-[0px] border-transparent bg-white">
          <TouchableOpacity 
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!isFormValid}
            className={`rounded-[24px] h-[60px] items-center justify-center shadow-sm ${isFormValid ? 'bg-[#39B5A8]' : 'bg-[#B0BDBA]'}`}
          >
            <Text className="text-white font-extrabold tracking-[2px] uppercase text-[13px]">Continue</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
