import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_FALLBACK_URLS } from '../config/api.config';

/**
 * @typedef {Object} ParameterClassifications
 * @property {string|null} ph - pH quality band (e.g., "Excellent", "Good", "Acidic/Unsafe")
 * @property {string|null} turbidity_index - Turbidity quality band (e.g., "Excellent", "Good", "Poor")
 * @property {string|null} temperature - Temperature monitoring band (e.g., "Cold", "Normal", "Warm")
 * @property {string|null} tds - TDS taste band (e.g., "Excellent", "Good", "Fair", "Poor", "Unacceptable")
 */

/**
 * @typedef {Object} WaterQualityParameters
 * @property {number} ph - pH value (0-14 scale)
 * @property {number} turbidity_index - Estimated turbidity in NTU
 * @property {number} temperature - Temperature in Celsius
 * @property {number} tds - Total Dissolved Solids in ppm
 */

/**
 * @typedef {Object} WaterQualityClassification
 * @property {string} classification - Overall water quality classification ("Safe", "Warning", "Unsafe")
 * @property {number} confidence - Classification confidence (0-1)
 */

/**
 * @typedef {Object} WaterQualityStatus
 * @property {string} classification - Overall water quality classification
 * @property {number} confidence - Classification confidence (0-1)
 * @property {WaterQualityParameters} parameters - Current sensor parameter values
 * @property {ParameterClassifications} parameter_classifications - Configured parameter classifications
 * @property {string} timestamp - ISO timestamp of the reading
 */

/**
 * @typedef {Object} SensorReading
 * @property {string} device_id - Device identifier
 * @property {string} timestamp - ISO timestamp
 * @property {number} ph - pH value
 * @property {number} turbidity_index - Estimated turbidity in NTU
 * @property {number} temperature - Temperature in Celsius
 * @property {number} tds - Total Dissolved Solids in ppm
 * @property {ParameterClassifications} parameter_classifications - Configured parameter classifications
 * @property {WaterQualityClassification} classification - Water quality classification
 * @property {Object} risk_prediction - Risk prediction data
 * @property {number} risk_prediction.risk_score - Risk score (0-1)
 * @property {string} risk_prediction.risk_level - Risk level ("Low", "Medium", "High")
 */

/**
 * @typedef {Object} HistoricalDataResponse
 * @property {SensorReading[]} data - Array of historical sensor readings
 * @property {number} count - Number of returned readings
 * @property {string} start_date - Start of the requested range
 * @property {string} end_date - End of the requested range
 */

// Automatic API Base URL - configured in ../config/api.config.js
// To change configuration:
// 1. For emulator: Leave as-is (uses 10.0.2.2 for Android, localhost for iOS)
// 2. For physical device: Set USE_PHYSICAL_DEVICE = true in api.config.js
// 3. Update PC_WIFI_IP in api.config.js when your IP changes
const BASE_URL = API_BASE_URL;

const isConnectionError = error => {
  return !error.response && (
    error.message === 'Network Error' ||
    error.code === 'ERR_NETWORK' ||
    error.code === 'ECONNABORTED'
  );
};

const getTriedBaseUrls = request => {
  const tried = request?._triedBaseUrls || [];
  const current = request?.baseURL || BASE_URL;
  return Array.from(new Set([current, ...tried].filter(Boolean)));
};

// Export AsyncStorage key constants for consistent usage across the app
export const TOKEN_KEY = '@water_quality_token';
export const REFRESH_TOKEN_KEY = '@water_quality_refresh_token';
export const USER_NAME_KEY = '@user_name';
export const USER_EMAIL_KEY = '@user_email';
export const USER_PROFILE_KEY = '@user_profile';

const storeAuthSession = async ({ access_token, refresh_token, user }) => {
  if (access_token) await AsyncStorage.setItem(TOKEN_KEY, access_token);
  if (refresh_token) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);

  if (user) {
    if (user.full_name) await AsyncStorage.setItem(USER_NAME_KEY, user.full_name);
    if (user.email) await AsyncStorage.setItem(USER_EMAIL_KEY, user.email);
    await AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(user));
  }
};

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await AsyncStorage.getItem(TOKEN_KEY);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

