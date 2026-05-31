import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://10.0.2.2:8000';

const TOKEN_KEY = '@water_quality_token';
const REFRESH_TOKEN_KEY = '@water_quality_refresh_token';

const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
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
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
        if (refreshToken) {
          const response = await axios.post(`${BASE_URL}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });

          const { access_token } = response.data;
          await AsyncStorage.setItem(TOKEN_KEY, access_token);

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
    const { access_token, refresh_token, user } = response.data;
    
    // Store access token
    if (access_token) {
      await AsyncStorage.setItem(TOKEN_KEY, access_token);
    }
    
    // Store refresh token only if it exists
    if (refresh_token) {
      await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    }
    
    return response.data;
  },

  logout: async () => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },

  refreshToken: async () => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    const response = await apiClient.post('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    const { access_token } = response.data;
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    return access_token;
  },
};

export const statusAPI = {
  getCurrentStatus: async () => {
    const response = await apiClient.get('/api/v1/current-status');
    return response.data;
  },
};

export const historicalDataAPI = {
  getHistoricalData: async (params) => {
    const response = await apiClient.get('/api/v1/historical-data', { params });
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

export const calibrationAPI = {
  calibrateSensor: async (data) => {
    const response = await apiClient.post('/api/v1/calibration', data);
    return response.data;
  },
};

export const healthAPI = {
  getHealth: async () => {
    const response = await apiClient.get('/api/v1/health');
    return response.data;
  },
};

export const fcmAPI = {
  registerToken: async (data) => {
    await apiClient.post('/api/v1/fcm/register', data);
  },

  unregisterToken: async (fcm_token) => {
    await apiClient.post('/api/v1/fcm/unregister', { fcm_token });
  },
};

export default apiClient;
