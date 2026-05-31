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
import { useTheme } from '../context/ThemeContext';

const EditProfileScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const userName = await AsyncStorage.getItem('@user_name');
      const userEmail = await AsyncStorage.getItem('@user_email');
      const userPhone = await AsyncStorage.getItem('@user_phone');
      const userLocation = await AsyncStorage.getItem('@user_location');

      setFullName(userName || '');
      setEmail(userEmail || '');
      setPhoneNumber(userPhone || '');
      setLocation(userLocation || '');
    } catch (error) {
      console.error('Error loading user data:', error);
    } finally {
      setInitialLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return 'SA';
    const names = name.trim().split(' ');
    if (names.length === 1) {
      return names[0].substring(0, 2).toUpperCase();
    }
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const handleSaveChanges = async () => {
    if (!fullName.trim()) {
      Alert.alert('Validation Error', 'Please enter your full name');
      return;
    }

    if (fullName.trim().length < 3) {
      Alert.alert('Validation Error', 'Full name must be at least 3 characters');
      return;
    }

    setLoading(true);

    try {
      await AsyncStorage.setItem('@user_name', fullName.trim());
      
      if (phoneNumber.trim()) {
        await AsyncStorage.setItem('@user_phone', phoneNumber.trim());
      }
      
      if (location.trim()) {
        await AsyncStorage.setItem('@user_location', location.trim());
      }

      Alert.alert(
        'Success',
        'Your profile has been updated successfully',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } catch (error) {
      console.error('Error saving profile:', error);
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (initialLoading) {
    return (
      <View className="flex-1 justify-center items-center" style={{ backgroundColor: theme.colors.background }}>
        <ActivityIndicator size="large" color="#0B7FA5" />
      </View>
    );
  }

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <View className="bg-[#0B7FA5] pt-12 pb-12 px-6 relative overflow-hidden">
        <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        
        <TouchableOpacity className="flex-row items-center mb-8" onPress={handleCancel}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>

        <Text className="text-4xl font-bold text-white mb-2">Edit Profile</Text>
        <Text className="text-base text-cyan-100">Update your account details</Text>
      </View>

      <ScrollView className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8" style={{ backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={false}>
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-[#0B7FA5] justify-center items-center relative">
            <Text className="text-3xl font-bold text-white">{getInitials(fullName)}</Text>
            <TouchableOpacity className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white justify-center items-center shadow-lg">
              <MaterialIcons name="photo-camera" size={16} color="#0B7FA5" />
            </TouchableOpacity>
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            FULL NAME
          </Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }}>
            <MaterialIcons name="person-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput
              className="flex-1 text-base"
              style={{ color: theme.colors.text }}
              placeholder="Samuel Antwi-Adjei"
              placeholderTextColor={theme.colors.textTertiary}
              value={fullName}
              onChangeText={setFullName}
              editable={!loading}
            />
          </View>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            EMAIL ADDRESS
          </Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0', borderColor: theme.colors.border }}>
            <MaterialCommunityIcons name="email-outline" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput
              className="flex-1 text-base"
              style={{ color: theme.isDarkMode ? '#94A3B8' : '#64748B' }}
              placeholder="samuel@email.com"
              placeholderTextColor={theme.colors.textTertiary}
              value={email}
              editable={false}
            />
            <MaterialIcons name="lock" size={16} color={theme.colors.textTertiary} />
          </View>
          <Text className="text-xs mt-1.5 ml-1" style={{ color: theme.colors.textTertiary }}>
            Email cannot be changed for security reasons
          </Text>
        </View>

        <View className="mb-5">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            PHONE NUMBER
          </Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }}>
            <MaterialIcons name="phone" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput
              className="flex-1 text-base"
              style={{ color: theme.colors.text }}
              placeholder="+233 20 000 0000"
              placeholderTextColor={theme.colors.textTertiary}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>
        </View>

        <View className="mb-6">
          <Text className="text-xs font-semibold mb-2.5 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            LOCATION
          </Text>
          <View className="flex-row items-center rounded-xl border px-4 h-14" style={{ backgroundColor: theme.isDarkMode ? '#1E293B' : '#F1F5F9', borderColor: theme.colors.border }}>
            <MaterialIcons name="location-on" size={20} color={theme.colors.textTertiary} className="mr-3" />
            <TextInput
              className="flex-1 text-base"
              style={{ color: theme.colors.text }}
              placeholder="Kumasi, Ghana"
              placeholderTextColor={theme.colors.textTertiary}
              value={location}
              onChangeText={setLocation}
              editable={!loading}
            />
          </View>
        </View>

        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center mb-4 ${loading ? 'bg-slate-400' : 'bg-[#0B7FA5]'}`}
          onPress={handleSaveChanges}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text className="text-white text-base font-semibold">Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity 
          className="rounded-xl h-14 justify-center items-center mb-8 border"
          style={{ borderColor: theme.colors.border }}
          onPress={handleCancel}
          disabled={loading}
        >
          <Text className="text-base font-semibold" style={{ color: theme.colors.text }}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

export default EditProfileScreen;
