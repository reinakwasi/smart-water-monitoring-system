import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
  ScrollView,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API_BASE_URL = 'http://10.0.2.2:8000/api/v1';

const ExportDataScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [selectedDateRange, setSelectedDateRange] = useState('7days');
  const [loading, setLoading] = useState(false);
  
  const [includedData, setIncludedData] = useState({
    phReadings: true,
    turbidityTds: true,
    aiPredictions: true,
    tankHistory: true,
    alertLog: true,
  });

  const toggleDataInclusion = (key) => {
    setIncludedData({
      ...includedData,
      [key]: !includedData[key],
    });
  };

  const requestStoragePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        if (Platform.Version >= 33) {
          return true;
        }
        
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
          {
            title: 'Storage Permission',
            message: 'AquaGuard needs access to your storage to save exported files',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  const getDateRange = () => {
    const endDate = new Date();
    let startDate = new Date();
    
    if (selectedDateRange === '7days') {
      startDate.setDate(endDate.getDate() - 7);
    } else if (selectedDateRange === '30days') {
      startDate.setDate(endDate.getDate() - 30);
    } else {
      startDate.setFullYear(endDate.getFullYear() - 1);
    }
    
    return { startDate, endDate };
  };

  const fetchDataFromBackend = async () => {
    try {
      const token = await AsyncStorage.getItem('@water_quality_token');
      
      if (!token) {
        throw new Error('NO_TOKEN');
      }
      
      const { startDate, endDate } = getDateRange();
      
      const response = await axios.get(`${API_BASE_URL}/status/historical-data`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        params: {
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          parameter: 'all',
          limit: 1000
        },
        timeout: 30000
      });
      
      return response.data;
    } catch (error) {
      if (error.message === 'NO_TOKEN') {
        throw new Error('AUTHENTICATION_REQUIRED');
      }
      
      if (error.response) {
        if (error.response.status === 401) {
          throw new Error('TOKEN_EXPIRED');
        } else if (error.response.status === 400) {
          throw new Error('INVALID_REQUEST');
        } else if (error.response.status === 500) {
          throw new Error('SERVER_ERROR');
        }
      }
      
      if (error.code === 'ECONNABORTED') {
        throw new Error('TIMEOUT');
      }
      
      if (!error.response) {
        throw new Error('NETWORK_ERROR');
      }
      
      throw error;
    }
  };

  const generateCSV = (data) => {
    let csv = 'Timestamp,pH,Turbidity (NTU),TDS (ppm),Temperature (°C),Classification,Risk Score,Tank Level (%)\n';
    
    data.data.forEach(point => {
      const timestamp = new Date(point.timestamp).toLocaleString();
      const ph = point.parameters.ph || 'N/A';
      const turbidity = point.parameters.turbidity || 'N/A';
      const tds = point.parameters.tds || 'N/A';
      const temperature = point.parameters.temperature || 'N/A';
      const classification = point.classification || 'N/A';
      const riskScore = point.risk_score || 'N/A';
      const tankLevel = point.tank_level_percent || 'N/A';
      
      csv += `${timestamp},${ph},${turbidity},${tds},${temperature},${classification},${riskScore},${tankLevel}\n`;
    });
    
    return csv;
  };

  const generatePDFHTML = (data, userName, userEmail) => {
    const dateRangeName = selectedDateRange === '7days' ? 'Last 7 Days' : selectedDateRange === '30days' ? 'Last 30 Days' : 'All Time';
    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const generatedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    
    const avgPh = (data.data.reduce((sum, p) => sum + (p.parameters.ph || 0), 0) / data.data.length).toFixed(2);
    const avgTurbidity = (data.data.reduce((sum, p) => sum + (p.parameters.turbidity || 0), 0) / data.data.length).toFixed(2);
    const avgTds = Math.round(data.data.reduce((sum, p) => sum + (p.parameters.tds || 0), 0) / data.data.length);
    const avgTemp = (data.data.reduce((sum, p) => sum + (p.parameters.temperature || 0), 0) / data.data.length).toFixed(1);
    
    const safeCount = data.data.filter(p => p.classification === 'Safe').length;
    const unsafeCount = data.data.length - safeCount;
    const safePercentage = ((safeCount / data.data.length) * 100).toFixed(1);
    
    let dataRows = '';
    data.data.forEach((point, index) => {
      const timestamp = new Date(point.timestamp).toLocaleString('en-US', { 
        month: 'short', 
        day: 'numeric', 
        year: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
      const statusColor = point.classification === 'Safe' ? '#10b981' : '#ef4444';
      const statusBg = point.classification === 'Safe' ? '#d1fae5' : '#fee2e2';
      const statusText = point.classification === 'Safe' ? '#065f46' : '#991b1b';
      
      dataRows += `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #64748b;">${index + 1}</td>
          <td style="padding: 14px 12px; color: #1e293b; font-size: 13px;">${timestamp}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #0891b2;">${point.parameters.ph?.toFixed(2) || 'N/A'}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #0891b2;">${point.parameters.turbidity?.toFixed(2) || 'N/A'}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #0891b2;">${point.parameters.tds?.toFixed(0) || 'N/A'}</td>
          <td style="padding: 14px 12px; text-align: center; font-weight: 600; color: #0891b2;">${point.parameters.temperature?.toFixed(1) || 'N/A'}</td>
          <td style="padding: 14px 12px; text-align: center;">
            <span style="display: inline-block; padding: 6px 14px; border-radius: 20px; background: ${statusBg}; color: ${statusText}; font-weight: 700; font-size: 12px; border: 2px solid ${statusColor};">
              ${point.classification}
            </span>
          </td>
        </tr>
      `;
    });
    
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>AquaGuard Water Quality Report - ${dateRangeName}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 20px;
            color: #1e293b;
            line-height: 1.6;
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%);
            color: white;
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
          }
          .header::before {
            content: '';
            position: absolute;
            top: -50%;
            right: -50%;
            width: 200%;
            height: 200%;
            background: radial-gradient(circle, rgba(255,255,255,0.1) 0%, transparent 70%);
          }
          .header h1 {
            font-size: 36px;
            font-weight: 800;
            margin-bottom: 10px;
            position: relative;
            z-index: 1;
          }
          .header .subtitle {
            font-size: 16px;
            opacity: 0.95;
            font-weight: 500;
            position: relative;
            z-index: 1;
          }
          .header .date {
            margin-top: 15px;
            font-size: 14px;
            opacity: 0.9;
            position: relative;
            z-index: 1;
          }
          .content {
            padding: 30px;
          }
          .info-section {
            background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
            padding: 25px;
            border-radius: 15px;
            margin-bottom: 30px;
            border-left: 5px solid #0891b2;
          }
          .info-section h2 {
            color: #0891b2;
            font-size: 20px;
            margin-bottom: 20px;
            font-weight: 700;
          }
          .info-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
          }
          .info-item {
            background: white;
            padding: 15px;
            border-radius: 10px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .info-label {
            font-size: 11px;
            color: #64748b;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
          }
          .info-value {
            font-size: 18px;
            color: #1e293b;
            font-weight: 700;
          }
          .summary-cards {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
          }
          .summary-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
            padding: 25px;
            border-radius: 15px;
            text-align: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            border: 2px solid #e2e8f0;
            transition: transform 0.3s ease;
          }
          .summary-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.12);
          }
          .summary-card h3 {
            font-size: 13px;
            color: #64748b;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 12px;
          }
          .summary-card .value {
            font-size: 32px;
            font-weight: 800;
            color: #0891b2;
            margin-bottom: 5px;
          }
          .summary-card .unit {
            font-size: 14px;
            color: #94a3b8;
            font-weight: 600;
          }
          .status-card {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }
          .status-card .value {
            color: white;
          }
          .status-card .unit {
            color: rgba(255,255,255,0.9);
          }
          .section-title {
            color: #0891b2;
            font-size: 22px;
            margin-bottom: 20px;
            font-weight: 700;
            padding-bottom: 10px;
            border-bottom: 3px solid #0891b2;
          }
          .table-container {
            overflow-x: auto;
            border-radius: 15px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.08);
            margin-bottom: 30px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            background: white;
          }
          th {
            background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
            color: white;
            padding: 16px 12px;
            text-align: left;
            font-weight: 700;
            font-size: 13px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          th:first-child {
            border-top-left-radius: 15px;
          }
          th:last-child {
            border-top-right-radius: 15px;
          }
          td {
            padding: 14px 12px;
            font-size: 14px;
          }
          tr:nth-child(even) {
            background: #f8fafc;
          }
          tr:hover {
            background: #e0f2fe;
          }
          .footer {
            background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
            color: white;
            padding: 30px;
            text-align: center;
            margin-top: 40px;
          }
          .footer h3 {
            font-size: 20px;
            margin-bottom: 10px;
            font-weight: 700;
          }
          .footer p {
            font-size: 13px;
            opacity: 0.9;
            margin: 5px 0;
          }
          .footer .copyright {
            margin-top: 15px;
            padding-top: 15px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 12px;
            opacity: 0.8;
          }
          @media print {
            body { background: white; padding: 0; }
            .container { box-shadow: none; }
          }
          @media (max-width: 768px) {
            .header h1 { font-size: 28px; }
            .summary-cards { grid-template-columns: 1fr; }
            .info-grid { grid-template-columns: 1fr; }
            table { font-size: 12px; }
            th, td { padding: 10px 8px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🌊 AquaGuard Water Quality Report</h1>
            <div class="subtitle">Comprehensive Water Monitoring Analysis</div>
            <div class="date">Generated on ${generatedDate} at ${generatedTime}</div>
          </div>
          
          <div class="content">
            <div class="info-section">
              <h2>📋 Report Information</h2>
              <div class="info-grid">
                <div class="info-item">
                  <div class="info-label">User</div>
                  <div class="info-value">${userName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Email</div>
                  <div class="info-value">${userEmail}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Date Range</div>
                  <div class="info-value">${dateRangeName}</div>
                </div>
                <div class="info-item">
                  <div class="info-label">Total Readings</div>
                  <div class="info-value">${data.count} records</div>
                </div>
              </div>
            </div>
            
            <h2 class="section-title">📊 Summary Statistics</h2>
            <div class="summary-cards">
              <div class="summary-card">
                <h3>Average pH</h3>
                <div class="value">${avgPh}</div>
                <div class="unit">pH Level</div>
              </div>
              <div class="summary-card">
                <h3>Average Turbidity</h3>
                <div class="value">${avgTurbidity}</div>
                <div class="unit">NTU</div>
              </div>
              <div class="summary-card">
                <h3>Average TDS</h3>
                <div class="value">${avgTds}</div>
                <div class="unit">ppm</div>
              </div>
              <div class="summary-card">
                <h3>Average Temperature</h3>
                <div class="value">${avgTemp}</div>
                <div class="unit">°C</div>
              </div>
              <div class="summary-card status-card">
                <h3>Water Safety</h3>
                <div class="value">${safePercentage}%</div>
                <div class="unit">${safeCount} Safe / ${unsafeCount} Unsafe</div>
              </div>
            </div>
            
            <h2 class="section-title">📈 Detailed Water Quality Readings</h2>
            <div class="table-container">
              <table>
                <thead>
                  <tr>
                    <th style="text-align: center;">#</th>
                    <th>Timestamp</th>
                    <th style="text-align: center;">pH</th>
                    <th style="text-align: center;">Turbidity<br/>(NTU)</th>
                    <th style="text-align: center;">TDS<br/>(ppm)</th>
                    <th style="text-align: center;">Temp<br/>(°C)</th>
                    <th style="text-align: center;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  ${dataRows}
                </tbody>
              </table>
            </div>
          </div>
          
          <div class="footer">
            <h3>AquaGuard Water Quality Monitoring System</h3>
            <p>Advanced AI-Powered Water Analysis</p>
            <p>Real-time monitoring • Predictive analytics • Smart alerts</p>
            <div class="copyright">
              © 2025 AquaGuard. All rights reserved.<br/>
              This report was automatically generated by the AquaGuard system.
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  const handleExport = async () => {
    const selectedCount = Object.values(includedData).filter(v => v).length;
    
    if (selectedCount === 0) {
      Alert.alert('No Data Selected', 'Please select at least one data type to export');
      return;
    }

    setLoading(true);

    try {
      const data = await fetchDataFromBackend();
      
      if (!data || !data.data || data.data.length === 0) {
        Alert.alert('No Data', 'No data available for the selected date range');
        setLoading(false);
        return;
      }

      const userName = await AsyncStorage.getItem('@user_name') || 'User';
      const userEmail = await AsyncStorage.getItem('@user_email') || 'user@example.com';
      
      const dateRangeName = selectedDateRange === '7days' ? '7_Days' : selectedDateRange === '30days' ? '30_Days' : 'All_Time';
      const timestamp = new Date().getTime();
      
      const { dirs } = ReactNativeBlobUtil.fs;
      let fileName;
      let filePath;
      let fileContent;
      let mimeType;
      
      if (selectedFormat === 'csv') {
        fileContent = generateCSV(data);
        fileName = `AquaGuard_Report_${dateRangeName}_${timestamp}.csv`;
        mimeType = 'text/csv';
      } else {
        fileContent = generatePDFHTML(data, userName, userEmail);
        fileName = `AquaGuard_Report_${dateRangeName}_${timestamp}.html`;
        mimeType = 'text/html';
      }
      
      filePath = `${dirs.CacheDir}/${fileName}`;
      
      await ReactNativeBlobUtil.fs.writeFile(filePath, fileContent, 'utf8');
      
      if (Platform.OS === 'android') {
        const android = ReactNativeBlobUtil.android;
        
        try {
          await android.actionViewIntent(filePath, mimeType);
          
          Alert.alert(
            'Export Successful',
            selectedFormat === 'csv' 
              ? 'CSV file opened. You can save it from your app (Excel, Sheets, etc.)'
              : 'Report opened in browser. You can save it from the browser menu.',
            [{ text: 'OK' }]
          );
        } catch (viewError) {
          await Share.open({
            title: selectedFormat === 'csv' ? 'Save CSV Report' : 'Save HTML Report',
            message: `AquaGuard Water Quality Report - ${dateRangeName.replace('_', ' ')}`,
            url: `file://${filePath}`,
            type: mimeType,
            subject: 'AquaGuard Water Quality Report',
            filename: fileName,
          });
          
          Alert.alert(
            'Export Successful',
            'File created. Choose an app from the share menu to save or view it.',
            [{ text: 'OK' }]
          );
        }
      } else {
        await Share.open({
          title: selectedFormat === 'csv' ? 'Save CSV Report' : 'Save HTML Report',
          message: `AquaGuard Water Quality Report - ${dateRangeName.replace('_', ' ')}`,
          url: filePath,
          type: mimeType,
          subject: 'AquaGuard Water Quality Report',
          filename: fileName,
        });
        
        Alert.alert(
          'Export Successful',
          selectedFormat === 'csv'
            ? 'CSV file ready. Save it to Files or open with Numbers/Excel.'
            : 'Report ready. Save it to Files or open with Safari.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      let errorTitle = 'Export Failed';
      let errorMessage = 'Failed to export data. Please try again.';
      
      if (error.message === 'TOKEN_EXPIRED' || error.message === 'AUTHENTICATION_REQUIRED') {
        errorTitle = 'Session Expired';
        errorMessage = 'Your session has expired. Please log in again.';
        
        Alert.alert(errorTitle, errorMessage, [
          {
            text: 'Login',
            onPress: () => {
              AsyncStorage.multiRemove(['@water_quality_token', '@water_quality_refresh_token', '@user_email', '@user_name']);
              navigation.reset({
                index: 0,
                routes: [{ name: 'Login' }],
              });
            }
          }
        ]);
        setLoading(false);
        return;
      } else if (error.message === 'NETWORK_ERROR') {
        errorMessage = 'Cannot connect to server. Please check your internet connection.';
      } else if (error.message === 'TIMEOUT') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message === 'SERVER_ERROR') {
        errorMessage = 'Server error occurred. Please try again later.';
      } else if (error.message === 'INVALID_REQUEST') {
        errorMessage = 'Invalid request. Please check your date range selection.';
      } else if (error.message && error.message.includes('User did not share')) {
        setLoading(false);
        return;
      }
      
      Alert.alert(errorTitle, errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle={theme.colors.statusBar} backgroundColor={theme.colors.statusBarBg} />

      <View className="bg-[#0B7FA5] pt-12 pb-8 px-6 relative overflow-hidden">
        <View className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10" />
        
        <TouchableOpacity className="flex-row items-center mb-6" onPress={handleBack}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>

        <Text className="text-3xl font-bold text-white mb-2">Export Data</Text>
        <Text className="text-base text-cyan-100">Download your water readings</Text>
      </View>

      <ScrollView 
        className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8" 
        style={{ backgroundColor: theme.colors.background }} 
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        
        {/* Select Format Section */}
        <View className="mb-6">
          <Text className="text-xs font-semibold mb-4 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            SELECT FORMAT
          </Text>
          
          {/* PDF Report Option */}
          <TouchableOpacity 
            className="rounded-2xl p-4 mb-3 border-2 flex-row items-center"
            style={{ 
              backgroundColor: theme.colors.cardBackground,
              borderColor: selectedFormat === 'pdf' ? '#0891B2' : theme.colors.border
            }}
            onPress={() => setSelectedFormat('pdf')}
          >
            <View className="w-12 h-12 rounded-xl bg-blue-100 justify-center items-center mr-3">
              <MaterialCommunityIcons name="file-pdf-box" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold mb-0.5" style={{ color: theme.colors.text }}>
                PDF Report
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Formatted report with charts & analysis
              </Text>
            </View>
            <View className={`w-6 h-6 rounded-full border-2 justify-center items-center ${selectedFormat === 'pdf' ? 'bg-[#0891B2] border-[#0891B2]' : 'border-slate-300'}`}>
              {selectedFormat === 'pdf' && (
                <View className="w-3 h-3 rounded-full bg-white" />
              )}
            </View>
          </TouchableOpacity>

          {/* CSV Spreadsheet Option */}
          <TouchableOpacity 
            className="rounded-2xl p-4 border-2 flex-row items-center"
            style={{ 
              backgroundColor: theme.colors.cardBackground,
              borderColor: selectedFormat === 'csv' ? '#0891B2' : theme.colors.border
            }}
            onPress={() => setSelectedFormat('csv')}
          >
            <View className="w-12 h-12 rounded-xl bg-green-100 justify-center items-center mr-3">
              <MaterialCommunityIcons name="file-table-outline" size={24} color="#10B981" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold mb-0.5" style={{ color: theme.colors.text }}>
                CSV Spreadsheet
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Raw data for Excel or Google Sheets
              </Text>
            </View>
            <View className={`w-6 h-6 rounded-full border-2 justify-center items-center ${selectedFormat === 'csv' ? 'bg-[#0891B2] border-[#0891B2]' : 'border-slate-300'}`}>
              {selectedFormat === 'csv' && (
                <View className="w-3 h-3 rounded-full bg-white" />
              )}
            </View>
          </TouchableOpacity>
        </View>

        {/* Date Range Section */}
        <View className="mb-6">
          <Text className="text-xs font-semibold mb-4 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            DATE RANGE
          </Text>
          
          <View className="flex-row justify-between">
            <TouchableOpacity 
              className="flex-1 rounded-xl py-3 mr-2 border-2"
              style={{ 
                backgroundColor: selectedDateRange === '7days' ? '#0891B2' : theme.colors.cardBackground,
                borderColor: selectedDateRange === '7days' ? '#0891B2' : theme.colors.border
              }}
              onPress={() => setSelectedDateRange('7days')}
            >
              <Text className={`text-center text-sm font-bold ${selectedDateRange === '7days' ? 'text-white' : ''}`} style={{ color: selectedDateRange === '7days' ? '#FFFFFF' : theme.colors.text }}>
                7 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 rounded-xl py-3 mx-2 border-2"
              style={{ 
                backgroundColor: selectedDateRange === '30days' ? '#0891B2' : theme.colors.cardBackground,
                borderColor: selectedDateRange === '30days' ? '#0891B2' : theme.colors.border
              }}
              onPress={() => setSelectedDateRange('30days')}
            >
              <Text className={`text-center text-sm font-bold ${selectedDateRange === '30days' ? 'text-white' : ''}`} style={{ color: selectedDateRange === '30days' ? '#FFFFFF' : theme.colors.text }}>
                30 Days
              </Text>
            </TouchableOpacity>

            <TouchableOpacity 
              className="flex-1 rounded-xl py-3 ml-2 border-2"
              style={{ 
                backgroundColor: selectedDateRange === 'all' ? '#0891B2' : theme.colors.cardBackground,
                borderColor: selectedDateRange === 'all' ? '#0891B2' : theme.colors.border
              }}
              onPress={() => setSelectedDateRange('all')}
            >
              <Text className={`text-center text-sm font-bold ${selectedDateRange === 'all' ? 'text-white' : ''}`} style={{ color: selectedDateRange === 'all' ? '#FFFFFF' : theme.colors.text }}>
                All Time
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* What's Included Section */}
        <View className="mb-6">
          <Text className="text-xs font-semibold mb-4 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            WHAT'S INCLUDED
          </Text>
          
          <View className="rounded-2xl p-4" style={{ backgroundColor: theme.colors.cardBackground }}>
            {/* pH Readings */}
            <TouchableOpacity 
              className="flex-row items-center py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
              onPress={() => toggleDataInclusion('phReadings')}
            >
              <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${includedData.phReadings ? 'bg-green-100' : 'bg-slate-100'}`}>
                {includedData.phReadings ? (
                  <MaterialIcons name="check" size={20} color="#10B981" />
                ) : (
                  <View className="w-5 h-5 rounded border-2 border-slate-300" />
                )}
              </View>
              <Text className="flex-1 text-base font-semibold" style={{ color: theme.colors.text }}>
                pH readings
              </Text>
            </TouchableOpacity>

            {/* Turbidity & TDS */}
            <TouchableOpacity 
              className="flex-row items-center py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
              onPress={() => toggleDataInclusion('turbidityTds')}
            >
              <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${includedData.turbidityTds ? 'bg-green-100' : 'bg-slate-100'}`}>
                {includedData.turbidityTds ? (
                  <MaterialIcons name="check" size={20} color="#10B981" />
                ) : (
                  <View className="w-5 h-5 rounded border-2 border-slate-300" />
                )}
              </View>
              <Text className="flex-1 text-base font-semibold" style={{ color: theme.colors.text }}>
                Turbidity & TDS data
              </Text>
            </TouchableOpacity>

            {/* AI Safety Predictions */}
            <TouchableOpacity 
              className="flex-row items-center py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
              onPress={() => toggleDataInclusion('aiPredictions')}
            >
              <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${includedData.aiPredictions ? 'bg-green-100' : 'bg-slate-100'}`}>
                {includedData.aiPredictions ? (
                  <MaterialIcons name="check" size={20} color="#10B981" />
                ) : (
                  <View className="w-5 h-5 rounded border-2 border-slate-300" />
                )}
              </View>
              <Text className="flex-1 text-base font-semibold" style={{ color: theme.colors.text }}>
                AI safety predictions
              </Text>
            </TouchableOpacity>

            {/* Tank Level History */}
            <TouchableOpacity 
              className="flex-row items-center py-3"
              style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
              onPress={() => toggleDataInclusion('tankHistory')}
            >
              <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${includedData.tankHistory ? 'bg-green-100' : 'bg-slate-100'}`}>
                {includedData.tankHistory ? (
                  <MaterialIcons name="check" size={20} color="#10B981" />
                ) : (
                  <View className="w-5 h-5 rounded border-2 border-slate-300" />
                )}
              </View>
              <Text className="flex-1 text-base font-semibold" style={{ color: theme.colors.text }}>
                Tank level history
              </Text>
            </TouchableOpacity>

            {/* Alert & Notification Log */}
            <TouchableOpacity 
              className="flex-row items-center py-3"
              onPress={() => toggleDataInclusion('alertLog')}
            >
              <View className={`w-10 h-10 rounded-xl justify-center items-center mr-3 ${includedData.alertLog ? 'bg-green-100' : 'bg-slate-100'}`}>
                {includedData.alertLog ? (
                  <MaterialIcons name="check" size={20} color="#10B981" />
                ) : (
                  <View className="w-5 h-5 rounded border-2 border-slate-300" />
                )}
              </View>
              <Text className="flex-1 text-base font-semibold" style={{ color: theme.colors.text }}>
                Alert & notification log
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Export Button at Bottom */}
      <View className="px-6 pb-6 pt-4" style={{ backgroundColor: theme.colors.background }}>
        <TouchableOpacity 
          className={`rounded-xl h-14 justify-center items-center flex-row ${loading ? 'bg-slate-400' : 'bg-[#0891B2]'}`}
          onPress={handleExport}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <MaterialIcons name="file-download" size={20} color="#FFFFFF" />
              <Text className="text-white text-base font-bold ml-2">Export Now</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ExportDataScreen;
