import { buildWaterInsights, formatFeatureName } from '../../src/utils/waterInsights';

const buildPayload = overrides => ({
  water_quality: {
    classification: 'Safe',
    confidence: 0.91,
    parameters: { ph: 7.1, turbidity_index: 0.8, temperature: 22.6, tds: 240 },
    parameter_classifications: { ph: 'Excellent', turbidity_index: 'Unsafe', temperature: 'Poor', tds: 'Unacceptable' },
    timestamp: '2026-07-15T10:00:00Z',
    ...overrides?.water_quality,
  },
  contamination_risk: {
    risk_level: 'Low',
    risk_score: 0.18,
    shap_explanation: { top_factors: [] },
    ...overrides?.contamination_risk,
  },
});

describe('water insights utilities', () => {
  it('reports the four physical water-quality sensors', () => {
    const insights = buildWaterInsights(buildPayload());

    expect(insights.sensorScope).toMatchObject({
      measuredCount: 4,
      measuredNames: ['pH', 'Turbidity', 'Temperature', 'TDS'],
    });
    expect(insights.sensorAssessments.map(sensor => sensor.key)).toEqual(['ph', 'turbidity', 'temperature', 'tds']);
    expect(insights.supportingTemperature.isMeasured).toBe(true);
    expect(insights.sensorAssessments[2]).toMatchObject({
      key: 'temperature',
      value: 22.6,
      headline: 'Temperature is normal',
    });
  });

  it('removes dissolved-oxygen factors while retaining supported model factors', () => {
    const insights = buildWaterInsights(buildPayload({
      contamination_risk: {
        shap_explanation: {
          top_factors: [
            { feature: 'dissolved_oxygen_current', shap_value: 0.9, direction: 'increasing_risk' },
            { feature: 'turbidity_current', shap_value: 0.42, direction: 'increasing_risk' },
            { feature: 'ph_mean', shap_value: -0.11, direction: 'decreasing_risk' },
          ],
        },
      },
    }));

    expect(insights.factors).toHaveLength(2);
    expect(insights.factors.map(factor => factor.baseFeature)).toEqual(['turbidity', 'ph']);
    expect(insights.topFactor).toMatchObject({
      name: 'Water cloudiness',
      contextLabel: 'Current reading',
      observedLabel: '0.8 NTU',
      effectLabel: 'Raised app concern',
    });
    expect(insights.topFactor.effectExplanation).toContain('Check its card above');
  });

  it('uses current app bands instead of old saved parameter labels', () => {
    const insights = buildWaterInsights(buildPayload());
    const turbidity = insights.sensorAssessments.find(sensor => sensor.key === 'turbidity');
    const tds = insights.sensorAssessments.find(sensor => sensor.key === 'tds');

    expect(turbidity.band).toBe('Excellent');
    expect(tds.band).toBe('Excellent');
  });

  it('gives a layperson explanation and action for unsafe readings', () => {
    const insights = buildWaterInsights(buildPayload({
      water_quality: {
        classification: 'Unsafe',
        parameters: { ph: 5.9, turbidity_index: 82, temperature: 32, tds: 950 },
        parameter_classifications: { ph: 'Acidic/Unsafe', turbidity_index: 'Unsafe', temperature: 'Poor', tds: 'Unsafe' },
      },
      contamination_risk: { risk_level: 'High', risk_score: 0.86 },
    }));

    expect(insights.plainLanguage.summary).toContain('Water cloudiness');
    expect(insights.plainLanguage.summary).toContain('Dissolved substances');
    expect(insights.plainLanguage.concernDetails.join(' ')).toContain('too acidic');
    expect(insights.plainLanguage.concernDetails.join(' ')).toContain('many tiny particles');
    expect(insights.plainLanguage.concernDetails.join(' ')).toContain('water is warm');
    expect(insights.plainLanguage.action).toContain('Do not use this water for drinking yet');
    expect(insights.sensorAssessments.find(sensor => sensor.key === 'turbidity').nextStep).toContain('filter or treat');
  });

  it('gives a monitoring step when readings have no warning', () => {
    const insights = buildWaterInsights(buildPayload());

    expect(insights.plainLanguage.summary).toContain('do not show a warning sign');
    expect(insights.plainLanguage.action).toContain('Continue monitoring');
  });

  it('handles a response without supported factor explanations', () => {
    const insights = buildWaterInsights(buildPayload({
      water_quality: { classification: 'Warning' },
      contamination_risk: { risk_level: 'Medium', risk_score: 0.5 },
    }));

    expect(insights.factors).toEqual([]);
    expect(insights.explanation).toContain('could not explain');
  });

  it('formats direct and temporal model feature names', () => {
    expect(formatFeatureName('tds')).toBe('Dissolved substances');
    expect(formatFeatureName('turbidity_index_trend')).toBe('Water cloudiness');
    expect(formatFeatureName('dissolved_oxygen')).toBe('dissolved oxygen');
  });
});






