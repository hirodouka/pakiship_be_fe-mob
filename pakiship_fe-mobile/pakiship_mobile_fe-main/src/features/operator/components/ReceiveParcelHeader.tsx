import React from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../types/colors";
import { useNavigation } from "@react-navigation/native";

interface ReceiveParcelHeaderProps {
  title: string;
  subtitle?: string;
}

export function ReceiveParcelHeader({ title, subtitle }: ReceiveParcelHeaderProps) {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const topPad = Platform.OS === "web" ? 67 : insets.top;

  return (
    <View style={[styles.container, { paddingTop: topPad + 8 }]}>
      {/* Back button */}
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Feather name="arrow-left" size={22} color={COLORS.primary} />
      </TouchableOpacity>

      {/* Logo + Title block */}
      <View style={styles.center}>
        <Image
          source={require("../../../assets/pakiship-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <View style={styles.titleBlock}>
          <Text style={styles.title}>{title}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.cardBg,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 14,
    gap: 12,
  },
  backBtn: {
    padding: 4,
  },
  center: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  logo: {
    width: 100,
    height: 40,
  },
  titleBlock: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.text,
    lineHeight: 22,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
    marginTop: 1,
  },
});
