import React, { useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';


const PasswordField = ({ label, value, onChangeText, visible, onToggle, theme, editable }) => (
  <View className="mb-5">
    <Text className="text-xs font-bold tracking-wider mb-2" style={{ color: theme.colors.textSecondary }}>
      {label}
    </Text>
    <View
      className="h-14 rounded-2xl border px-4 flex-row items-center"
      style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}
    >
      <MaterialIcons name="lock-outline" size={20} color={theme.colors.textTertiary} />
      <TextInput
        className="flex-1 ml-3 text-base"
        style={{ color: theme.colors.text }}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        editable={editable}
        placeholder="Enter password"
        placeholderTextColor={theme.colors.textTertiary}
      />
      <TouchableOpacity onPress={onToggle} accessibilityRole="button" accessibilityLabel={`Show ${label.toLowerCase()}`}>
        <MaterialIcons name={visible ? 'visibility-off' : 'visibility'} size={21} color={theme.colors.textTertiary} />
      </TouchableOpacity>
    </View>
  </View>
);


const ChangePasswordScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [visibleField, setVisibleField] = useState(null);
  const [saving, setSaving] = useState(false);

  const validate = () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      showAppAlert('Details required', 'Complete all three password fields.');
      return false;
    }
    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      showAppAlert('Choose a stronger password', 'Use at least 8 characters with uppercase, lowercase, and a number.');
      return false;
    }
    if (newPassword !== confirmPassword) {
      showAppAlert('Passwords do not match', 'Re-enter the new password in both fields.');
      return false;
    }
    if (currentPassword === newPassword) {
      showAppAlert('Choose a new password', 'Your new password must be different from the current password.');
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      showAppAlert('Password updated', 'Your account now uses the new password.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      showAppAlert(
        'Password not changed',
        error.response?.data?.detail || 'AquaGuard could not update the password. Check the current password and try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#083B4C" />
      <View className="bg-[#083B4C] pt-12 pb-10 px-5">
        <TouchableOpacity className="w-11 h-11 rounded-full bg-white/10 items-center justify-center mb-7" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={23} color="#FFFFFF" />
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-white">Change password</Text>
        <Text className="text-sm text-cyan-100 mt-2 leading-5">Protect your AquaGuard account with a password only you know.</Text>
      </View>

      <ScrollView className="flex-1 -mt-4 rounded-t-3xl" style={{ backgroundColor: theme.colors.background }} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View className="rounded-2xl p-4 mb-6 flex-row" style={{ backgroundColor: theme.isDarkMode ? '#164E63' : '#ECFEFF' }}>
          <MaterialIcons name="security" size={22} color="#0891B2" />
          <Text className="flex-1 ml-3 text-sm leading-5" style={{ color: theme.colors.textSecondary }}>
            After the update, use the new password the next time you sign in.
          </Text>
        </View>

        <PasswordField label="CURRENT PASSWORD" value={currentPassword} onChangeText={setCurrentPassword} visible={visibleField === 'current'} onToggle={() => setVisibleField(visibleField === 'current' ? null : 'current')} theme={theme} editable={!saving} />
        <PasswordField label="NEW PASSWORD" value={newPassword} onChangeText={setNewPassword} visible={visibleField === 'new'} onToggle={() => setVisibleField(visibleField === 'new' ? null : 'new')} theme={theme} editable={!saving} />
        <PasswordField label="CONFIRM NEW PASSWORD" value={confirmPassword} onChangeText={setConfirmPassword} visible={visibleField === 'confirm'} onToggle={() => setVisibleField(visibleField === 'confirm' ? null : 'confirm')} theme={theme} editable={!saving} />

        <TouchableOpacity className="h-14 rounded-2xl bg-[#0891B2] items-center justify-center mt-2" onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white text-base font-bold">Update password</Text>}
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default ChangePasswordScreen;
