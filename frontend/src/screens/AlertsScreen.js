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
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { statusAPI } from '../services/api';
import { formatTimeSinceUpdate, getStatusErrorMessage, isDeviceConnected } from '../utils/homeStatus';
import { showAppAlert } from '../utils/alertHelper';

const READ_ALERTS_KEY = '@read_water_alerts';
const DEFAULT_SETTINGS = {
  unsafeWaterAlerts: true,
  contaminationRisk: true,
  tankLevelAlerts: true,
};

const ALERT_TONES = {
  danger: {
    iconColor: '#DC2626',
    iconBackground: '#FEE2E2',
    borderColor: '#F87171',
    badgeColor: '#991B1B',
    badgeBackground: '#FEE2E2',
  },
  warning: {
    iconColor: '#D97706',
    iconBackground: '#FEF3C7',
    borderColor: '#FBBF24',
    badgeColor: '#92400E',
    badgeBackground: '#FEF3C7',
  },
  tank: {
    iconColor: '#2563EB',
    iconBackground: '#DBEAFE',
    borderColor: '#60A5FA',
    badgeColor: '#1E40AF',
    badgeBackground: '#DBEAFE',
  },
};

const finiteNumber = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const parseTimestamp = value => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatAlertTime = value => {
  const date = parseTimestamp(value) || new Date();
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getMainIssue = parameters => {
  const ph = finiteNumber(parameters?.ph);
  const turbidity = finiteNumber(parameters?.turbidity_index);
  const temperature = finiteNumber(parameters?.temperature);
  const tds = finiteNumber(parameters?.tds);

  if (turbidity !== null && turbidity >= 75) return 'The turbidity reading shows very cloudy water.';
  if (ph !== null && ph < 6.5) return 'The pH reading shows acidic water.';
  if (ph !== null && ph > 8.5) return 'The pH reading shows alkaline water.';
  if (tds !== null && tds >= 900) return 'The TDS reading shows a very high amount of dissolved solids.';
  if (temperature !== null && temperature >= 30) return 'The water temperature is high.';
  return 'The combined sensor readings need attention.';
};

export const getCurrentReadingFreshness = (payload = {}, now = Date.now()) => {
  const waterTimestamp = parseTimestamp(payload.water_quality?.timestamp);
  const tankTimestamp = parseTimestamp(payload.tank_status?.timestamp);
  const timestamps = [waterTimestamp, tankTimestamp].filter(Boolean);
  const latestTimestamp = timestamps.sort((a, b) => b.getTime() - a.getTime())[0] || null;

  return {
    latestTimestamp,
    hasAnyReading: timestamps.length > 0,
    waterFresh: isDeviceConnected(waterTimestamp, now),
    tankFresh: isDeviceConnected(tankTimestamp, now),
    anyFresh: timestamps.some(timestamp => isDeviceConnected(timestamp, now)),
    lastUpdatedLabel: formatTimeSinceUpdate(latestTimestamp, now),
  };
};

export const buildCurrentAlerts = (payload = {}, settings = DEFAULT_SETTINGS, readSignatures = [], now = Date.now()) => {
  const alerts = [];
  const water = payload.water_quality || {};
  const risk = payload.contamination_risk || {};
  const tank = payload.tank_status || {};
  const freshness = getCurrentReadingFreshness(payload, now);
  const timestamp = water.timestamp || tank.timestamp || new Date(now).toISOString();
  const readSet = new Set(readSignatures);
  const addAlert = alert => {
    const tone = ALERT_TONES[alert.tone] || ALERT_TONES.warning;
    const signature = `${alert.id}:${timestamp}`;
    alerts.push({
      ...tone,
      ...alert,
      signature,
      read: readSet.has(signature),
      time: formatAlertTime(timestamp),
    });
  };

  if (freshness.waterFresh && settings.unsafeWaterAlerts !== false && water.classification === 'Unsafe') {
    addAlert({
      id: 'water-unsafe',
      tone: 'danger',
      icon: 'alert-octagon-outline',
      title: 'Unsafe water reading',
      message: `${getMainIssue(water.parameters)} Do not use the water for drinking until suitable treatment has been applied and the readings improve.`,
      action: 'Treat or filter the water, then continue monitoring before use.',
      badge: 'HIGH',
    });
  } else if (freshness.waterFresh && settings.unsafeWaterAlerts !== false && water.classification === 'Warning') {
    addAlert({
      id: 'water-warning',
      tone: 'warning',
      icon: 'alert-outline',
      title: 'Water reading needs attention',
      message: `${getMainIssue(water.parameters)} One or more readings need attention. Check Water Insights for the main reason.`,
      action: 'Open Water Insights and follow the recommended action.',
      badge: 'ATTENTION',
    });
  }

  if (freshness.waterFresh && settings.contaminationRisk !== false && ['High', 'Medium'].includes(risk.risk_level)) {
    const high = risk.risk_level === 'High';
    const score = finiteNumber(risk.risk_score);
    addAlert({
      id: `risk-${String(risk.risk_level).toLowerCase()}`,
      tone: high ? 'danger' : 'warning',
      icon: 'shield-alert-outline',
      title: `${risk.risk_level} predicted contamination risk`,
      message: `The app noticed a pattern linked with ${risk.risk_level.toLowerCase()} risk${score === null ? '' : ` (score: ${Math.round(score * 100)}%)`}. Review Water Insights for the main reason.`,
      action: 'Open Water Insights to see what influenced the risk level.',
      badge: high ? 'HIGH RISK' : 'MEDIUM RISK',
    });
  }

  const tankLevel = finiteNumber(tank.level_percent);
  if (freshness.tankFresh && settings.tankLevelAlerts !== false && tankLevel !== null && tankLevel < 25) {
    addAlert({
      id: 'tank-low',
      tone: 'tank',
      icon: 'cup-water',
      title: 'Tank level is low',
      message: `The latest tank level is ${Math.round(tankLevel)}%. Plan a refill and continue monitoring the level.`,
      action: 'Plan a refill and keep monitoring the tank level.',
      badge: 'TANK',
    });
  }

  if (freshness.tankFresh && settings.tankLevelAlerts !== false && tank.status === 'Overflow') {
    addAlert({
      id: 'tank-overflow',
      tone: 'tank',
      icon: 'waves-arrow-up',
      title: 'Tank overflow detected',
      message: 'The tank appears to be overflowing. Stop the water flow and inspect the tank.',
      action: 'Stop the water flow and inspect the tank level.',
      badge: 'TANK',
    });
  }

  return alerts;
};

const AlertsScreen = () => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState([]);
  const [readingFreshness, setReadingFreshness] = useState({
    hasAnyReading: false,
    anyFresh: false,
    lastUpdatedLabel: 'Waiting for the first reading',
  });
  const [error, setError] = useState(null);

  const fetchAlerts = useCallback(async () => {
    try {
      const [payload, savedSettings, savedReadAlerts] = await Promise.all([
        statusAPI.getCurrentStatus(),
        AsyncStorage.getItem('@app_settings'),
        AsyncStorage.getItem(READ_ALERTS_KEY),
      ]);
      const parsedSettings = savedSettings ? JSON.parse(savedSettings) : {};
      const settings = { ...DEFAULT_SETTINGS, ...parsedSettings };
      const readSignatures = savedReadAlerts ? JSON.parse(savedReadAlerts) : [];
      const freshness = getCurrentReadingFreshness(payload);
      setReadingFreshness(freshness);
      setAlerts(buildCurrentAlerts(payload, settings, readSignatures));
      setError(null);
    } catch (requestError) {
      setError(getStatusErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, [fetchAlerts]);

  const saveReadSignatures = async signatures => {
    const unique = [...new Set(signatures)].slice(-50);
    await AsyncStorage.setItem(READ_ALERTS_KEY, JSON.stringify(unique));
  };

  const markAlertRead = async alert => {
    if (alert.read) return;
    const updated = alerts.map(item => item.signature === alert.signature ? { ...item, read: true } : item);
    setAlerts(updated);
    await saveReadSignatures(updated.filter(item => item.read).map(item => item.signature));
  };

  const handleAlertPress = async alert => {
    await markAlertRead(alert);
    showAppAlert(alert.title, `${alert.message}\n\nRecommended action: ${alert.action}`, [], alert.tone === 'danger' ? 'error' : 'warning');
  };

  const handleMarkAllRead = async () => {
    const updated = alerts.map(alert => ({ ...alert, read: true }));
    setAlerts(updated);
    await saveReadSignatures(updated.map(alert => alert.signature));
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  }, [fetchAlerts]);

  const newAlertsCount = alerts.filter(alert => !alert.read).length;
  const highCount = alerts.filter(alert => alert.tone === 'danger').length;
  const showOfflineNotice = !loading && !error && readingFreshness.hasAnyReading && !readingFreshness.anyFresh;

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1, paddingBottom: 30 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[theme.colors.primary]} />}
      >
        <View className="px-5 pt-12 pb-5">
          <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Alerts</Text>
          <Text className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>Warnings from water readings, risk level, and tank level</Text>
        </View>

        <View className="mx-5 mb-5 rounded-2xl p-4" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row items-center">
            <View className={`w-12 h-12 rounded-xl items-center justify-center ${showOfflineNotice ? 'bg-slate-100' : alerts.length > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
              <MaterialCommunityIcons name={showOfflineNotice ? 'access-point-off' : alerts.length > 0 ? 'bell-alert-outline' : 'bell-check-outline'} size={27} color={showOfflineNotice ? '#64748B' : alerts.length > 0 ? '#DC2626' : '#10B981'} />
            </View>
            <View className="flex-1 ml-3">
              <Text className="text-base font-bold" style={{ color: theme.colors.text }}>
                {loading ? 'Checking latest reading' : showOfflineNotice ? 'No recent sensor reading' : alerts.length > 0 ? `${alerts.length} active warning${alerts.length === 1 ? '' : 's'}` : 'No active warning'}
              </Text>
              <Text className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>
                {showOfflineNotice ? `Last reading: ${readingFreshness.lastUpdatedLabel}. Reconnect the sensor hub and refresh.` : highCount > 0 ? `${highCount} high priority warning${highCount === 1 ? '' : 's'} needs attention.` : 'Pull down to refresh the latest device reading.'}
              </Text>
            </View>
            {newAlertsCount > 0 && (
              <View className="px-3 py-1 rounded-full bg-red-100">
                <Text className="text-xs font-bold text-red-700">{newAlertsCount} NEW</Text>
              </View>
            )}
          </View>
        </View>

        {error && (
          <View className="mx-5 mb-4 rounded-2xl p-4 border border-red-200 bg-red-50">
            <View className="flex-row items-start">
              <MaterialCommunityIcons name="cloud-alert-outline" size={22} color="#DC2626" />
              <View className="flex-1 ml-3">
                <Text className="text-sm leading-5 text-red-800">{error}</Text>
                <TouchableOpacity onPress={fetchAlerts} className="mt-2 self-start" accessibilityRole="button">
                  <Text className="text-sm font-bold" style={{ color: theme.colors.primary }}>Retry</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {loading ? (
          <View className="items-center py-24">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text className="text-sm mt-3" style={{ color: theme.colors.textSecondary }}>Checking the latest reading...</Text>
          </View>
        ) : showOfflineNotice ? (
          <View className="flex-1 justify-center items-center px-8 py-20">
            <View className="w-16 h-16 rounded-full bg-slate-100 items-center justify-center">
              <MaterialCommunityIcons name="access-point-off" size={38} color="#64748B" />
            </View>
            <Text className="text-lg font-bold mt-4" style={{ color: theme.colors.text }}>Sensor hub is not sending new readings</Text>
            <Text className="text-sm text-center leading-5 mt-2" style={{ color: theme.colors.textSecondary }}>
              The saved readings are old, so alerts are paused until a fresh reading arrives.
            </Text>
            <Text className="text-xs text-center leading-5 mt-3" style={{ color: theme.colors.textTertiary }}>
              {readingFreshness.lastUpdatedLabel}
            </Text>
          </View>
        ) : alerts.length === 0 ? (
          <View className="flex-1 justify-center items-center px-8 py-20">
            <View className="w-16 h-16 rounded-full bg-green-50 items-center justify-center">
              <MaterialCommunityIcons name="check-circle-outline" size={38} color="#10B981" />
            </View>
            <Text className="text-lg font-bold mt-4" style={{ color: theme.colors.text }}>No current alerts</Text>
            <Text className="text-sm text-center leading-5 mt-2" style={{ color: theme.colors.textSecondary }}>
              The latest reading did not trigger any water, risk, or tank warning.
            </Text>
          </View>
        ) : (
          <View className="px-5">
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>CURRENT WARNINGS</Text>
              {newAlertsCount > 0 && (
                <TouchableOpacity onPress={handleMarkAllRead} accessibilityRole="button">
                  <Text className="text-sm font-semibold" style={{ color: theme.colors.primary }}>Mark all read</Text>
                </TouchableOpacity>
              )}
            </View>

            {alerts.map(alert => (
              <TouchableOpacity
                key={alert.signature}
                className="rounded-2xl p-4 mb-4 border"
                style={{
                  backgroundColor: theme.colors.cardBackground,
                  borderColor: alert.read ? theme.colors.border : alert.borderColor,
                  opacity: alert.read ? 0.72 : 1,
                }}
                onPress={() => handleAlertPress(alert)}
                accessibilityRole="button"
                accessibilityLabel={alert.title}
                activeOpacity={0.86}
              >
                <View className="flex-row items-start">
                  <View className="w-12 h-12 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: alert.iconBackground }}>
                    <MaterialCommunityIcons name={alert.icon} size={25} color={alert.iconColor} />
                  </View>
                  <View className="flex-1">
                    <View className="flex-row items-start">
                      <Text className="text-base font-bold flex-1 pr-2" style={{ color: theme.colors.text }}>{alert.title}</Text>
                      <Text className="text-xs" style={{ color: theme.colors.textTertiary }}>{alert.time}</Text>
                    </View>
                    <Text className="text-sm leading-5 mt-2" style={{ color: theme.colors.textSecondary }}>{alert.message}</Text>
                    <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                      <Text className="text-xs font-bold mb-1" style={{ color: theme.colors.text }}>Recommended action</Text>
                      <Text className="text-xs leading-4" style={{ color: theme.colors.textSecondary }}>{alert.action}</Text>
                    </View>
                    <View className="flex-row items-center mt-3">
                      <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: alert.badgeBackground }}>
                        <Text className="text-xs font-bold" style={{ color: alert.badgeColor }}>{alert.badge}</Text>
                      </View>
                      {!alert.read && <View className="w-2 h-2 rounded-full bg-red-500 ml-2" />}
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AlertsScreen;
