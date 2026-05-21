import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  TextInput,
  ScrollView,
  Platform,
  Alert,
} from 'react-native';
import {
  Camera,
  Info,
  Plus,
  Minus,
  AlertCircle,
  ArrowRight,
  X,
  Package,
  Truck as TruckIcon,
} from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';
import ProhibitedItemsModal from './ProhibitedItemsModal';

export interface PackageDetails {
  size: "S" | "M" | "L" | "XL";
  weight: string;
  itemType: string;
  deliveryGuarantee: "basic" | "standard" | "premium";
  quantity: number;
  photoUri?: string;
}

interface Props {
  onContinue: (details: PackageDetails) => void;
  onBack: () => void;
}

const sizes = [
  { value: "S" as const, label: "S", dimensions: "30cm × 25cm × 35cm", maxWeight: 3, image: "https://i.postimg.cc/xTz2Bw4F/Small-box.png" },
  { value: "M" as const, label: "M", dimensions: "40cm × 40cm × 40cm", maxWeight: 5, image: "https://i.postimg.cc/gkZW1CTt/Medium-Box.png" },
  { value: "L" as const, label: "L", dimensions: "60cm × 60cm × 60cm", maxWeight: 10, image: "https://i.postimg.cc/hPdBNk55/Large-box.png" },
  { value: "XL" as const, label: "XL", dimensions: "1.2m × 2.1m × 1.2m", maxWeight: 50, image: "https://i.postimg.cc/L61pGcbx/xl-box.png" },
];

const itemTypes = [
  { value: "document", label: "Doc", icon: "📄" },
  { value: "food", label: "Food", icon: "🍴" },
  { value: "clothing", label: "Cloth", icon: "👔" },
  { value: "electronics", label: "Electr", icon: "📱" },
  { value: "fragile", label: "Fragile", icon: "⚠️" },
  { value: "other", label: "Other", icon: "📦" },
];

const guarantees = [
  { value: "basic" as const, label: "Basic", price: "Free", description: "Covers ₱3k" },
  { value: "standard" as const, label: "Standard", price: "₱7.00", description: "Covers ₱5k" },
  { value: "premium" as const, label: "Premium", price: "₱9.00", description: "Covers ₱10k" },
];

