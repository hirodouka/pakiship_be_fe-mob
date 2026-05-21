import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Map, Building2, MapPin, Lock, Eye, EyeOff } from 'lucide-react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/types';
import { authApi } from '../services/authApi';

export default function SignupStep2Screen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, 'SignupStep2'>>();
  const { role, fullName, firstName, lastName, dob, mobile, email } = route.params;
  const isParcelSender = role === 'parcel_sender';

  // Form State
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validation
  const isFormValid = 
    street.trim() !== '' && 
    city.trim() !== '' && 
    province.trim() !== '' && 
    password.length >= 8 &&
    confirmPassword === password;

  const handleContinue = async () => {
    if (!isFormValid || isSubmitting) {
      return;
    }

    if (isParcelSender) {
      try {
        setIsSubmitting(true);
        await authApi.signup({
          role,
          fullName,
          firstName,
          lastName,
          dob,
          mobile,
          email,
          street,
          city,
          province,
          password,
        });

        Alert.alert('Registration Complete', 'Welcome to PakiSHIP!', [
          { text: 'OK', onPress: () => navigation.navigate('Login') }
        ]);
      } catch (error) {
        Alert.alert(
          'Signup failed',
          error instanceof Error ? error.message : 'Please try again.',
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    navigation.navigate('SignupStep3', {
      role,
      fullName,
      firstName,
      lastName,
      dob,
      mobile,
      email,
      street,
      city,
      province,
      password,
    });
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
            Secure Account
          </Text>
        </View>

        {/* Progress Bar */}
        <View className="h-1.5 w-full bg-[#E5F3F1] flex-row">
          <View className={`h-full bg-[#39B5A8] ${isParcelSender ? 'w-full' : 'w-2/3'}`} />
        </View>

        <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1 px-7 pt-10">
          <Text className="text-[11px] font-bold text-primary tracking-[3px] uppercase mb-2">
            {isParcelSender ? 'Final Step' : 'Step 2'}
          </Text>
          <Text className="text-[26px] font-extrabold text-dark tracking-tight mb-8">
            Address & Security
          </Text>

          <View className="space-y-6">
            
            {/* Street Address */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Street Address</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16 border border-transparent">
                <Map color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="123 Mabini St. Brgy. 4"
                  placeholderTextColor="#B0BDBA"
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={street}
                  onChangeText={setStreet}
                />
              </View>
            </View>

            {/* City and Province */}
            <View className="flex-row items-center space-x-4">
              <View className="flex-1">
                <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">City</Text>
                <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-4 py-4 h-16">
                  <Building2 color="#39B5A8" size={20} strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-[14px] text-dark font-medium leading-tight p-0"
                    placeholder="Quezon City"
                    placeholderTextColor="#B0BDBA"
                    underlineColorAndroid="transparent"
                    selectionColor="#39B5A8"
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    value={city}
                    onChangeText={setCity}
                  />
                </View>
              </View>

              <View className="flex-1">
                <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Province</Text>
                <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-4 py-4 h-16">
                  <MapPin color="#39B5A8" size={20} strokeWidth={2} />
                  <TextInput
                    className="flex-1 ml-3 text-[14px] text-dark font-medium leading-tight p-0"
                    placeholder="Metro Manila"
                    placeholderTextColor="#B0BDBA"
                    underlineColorAndroid="transparent"
                    selectionColor="#39B5A8"
                    textContentType="oneTimeCode"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    value={province}
                    onChangeText={setProvince}
                  />
                </View>
              </View>
            </View>

            {/* Divider */}
            <View className="h-[1px] bg-[#EAF5F3] my-2" />

            {/* Set Password */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Set Password</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16">
                <Lock color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="8+ chars, number, symbol"
                  placeholderTextColor="#B0BDBA"
                  secureTextEntry={!showPassword}
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={password}
                  onChangeText={setPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} className="pl-3 py-1">
                  {showPassword ? (
                    <EyeOff color="#9CA3AF" size={22} strokeWidth={2} />
                  ) : (
                    <Eye color="#9CA3AF" size={22} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* Confirm Password */}
            <View>
              <Text className="text-[11px] font-bold text-primary tracking-widest uppercase ml-1 mb-2">Confirm Password</Text>
              <View className="flex-row items-center bg-[#F4FBFA] rounded-[22px] px-5 py-4 h-16">
                <Lock color="#39B5A8" size={22} strokeWidth={2} />
                <TextInput
                  className="flex-1 ml-4 text-[15px] text-dark font-medium leading-tight p-0"
                  placeholder="Repeat password"
                  placeholderTextColor="#B0BDBA"
                  secureTextEntry={!showConfirmPassword}
                  underlineColorAndroid="transparent"
                  selectionColor="#39B5A8"
                  textContentType="oneTimeCode"
                  autoComplete="off"
                  autoCorrect={false}
                  spellCheck={false}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                />
                <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)} className="pl-3 py-1">
                  {showConfirmPassword ? (
                    <EyeOff color="#9CA3AF" size={22} strokeWidth={2} />
                  ) : (
                    <Eye color="#9CA3AF" size={22} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

          </View>
        </ScrollView>

        <View className="px-6 py-6 border-t-[0px] border-transparent bg-white">
          <TouchableOpacity 
            onPress={handleContinue}
            activeOpacity={0.8}
            disabled={!isFormValid || isSubmitting}
            className={`rounded-[24px] h-[60px] items-center justify-center shadow-sm ${isFormValid && !isSubmitting ? 'bg-[#39B5A8]' : 'bg-[#B0BDBA]'}`}
          >
            <Text className="text-white font-extrabold tracking-[2px] uppercase text-[13px]">
              {isSubmitting ? 'Submitting...' : isParcelSender ? 'Complete Signup' : 'Continue'}
            </Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
