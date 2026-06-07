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
  Image,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';

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
      Alert.alert('Error', 'Failed to load profile data. Please try again.');
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
            title: 'Camera Permission',
            message: 'AquaGuard needs access to your camera to take profile photos',
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

  const handleImagePicker = () => {
    Alert.alert(
      'Profile Photo',
      'Choose an option',
      [
        {
          text: 'Take Photo',
          onPress: handleTakePhoto,
        },
        {
          text: 'Choose from Gallery',
          onPress: handleChooseFromGallery,
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  const handleTakePhoto = async () => {
    const hasPermission = await requestCameraPermission();
    
    if (!hasPermission) {
      Alert.alert('Permission Denied', 'Camera permission is required to take photos');
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
        Alert.alert('Error', 'Failed to take photo. Please try again.');
        return;
      }

      if (response.assets && response.assets[0]) {
        const base64Image = `data:${response.assets[0].type};base64,${response.assets[0].base64}`;
        setProfileImage(base64Image);
      }
    });
  };

  const handleChooseFromGallery = () => {
    const options = {
      mediaType: 'photo',
      quality: 0.8,
      maxWidth: 500,
      maxHeight: 500,
      includeBase64: true,
    };

    launchImageLibrary(options, (response) => {
      if (response.didCancel) {
        return;
      }

      if (response.errorCode) {
        Alert.alert('Error', 'Failed to select photo. Please try again.');
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
      Alert.alert('Validation Error', 'Please enter your full name');
      return;
    }

    if (fullName.trim().length < 3) {
      Alert.alert('Validation Error', 'Full name must be at least 3 characters');
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

      Alert.alert('Success', 'Profile updated successfully', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
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
          <Text className="text-xs mt-2" style={{ color: theme.colors.textTertiary }}>
            Tap to change photo
          </Text>
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
