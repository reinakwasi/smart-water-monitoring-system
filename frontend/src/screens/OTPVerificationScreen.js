import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { authAPI } from '../services/api';

const OTPVerificationScreen = ({ route, navigation }) => {
  const { email } = route.params;
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [timer, setTimer] = useState(60);
  const inputRefs = useRef([]);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleOtpChange = (value, index) => {
    if (isNaN(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpCode = otp.join('');
    
    if (otpCode.length !== 6) {
      Alert.alert('Invalid OTP', 'Please enter the complete 6-digit code');
      return;
    }

    setLoading(true);
    
    try {
      await authAPI.verifyOTP({ email, otp: otpCode });
      
      Alert.alert(
        'Success! 🎉',
        'Your email has been verified successfully! You can now sign in to your account.',
        [
          {
            text: 'Sign In',
            onPress: () => navigation.navigate('Login')
          }
        ]
      );
      
    } catch (error) {
      console.error('OTP verification error:', error);
      
      if (error.response?.status === 400) {
        Alert.alert('Verification Failed', 'Invalid or expired OTP code. Please try again or request a new code.');
      } else {
        Alert.alert('Error', 'Failed to verify OTP. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    if (timer > 0) return;

    setResending(true);
    
    try {
      await authAPI.resendOTP({ email });
      
      Alert.alert('Success', 'A new OTP code has been sent to your email');
      setTimer(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      
    } catch (error) {
      console.error('Resend OTP error:', error);
      Alert.alert('Error', 'Failed to resend OTP. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="light-content" backgroundColor="#0891B2" />
      
      <View className="bg-[#0891B2] pt-12 pb-12 px-6 relative overflow-hidden items-center">
        <View className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-white/10" />
        
        <TouchableOpacity className="absolute top-12 left-5 p-2" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>

        <View className="mb-5">
          <MaterialIcons name="mark-email-read" size={64} color="#FFFFFF" />
        </View>

        <Text className="text-3xl font-bold text-white mb-3 text-center">Verify Your Email</Text>
        <Text className="text-sm text-cyan-100 text-center leading-5">
          We've sent a 6-digit code to{'\n'}
          <Text className="font-semibold text-white">{email}</Text>
        </Text>
      </View>

      <View className="flex-1 bg-white rounded-t-3xl -mt-5 px-6 pt-10">
        <Text className="text-xs font-semibold text-slate-600 mb-4 tracking-wider text-center">ENTER OTP CODE</Text>
        
        <View className="flex-row justify-between mb-8">
          {otp.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => (inputRefs.current[index] = ref)}
              className={`w-12 h-14 border-2 rounded-xl text-center text-2xl font-semibold ${digit ? 'border-[#0891B2] bg-white' : 'border-slate-200 bg-gray-50'}`}
              style={{ color: '#1E293B' }}
              value={digit}
              onChangeText={(value) => handleOtpChange(value, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center mb-6 ${loading ? 'bg-slate-400' : 'bg-[#0891B2]'}`}
          onPress={handleVerify}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Verify Email</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center items-center">
          <Text className="text-sm text-slate-500">Didn't receive the code? </Text>
          {timer > 0 ? (
            <Text className="text-sm text-slate-400 font-medium">Resend in {timer}s</Text>
          ) : (
            <TouchableOpacity onPress={handleResendOTP} disabled={resending}>
              {resending ? (
                <ActivityIndicator size="small" color="#0891B2" />
              ) : (
                <Text className="text-sm text-[#0891B2] font-semibold">Resend OTP</Text>
              )}
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

export default OTPVerificationScreen;
