import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, USER_PROFILE_KEY } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';

const EditProfileScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [location, setLocation] = useState('');
  const [profileImage, setProfileImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    try {
      const profile = await authAPI.getProfile();

      setFullName(profile.full_name || '');
      setEmail(profile.email || '');
      setPhoneNumber(profile.phone || '');
      setLocation(profile.location || '');
      setProfileImage(profile.profile_picture || null);
    } catch (error) {
      try {
        const cachedProfile = await AsyncStorage.getItem(USER_PROFILE_KEY);
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          setFullName(profile.full_name || '');
          setEmail(profile.email || '');
          setPhoneNumber(profile.phone || '');
          setLocation(profile.location || '');
          setProfileImage(profile.profile_picture || null);
        } else {
          showAppAlert('Profile unavailable', 'AquaGuard could not load your profile. Check your connection and try again.', [], 'error');
        }
      } catch (cacheError) {
        showAppAlert('Profile unavailable', 'AquaGuard could not load your profile. Check your connection and try again.', [], 'error');
      }
    } finally {
      setInitialLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name || !name.trim()) return 'U';
    const names = name.trim().split(' ').filter(n => n.length > 0);
    if (names.length === 0) return 'U';
    if (names.length === 1) {
      const firstName = names[0];
      return firstName.length >= 2
        ? firstName.substring(0, 2).toUpperCase()
        : firstName.charAt(0).toUpperCase();
    }
    return (names[0][0] + names[names.length - 1][0]).toUpperCase();
  };

  const requestCameraPermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.CAMERA,
          {
            title: 'Camera access',
            message: 'Allow camera access to take a profile photo.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true;
  };

  const requestGalleryPermission = async () => {
    if (Platform.OS !== 'android') return true;

    const permission = Platform.Version >= 33
      ? PermissionsAndroid.PERMISSIONS.READ_MEDIA_IMAGES
      : PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE;

    if (!permission) return true;

    try {
      const granted = await PermissionsAndroid.request(permission, {
        title: 'Photo access',
        message: 'Allow photo access to choose a profile picture.',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      });
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn(err);
      return false;
    }
  };

  const handleImagePicker = () => {
    showAppAlert(
      'Profile photo',
      'Choose how you want to update your account photo.',
      [
        { text: 'Take photo', onPress: handleTakePhoto },
        { text: 'Choose from gallery', onPress: handleChooseFromGallery },
        { text: 'Cancel', style: 'cancel' },
      ],
      'info',
    );
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();

    if (!hasPermission) {
      showAppAlert('Camera permission needed', 'Allow camera access before taking a profile photo.', [], 'warning');
      return;
    }

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: true,
      saveToPhotos: false,
    };

    launchCamera(options, (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        showAppAlert('Photo not captured', 'The camera could not take the photo. Please try again.', [], 'error');
        return;
      }

      if (response.assets && response.assets[0]) {
        const base64Image = `data:${response.assets[0].type};base64,${response.assets[0].base64}`;
        setProfileImage(base64Image);
      }
    });
  };

  const handleChooseFromGallery = async () => {
    const hasPermission = await requestGalleryPermission();

    if (!hasPermission) {
      showAppAlert('Photo permission needed', 'Allow photo access before choosing a profile picture from your device.', [], 'warning');
      return;
    }

    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: true,
      selectionLimit: 1,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        showAppAlert('Photo not selected', 'AquaGuard could not load that photo. Please try again.', [], 'error');
        return;
      }

      if (response.assets && response.assets[0]) {
        const base64Image = `data:${response.assets[0].type};base64,${response.assets[0].base64}`;
        setProfileImage(base64Image);
      }
    });
  };

  const handleSaveChanges = async () => {
    if (!fullName.trim()) {
      showAppAlert('Name required', 'Please enter your full name.', [], 'warning');
      return;
    }

    if (fullName.trim().length < 3) {
      showAppAlert('Name too short', 'Full name must be at least 3 characters.', [], 'warning');
      return;
    }

    setLoading(true);

    try {
      await authAPI.updateProfile({
        full_name: fullName.trim(),
        phone: phoneNumber.trim() || null,
        location: location.trim() || null,
        profile_picture: profileImage || null,
      });

      showAppAlert('Profile updated', 'Your account details have been saved successfully.', [
        { text: 'Done', onPress: () => navigation.goBack() },
      ], 'success');
    } catch (error) {
      showAppAlert('Profile not saved', error.response?.data?.detail || 'AquaGuard could not update your profile. Please try again.', [], 'error');
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

        <Text className="text-4xl font-bold text-white mb-2">Edit profile</Text>
        <Text className="text-base text-cyan-100">Update your account details</Text>
      </View>

      <ScrollView className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8" style={{ backgroundColor: theme.colors.background }} showsVerticalScrollIndicator={false} bounces={false}>
        <View className="items-center mb-8">
          <TouchableOpacity
            className="w-24 h-24 rounded-full bg-[#0B7FA5] justify-center items-center relative"
            onPress={handleImagePicker}
            activeOpacity={0.8}
          >
            {profileImage ? (
              <Image
                source={{ uri: profileImage }}
                className="w-24 h-24 rounded-full"
                resizeMode="cover"
              />
            ) : (
              <Text className="text-3xl font-bold text-white">{getInitials(fullName)}</Text>
            )}
            <View className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-white justify-center items-center shadow-lg">
              <MaterialIcons name="photo-camera" size={16} color="#0B7FA5" />
            </View>
          </TouchableOpacity>
          <Text className="text-xs mt-2 mb-3" style={{ color: theme.colors.textTertiary }}>
            Choose a profile photo
          </Text>
          <View className="flex-row">
            <TouchableOpacity
              className="flex-row items-center px-4 py-2 rounded-xl bg-cyan-50 border border-cyan-100 mr-2"
              onPress={handleChooseFromGallery}
              disabled={loading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="photo-library" size={18} color="#0B7FA5" />
              <Text className="text-sm font-bold ml-2 text-[#0B7FA5]">Choose from device</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row items-center px-4 py-2 rounded-xl bg-slate-50 border border-slate-200"
              onPress={handleTakePhoto}
              disabled={loading}
              activeOpacity={0.85}
            >
              <MaterialIcons name="photo-camera" size={18} color="#64748B" />
              <Text className="text-sm font-bold ml-2 text-slate-600">Camera</Text>
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
              placeholder="Your full name"
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
              placeholder="your.email@example.com"
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
            <Text className="text-white text-base font-semibold">Save changes</Text>
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
