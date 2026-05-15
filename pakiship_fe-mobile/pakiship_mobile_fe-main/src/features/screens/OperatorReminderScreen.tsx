import React from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Building2, Store, FileText, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/types';

export default function OperatorReminderScreen() {
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
        <View className="bg-[#F6F8FF] p-5 rounded-[22px] border border-[#EBEDFB] mb-6 flex-row items-center shadow-sm" style={{ shadowColor: '#4F46E5', shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 }}>
          <View className="w-12 h-12 bg-white rounded-full flex items-center justify-center border border-[#EBEDFB] mr-4 shadow-sm">
            <Building2 color="#4F46E5" size={24} strokeWidth={2.5} />
          </View>
          <View className="flex-1">
            <Text className="text-[20px] font-extrabold text-dark leading-snug mb-0.5 pt-1">
              Paalala para sa mga{'\n'}Partner Business
            </Text>
            <Text className="text-[12px] text-gray-500 font-medium">Basahin maigi bago magpatuloy.</Text>
          </View>
        </View>

        {/* Requirements Cards */}
        <View className="space-y-4 pb-10">
          <RequirementCard 
            icon={<Store color="#10B981" size={20} strokeWidth={2.5} />} 
            title="PHYSICAL LOCATION" 
            text="Dapat ay mayroong physical space o establishment para sa parcel drop-off at pickup." 
          />
          <RequirementCard 
            icon={<FileText color="#0EA5E9" size={20} strokeWidth={2.5} />} 
            title="BUSINESS COMPLIANCE" 
            text="Siguraduhing updated ang DTI/SEC at Mayor's Permit ng inyong lokasyon." 
          />
          <RequirementCard 
            icon={<MapPin color="#F97316" size={20} strokeWidth={2.5} />} 
            title="ACCESSIBLE AREA" 
            text="Ang lokasyon ay dapat madaling mapuntahan ng mga riders at customers." 
          />
        </View>
      </ScrollView>

      {/* Footer Area with Proceed Button */}
      <View className="px-5 py-6 border-t border-gray-50 bg-white">
        <TouchableOpacity 
          className="bg-dark rounded-[24px] h-[60px] items-center justify-center shadow-md mb-4"
          onPress={() => navigation.navigate('Signup', { role: 'operator' })}
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
