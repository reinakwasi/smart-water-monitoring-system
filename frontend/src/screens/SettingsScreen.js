import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const SettingsScreen = ({ navigation }) => {
  const [userProfile, setUserProfile] = useState({
    name: 'Samuel Antwi-Adjei',
    email: 'samuel@email.com',
    initials: 'SA',
  });
  
  const [esp32Status, setEsp32Status] = useState({
    online: false,
    wifiSignal: 'Strong · -47 dBm',
    lastSync: '2 mins ago',
  });
  
  const [settings, setSettings] = useState({
    darkMode: false,
    unsafeWaterAlerts: true,
    contaminationRisk: true,
    tankLevelAlerts: true,
    pushNotifications: true,
  });

  useEffect(() => {
    loadUserProfile();
    loadSettings();
    checkESP32Status();
  }, []);

  const loadUserProfile = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem('@saved_email');
      const token = await AsyncStorage.getItem('@access_token');
      
      if (savedEmail) {
        const nameParts = savedEmail.split('@')[0].split('.');
        const firstName = nameParts[0] || 'User';
        const lastName = nameParts[1] || '';
        const fullName = `${firstName.charAt(0).toUpperCase() + firstName.slice(1)} ${lastName.charAt(0).toUpperCase() + lastName.slice(1)}`.trim();
        const initials = `${firstName.charAt(0).toUpperCase()}${lastName.charAt(0).toUpperCase() || firstName.charAt(1).toUpperCase()}`;
        
        setUserProfile({
          name: fullName || 'User',
          email: savedEmail,
          initials: initials || 'U',
        });
      }
    } catch (error) {
      console.error('Error loading user profile:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('@app_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('@app_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving settings:', error);
    }
  };

  const checkESP32Status = async () => {
    try {
      const token = await AsyncStorage.getItem('@access_token');
      
      if (!token) {
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/status/current-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      const data = response.data;
      const now = new Date();
      const lastUpdate = new Date(data.water_quality.timestamp);
      const minutesAgo = Math.floor((now - lastUpdate) / 60000);
      
      setEsp32Status({
        online: minutesAgo < 5,
        wifiSignal: 'Strong · -47 dBm',
        lastSync: minutesAgo < 1 ? 'Just now' : `${minutesAgo} mins ago`,
      });
    } catch (error) {
      setEsp32Status({
        online: false,
        wifiSignal: 'Offline',
        lastSync: 'N/A',
      });
    }
  };

  const toggleSetting = (key) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const handleEditProfile = () => {
    Alert.alert('Edit Profile', 'Profile editing feature coming soon');
  };

  const handleChangePassword = () => {
    Alert.alert('Change Password', 'Password change feature coming soon');
  };

  const handleViewHistory = () => {
    navigation.navigate('History');
  };

  const handleExportData = () => {
    Alert.alert('Export Data', 'Data export feature coming soon. You will be able to download your water quality data as PDF or CSV.');
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.removeItem('@access_token');
              await AsyncStorage.removeItem('@refresh_token');
              navigation.replace('Login');
            } catch (error) {
              console.error('Error signing out:', error);
            }
          },
        },
      ]
    );
  };

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
      >
        {/* Header */}
        <View className="px-5 pt-12 pb-4">
          <Text className="text-2xl font-bold text-slate-800">Settings</Text>
          <Text className="text-sm text-slate-400">Account & preferences</Text>
        </View>

        {/* Profile Card */}
        <View className="mx-5 bg-[#0891B2] rounded-2xl p-6 mb-5 relative overflow-hidden">
          <View className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10" style={{ transform: [{ translateX: 40 }, { translateY: -40 }] }} />
          
          <View className="items-center mb-4">
            <View className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 justify-center items-center mb-3">
              <Text className="text-3xl font-bold text-white">{userProfile.initials}</Text>
            </View>
            <Text className="text-xl font-bold text-white mb-1">{userProfile.name}</Text>
            <Text className="text-sm text-cyan-100">{userProfile.email}</Text>
          </View>
          
          <View className="flex-row justify-center">
            <TouchableOpacity 
              className="bg-white/20 px-4 py-2 rounded-lg mr-2"
              onPress={handleEditProfile}
            >
              <Text className="text-sm font-semibold text-white">Edit Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              className="bg-white/20 px-4 py-2 rounded-lg ml-2"
              onPress={handleChangePassword}
            >
              <Text className="text-sm font-semibold text-white">Change Password</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Connected Device */}
        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">CONNECTED DEVICE</Text>
          
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 rounded-xl bg-cyan-500 justify-center items-center mr-3">
                <MaterialCommunityIcons name="chip" size={24} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold text-slate-800">ESP32 SENSOR HUB</Text>
              </View>
              <View className={`px-3 py-1 rounded-full ${esp32Status.online ? 'bg-green-100' : 'bg-red-100'}`}>
                <Text className={`text-xs font-semibold ${esp32Status.online ? 'text-green-700' : 'text-red-700'}`}>
                  {esp32Status.online ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            
            <View className="flex-row justify-between bg-slate-50 rounded-xl p-3">
              <View className="flex-1">
                <Text className="text-xs text-slate-500 mb-1">Wi-Fi Signal</Text>
                <Text className="text-sm font-semibold text-slate-700">{esp32Status.wifiSignal}</Text>
              </View>
              <View className="flex-1 items-end">
                <Text className="text-xs text-slate-500 mb-1">Last Sync</Text>
                <Text className="text-sm font-semibold text-slate-700">{esp32Status.lastSync}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Appearance */}
        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">APPEARANCE</Text>
          
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-slate-100 justify-center items-center mr-3">
                <MaterialIcons name="dark-mode" size={20} color="#64748B" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Dark Mode</Text>
                <Text className="text-xs text-slate-500">Easier on the eyes at night</Text>
              </View>
              <Switch
                value={settings.darkMode}
                onValueChange={() => toggleSetting('darkMode')}
                trackColor={{ false: '#E2E8F0', true: '#0891B2' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Notifications */}
        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">NOTIFICATIONS</Text>
          
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            {/* Unsafe Water Alerts */}
            <View className="flex-row items-center mb-4 pb-4 border-b border-slate-100">
              <View className="w-10 h-10 rounded-xl bg-red-50 justify-center items-center mr-3">
                <MaterialIcons name="warning" size={20} color="#EF4444" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Unsafe water alerts</Text>
                <Text className="text-xs text-slate-500">When water is not safe to drink</Text>
              </View>
              <Switch
                value={settings.unsafeWaterAlerts}
                onValueChange={() => toggleSetting('unsafeWaterAlerts')}
                trackColor={{ false: '#E2E8F0', true: '#0891B2' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Contamination Risk */}
            <View className="flex-row items-center mb-4 pb-4 border-b border-slate-100">
              <View className="w-10 h-10 rounded-xl bg-yellow-50 justify-center items-center mr-3">
                <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#F59E0B" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Contamination risk</Text>
                <Text className="text-xs text-slate-500">High risk warnings</Text>
              </View>
              <Switch
                value={settings.contaminationRisk}
                onValueChange={() => toggleSetting('contaminationRisk')}
                trackColor={{ false: '#E2E8F0', true: '#0891B2' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Tank Level Alerts */}
            <View className="flex-row items-center mb-4 pb-4 border-b border-slate-100">
              <View className="w-10 h-10 rounded-xl bg-blue-50 justify-center items-center mr-3">
                <MaterialCommunityIcons name="cup-water" size={20} color="#3B82F6" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Tank level alerts</Text>
                <Text className="text-xs text-slate-500">Empty, low, full or overflowing</Text>
              </View>
              <Switch
                value={settings.tankLevelAlerts}
                onValueChange={() => toggleSetting('tankLevelAlerts')}
                trackColor={{ false: '#E2E8F0', true: '#0891B2' }}
                thumbColor="#FFFFFF"
              />
            </View>

            {/* Push Notifications */}
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl bg-cyan-50 justify-center items-center mr-3">
                <MaterialIcons name="notifications-none" size={20} color="#0891B2" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Push notifications</Text>
                <Text className="text-xs text-slate-500">Receive alerts on this device</Text>
              </View>
              <Switch
                value={settings.pushNotifications}
                onValueChange={() => toggleSetting('pushNotifications')}
                trackColor={{ false: '#E2E8F0', true: '#0891B2' }}
                thumbColor="#FFFFFF"
              />
            </View>
          </View>
        </View>

        {/* Account */}
        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">ACCOUNT</Text>
          
          <View className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* View History */}
            <TouchableOpacity 
              className="flex-row items-center p-4 border-b border-slate-100"
              onPress={handleViewHistory}
            >
              <View className="w-10 h-10 rounded-xl bg-cyan-50 justify-center items-center mr-3">
                <MaterialIcons name="access-time" size={20} color="#0891B2" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">View History</Text>
                <Text className="text-xs text-slate-500">Past water checks</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
            </TouchableOpacity>

            {/* Export Data */}
            <TouchableOpacity 
              className="flex-row items-center p-4"
              onPress={handleExportData}
            >
              <View className="w-10 h-10 rounded-xl bg-green-50 justify-center items-center mr-3">
                <MaterialIcons name="file-download" size={20} color="#10B981" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold text-slate-800">Export Data</Text>
                <Text className="text-xs text-slate-500">Download as PDF or CSV</Text>
              </View>
              <MaterialIcons name="chevron-right" size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign Out Button */}
        <View className="px-5 mb-8">
          <TouchableOpacity 
            className="bg-red-50 rounded-2xl p-4 border border-red-200"
            onPress={handleSignOut}
          >
            <Text className="text-base font-bold text-red-600 text-center">Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
