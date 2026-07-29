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
  };

  return {
    create: jest.fn(() => mockClient),
    post: jest.fn(),
    __mockClient: mockClient,
  };
});

import axios from 'axios';
import { historicalDataAPI, statusAPI } from '../../src/services/api';

const client = axios.__mockClient;

describe('status API routes', () => {
  beforeEach(() => client.get.mockReset());

  it('requests current status from the backend status router', async () => {
    client.get.mockResolvedValue({ data: { water_quality: {} } });
    await statusAPI.getCurrentStatus();
    expect(client.get).toHaveBeenCalledWith('/api/v1/status/current-status');
  });

  it('requests historical data from the backend status router', async () => {
    client.get.mockResolvedValue({ data: { data: [{ parameters: {} }], count: 1 } });
    const result = await historicalDataAPI.getHistoricalData({ page: 2 });
    expect(client.get).toHaveBeenCalledWith('/api/v1/status/historical-data', { params: { page: 2 } });
    expect(result.data[0].parameter_classifications).toEqual({
      ph: null, turbidity_index: null, temperature: null, tds: null,
    });
  });
});


