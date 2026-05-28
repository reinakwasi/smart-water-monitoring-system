import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

/**
 * Request notification permission for Android 13+
 * @returns Promise<boolean> - true if permission granted
 */
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'android' && Platform.Version >= 33) {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }
  // For Android < 13, permission is granted by default
  return true;
};

/**
 * Get FCM token for push notifications
 * @returns Promise<string | null> - FCM token or null if failed
 */
export const getFCMToken = async (): Promise<string | null> => {
  try {
    // Request notification permission first
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return null;
    }

    // Get FCM token
    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

/**
 * Setup FCM listeners for foreground, background, and notification tap events
 */
export const setupFCMListeners = () => {
  // Handle foreground messages (when app is open)
  messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', JSON.stringify(remoteMessage, null, 2));
    // TODO: Display in-app notification or update UI
  });

  // Handle background messages (when app is in background)
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', JSON.stringify(remoteMessage, null, 2));
    // TODO: Process background notification
  });

  // Handle notification opened app (user tapped notification)
  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Notification opened app:', JSON.stringify(remoteMessage, null, 2));
    // TODO: Navigate to relevant screen based on notification data
  });

  // Check if app was opened from a notification (when app was quit)
  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from notification (quit state):', JSON.stringify(remoteMessage, null, 2));
        // TODO: Navigate to relevant screen based on notification data
      }
    });

  // Handle token refresh
  messaging().onTokenRefresh(token => {
    console.log('FCM token refreshed:', token);
    // TODO: Send updated token to backend
  });
};

/**
 * Register FCM token with backend
 * @param token - FCM token
 * @param userId - User ID
 * @returns Promise<boolean> - true if registration successful
 */
export const registerTokenWithBackend = async (
  token: string,
  userId: string,
): Promise<boolean> => {
  try {
    // TODO: Implement API call to backend
    // Example:
    // await axios.post('/api/v1/fcm/register', { token, userId });
    console.log('TODO: Register token with backend:', { token, userId });
    return true;
  } catch (error) {
    console.error('Error registering token with backend:', error);
    return false;
  }
};
