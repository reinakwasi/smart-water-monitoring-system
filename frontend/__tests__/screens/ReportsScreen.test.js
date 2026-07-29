import React from 'react';
import { render, waitFor } from '@testing-library/react-native';
import ReportsScreen from '../../src/screens/ReportsScreen';
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

const response = {
  water_quality: {
    classification: 'Unsafe',
    confidence: 0.88,
    parameters: { ph: 5.8, turbidity_index: 80, temperature: 32, tds: 940 },
    parameter_classifications: {
      ph: 'Acidic/Unsafe', turbidity_index: 'Unsafe', temperature: 'Poor', tds: 'Unsafe',
    },
    timestamp: new Date().toISOString(),
  },
  contamination_risk: {
    risk_level: 'High',
    risk_score: 0.84,
    shap_explanation: {
      top_factors: [
        { feature: 'dissolved_oxygen_current', shap_value: 0.95, direction: 'increasing_risk' },
        { feature: 'turbidity_current', shap_value: 0.55, direction: 'increasing_risk' },
      ],
    },
  },
};

describe('ReportsScreen', () => {
  beforeEach(() => statusAPI.getCurrentStatus.mockResolvedValue(response));
  afterEach(() => jest.clearAllMocks());

  it('shows the real sensor scope and a plain-language unsafe-water explanation', async () => {
    const { getAllByText, getByText, queryByText } = render(<ReportsScreen />);

    await waitFor(() => expect(getByText('Water condition summary')).toBeTruthy());
    expect(queryByText('Before using this result')).toBeNull();
    expect(getByText('Not safe to drink')).toBeTruthy();
    expect(getByText(/High risk/)).toBeTruthy();
    expect(getByText('The water is too acidic')).toBeTruthy();
    expect(getByText('The water is very cloudy')).toBeTruthy();
    expect(getByText('The water is warm')).toBeTruthy();
    expect(getByText(/Do not use this water for drinking yet/)).toBeTruthy();
    expect(getAllByText('WHAT TO DO').length).toBeGreaterThan(0);
    expect(getByText('WHY THE APP GAVE THIS RESULT')).toBeTruthy();
    expect(getAllByText('Water cloudiness').length).toBeGreaterThan(0);
    expect(queryByText('Dissolved oxygen')).toBeNull();
    expect(queryByText('What the device actually measures')).toBeNull();
    expect(queryByText('What these sensors cannot tell you')).toBeNull();
  }, 15000);
});






