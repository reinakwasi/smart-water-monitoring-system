import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const TankScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [sensorLive, setSensorLive] = useState(false);
  
  const [tankData, setTankData] = useState({
    levelPercent: 0,
    volumeLiters: 0,
    totalCapacity: 0,
    status: 'Half Full',
    sensorDistance: 48,
  });

  useEffect(() => {
    fetchTankStatus();
    const interval = setInterval(fetchTankStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchTankStatus = async () => {
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
      
      const totalCapacity = data.tank_status.total_capacity || 500;
      
      setTankData({
        levelPercent: Math.round(data.tank_status.level_percent) || 0,
        volumeLiters: Math.round(data.tank_status.volume_liters) || 0,
        totalCapacity: totalCapacity,
        status: getTankStatusText(data.tank_status.status),
        sensorDistance: 48,
      });
      
      const now = new Date();
      const lastUpdate = new Date(data.tank_status.timestamp);
      const minutesAgo = Math.floor((now - lastUpdate) / 60000);
      
      setSensorLive(minutesAgo < 5);
    } catch (error) {
      console.error('Tank status fetch error:', error.message);
      setSensorLive(false);
    }
  };

  const getTankStatusText = (status) => {
    switch (status) {
      case 'Full':
        return 'Full';
      case 'Half_Full':
        return 'Half Full';
      case 'Low':
        return 'Low';
      case 'Empty':
        return 'Empty';
      case 'Overflow':
        return 'Overflowing';
      default:
        return 'Half Full';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchTankStatus();
    setRefreshing(false);
  };

  const getWaterRemaining = () => {
    return tankData.totalCapacity - tankData.volumeLiters;
  };

  const getTankStatusIcon = () => {
    if (tankData.levelPercent >= 75) return 'check';
    if (tankData.levelPercent >= 25) return 'check';
    return 'check';
  };

  const getTankStatusColor = () => {
    if (tankData.levelPercent >= 75) return 'text-green-600';
    if (tankData.levelPercent >= 25) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTankStatusBg = () => {
    if (tankData.levelPercent >= 75) return 'bg-green-50';
    if (tankData.levelPercent >= 25) return 'bg-yellow-50';
    return 'bg-red-50';
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
        <View className="px-5 pt-12 pb-4">
          <View className="flex-row justify-between items-start">
            <View>
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>Tank Monitor</Text>
              <Text className="text-sm" style={{ color: theme.colors.textTertiary }}>Ultrasonic sensor · Live</Text>
            </View>
            <View className={`flex-row items-center px-3 py-1.5 rounded-full ${sensorLive ? 'bg-green-100' : 'bg-red-100'}`}>
              <View className={`w-2 h-2 rounded-full mr-1.5 ${sensorLive ? 'bg-green-500' : 'bg-red-500'}`} />
              <Text className={`text-sm font-semibold ${sensorLive ? 'text-green-600' : 'text-red-600'}`}>Live</Text>
            </View>
          </View>
        </View>

        {/* Current Water Level Card */}
        <View className="mx-5 rounded-2xl p-6 mb-5 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text className="text-xs font-semibold tracking-wider text-center mb-4" style={{ color: theme.colors.textTertiary }}>CURRENT WATER LEVEL</Text>
          
          {/* Tank Visual */}
          <View className="items-center mb-6">
            <View className="relative">
              {/* Percentage Labels */}
              <View className="absolute -left-12 top-0 bottom-0 justify-between py-2">
                <Text className="text-xs text-slate-400">100%</Text>
                <Text className="text-xs text-slate-400">75%</Text>
                <Text className="text-xs text-slate-400">50%</Text>
                <Text className="text-xs text-slate-400">25%</Text>
                <Text className="text-xs text-slate-400">0%</Text>
              </View>
              
              {/* Tank Container */}
              <View className="w-32 h-48 rounded-3xl border-4 overflow-hidden justify-end" style={{ borderColor: theme.colors.border, backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                <View 
                  className="w-full bg-[#0891B2] rounded-2xl items-center justify-center" 
                  style={{ height: `${tankData.levelPercent}%` }}
                >
                  <Text className="text-3xl font-bold text-white">{tankData.levelPercent}%</Text>
                  <Text className="text-xs font-semibold text-white/80 tracking-wider">FILLED</Text>
                </View>
              </View>
              
              {/* Tick Marks */}
              <View className="absolute -right-4 top-0 bottom-0 justify-between py-2">
                <View className="w-2 h-0.5" style={{ backgroundColor: theme.colors.border }} />
                <View className="w-2 h-0.5" style={{ backgroundColor: theme.colors.border }} />
                <View className="w-2 h-0.5" style={{ backgroundColor: theme.colors.border }} />
                <View className="w-2 h-0.5" style={{ backgroundColor: theme.colors.border }} />
                <View className="w-2 h-0.5" style={{ backgroundColor: theme.colors.border }} />
              </View>
            </View>
          </View>
          
          {/* Status Text */}
          <Text className="text-2xl font-bold text-center mb-1" style={{ color: theme.colors.text }}>{tankData.status}</Text>
          <Text className="text-sm text-center" style={{ color: theme.colors.textSecondary }}>{getWaterRemaining()} litres remaining</Text>
        </View>

        {/* Info Cards Grid */}
        <View className="flex-row flex-wrap px-5 mb-5 justify-between">
          {/* Total Capacity */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-cyan-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="cup-water" size={24} color="#0891B2" />
            </View>
            <Text className="text-2xl font-bold mb-0.5" style={{ color: theme.colors.text }}>{tankData.totalCapacity}L</Text>
            <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Total capacity</Text>
          </View>

          {/* Water Remaining */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-blue-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="water" size={24} color="#3B82F6" />
            </View>
            <Text className="text-2xl font-bold mb-0.5" style={{ color: theme.colors.text }}>{getWaterRemaining()}L</Text>
            <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Water remaining</Text>
          </View>

          {/* Tank Status */}
          <View className={`w-[48%] rounded-2xl p-4 mb-4 shadow-sm ${getTankStatusBg()}`}>
            <View className={`w-12 h-12 rounded-xl ${getTankStatusBg()} justify-center items-center mb-3`}>
              <MaterialIcons name={getTankStatusIcon()} size={24} color={getTankStatusColor().replace('text-', '#')} />
            </View>
            <Text className={`text-2xl font-bold mb-0.5 ${getTankStatusColor()}`}>Good</Text>
            <Text className="text-xs text-slate-500">Tank status</Text>
          </View>

          {/* Sensor Distance */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-indigo-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="arrow-expand-vertical" size={24} color="#6366F1" />
            </View>
            <Text className="text-2xl font-bold mb-0.5" style={{ color: theme.colors.text }}>{tankData.sensorDistance}cm</Text>
            <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>Sensor distance</Text>
          </View>
        </View>

        {/* Alert Thresholds */}
        <View className="px-5 mb-8">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>ALERT THRESHOLDS</Text>
          
          <View className="rounded-2xl p-4 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            {/* Almost Empty */}
            <View className="flex-row items-center justify-between mb-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl bg-red-50 justify-center items-center mr-3">
                  <MaterialIcons name="arrow-upward" size={20} color="#EF4444" />
                </View>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Almost empty</Text>
              </View>
              <View className="bg-red-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-red-700">Below 5%</Text>
              </View>
            </View>

            {/* Running Low */}
            <View className="flex-row items-center justify-between mb-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl bg-yellow-50 justify-center items-center mr-3">
                  <MaterialCommunityIcons name="alert-circle-outline" size={20} color="#F59E0B" />
                </View>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Running low</Text>
              </View>
              <View className="bg-yellow-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-yellow-700">Below 25%</Text>
              </View>
            </View>

            {/* Nearly Full */}
            <View className="flex-row items-center justify-between mb-4 pb-4" style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl bg-blue-50 justify-center items-center mr-3">
                  <MaterialCommunityIcons name="cup-water" size={20} color="#3B82F6" />
                </View>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Nearly full</Text>
              </View>
              <View className="bg-blue-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-blue-700">Above 75%</Text>
              </View>
            </View>

            {/* Overflowing */}
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View className="w-10 h-10 rounded-xl bg-red-50 justify-center items-center mr-3">
                  <MaterialIcons name="arrow-upward" size={20} color="#EF4444" />
                </View>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Overflowing</Text>
              </View>
              <View className="bg-red-100 px-3 py-1 rounded-full">
                <Text className="text-xs font-semibold text-red-700">Above 95%</Text>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default TankScreen;
