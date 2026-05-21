import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { ArrowLeft, LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Props {
  title?: string;
  subtitle?: string;
  icon?: LucideIcon;
  logo?: any;
  onBack?: () => void;
  stepTitles?: string[];
  currentStep?: number;
}

export function CustomerPageHeader({ title, subtitle, icon: Icon, onBack, stepTitles, currentStep }: Props) {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const handleBack = onBack || (() => navigation.goBack());
  const displayTitle = stepTitles && currentStep ? stepTitles[currentStep - 1] : title;

  return (
    <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
        <ArrowLeft size={22} color="#39B5A8" />
      </TouchableOpacity>
      
      <View style={styles.centerWrap}>
        <View style={styles.titleRow}>
          {Icon && <Icon size={18} color="#39B5A8" style={{ marginRight: 6 }} />}
          <Text style={styles.title}>{displayTitle}</Text>
        </View>
        {subtitle && <Text style={styles.subtitle}>{subtitle.toUpperCase()}</Text>}
      </View>

      <View style={styles.backBtn} />
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(57,181,168,0.1)',
  },
  backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'center' },
  centerWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '900', color: '#1A5D56', letterSpacing: -0.5 },
  subtitle: { fontSize: 10, color: '#39B5A8', fontWeight: '800', letterSpacing: 1, marginTop: 2 },
});
