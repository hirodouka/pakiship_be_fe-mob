import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, Dimensions, Platform, StatusBar } from 'react-native';
import Svg, { Defs, Mask, Rect } from 'react-native-svg';
import { X, ArrowRight, ArrowLeft } from 'lucide-react-native';

const sendParcelIcon = { uri: "https://i.imgur.com/a6gHhtu.png" };
const trackPackageIcon = { uri: "https://i.imgur.com/HHNarFY.png" };
const historyIcon = { uri: "https://i.imgur.com/4Xgmx8D.png" };
const rateReviewIcon = { uri: "https://i.imgur.com/pvzfoIz.png" };
const mascotWavingImg = { uri: "https://i.imgur.com/G4RbCRo.png" };
const mascotWinkingImg = { uri: "https://i.imgur.com/0RM52cS.png" };
const mascotMotorcycleImg = { uri: "https://i.imgur.com/7ywKdmd.png" };
const mascotThinkingImg = { uri: "https://i.imgur.com/gDo17NY.png" };

export default function TutorialModal({
  step,
  onNext,
  onPrev,
  onClose,
  actionCardsRef,
  sendParcelRef,
  trackPackageRef,
  historyRef,
  rateReviewRef,
  activeDeliveriesRef,
  guideButtonRef,
  scrollViewRef,
  rootRef
}: any) {
  const [highlightRect, setHighlightRect] = useState<any>(null);
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

  const steps = [
    {
      title: "Welcome to PakiSHIP!",
      content: "Hi there! I'm your guide. Let me show you around your dashboard.",
      image: mascotWavingImg,
      targetRef: null,
    },
    {
      title: "Quick Actions",
      content: "These cards are your main tools! Book, track, view history, or add a rate & review.",
      image: mascotWinkingImg,
      targetRef: actionCardsRef,
      scrollTo: 0
    },
    {
      title: "Send Parcel",
      content: "Need to send something? Start booking here.",
      image: sendParcelIcon,
      targetRef: sendParcelRef,
      scrollTo: 0
    },
    {
      title: "Track Package",
      content: "See real-time updates of your parcels. No more guessing!",
      image: trackPackageIcon,
      targetRef: trackPackageRef,
      scrollTo: 0
    },
    {
      title: "History",
      content: "All your past deliveries are stored here for easy review.",
      image: historyIcon,
      targetRef: historyRef,
      scrollTo: 0
    },
    {
      title: "Rate & Review",
      content: "Help us improve by rating your experience! We value your feedback.",
      image: rateReviewIcon,
      targetRef: rateReviewRef,
      scrollTo: 0
    },
    {
      title: "Active Deliveries",
      content: "Ongoing deliveries are listed here for quick access.",
      image: mascotMotorcycleImg,
      targetRef: activeDeliveriesRef,
      scrollTo: 140
    },
    {
      title: "Need Help?",
      content: "Click 'Guide' anytime to see this again. Happy shipping!",
      image: mascotThinkingImg,
      targetRef: guideButtonRef,
      scrollTo: 0
    },
  ];

  const currentStep: any = steps[step] || steps[0];
  const isLastStep = step === steps.length - 1;

  useEffect(() => {
    const targetRef = currentStep.targetRef;

    if (scrollViewRef?.current) {
       const yPos = currentStep.scrollTo || 0;
       scrollViewRef.current.scrollTo({ y: yPos, animated: true });
    } else if (currentStep.scrollTo === 0 && scrollViewRef?.current) {
       scrollViewRef.current.scrollTo({ y: 0, animated: true });
    }

    let isMounted = true;
    
    const measureHighlight = () => {
      if (!isMounted) return;
      
      if (targetRef && targetRef.current) {
        const statusBarOffset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

        targetRef.current.measureInWindow((x: number, y: number, width: number, height: number) => {
          if (width > 0 && height > 0) {
            const isActionCard = height > 100 && width > 100;
            const padding = isActionCard ? 16 : 12;
            const topOffset = isActionCard ? 56 : 6;

            setHighlightRect({
              x: x - padding,
              y: y + statusBarOffset - topOffset,
              w: width + padding * 2,
              h: height + topOffset + padding,
            });
          }
        });
      } else {
        setHighlightRect(null);
      }
    };

    measureHighlight();
    const t1 = setTimeout(measureHighlight, 50);
    const t2 = setTimeout(measureHighlight, 100);
    const t3 = setTimeout(measureHighlight, 200);
    const t4 = setTimeout(measureHighlight, 350);
    const t5 = setTimeout(measureHighlight, 500);
    const interval = setInterval(measureHighlight, 1000);

    return () => {
      isMounted = false;
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
      clearTimeout(t5);
      clearInterval(interval);
    };
  }, [step, currentStep.targetRef, scrollViewRef]);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      <View style={{ position: 'absolute', top: 0, left: 0, width: windowWidth, height: windowHeight, zIndex: 59 }} pointerEvents="none">
         <Svg height={windowHeight} width={windowWidth}>
            <Defs>
              <Mask id="mask" x="0" y="0" height={windowHeight} width={windowWidth}>
                <Rect height={windowHeight} width={windowWidth} fill="white" />
                {highlightRect ? (
                  <Rect
                    x={highlightRect.x}
                    y={highlightRect.y}
                    width={highlightRect.w}
                    height={highlightRect.h}
                    rx={24}
                    ry={24}
                    fill="black"
                  />
                ) : (
                  <Rect
                    x={windowWidth / 2}
                    y={windowHeight / 2}
                    width={0}
                    height={0}
                    fill="black"
                  />
                )}
              </Mask>
            </Defs>
            <Rect 
              height={windowHeight} 
              width={windowWidth} 
              fill="rgba(4, 22, 20, 0.7)" 
              mask="url(#mask)" 
            />
          </Svg>
      </View>

      <View style={[styles.bottomContainer, { zIndex: 60 }]} pointerEvents="box-none">
         <View style={styles.mascotWrapper}>
            <Image
              key={currentStep.image.uri}
              source={currentStep.image}
              style={styles.mascotImg}
              resizeMode="contain"
            />
         </View>

         <View style={styles.card}>
            <View style={styles.cardHeader}>
               <View style={styles.stepBadge}>
                 <Text style={styles.stepBadgeText}>STEP {step + 1}/{steps.length}</Text>
               </View>
               <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                  <X size={20} color="#D1D5DB" />
               </TouchableOpacity>
            </View>

            <Text style={styles.title}>{currentStep.title}</Text>
            <Text style={styles.desc}>{currentStep.content}</Text>

            <View style={styles.footer}>
               <TouchableOpacity 
                 onPress={onPrev} 
                 disabled={step === 0} 
                 style={[styles.backBtn, step === 0 && { opacity: 0 }]}
               >
                 <ArrowLeft size={16} color="#39B5A8" />
                 <Text style={styles.backTxt}>BACK</Text>
               </TouchableOpacity>

               <TouchableOpacity onPress={isLastStep ? onClose : onNext} style={styles.nextBtn}>
                 <Text style={styles.nextTxt}>{isLastStep ? "FINISH" : "NEXT"}</Text>
                 {!isLastStep && <ArrowRight size={14} color="#fff" />}
               </TouchableOpacity>
            </View>
         </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bottomContainer: {
    position: 'absolute',
    bottom: 24,
    left: 20,
    right: 20,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  mascotWrapper: {
    width: 110,
    height: 110,
    marginBottom: -50,
    zIndex: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 10,
  },
  mascotImg: {
    width: '100%',
    height: '100%',
  },
  card: {
    backgroundColor: '#fff',
    width: '100%',
    borderRadius: 32,
    paddingHorizontal: 24,
    paddingTop: 56,
    paddingBottom: 24,
    borderColor: 'rgba(57, 181, 168, 0.2)',
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepBadge: {
    backgroundColor: '#F0F9F8',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stepBadgeText: {
    color: '#39B5A8',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1,
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 18,
    fontWeight: '900',
    color: '#041614',
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 20,
  },
  backBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 8,
  },
  backTxt: {
    color: '#39B5A8',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#39B5A8',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: '#39B5A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  nextTxt: {
    color: '#fff',
    fontWeight: '900',
    fontSize: 12,
    letterSpacing: 1,
  }
});
