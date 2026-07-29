import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import ParameterCard from '../components/ParameterCard';
import { useTheme } from '../context/ThemeContext';
import { statusAPI } from '../services/api';
import {
  APP_SETTINGS_KEY,
  formatTimeSinceUpdate,
  getClassificationColor,
  getLatestReadingTimestamp,
  getRiskPresentation,
  getStatusErrorMessage,
  getTankPresentation,
  isDeviceConnected,
  mapCurrentStatus,
} from '../utils/homeStatus';
import { getFirstName, loadUserProfile } from '../utils/profileLoader';

const EMPTY_STATUS = mapCurrentStatus();

const parseSavedSettings = savedSettings => {
  if (!savedSettings) return {};
  try {
    return JSON.parse(savedSettings);
  } catch (error) {
    return {};
  }
};


const HomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [greeting, setGreeting] = useState('Welcome');
  const [userName, setUserName] = useState('User');
  const [status, setStatus] = useState(EMPTY_STATUS);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dataError, setDataError] = useState(null);

  const updateGreeting = useCallback(() => {
    const hour = new Date().getHours();
    setGreeting(hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening');
  }, []);

  const fetchCurrentStatus = useCallback(async () => {
    try {
      const [payload, savedSettings] = await Promise.all([
        statusAPI.getCurrentStatus(),
        AsyncStorage.getItem(APP_SETTINGS_KEY),
      ]);
      const settings = parseSavedSettings(savedSettings);
      const nextStatus = mapCurrentStatus(payload, { tankCapacityLitres: settings.tankCapacityLitres });
      const latestTimestamp = getLatestReadingTimestamp(
        nextStatus.waterQuality.timestamp,
        nextStatus.tankStatus.timestamp,
      );

      setStatus(nextStatus);
      setConnected(isDeviceConnected(latestTimestamp));
      setDataError(null);
    } catch (error) {
      setConnected(false);
      setDataError(getStatusErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    updateGreeting();
    loadUserProfile()
      .then(profile => setUserName(getFirstName(profile.fullName)))
      .catch(() => setUserName('User'));

    const greetingInterval = setInterval(updateGreeting, 60000);
    return () => clearInterval(greetingInterval);
  }, [updateGreeting]);

  useEffect(() => {
    fetchCurrentStatus();
    const statusInterval = setInterval(fetchCurrentStatus, 30000);
    return () => clearInterval(statusInterval);
  }, [fetchCurrentStatus]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchCurrentStatus();
    setRefreshing(false);
  }, [fetchCurrentStatus]);

  const { waterQuality, contaminationRisk, tankStatus } = status;
  const classificationColor = getClassificationColor(waterQuality.rawClassification);
  const cardColor = connected ? classificationColor : '#475569';
  const displayClassification = connected
    ? waterQuality.classification
    : waterQuality.timestamp
      ? 'Last saved reading'
      : waterQuality.classification;
  const risk = connected
    ? getRiskPresentation(contaminationRisk.level)
    : { label: waterQuality.timestamp ? 'Waiting for fresh reading' : 'Risk pending', color: '#CBD5E1' };
  const riskScoreText = connected && contaminationRisk.score !== null ? ` · ${contaminationRisk.score}%` : '';
  const tankTone = getTankPresentation(tankStatus.rawStatus);
  const connectionTone = connected
    ? { background: '#DCFCE7', dot: '#22C55E', text: '#15803D', label: 'Live' }
    : { background: '#FEE2E2', dot: '#EF4444', text: '#B91C1C', label: 'Offline' };

  const renderParameter = (parameter, value) => (
    <View className="mb-1" style={{ width: '48%' }} key={parameter}>
      {value === null ? (
        <View
          className="rounded-2xl p-4 mb-3 border"
          style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}
        >
          <Text className="text-xs font-semibold mb-3" style={{ color: theme.colors.textTertiary }}>
            WAITING FOR READING
          </Text>
          <ActivityIndicator color={theme.colors.primary} />
        </View>
      ) : (
        <ParameterCard
          parameter={parameter}
          value={value}
          style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border, borderWidth: 1 }}
          textColor={theme.colors.text}
          secondaryTextColor={theme.colors.textSecondary}
        />
      )}
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 28 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        <View className="px-5 pt-12 pb-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <Text className="text-sm mb-1" style={{ color: theme.colors.textTertiary }}>{greeting},</Text>
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>{userName}</Text>
            </View>
            <View
              className="flex-row items-center px-3 py-1.5 rounded-full"
              style={{ backgroundColor: connectionTone.background }}
              accessibilityLabel={`Device status: ${connectionTone.label}`}
            >
              <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: connectionTone.dot }} />
              <Text className="text-sm font-semibold" style={{ color: connectionTone.text }}>
                {connectionTone.label}
              </Text>
            </View>
          </View>
        </View>

        {dataError && (
          <View
            className="mx-5 mb-4 rounded-2xl p-4 flex-row items-start border"
            style={{ backgroundColor: theme.isDarkMode ? '#451A1A' : '#FEF2F2', borderColor: '#FCA5A5' }}
          >
            <MaterialIcons name="cloud-off" size={20} color="#EF4444" />
            <View className="flex-1 ml-3">
              <Text className="text-sm leading-5" style={{ color: theme.isDarkMode ? '#FECACA' : '#991B1B' }}>
                {dataError}
              </Text>
              <TouchableOpacity
                className="mt-2 self-start"
                onPress={fetchCurrentStatus}
                accessibilityRole="button"
                accessibilityLabel="Retry loading current status"
              >
                <Text className="text-sm font-bold" style={{ color: theme.colors.primary }}>Retry</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View className="mx-5 rounded-3xl p-5 mb-6 overflow-hidden" style={{ backgroundColor: cardColor }}>
          <Text className="text-sm text-white/80 mb-1">{connected ? 'Your water right now' : 'Latest saved water reading'}</Text>
          <Text className="text-3xl font-bold text-white pr-24 mb-2">{displayClassification}</Text>
          <View className="flex-row items-center">
            <MaterialIcons name="access-time" size={14} color="rgba(255,255,255,0.8)" />
            <Text className="text-xs text-white/80 ml-1">
              {formatTimeSinceUpdate(waterQuality.timestamp)}
            </Text>
          </View>

          <View className="absolute top-5 right-5 bg-white/20 px-3 py-2 rounded-xl items-center min-w-[72px]">
            <Text className="text-xl font-bold text-white">
              {waterQuality.confidence === null ? '--' : `${waterQuality.confidence}%`}
            </Text>
            <Text className="text-[10px] text-white/80 font-semibold tracking-wide">CONFIDENCE</Text>
          </View>

          <View className="flex-row items-center bg-white/15 rounded-2xl p-4 mt-5">
            <View className="w-10 h-10 rounded-xl bg-white justify-center items-center mr-3">
              <MaterialCommunityIcons name="chip" size={21} color={cardColor} />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white mb-0.5">ESP32 sensor hub</Text>
              <Text className="text-xs text-white/75">
                {connected ? 'Sending current sensor readings' : 'Showing last saved values'}
              </Text>
            </View>
            <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: connectionTone.dot }} />
          </View>

          <View className="flex-row items-center justify-between mt-4 pt-4 border-t border-white/20">
            <Text className="text-xs text-white/75">Contamination assessment</Text>
            <View className="flex-row items-center">
              <View className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: risk.color }} />
              <Text className="text-xs font-semibold text-white">
                {risk.label}{riskScoreText}
              </Text>
            </View>
          </View>
        </View>

        <View className="flex-row justify-between items-center px-5 mb-4">
          <View>
            <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>
              SENSOR READINGS
            </Text>
            <Text className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
              {connected ? '4 active sensors - Live reading bands' : '4 sensors - Last saved reading bands'}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => navigation.navigate('Insights')}
            accessibilityRole="button"
            accessibilityLabel="Open Water Insights"
            className="px-3 py-2 rounded-xl"
            style={{ backgroundColor: theme.isDarkMode ? '#164E63' : '#ECFEFF' }}
          >
            <Text className="text-sm font-semibold" style={{ color: theme.colors.primary }}>Water Insights →</Text>
          </TouchableOpacity>
        </View>

        <View className="px-5 mb-5 flex-row flex-wrap justify-between">
          {renderParameter('ph', waterQuality.parameters.ph)}
          {renderParameter('turbidity_index', waterQuality.parameters.turbidity)}
          {renderParameter('temperature', waterQuality.parameters.temperature)}
          {renderParameter('tds', waterQuality.parameters.tds)}
        </View>

        <View className="flex-row justify-between items-center px-5 mb-4">
          <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>
            TANK STORAGE
          </Text>
          <TouchableOpacity
            onPress={() => navigation.navigate('Tank')}
            accessibilityRole="button"
            accessibilityLabel="Open tank details"
            className="px-3 py-2 rounded-xl"
            style={{ backgroundColor: theme.isDarkMode ? '#164E63' : '#ECFEFF' }}
          >
            <Text className="text-sm font-semibold" style={{ color: theme.colors.primary }}>Details →</Text>
          </TouchableOpacity>
        </View>

        <View
          className="rounded-2xl p-5 mx-5 border"
          style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}
        >
          <View className="flex-row justify-between items-center">
            <View className="flex-1 pr-4">
              <Text className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>Current water level</Text>
              <Text className="text-5xl font-bold mb-2" style={{ color: theme.colors.text }}>
                {loading && tankStatus.levelPercent === 0 ? '--' : tankStatus.levelPercent}%
              </Text>
              <View className="self-start px-3 py-1 rounded-full" style={{ backgroundColor: tankTone.backgroundColor }}>
                <Text className="text-xs font-semibold" style={{ color: tankTone.color }}>{tankStatus.status}</Text>
              </View>
              <Text className="text-xs mt-3" style={{ color: theme.colors.textSecondary }}>
                {tankStatus.volumeLitres} L of {tankStatus.totalCapacity} L available
              </Text>
            </View>
            <View className="w-16 h-24 rounded-2xl border-2 overflow-hidden justify-end" style={{ borderColor: theme.colors.border }}>
              <View
                className="w-full rounded-lg"
                style={{ height: `${tankStatus.levelPercent}%`, backgroundColor: theme.colors.primary }}
              />
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
