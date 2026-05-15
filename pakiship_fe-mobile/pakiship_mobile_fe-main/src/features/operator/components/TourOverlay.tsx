import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { COLORS } from "../types/colors";

const TOUR_KEY = "pakiship_tour_done_v2";

export interface SpotlightRect {
  x: number; y: number; width: number; height: number;
}

export interface TourStep {
  step: number;
  totalSteps?: number;
  title: string;
  body: string;
  mascot: any;
  spotlight?: SpotlightRect | null;
  cardPosition?: "top" | "bottom";
  onNext?: () => void;
  onBack?: () => void;
  isLast?: boolean;
}

interface TourOverlayProps {
  visible: boolean;
  steps: TourStep[];
  onClose: () => void;
  initialStep?: number;
}

export function TourOverlay({ visible, steps, onClose, initialStep = 0 }: TourOverlayProps) {
  const [stepIdx, setStepIdx] = useState(initialStep);
  const [rendering, setRendering] = useState(false);

  // Animations — all native driver
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const cardSlide = useRef(new Animated.Value(300)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  const spotlightOpacity = useRef(new Animated.Value(0)).current;
  const [spotlightRect, setSpotlightRect] = useState<SpotlightRect | null>(null);

  const current = steps[stepIdx] ?? steps[0];
  const isTop = current.cardPosition === "top";

  // Mount/unmount animation
  useEffect(() => {
    if (visible) {
      setStepIdx(initialStep);
      setRendering(true);
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 1, duration: 280, useNativeDriver: true }),
        Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, tension: 70, friction: 12 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 250, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(overlayOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(cardSlide, { toValue: 300, duration: 200, useNativeDriver: true }),
        Animated.timing(cardOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
      ]).start(() => setRendering(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Spotlight fade — re-runs when stepIdx, visible, or the current step's spotlight changes
  const currentSpotlight = steps[stepIdx]?.spotlight ?? null;
  // Stringify coords so the effect only re-fires when values actually change
  const spotlightKey = currentSpotlight
    ? `${currentSpotlight.x},${currentSpotlight.y},${currentSpotlight.width},${currentSpotlight.height}`
    : "null";
  useEffect(() => {
    if (!visible) return;
    const target = steps[stepIdx]?.spotlight ?? null;
    if (target) {
      spotlightOpacity.setValue(0);
      setSpotlightRect(target);
      Animated.timing(spotlightOpacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    } else {
      Animated.timing(spotlightOpacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(() => setSpotlightRect(null));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stepIdx, visible, spotlightKey]);

  const animateStep = useCallback((next: number, dir: 1 | -1) => {
    // Slide card out, update step, slide back in
    Animated.parallel([
      Animated.timing(cardSlide, { toValue: dir * -60, duration: 150, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 150, useNativeDriver: true }),
    ]).start(() => {
      setStepIdx(next);
      cardSlide.setValue(dir * 60);
      Animated.parallel([
        Animated.spring(cardSlide, { toValue: 0, useNativeDriver: true, tension: 80, friction: 11 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleNext() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (current.onNext) { current.onNext(); return; }
    if (stepIdx < steps.length - 1) animateStep(stepIdx + 1, 1);
    else handleFinish();
  }

  function handleBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (current.onBack) { current.onBack(); return; }
    if (stepIdx > 0) animateStep(stepIdx - 1, -1);
  }

  function handleFinish() {
    AsyncStorage.setItem(TOUR_KEY, "true");
    Animated.parallel([
      Animated.timing(overlayOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(cardSlide, { toValue: 300, duration: 220, useNativeDriver: true }),
      Animated.timing(cardOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(onClose);
  }

  if (!visible && !rendering) return null;

  const pad = 10;
  const sr = spotlightRect;
  const showFinish = current.isLast !== false && stepIdx === steps.length - 1 && !current.onNext;

  const cardContent = (
    <>
      <View style={styles.cardHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>STEP {current.step}/{current.totalSteps ?? steps.length}</Text>
        </View>
        <TouchableOpacity onPress={handleFinish} style={styles.closeBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Feather name="x" size={16} color={COLORS.textSecondary} />
        </TouchableOpacity>
      </View>
      <Text style={styles.title}>{current.title}</Text>
      <Text style={styles.body}>{current.body}</Text>
      <View style={styles.divider} />
      <View style={styles.actions}>
        {(stepIdx > 0 || current.onBack) ? (
          <TouchableOpacity style={styles.backBtn} onPress={handleBack} activeOpacity={0.75}>
            <Feather name="arrow-left" size={14} color={COLORS.primary} />
            <Text style={styles.backText}>Back</Text>
          </TouchableOpacity>
        ) : <View style={{ flex: 1 }} />}
        <TouchableOpacity style={styles.nextBtn} onPress={handleNext} activeOpacity={0.85}>
          <Text style={styles.nextText}>{showFinish ? "Finish" : "Next"}</Text>
          <Feather name="arrow-right" size={14} color={COLORS.white} />
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal visible={visible || rendering} transparent animationType="none" onRequestClose={handleFinish}>
      {/* Dark overlay */}
      <Animated.View style={[styles.overlayContainer, { opacity: overlayOpacity }]} pointerEvents="none">
        {sr ? (
          <>
            <View style={[styles.block, { top: 0, left: 0, right: 0, height: Math.max(0, sr.y - pad) }]} />
            <View style={[styles.block, { top: sr.y - pad, left: 0, width: Math.max(0, sr.x - pad), height: sr.height + pad * 2 }]} />
            <View style={[styles.block, { top: sr.y - pad, left: sr.x + sr.width + pad, right: 0, height: sr.height + pad * 2 }]} />
            <View style={[styles.block, { top: sr.y + sr.height + pad, left: 0, right: 0, bottom: 0 }]} />
          </>
        ) : (
          <View style={[StyleSheet.absoluteFillObject, styles.block]} />
        )}
      </Animated.View>

      {/* Spotlight — teal border around cutout */}
      {sr && (
        <Animated.View pointerEvents="none" style={[styles.spotlightBorder, {
          top: sr.y - pad, left: sr.x - pad,
          width: sr.width + pad * 2, height: sr.height + pad * 2,
          opacity: spotlightOpacity,
        }]} />
      )}

      {/* Card — top */}
      {isTop && (
        <Animated.View style={[styles.topContainer, { transform: [{ translateY: cardSlide }], opacity: cardOpacity }]} pointerEvents="box-none">
          <Image source={current.mascot} style={styles.mascotTop} resizeMode="contain" />
          <View style={styles.cardTopStyle}>{cardContent}</View>
        </Animated.View>
      )}

      {/* Card — bottom */}
      {!isTop && (
        <Animated.View style={[styles.bottomContainer, { transform: [{ translateY: cardSlide }], opacity: cardOpacity }]} pointerEvents="box-none">
          <Image source={current.mascot} style={styles.mascotBottom} resizeMode="contain" />
          <View style={styles.cardBottomStyle}>{cardContent}</View>
        </Animated.View>
      )}
    </Modal>
  );
}

export async function shouldShowTour(): Promise<boolean> {
  const done = await AsyncStorage.getItem(TOUR_KEY);
  return done !== "true";
}

const cardBase = {
  width: "100%" as const,
  backgroundColor: COLORS.cardBg,
  paddingHorizontal: 28,
  paddingVertical: 28,
  gap: 12 as const,
  borderRadius: 28,
};

const styles = StyleSheet.create({
  overlayContainer: { ...StyleSheet.absoluteFillObject },
  block: { position: "absolute", backgroundColor: "rgba(4,22,20,0.6)" },
  spotlightBorder: { position: "absolute", borderRadius: 18, borderWidth: 2.5, borderColor: COLORS.white },

  topContainer: { position: "absolute", top: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, paddingTop: 16 },
  mascotTop: { width: 110, height: 110, zIndex: 10, marginBottom: -10 },
  cardTopStyle: { ...cardBase },

  bottomContainer: { position: "absolute", bottom: 0, left: 0, right: 0, alignItems: "center", paddingHorizontal: 16, paddingBottom: 24 },
  mascotBottom: { width: 130, height: 130, marginBottom: -28, zIndex: 10 },
  cardBottomStyle: { ...cardBase, paddingBottom: 36 },

  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stepBadge: { backgroundColor: COLORS.primaryLight, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5 },
  stepText: { fontSize: 9, fontWeight: "700", color: COLORS.primary, letterSpacing: 0.5, textTransform: "uppercase" },
  closeBtn: { width: 28, height: 28, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 22, fontWeight: "800", color: COLORS.text },
  body: { fontSize: 14, fontWeight: "400", color: COLORS.textSecondary, lineHeight: 22 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 4 },
  actions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 4 },
  backBtn: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6 },
  backText: { fontSize: 12, fontWeight: "800", color: COLORS.primary, letterSpacing: 0.5, textTransform: "uppercase" },
  nextBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: COLORS.primary, borderRadius: 24, paddingVertical: 11, paddingHorizontal: 22 },
  nextText: { fontSize: 12, fontWeight: "800", color: COLORS.white, letterSpacing: 0.5, textTransform: "uppercase" },
});
