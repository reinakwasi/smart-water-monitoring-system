import AsyncStorage from '@react-native-async-storage/async-storage';
import { TOKEN_KEY } from '../services/api';

/**
 * Retrieve authentication token from AsyncStorage
 * @returns {Promise<string|null>} The authentication token or null if not found
 */
export const getAuthToken = async () => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch (error) {
    console.error('Error retrieving auth token:', error);
    return null;
  }
};
