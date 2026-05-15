import React, { useState, useRef } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Image, Dimensions, Animated, FlatList } from 'react-native';
import { ChevronRight, ArrowRight, Check } from 'lucide-react-native';

const { width: windowWidth, height: windowHeight } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Welcome to PakiSHIP! 🚀',
    description: 'The most reliable way to send and track your parcels across the city.',
    image: require('../../../assets/images/Pakiship Hello.png'),
    accent: '#39B5A8'
  },
  {
    id: '2',
    title: 'Easy Booking',
    description: 'Book a delivery in seconds. We handle the rest with care.',
    image: require('../../../assets/images/Pakiship Send Parcel.png'),
    accent: '#FDB833'
  },
  {
    id: '3',
    title: 'Real-time Tracking',
    description: 'Watch your package move on the map. Peace of mind at your fingertips.',
    image: require('../../../assets/images/Pakiship Track.png'),
    accent: '#54A0CC'
  }
];

export default function OnboardingModal({ onComplete }: { onComplete: () => void }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const scrollX = useRef(new Animated.Value(0)).current;
  const slidesRef = useRef<FlatList>(null);

  const viewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems[0]) {
      setCurrentIndex(viewableItems[0].index);
    }
  }).current;

  const viewConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const scrollTo = () => {
    if (currentIndex < SLIDES.length - 1) {
      slidesRef.current?.scrollToIndex({ index: currentIndex + 1 });
    } else {
      onComplete();
    }
  };

  return (
    <Modal visible animationType="fade" statusBarTranslucent>
      <View style={s.container}>
        <FlatList
          data={SLIDES}
          renderItem={({ item }) => <Slide item={item} />}
          horizontal
          showsHorizontalScrollIndicator={false}
          pagingEnabled
          bounces={false}
          keyExtractor={(item) => item.id}
          onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
            useNativeDriver: false,
          })}
          onViewableItemsChanged={viewableItemsChanged}
          viewabilityConfig={viewConfig}
          ref={slidesRef}
        />

        <View style={s.footer}>
          <Paginator data={SLIDES} scrollX={scrollX} />
          
          <TouchableOpacity style={s.btn} onPress={scrollTo}>
            <Text style={s.btnText}>{currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}</Text>
            {currentIndex === SLIDES.length - 1 ? (
               <Check size={20} color="#fff" strokeWidth={3} />
            ) : (
               <ArrowRight size={20} color="#fff" strokeWidth={3} />
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={s.skip} onPress={onComplete}>
          <Text style={s.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const Slide = ({ item }: any) => {
  return (
    <View style={s.slide}>
      <View style={s.imageWrap}>
        <Image source={item.image} style={s.image} resizeMode="contain" />
      </View>
      <View style={s.textWrap}>
        <Text style={s.title}>{item.title}</Text>
        <Text style={s.desc}>{item.description}</Text>
      </View>
    </View>
  );
};

const Paginator = ({ data, scrollX }: any) => {
  return (
    <View style={s.paginator}>
      {data.map((_: any, i: number) => {
        const inputRange = [(i - 1) * windowWidth, i * windowWidth, (i + 1) * windowWidth];
        const dotWidth = scrollX.interpolate({
          inputRange,
          outputRange: [10, 20, 10],
          extrapolate: 'clamp',
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.3, 1, 0.3],
          extrapolate: 'clamp',
        });

        return <Animated.View style={[s.dot, { width: dotWidth, opacity }]} key={i.toString()} />;
      })}
    </View>
  );
};

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  slide: { width: windowWidth, alignItems: 'center', justifyContent: 'center', padding: 20 },
  imageWrap: { flex: 0.6, justifyContent: 'center' },
  image: { width: windowWidth * 0.8, height: windowWidth * 0.8 },
  textWrap: { flex: 0.3, alignItems: 'center' },
  title: { fontSize: 28, fontWeight: '900', color: '#041614', textAlign: 'center', marginBottom: 16 },
  desc: { fontSize: 16, color: '#64748b', textAlign: 'center', paddingHorizontal: 20, lineHeight: 24 },
  footer: { 
    height: 120, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 32,
    marginBottom: 20
  },
  paginator: { flexDirection: 'row', height: 64, alignItems: 'center' },
  dot: { height: 10, borderRadius: 5, backgroundColor: '#39B5A8', marginHorizontal: 4 },
  btn: { 
    flexDirection: 'row',
    backgroundColor: '#39B5A8', 
    paddingHorizontal: 24, 
    paddingVertical: 16, 
    borderRadius: 20,
    alignItems: 'center',
    gap: 8,
    shadowColor: '#39B5A8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 5
  },
  btnText: { color: '#fff', fontWeight: '900', fontSize: 16 },
  skip: { position: 'absolute', top: 60, right: 32 },
  skipText: { color: '#9ca3af', fontWeight: '800', fontSize: 14, textTransform: 'uppercase', letterSpacing: 1 },
});
