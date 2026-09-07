import React, { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
import { useTheme } from '../context/ThemeContext';
import { statusAPI } from '../services/api';
import {
  APP_SETTINGS_KEY,
  formatTimeSinceUpdate,
  getStatusErrorMessage,
  getTankPresentation,
  isDeviceConnected,
  mapCurrentStatus,
} from '../utils/homeStatus';

const EMPTY_TANK = mapCurrentStatus().tankStatus;

const parseSavedSettings = savedSettings => {
  if (!savedSettings) return {};
  try {
    return JSON.parse(savedSettings);
  } catch (error) {
    return {};
  }
};


const TankScreen = () => {
  const { theme } = useTheme();
  const [tank, setTank] = useState(EMPTY_TANK);
  const [sensorLive, setSensorLive] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchTankStatus = useCallback(async () => {
    try {
      const [payload, savedSettings] = await Promise.all([
        statusAPI.getCurrentStatus(),
        AsyncStorage.getItem(APP_SETTINGS_KEY),
      ]);
      const settings = parseSavedSettings(savedSettings);
      const nextTank = mapCurrentStatus(payload, { tankCapacityLitres: settings.tankCapacityLitres }).tankStatus;
      setTank(nextTank);
      setSensorLive(isDeviceConnected(nextTank.timestamp));
      setError(null);
    } catch (requestError) {
      setSensorLive(false);
      setError(getStatusErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh every 30 seconds when screen is visible
  useEffect(() => {
    const interval = setInterval(fetchTankStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchTankStatus]);

  // Refresh data when screen comes into focus (navigating to this screen)
  useFocusEffect(
    useCallback(() => {
      fetchTankStatus();
    }, [fetchTankStatus])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchTankStatus();
    setRefreshing(false);
  }, [fetchTankStatus]);

  const tone = getTankPresentation(tank.rawStatus);
  const connectionTone = sensorLive
    ? { label: 'Live', background: '#DCFCE7', color: '#15803D', dot: '#22C55E' }
    : { label: 'Offline', background: '#FEE2E2', color: '#B91C1C', dot: '#EF4444' };

  const thresholdRows = [
    { label: 'Almost empty', value: 'Below 5%', icon: 'water-alert-outline', color: '#EF4444', background: '#FEF2F2' },
    { label: 'Running low', value: 'Below 25%', icon: 'water-minus-outline', color: '#F59E0B', background: '#FFFBEB' },
    { label: 'Nearly full', value: 'Above 75%', icon: 'water-plus-outline', color: '#3B82F6', background: '#EFF6FF' },
    { label: 'Overflowing', value: 'Above 95%', icon: 'waves-arrow-up', color: '#EF4444', background: '#FEF2F2' },
  ];

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />
        }
      >
        <View className="px-5 pt-12 pb-5">
          <View className="flex-row justify-between items-start">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Tank details</Text>
              <Text className="text-sm mt-1" style={{ color: theme.colors.textTertiary }}>
                {formatTimeSinceUpdate(tank.timestamp)}
              </Text>
            </View>
            <View className="flex-row items-center px-3 py-1.5 rounded-full" style={{ backgroundColor: connectionTone.background }}>
              <View className="w-2 h-2 rounded-full mr-1.5" style={{ backgroundColor: connectionTone.dot }} />
              <Text className="text-sm font-semibold" style={{ color: connectionTone.color }}>{connectionTone.label}</Text>
            </View>
          </View>
        </View>

        {error && (
          <View className="mx-5 mb-5 rounded-2xl p-4 border" style={{ borderColor: '#FCA5A5', backgroundColor: theme.isDarkMode ? '#451A1A' : '#FEF2F2' }}>
            <Text className="text-sm leading-5" style={{ color: theme.isDarkMode ? '#FECACA' : '#991B1B' }}>{error}</Text>
            <TouchableOpacity onPress={fetchTankStatus} className="mt-2 self-start" accessibilityRole="button">
              <Text className="text-sm font-bold" style={{ color: theme.colors.primary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        <View className="mx-5 rounded-3xl p-6 mb-5 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
          <Text className="text-xs font-semibold tracking-wider text-center mb-5" style={{ color: theme.colors.textTertiary }}>CURRENT WATER LEVEL</Text>
          {loading ? (
            <View className="h-52 items-center justify-center">
              <ActivityIndicator size="large" color={theme.colors.primary} />
            </View>
          ) : (
            <View className="items-center">
              <View className="relative mb-5">
                <View className="w-32 h-48 rounded-3xl border-4 overflow-hidden justify-end" style={{ borderColor: theme.colors.border, backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                  <View className="w-full rounded-2xl items-center justify-center" style={{ height: `${tank.levelPercent}%`, minHeight: tank.levelPercent > 0 ? 24 : 0, backgroundColor: theme.colors.primary }}>
                    {tank.levelPercent >= 18 && <MaterialCommunityIcons name="water" size={24} color="#FFFFFF" />}
                  </View>
                </View>
                <View className="absolute -right-14 top-0 bottom-0 justify-between py-1">
                  <Text className="text-xs" style={{ color: theme.colors.textTertiary }}>100%</Text>
                  <Text className="text-xs" style={{ color: theme.colors.textTertiary }}>50%</Text>
                  <Text className="text-xs" style={{ color: theme.colors.textTertiary }}>0%</Text>
                </View>
              </View>
              <Text className="text-5xl font-bold" style={{ color: theme.colors.text }}>{tank.levelPercent}%</Text>
              <View className="px-3 py-1 rounded-full mt-3" style={{ backgroundColor: tone.backgroundColor }}>
                <Text className="text-sm font-semibold" style={{ color: tone.color }}>{tank.status}</Text>
              </View>
              <Text className="text-sm mt-3" style={{ color: theme.colors.textSecondary }}>
                {tank.volumeLitres} currently available
              </Text>
            </View>
          )}
        </View>

        <View className="flex-row px-5 justify-between mb-5">
          <View className="w-[48%] rounded-2xl p-4 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
            <View className="w-11 h-11 rounded-xl bg-cyan-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="cup-water" size={23} color={theme.colors.primary} />
            </View>
            <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>{tank.totalCapacity}</Text>
            <Text className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>Container capacity</Text>
          </View>
          <View className="w-[48%] rounded-2xl p-4 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
            <View className="w-11 h-11 rounded-xl justify-center items-center mb-3" style={{ backgroundColor: tone.backgroundColor }}>
              <MaterialIcons name={tank.levelPercent < 25 ? 'warning' : 'check-circle'} size={23} color={tone.color} />
            </View>
            <Text className="text-2xl font-bold" style={{ color: tone.color }}>{tank.status}</Text>
            <Text className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>Tank condition</Text>
          </View>
        </View>

        <View className="px-5">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>ALERT THRESHOLDS</Text>
          <View className="rounded-2xl p-4 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
            {thresholdRows.map((row, index) => (
              <View
                key={row.label}
                className={`flex-row items-center justify-between py-3 ${index === 0 ? '' : 'border-t'}`}
                style={index === 0 ? undefined : { borderColor: theme.colors.border }}
              >
                <View className="flex-row items-center flex-1">
                  <View className="w-10 h-10 rounded-xl justify-center items-center mr-3" style={{ backgroundColor: row.background }}>
                    <MaterialCommunityIcons name={row.icon} size={20} color={row.color} />
                  </View>
                  <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>{row.label}</Text>
                </View>
                <Text className="text-xs font-semibold" style={{ color: row.color }}>{row.value}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default TankScreen;
