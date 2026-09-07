import { Platform } from 'react-native';

/**
 * Automatic API Base URL Configuration
 *
 * The common cause of "Cannot connect to server" is that the app is using an
 * old PC Wi-Fi IP after the computer restarts or changes network. This config
 * keeps the current LAN IP, and in development it also exposes fallback URLs so
 * the API client can try the Android emulator address automatically.
 */

const CONFIG = {
  // Your PC's current Wi-Fi IP. Run `npm run update-ip` after changing Wi-Fi/hotspot.
  PC_WIFI_IP: '172.20.10.5',

  // Backend port.
  BACKEND_PORT: '8000',

  // Set this only when the backend is deployed to a stable HTTPS address.
  PRODUCTION_URL: null,

  // true = real phone on the same Wi-Fi/hotspot as the computer.
  // false = Android Studio emulator.
  USE_PHYSICAL_DEVICE: true,
};

const uniqueUrls = urls => Array.from(new Set(urls.filter(Boolean)));

const getCandidateUrls = () => {
  const { PC_WIFI_IP, BACKEND_PORT, USE_PHYSICAL_DEVICE } = CONFIG;
  const lanUrl = `http://${PC_WIFI_IP}:${BACKEND_PORT}`;
  const androidEmulatorUrl = `http://10.0.2.2:${BACKEND_PORT}`;
  const localhostUrl = `http://localhost:${BACKEND_PORT}`;

  if (!__DEV__) {
    if (CONFIG.PRODUCTION_URL) return [CONFIG.PRODUCTION_URL];
    return [lanUrl];
  }

  if (Platform.OS === 'android') {
    return USE_PHYSICAL_DEVICE
      ? uniqueUrls([lanUrl, androidEmulatorUrl, localhostUrl])
      : uniqueUrls([androidEmulatorUrl, lanUrl, localhostUrl]);
  }

  if (Platform.OS === 'ios') {
    return USE_PHYSICAL_DEVICE
      ? uniqueUrls([lanUrl, localhostUrl])
      : uniqueUrls([localhostUrl, lanUrl]);
  }

  return uniqueUrls([localhostUrl, lanUrl]);
};

export const API_FALLBACK_URLS = getCandidateUrls();
export const API_BASE_URL = API_FALLBACK_URLS[0];

export const API_CONFIG = {
  baseUrl: API_BASE_URL,
  fallbackUrls: API_FALLBACK_URLS,
  platform: Platform.OS,
  isDevelopment: __DEV__,
  isPhysicalDevice: CONFIG.USE_PHYSICAL_DEVICE,
};
