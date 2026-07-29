import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Platform,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Share from 'react-native-share';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { historicalDataAPI } from '../services/api';
import { showAppAlert } from '../utils/alertHelper';
import { generateCSVContent, generateReviewReportHTML } from '../utils/exportReport';

const ExportDataScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [selectedFormat, setSelectedFormat] = useState('pdf');
  const [selectedDateRange, setSelectedDateRange] = useState('7days');
  const [loading, setLoading] = useState(false);

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
      const { startDate, endDate } = getDateRange();
      return await historicalDataAPI.getHistoricalData({
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        parameter: 'all',
        limit: 1000,
      });
    } catch (error) {
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

  const generateCSV = data => generateCSVContent(data);

  const generatePDFHTML = (data, userName, userEmail) => generateReviewReportHTML(data, userName, userEmail, selectedDateRange);

  const handleExport = async () => {
    setLoading(true);

    try {
      const data = await fetchDataFromBackend();

      if (!data || !data.data || data.data.length === 0) {
        showAppAlert('No data', 'No data available for the selected date range.', [], 'info');
        setLoading(false);
        return;
      }

      const userName = await AsyncStorage.getItem('@user_name') || 'User';
      const userEmail = await AsyncStorage.getItem('@user_email') || 'Not available';

      const dateRangeName = selectedDateRange === '7days' ? '7_Days' : selectedDateRange === '30days' ? '30_Days' : '12_Months';
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

          showAppAlert('Export successful', selectedFormat === 'csv' ? 'CSV file opened. You can save it from your app, such as Excel or Sheets.' : 'Report opened in browser. You can save it from the browser menu.', [], 'success');
        } catch (viewError) {
          await Share.open({
            title: selectedFormat === 'csv' ? 'Save CSV Report' : 'Save HTML Report',
            message: `AquaGuard Water Quality Report - ${dateRangeName.replace('_', ' ')}`,
            url: `file://${filePath}`,
            type: mimeType,
            subject: 'AquaGuard Water Quality Report',
            filename: fileName,
          });

          showAppAlert('Export successful', 'File created. Choose an app from the share menu to save or view it.', [], 'success');
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

        showAppAlert('Export successful', selectedFormat === 'csv' ? 'CSV file ready. Save it to Files or open with Numbers or Excel.' : 'Report ready. Save it to Files or open with Safari.', [], 'success');
      }
    } catch (error) {
      let errorTitle = 'Export not completed';
      let errorMessage = 'The export could not be created. Please try again.';

      if (error.message === 'TOKEN_EXPIRED' || error.message === 'AUTHENTICATION_REQUIRED') {
        errorTitle = 'Session Expired';
        errorMessage = 'Your session has expired. Please log in again.';

        showAppAlert(errorTitle, errorMessage, [{ text: 'Login', onPress: () => { AsyncStorage.multiRemove(['@water_quality_token', '@water_quality_refresh_token', '@user_email', '@user_name']); navigation.reset({ index: 0, routes: [{ name: 'Login' }] }); } }], 'warning');
        setLoading(false);
        return;
      } else if (error.message === 'NETWORK_ERROR') {
        errorMessage = 'Cannot connect right now. Please check your internet connection.';
      } else if (error.message === 'TIMEOUT') {
        errorMessage = 'Request timed out. Please try again.';
      } else if (error.message === 'SERVER_ERROR') {
        errorMessage = 'Something went wrong. Please try again later.';
      } else if (error.message === 'INVALID_REQUEST') {
        errorMessage = 'Invalid request. Please check your date range selection.';
      } else if (error.message && error.message.includes('User did not share')) {
        setLoading(false);
        return;
      }

      showAppAlert(errorTitle, errorMessage, [], 'error');
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

        <Text className="text-3xl font-bold text-white mb-2">Export data</Text>
        <Text className="text-base text-cyan-100">Create a report from saved water readings</Text>
      </View>

      <ScrollView
        className="flex-1 rounded-t-3xl -mt-5 px-6 pt-8"
        style={{ backgroundColor: theme.colors.background }}
        showsVerticalScrollIndicator={false}
        bounces={false}
        contentContainerStyle={{ paddingBottom: 20 }}
      >

        <View
          className="rounded-2xl p-4 mb-6 border"
          style={{ backgroundColor: theme.colors.cardBackground, borderColor: theme.colors.border }}
        >
          <View className="flex-row items-start">
            <View className="w-10 h-10 rounded-xl bg-cyan-100 justify-center items-center mr-3">
              <MaterialCommunityIcons name="clipboard-text-outline" size={22} color="#0891B2" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold mb-1" style={{ color: theme.colors.text }}>
                Review-ready export
              </Text>
              <Text className="text-sm leading-5" style={{ color: theme.colors.textSecondary }}>
                Includes pH, turbidity, TDS, temperature, tank level, risk score, result, and a simple note for each reading.
              </Text>
              <Text className="text-xs leading-5 mt-2" style={{ color: theme.colors.textTertiary || theme.colors.textSecondary }}>
                Useful for supervisor review, project demonstration, and water-condition discussion.
              </Text>
            </View>
          </View>
        </View>

        {/* Select Format Section */}
        <View className="mb-6">
          <Text className="text-xs font-semibold mb-4 tracking-wider" style={{ color: theme.colors.textSecondary }}>
            SELECT FORMAT
          </Text>

          {/* Formatted report option */}
          <TouchableOpacity
            className="rounded-2xl p-4 mb-3 border-2 flex-row items-center"
            style={{
              backgroundColor: theme.colors.cardBackground,
              borderColor: selectedFormat === 'pdf' ? '#0891B2' : theme.colors.border
            }}
            onPress={() => setSelectedFormat('pdf')}
          >
            <View className="w-12 h-12 rounded-xl bg-blue-100 justify-center items-center mr-3">
              <MaterialCommunityIcons name="file-document-outline" size={24} color="#3B82F6" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold mb-0.5" style={{ color: theme.colors.text }}>
                Review report
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Printable report with plain summary and full readings
              </Text>
            </View>
            <View className={`w-6 h-6 rounded-full border-2 justify-center items-center ${selectedFormat === 'pdf' ? 'bg-[#0891B2] border-[#0891B2]' : 'border-slate-300'}`}>
              {selectedFormat === 'pdf' && (
                <View className="w-3 h-3 rounded-full bg-white" />
              )}
            </View>
          </TouchableOpacity>

          {/* CSV spreadsheet Option */}
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
                CSV spreadsheet
              </Text>
              <Text className="text-xs" style={{ color: theme.colors.textSecondary }}>
                Clean spreadsheet for Excel, Sheets, or further review
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
                12 Months
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
              <Text className="text-white text-base font-bold ml-2">Create export</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ExportDataScreen;
