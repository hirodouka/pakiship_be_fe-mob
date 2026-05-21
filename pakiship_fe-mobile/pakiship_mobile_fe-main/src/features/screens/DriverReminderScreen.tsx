import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, AlertCircle, HeartPulse, Smartphone, ShieldCheck, Info } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/types';

export default function DriverReminderScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
        <TouchableOpacity className="p-2 -ml-2" onPress={() => navigation.canGoBack() && navigation.goBack()}>
          <ChevronLeft color="#39B5A8" size={28} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text className="flex-1 text-[17px] font-bold text-dark text-center mr-8">
          Registration Requirements
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1 px-5 pt-6">
        
        {/* Main Alert Card */}
        <View className="bg-[#FBFEFD] p-5 rounded-[22px] border border-[#EAF5F3] mb-6 flex-row items-center shadow-sm" style={{ shadowColor: '#39B5A8', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
          <View className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-[#EAF5F3] mr-4 shadow-sm">
            <AlertCircle color="#39B5A8" size={24} strokeWidth={2.5} />
          </View>
          <View className="flex-1">
            <Text className="text-[20px] font-extrabold text-dark leading-snug mb-0.5">
              Paalala para sa Rider
            </Text>
            <Text className="text-[13px] text-gray-500 font-medium">Basahin maigi bago magpatuloy.</Text>
          </View>
        </View>

        {/* Requirements Cards */}
        <View className="space-y-4 pb-10">
          <RequirementCard 
            icon={<HeartPulse color="#E11D48" size={20} strokeWidth={2.5} />} 
            title="PARA SA EDAD 51-65" 
            text='Siguraduhing may Medical Certificate na "Fit to Drive Motorcycle" bago magpatuloy.' 
          />
          <RequirementCard 
            icon={<Smartphone color="#3B82F6" size={20} strokeWidth={2.5} />} 
            title="PHONE REQUIREMENTS" 
            text="Gumamit ng Android (V10 pataas) o Huawei device. Hindi pa suportado ang iOS sa kasalukuyan." 
          />
          <RequirementCard 
            icon={<ShieldCheck color="#39B5A8" size={20} strokeWidth={2.5} />} 
            title="DOKUMENTONG KAILANGAN" 
            text="Ihanda ang iyong Driver's License at Vehicle OR/CR. Siguraduhing ito ay orihinal at malinaw." 
          />
          <RequirementCard 
            icon={<Info color="#F59E0B" size={20} strokeWidth={2.5} />} 
            title="PROFESSIONALISM" 
            text="Inaasahan ang maayos na pakikitungo sa mga customer at pagsunod sa batas trapiko." 
          />
        </View>
      </ScrollView>

      {/* Footer Area with Proceed Button */}
      <View className="px-5 py-6 border-t border-gray-50 bg-white">
        <TouchableOpacity 
          className="bg-dark rounded-[24px] h-[60px] items-center justify-center shadow-md mb-4"
          onPress={() => navigation.navigate('Signup', { role: 'driver' })}
        >
          <Text className="text-white font-extrabold tracking-widest uppercase text-[14px]">Proceed To Sign Up</Text>
        </TouchableOpacity>
        <Text className="text-[10px] text-[#A6B2B0] text-center font-medium leading-[14px] px-4">
          Sa pag-proceed, kinukumpirma mo na ang inyong hub ay sumusunod sa mga requirement.
        </Text>
      </View>
    </SafeAreaView>
  );
}

function RequirementCard({ icon, title, text }: { icon: React.ReactNode, title: string, text: string }) {
  return (
    <View className="p-6 bg-[#FBFEFD] border border-[#EAF5F3] rounded-[24px] mb-4">
      <View className="flex-row items-center mb-2">
        <View className="mr-3">
          {icon}
        </View>
        <Text className="font-extrabold text-[12px] text-dark uppercase tracking-widest flex-1">
          {title}
        </Text>
      </View>
      <Text className="text-[13px] text-gray-500 font-medium leading-[20px] pl-8">
        {text}
      </Text>
    </View>
  );
}
