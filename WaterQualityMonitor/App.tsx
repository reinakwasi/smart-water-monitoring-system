import React, { useEffect, useState } from 'react';
import { NewAppScreen } from '@react-native/new-app-screen';
import { StatusBar, StyleSheet, useColorScheme, View, Image, Dimensions } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getFCMToken, setupFCMListeners } from './src/services/fcm';
import OnboardingScreen from './src/screens/OnboardingScreen';

const { width, height } = Dimensions.get('window');
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';

function App() {
  const isDarkMode = useColorScheme() === 'dark';
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const completed = await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
        setShowOnboarding(true);
      } catch (error) {
        setShowOnboarding(true);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  useEffect(() => {
    const initializeFCM = async () => {
      try {
        const token = await getFCMToken();
      } catch (error) {
        console.error('Error initializing FCM:', error);
      }
    };

    initializeFCM();
    setupFCMListeners();
  }, []);

  const handleSplashFinish = () => {
    setShowSplash(false);
  };

  const handleOnboardingFinish = async () => {
    try {
      await AsyncStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
      setShowOnboarding(false);
    } catch (error) {
      setShowOnboarding(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      handleSplashFinish();
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return null;
  }

  if (showSplash) {
    return (
      <View style={{flex: 1, backgroundColor: '#0a1929'}}>
        <Image 
          source={require('./src/assets/splashscreen.png')}
          style={{width: width, height: height, position: 'absolute'}}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onFinish={handleOnboardingFinish} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <AppContent />
    </SafeAreaProvider>
  );
}

function AppContent() {
  const safeAreaInsets = useSafeAreaInsets();

  return (
    <View style={styles.container}>
      <NewAppScreen
        templateFileName="App.tsx"
        safeAreaInsets={safeAreaInsets}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;
