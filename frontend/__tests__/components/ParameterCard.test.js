import React from 'react';
import { render } from '@testing-library/react-native';
import ParameterCard from '../../src/components/ParameterCard';

describe('ParameterCard Component', () => {
  it('displays TDS using WHO palatability labels', () => {
    const { getByText } = render(<ParameterCard parameter="tds" value={274} />);
    expect(getByText('TDS')).toBeTruthy();
    expect(getByText('274')).toBeTruthy();
    expect(getByText('ppm')).toBeTruthy();
    expect(getByText('Excellent')).toBeTruthy();
  });

  it('displays turbidity in NTU without extra probe warning text', () => {
    const { getByText, queryByText } = render(<ParameterCard parameter="turbidity_index" value={202} />);
    expect(getByText('Turbidity')).toBeTruthy();
    expect(getByText('202')).toBeTruthy();
    expect(getByText('NTU')).toBeTruthy();
    expect(getByText('Unsafe')).toBeTruthy();
    expect(queryByText(/probe/i)).toBeNull();
    expect(queryByText(/valid only/i)).toBeNull();
    expect(queryByText('?')).toBeNull();
  });

  it('displays pH using the 6.5-8.5 guide', () => {
    const { getByText } = render(<ParameterCard parameter="ph" value={7.2} />);
    expect(getByText('pH')).toBeTruthy();
    expect(getByText('7.2')).toBeTruthy();
    expect(getByText('Good')).toBeTruthy();
  });

  it('displays temperature as a monitoring band', () => {
    const { getByText } = render(<ParameterCard parameter="temperature" value={28} />);
    expect(getByText('Temperature')).toBeTruthy();
    expect(getByText('28')).toBeTruthy();
    expect(getByText('°C')).toBeTruthy();
    expect(getByText('Normal')).toBeTruthy();
  });

  it('shows an error for invalid values', () => {
    const { getByText } = render(<ParameterCard parameter="ph" value={15} />);
    expect(getByText('Invalid ph value')).toBeTruthy();
  });
});
