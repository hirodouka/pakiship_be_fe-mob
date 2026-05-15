import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, User, Truck, MapPin } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@navigation/types';

export default function RoleSelectionScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  return (
    <SafeAreaView className="flex-1 bg-white">
      {/* Header */}
      <View className="flex-row items-center px-4 py-3 border-b border-gray-50">
        <TouchableOpacity className="p-2 -ml-2" onPress={() => navigation.canGoBack() && navigation.goBack()}>
          <ChevronLeft color="#39B5A8" size={28} strokeWidth={2.5} />
        </TouchableOpacity>
        <Text className="flex-1 text-[18px] font-bold text-dark text-center mr-8">
          Join PakiSHIP
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ flexGrow: 1 }} className="flex-1 px-6 pt-10">
        <View className="items-center mb-10">
          <Text className="text-[13px] font-extrabold text-primary tracking-[3px] uppercase mb-4">
            Create Account
          </Text>
          <Text className="text-[36px] leading-[42px] font-extrabold text-dark tracking-tight text-center">
            Join the PakiSHIP
          </Text>
          <Text className="text-[36px] leading-[42px] font-extrabold text-dark tracking-tight text-center">
            community.
          </Text>
        </View>

        <View className="space-y-5 pb-10">
          <RoleCard 
            icon={<User color="#39B5A8" size={28} strokeWidth={2} />}
            title="Parcel Sender"
            description="I need to send and track parcels quickly."
            onPress={() => navigation.navigate('Signup', { role: 'parcel_sender' })}
          />
          <RoleCard 
            icon={<Truck color="#39B5A8" size={28} strokeWidth={2} />}
            title="Driver"
            description="I want to deliver and earn money."
            onPress={() => navigation.navigate('DriverReminder')}
          />
          <RoleCard 
            icon={<MapPin color="#39B5A8" size={28} strokeWidth={2} />}
            title="Operator"
            description="I want to manage a drop-off point."
            onPress={() => navigation.navigate('OperatorReminder')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function RoleCard({ icon, title, description, onPress }: any) {
  return (
    <TouchableOpacity 
      className="flex-row items-center bg-white border border-gray-100 rounded-[32px] p-5 mb-4"
      onPress={onPress}
      style={{
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
        elevation: 3,
      }}
    >
      <View className="w-[68px] h-[68px] rounded-[24px] bg-[#F1FAF8] items-center justify-center mr-5">
        {icon}
      </View>
      <View className="flex-1 pr-2">
        <Text className="text-[19px] font-bold text-dark mb-1">{title}</Text>
        <Text className="text-[14px] font-medium text-gray-400 leading-snug">
          {description}
        </Text>
      </View>
    </TouchableOpacity>
  );
}
