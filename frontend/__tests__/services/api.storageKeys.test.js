// Mock AsyncStorage before importing api
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

// Mock axios
jest.mock('axios', () => ({
  create: jest.fn(() => ({
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
  })),
  post: jest.fn(),
}));

import { 
  TOKEN_KEY, 
  REFRESH_TOKEN_KEY, 
  USER_NAME_KEY, 
  USER_EMAIL_KEY, 
  USER_PROFILE_KEY 
} from '../../src/services/api';

describe('API Storage Key Constants', () => {
  it('should export TOKEN_KEY with correct value', () => {
    expect(TOKEN_KEY).toBe('@water_quality_token');
  });

  it('should export REFRESH_TOKEN_KEY with correct value', () => {
    expect(REFRESH_TOKEN_KEY).toBe('@water_quality_refresh_token');
  });

  it('should export USER_NAME_KEY with correct value', () => {
    expect(USER_NAME_KEY).toBe('@user_name');
  });

  it('should export USER_EMAIL_KEY with correct value', () => {
    expect(USER_EMAIL_KEY).toBe('@user_email');
  });

  it('should export USER_PROFILE_KEY with correct value', () => {
    expect(USER_PROFILE_KEY).toBe('@user_profile');
  });

  it('should have unique keys for all constants', () => {
    const keys = [TOKEN_KEY, REFRESH_TOKEN_KEY, USER_NAME_KEY, USER_EMAIL_KEY, USER_PROFILE_KEY];
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });
});
