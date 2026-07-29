import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import HistoryScreen from '../../src/screens/HistoryScreen';
import { historicalDataAPI } from '../../src/services/api';

jest.mock('react-native-chart-kit', () => ({
  LineChart: 'LineChart',
}));

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
  historicalDataAPI: { getHistoricalData: jest.fn() },
}));

const readings = [
  {
    timestamp: '2026-07-15T08:00:00Z',
    parameters: { ph: 7.2, turbidity_index: 8, temperature: 24, tds: 220 },
    classification: 'Safe',
    risk_score: 0.2,
  },
  {
    timestamp: '2026-07-15T09:00:00Z',
    parameters: { ph: 6.2, turbidity_index: 55, temperature: 29, tds: 620 },
    classification: 'Warning',
    risk_score: 0.55,
  },
  {
    timestamp: '2026-07-15T10:00:00Z',
    parameters: { ph: 5.8, turbidity_index: 82, temperature: 32, tds: 940 },
    classification: 'Unsafe',
    risk_score: 0.84,
  },
];

describe('HistoryScreen', () => {
  beforeEach(() => {
    historicalDataAPI.getHistoricalData.mockResolvedValue({ data: readings });
  });

  afterEach(() => jest.clearAllMocks());

  it('shows stored-reading proof, latest values, and export navigation', async () => {
    const navigation = { navigate: jest.fn() };
    const { getByText } = render(<HistoryScreen navigation={navigation} />);

    await waitFor(() => expect(getByText('HISTORY SUMMARY')).toBeTruthy());

    expect(getByText('Stored water checks')).toBeTruthy();
    expect(getByText('Readings saved')).toBeTruthy();
    expect(getByText('3')).toBeTruthy();
    expect(getByText('Latest result')).toBeTruthy();
    expect(getByText('Unsafe - High risk')).toBeTruthy();
    expect(getByText('Warnings found')).toBeTruthy();
    expect(getByText('2')).toBeTruthy();
    expect(getByText('High-risk results')).toBeTruthy();
    expect(getByText('5.8 today')).toBeTruthy();
    expect(getByText('32°C today')).toBeTruthy();

    fireEvent.press(getByText('Open Data Export'));
    expect(navigation.navigate).toHaveBeenCalledWith('ExportData');
  });
});
