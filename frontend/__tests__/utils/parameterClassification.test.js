import {
  classifyParameter,
  getParameterDisplayInfo,
  getParameterDisplayName,
  getParameterUnit,
  isParameterValueValid,
  getSupportedParameters,
  classifyAllParameters,
} from '../../src/utils/parameterClassification';

describe('parameterClassification', () => {
  describe('WHO-aligned drinking-water bands', () => {
    it('classifies TDS by WHO palatability bands', () => {
      expect(classifyParameter('tds', 299.9).band).toBe('Excellent');
      expect(classifyParameter('tds', 300).band).toBe('Good');
      expect(classifyParameter('tds', 600).band).toBe('Fair');
      expect(classifyParameter('tds', 900).band).toBe('Poor');
      expect(classifyParameter('tds', 1200).band).toBe('Unacceptable');
    });

    it('classifies turbidity using clear-water NTU bands', () => {
      expect(classifyParameter('turbidity_index', 0.5).band).toBe('Excellent');
      expect(classifyParameter('turbidity_index', 1).band).toBe('Acceptable');
      expect(classifyParameter('turbidity_index', 5).band).toBe('Poor');
      expect(classifyParameter('turbidity_index', 50).band).toBe('Unsafe');
    });

    it('classifies pH using the usual 6.5-8.5 operational guide', () => {
      expect(classifyParameter('ph', 6.4).band).toBe('Acidic/Unsafe');
      expect(classifyParameter('ph', 6.5).band).toBe('Good');
      expect(classifyParameter('ph', 8.5).band).toBe('Good');
      expect(classifyParameter('ph', 8.6).band).toBe('Alkaline/Unsafe');
    });

    it('treats temperature as a monitoring value, not a WHO safety limit', () => {
      expect(classifyParameter('temperature', 10).band).toBe('Cold');
      expect(classifyParameter('temperature', 22.3).band).toBe('Normal');
      expect(classifyParameter('temperature', 30).band).toBe('Warm');
    });
  });

  describe('display helpers', () => {
    it('returns display info with a readable band and color', () => {
      const result = getParameterDisplayInfo('tds', 274);
      expect(result.band).toBe('Excellent');
      expect(result.color).toBe('#00FF00');
    });

    it('returns display names and units', () => {
      expect(getParameterDisplayName('tds')).toBe('TDS');
      expect(getParameterDisplayName('turbidity_index')).toBe('Turbidity');
      expect(getParameterDisplayName('temperature')).toBe('Temperature');
      expect(getParameterDisplayName('ph')).toBe('pH');
      expect(getParameterUnit('tds')).toBe('ppm');
      expect(getParameterUnit('turbidity_index')).toBe('NTU');
      expect(getParameterUnit('temperature')).toBe('°C');
      expect(getParameterUnit('ph')).toBe('');
    });

    it('validates physical input ranges', () => {
      expect(isParameterValueValid('tds', 2000)).toBe(true);
      expect(isParameterValueValid('tds', 2500)).toBe(false);
      expect(isParameterValueValid('turbidity_index', 3000)).toBe(true);
      expect(isParameterValueValid('temperature', 60)).toBe(true);
      expect(isParameterValueValid('ph', 14)).toBe(true);
      expect(isParameterValueValid('ph', 15)).toBe(false);
      expect(isParameterValueValid('tds', 'bad')).toBe(false);
      expect(isParameterValueValid('unknown', 1)).toBe(false);
    });

    it('reports supported parameters and classifies complete readings', () => {
      expect(getSupportedParameters()).toEqual(['tds', 'turbidity_index', 'temperature', 'ph']);
      const result = classifyAllParameters({ ph: 7.2, turbidity_index: 3, temperature: 22.3, tds: 274 });
      expect(result.ph.band).toBe('Good');
      expect(result.turbidity_index.band).toBe('Acceptable');
      expect(result.temperature.band).toBe('Normal');
      expect(result.tds.band).toBe('Excellent');
    });

    it('throws for unknown parameters', () => {
      expect(() => classifyParameter('unknown_param', 50)).toThrow('Unknown parameter: unknown_param');
    });
  });
});
