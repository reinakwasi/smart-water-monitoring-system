import AsyncStorage from '@react-native-async-storage/async-storage';
import { authAPI, USER_NAME_KEY, USER_EMAIL_KEY, USER_PROFILE_KEY } from '../services/api';

/**
 * Load user profile data with fallback mechanism
 * First tries AsyncStorage, then falls back to API call
 * @returns {Promise<Object>} Object containing fullName, email, and profile
 */
export const loadUserProfile = async () => {
  try {
    let userName = await AsyncStorage.getItem(USER_NAME_KEY);
    let userEmail = await AsyncStorage.getItem(USER_EMAIL_KEY);
    let userProfile = await AsyncStorage.getItem(USER_PROFILE_KEY);

    if (!userName || !userEmail) {
      try {
        const profile = await authAPI.getProfile();
        
        if (profile.full_name) {
          userName = profile.full_name;
          await AsyncStorage.setItem(USER_NAME_KEY, userName);
        }
        if (profile.email) {
          userEmail = profile.email;
          await AsyncStorage.setItem(USER_EMAIL_KEY, userEmail);
        }
        if (profile) {
          userProfile = JSON.stringify(profile);
          await AsyncStorage.setItem(USER_PROFILE_KEY, userProfile);
        }
      } catch (apiError) {
        // API fetch failed, use whatever we have from storage or defaults
      }
    }

    return {
      fullName: userName || 'User',
      email: userEmail || '',
      profile: userProfile ? JSON.parse(userProfile) : null,
    };
  } catch (error) {
    return {
      fullName: 'User',
      email: '',
      profile: null,
    };
  }
};

/**
 * Extract first name from full name
 * @param {string} fullName - The user's full name
 * @returns {string} The first name or 'User' as fallback
 */
export const getFirstName = (fullName) => {
  if (!fullName) return 'User';
  return fullName.split(' ')[0];
};
