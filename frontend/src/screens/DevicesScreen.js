import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useTheme } from '../context/ThemeContext';
import { deviceAPI } from '../services/api';
import { formatTimeSinceUpdate, isDeviceConnected } from '../utils/homeStatus';
import { showAppAlert } from '../utils/alertHelper';

const DevicesScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deviceId, setDeviceId] = useState('ESP32_001');
  const [deviceName, setDeviceName] = useState('AquaGuard Sensor Hub');
  const [location, setLocation] = useState('');

  const loadDevices = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    try {
      const response = await deviceAPI.listDevices();
      setDevices(response.devices || []);
      setError('');
    } catch (requestError) {
      setError('Registered devices could not be loaded. Check your connection and try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDevices();
    const unsubscribe = navigation.addListener('focus', () => loadDevices(false));
    return unsubscribe;
  }, [loadDevices, navigation]);

  const hasRegisteredDevice = devices.length > 0;

  const handleRefresh = () => {
    setRefreshing(true);
    loadDevices(false);
  };

  const handleRegister = async () => {
    if (hasRegisteredDevice) {
      showAppAlert('Sensor hub already added', 'This account already has a sensor hub. Remove the current one before adding another.', [], 'warning');
      return;
    }

    const cleanId = deviceId.trim();
    const cleanName = deviceName.trim();
    if (!cleanId || !cleanName) {
      showAppAlert('Details required', 'Enter the device ID and a device name.', [], 'warning');
      return;
    }
    if (!/^[A-Za-z0-9_-]+$/.test(cleanId)) {
      showAppAlert('Invalid device ID', 'Use only letters, numbers, underscores or hyphens.', [], 'warning');
      return;
    }

    setSubmitting(true);
    try {
      await deviceAPI.registerDevice({
        device_id: cleanId,
        device_name: cleanName,
        location: location.trim() || null,
      });
      setShowForm(false);
      await loadDevices(false);
      showAppAlert(
        'Sensor hub added',
        'Readings from this device ID will now be linked to this account.',
        [],
        'success',
      );
    } catch (requestError) {
      const detail = requestError.response?.data?.detail;
      showAppAlert('Registration failed', detail || 'The sensor hub could not be added. Please try again.', [], 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnregister = device => {
    showAppAlert(
      'Remove this sensor hub?',
      `${device.device_name} will no longer send readings to this account.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              await deviceAPI.unregisterDevice(device.device_id);
              await loadDevices(false);
            } catch (requestError) {
              showAppAlert('Device not removed', requestError.response?.data?.detail || 'Please try again.', [], 'error');
            }
          },
        },
      ],
      'warning',
    );
  };

  return (
    <View className="flex-1" style={{ backgroundColor: theme.colors.background }}>
      <StatusBar barStyle="light-content" backgroundColor="#0B7FA5" />

      <View className="bg-[#0B7FA5] pt-12 pb-7 px-5 relative overflow-hidden">
        <View className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-white/10" />
        <TouchableOpacity className="flex-row items-center mb-5" onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={23} color="#FFFFFF" />
          <Text className="text-white text-base ml-2 font-medium">Back</Text>
        </TouchableOpacity>
        <Text className="text-3xl font-bold text-white">Devices</Text>
        <Text className="text-cyan-100 mt-1">Set up your water sensor hub</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#0891B2']} />}
        contentContainerStyle={{ paddingBottom: 32 }}
      >
        <View className="mx-5 mt-5 rounded-2xl p-4 border border-cyan-100" style={{ backgroundColor: theme.colors.cardBackground }}>
          <View className="flex-row items-start">
            <View className="w-11 h-11 rounded-xl bg-cyan-100 items-center justify-center mr-3">
              <MaterialCommunityIcons name="access-point" size={23} color="#0891B2" />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold" style={{ color: theme.colors.text }}>How readings are linked</Text>
              <Text className="text-sm leading-5 mt-1" style={{ color: theme.colors.textSecondary }}>
                One sensor hub can be linked to this account so its readings appear only for the right user.
              </Text>
            </View>
          </View>
        </View>

        <View className="px-5 mt-5 flex-row items-center justify-between">
          <View>
            <Text className="text-xs font-semibold tracking-wider" style={{ color: theme.colors.textTertiary }}>SENSOR HUB</Text>
            <Text className="text-sm mt-1" style={{ color: theme.colors.textSecondary }}>
              {devices.length} {devices.length === 1 ? 'sensor hub added' : 'sensor hubs added'}
            </Text>
          </View>
          {!hasRegisteredDevice && (
            <TouchableOpacity className="bg-[#0891B2] px-4 py-2.5 rounded-xl flex-row items-center" onPress={() => setShowForm(value => !value)}>
              <MaterialIcons name={showForm ? 'close' : 'add'} size={18} color="#FFFFFF" />
              <Text className="text-white text-sm font-bold ml-1">{showForm ? 'Close' : 'Add device'}</Text>
            </TouchableOpacity>
          )}
        </View>

        {showForm && !hasRegisteredDevice && (
          <View className="mx-5 mt-4 rounded-2xl p-4" style={{ backgroundColor: theme.colors.cardBackground }}>
            <Text className="text-lg font-bold mb-4" style={{ color: theme.colors.text }}>Add sensor hub</Text>
            <Text className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>DEVICE ID</Text>
            <TextInput
              className="rounded-xl px-4 h-14 mb-4 border"
              style={{ color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
              placeholder="ESP32_001"
              placeholderTextColor={theme.colors.textTertiary}
              value={deviceId}
              onChangeText={setDeviceId}
              autoCapitalize="characters"
              editable={!submitting}
            />
            <Text className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>DEVICE NAME</Text>
            <TextInput
              className="rounded-xl px-4 h-14 mb-4 border"
              style={{ color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
              placeholder="AquaGuard Sensor Hub"
              placeholderTextColor={theme.colors.textTertiary}
              value={deviceName}
              onChangeText={setDeviceName}
              editable={!submitting}
            />
            <Text className="text-xs font-semibold mb-2" style={{ color: theme.colors.textSecondary }}>LOCATION (OPTIONAL)</Text>
            <TextInput
              className="rounded-xl px-4 h-14 mb-5 border"
              style={{ color: theme.colors.text, backgroundColor: theme.colors.background, borderColor: theme.colors.border }}
              placeholder="Water tank area"
              placeholderTextColor={theme.colors.textTertiary}
              value={location}
              onChangeText={setLocation}
              editable={!submitting}
            />
            <TouchableOpacity className={`rounded-xl h-14 items-center justify-center ${submitting ? 'bg-slate-400' : 'bg-[#0891B2]'}`} onPress={handleRegister} disabled={submitting}>
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : <Text className="text-white font-bold">Add sensor hub</Text>}
            </TouchableOpacity>
          </View>
        )}

        {loading ? (
          <View className="items-center py-16"><ActivityIndicator size="large" color="#0891B2" /></View>
        ) : error ? (
          <View className="mx-5 mt-4 rounded-2xl p-4 bg-red-50 border border-red-200">
            <Text className="text-sm text-red-800 leading-5">{error}</Text>
            <TouchableOpacity className="self-start mt-3" onPress={() => loadDevices()}><Text className="text-sm font-bold text-red-700">Retry</Text></TouchableOpacity>
          </View>
        ) : !hasRegisteredDevice ? (
          <View className="mx-5 mt-4 rounded-2xl py-12 px-6 items-center" style={{ backgroundColor: theme.colors.cardBackground }}>
            <MaterialCommunityIcons name="chip" size={45} color={theme.colors.textTertiary} />
            <Text className="text-lg font-bold mt-3" style={{ color: theme.colors.text }}>No sensor hub added</Text>
            <Text className="text-sm text-center leading-5 mt-2" style={{ color: theme.colors.textSecondary }}>Add your sensor hub to start receiving water readings.</Text>
            <TouchableOpacity className="mt-5 bg-[#0891B2] px-5 py-3 rounded-xl flex-row items-center" onPress={() => setShowForm(true)} activeOpacity={0.86}>
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text className="text-white text-sm font-bold ml-1">Add device</Text>
            </TouchableOpacity>
          </View>
        ) : (
          devices.map(device => {
            const online = isDeviceConnected(device.last_communication);
            return (
              <View key={device.device_id} className="mx-5 mt-4 rounded-2xl p-4" style={{ backgroundColor: theme.colors.cardBackground }}>
                <View className="flex-row items-start">
                  <View className="w-12 h-12 rounded-xl bg-cyan-100 items-center justify-center mr-3">
                    <MaterialCommunityIcons name="chip" size={25} color="#0891B2" />
                  </View>
                  <View className="flex-1">
                    <Text className="text-base font-bold" style={{ color: theme.colors.text }}>{device.device_name}</Text>
                    <Text className="text-xs mt-1" style={{ color: theme.colors.textSecondary }}>{device.device_id}{device.location ? ` - ${device.location}` : ''}</Text>
                  </View>
                  <View className={`px-2.5 py-1 rounded-full ${online ? 'bg-green-100' : 'bg-slate-100'}`}>
                    <Text className={`text-xs font-bold ${online ? 'text-green-700' : 'text-slate-600'}`}>{online ? 'ONLINE' : 'OFFLINE'}</Text>
                  </View>
                </View>
                <View className="mt-4 pt-3 border-t flex-row justify-between" style={{ borderTopColor: theme.colors.border }}>
                  <View>
                    <Text className="text-xs" style={{ color: theme.colors.textTertiary }}>Last reading</Text>
                    <Text className="text-sm font-semibold mt-1" style={{ color: theme.colors.text }}>{formatTimeSinceUpdate(device.last_communication)}</Text>
                  </View>
                  <TouchableOpacity className="px-3 py-2 rounded-lg bg-red-50" onPress={() => handleUnregister(device)}>
                    <Text className="text-xs font-bold text-red-700">Remove</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
};

export default DevicesScreen;