apiClient.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config || {};

    if (isConnectionError(error)) {
      const triedBaseUrls = getTriedBaseUrls(originalRequest);
      for (const nextBaseUrl of API_FALLBACK_URLS) {
        if (triedBaseUrls.includes(nextBaseUrl)) continue;

        try {
          return await apiClient({
            ...originalRequest,
            baseURL: nextBaseUrl,
            _triedBaseUrls: [...triedBaseUrls, nextBaseUrl],
          });
        } catch (retryError) {
          if (!isConnectionError(retryError)) return Promise.reject(retryError);
          triedBaseUrls.push(nextBaseUrl);
          error = retryError;
        }
      }
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const refreshBaseUrl = originalRequest.baseURL || BASE_URL;
          const response = await axios.post(`${refreshBaseUrl}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token, refresh_token } = response.data;
          await AsyncStorage.setItem(TOKEN_KEY, access_token);
          if (refresh_token) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);

          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export const authAPI = {
  register: async (data) => {
    const response = await apiClient.post('/api/v1/auth/register', data);
    return response.data;
  },

  verifyOTP: async (data) => {
    const response = await apiClient.post('/api/v1/auth/verify-otp', null, {
      params: data
    });
    return response.data;
  },

  resendOTP: async (data) => {
    const response = await apiClient.post('/api/v1/auth/resend-otp', null, {
      params: data
    });
    return response.data;
  },

  login: async (data) => {
    const response = await apiClient.post('/api/v1/auth/login', data);
    await storeAuthSession(response.data);
    return response.data;
  },

  logout: async () => {
    await AsyncStorage.multiRemove([
      TOKEN_KEY,
      REFRESH_TOKEN_KEY,
      USER_NAME_KEY,
      USER_EMAIL_KEY,
      USER_PROFILE_KEY,
    ]);
  },

  refreshToken: async () => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    const response = await apiClient.post('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    const { access_token, refresh_token } = response.data;
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    if (refresh_token) await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    return access_token;
  },

  forgotPassword: async (email) => {
    const response = await apiClient.post('/api/v1/auth/forgot-password', null, {
      params: { email }
    });
    return response.data;
  },

  resetPassword: async (email, token, newPassword) => {
    const response = await apiClient.post('/api/v1/auth/reset-password', null, {
      params: {
        email: email,
        token: token,
        new_password: newPassword
      }
    });
    return response.data;
  },

  getProfile: async () => {
    const response = await apiClient.get('/api/v1/auth/profile');
    const profile = response.data;
    await Promise.all([
      AsyncStorage.setItem(USER_NAME_KEY, profile.full_name || 'User'),
      AsyncStorage.setItem(USER_EMAIL_KEY, profile.email || ''),
      AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)),
    ]);
    return profile;
  },

  updateProfile: async (profileData) => {
    const response = await apiClient.put('/api/v1/auth/profile', profileData);
    const profile = response.data;
    await Promise.all([
      AsyncStorage.setItem(USER_NAME_KEY, profile.full_name || 'User'),
      AsyncStorage.setItem(USER_EMAIL_KEY, profile.email || ''),
      AsyncStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile)),
    ]);
    return profile;
  },

  changePassword: async (currentPassword, newPassword) => {
    const response = await apiClient.put('/api/v1/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return response.data;
  },

  getNotificationPreferences: async () => {
    const response = await apiClient.get('/api/v1/auth/notification-preferences');
    return response.data;
  },

  updateNotificationPreferences: async preferences => {
    const response = await apiClient.put('/api/v1/auth/notification-preferences', preferences);
    return response.data;
  },

  registerFCMToken: async token => {
    const response = await apiClient.put('/api/v1/auth/fcm-token', { token });
    return response.data;
  },
};

export const statusAPI = {
  /**
   * Get current water quality status with configured parameter classifications
   * @returns {Promise<{water_quality: WaterQualityStatus, tank_status: Object}>}
   */
  getCurrentStatus: async () => {
    const response = await apiClient.get('/api/v1/status/current-status');
    const data = response.data;

    // Ensure parameter_classifications is present in the response
    if (data.water_quality && !data.water_quality.parameter_classifications) {
      // Provide default structure if missing (for backward compatibility)
      data.water_quality.parameter_classifications = {
        ph: null,
        turbidity_index: null,
        temperature: null,
        tds: null,
      };
    }

    return data;
  },
};

export const historicalDataAPI = {
  getHistoricalData: async (params) => {
    const response = await apiClient.get('/api/v1/status/historical-data', { params });
    const data = response.data;

    // Ensure each reading has parameter_classifications
    if (data.data && Array.isArray(data.data)) {
      data.data = data.data.map(reading => {
        if (!reading.parameter_classifications) {
          reading.parameter_classifications = {
            ph: null,
            turbidity_index: null,
            temperature: null,
            tds: null,
          };
        }
        return reading;
      });
    }

    return data;
  },
};
export const alertAPI = {
  listAlerts: async (params = {}) => {
    const response = await apiClient.get('/api/v1/alerts', { params });
    return response.data;
  },

  markRead: async alertId => {
    const response = await apiClient.patch(`/api/v1/alerts/${encodeURIComponent(alertId)}/read`);
    return response.data;
  },

  markAllRead: async () => {
    const response = await apiClient.patch('/api/v1/alerts/read-all');
    return response.data;
  },
};


export const deviceAPI = {
  listDevices: async () => {
    const response = await apiClient.get('/api/v1/devices/list');
    return response.data;
  },

  registerDevice: async data => {
    const response = await apiClient.post('/api/v1/devices/register', data);
    return response.data;
  },

  unregisterDevice: async deviceId => {
    const response = await apiClient.delete(`/api/v1/devices/${encodeURIComponent(deviceId)}/unregister`);
    return response.data;
  },

  regenerateKey: async deviceId => {
    const response = await apiClient.post(`/api/v1/devices/${encodeURIComponent(deviceId)}/regenerate-key`);
    return response.data;
  },

  updateDevice: async (deviceId, data) => {
    const response = await apiClient.patch(`/api/v1/devices/${encodeURIComponent(deviceId)}/config`, data);
    return response.data;
  },
};


export const configAPI = {
  getConfig: async () => {
    const response = await apiClient.get('/api/v1/config');
    return response.data;
  },

  updateConfig: async (config) => {
    const response = await apiClient.put('/api/v1/config', config);
    return response.data;
  },
};

export const healthAPI = { getHealth: async () => (await apiClient.get('/api/v1/health')).data };
export default apiClient;
