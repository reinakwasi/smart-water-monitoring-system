import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  Switch,
  Image,
  TextInput,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { authAPI, deviceAPI, statusAPI, USER_PROFILE_KEY } from '../services/api';
import {
  APP_SETTINGS_KEY,
  DEFAULT_TANK_CAPACITY_LITRES,
  formatTimeSinceUpdate,
  getLatestReadingTimestamp,
  isDeviceConnected,
  normalizeTankCapacityLitres,
} from '../utils/homeStatus';
import { showAppAlert } from '../utils/alertHelper';

const DEFAULT_SETTINGS = {
  darkMode: false,
  unsafeWaterAlerts: true,
  contaminationRisk: true,
  tankLevelAlerts: true,
  pushEnabled: true,
  tankCapacityLitres: DEFAULT_TANK_CAPACITY_LITRES,
};

const getInitials = name => {
  if (!name || !name.trim()) return 'U';
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

const SettingsScreen = ({ navigation }) => {
  const { theme, toggleDarkMode } = useTheme();
  const [userProfile, setUserProfile] = useState({
    name: 'User',
    email: '',
    initials: 'U',
    profileImage: null,
  });
  const [esp32Status, setEsp32Status] = useState({
    online: false,
    connectionLabel: 'Waiting for a reading',
    lastSync: 'No reading received',
    deviceName: 'ESP32 Sensor Hub',
    deviceId: null,
  });
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [tankCapacityInput, setTankCapacityInput] = useState(String(DEFAULT_TANK_CAPACITY_LITRES));

  useEffect(() => {
    loadUserProfile();
    loadSettings();
    checkESP32Status();

    const unsubscribe = navigation.addListener('focus', () => {
      loadUserProfile();
      loadSettings(false);
      checkESP32Status();
    });

    return unsubscribe;
  }, [navigation]);

  const navigateToStackScreen = screenName => {
    const parent = navigation.getParent?.();
    if (parent) {
      parent.navigate(screenName);
      return;
    }
    navigation.navigate(screenName);
  };

  const loadUserProfile = async () => {
    try {
      const profile = await authAPI.getProfile();
      setUserProfile({
        name: profile.full_name || 'User',
        email: profile.email || '',
        initials: getInitials(profile.full_name),
        profileImage: profile.profile_picture || null,
      });
    } catch (error) {
      try {
        const cachedProfile = await AsyncStorage.getItem(USER_PROFILE_KEY);
        if (cachedProfile) {
          const profile = JSON.parse(cachedProfile);
          setUserProfile({
            name: profile.full_name || 'User',
            email: profile.email || '',
            initials: getInitials(profile.full_name),
            profileImage: profile.profile_picture || null,
          });
        }
      } catch (cacheError) {
      }
    }
  };

  const loadSettings = async (syncRemote = true) => {
    try {
      const savedSettings = await AsyncStorage.getItem(APP_SETTINGS_KEY);
      const localSettings = savedSettings ? { ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) } : DEFAULT_SETTINGS;
      let merged = localSettings;

      if (syncRemote) {
        try {
          const remote = await authAPI.getNotificationPreferences();
          merged = {
            ...localSettings,
            unsafeWaterAlerts: remote.unsafe_water_alerts !== false,
            contaminationRisk: remote.contamination_risk !== false,
            tankLevelAlerts: remote.tank_level_alerts !== false,
            pushEnabled: remote.push_enabled !== false,
          };
          await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(merged));
        } catch (remoteError) {
        }
      }

      setSettings(merged);
      setTankCapacityInput(String(merged.tankCapacityLitres));
    } catch (error) {
      setSettings(DEFAULT_SETTINGS);
      setTankCapacityInput(String(DEFAULT_TANK_CAPACITY_LITRES));
    }
  };

  const persistSettings = async newSettings => {
    await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(newSettings));
    try {
      await authAPI.updateNotificationPreferences({
        unsafe_water_alerts: newSettings.unsafeWaterAlerts,
        contamination_risk: newSettings.contaminationRisk,
        tank_level_alerts: newSettings.tankLevelAlerts,
        push_enabled: newSettings.pushEnabled,
      });
    } catch (error) {
    }
  };

  const checkESP32Status = async () => {
    try {
      const [statusResult, devicesResult] = await Promise.allSettled([
        statusAPI.getCurrentStatus(),
        deviceAPI.listDevices(),
      ]);
      const data = statusResult.status === 'fulfilled' ? statusResult.value : null;
      const firstDevice = devicesResult.status === 'fulfilled' ? devicesResult.value.devices?.[0] : null;
      const liveTimestamp = getLatestReadingTimestamp(
        data?.water_quality?.timestamp,
        data?.tank_status?.timestamp,
      );
      const latestTimestamp = getLatestReadingTimestamp(
        liveTimestamp,
        firstDevice?.last_communication,
      );
      const online = isDeviceConnected(latestTimestamp);
      const showingLiveReading = Boolean(liveTimestamp);
      setEsp32Status({
        online,
        deviceName: showingLiveReading ? 'ESP32 sensor hub' : firstDevice?.device_name || 'No sensor hub added',
        deviceId: showingLiveReading ? 'Live water-quality reading' : firstDevice?.device_id || null,
        connectionLabel: online ? 'Recent reading received' : showingLiveReading ? 'Latest reading saved' : 'No recent reading',
        lastSync: formatTimeSinceUpdate(latestTimestamp),
      });
    } catch (error) {
      setEsp32Status({
        online: false,
        deviceName: 'Device status unavailable',
        deviceId: null,
        connectionLabel: 'Unable to reach device data',
        lastSync: 'Unavailable',
      });
    }
  };

  const toggleSetting = async key => {
    const newSettings = { ...settings, [key]: !settings[key] };
    setSettings(newSettings);

    if (key === 'darkMode') {
      await toggleDarkMode(newSettings.darkMode);
      await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(newSettings));
      return;
    }

    await persistSettings(newSettings);
  };

  const saveTankCapacity = async () => {
    const capacity = normalizeTankCapacityLitres(tankCapacityInput, null);

    if (!capacity) {
      showAppAlert(
        'Check tank capacity',
        'Enter the size of your container in litres, for example 500.',
        [{ text: 'OK' }],
        'warning',
      );
      return;
    }

    const roundedCapacity = Math.round(capacity);
    const newSettings = { ...settings, tankCapacityLitres: roundedCapacity };
    setSettings(newSettings);
    setTankCapacityInput(String(roundedCapacity));
    await AsyncStorage.setItem(APP_SETTINGS_KEY, JSON.stringify(newSettings));

    showAppAlert(
      'Tank capacity saved',
      'Home and Tank Details will now use this capacity.',
      [{ text: 'OK' }],
      'success',
    );
  };

  const handleSignOut = () => {
    showAppAlert(
      'Sign out?',
      'You will return to the login screen. Your saved readings will remain safely stored.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign out',
          style: 'destructive',
          onPress: async () => {
            await authAPI.logout();
            navigation.getParent()?.reset({ index: 0, routes: [{ name: 'Login' }] });
          },
        },
      ],
      'warning',
    );
  };

  const renderAccountRow = ({ icon, color, bg, title, subtitle, onPress, border = true }) => (
    <TouchableOpacity
      className="flex-row items-center p-4"
      style={{ borderBottomWidth: border ? 1 : 0, borderBottomColor: theme.colors.border }}
      onPress={onPress}
      activeOpacity={0.82}
    >
      <View className="w-10 h-10 rounded-xl justify-center items-center mr-3" style={{ backgroundColor: bg }}>
        <MaterialIcons name={icon} size={20} color={color} />
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold" style={{ color: theme.colors.text }}>{title}</Text>
        <Text className="text-xs mt-0.5" style={{ color: theme.colors.textSecondary }}>{subtitle}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={24} color={theme.colors.textTertiary} />
    </TouchableOpacity>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <ScrollView showsVerticalScrollIndicator={false} bounces={false} contentContainerStyle={{ flexGrow: 1, paddingBottom: 32 }}>
        <View className="px-5 pt-12 pb-4">
          <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Settings</Text>
          <Text className="text-sm mt-1" style={{ color: theme.colors.textTertiary }}>Account, sensor, tank and alert preferences</Text>
        </View>

        <TouchableOpacity className="mx-5 bg-[#0891B2] rounded-2xl p-5 mb-5 overflow-hidden" onPress={() => navigateToStackScreen('EditProfile')} activeOpacity={0.9}>
          <View className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/10" style={{ transform: [{ translateX: 40 }, { translateY: -40 }] }} />
          <View className="flex-row items-center">
            <View className="w-20 h-20 rounded-full bg-white/20 border-2 border-white/40 justify-center items-center mr-4 overflow-hidden">
              {userProfile.profileImage ? (
                <Image source={{ uri: userProfile.profileImage }} className="w-20 h-20 rounded-full" resizeMode="cover" />
              ) : (
                <Text className="text-3xl font-bold text-white">{userProfile.initials}</Text>
              )}
            </View>
            <View className="flex-1">
              <Text className="text-xl font-bold text-white mb-1">{userProfile.name}</Text>
              <Text className="text-sm text-cyan-100" numberOfLines={1}>{userProfile.email || 'No email loaded'}</Text>
              <View className="self-start mt-3 bg-white/20 px-3 py-1.5 rounded-lg flex-row items-center">
                <MaterialIcons name="edit" size={15} color="#FFFFFF" />
                <Text className="text-xs font-bold text-white ml-1">Edit profile</Text>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>SENSOR HUB</Text>
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="flex-row items-center mb-3">
              <View className="w-12 h-12 rounded-xl bg-cyan-500 justify-center items-center mr-3">
                <MaterialCommunityIcons name="chip" size={24} color="#FFFFFF" />
              </View>
              <View className="flex-1">
                <Text className="text-base font-bold" style={{ color: theme.colors.text }}>{esp32Status.deviceName}</Text>
                {esp32Status.deviceId && <Text className="text-xs mt-0.5" style={{ color: theme.colors.textSecondary }}>{esp32Status.deviceId}</Text>}
              </View>
              <View className={`px-3 py-1 rounded-full ${esp32Status.online ? 'bg-green-100' : 'bg-red-100'}`}>
                <Text className={`text-xs font-semibold ${esp32Status.online ? 'text-green-700' : 'text-red-700'}`}>
                  {esp32Status.online ? 'ONLINE' : 'OFFLINE'}
                </Text>
              </View>
            </View>
            <View className="flex-row justify-between rounded-xl p-3" style={{ backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
              <View className="flex-1">
                <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>Data connection</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>{esp32Status.connectionLabel}</Text>
              </View>
              <View className="flex-1 items-end">
                <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>Last sync</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>{esp32Status.lastSync}</Text>
              </View>
            </View>

            <TouchableOpacity
              className="mt-3 rounded-xl h-12 flex-row items-center justify-center bg-[#0891B2]"
              onPress={() => navigateToStackScreen('Devices')}
              activeOpacity={0.86}
            >
              <MaterialIcons name={esp32Status.deviceId ? 'settings-input-antenna' : 'add'} size={19} color="#FFFFFF" />
              <Text className="text-white text-sm font-bold ml-2">{esp32Status.deviceId ? 'Manage sensor hub' : 'Add sensor hub'}</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>TANK SETUP</Text>
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="flex-row items-center mb-3">
              <View className="w-10 h-10 rounded-xl justify-center items-center mr-3" style={{ backgroundColor: theme.isDarkMode ? '#164E63' : '#ECFEFF' }}>
                <MaterialCommunityIcons name="cup-water" size={21} color={theme.colors.primary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: theme.colors.text }}>Tank capacity</Text>
                <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Set your water container size in litres</Text>
              </View>
            </View>

            <View className="flex-row items-center">
              <TextInput
                value={tankCapacityInput}
                onChangeText={setTankCapacityInput}
                keyboardType="numeric"
                placeholder="500"
                placeholderTextColor={theme.colors.textTertiary}
                className="flex-1 h-12 rounded-xl px-4 text-base font-semibold"
                style={{
                  color: theme.colors.text,
                  backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC',
                  borderWidth: 1,
                  borderColor: theme.colors.border,
                }}
                accessibilityLabel="Tank capacity in litres"
              />
              <Text className="mx-3 text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>L</Text>
              <TouchableOpacity
                className="h-12 px-4 rounded-xl items-center justify-center bg-[#0891B2]"
                onPress={saveTankCapacity}
                activeOpacity={0.86}
              >
                <Text className="text-white text-sm font-bold">Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>APPEARANCE</Text>
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="flex-row items-center">
              <View className="w-10 h-10 rounded-xl justify-center items-center mr-3" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#F1F5F9' }}>
                <MaterialIcons name="dark-mode" size={20} color={theme.colors.textSecondary} />
              </View>
              <View className="flex-1">
                <Text className="text-base font-semibold" style={{ color: theme.colors.text }}>Dark mode</Text>
                <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Easier on the eyes at night</Text>
              </View>
              <Switch value={settings.darkMode} onValueChange={() => toggleSetting('darkMode')} trackColor={{ false: '#E2E8F0', true: '#0891B2' }} thumbColor="#FFFFFF" />
            </View>
          </View>
        </View>

        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>ALERTS</Text>
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            {[
              ['unsafeWaterAlerts', 'warning', '#EF4444', '#FEF2F2', 'Unsafe water alerts', 'Notify when water is marked unsafe'],
              ['contaminationRisk', 'shield', '#F59E0B', '#FFFBEB', 'Contamination risk', 'Notify when contamination risk rises'],
              ['tankLevelAlerts', 'water-drop', '#3B82F6', '#EFF6FF', 'Tank level alerts', 'Notify for low level or overflow'],
              ['pushEnabled', 'notifications-active', '#0891B2', '#ECFEFF', 'Push delivery', 'Allow phone notifications for selected alerts'],
            ].map((item, index, list) => (
              <View key={item[0]} className={`flex-row items-center ${index < list.length - 1 ? 'mb-4 pb-4' : ''}`} style={{ borderBottomWidth: index < list.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                <View className="w-10 h-10 rounded-xl justify-center items-center mr-3" style={{ backgroundColor: item[3] }}>
                  <MaterialIcons name={item[1]} size={20} color={item[2]} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-semibold" style={{ color: theme.colors.text }}>{item[4]}</Text>
                  <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>{item[5]}</Text>
                </View>
                <Switch value={settings[item[0]]} onValueChange={() => toggleSetting(item[0])} trackColor={{ false: '#E2E8F0', true: '#0891B2' }} thumbColor="#FFFFFF" />
              </View>
            ))}
          </View>
        </View>

        <View className="px-5 mb-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>ACCOUNT</Text>
          <View className="rounded-2xl shadow-sm overflow-hidden" style={{ backgroundColor: theme.colors.cardBackground }}>
            {renderAccountRow({ icon: 'lock-outline', color: '#7C3AED', bg: '#F3E8FF', title: 'Change password', subtitle: 'Update your account password', onPress: () => navigateToStackScreen('ChangePassword') })}
            {renderAccountRow({ icon: 'access-time', color: '#0891B2', bg: '#ECFEFF', title: 'View history', subtitle: 'Past water checks and trends', onPress: () => navigateToStackScreen('History') })}
            {renderAccountRow({ icon: 'file-download', color: '#10B981', bg: '#ECFDF5', title: 'Export data', subtitle: 'Share a formatted report or CSV', onPress: () => navigateToStackScreen('ExportData'), border: false })}
          </View>
        </View>

        <View className="px-5 mb-8">
          <TouchableOpacity className="bg-red-50 rounded-2xl p-4 border border-red-200 flex-row justify-center items-center" onPress={handleSignOut}>
            <MaterialIcons name="logout" size={19} color="#DC2626" />
            <Text className="text-base font-bold text-red-600 ml-2">Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default SettingsScreen;
