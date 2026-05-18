import { useState, useEffect, cloneElement } from "react";
import { 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  Image, 
  Alert 
} from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { 
  ArrowLeft, MapPin, Clock, CheckCircle2, Truck, RefreshCw, Package, ArrowDown
} from "lucide-react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useJobs } from "../context/JobsContext";

// Mock Assets
const logoImg = require("../../assets/icon.png"); 

import { apiRequest } from "../services/api";

type ParcelStatus = "picked-up" | "out-for-delivery" | "delivered";

const statusOptions = [
  {
    value: "picked-up" as ParcelStatus,
    label: "Picked Up",
    description: "Package has been collected from the sender.",
    icon: <Package size={20} />,
    color: "text-blue-700",
    iconColor: "#1d4ed8",
    bg: "bg-blue-50",
    border: "border-blue-200",
    dot: "bg-blue-600",
  },
  {
    value: "out-for-delivery" as ParcelStatus,
    label: "Out for Delivery",
    description: "Package is on the way to the recipient.",
    icon: <Truck size={20} />,
    color: "text-[#39B5A8]",
    iconColor: "#39B5A8",
    bg: "bg-[#F0F9F8]",
    border: "border-[#39B5A8]/30",
    dot: "bg-[#39B5A8]",
  },
  {
    value: "delivered" as ParcelStatus,
    label: "Delivered",
    description: "Package has been successfully delivered.",
    icon: <CheckCircle2 size={20} />,
    color: "text-green-700",
    iconColor: "#15803d",
    bg: "bg-green-50",
    border: "border-green-200",
    dot: "bg-green-600",
  },
];