export default function PackageDetails({ onContinue, onBack }: Props) {
  const [selectedSize, setSelectedSize] = useState<"S" | "M" | "L" | "XL">("M");
  const [weight, setWeight] = useState("");
  const [selectedItemType, setSelectedItemType] = useState("");
  const [selectedGuarantee, setSelectedGuarantee] = useState<"basic" | "standard" | "premium">("basic");
  const [quantity, setQuantity] = useState(1);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [showProhibitedModal, setShowProhibitedModal] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Sorry, we need camera roll permissions to make this work!');
      return;
    }

    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
    });

    if (!result.canceled) {
      setPhotoUri(result.assets[0].uri);
    }
  };

  const handleContinue = () => {
    const currentSize = sizes.find(s => s.value === selectedSize);
    if (selectedSize === "XL") {
      if (!weight) return setError("Please enter weight for XL");
      if (parseFloat(weight) > (currentSize?.maxWeight || 50)) 
        return setError(`Max ${currentSize?.maxWeight}kg for XL`);
    }
    if (!selectedItemType) return setError("Please select an item type");
    if (quantity < 1) return setError("Minimum quantity is 1");

    onContinue({
      size: selectedSize,
      weight: selectedSize === "XL" ? weight : `Up to ${currentSize?.maxWeight}kg`,
      itemType: selectedItemType,
      deliveryGuarantee: selectedGuarantee,
      quantity: quantity,
      photoUri: photoUri || undefined,
    });
  };

  const currentSize = sizes.find(s => s.value === selectedSize);
  const requiresDirectDelivery = selectedItemType === "food" || selectedItemType === "fragile";

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* Error Popup */}
        {error && (
          <View style={styles.errorPopup}>
            <AlertCircle size={18} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity onPress={() => setError(null)}>
              <X size={16} color="#fff" />
            </TouchableOpacity>
          </View>
        )}

        {/* Size Selection Card */}
        <View style={styles.card}>
          <View style={styles.sizeVisualWrap}>
            <Image 
              source={{ 
                uri: currentSize?.image,
                headers: { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' }
              }} 
              style={styles.sizeImage}
              resizeMode="contain"
            />
            <View style={styles.sizeLabelWrap}>
              <Text style={styles.sizeName}>Size {currentSize?.label}</Text>
              <Text style={styles.sizeDims}>{currentSize?.dimensions}</Text>
            </View>
          </View>

          <View style={styles.sizePicker}>
            <Text style={styles.labelTitle}>Package Size</Text>
            <View style={styles.sizeBtns}>
              {sizes.map((size) => (
                <TouchableOpacity
                  key={size.value}
                  onPress={() => { setSelectedSize(size.value); setWeight(""); }}
                  style={[
                    styles.sizeBtn,
                    selectedSize === size.value && styles.sizeBtnActive
                  ]}
                >
                  <Text style={[
                    styles.sizeBtnText,
                    selectedSize === size.value && styles.sizeBtnTextActive
                  ]}>{size.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {selectedSize === "XL" ? (
             <View style={styles.weightPicker}>
                <Text style={styles.labelTitle}>Parcel Weight</Text>
                <View style={styles.weightSelector}>
                  <TouchableOpacity
                    onPress={() => setWeight(prev => Math.max(0, (parseFloat(prev) || 0) - 0.5).toFixed(1))}
                    style={styles.weightBtn}
                  >
                    <Minus size={18} color="#39B5A8" />
                  </TouchableOpacity>
                  <View style={styles.weightInputWrap}>
                    <TextInput
                      keyboardType="numeric"
                      value={weight}
                      onChangeText={setWeight}
                      placeholder="0.0"
                      style={styles.weightInput}
                    />
                    <Text style={styles.weightUnit}>KG</Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      const newW = (parseFloat(weight) || 0) + 0.5;
                      if (newW <= (currentSize?.maxWeight || 50)) setWeight(newW.toFixed(1));
                    }}
                    style={[styles.weightBtn, styles.weightBtnAdd]}
                  >
                    <Plus size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
             </View>
          ) : (
            <View style={styles.infoBox}>
              <Info size={16} color="#39B5A8" />
              <Text style={styles.infoText}>
                <Text style={styles.infoHighlight}>Included:</Text> Up to {currentSize?.maxWeight}kg for this size.
              </Text>
            </View>
          )}
        </View>

        {/* Photo Upload Card */}
        <TouchableOpacity style={styles.photoCard} onPress={handlePickImage}>
          <Camera size={20} color="#39B5A8" />
          <Text style={styles.photoBoxText} numberOfLines={1}>
            {photoUri ? "Photo attached ✓" : "Attach a photo (optional)"}
          </Text>
          {photoUri && (
            <TouchableOpacity onPress={() => setPhotoUri(null)}>
               <X size={16} color="#ef4444" />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Item Type Card */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Item type</Text>
            <TouchableOpacity onPress={() => setShowProhibitedModal(true)}>
              <Text style={styles.linkText}>What's prohibited?</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.typeGrid}>
            {itemTypes.map((type) => (
              <TouchableOpacity
                key={type.value}
                onPress={() => setSelectedItemType(type.value)}
                style={[
                  styles.typeBtn,
                  selectedItemType === type.value && styles.typeBtnActive
                ]}
              >
                <Text style={styles.typeIcon}>{type.icon}</Text>
                <Text style={[
                  styles.typeLabel,
                  selectedItemType === type.value && styles.typeLabelActive
                ]}>{type.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {requiresDirectDelivery && (
            <View style={styles.alertBox}>
              <AlertCircle size={14} color="#f59e0b" />
              <Text style={styles.alertText}>
                Note: <Text style={styles.bold}>{selectedItemType}</Text> requires Direct Delivery.
              </Text>
            </View>
          )}
        </View>

        {/* Guarantees & Quantity */}
        <View style={styles.bottomRow}>
          <View style={styles.halfCard}>
            <Text style={styles.cardTitle}>Guarantee</Text>
            <View style={styles.guaranteeList}>
              {guarantees.map((g) => (
                <TouchableOpacity
                  key={g.value}
                  onPress={() => setSelectedGuarantee(g.value)}
                  style={[
                    styles.guaranteeBtn,
                    selectedGuarantee === g.value && styles.guaranteeBtnActive
                  ]}
                >
                  <View>
                    <Text style={[styles.gLabel, selectedGuarantee === g.value && styles.gTextActive]}>{g.label}</Text>
                    <Text style={[styles.gDesc, selectedGuarantee === g.value && styles.gTextActive]}>{g.description}</Text>
                  </View>
                  <View style={[styles.gPriceWrap, selectedGuarantee === g.value && styles.gPriceWrapActive]}>
                    <Text style={[styles.gPriceText, selectedGuarantee === g.value && styles.gPriceTextActive]}>{g.price}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.halfCardAlign}>
            <Text style={styles.cardTitle}>Quantity</Text>
            <View style={styles.qtyBox}>
              <TouchableOpacity
                onPress={() => setQuantity(Math.max(1, quantity - 1))}
                style={[styles.qtyBtn, quantity <= 1 && styles.qtyBtnDisabled]}
                disabled={quantity <= 1}
              >
                <Minus size={18} color="#39B5A8" />
              </TouchableOpacity>
              <Text style={styles.qtyVal}>{quantity}</Text>
              <TouchableOpacity
                onPress={() => setQuantity(quantity + 1)}
                style={[styles.qtyBtn, styles.qtyBtnAdd]}
              >
                <Plus size={18} color="#fff" />
              </TouchableOpacity>
            </View>
            <Text style={styles.qtyHint}>TOTAL PARCELS</Text>
          </View>
        </View>
      </ScrollView>

      {/* Action Footer */}
      <View style={styles.footer}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack}>
          <Text style={styles.backBtnText}>Back</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.nextBtn} onPress={handleContinue}>
          <Text style={styles.nextBtnText}>Continue</Text>
          <ArrowRight size={18} color="white" />
        </TouchableOpacity>
      </View>

      <ProhibitedItemsModal isOpen={showProhibitedModal} onClose={() => setShowProhibitedModal(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F0F9F8' },
  scrollContent: { padding: 16, paddingBottom: 100 },
  
  errorPopup: {
    backgroundColor: '#1A5D56', borderRadius: 12, padding: 12, marginBottom: 16,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, elevation: 5,
  },
  errorText: { flex: 1, color: '#fff', fontSize: 13, fontWeight: '700' },

  card: {
    backgroundColor: '#fff', borderRadius: 24, padding: 20, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(57, 181, 168, 0.1)',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
  },
  sizeVisualWrap: {
    backgroundColor: '#F8FDFD', borderRadius: 16, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(57, 181, 168, 0.05)', marginBottom: 20,
  },
  sizeImage: { height: 160, width: '100%', marginBottom: 12 },
  sizeLabelWrap: { alignItems: 'center' },
  sizeName: { fontSize: 18, fontWeight: '900', color: '#39B5A8', marginBottom: 2 },
  sizeDims: { fontSize: 11, fontWeight: '700', color: 'rgba(26, 93, 86, 0.5)', letterSpacing: 1 },

  sizePicker: { marginBottom: 16 },
  labelTitle: { fontSize: 10, fontWeight: '900', color: 'rgba(26, 93, 86, 0.5)', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: 12 },
  sizeBtns: { flexDirection: 'row', gap: 8 },
  sizeBtn: {
    flex: 1, height: 48, borderRadius: 14, backgroundColor: '#fff',
    borderWidth: 2, borderColor: 'rgba(57, 181, 168, 0.1)', justifyContent: 'center', alignItems: 'center',
  },
  sizeBtnActive: { backgroundColor: '#39B5A8', borderColor: '#39B5A8' },
  sizeBtnText: { fontSize: 15, fontWeight: '800', color: '#1A5D56' },
  sizeBtnTextActive: { color: '#fff' },

  weightPicker: { marginTop: 4 },
  weightSelector: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: '#F0F9F8', padding: 8, borderRadius: 18,
    borderWidth: 2, borderColor: 'rgba(57, 181, 168, 0.1)',
  },
  weightBtn: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  weightBtnAdd: { backgroundColor: '#39B5A8' },
  weightInputWrap: { flex: 1, alignItems: 'center' },
  weightInput: { fontSize: 24, fontWeight: '900', color: '#1A5D56', textAlign: 'center' },
  weightUnit: { fontSize: 8, fontWeight: '900', color: '#39B5A8', textTransform: 'uppercase' },

  infoBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#F0F9F8', padding: 14, borderRadius: 16, borderWidth: 1, borderColor: 'rgba(57, 181, 168, 0.1)' },
  infoText: { fontSize: 12, color: 'rgba(26, 93, 86, 0.8)', flex: 1 },
  infoHighlight: { color: '#39B5A8', fontWeight: '800' },

  photoCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, backgroundColor: '#fff',
    borderRadius: 20, borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(57, 181, 168, 0.2)', marginBottom: 16,
  },
  photoBoxText: { flex: 1, fontSize: 13, fontWeight: '700', color: '#1A5D56' },

  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  cardTitle: { fontSize: 17, fontWeight: '800', color: '#1A5D56' },
  linkText: { fontSize: 11, fontWeight: '800', color: '#39B5A8', textDecorationLine: 'underline' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeBtn: {
    width: '31.5%', height: 74, borderRadius: 16, backgroundColor: '#F9FAFB',
    borderWidth: 2, borderColor: 'transparent', justifyContent: 'center', alignItems: 'center', gap: 4,
  },
  typeBtnActive: { borderColor: '#39B5A8', backgroundColor: '#F0F9F8' },
  typeIcon: { fontSize: 22 },
  typeLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(26, 93, 86, 0.6)', textTransform: 'uppercase' },
  typeLabelActive: { color: '#39B5A8' },
  alertBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff9eb', padding: 10, borderRadius: 12, marginTop: 16, borderWidth: 1, borderColor: '#feeaca' },
  alertText: { fontSize: 11, color: '#92400e' },
  bold: { fontWeight: '800' },

  bottomRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  halfCard: { flex: 1.2, backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(57, 181, 168, 0.1)' },
  halfCardAlign: { flex: 1, backgroundColor: '#fff', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(57, 181, 168, 0.1)', justifyContent: 'space-between' },

  guaranteeList: { gap: 8, marginTop: 12 },
  guaranteeBtn: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 10, borderRadius: 14, borderWidth: 2, borderColor: 'rgba(57, 181, 168, 0.1)',
  },
  guaranteeBtnActive: { backgroundColor: '#1A5D56', borderColor: '#1A5D56' },
  gLabel: { fontSize: 12, fontWeight: '800', color: '#1A5D56' },
  gDesc: { fontSize: 9, color: 'rgba(26, 93, 86, 0.6)', fontWeight: '600' },
  gPriceWrap: { backgroundColor: '#F0F9F8', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  gPriceWrapActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  gPriceText: { fontSize: 9, fontWeight: '800', color: '#39B5A8' },
  gPriceTextActive: { color: '#fff' },
  gTextActive: { color: '#fff' },

  qtyBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F0F9F8', borderRadius: 14, padding: 6, marginTop: 12 },
  qtyBtn: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  qtyBtnAdd: { backgroundColor: '#39B5A8' },
  qtyBtnDisabled: { opacity: 0.3 },
  qtyVal: { fontSize: 24, fontWeight: '900', color: '#1A5D56' },
  qtyHint: { fontSize: 8, fontWeight: '900', color: 'rgba(26, 93, 86, 0.3)', textAlign: 'center', marginTop: 8 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 16, borderTopWidth: 1, borderTopColor: 'rgba(57, 181, 168, 0.1)',
    flexDirection: 'row', gap: 12,
  },
  backBtn: { flex: 1, height: 52, borderRadius: 16, borderWidth: 2, borderColor: 'rgba(26, 93, 86, 0.1)', justifyContent: 'center', alignItems: 'center' },
  backBtnText: { color: '#1A5D56', fontWeight: '800', fontSize: 15 },
  nextBtn: {
    flex: 2, height: 52, borderRadius: 16, backgroundColor: '#39B5A8',
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8,
    shadowColor: '#39B5A8', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5,
  },
  nextBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
