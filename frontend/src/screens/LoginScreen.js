import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import GoogleIcon from '../components/GoogleIcon';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('@saved_email');
      const savedPassword = await AsyncStorage.getItem('@saved_password');
      const savedRememberMe = await AsyncStorage.getItem('@remember_me');
      
      if (savedEmail) {
        setEmail(savedEmail);
      }
      
      if (savedRememberMe === 'true' && savedPassword) {
        setPassword(savedPassword);
        setRememberMe(true);
      }
    } catch (error) {
      console.error('Error loading saved credentials:', error);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSignIn = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (!password) {
      Alert.alert('Validation Error', 'Please enter your password');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Invalid Password', 'Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const response = await authAPI.login({
        email: email.trim().toLowerCase(),
        password: password,
      });

      await AsyncStorage.setItem('@saved_email', email.trim().toLowerCase());
      
      if (rememberMe) {
        await AsyncStorage.setItem('@saved_password', password);
        await AsyncStorage.setItem('@remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('@saved_password');
        await AsyncStorage.setItem('@remember_me', 'false');
      }

      navigation.replace('MainApp');

    } catch (error) {
      console.error('Login error:', error);

      if (error.response?.status === 401) {
        Alert.alert('Login Failed', 'Invalid email or password. Please try again.');
      } else if (error.response?.status === 403) {
        Alert.alert('Account Not Verified', 'Please verify your email before signing in.');
      } else if (error.response?.data?.detail) {
        Alert.alert('Login Failed', error.response.data.detail);
      } else if (error.message === 'Network Error') {
        Alert.alert('Connection Error', 'Cannot connect to server. Please check your internet connection.');
      } else {
        Alert.alert('Login Failed', 'An error occurred. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    Alert.alert('Coming Soon', 'Google Sign-In will be available soon');
  };

  const handleForgotPassword = () => {
    Alert.alert('Forgot Password', 'Password reset feature coming soon');
  };

  const handleCreateAccount = () => {
    navigation.navigate('SignUp');
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" backgroundColor="#0B7FA5" />

      {/* Header Section */}
      <View className="bg-[#0B7FA5] pt-12 pb-12 px-6 relative overflow-hidden">
        <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        
        <TouchableOpacity className="flex-row items-center mb-5" onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>

        <Text className="text-4xl font-bold text-white mb-2">Welcome back 👋</Text>
        <Text className="text-base text-cyan-100">Sign in to continue monitoring</Text>
      </View>

      {/* Form Section */}
      <ScrollView className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-8" showsVerticalScrollIndicator={false}>
        {/* Email Input */}
        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">EMAIL ADDRESS</Text>
          <View className="flex-row items-center bg-slate-100 rounded-xl border border-slate-200 px-4 h-14">
            <MaterialCommunityIcons name="email-outline" size={20} color="#94A3B8" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="samuel@email.com"
              placeholderTextColor="#94A3B8"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              editable={!loading}
            />
          </View>
        </View>

        {/* Password Input */}
        <View className="mb-5">
          <Text className="text-xs font-semibold text-slate-600 mb-2.5 tracking-wider">PASSWORD</Text>
          <View className="flex-row items-center bg-slate-100 rounded-xl border border-slate-200 px-4 h-14">
            <MaterialIcons name="lock-outline" size={20} color="#94A3B8" className="mr-3" />
            <TextInput
              className="flex-1 text-base text-slate-800"
              placeholder="Your password"
              placeholderTextColor="#94A3B8"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoComplete="password"
              textContentType="password"
              editable={!loading}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={loading}>
              <MaterialIcons 
                name={showPassword ? "visibility" : "visibility-off"} 
                size={20} 
                color="#94A3B8" 
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Remember Me & Forgot Password */}
        <View className="flex-row justify-between items-center mb-6">
          <TouchableOpacity 
            className="flex-row items-center"
            onPress={() => setRememberMe(!rememberMe)}
            disabled={loading}
          >
            <View className={`w-5 h-5 rounded border-2 border-[#0B7FA5] mr-2 justify-center items-center ${rememberMe ? 'bg-[#0B7FA5]' : ''}`}>
              {rememberMe && (
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
              )}
            </View>
            <Text className="text-sm text-slate-600">Remember me</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={handleForgotPassword} disabled={loading}>
            <Text className="text-sm text-[#0B7FA5] font-semibold">Forgot password?</Text>
          </TouchableOpacity>
        </View>

        {/* Sign In Button */}
        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center mb-6 ${loading ? 'bg-slate-400' : 'bg-[#0B7FA5]'}`}
          onPress={handleSignIn}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Sign In</Text>
          )}
        </TouchableOpacity>

        {/* OR Divider */}
        <View className="flex-row items-center my-6">
          <View className="flex-1 h-px bg-slate-200" />
          <Text className="mx-4 text-xs text-slate-400 font-medium">OR CONTINUE WITH</Text>
          <View className="flex-1 h-px bg-slate-200" />
        </View>

        {/* Google Sign In Button */}
        <TouchableOpacity 
          className="flex-row items-center justify-center bg-white rounded-xl border border-slate-200 h-14 mb-6"
          onPress={handleGoogleSignIn}
          disabled={loading}
        >
          <GoogleIcon size={20} />
          <Text className="text-base text-slate-800 font-medium ml-3">Continue with Google</Text>
        </TouchableOpacity>

        {/* Create Account Link */}
        <View className="flex-row justify-center items-center mb-8">
          <Text className="text-sm text-slate-500">New here? </Text>
          <TouchableOpacity onPress={handleCreateAccount} disabled={loading}>
            <Text className="text-sm text-[#0B7FA5] font-semibold">Create account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;
