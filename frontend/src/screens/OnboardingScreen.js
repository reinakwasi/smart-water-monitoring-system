import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  FlatList,
  Animated,
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
  
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(1)).current;
  const underlineAnim = useRef(new Animated.Value(1)).current;
  const descAnim = useRef(new Animated.Value(1)).current;
  const buttonAnim = useRef(new Animated.Value(1)).current;
  const buttonScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(50);
    titleAnim.setValue(0);
    underlineAnim.setValue(0);
    descAnim.setValue(0);
    buttonAnim.setValue(0);

    Animated.sequence([
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
      Animated.stagger(150, [
        Animated.timing(titleAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(underlineAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(descAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(buttonAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, [currentIndex]);

  const handleScroll = (event) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  };

  const handleNext = () => {
    const scale = buttonScale;
    Animated.sequence([
      Animated.timing(scale, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(scale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();

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
    <View style={styles.slide}>
      <Image source={item.image} style={styles.backgroundImage} resizeMode="cover" />
      
      <View style={styles.overlay} />

      <Animated.View 
        style={[
          styles.contentContainer,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <Animated.Text 
          style={[
            styles.title,
            {
              opacity: titleAnim,
              transform: [
                {
                  translateY: titleAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {item.title}
        </Animated.Text>
        <Animated.View 
          style={[
            styles.underline,
            {
              opacity: underlineAnim,
              transform: [
                {
                  scaleX: underlineAnim,
                },
              ],
            },
          ]} 
        />
        <Animated.Text 
          style={[
            styles.description,
            {
              opacity: descAnim,
              transform: [
                {
                  translateY: descAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                },
              ],
            },
          ]}
        >
          {item.description}
        </Animated.Text>
      </Animated.View>
    </View>
  );

  return (
    <View style={styles.container}>
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

      <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>

      <Animated.View 
        style={[
          styles.dotsContainer,
          {
            opacity: buttonAnim,
          },
        ]}
      >
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
              style={[
                styles.dot,
                currentIndex === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          </TouchableOpacity>
        ))}
      </Animated.View>

      <Animated.View
        style={{
          opacity: buttonAnim,
          transform: [
            { scale: buttonScale },
            {
              translateY: buttonAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [30, 0],
              }),
            },
          ],
        }}
      >
        <TouchableOpacity style={styles.nextButton} onPress={handleNext}>
          <Text style={styles.nextButtonText}>
            {currentIndex === onboardingData.length - 1 ? 'Get Started' : 'Next'}
          </Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  slide: {
    width: width,
    height: height,
  },
  backgroundImage: {
    width: width,
    height: height,
    position: 'absolute',
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: height * 0.4,
    backgroundColor: 'rgba(0,0,0,0.85)',
  },
  contentContainer: {
    position: 'absolute',
    bottom: 200,
    left: 30,
    right: 30,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
    lineHeight: 40,
  },
  underline: {
    width: 60,
    height: 4,
    backgroundColor: '#00BCD4',
    marginBottom: 20,
  },
  description: {
    fontSize: 16,
    color: '#8B9DC3',
    lineHeight: 24,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 30,
    padding: 10,
  },
  skipText: {
    fontSize: 16,
    color: '#00BCD4',
    fontWeight: '600',
  },
  dotsContainer: {
    position: 'absolute',
    bottom: 130,
    flexDirection: 'row',
    alignSelf: 'center',
  },
  dot: {
    height: 10,
    borderRadius: 5,
    marginHorizontal: 5,
  },
  activeDot: {
    backgroundColor: '#00BCD4',
    width: 30,
  },
  inactiveDot: {
    backgroundColor: '#4A5568',
    width: 10,
  },
  nextButton: {
    position: 'absolute',
    bottom: 50,
    left: 30,
    right: 30,
    backgroundColor: '#00BCD4',
    paddingVertical: 18,
    borderRadius: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
    marginRight: 8,
  },
  arrow: {
    fontSize: 24,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
});

export default OnboardingScreen;
