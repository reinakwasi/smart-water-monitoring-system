jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  multiRemove: jest.fn(),
}));

jest.mock('axios', () => {
  const mockClient = {
    interceptors: {
      request: { use: jest.fn() },
      response: { use: jest.fn() },
    },
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
  };
  return { create: jest.fn(() => mockClient), post: jest.fn(), __mockClient: mockClient };
});

import axios from 'axios';
import { deviceAPI } from '../../src/services/api';

const client = axios.__mockClient;

describe('device API routes', () => {
  beforeEach(() => jest.clearAllMocks());

  it('lists and registers ESP32 devices using the backend device router', async () => {
    client.get.mockResolvedValue({ data: { devices: [], count: 0 } });
    client.post.mockResolvedValue({ data: { device_id: 'ESP32_001', api_key: 'secret' } });

    await deviceAPI.listDevices();
    await deviceAPI.registerDevice({ device_id: 'ESP32_001', device_name: 'Tank monitor' });

    expect(client.get).toHaveBeenCalledWith('/api/v1/devices/list');
    expect(client.post).toHaveBeenCalledWith('/api/v1/devices/register', {
      device_id: 'ESP32_001',
      device_name: 'Tank monitor',
    });
  });

  it('uses encoded device IDs for key rotation and removal', async () => {
    client.post.mockResolvedValue({ data: { api_key: 'new-secret' } });
    client.delete.mockResolvedValue({ data: { status: 'success' } });

    await deviceAPI.regenerateKey('ESP32 / 1');
    await deviceAPI.unregisterDevice('ESP32 / 1');

    expect(client.post).toHaveBeenCalledWith('/api/v1/devices/ESP32%20%2F%201/regenerate-key');
    expect(client.delete).toHaveBeenCalledWith('/api/v1/devices/ESP32%20%2F%201/unregister');
  });
});
