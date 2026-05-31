import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  RefreshControl,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const HomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [greeting, setGreeting] = useState('');
  const [userName, setUserName] = useState('Samuel');
  const [refreshing, setRefreshing] = useState(false);
  
  const [waterQuality, setWaterQuality] = useState({
    classification: 'Safe to drink',
    confidence: 0,
    parameters: {
      ph: 0,
      turbidity: 0,
      temperature: 0,
      tds: 0,
    },
    timestamp: new Date()
  });
  
  const [tankStatus, setTankStatus] = useState({
    level_percent: 0,
    volume_liters: 0,
    total_capacity: 500,
    status: 'Half full',
  });
  
  const [esp32Connected, setEsp32Connected] = useState(false);

  useEffect(() => {
    updateGreeting();
    const interval = setInterval(updateGreeting, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchCurrentStatus();
    const interval = setInterval(fetchCurrentStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateGreeting = () => {
    const hours = new Date().getHours();
    
    if (hours < 12) {
      setGreeting('Good morning');
    } else if (hours < 18) {
      setGreeting('Good afternoon');
    } else {
      setGreeting('Good evening');
    }
  };

  const fetchCurrentStatus = async () => {
    try {
      const token = await AsyncStorage.getItem('@access_token');
      
      if (!token) {
        setEsp32Connected(false);
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/status/current-status`, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      const data = response.data;
      
      setWaterQuality({
        classification: data.water_quality.classification === 'Safe' ? 'Safe to drink' : data.water_quality.classification,
        confidence: Math.round(data.water_quality.confidence * 100),
        parameters: {
          ph: data.water_quality.parameters.ph || 0,
          turbidity: data.water_quality.parameters.turbidity || 0,
          temperature: data.water_quality.parameters.temperature || 0,
          tds: data.water_quality.parameters.tds || 0,
        },
        timestamp: new Date(data.water_quality.timestamp)
      });
      
      setTankStatus({
        level_percent: Math.round(data.tank_status.level_percent) || 0,
        volume_liters: Math.round(data.tank_status.volume_liters) || 0,
        total_capacity: 500,
        status: getTankStatusText(data.tank_status.status),
      });
      
      const now = new Date();
      const lastUpdate = new Date(data.water_quality.timestamp);
      const minutesAgo = Math.floor((now - lastUpdate) / 60000);
      
      const isConnected = minutesAgo < 5;
      setEsp32Connected(isConnected);
      
      console.log('ESP32 Connection Status:', {
        lastUpdate: lastUpdate.toISOString(),
        minutesAgo,
        isConnected: isConnected ? 'CONNECTED' : 'DISCONNECTED'
      });
    } catch (error) {
      console.error('Backend connection error:', error.message);
      setEsp32Connected(false);
    }
  };

  const getTankStatusText = (status) => {
    switch (status) {
      case 'Full':
        return 'Full';
      case 'Half_Full':
        return 'Half full';
      case 'Low':
        return 'Low';
      case 'Empty':
        return 'Empty';
      case 'Overflow':
        return 'Overflow';
      default:
        return 'Half full';
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchCurrentStatus();
    setRefreshing(false);
  };

  const getParameterStatus = (param, value) => {
    switch (param) {
      case 'ph':
        if (value >= 6.5 && value <= 8.5) return { text: 'Safe range', color: 'text-green-500' };
        return { text: 'Out of range', color: 'text-red-500' };
      case 'turbidity':
        if (value < 5) return { text: 'Clear', color: 'text-green-500' };
        return { text: 'Cloudy', color: 'text-orange-500' };
      case 'tds':
        if (value < 500) return { text: 'Normal', color: 'text-green-500' };
        return { text: 'High', color: 'text-orange-500' };
      case 'temperature':
        if (value >= 20 && value <= 30) return { text: 'Normal', color: 'text-green-500' };
        if (value > 30) return { text: 'Slightly warm', color: 'text-orange-500' };
        return { text: 'Cool', color: 'text-cyan-600' };
      default:
        return { text: 'Normal', color: 'text-green-500' };
    }
  };

  const getTimeSinceUpdate = () => {
    const now = new Date();
    const lastUpdate = waterQuality.timestamp;
    const minutesAgo = Math.floor((now - lastUpdate) / 60000);
    
    if (minutesAgo < 1) return 'Updated just now';
    if (minutesAgo === 1) return 'Updated 1 min ago';
    if (minutesAgo < 60) return `Updated ${minutesAgo} mins ago`;
    
    const hoursAgo = Math.floor(minutesAgo / 60);
    if (hoursAgo === 1) return 'Updated 1 hour ago';
    return `Updated ${hoursAgo} hours ago`;
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
        {/* Header - Greeting and Live Indicator */}
        <View className="px-5 pt-12 pb-4">
          <View className="flex-row justify-between items-start">
            <View className="flex-1">
              <Text className="text-sm mb-1" style={{ color: theme.colors.textTertiary }}>{greeting},</Text>
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>{userName} 👋</Text>
            </View>
            <View className={`bg-${esp32Connected ? 'green' : 'red'}-100 flex-row items-center px-3 py-1.5 rounded-full`}>
              <View className={`w-2 h-2 rounded-full mr-1.5 bg-${esp32Connected ? 'green' : 'red'}-500`} />
              <Text className={`text-sm font-semibold text-${esp32Connected ? 'green' : 'red'}-600`}>Live</Text>
            </View>
          </View>
        </View>

        {/* Water Quality Card */}
        <View className="bg-[#0B7FA5] mx-5 rounded-3xl p-5 mb-5 relative overflow-hidden">
          <Text className="text-sm text-cyan-100 mb-1">Your water right now</Text>
          <Text className="text-3xl font-bold text-white mb-2">{waterQuality.classification}</Text>
          <View className="flex-row items-center">
            <MaterialIcons name="access-time" size={14} color="rgba(255,255,255,0.8)" />
            <Text className="text-xs text-white/80 ml-1">{getTimeSinceUpdate()}</Text>
          </View>

          {/* Confidence Badge */}
          <View className="absolute top-5 right-5 bg-white/25 px-4 py-3 rounded-xl items-center">
            <Text className="text-2xl font-bold text-white">{waterQuality.confidence}%</Text>
            <Text className="text-xs text-cyan-100 font-semibold tracking-wide">SURE</Text>
          </View>

          {/* ESP32 Hub Card */}
          <View className="flex-row items-center bg-white/20 rounded-2xl p-4 mt-4">
            <View className="w-10 h-10 rounded-xl bg-white justify-center items-center mr-3">
              <MaterialCommunityIcons name="chip" size={20} color="#0B7FA5" />
            </View>
            <View className="flex-1">
              <Text className="text-sm font-semibold text-white mb-0.5">ESP32 Hub</Text>
              <Text className="text-xs text-cyan-100">
                {esp32Connected ? 'Connected · Strong signal' : 'Disconnected'}
              </Text>
            </View>
            <View className={`w-2 h-2 rounded-full ${esp32Connected ? 'bg-green-400' : 'bg-red-400'}`} />
          </View>
        </View>

        {/* Live Sensor Readings Header */}
        <View className="flex-row justify-between items-center px-5 mb-4">
          <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>LIVE SENSOR READINGS</Text>
          <TouchableOpacity>
            <Text className="text-sm font-semibold text-[#0B7FA5]">AI View →</Text>
          </TouchableOpacity>
        </View>

        {/* Sensor Cards Grid */}
        <View className="flex-row flex-wrap px-5 mb-5 justify-between">
          {/* pH Sensor */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm relative" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-cyan-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="water" size={24} color="#0891B2" />
            </View>
            <View className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500" />
            <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>pH Sensor</Text>
            <Text className="text-3xl font-bold mb-0.5" style={{ color: theme.colors.text }}>
              {waterQuality.parameters.ph.toFixed(1)}<Text className="text-base font-normal" style={{ color: theme.colors.textTertiary }}>pH</Text>
            </Text>
            <Text className={`text-xs font-medium ${getParameterStatus('ph', waterQuality.parameters.ph).color}`}>
              {getParameterStatus('ph', waterQuality.parameters.ph).text}
            </Text>
          </View>

          {/* Turbidity */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm relative" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-indigo-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="circle-opacity" size={24} color="#6366F1" />
            </View>
            <View className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500" />
            <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>Turbidity</Text>
            <Text className="text-3xl font-bold mb-0.5" style={{ color: theme.colors.text }}>
              {waterQuality.parameters.turbidity.toFixed(1)}<Text className="text-base font-normal" style={{ color: theme.colors.textTertiary }}>NTU</Text>
            </Text>
            <Text className={`text-xs font-medium ${getParameterStatus('turbidity', waterQuality.parameters.turbidity).color}`}>
              {getParameterStatus('turbidity', waterQuality.parameters.turbidity).text}
            </Text>
          </View>

          {/* TDS Meter */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm relative" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-green-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="arrow-collapse-down" size={24} color="#10B981" />
            </View>
            <View className="absolute top-4 right-4 w-2 h-2 rounded-full bg-green-500" />
            <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>TDS Meter</Text>
            <Text className="text-3xl font-bold mb-0.5" style={{ color: theme.colors.text }}>
              {Math.round(waterQuality.parameters.tds)}<Text className="text-base font-normal" style={{ color: theme.colors.textTertiary }}>ppm</Text>
            </Text>
            <Text className={`text-xs font-medium ${getParameterStatus('tds', waterQuality.parameters.tds).color}`}>
              {getParameterStatus('tds', waterQuality.parameters.tds).text}
            </Text>
          </View>

          {/* Temperature */}
          <View className="w-[48%] rounded-2xl p-4 mb-4 shadow-sm relative" style={{ backgroundColor: theme.colors.cardBackground }}>
            <View className="w-12 h-12 rounded-xl bg-yellow-50 justify-center items-center mb-3">
              <MaterialCommunityIcons name="thermometer" size={24} color="#F59E0B" />
            </View>
            <View className={`absolute top-4 right-4 w-2 h-2 rounded-full ${getParameterStatus('temperature', waterQuality.parameters.temperature).color === 'text-orange-500' ? 'bg-orange-500' : 'bg-green-500'}`} />
            <Text className="text-xs mb-1" style={{ color: theme.colors.textSecondary }}>Temperature</Text>
            <Text className="text-3xl font-bold mb-0.5" style={{ color: theme.colors.text }}>
              {Math.round(waterQuality.parameters.temperature)}<Text className="text-base font-normal" style={{ color: theme.colors.textTertiary }}>°C</Text>
            </Text>
            <Text className={`text-xs font-medium ${getParameterStatus('temperature', waterQuality.parameters.temperature).color}`}>
              {getParameterStatus('temperature', waterQuality.parameters.temperature).text}
            </Text>
          </View>
        </View>

        {/* Tank Storage Header */}
        <View className="flex-row justify-between items-center px-5 mb-4">
          <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>TANK STORAGE</Text>
          <TouchableOpacity>
            <Text className="text-sm font-semibold text-[#0B7FA5]">Details →</Text>
          </TouchableOpacity>
        </View>

        {/* Tank Storage Card */}
        <View className="rounded-2xl p-5 mb-8 shadow-sm mx-5" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row justify-between items-center">
            <View className="flex-1">
              <Text className="text-sm mb-2" style={{ color: theme.colors.textSecondary }}>Current water level</Text>
              <Text className="text-5xl font-bold mb-1" style={{ color: theme.colors.text }}>{tankStatus.level_percent}%</Text>
              <Text className="text-xs text-green-500 font-medium">
                • {tankStatus.volume_liters}L of {tankStatus.total_capacity}L · {tankStatus.status}
              </Text>
            </View>
            <View className="ml-4">
              <View className="w-16 h-24 rounded-2xl border-2 overflow-hidden justify-end" style={{ borderColor: theme.colors.border, backgroundColor: theme.isDarkMode ? '#0F172A' : '#F8FAFC' }}>
                <View className="w-full bg-[#0B7FA5] rounded-lg" style={{ height: `${tankStatus.level_percent}%` }} />
              </View>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default HomeScreen;
