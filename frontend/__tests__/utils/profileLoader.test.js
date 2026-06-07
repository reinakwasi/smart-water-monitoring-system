import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadUserProfile, getFirstName } from '../../src/utils/profileLoader';
import { authAPI, USER_NAME_KEY, USER_EMAIL_KEY, USER_PROFILE_KEY } from '../../src/services/api';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

// Mock authAPI
jest.mock('../../src/services/api', () => ({
  authAPI: {
    getProfile: jest.fn(),
  },
  USER_NAME_KEY: '@user_name',
  USER_EMAIL_KEY: '@user_email',
  USER_PROFILE_KEY: '@user_profile',
}));

describe('profileLoader', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loadUserProfile', () => {
    it('should return cached data from AsyncStorage when available', async () => {
      // Arrange
      AsyncStorage.getItem.mockImplementation((key) => {
        if (key === USER_NAME_KEY) return Promise.resolve('John Doe');
        if (key === USER_EMAIL_KEY) return Promise.resolve('john@example.com');
        if (key === USER_PROFILE_KEY) return Promise.resolve(JSON.stringify({ full_name: 'John Doe', email: 'john@example.com' }));
        return Promise.resolve(null);
      });

      // Act
      const result = await loadUserProfile();

      // Assert
      expect(result.fullName).toBe('John Doe');
      expect(result.email).toBe('john@example.com');
      expect(result.profile).toEqual({ full_name: 'John Doe', email: 'john@example.com' });
      expect(authAPI.getProfile).not.toHaveBeenCalled();
    });

    it('should fetch from API when AsyncStorage data is missing', async () => {
      // Arrange
      AsyncStorage.getItem.mockResolvedValue(null);
      authAPI.getProfile.mockResolvedValue({
        full_name: 'Jane Smith',
        email: 'jane@example.com',
      });

      // Act
      const result = await loadUserProfile();

      // Assert
      expect(authAPI.getProfile).toHaveBeenCalled();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(USER_NAME_KEY, 'Jane Smith');
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(USER_EMAIL_KEY, 'jane@example.com');
      expect(result.fullName).toBe('Jane Smith');
      expect(result.email).toBe('jane@example.com');
    });

    it('should return defaults when API fetch fails', async () => {
      // Arrange
      AsyncStorage.getItem.mockResolvedValue(null);
      authAPI.getProfile.mockRejectedValue(new Error('API Error'));

      // Act
      const result = await loadUserProfile();

      // Assert
      expect(result.fullName).toBe('User');
      expect(result.email).toBe('');
      expect(result.profile).toBeNull();
    });

    it('should return defaults when AsyncStorage throws error', async () => {
      // Arrange
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage Error'));

      // Act
      const result = await loadUserProfile();

      // Assert
      expect(result.fullName).toBe('User');
      expect(result.email).toBe('');
      expect(result.profile).toBeNull();
    });
  });

  describe('getFirstName', () => {
    it('should extract first name from full name', () => {
      expect(getFirstName('John Doe')).toBe('John');
    });

    it('should handle single name', () => {
      expect(getFirstName('John')).toBe('John');
    });

    it('should handle multiple spaces', () => {
      expect(getFirstName('John Michael Doe')).toBe('John');
    });

    it('should return "User" for null input', () => {
      expect(getFirstName(null)).toBe('User');
    });

    it('should return "User" for undefined input', () => {
      expect(getFirstName(undefined)).toBe('User');
    });

    it('should return "User" for empty string', () => {
      expect(getFirstName('')).toBe('User');
    });
  });
});
