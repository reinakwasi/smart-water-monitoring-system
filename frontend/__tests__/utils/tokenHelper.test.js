import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuthToken } from '../../src/utils/tokenHelper';
import { TOKEN_KEY } from '../../src/services/api';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
}));

// Mock TOKEN_KEY
jest.mock('../../src/services/api', () => ({
  TOKEN_KEY: '@water_quality_token',
}));

describe('tokenHelper', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getAuthToken', () => {
    it('should return token when available in AsyncStorage', async () => {
      // Arrange
      const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.token';
      AsyncStorage.getItem.mockResolvedValue(mockToken);

      // Act
      const result = await getAuthToken();

      // Assert
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(TOKEN_KEY);
      expect(result).toBe(mockToken);
    });

    it('should return null when token is not in AsyncStorage', async () => {
      // Arrange
      AsyncStorage.getItem.mockResolvedValue(null);

      // Act
      const result = await getAuthToken();

      // Assert
      expect(AsyncStorage.getItem).toHaveBeenCalledWith(TOKEN_KEY);
      expect(result).toBeNull();
    });

    it('should return null when AsyncStorage throws error', async () => {
      // Arrange
      AsyncStorage.getItem.mockRejectedValue(new Error('Storage Error'));

      // Act
      const result = await getAuthToken();

      // Assert
      expect(result).toBeNull();
    });
  });
});
