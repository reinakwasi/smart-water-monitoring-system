import messaging from '@react-native-firebase/messaging';
import { PermissionsAndroid, Platform } from 'react-native';

export const requestNotificationPermission = async () => {
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
  return true;
};

export const getFCMToken = async () => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return null;
    }

    const token = await messaging().getToken();
    console.log('FCM Token:', token);
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

export const setupFCMListeners = () => {
  messaging().onMessage(async remoteMessage => {
    console.log('Foreground message received:', JSON.stringify(remoteMessage, null, 2));
  });

  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background message received:', JSON.stringify(remoteMessage, null, 2));
  });

  messaging().onNotificationOpenedApp(remoteMessage => {
    console.log('Notification opened app:', JSON.stringify(remoteMessage, null, 2));
  });

  messaging()
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        console.log('App opened from notification (quit state):', JSON.stringify(remoteMessage, null, 2));
      }
    });

  messaging().onTokenRefresh(token => {
    console.log('FCM token refreshed:', token);
  });
};

export const registerTokenWithBackend = async (token, userId) => {
  try {
    console.log('TODO: Register token with backend:', { token, userId });
    return true;
  } catch (error) {
    console.error('Error registering token with backend:', error);
    return false;
  }
};
