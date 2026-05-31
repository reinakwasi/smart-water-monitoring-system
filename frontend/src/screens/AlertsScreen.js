import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const AlertsScreen = ({ navigation }) => {
  const [refreshing, setRefreshing] = useState(false);
  const [alerts, setAlerts] = useState([]);
  const [newAlertsCount, setNewAlertsCount] = useState(0);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAlerts = async () => {
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
      const generatedAlerts = generateAlerts(data);
      setAlerts(generatedAlerts);
      
      const newCount = generatedAlerts.filter(alert => !alert.read).length;
      setNewAlertsCount(newCount);
    } catch (error) {
      console.error('Alerts fetch error:', error.message);
    }
  };

  const generateAlerts = (data) => {
    const alerts = [];
    const now = new Date();
    
    const waterQuality = data.water_quality;
    const tankStatus = data.tank_status;
    
    if (waterQuality.classification === 'Poor' || waterQuality.classification === 'Unsafe') {
      alerts.push({
        id: '1',
        type: 'HIGH PRIORITY',
        icon: 'warning',
        iconBg: 'bg-red-100',
        iconColor: '#EF4444',
        borderColor: 'border-red-400',
        title: 'Water is not safe',
        message: `Your water has been classified as unsafe to drink. ${getMainIssue(waterQuality.parameters)}.`,
        time: formatTime(now),
        badge: 'HIGH PRIORITY',
        badgeBg: 'bg-red-100',
        badgeText: 'text-red-700',
        read: false,
        section: 'TODAY',
      });
    }
    
    if (waterQuality.classification === 'Moderate') {
      alerts.push({
        id: '2',
        type: 'MEDIUM',
        icon: 'alert-circle-outline',
        iconBg: 'bg-yellow-100',
        iconColor: '#F59E0B',
        borderColor: 'border-yellow-400',
        title: 'Medium contamination risk',
        message: "There's a medium chance your water has been contaminated. Boil before use.",
        time: formatTime(now),
        badge: 'MEDIUM',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-700',
        read: false,
        section: 'TODAY',
      });
    }
    
    if (tankStatus.level_percent < 25) {
      const yesterday = new Date(now);
      yesterday.setHours(7, 15, 0, 0);
      
      alerts.push({
        id: '3',
        type: 'INFO',
        icon: 'cup-water',
        iconBg: 'bg-yellow-100',
        iconColor: '#F59E0B',
        borderColor: 'border-yellow-400',
        title: 'Tank was running low',
        message: `Tank dropped to ${Math.round(tankStatus.level_percent)}% earlier. It has since refilled to ${Math.round(tankStatus.level_percent)}%.`,
        time: formatTime(yesterday),
        badge: 'INFO',
        badgeBg: 'bg-yellow-100',
        badgeText: 'text-yellow-700',
        read: false,
        section: 'TODAY',
      });
    }
    
    if (waterQuality.classification === 'Safe') {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(14, 30, 0, 0);
      
      alerts.push({
        id: '4',
        type: 'RESOLVED',
        icon: 'check',
        iconBg: 'bg-green-100',
        iconColor: '#10B981',
        borderColor: 'border-green-400',
        title: 'Water is safe again',
        message: 'Your water quality has returned to normal. Safe to drink.',
        time: formatTime(yesterday),
        badge: 'RESOLVED',
        badgeBg: 'bg-green-100',
        badgeText: 'text-green-700',
        read: true,
        section: 'YESTERDAY',
      });
    }
    
    return alerts;
  };

  const getMainIssue = (params) => {
    if (params.turbidity > 5) return 'Turbidity levels are very high';
    if (params.ph < 6.5 || params.ph > 8.5) return 'pH levels are out of range';
    if (params.tds > 500) return 'TDS levels are too high';
    return 'Water quality is poor';
  };

  const formatTime = (date) => {
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    return `${displayHours}:${displayMinutes} ${ampm}`;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAlerts();
    setRefreshing(false);
  };

  const handleMarkAllRead = () => {
    const updatedAlerts = alerts.map(alert => ({ ...alert, read: true }));
    setAlerts(updatedAlerts);
    setNewAlertsCount(0);
    Alert.alert('Success', 'All alerts marked as read');
  };

  const handleAlertPress = (alert) => {
    Alert.alert(
      alert.title,
      alert.message,
      [{ text: 'OK' }]
    );
  };

  const todayAlerts = alerts.filter(alert => alert.section === 'TODAY');
  const yesterdayAlerts = alerts.filter(alert => alert.section === 'YESTERDAY');

  return (
    <View className="flex-1 bg-gray-50">
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ flexGrow: 1 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0891B2']} />
        }
      >
        {/* Header */}
        <View className="px-5 pt-12 pb-4">
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-bold text-slate-800">Alerts</Text>
              <Text className="text-sm text-slate-400">Tap any alert for details</Text>
            </View>
            <View className="flex-row items-center">
              {newAlertsCount > 0 && (
                <View className="bg-red-100 px-3 py-1 rounded-full mr-2">
                  <Text className="text-sm font-semibold text-red-700">{newAlertsCount} new</Text>
                </View>
              )}
              <TouchableOpacity 
                className="bg-cyan-100 px-4 py-2 rounded-lg"
                onPress={handleMarkAllRead}
              >
                <Text className="text-sm font-semibold text-cyan-600">Mark all</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* TODAY Section */}
        {todayAlerts.length > 0 && (
          <View className="px-5 mb-5">
            <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">TODAY</Text>
            
            {todayAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                className={`bg-white rounded-2xl p-4 mb-4 shadow-sm border-l-4 ${alert.borderColor}`}
                onPress={() => handleAlertPress(alert)}
              >
                <View className="flex-row">
                  <View className={`w-12 h-12 rounded-xl ${alert.iconBg} justify-center items-center mr-3`}>
                    <MaterialCommunityIcons name={alert.icon} size={24} color={alert.iconColor} />
                  </View>
                  
                  <View className="flex-1">
                    <View className="flex-row justify-between items-start mb-2">
                      <Text className="text-base font-bold text-slate-800 flex-1">{alert.title}</Text>
                      <Text className="text-xs text-slate-400 ml-2">{alert.time}</Text>
                    </View>
                    
                    <Text className="text-sm text-slate-600 leading-5 mb-3">{alert.message}</Text>
                    
                    <View className={`self-start px-3 py-1 rounded-full ${alert.badgeBg}`}>
                      <Text className={`text-xs font-semibold ${alert.badgeText}`}>{alert.badge}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* YESTERDAY Section */}
        {yesterdayAlerts.length > 0 && (
          <View className="px-5 mb-8">
            <Text className="text-xs font-semibold text-slate-400 tracking-wider mb-4">YESTERDAY</Text>
            
            {yesterdayAlerts.map((alert) => (
              <TouchableOpacity
                key={alert.id}
                className={`bg-white rounded-2xl p-4 mb-4 shadow-sm border-l-4 ${alert.borderColor}`}
                onPress={() => handleAlertPress(alert)}
              >
                <View className="flex-row">
                  <View className={`w-12 h-12 rounded-xl ${alert.iconBg} justify-center items-center mr-3`}>
                    <MaterialIcons name={alert.icon} size={24} color={alert.iconColor} />
                  </View>
                  
                  <View className="flex-1">
                    <View className="flex-row justify-between items-start mb-2">
                      <Text className="text-base font-bold text-slate-400 flex-1">{alert.title}</Text>
                      <Text className="text-xs text-slate-400 ml-2">{alert.time}</Text>
                    </View>
                    
                    <Text className="text-sm text-slate-400 leading-5 mb-3">{alert.message}</Text>
                    
                    <View className={`self-start px-3 py-1 rounded-full ${alert.badgeBg}`}>
                      <Text className={`text-xs font-semibold ${alert.badgeText}`}>{alert.badge}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Empty State */}
        {alerts.length === 0 && (
          <View className="flex-1 justify-center items-center px-5 py-20">
            <MaterialIcons name="notifications-none" size={64} color="#CBD5E1" />
            <Text className="text-lg font-semibold text-slate-400 mt-4">No alerts</Text>
            <Text className="text-sm text-slate-400 text-center mt-2">
              You're all caught up! We'll notify you when something needs your attention.
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
};

export default AlertsScreen;
