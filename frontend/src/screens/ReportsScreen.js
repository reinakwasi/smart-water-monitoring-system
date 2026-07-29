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
import { useTheme } from '../context/ThemeContext';
import { statusAPI } from '../services/api';
import { formatTimeSinceUpdate, getStatusErrorMessage } from '../utils/homeStatus';
import { buildWaterInsights } from '../utils/waterInsights';

const EMPTY_INSIGHTS = buildWaterInsights();

const ReportsScreen = () => {
  const { theme } = useTheme();
  const [insights, setInsights] = useState(EMPTY_INSIGHTS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const fetchInsights = useCallback(async () => {
    try {
      const payload = await statusAPI.getCurrentStatus();
      setInsights(buildWaterInsights(payload));
      setError(null);
    } catch (requestError) {
      setError(getStatusErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInsights();
    const interval = setInterval(fetchInsights, 30000);
    return () => clearInterval(interval);
  }, [fetchInsights]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchInsights();
    setRefreshing(false);
  }, [fetchInsights]);

  const maxInfluence = Math.max(...insights.factors.map(factor => Math.abs(factor.shapValue)), 0.01);

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
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Water Insights</Text>
              <Text className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
                Simple explanation from the latest water reading
              </Text>
            </View>
          </View>
          <Text className="text-xs mt-3" style={{ color: theme.colors.textTertiary }}>
            {formatTimeSinceUpdate(insights.timestamp)}
          </Text>
        </View>

        {error && (
          <View className="mx-5 mb-5 rounded-2xl p-4 border" style={{ borderColor: '#FCA5A5', backgroundColor: theme.isDarkMode ? '#451A1A' : '#FEF2F2' }}>
            <Text className="text-sm leading-5" style={{ color: theme.isDarkMode ? '#FECACA' : '#991B1B' }}>{error}</Text>
            <TouchableOpacity onPress={fetchInsights} className="mt-2 self-start" accessibilityRole="button" accessibilityLabel="Retry loading Water Insights">
              <Text className="text-sm font-bold" style={{ color: theme.colors.primary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View className="items-center justify-center py-24">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text className="text-sm mt-4" style={{ color: theme.colors.textSecondary }}>Interpreting the latest readings…</Text>
          </View>
        ) : (
          <>

            <View className="px-5 mb-6">
              <View className="rounded-2xl p-5 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
                <View className="flex-row items-center mb-4">
                  <View className="w-11 h-11 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: theme.isDarkMode ? '#164E63' : '#ECFEFF' }}>
                    <MaterialCommunityIcons name="water-check-outline" size={23} color={theme.colors.primary} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-lg font-bold" style={{ color: theme.colors.text }}>Water condition summary</Text>
                    <Text className="text-xs mt-0.5" style={{ color: theme.colors.textTertiary }}>In simple words</Text>
                  </View>
                </View>

                <View className="flex-row flex-wrap mb-4">
                  <View className="mr-2 mb-2 px-3 py-2 rounded-full" style={{ backgroundColor: `${insights.safety.color}18` }}>
                    <Text className="text-xs font-bold" style={{ color: insights.safety.color }}>
                      {insights.safety.status}
                    </Text>
                  </View>
                  <View className="mb-2 px-3 py-2 rounded-full" style={{ backgroundColor: `${insights.risk.color}18` }}>
                    <Text className="text-xs font-bold" style={{ color: insights.risk.color }}>
                      {insights.risk.label}{insights.risk.score === null ? '' : ` • ${insights.risk.score}%`}
                    </Text>
                  </View>
                </View>

                <Text className="text-base font-semibold leading-6" style={{ color: theme.colors.text }}>
                  {insights.plainLanguage.summary}
                </Text>

                {insights.plainLanguage.concernDetails.map((detail, index) => (
                  <View key={`${detail}-${index}`} className="flex-row items-start mt-3">
                    <View className="w-2 h-2 rounded-full bg-amber-500 mt-2 mr-3" />
                    <Text className="text-sm leading-6 flex-1" style={{ color: theme.colors.textSecondary }}>{detail}</Text>
                  </View>
                ))}

                <View className="mt-5 rounded-xl p-4" style={{ backgroundColor: insights.safety.level === 'Critical' || insights.risk.level === 'High' ? (theme.isDarkMode ? '#451A1A' : '#FEF2F2') : (theme.isDarkMode ? '#172554' : '#EFF6FF') }}>
                  <Text className="text-xs font-bold tracking-wider mb-1" style={{ color: insights.safety.level === 'Critical' || insights.risk.level === 'High' ? '#EF4444' : '#3B82F6' }}>ACTION TO TAKE</Text>
                  <Text className="text-sm leading-5" style={{ color: theme.colors.text }}>{insights.plainLanguage.action}</Text>
                </View>
              </View>
            </View>

            <View className="px-5 mb-6">
              <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>WHAT EACH READING MEANS</Text>
              {insights.sensorAssessments.map(sensor => (
                <View
                  key={sensor.key}
                  className="rounded-2xl p-5 mb-3 border"
                  style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}
                  accessibilityLabel={`${sensor.name} assessment`}
                >
                  <View className="flex-row items-start justify-between mb-3">
                    <View className="flex-1 pr-3">
                      <Text className="text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>{sensor.name}</Text>
                      <View className="flex-row items-baseline mt-1">
                        <Text className="text-3xl font-bold" style={{ color: theme.colors.text }}>{sensor.value === null ? '--' : sensor.value}</Text>
                        {sensor.unit ? <Text className="text-sm ml-1" style={{ color: theme.colors.textSecondary }}>{sensor.unit}</Text> : null}
                      </View>
                      <Text className="text-xs mt-1" style={{ color: theme.colors.textTertiary }}>{sensor.range}</Text>
                    </View>
                    <View className="px-3 py-1.5 rounded-full" style={{ backgroundColor: sensor.background }}>
                      <Text className="text-xs font-bold" style={{ color: sensor.color }}>{sensor.band}</Text>
                    </View>
                  </View>
                  <View className="h-px mb-3" style={{ backgroundColor: theme.colors.border }} />
                  <Text className="text-sm font-bold mb-1" style={{ color: sensor.color }}>{sensor.headline}</Text>
                  <Text className="text-sm leading-5" style={{ color: theme.colors.textSecondary }}>{sensor.explanation}</Text>
                  {sensor.nextStep ? (
                    <View className="mt-3 rounded-xl p-3" style={{ backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                      <Text className="text-[11px] font-bold tracking-wider mb-1" style={{ color: theme.colors.textTertiary }}>WHAT TO DO</Text>
                      <Text className="text-sm leading-5" style={{ color: theme.colors.text }}>{sensor.nextStep}</Text>
                    </View>
                  ) : null}
                </View>
              ))}
            </View>

            <View className="px-5 mb-6">
              <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>WHY THE APP GAVE THIS RESULT</Text>
              <View className="rounded-2xl p-5 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
                <View className="flex-row items-start mb-4">
                  <MaterialCommunityIcons name="chart-timeline-variant" size={23} color={theme.colors.primary} />
                  <View className="flex-1 ml-3">
                    <Text className="text-sm font-bold" style={{ color: theme.colors.text }}>Prediction reason</Text>
                    <Text className="text-sm leading-5 mt-1" style={{ color: theme.colors.textSecondary }}>{insights.explanation}</Text>
                  </View>
                </View>

                <Text className="text-xs leading-5 mb-4" style={{ color: theme.colors.textTertiary }}>
                  The bars show which readings affected the prediction most. Amber means the app became more concerned; green means the app became less concerned. This does not replace the simple explanations above.
                </Text>

                {insights.factors.length === 0 ? (
                  <View className="items-center py-6">
                    <MaterialCommunityIcons name="chart-box-outline" size={32} color={theme.colors.textTertiary} />
                    <Text className="text-sm text-center mt-3" style={{ color: theme.colors.textSecondary }}>
                      The app could not explain which readings affected this prediction.
                    </Text>
                  </View>
                ) : insights.factors.map((factor, index) => {
                  const width = Math.max(8, Math.round((Math.abs(factor.shapValue) / maxInfluence) * 100));
                  const strengthLabel = width >= 67 ? 'Strong effect' : width >= 34 ? 'Medium effect' : 'Small effect';
                  const increasing = factor.direction !== 'decreasing_risk';
                  const color = increasing ? '#F59E0B' : '#10B981';
                  return (
                    <View key={`${factor.feature}-${index}`} className={index < insights.factors.length - 1 ? 'mb-5' : ''}>
                      <View className="flex-row justify-between items-start mb-2">
                        <View className="flex-1 pr-2">
                          <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>{factor.name}</Text>
                          <Text className="text-xs mt-0.5" style={{ color: theme.colors.textTertiary }}>
                            {factor.contextLabel}{factor.observedLabel ? ` • ${factor.observedLabel}` : ''}
                          </Text>
                        </View>
                        <Text className="text-xs font-semibold" style={{ color }}>{factor.effectLabel}</Text>
                      </View>
                      <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0' }}>
                        <View className="h-full rounded-full" style={{ width: `${width}%`, backgroundColor: color }} />
                      </View>
                      <View className="flex-row justify-between mt-1.5">
                        <Text className="text-[11px] flex-1 pr-2" style={{ color: theme.colors.textTertiary }}>
                          {factor.effectExplanation}
                        </Text>
                        <Text className="text-[11px]" style={{ color: theme.colors.textTertiary }}>
                          {strengthLabel}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
};

export default ReportsScreen;
