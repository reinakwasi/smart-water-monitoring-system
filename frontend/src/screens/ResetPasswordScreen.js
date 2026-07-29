import React, { useState } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';

const ResetPasswordScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const { email } = route.params || {};
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [passwordStrength, setPasswordStrength] = useState('');
  const [isFormValid, setIsFormValid] = useState(false);

  const calculatePasswordStrength = password => {
    let strength = 0;
    const feedback = [];

    if (password.length >= 8) strength += 1;
    else feedback.push('at least 8 characters');

    if (/[A-Z]/.test(password)) strength += 1;
    else feedback.push('one uppercase letter');

    if (/[a-z]/.test(password)) strength += 1;
    else feedback.push('one lowercase letter');

    if (/[0-9]/.test(password)) strength += 1;
    else feedback.push('one number');

    if (/[^A-Za-z0-9]/.test(password)) strength += 1;
    else feedback.push('one special character (!@#$%^&*)');

    if (password.length >= 12) strength += 1;
    if (password.length >= 16) strength += 1;

    let level = 'Weak';
    let color = '#EF4444';
    if (strength >= 5) {
      level = 'Strong';
      color = '#10B981';
    } else if (strength >= 3) {
      level = 'Medium';
      color = '#F59E0B';
    }

    return {
      level,
      color,
      strength,
      feedback: feedback.length > 0 ? `Add ${feedback.join(', ')}` : 'Great password!',
      isValid: strength >= 5,
    };
  };

  const checkFormValidity = (code, passwordValue, confirmPasswordValue) => {
    const codeValid = code.trim().length === 6;
    const passwordStrengthCheck = calculatePasswordStrength(passwordValue);
    const passwordsMatch = passwordValue === confirmPasswordValue && confirmPasswordValue.length > 0;
    setIsFormValid(codeValid && passwordStrengthCheck.isValid && passwordsMatch);
  };

  const handlePasswordChange = text => {
    setNewPassword(text);
    if (text.length > 0) {
      const strength = calculatePasswordStrength(text);
      setPasswordStrength(strength.level);
      setPasswordError(strength.isValid ? '' : strength.feedback);
    } else {
      setPasswordStrength('');
      setPasswordError('');
    }

    setConfirmPasswordError(confirmPassword && text !== confirmPassword ? 'Passwords do not match' : '');
    checkFormValidity(resetCode, text, confirmPassword);
  };

  const handleConfirmPasswordChange = text => {
    setConfirmPassword(text);
    setConfirmPasswordError(text.length > 0 && text !== newPassword ? 'Passwords do not match' : '');
    checkFormValidity(resetCode, newPassword, text);
  };

  const handleResetCodeChange = text => {
    setResetCode(text);
    checkFormValidity(text, newPassword, confirmPassword);
  };

  const handleResetPassword = async () => {
    if (!resetCode.trim()) {
      showAppAlert('Reset code required', 'Please enter the reset code.', [], 'warning');
      return;
    }
    if (resetCode.trim().length !== 6) {
      showAppAlert('Invalid code', 'Reset code must be 6 digits.', [], 'warning');
      return;
    }
    if (!newPassword.trim()) {
      showAppAlert('Password required', 'Please enter a new password.', [], 'warning');
      return;
    }

    const passwordStrengthCheck = calculatePasswordStrength(newPassword);
    if (!passwordStrengthCheck.isValid) {
      showAppAlert('Weak password', `Password is too weak. ${passwordStrengthCheck.feedback}`, [], 'warning');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAppAlert('Password mismatch', 'Passwords do not match.', [], 'warning');
      return;
    }

    setLoading(true);
    try {
      await authAPI.resetPassword(email, resetCode.trim(), newPassword);
      showAppAlert('Password reset', 'Your password has been reset successfully. Please sign in with your new password.', [
        { text: 'Sign in', onPress: () => navigation.navigate('Login') },
      ], 'success');
    } catch (error) {
      if (error.response?.status === 400) {
        const errorDetail = error.response?.data?.detail || '';
        if (errorDetail.includes('same as your current password')) {
          showAppAlert('Invalid password', 'Your new password cannot be the same as your current password. Please choose a different password.', [], 'warning');
        } else if (errorDetail.includes('Invalid or expired')) {
          showAppAlert('Invalid code', 'The reset code is invalid or has expired. Please request a new one.', [], 'error');
        } else {
          showAppAlert('Reset failed', errorDetail, [], 'error');
        }
      } else if (error.response?.data?.detail) {
        showAppAlert('Reset failed', error.response.data.detail, [], 'error');
      } else if (error.message === 'Network Error') {
        showAppAlert('Connection error', 'Cannot connect right now. Please check your internet connection.', [], 'error');
      } else {
        showAppAlert('Reset not completed', 'The password could not be reset. Please try again later.', [], 'error');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <View className="bg-[#0B7FA5] pt-12 pb-12 px-6 relative overflow-hidden">
        <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        <TouchableOpacity className="flex-row items-center mb-8" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>
        <Text className="text-4xl font-bold text-white mb-2">Reset password</Text>
        <Text className="text-base text-cyan-100">Enter the code and your new password</Text>
      </View>

      <ScrollView className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8" style={{ backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={false} bounces={false}>
        <View className="rounded-2xl p-4 mb-6 flex-row" style={{ backgroundColor: theme.isDarkMode ? '#1E40AF' : '#DBEAFE' }}>
          <View className="w-12 h-12 rounded-xl bg-cyan-100 justify-center items-center mr-3">
            <MaterialCommunityIcons name="shield-lock-outline" size={24} color="#0891B2" />
          </View>
          <View className="flex-1">
            <Text className="text-base font-bold mb-1" style={{ color: theme.isDarkMode ? '#DBEAFE' : '#1E3A8A' }}>Check your email</Text>
            <Text className="text-sm leading-5" style={{ color: theme.isDarkMode ? '#BFDBFE' : '#3B82F6' }}>
              We have sent a 6-digit code to {email}. Enter it below along with your new password.
            </Text>
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>RESET CODE</Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }}>
            <MaterialCommunityIcons name="shield-key-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput className="flex-1 text-base" style={{ color: theme.colors.text }} placeholder="Enter 6-digit code" placeholderTextColor={theme.colors.textTertiary} value={resetCode} onChangeText={handleResetCodeChange} keyboardType="number-pad" maxLength={6} editable={!loading} />
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>NEW PASSWORD</Text>
          <View className={`flex-row items-center rounded-xl border px-4 h-14 ${passwordError ? (theme.isDarkMode ? 'border-red-400 bg-red-900/20' : 'border-red-500 bg-red-50') : (theme.isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-slate-100')}`}>
            <MaterialCommunityIcons name="lock-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput className="flex-1 text-base" style={{ color: theme.colors.text }} placeholder="Min 8 characters" placeholderTextColor={theme.colors.textTertiary} value={newPassword} onChangeText={handlePasswordChange} secureTextEntry={!showPassword} autoCapitalize="none" editable={!loading} />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              <MaterialCommunityIcons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
          {passwordError ? <Text className="text-xs mt-1.5 ml-1" style={{ color: theme.isDarkMode ? '#FCA5A5' : '#EF4444' }}>{passwordError}</Text> : null}
          {newPassword && passwordStrength ? (
            <View className="flex-row items-center mt-1.5 ml-1">
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Password strength: </Text>
              <Text className="text-xs font-semibold" style={{ color: calculatePasswordStrength(newPassword).color }}>{passwordStrength}</Text>
            </View>
          ) : null}
        </View>

        <View className="mb-6">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>CONFIRM PASSWORD</Text>
          <View className={`flex-row items-center rounded-xl border px-4 h-14 ${confirmPasswordError ? (theme.isDarkMode ? 'border-red-400 bg-red-900/20' : 'border-red-500 bg-red-50') : (theme.isDarkMode ? 'border-slate-600 bg-slate-800' : 'border-slate-200 bg-slate-100')}`}>
            <MaterialCommunityIcons name="lock-check-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput className="flex-1 text-base" style={{ color: theme.colors.text }} placeholder="Re-enter your password" placeholderTextColor={theme.colors.textTertiary} value={confirmPassword} onChangeText={handleConfirmPasswordChange} secureTextEntry={!showConfirmPassword} autoCapitalize="none" editable={!loading} />
            <TouchableOpacity onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
              <MaterialCommunityIcons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={theme.colors.textTertiary} />
            </TouchableOpacity>
          </View>
          {confirmPasswordError ? <Text className="text-xs mt-1.5 ml-1" style={{ color: theme.isDarkMode ? '#FCA5A5' : '#EF4444' }}>{confirmPasswordError}</Text> : null}
          {confirmPassword && !confirmPasswordError ? (
            <Text className="text-xs mt-1.5 ml-1" style={{ color: theme.isDarkMode ? '#86EFAC' : '#10B981' }}>Passwords match</Text>
          ) : null}
        </View>

        <TouchableOpacity className={`rounded-xl h-14 justify-center items-center mb-8 ${(loading || !isFormValid) ? 'bg-slate-400' : 'bg-[#0B7FA5]'}`} onPress={handleResetPassword} disabled={loading || !isFormValid}>
          {loading ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-semibold">Reset password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default ResetPasswordScreen;
