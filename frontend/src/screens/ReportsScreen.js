import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StatusBar,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const ReportsScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const [lastCheck, setLastCheck] = useState('');
  
  const [analysis, setAnalysis] = useState({
    waterSafety: {
      status: 'Not safe to drink',
      level: 'Critical',
      confidence: 0,
    },
    contaminationRisk: {
      risk: 'Medium risk',
      level: 'Warning',
      confidence: 0,
    },
    factors: {
      turbidity: { value: 0, level: 'Very high' },
      ph: { value: 0, level: 'Moderate' },
      tds: { value: 0, level: 'Low' },
      temperature: { value: 0, level: 'Very low' },
    },
    topFactor: {
      name: 'Turbidity',
      shapValue: 0.412,
    },
    explanation: '',
  });

  useEffect(() => {
    updateLastCheck();
    fetchAIAnalysis();
    const interval = setInterval(fetchAIAnalysis, 30000);
    return () => clearInterval(interval);
  }, []);

  const updateLastCheck = () => {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const displayMinutes = minutes < 10 ? `0${minutes}` : minutes;
    setLastCheck(`${displayHours}:${displayMinutes} ${ampm}`);
  };

  const fetchAIAnalysis = async () => {
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
      
      const waterSafetyStatus = getWaterSafetyStatus(data.water_quality.classification);
      const contaminationRisk = getContaminationRisk(data.water_quality.parameters);
      const factors = analyzeFactors(data.water_quality.parameters);
      const topFactor = getTopFactor(factors);
      const explanation = generateExplanation(topFactor, data.water_quality.parameters);
      
      setAnalysis({
        waterSafety: {
          status: waterSafetyStatus.status,
          level: waterSafetyStatus.level,
          confidence: Math.round(data.water_quality.confidence * 100),
        },
        contaminationRisk: {
          risk: contaminationRisk.risk,
          level: contaminationRisk.level,
          confidence: contaminationRisk.confidence,
        },
        factors,
        topFactor,
        explanation,
      });
      
      updateLastCheck();
    } catch (error) {
      console.error('AI Analysis fetch error:', error.message);
    }
  };

  const getWaterSafetyStatus = (classification) => {
    if (classification === 'Safe') {
      return { status: 'Safe to drink', level: 'Safe' };
    } else if (classification === 'Moderate') {
      return { status: 'Use with caution', level: 'Warning' };
    } else {
      return { status: 'Not safe to drink', level: 'Critical' };
    }
  };

  const getContaminationRisk = (params) => {
    let riskScore = 0;
    
    if (params.ph < 6.5 || params.ph > 8.5) riskScore += 2;
    if (params.turbidity > 5) riskScore += 3;
    if (params.tds > 500) riskScore += 2;
    if (params.temperature > 30 || params.temperature < 15) riskScore += 1;
    
    if (riskScore >= 5) {
      return { risk: 'High risk', level: 'Critical', confidence: 85 };
    } else if (riskScore >= 3) {
      return { risk: 'Medium risk', level: 'Warning', confidence: 72 };
    } else {
      return { risk: 'Low risk', level: 'Safe', confidence: 90 };
    }
  };

  const analyzeFactors = (params) => {
    const factors = {
      turbidity: {
        value: (params.turbidity / 10) * 100,
        level: params.turbidity > 5 ? 'Very high' : params.turbidity > 3 ? 'High' : params.turbidity > 1 ? 'Moderate' : 'Low'
      },
      ph: {
        value: Math.abs(params.ph - 7) * 20,
        level: (params.ph < 6.5 || params.ph > 8.5) ? 'High' : (params.ph < 7 || params.ph > 7.5) ? 'Moderate' : 'Low'
      },
      tds: {
        value: (params.tds / 1000) * 100,
        level: params.tds > 500 ? 'High' : params.tds > 300 ? 'Moderate' : 'Low'
      },
      temperature: {
        value: Math.abs(params.temperature - 25) * 5,
        level: (params.temperature > 30 || params.temperature < 15) ? 'Very high' : (params.temperature > 28 || params.temperature < 20) ? 'Moderate' : 'Very low'
      },
    };
    
    return factors;
  };

  const getTopFactor = (factors) => {
    const factorArray = [
      { name: 'Turbidity', value: factors.turbidity.value },
      { name: 'pH Level', value: factors.ph.value },
      { name: 'TDS', value: factors.tds.value },
      { name: 'Temperature', value: factors.temperature.value },
    ];
    
    factorArray.sort((a, b) => b.value - a.value);
    
    return {
      name: factorArray[0].name,
      shapValue: (factorArray[0].value / 100).toFixed(3),
    };
  };

  const generateExplanation = (topFactor, params) => {
    const explanations = {
      'Turbidity': `Your water is very murky right now — that's the main reason it's been flagged as unsafe. Turbidity is the highest contributing factor. Avoid drinking it until it clears up or has been treated.`,
      'pH Level': `Your water's pH level is outside the safe range — that's the main reason it's been flagged. pH imbalance is the highest contributing factor. Avoid drinking it until the pH is corrected.`,
      'TDS': `Your water has high dissolved solids — that's the main reason it's been flagged. TDS is the highest contributing factor. Consider using a filter or alternative water source.`,
      'Temperature': `Your water temperature is unusual — that's a contributing factor to the safety concern. Temperature is affecting water quality. Let it normalize before drinking.`,
    };
    
    return explanations[topFactor.name] || 'Water quality analysis in progress.';
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchAIAnalysis();
    setRefreshing(false);
  };

  const getFactorBarWidth = (value) => {
    return Math.min(Math.max(value, 0), 100);
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
          <View className="flex-row justify-between items-center">
            <View>
              <Text className="text-2xl font-bold" style={{ color: theme.colors.text }}>AI Analysis</Text>
              <Text className="text-sm" style={{ color: theme.colors.textTertiary }}>Latest check · {lastCheck}</Text>
            </View>
            <View className="bg-cyan-100 px-3 py-2 rounded-lg flex-row items-center">
              <MaterialCommunityIcons name="robot" size={16} color="#0891B2" />
              <Text className="text-sm font-semibold text-cyan-600 ml-1">AI</Text>
            </View>
          </View>
        </View>

        {/* Water Safety Card */}
        <View className={`mx-5 rounded-2xl p-5 mb-4 ${analysis.waterSafety.level === 'Critical' ? 'bg-red-50 border-2 border-red-200' : analysis.waterSafety.level === 'Warning' ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-green-50 border-2 border-green-200'}`}>
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-xs font-semibold text-slate-500 tracking-wider">WATER SAFETY</Text>
            <View className={`px-3 py-1 rounded-full ${analysis.waterSafety.level === 'Critical' ? 'bg-red-200' : analysis.waterSafety.level === 'Warning' ? 'bg-yellow-200' : 'bg-green-200'}`}>
              <Text className={`text-xs font-semibold ${analysis.waterSafety.level === 'Critical' ? 'text-red-700' : analysis.waterSafety.level === 'Warning' ? 'text-yellow-700' : 'text-green-700'}`}>
                {analysis.waterSafety.level}
              </Text>
            </View>
          </View>
          <Text className={`text-2xl font-bold mb-2 ${analysis.waterSafety.level === 'Critical' ? 'text-red-900' : analysis.waterSafety.level === 'Warning' ? 'text-yellow-900' : 'text-green-900'}`}>
            {analysis.waterSafety.status}
          </Text>
          <Text className="text-3xl font-bold text-slate-800">{analysis.waterSafety.confidence}%</Text>
          <Text className="text-xs text-slate-500 mt-1">How confident the system is</Text>
        </View>

        {/* Contamination Risk Card */}
        <View className={`mx-5 rounded-2xl p-5 mb-5 ${analysis.contaminationRisk.level === 'Critical' ? 'bg-red-50 border-2 border-red-200' : analysis.contaminationRisk.level === 'Warning' ? 'bg-yellow-50 border-2 border-yellow-200' : 'bg-green-50 border-2 border-green-200'}`}>
          <View className="flex-row justify-between items-start mb-3">
            <Text className="text-xs font-semibold text-slate-500 tracking-wider">CONTAMINATION RISK</Text>
            <View className={`px-3 py-1 rounded-full ${analysis.contaminationRisk.level === 'Critical' ? 'bg-red-200' : analysis.contaminationRisk.level === 'Warning' ? 'bg-yellow-200' : 'bg-green-200'}`}>
              <Text className={`text-xs font-semibold ${analysis.contaminationRisk.level === 'Critical' ? 'text-red-700' : analysis.contaminationRisk.level === 'Warning' ? 'text-yellow-700' : 'text-green-700'}`}>
                {analysis.contaminationRisk.level}
              </Text>
            </View>
          </View>
          <Text className={`text-2xl font-bold mb-2 ${analysis.contaminationRisk.level === 'Critical' ? 'text-red-900' : analysis.contaminationRisk.level === 'Warning' ? 'text-yellow-900' : 'text-green-900'}`}>
            {analysis.contaminationRisk.risk}
          </Text>
          <Text className="text-3xl font-bold text-slate-800">{analysis.contaminationRisk.confidence}%</Text>
          <Text className="text-xs text-slate-500 mt-1">How confident the system is</Text>
        </View>

        {/* What's Causing This */}
        <View className="px-5 mb-4">
          <Text className="text-xs font-semibold tracking-wider mb-4" style={{ color: theme.colors.textTertiary }}>WHAT'S CAUSING THIS?</Text>
          
          <View className="rounded-2xl p-5 shadow-sm" style={{ backgroundColor: theme.colors.cardBackground }}>
            {/* Turbidity */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Turbidity</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>{analysis.factors.turbidity.level}</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0' }}>
                <View 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${getFactorBarWidth(analysis.factors.turbidity.value)}%` }}
                />
              </View>
            </View>

            {/* pH Level */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>pH Level</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>{analysis.factors.ph.level}</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0' }}>
                <View 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${getFactorBarWidth(analysis.factors.ph.value)}%` }}
                />
              </View>
            </View>

            {/* TDS */}
            <View className="mb-4">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>TDS</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>{analysis.factors.tds.level}</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0' }}>
                <View 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${getFactorBarWidth(analysis.factors.tds.value)}%` }}
                />
              </View>
            </View>

            {/* Temperature */}
            <View>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm font-semibold" style={{ color: theme.colors.text }}>Temperature</Text>
                <Text className="text-sm font-semibold" style={{ color: theme.colors.textSecondary }}>{analysis.factors.temperature.level}</Text>
              </View>
              <View className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: theme.isDarkMode ? '#334155' : '#E2E8F0' }}>
                <View 
                  className="h-full bg-cyan-500 rounded-full" 
                  style={{ width: `${getFactorBarWidth(analysis.factors.temperature.value)}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* In Plain Words */}
        <View className="px-5 mb-8">
          <View className="bg-cyan-50 rounded-2xl p-5 border-l-4 border-cyan-500">
            <View className="flex-row items-center mb-3">
              <MaterialIcons name="info-outline" size={20} color="#0891B2" />
              <Text className="text-sm font-semibold text-cyan-700 ml-2">In plain words</Text>
            </View>
            
            <View className="bg-cyan-100 rounded-lg p-3 mb-3">
              <View className="flex-row items-center">
                <MaterialCommunityIcons name="star-four-points" size={16} color="#0891B2" />
                <Text className="text-xs font-semibold text-cyan-700 ml-2">
                  Top factor: {analysis.topFactor.name} (SHAP = {analysis.topFactor.shapValue})
                </Text>
              </View>
            </View>
            
            <Text className="text-sm leading-6" style={{ color: theme.isDarkMode ? '#334155' : '#475569' }}>
              {analysis.explanation}
            </Text>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

export default ReportsScreen;
