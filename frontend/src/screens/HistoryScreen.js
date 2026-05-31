import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';
const screenWidth = Dimensions.get('window').width;

const HistoryScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [timeRange, setTimeRange] = useState('7D');
  const [showTimeRangeMenu, setShowTimeRangeMenu] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistoryData();
  }, [timeRange]);

  const fetchHistoryData = async () => {
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
      
      const mockHistory = generateMockHistory(data);
      setHistoryData(mockHistory);
      
    } catch (error) {
      setHistoryData([]);
    } finally {
      setLoading(false);
    }
  };

  const generateMockHistory = (currentData) => {
    const history = [];
    const now = new Date();
    
    let days = 7;
    if (timeRange === '30D') days = 30;
    if (timeRange === 'All') days = 90;
    
    for (let i = 0; i < days; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      const variance = () => (Math.random() - 0.5) * 0.3;
      
      history.push({
        timestamp: date,
        ph: Math.max(6.5, Math.min(8.5, (currentData.water_quality.parameters.ph || 7.2) + variance())),
        turbidity: Math.max(0, Math.min(50, (currentData.water_quality.parameters.turbidity || 3.1) + variance() * 10)),
        tds: Math.max(0, Math.min(500, (currentData.water_quality.parameters.tds || 312) + variance() * 50)),
        temperature: Math.max(20, Math.min(30, (currentData.water_quality.parameters.temperature || 24) + variance() * 3)),
        classification: i === 0 ? 'Not safe' : i === 2 ? 'Caution' : 'Safe',
        risk: i === 0 ? 'Medium risk' : i === 2 ? 'Medium risk' : 'Low risk',
      });
    }
    
    return history;
  };

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
    if (classification === 'Caution') return 'text-orange-500';
    return 'text-red-600';
  };

  const getRiskColor = (risk) => {
    if (risk === 'Low risk') return 'text-slate-500';
    return 'text-slate-600';
  };

  const getTimeRangeLabel = () => {
    switch (timeRange) {
      case '7D': return 'Last 7 days';
      case '30D': return 'Last 30 days';
      case 'All': return 'All time';
      default: return 'Last 7 days';
    }
  };

  const handleTimeRangeSelect = (range) => {
    setTimeRange(range);
    setShowTimeRangeMenu(false);
  };

  const handleDownloadReport = () => {
    Alert.alert('Download Report', 'Report download feature coming soon. You will be able to download your water quality data as PDF or CSV.');
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
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
              <Text className="text-base" style={{ color: theme.colors.text }}>All time</Text>
              {timeRange === 'All' && <MaterialIcons name="check" size={20} color="#0891B2" />}
            </TouchableOpacity>
          </View>
        )}

        {/* pH Level Trend */}
        <View className="mx-5 rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center mb-3">
            <Text className="text-base font-bold" style={{ color: theme.colors.text }}>pH Level trend</Text>
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

        {/* Download Report Button */}
        <View className="px-5 mb-8">
          <TouchableOpacity 
            className="bg-[#0891B2] rounded-2xl py-4 flex-row justify-center items-center"
            onPress={handleDownloadReport}
          >
            <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
            <Text className="text-white text-base font-bold ml-2">Download Report (PDF / CSV)</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

export default HistoryScreen;
