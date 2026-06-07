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
      return false;
    }
  }
  return true;
};

export const getFCMToken = async () => {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      return null;
    }

    const messagingInstance = messaging();
    const token = await messagingInstance.getToken();
    return token;
  } catch (error) {
    return null;
  }
};

export const setupFCMListeners = () => {
  const messagingInstance = messaging();
  
  const unsubscribeOnMessage = messagingInstance.onMessage(async remoteMessage => {
    
  });

  messagingInstance.setBackgroundMessageHandler(async remoteMessage => {
    
  });

  const unsubscribeOnNotificationOpenedApp = messagingInstance.onNotificationOpenedApp(remoteMessage => {
    
  });

  messagingInstance
    .getInitialNotification()
    .then(remoteMessage => {
      if (remoteMessage) {
        
      }
    });

  const unsubscribeOnTokenRefresh = messagingInstance.onTokenRefresh(token => {
    
  });

  return () => {
    unsubscribeOnMessage();
    unsubscribeOnNotificationOpenedApp();
    unsubscribeOnTokenRefresh();
  };
};

export const registerTokenWithBackend = async (token, userId) => {
  try {
    return true;
  } catch (error) {
    return false;
  }
};