export default function UpdateStatusScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { id } = route.params || {};
  
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<ParcelStatus>("picked-up");
  const [submitted, setSubmitted] = useState(false);

  const fetchJobDetail = async () => {
    try {
      setLoading(true);
      const res = await apiRequest(`/pakiship/mobile/driver/jobs/${id}`);
      setJob({
        id: id,
        jobNumber: res.jobNumber,
        pickup: res.pickup,
        dropoff: res.dropoff,
      });
    } catch (error) {
      console.error('Failed to fetch job detail:', error);
      Alert.alert("Error", "Job not found");
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJobDetail();
  }, [id]);

  const handleSubmit = async () => {
    try {
      await apiRequest(`/pakiship/mobile/driver/jobs/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ parcelStatus: selectedStatus }),
      });
      setSubmitted(true);
      setTimeout(() => {
        navigation.navigate("DriverHome");
      }, 2000);
    } catch (error) {
      console.error('Failed to update status:', error);
      Alert.alert("Error", "Could not update status. Please try again.");
    }
  };

  if (loading || !job) return null;

  if (submitted) {
    const chosen = statusOptions.find(s => s.value === selectedStatus)!;
    return (
      <View className="flex-1 bg-[#F0F9F8] items-center justify-center p-6">
        <View className="bg-white rounded-[40px] p-10 w-full items-center shadow-xl border border-[#39B5A8]/10">
          <View className="w-16 h-16 bg-[#39B5A8] rounded-full items-center justify-center mb-4 shadow-lg">
            <CheckCircle2 size={32} className="text-white" />
          </View>
          <Text className="text-xl font-black text-[#041614] mb-2 text-center">Status Updated!</Text>
          <Text className="text-gray-400 text-sm font-medium text-center">
            {job.jobNumber} is now marked as{'\n'}
            <Text className={`font-black ${chosen.color}`}>{chosen.label}</Text>.
          </Text>
          {selectedStatus === "delivered" && (
            <View className="mt-4 bg-green-50 px-4 py-2 rounded-2xl">
              <Text className="text-xs text-green-700 font-bold">🎉 Job moved to Completed!</Text>
            </View>
          )}
          <Text className="text-[10px] text-gray-300 mt-6 font-bold uppercase tracking-widest text-center">Redirecting to home...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-[#F0F9F8]">
      {/* Header */}
      <View className="h-16 bg-white border-b border-[#39B5A8]/10 flex-row items-center px-4">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2">
          <ArrowLeft size={20} className="text-[#39B5A8]" />
        </TouchableOpacity>
        <Text className="flex-1 text-center font-black text-[#041614] text-base mr-10">Update Status</Text>
      </View>

      <ScrollView className="flex-1 px-4 py-5">
        {/* Job Card */}
        <View className="bg-white border border-[#39B5A8]/10 rounded-[24px] p-5 shadow-sm mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="bg-[#F0F9F8] px-2.5 py-1 rounded-lg border border-[#39B5A8]/10">
              <Text className="text-xs font-black text-[#39B5A8]">{job.jobNumber}</Text>
            </View>
            <View className="bg-blue-50 px-2.5 py-1 rounded-full border border-blue-100">
              <Text className="text-[10px] font-black text-blue-700 uppercase">In Progress</Text>
            </View>
          </View>
          
          <View className="flex-row items-start gap-3">
             <View className="w-8 h-8 rounded-full bg-[#39B5A8] items-center justify-center">
               <MapPin size={16} className="text-white" />
             </View>
             <View className="flex-1">
               <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Pickup</Text>
               <Text className="text-[#041614] font-bold text-sm" numberOfLines={1}>{job.pickup}</Text>
             </View>
          </View>
          <View style={{ width: 32, alignItems: 'center', justifyContent: 'center', marginVertical: 2 }}>
             <View style={{ width: 1.5, height: 24, backgroundColor: '#E2E8F0' }} />
          </View>
          <View className="flex-row items-start gap-3">
             <View className="w-8 h-8 rounded-full bg-red-400 items-center justify-center">
               <MapPin size={16} className="text-white" />
             </View>
             <View className="flex-1">
               <Text className="text-[9px] text-gray-400 font-black uppercase tracking-widest">Drop-off</Text>
               <Text className="text-[#041614] font-bold text-sm" numberOfLines={1}>{job.dropoff}</Text>
             </View>
          </View>
        </View>

        {/* Status Selector */}
        <View className="bg-white border border-[#39B5A8]/10 rounded-[24px] p-5 shadow-sm mb-6">
          <View className="flex-row items-center gap-2 mb-5">
            <RefreshCw size={16} className="text-[#39B5A8]" />
            <Text className="text-sm font-black text-[#041614]">Select New Status</Text>
          </View>
          
          <View>
            {statusOptions.map(option => {
               const isSelected = selectedStatus === option.value;
               return (
                 <TouchableOpacity
                   key={option.value}
                   onPress={() => setSelectedStatus(option.value)}
                   style={{ width: "100%", alignSelf: "stretch", marginBottom: 12 }}
                   className={`flex-row items-center p-4 rounded-2xl border-2 ${
                     isSelected ? `${option.bg} ${option.border}` : "bg-white border-gray-200"
                   }`}
                 >
                   <View 
                     style={{ marginRight: 16 }}
                     className={`w-10 h-10 rounded-full items-center justify-center border ${
                       isSelected ? `${option.bg} ${option.border}` : "bg-slate-50 border-gray-200"
                     }`}
                   >
                     {cloneElement(option.icon, { color: isSelected ? option.iconColor : "#9CA3AF" })}
                   </View>
                   <View className="flex-1" style={{ marginRight: 16 }}>
                     <Text className={`font-black text-sm ${isSelected ? option.color : "text-gray-600"}`}>{option.label}</Text>
                     <Text className={`text-[10px] mt-0.5 ${isSelected ? "opacity-80" : "text-gray-400"}`}>{option.description}</Text>
                   </View>
                   <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${
                     isSelected ? `${option.border} bg-white` : "border-gray-300"
                   }`}>
                     {isSelected && <View className={`w-2.5 h-2.5 rounded-full ${option.dot}`} />}
                   </View>
                 </TouchableOpacity>
               );
            })}
          </View>
        </View>

        {/* Submit */}
        <View className="pb-10">
          <TouchableOpacity 
            onPress={handleSubmit}
            className="w-full py-4 bg-[#041614] rounded-2xl flex-row items-center justify-center gap-2 shadow-lg"
          >
            <RefreshCw size={18} className="text-white" />
            <Text className="text-white font-black uppercase text-xs">Confirm Status Update</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.goBack()}
            className="w-full py-4 items-center"
          >
            <Text className="text-gray-400 font-bold text-xs uppercase">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
