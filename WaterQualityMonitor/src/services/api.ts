import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Backend base URL - Update this with your actual backend URL
const BASE_URL = 'http://10.0.2.2:8000'; // For Android emulator (localhost on host machine)
// const BASE_URL = 'http://localhost:8000'; // For iOS simulator
// const BASE_URL = 'https://your-backend-url.com'; // For production

// Storage keys
const TOKEN_KEY = '@water_quality_token';
const REFRESH_TOKEN_KEY = '@water_quality_refresh_token';

/**
 * Axios instance with interceptors for JWT authentication
 */
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * Request interceptor to add JWT token to headers
 */
apiClient.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
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

/**
 * Response interceptor to handle token refresh
 */
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and not already retried, try to refresh token
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

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
        // TODO: Navigate to login screen
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

// ============================================================================
// Authentication API
// ============================================================================

export interface RegisterRequest {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: {
    id: string;
    email: string;
    full_name: string;
    role: string;
  };
}

export const authAPI = {
  register: async (data: RegisterRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/api/v1/auth/register', data);
    return response.data;
  },

  login: async (data: LoginRequest): Promise<AuthResponse> => {
    const response = await apiClient.post('/api/v1/auth/login', data);
    const { access_token, refresh_token } = response.data;
    
    // Store tokens
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    await AsyncStorage.setItem(REFRESH_TOKEN_KEY, refresh_token);
    
    return response.data;
  },

  logout: async (): Promise<void> => {
    await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
  },

  refreshToken: async (): Promise<string> => {
    const refreshToken = await AsyncStorage.getItem(REFRESH_TOKEN_KEY);
    const response = await apiClient.post('/api/v1/auth/refresh', {
      refresh_token: refreshToken,
    });
    const { access_token } = response.data;
    await AsyncStorage.setItem(TOKEN_KEY, access_token);
    return access_token;
  },
};

// ============================================================================
// Status API
// ============================================================================

export interface CurrentStatusResponse {
  water_quality: {
    classification: 'Safe' | 'Warning' | 'Unsafe';
    confidence: number;
    sensor_readings: {
      ph: number;
      turbidity: number;
      temperature: number;
      tds: number;
      dissolved_oxygen: number;
    };
    timestamp: string;
  };
  contamination_risk: {
    risk_score: number;
    risk_level: 'Low' | 'Medium' | 'High';
    top_factors: Array<{
      feature: string;
      shap_value: number;
      direction: 'positive' | 'negative';
    }>;
  };
  tank_status: {
    status: 'Empty' | 'Half_Full' | 'Full' | 'Overflow';
    level_percentage: number;
    volume_liters: number;
    timestamp: string;
  };
}

export const statusAPI = {
  getCurrentStatus: async (): Promise<CurrentStatusResponse> => {
    const response = await apiClient.get('/api/v1/current-status');
    return response.data;
  },
};

// ============================================================================
// Historical Data API
// ============================================================================

export interface HistoricalDataParams {
  start_date?: string; // ISO8601 format
  end_date?: string; // ISO8601 format
  parameter?: 'ph' | 'turbidity' | 'temperature' | 'tds' | 'dissolved_oxygen';
  device_id?: string;
  limit?: number;
}

export interface HistoricalDataResponse {
  readings: Array<{
    timestamp: string;
    sensor_readings: {
      ph: number;
      turbidity: number;
      temperature: number;
      tds: number;
      dissolved_oxygen: number;
    };
    classification: 'Safe' | 'Warning' | 'Unsafe';
    risk_score: number;
    risk_level: 'Low' | 'Medium' | 'High';
  }>;
  total_count: number;
}

export const historicalDataAPI = {
  getHistoricalData: async (params: HistoricalDataParams): Promise<HistoricalDataResponse> => {
    const response = await apiClient.get('/api/v1/historical-data', { params });
    return response.data;
  },
};

// ============================================================================
// Configuration API (Admin only)
// ============================================================================

export interface SystemConfig {
  classification_thresholds: {
    safe_confidence: number;
    warning_confidence: number;
  };
  risk_thresholds: {
    low_risk: number;
    medium_risk: number;
    high_risk: number;
  };
  sensor_polling_interval: number;
  tank_dimensions: {
    height_cm: number;
    radius_cm: number;
  };
}

export const configAPI = {
  getConfig: async (): Promise<SystemConfig> => {
    const response = await apiClient.get('/api/v1/config');
    return response.data;
  },

  updateConfig: async (config: Partial<SystemConfig>): Promise<SystemConfig> => {
    const response = await apiClient.put('/api/v1/config', config);
    return response.data;
  },
};

// ============================================================================
// Calibration API (Admin only)
// ============================================================================

export interface CalibrationRequest {
  device_id: string;
  sensor_type: 'ph' | 'turbidity' | 'temperature' | 'tds' | 'dissolved_oxygen';
  reference_value: number;
  current_reading: number;
}

export interface CalibrationResponse {
  device_id: string;
  sensor_type: string;
  calibration_offset: number;
  calibrated_at: string;
}

export const calibrationAPI = {
  calibrateSensor: async (data: CalibrationRequest): Promise<CalibrationResponse> => {
    const response = await apiClient.post('/api/v1/calibration', data);
    return response.data;
  },
};

// ============================================================================
// Health Check API
// ============================================================================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  database: {
    status: 'connected' | 'disconnected';
    latency_ms: number;
  };
  ml_models: {
    classifier_loaded: boolean;
    predictor_loaded: boolean;
    classifier_version: string;
    predictor_version: string;
  };
  notification_service: {
    status: 'operational' | 'degraded' | 'down';
  };
  sensor_devices: Array<{
    device_id: string;
    status: 'online' | 'offline';
    last_seen: string;
  }>;
}

export const healthAPI = {
  getHealth: async (): Promise<HealthResponse> => {
    const response = await apiClient.get('/api/v1/health');
    return response.data;
  },
};

// ============================================================================
// FCM Token Registration
// ============================================================================

export interface FCMTokenRequest {
  fcm_token: string;
  device_id: string;
  platform: 'android' | 'ios';
}

export const fcmAPI = {
  registerToken: async (data: FCMTokenRequest): Promise<void> => {
    await apiClient.post('/api/v1/fcm/register', data);
  },

  unregisterToken: async (fcm_token: string): Promise<void> => {
    await apiClient.post('/api/v1/fcm/unregister', { fcm_token });
  },
};

// Export the configured axios instance for custom requests
export default apiClient;
