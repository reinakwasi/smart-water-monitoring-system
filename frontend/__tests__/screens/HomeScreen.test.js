import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import HomeScreen from '../../src/screens/HomeScreen';
import { statusAPI } from '../../src/services/api';

jest.mock('../../src/context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      isDarkMode: false,
      colors: {
        background: '#F8FAFC', cardBackground: '#FFFFFF', text: '#1E293B',
        textSecondary: '#64748B', textTertiary: '#94A3B8', border: '#E2E8F0',
        primary: '#0891B2', statusBar: 'dark-content', statusBarBg: '#F8FAFC',
      },
    },
  }),
}));

jest.mock('../../src/services/api', () => ({
  statusAPI: { getCurrentStatus: jest.fn() },
}));

jest.mock('../../src/utils/profileLoader', () => ({
  loadUserProfile: jest.fn().mockResolvedValue({ fullName: 'Ama Mensah' }),
  getFirstName: jest.fn(() => 'Ama'),
}));

const response = {
  water_quality: {
    classification: 'Safe', confidence: 0.92,
    parameters: { ph: 7.2, turbidity_index: 8, temperature: 24, tds: 220 },
    timestamp: new Date().toISOString(),
  },
  contamination_risk: { risk_level: 'Low', risk_score: 0.2 },
  tank_status: { status: 'Half_Full', level_percent: 50, volume_liters: 250, timestamp: new Date().toISOString() },
};

describe('HomeScreen navigation', () => {
  beforeEach(() => {
    statusAPI.getCurrentStatus.mockResolvedValue(response);
  });

  afterEach(() => jest.clearAllMocks());

  it('opens Water Insights and Tank Details from their home actions', async () => {
    const navigation = { navigate: jest.fn() };
    const { getByLabelText, getByText } = render(<HomeScreen navigation={navigation} />);

    await waitFor(() => expect(statusAPI.getCurrentStatus).toHaveBeenCalled());
    await waitFor(() => expect(getByText('Temperature')).toBeTruthy());
    expect(getByText('4 active sensors - Live reading bands')).toBeTruthy();
    fireEvent.press(getByLabelText('Open Water Insights'));
    fireEvent.press(getByLabelText('Open tank details'));

    expect(navigation.navigate).toHaveBeenNthCalledWith(1, 'Insights');
    expect(navigation.navigate).toHaveBeenNthCalledWith(2, 'Tank');
  });
});


