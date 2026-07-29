import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    loadSavedCredentials();
  }, []);

  const loadSavedCredentials = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('@saved_email');
      const savedRememberMe = await AsyncStorage.getItem('@remember_me');
      if (savedEmail) setEmail(savedEmail);
      if (savedRememberMe === 'true' && savedEmail) setRememberMe(true);
    } catch (error) {
    }
  };

  const validateEmail = value => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(value);
  };

  const busy = loading;

  const handleSignIn = async () => {
    setErrorMessage('');

    if (!email.trim()) {
      const msg = 'Please enter your email address';
      setErrorMessage(msg);
      showAppAlert('Email required', msg, [], 'warning');
      return;
    }

    if (!validateEmail(email)) {
      const msg = 'Please enter a valid email address';
      setErrorMessage(msg);
      showAppAlert('Invalid email', msg, [], 'warning');
      return;
    }

    if (!password) {
      const msg = 'Please enter your password';
      setErrorMessage(msg);
      showAppAlert('Password required', msg, [], 'warning');
      return;
    }

    if (password.length < 8) {
      const msg = 'Password must be at least 8 characters';
      setErrorMessage(msg);
      showAppAlert('Invalid password', msg, [], 'warning');
      return;
    }

    setLoading(true);

    try {
      await authAPI.login({
        email: email.trim().toLowerCase(),
        password,
      });

      if (rememberMe) {
        await AsyncStorage.setItem('@saved_email', email.trim().toLowerCase());
        await AsyncStorage.setItem('@remember_me', 'true');
      } else {
        await AsyncStorage.removeItem('@saved_email');
        await AsyncStorage.removeItem('@remember_me');
      }
      await AsyncStorage.removeItem('@saved_password');
      navigation.replace('MainApp');
    } catch (error) {
      let errorMsg = 'An error occurred. Please try again later.';
      if (error.response?.data?.detail) {
        errorMsg = error.response.data.detail;
      } else if (error.message === 'Network Error' || error.code === 'ERR_NETWORK') {
        errorMsg = 'Cannot connect right now. Please check your internet connection and try again.';
      } else if (error.response?.status === 401) {
        errorMsg = 'Invalid email or password. Please try again.';
      } else if (error.response?.status === 403) {
        errorMsg = 'Access forbidden. Please verify your email before signing in.';
      } else if (error.response?.status === 500) {
        errorMsg = 'Something went wrong. Please try again later.';
      }
      setErrorMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };


  return (
    <View className="flex-1 bg-[#F8FAFC]">
      <StatusBar barStyle="light-content" backgroundColor="#083B4C" />
      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View className="bg-[#083B4C] pt-14 pb-9 px-6 relative overflow-hidden">
          <View className="absolute -top-16 -right-16 w-52 h-52 rounded-full bg-cyan-400/10" />
          <View className="absolute -bottom-24 -left-16 w-64 h-64 rounded-full bg-emerald-300/10" />

          <View className="flex-row items-center mb-7">
            <View className="w-12 h-12 rounded-2xl bg-white/15 items-center justify-center border border-white/20">
              <MaterialCommunityIcons name="water-check-outline" size={27} color="#FFFFFF" />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-white text-lg font-extrabold">AquaGuard</Text>
              <Text className="text-cyan-100 text-xs">Water quality monitor</Text>
            </View>
          </View>

          <Text className="text-4xl font-extrabold text-white mb-3">Welcome back</Text>
          <Text className="text-base text-cyan-100 leading-6 mb-6">
            Sign in to check whether your water is okay to use.
          </Text>
        </View>

        <View className="mx-5 -mt-5 rounded-2xl bg-white border border-slate-100 p-5 shadow-sm">
          {errorMessage ? (
            <View className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5 flex-row items-start">
              <MaterialIcons name="error-outline" size={20} color="#DC2626" />
              <Text className="text-red-700 text-sm ml-2 flex-1 leading-5">{errorMessage}</Text>
            </View>
          ) : null}

          <View className="mb-5">
            <Text className="text-xs font-bold text-slate-500 mb-2 tracking-wider">EMAIL ADDRESS</Text>
            <View className="flex-row items-center bg-slate-50 rounded-xl border border-slate-200 px-4 h-14">
              <MaterialCommunityIcons name="email-outline" size={20} color="#64748B" />
              <TextInput
                className="flex-1 text-base text-slate-900 ml-3"
                placeholder="Enter your email"
                placeholderTextColor="#94A3B8"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                importantForAutofill="no"
                editable={!busy}
              />
            </View>
          </View>

          <View className="mb-4">
            <Text className="text-xs font-bold text-slate-500 mb-2 tracking-wider">PASSWORD</Text>
            <View className="flex-row items-center bg-slate-50 rounded-xl border border-slate-200 px-4 h-14">
              <MaterialIcons name="lock-outline" size={20} color="#64748B" />
              <TextInput
                className="flex-1 text-base text-slate-900 ml-3"
                placeholder="Your password"
                placeholderTextColor="#94A3B8"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                importantForAutofill="no"
                editable={!busy}
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)} disabled={busy} className="p-1">
                <MaterialIcons name={showPassword ? 'visibility' : 'visibility-off'} size={20} color="#64748B" />
              </TouchableOpacity>
            </View>
          </View>

          <View className="flex-row justify-between items-center mb-6">
            <TouchableOpacity className="flex-row items-center" onPress={() => setRememberMe(!rememberMe)} disabled={busy}>
              <View className={`w-5 h-5 rounded-md border-2 border-[#0891B2] mr-2 justify-center items-center ${rememberMe ? 'bg-[#0891B2]' : 'bg-white'}`}>
                {rememberMe && <MaterialIcons name="check" size={15} color="#FFFFFF" />}
              </View>
              <Text className="text-sm text-slate-600">Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('ForgotPassword')} disabled={busy}>
              <Text className="text-sm text-[#0891B2] font-bold">Forgot password?</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            className={`rounded-xl h-14 justify-center items-center mb-4 ${busy ? 'bg-slate-400' : 'bg-[#0891B2]'}`}
            onPress={handleSignIn}
            disabled={busy}
            activeOpacity={0.86}
          >
            {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-extrabold">Sign in</Text>}
          </TouchableOpacity>

          <View className="flex-row justify-center items-center">
            <Text className="text-sm text-slate-500">New to AquaGuard? </Text>
            <TouchableOpacity onPress={() => navigation.navigate('SignUp')} disabled={busy}>
              <Text className="text-sm text-[#0891B2] font-extrabold">Create account</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default LoginScreen;
