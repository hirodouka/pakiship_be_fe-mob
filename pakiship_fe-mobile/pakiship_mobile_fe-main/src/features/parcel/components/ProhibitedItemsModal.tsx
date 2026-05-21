import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { X, ShieldAlert, Ban, Flame, Gem, PawPrint } from 'lucide-react-native';

interface ProhibitedItemsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const prohibitedCategories = [
  {
    icon: <Ban size={20} color="#ef4444" />,
    title: "Illegal & Restricted Items",
    items: ["Illegal drugs and narcotics", "Unregistered firearms and ammunition", "Counterfeit goods"],
  },
  {
    icon: <Flame size={20} color="#f97316" />,
    title: "Hazardous Materials",
    items: ["Explosives and fireworks", "Flammable liquids or gases", "Toxic chemicals and radioactive materials"],
  },
  {
    icon: <Gem size={20} color="#eab308" />,
    title: "High-Value & Cash",
    items: ["Cash, currency, or money orders", "Precious metals and loose stones", "Lottery tickets or gambling devices"],
  },
  {
    icon: <PawPrint size={20} color="#22c55e" />,
    title: "Live Animals & Perishables",
    items: ["Live pets or animals", "Human remains", "Raw, unpacked perishables"],
  },
];

export default function ProhibitedItemsModal({ isOpen, onClose }: ProhibitedItemsModalProps) {
  return (
    <Modal
      visible={isOpen}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={styles.iconCircle}>
                <ShieldAlert size={20} color="#ef4444" />
              </View>
              <View>
                <Text style={styles.headerTitle}>Prohibited Items</Text>
                <Text style={styles.headerSubtitle}>We cannot deliver these</Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <X size={20} color="rgba(26, 93, 86, 0.5)" />
            </TouchableOpacity>
          </View>

          {/* Body */}
          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.introText}>
              For the safety of our riders and compliance with local laws, please ensure your parcel does not contain any of the following items:
            </Text>

            <View style={styles.categoryList}>
              {prohibitedCategories.map((category, idx) => (
                <View key={idx} style={styles.categoryItem}>
                  <View style={styles.categoryIconWrap}>
                    {category.icon}
                  </View>
                  <View style={styles.categoryInfo}>
                    <Text style={styles.categoryTitle}>{category.title}</Text>
                    {category.items.map((item, itemIdx) => (
                      <View key={itemIdx} style={styles.listItem}>
                        <Text style={styles.bullet}>•</Text>
                        <Text style={styles.listItemText}>{item}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.button} onPress={onClose}>
              <Text style={styles.buttonText}>I Understand</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(4, 22, 20, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#fff',
    borderRadius: 24,
    maxHeight: '85%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(57, 181, 168, 0.2)',
    // Shadow (iOS)
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    // Elevation (Android)
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    backgroundColor: 'rgba(240, 249, 248, 0.5)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(57, 181, 168, 0.1)',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1A5D56',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#39B5A8',
  },
  closeBtn: {
    padding: 4,
  },
  body: {
    padding: 20,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  introText: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 20,
    marginBottom: 20,
  },
  categoryList: {
    gap: 24,
  },
  categoryItem: {
    flexDirection: 'row',
    gap: 16,
  },
  categoryIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F0F9F8',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(57, 181, 168, 0.2)',
  },
  categoryInfo: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A5D56',
    marginBottom: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 14,
    fontWeight: '700',
    color: '#39B5A8',
    marginTop: -2,
  },
  listItemText: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    flex: 1,
  },
  footer: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(57, 181, 168, 0.1)',
    backgroundColor: 'rgba(240, 249, 248, 0.5)',
  },
  button: {
    width: '100%',
    height: 52,
    backgroundColor: '#39B5A8',
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    // Shadow
    shadowColor: '#39B5A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
