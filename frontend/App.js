import { useEffect, useState } from 'react';
import { StatusBar, View, Image, Dimensions } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { getFCMToken, setupFCMListeners } from './src/services/fcm';
import { ThemeProvider } from './src/context/ThemeContext';
import OnboardingScreen from './src/screens/OnboardingScreen';
import SignUpScreen from './src/screens/SignUpScreen';
import OTPVerificationScreen from './src/screens/OTPVerificationScreen';
import LoginScreen from './src/screens/LoginScreen';
import HomeScreen from './src/screens/HomeScreen';
import ReportsScreen from './src/screens/ReportsScreen';
import TankScreen from './src/screens/TankScreen';
import AlertsScreen from './src/screens/AlertsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import HistoryScreen from './src/screens/HistoryScreen';
import ForgotPasswordScreen from './src/screens/ForgotPasswordScreen';

const { width, height } = Dimensions.get('window');
const ONBOARDING_COMPLETED_KEY = '@onboarding_completed';
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#F1F5F9',
          height: 65,
          paddingBottom: 10,
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#0891B2',
        tabBarInactiveTintColor: '#94A3B8',
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
          marginTop: -4,
        },
        tabBarIcon: ({ focused, color }) => {
          let iconName;

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Reports') {
            iconName = 'access-time';
          } else if (route.name === 'Tank') {
            iconName = 'inbox';
          } else if (route.name === 'Alerts') {
            iconName = 'notifications-none';
          } else if (route.name === 'Settings') {
            iconName = 'wb-sunny';
          }

          return (
            <View style={{ alignItems: 'center' }}>
              <MaterialIcons name={iconName} size={24} color={color} />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: '#0891B2',
                    marginTop: 4,
                  }}
                />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Reports" component={ReportsScreen} />
      <Tab.Screen name="Tank" component={TankScreen} />
      <Tab.Screen name="Alerts" component={AlertsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        await AsyncStorage.getItem(ONBOARDING_COMPLETED_KEY);
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
        await getFCMToken();
      } catch (error) {
      }
    };

    initializeFCM();
    setupFCMListeners();
  }, []);

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
      setShowSplash(false);
    }, 7000);

    return () => clearTimeout(timer);
  }, []);

  if (isLoading) {
    return null;
  }

  if (showSplash) {
    return (
      <View style={{flex: 1, backgroundColor: '#0a1929'}}>
        <StatusBar barStyle="light-content" />
        <Image 
          source={require('./src/assets/splashscreen.png')}
          style={{width: width, height: height, position: 'absolute'}}
          resizeMode="cover"
        />
      </View>
    );
  }

  if (showOnboarding) {
    return (
      <ThemeProvider>
        <OnboardingScreen onFinish={handleOnboardingFinish} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="SignUp" component={SignUpScreen} />
          <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
          <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
          <Stack.Screen name="MainApp" component={MainTabs} />
          <Stack.Screen name="History" component={HistoryScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </ThemeProvider>
  );
}

export default App;
