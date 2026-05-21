import { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Modal, 
  TextInput, 
  Pressable,
  Alert,
  ActivityIndicator
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  Package, ArrowLeft, CheckCircle2, Clock, QrCode, Search, User, MapPin, Calendar,
  ChevronRight
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Mock Assets
const logoImg = require("../../assets/icon.png"); 

type DropoffStatus = "pending" | "processing" | "received";

interface DropoffParcel {
  id: string;
  trackingNumber: string;
  sender: string;
  recipient: string;
  expectedArrival: string;
  status: DropoffStatus;
  packageSize: "Small" | "Medium" | "Large";
  origin: string;
  receivedAt?: string;
}

import { apiRequest } from "../services/api";

export default function ReceiveParcelScreen() {
  const navigation = useNavigation<any>();
  const [searchQuery, setSearchQuery] = useState("");
  const [pending, setPending] = useState<DropoffParcel[]>([]);
  const [received, setReceived] = useState<DropoffParcel[]>([]);
  const [scanningParcel, setScanningParcel] = useState<DropoffParcel | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchParcels = async () => {
    try {
      setLoading(true);
      const res = await apiRequest('/pakiship/mobile/operator/pending-parcels');
      setPending(res.parcels || []);
    } catch (error) {
      console.error('Failed to fetch operator parcels:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParcels();
  }, []);

  const handleScan = (parcel: DropoffParcel) => {
    setScanningParcel(parcel);
    setIsScanning(true);
    
    // Simulating scan
    setTimeout(() => {
      setIsScanning(false);
      handleReceive(parcel);
    }, 2500);
  };

  const handleReceive = async (parcel: DropoffParcel) => {
    try {
      await apiRequest(`/pakiship/mobile/operator/receive/${parcel.id}`, { method: 'POST' });
      const timeStr = new Date().toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' });
      const updated: DropoffParcel = { ...parcel, status: "received", receivedAt: timeStr };
      setPending(prev => prev.filter(p => p.id !== parcel.id));
      setReceived(prev => [updated, ...prev]);
      setScanningParcel(null);
      Alert.alert("Success", "Parcel received correctly!");
    } catch (error) {
      console.error('Failed to receive parcel:', error);
      Alert.alert("Error", "Could not process parcel. Please try again.");
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-[#F0F9F8]">
      {/* Header */}
      <View className="h-16 bg-white border-b border-[#39B5A8]/10 flex-row items-center px-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <ArrowLeft size={20} className="text-[#39B5A8]" />
        </TouchableOpacity>
        <View className="flex-1 items-center">
           <Text className="font-black text-[#041614] text-lg">Receive Parcel</Text>
           <Text className="text-[10px] text-[#39B5A8] font-bold uppercase tracking-widest">BGC Central Hub</Text>
        </View>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Search */}
        <View className="relative mb-6">
          <View className="absolute left-4 top-1/2 -translate-y-1/2 z-10">
            <Search size={16} className="text-gray-400" />
          </View>
          <TextInput 
            className="bg-white border border-[#39B5A8]/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold shadow-sm"
            placeholder="Search tracking number..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        {/* Categories */}
        <View className="mb-8">
           <Text className="text-sm font-black text-[#39B5A8] uppercase tracking-widest mb-4">Pending Drop-offs</Text>
           {pending.map((p, idx) => (
             <TouchableOpacity 
               key={`pending-${p.id ?? 'none'}-${idx}`} 
               onPress={() => handleScan(p)}
               className="bg-white border border-[#39B5A8]/10 rounded-3xl p-5 mb-3 shadow-sm"
             >
               <View className="flex-row items-center justify-between mb-3">
                 <View className="bg-[#F0F9F8] px-2.5 py-1 rounded-lg border border-[#39B5A8]/10">
                   <Text className="text-xs font-black text-[#39B5A8]">{p.trackingNumber}</Text>
                 </View>
                 <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                    <Text className="text-[10px] font-black text-blue-500 uppercase">{p.packageSize}</Text>
                 </View>
               </View>
               <View className="space-y-1 mb-4">
                 <View className="flex-row items-center gap-2">
                   <User size={12} className="text-gray-400" />
                   <Text className="text-xs text-gray-500 font-medium">To: <Text className="text-[#041614] font-bold">{p.recipient}</Text></Text>
                 </View>
                 <View className="flex-row items-center gap-2">
                   <MapPin size={12} className="text-gray-400" />
                   <Text className="text-xs text-gray-500 font-medium">From: <Text className="text-[#041614] font-bold">{p.origin}</Text></Text>
                 </View>
               </View>
               <View className="bg-[#39B5A8] py-3 rounded-xl flex-row items-center justify-center gap-2">
                 <QrCode size={16} className="text-white" />
                 <Text className="text-white font-black uppercase text-xs">Scan & Receive</Text>
               </View>
             </TouchableOpacity>
           ))}
        </View>

        <View className="mb-20">
          <Text className="text-sm font-black text-[#39B5A8] uppercase tracking-widest mb-4">Received Today</Text>
          {received.map((r, idx) => (
             <View key={`received-${r.id ?? 'none'}-${idx}`} className="bg-white border border-green-100 rounded-3xl p-5 mb-3 shadow-sm flex-row items-center gap-4">
               <View className="w-10 h-10 bg-green-50 rounded-2xl items-center justify-center">
                 <CheckCircle2 size={24} className="text-green-500" />
               </View>
               <View className="flex-1">
                 <Text className="text-xs font-black text-[#041614]">{r.trackingNumber}</Text>
                 <Text className="text-[10px] text-gray-400 font-bold">{r.recipient}</Text>
                 <Text className="text-[9px] text-[#39B5A8] font-bold mt-1 uppercase">Received at {r.receivedAt}</Text>
               </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Scanning Modal */}
      <Modal visible={isScanning} transparent animationType="fade">
        <View className="flex-1 bg-black/80 items-center justify-center p-6">
           <View className="bg-white rounded-[40px] w-full max-w-sm p-10 items-center">
              <View className="w-48 h-48 border-2 border-dashed border-[#39B5A8] rounded-3xl items-center justify-center mb-8">
                 <ActivityIndicator size="large" color="#39B5A8" />
                 <QrCode size={40} className="text-[#39B5A8] absolute opacity-30" />
              </View>
              <Text className="text-xl font-black text-[#041614] mb-2">Scanning Parcel...</Text>
              <Text className="text-gray-400 text-xs text-center font-medium">Verify tracking number and status{'\n'}against barcode.</Text>
           </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
