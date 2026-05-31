import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Image,
  Dimensions,
  TouchableOpacity,
  FlatList,
} from 'react-native';

const { width, height } = Dimensions.get('window');

const onboardingData = [
  {
    id: '1',
    image: require('../assets/onboarding1.png'),
    title: 'Real-time water\nmonitoring',
    description: 'Track your water 24/7 with smart sensors measuring pH, Turbidity, TDS and Temperature.',
  },
  {
    id: '2',
    image: require('../assets/onboarding2.png'),
    title: 'AI-powered\npredictions',
    description: 'Our smart system tells you instantly if your water is safe with clear explanations anyone can understand.',
  },
  {
    id: '3',
    image: require('../assets/onboarding3.png'),
    title: 'Smart tank\nalerts',
    description: 'Never miss when your tank is empty or overflowing. Get instant notifications wherever you are.',
  },
];

const OnboardingScreen = ({ onFinish }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef(null);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    if (currentIndex < onboardingData.length - 1) {
      flatListRef.current?.scrollToIndex({
        index: currentIndex + 1,
        animated: true,
      });
    } else {
      onFinish();
    }
  };

  const handleSkip = () => {
    onFinish();
  };

  const renderItem = ({ item }) => (
    <View style={{ width, height }}>
      <Image source={item.image} style={{ width, height, position: 'absolute' }} resizeMode="cover" />
      
      <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.4, backgroundColor: 'rgba(0,0,0,0.85)' }} />

      <View style={{ position: 'absolute', bottom: 200, left: 30, right: 30 }}>
        <Text className="text-3xl font-bold text-white mb-2 leading-10">{item.title}</Text>
        <View className="w-16 h-1 bg-cyan-400 mb-5" />
        <Text className="text-base text-blue-300 leading-6">{item.description}</Text>
      </View>
    </View>
  );

  return (
    <View className="flex-1 bg-black">
      <FlatList
        ref={flatListRef}
        data={onboardingData}
        renderItem={renderItem}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
      />

      <TouchableOpacity className="absolute top-12 right-8 p-2" onPress={handleSkip}>
        <Text className="text-base text-cyan-400 font-semibold">Skip</Text>
      </TouchableOpacity>

      <View className="absolute bottom-32 flex-row self-center">
        {onboardingData.map((_, index) => (
          <TouchableOpacity
            key={index}
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index: index,
                animated: true,
              });
            }}>
            <View
              className={`h-2.5 rounded-full mx-1.5 ${currentIndex === index ? 'w-8 bg-cyan-400' : 'w-2.5 bg-gray-600'}`}
            />
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity className="absolute bottom-12 left-8 right-8 bg-cyan-400 py-4 rounded-full flex-row items-center justify-center" onPress={handleNext}>
        <Text className="text-lg text-white font-bold mr-2">
          {currentIndex === onboardingData.length - 1 ? 'Get Started' : 'Next'}
        </Text>
        <Text className="text-2xl text-white font-bold">›</Text>
      </TouchableOpacity>
    </View>
  );
};

export default OnboardingScreen;
