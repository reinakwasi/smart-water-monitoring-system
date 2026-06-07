import React, { useState } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';

const ForgotPasswordScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => {
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return emailRegex.test(email);
  };

  const handleSendResetLink = async () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    setLoading(true);

    try {
      await authAPI.forgotPassword(email.trim().toLowerCase());
      
      Alert.alert(
        'Reset Code Sent',
        'We\'ve sent a 6-digit reset code to your email. Please check your inbox and spam folder.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('ResetPassword', { email: email.trim().toLowerCase() })
          }
        ]
      );
    } catch (error) {
      console.error('Forgot password error:', error);

      if (error.response?.status === 404) {
        Alert.alert('Email Not Found', 'No account found with this email address.');
      } else if (error.response?.data?.detail) {
        Alert.alert('Error', error.response.data.detail);
      } else if (error.message === 'Network Error') {
        Alert.alert('Connection Error', 'Cannot connect to server. Please check your internet connection.');
      } else {
        Alert.alert('Error', 'Failed to send reset link. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleSignIn = () => {
    navigation.navigate('Login');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      {/* Header Section */}
      <View className="bg-[#0B7FA5] pt-12 pb-12 px-6 relative overflow-hidden">
        <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        
        <TouchableOpacity className="flex-row items-center mb-8" onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>

        <Text className="text-4xl font-bold text-white mb-2">Forgot Password?</Text>
        <Text className="text-base text-cyan-100">We'll send a reset link to your email</Text>
      </View>

      {/* Form Section */}
      <ScrollView className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8" style={{ backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={false} bounces={false}>
        {/* Info Card */}
        <View className="rounded-2xl p-4 mb-6 flex-row" style={{ backgroundColor: theme.isDarkMode ? '#1E40AF' : '#DBEAFE' }}>
          <View className="w-12 h-12 rounded-xl bg-cyan-100 justify-center items-center mr-3">
            <MaterialCommunityIcons name="email-outline" size={24} color="#0891B2" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold mb-1" style={{ color: theme.isDarkMode ? '#DBEAFE' : '#1E3A8A' }}>
              Email reset link
            </Text>
            <Text className="text-sm leading-5" style={{ color: theme.isDarkMode ? '#BFDBFE' : '#3B82F6' }}>
              Enter the email address associated with your account and we'll send you a password reset link.
            </Text>
          </View>
        </View>

        {/* Email Input */}
        <View className="mb-6">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            EMAIL ADDRESS
          </Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }}>
            <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput
              className="flex-1 text-base"
              style={{ color: theme.colors.text }}
              placeholder="samuel@email.com"
              placeholderTextColor={theme.colors.textTertiary}
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

        {/* Send Reset Link Button */}
        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center mb-4 ${loading ? 'bg-slate-400' : 'bg-[#0B7FA5]'}`}
          onPress={handleSendResetLink}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Send Reset Link</Text>
          )}
        </TouchableOpacity>

        {/* Spam Folder Notice */}
        <View className="rounded-xl p-4 mb-6 flex-row items-center" style={{ backgroundColor: theme.isDarkMode ? '#1E3A8A' : '#DBEAFE', borderWidth: 1, borderColor: theme.isDarkMode ? '#3B82F6' : '#93C5FD' }}>
          <MaterialIcons name="info-outline" size={20} color="#3B82F6" />
          <Text className="text-sm ml-2 flex-1" style={{ color: theme.isDarkMode ? '#BFDBFE' : '#1E40AF' }}>
            Check your spam folder if you don't see the email
          </Text>
        </View>

        {/* Sign In Link */}
        <View className="flex-row justify-center items-center mb-8">
          <Text className="text-sm" style={{ color: theme.colors.textSecondary }}>Remembered it? </Text>
          <TouchableOpacity onPress={handleSignIn} disabled={loading}>
            <Text className="text-sm text-[#0B7FA5] font-semibold">Sign in</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default ForgotPasswordScreen;
