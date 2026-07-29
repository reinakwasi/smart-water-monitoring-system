import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';
import { historicalDataAPI } from '../services/api';

const screenWidth = Dimensions.get('window').width;

const HistoryScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('7D');
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchHistoryData = useCallback(async () => {
    try {
      setLoading(true);
      const endDate = new Date();
      const startDate = new Date(endDate);
      if (timeRange === '7D') startDate.setDate(endDate.getDate() - 7);
      else if (timeRange === '30D') startDate.setDate(endDate.getDate() - 30);
      else startDate.setFullYear(endDate.getFullYear() - 1);

      const response = await historicalDataAPI.getHistoricalData({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        parameter: 'all',
        limit: 1000,
      });
      const readings = (response.data || []).map(point => {
        const riskScore = Number(point.risk_score);
        const risk = Number.isFinite(riskScore)
          ? (riskScore >= 0.7 ? 'High risk' : riskScore >= 0.4 ? 'Medium risk' : 'Low risk')
          : 'Risk unavailable';
        return {
          timestamp: new Date(point.timestamp),
          ph: Number(point.parameters?.ph),
          turbidity: Number(point.parameters?.turbidity_index),
          temperature: Number(point.parameters?.temperature),
          tds: Number(point.parameters?.tds),
          classification: point.classification || 'Pending',
          risk,
          riskScore: Number.isFinite(riskScore) ? riskScore : null,
        };
      }).filter(reading => [reading.ph, reading.turbidity, reading.temperature, reading.tds].every(Number.isFinite));

      setHistoryData(readings.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
      setError(null);
    } catch (requestError) {
      setHistoryData([]);
      setError('Past readings could not be loaded. Pull down to try again.');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    fetchHistoryData();
  }, [fetchHistoryData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchHistoryData();
    setRefreshing(false);
  };

  const getChartData = (parameter) => {
    const data = historyData.slice().reverse().map(item => item[parameter]);
    return {
      labels: historyData.slice().reverse().map((item, index) => {
        if (index % 2 === 0) {
          const date = new Date(item.timestamp);
          return `${date.getDate()}/${date.getMonth() + 1}`;
        }
        return '';
      }),
      datasets: [{
        data: data.length > 0 ? data : [0],
      }],
    };
  };

  const getChartColor = (parameter) => {
    switch (parameter) {
      case 'ph': return 'rgba(14, 165, 233, 1)';
      case 'turbidity': return 'rgba(239, 68, 68, 1)';
      case 'tds': return 'rgba(16, 185, 129, 1)';
      case 'temperature': return 'rgba(251, 146, 60, 1)';
      default: return 'rgba(100, 116, 139, 1)';
    }
  };

  const getCurrentValue = (parameter) => {
    if (historyData.length === 0) return '0';
    const value = historyData[0][parameter];

    switch (parameter) {
      case 'ph': return `${value.toFixed(1)} today`;
      case 'turbidity': return `${value.toFixed(1)} NTU today`;
      case 'tds': return `${Math.round(value)} ppm today`;
      case 'temperature': return `${Math.round(value)}°C today`;
      default: return `${value}`;
    }
  };

  const getValueColor = (parameter) => {
    switch (parameter) {
      case 'ph': return 'text-cyan-500';
      case 'turbidity': return 'text-red-500';
      case 'tds': return 'text-green-500';
      case 'temperature': return 'text-orange-500';
      default: return 'text-slate-500';
    }
  };

  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  const formatDate = (date) => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[date.getMonth()]} ${date.getDate()}`;
    }
  };

  const getStatusColor = (classification) => {
    if (classification === 'Safe') return 'text-green-600';
    if (classification === 'Warning') return 'text-orange-500';
    if (classification === 'Pending') return 'text-slate-500';
    return 'text-red-600';
  };

  const getRiskColor = (risk) => {
    if (risk === 'Low risk') return 'text-green-600';
    if (risk === 'Medium risk') return 'text-amber-600';
    if (risk === 'High risk') return 'text-red-600';
    return 'text-slate-500';
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7D': return 'Last 7 days';
      case '30D': return 'Last 30 days';
      case 'All': return 'Last 12 months';
      default: return 'Last 7 days';
    }
  };

  const handleTimeRangeSelect = (range) => {
    setTimeRange(range);
    setShowTimeRangeMenu(false);
  };

  const handleDownloadReport = () => {
    navigation.navigate('ExportData');
  };

  const latestReading = historyData[0] || null;
  const warningCount = historyData.filter(item => ['Warning', 'Unsafe'].includes(item.classification)).length;
  const highRiskCount = historyData.filter(item => item.risk === 'High risk').length;
  const latestReadingLabel = latestReading ? latestReading.classification + ' - ' + latestReading.risk : 'No reading yet';

  const renderSummaryTile = ({ icon, label, value, color, background }) => (
    <View className="w-[48%] rounded-2xl p-4 mb-3" style={{ backgroundColor: background }}>
      <MaterialIcons name={icon} size={22} color={color} />
      <Text className="text-xs mt-3" style={{ color: theme.colors.textSecondary }}>{label}</Text>
      <Text className="text-lg font-bold mt-1" style={{ color: theme.colors.text }}>{value}</Text>
    </View>
  );

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0891B2']} />
        }
      >
        {/* Header */}
        <View className="px-5 pt-12 pb-4 flex-row justify-between items-center">
          <View>
            <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Past Readings</Text>
            <Text className="text-sm" style={{ color: theme.colors.textTertiary }}>{getTimeRangeLabel()}</Text>
          </View>
          <TouchableOpacity
            className="bg-cyan-100 px-3 py-1.5 rounded-lg"
            onPress={() => setShowTimeRangeMenu(!showTimeRangeMenu)}
          >
            <Text className="text-xs font-bold text-cyan-600">{timeRange} ▼</Text>
          </TouchableOpacity>
        </View>

        {/* Time Range Dropdown Menu */}
        {showTimeRangeMenu && (
          <View className="mx-5 mb-4 rounded-2xl shadow-lg" style={{ backgroundColor: theme.colors.cardBackground }}>
            <TouchableOpacity
              className="flex-row justify-between items-center px-4 py-3 border-b"
              style={{ borderBottomColor: theme.colors.border }}
              onPress={() => handleTimeRangeSelect('7D')}
            >
              <Text className="text-base" style={{ color: theme.colors.text }}>Last 7 days</Text>
              {timeRange === '7D' && <MaterialIcons name="check" size={20} color="#0891B2" />}
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row justify-between items-center px-4 py-3 border-b"
              style={{ borderBottomColor: theme.colors.border }}
              onPress={() => handleTimeRangeSelect('30D')}
            >
              <Text className="text-base" style={{ color: theme.colors.text }}>Last 30 days</Text>
              {timeRange === '30D' && <MaterialIcons name="check" size={20} color="#0891B2" />}
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-row justify-between items-center px-4 py-3"
              onPress={() => handleTimeRangeSelect('All')}
            >
              <Text className="text-base" style={{ color: theme.colors.text }}>Last 12 months</Text>
              {timeRange === 'All' && <MaterialIcons name="check" size={20} color="#0891B2" />}
            </TouchableOpacity>
          </View>
        )}

        {/* pH Level Trend */}
        {loading ? (
          <View className="items-center py-24">
            <ActivityIndicator size="large" color={theme.colors.primary} />
            <Text className="text-sm mt-3" style={{ color: theme.colors.textSecondary }}>Loading stored readings…</Text>
          </View>
        ) : error ? (
          <View className="mx-5 rounded-2xl p-5 mb-5 border border-red-200 bg-red-50">
            <Text className="text-sm leading-5 text-red-800">{error}</Text>
            <TouchableOpacity onPress={fetchHistoryData} className="mt-3 self-start">
              <Text className="text-sm font-bold" style={{ color: theme.colors.primary }}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : historyData.length === 0 ? (
          <View className="items-center px-8 py-20">
            <MaterialIcons name="show-chart" size={48} color={theme.colors.textTertiary} />
            <Text className="text-lg font-bold mt-4" style={{ color: theme.colors.text }}>No stored readings</Text>
            <Text className="text-sm text-center mt-2" style={{ color: theme.colors.textSecondary }}>No sensor data was recorded during this time range.</Text>
          </View>
        ) : (
          <>
        <View className="px-5 mb-4">
          <View className="rounded-2xl p-5 border" style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}>
            <Text className="text-xs font-semibold tracking-wider mb-1" style={{ color: theme.colors.textTertiary }}>HISTORY SUMMARY</Text>
            <Text className="text-lg font-bold" style={{ color: theme.colors.text }}>Stored water checks</Text>
            <Text className="text-sm leading-5 mt-1" style={{ color: theme.colors.textSecondary }}>
              This page keeps past pH, turbidity, temperature, and TDS readings for review after each water check.
            </Text>
            <View className="flex-row flex-wrap justify-between mt-4">
              {renderSummaryTile({ icon: 'fact-check', label: 'Readings saved', value: historyData.length, color: '#0891B2', background: theme.isDarkMode ? '#164E63' : '#ECFEFF' })}
              {renderSummaryTile({ icon: 'verified-user', label: 'Latest result', value: latestReadingLabel, color: latestReading?.classification === 'Unsafe' ? '#DC2626' : latestReading?.classification === 'Warning' ? '#D97706' : '#059669', background: theme.isDarkMode ? '#1E293B' : '#F8FAFC' })}
              {renderSummaryTile({ icon: 'warning-amber', label: 'Warnings found', value: warningCount, color: warningCount > 0 ? '#D97706' : '#059669', background: warningCount > 0 ? (theme.isDarkMode ? '#451A03' : '#FFFBEB') : (theme.isDarkMode ? '#052E16' : '#ECFDF5') })}
              {renderSummaryTile({ icon: 'shield', label: 'High-risk results', value: highRiskCount, color: highRiskCount > 0 ? '#DC2626' : '#059669', background: highRiskCount > 0 ? (theme.isDarkMode ? '#451A1A' : '#FEF2F2') : (theme.isDarkMode ? '#052E16' : '#ECFDF5') })}
            </View>
          </View>
        </View>

        <View className="mx-5 rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold" style={{ color: theme.colors.text }}>pH trend</Text>
            <Text className={`text-base font-bold ${getValueColor('ph')}`}>
              {getCurrentValue('ph')}
            </Text>
          </View>
          <LineChart
            data={getChartData('ph')}
            width={screenWidth - 72}
            height={120}
            chartConfig={{
              backgroundColor: theme.colors.cardBackground,
              backgroundGradientFrom: theme.colors.cardBackground,
              backgroundGradientTo: theme.colors.cardBackground,
              decimalPlaces: 1,
              color: (opacity = 1) => getChartColor('ph'),
              labelColor: (opacity = 1) => theme.isDarkMode ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: getChartColor('ph'),
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: theme.colors.border,
                strokeWidth: 1,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
        </View>

        {/* Turbidity Trend */}
        <View className="mx-5 rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold" style={{ color: theme.colors.text }}>Turbidity trend</Text>
            <Text className={`text-base font-bold ${getValueColor('turbidity')}`}>
              {getCurrentValue('turbidity')}
            </Text>
          </View>
          <LineChart
            data={getChartData('turbidity')}
            width={screenWidth - 72}
            height={120}
            chartConfig={{
              backgroundColor: theme.colors.cardBackground,
              backgroundGradientFrom: theme.colors.cardBackground,
              backgroundGradientTo: theme.colors.cardBackground,
              decimalPlaces: 1,
              color: (opacity = 1) => getChartColor('turbidity'),
              labelColor: (opacity = 1) => theme.isDarkMode ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: getChartColor('turbidity'),
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: theme.colors.border,
                strokeWidth: 1,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
        </View>

        {/* TDS Trend */}
        <View className="mx-5 rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold" style={{ color: theme.colors.text }}>TDS trend</Text>
            <Text className={`text-base font-bold ${getValueColor('tds')}`}>
              {getCurrentValue('tds')}
            </Text>
          </View>
          <LineChart
            data={getChartData('tds')}
            width={screenWidth - 72}
            height={120}
            chartConfig={{
              backgroundColor: theme.colors.cardBackground,
              backgroundGradientFrom: theme.colors.cardBackground,
              backgroundGradientTo: theme.colors.cardBackground,
              decimalPlaces: 0,
              color: (opacity = 1) => getChartColor('tds'),
              labelColor: (opacity = 1) => theme.isDarkMode ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: getChartColor('tds'),
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: theme.colors.border,
                strokeWidth: 1,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
        </View>

        {/* Temperature Trend */}
        <View className="mx-5 rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold" style={{ color: theme.colors.text }}>Temperature trend</Text>
            <Text className={`text-base font-bold ${getValueColor('temperature')}`}>
              {getCurrentValue('temperature')}
            </Text>
          </View>
          <LineChart
            data={getChartData('temperature')}
            width={screenWidth - 72}
            height={120}
            chartConfig={{
              backgroundColor: theme.colors.cardBackground,
              backgroundGradientFrom: theme.colors.cardBackground,
              backgroundGradientTo: theme.colors.cardBackground,
              decimalPlaces: 0,
              color: (opacity = 1) => getChartColor('temperature'),
              labelColor: (opacity = 1) => theme.isDarkMode ? `rgba(148, 163, 184, ${opacity})` : `rgba(100, 116, 139, ${opacity})`,
              style: {
                borderRadius: 16,
              },
              propsForDots: {
                r: '4',
                strokeWidth: '2',
                stroke: getChartColor('temperature'),
              },
              propsForBackgroundLines: {
                strokeDasharray: '',
                stroke: theme.colors.border,
                strokeWidth: 1,
              },
            }}
            bezier
            style={{
              marginVertical: 8,
              borderRadius: 16,
            }}
            withInnerLines={true}
            withOuterLines={false}
            withVerticalLines={false}
            withHorizontalLines={true}
            withVerticalLabels={true}
            withHorizontalLabels={true}
            fromZero={false}
          />
        </View>

        {/* Check History Section */}
        <View className="px-5 mb-4">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>CHECK HISTORY</Text>

          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            {historyData.slice(0, 4).map((item, index) => (
              <View
                key={index}
                className={`flex-row justify-between items-center py-3`}
                style={{ borderBottomWidth: index < 3 ? 1 : 0, borderBottomColor: theme.colors.border }}
              >
                <Text className="text-sm" style={{ color: theme.colors.textSecondary }}>
                  {formatDate(item.timestamp)}, {formatTime(item.timestamp)}
                </Text>
                <View className="flex-row items-center">
                  <Text className={`text-sm font-semibold mr-3 ${getStatusColor(item.classification)}`}>
                    {item.classification}
                  </Text>
                  <Text className={`text-sm ${getRiskColor(item.risk)}`}>
                    {item.risk}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
          </>
        )}

        {/* Download Report Button */}
        <View className="px-5 mb-8">
          <TouchableOpacity
            className="bg-[#0891B2] rounded-2xl py-4 flex-row justify-center items-center"
            onPress={handleDownloadReport}
          >
            <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
            <Text className="text-white text-base font-bold ml-2">Open Data Export</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default HistoryScreen;
