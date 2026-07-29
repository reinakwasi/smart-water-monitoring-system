import { buildCurrentAlerts, getCurrentReadingFreshness } from '../../src/screens/AlertsScreen';

const freshNow = new Date('2026-07-15T10:01:00Z').getTime();

const payload = {
  water_quality: {
    classification: 'Unsafe',
    parameters: { ph: 5.8, turbidity_index: 82, temperature: 32, tds: 940 },
    timestamp: '2026-07-15T10:00:00Z',
  },
  contamination_risk: { risk_level: 'High', risk_score: 0.84 },
  tank_status: { status: 'Low', level_percent: 18, timestamp: '2026-07-15T10:00:00Z' },
};

describe('current alert generation', () => {
  it('uses the real classification, risk, and tank readings', () => {
    const alerts = buildCurrentAlerts(payload, undefined, [], freshNow);

    expect(alerts.map(alert => alert.id)).toEqual(['water-unsafe', 'risk-high', 'tank-low']);
    expect(alerts[0].message).toContain('turbidity reading shows very cloudy water');
    expect(alerts[1].message).toContain('score: 84%');
    expect(alerts[2].message).toContain('18%');
    expect(alerts.map(alert => alert.message).join(' ')).not.toContain('since refilled');
  });

  it('respects the saved alert preferences', () => {
    const alerts = buildCurrentAlerts(payload, {
      unsafeWaterAlerts: false,
      contaminationRisk: false,
      tankLevelAlerts: true,
    }, [], freshNow);

    expect(alerts.map(alert => alert.id)).toEqual(['tank-low']);
  });

  it('returns no warning when no configured condition is active', () => {
    const alerts = buildCurrentAlerts({
      water_quality: { classification: 'Safe', parameters: {}, timestamp: '2026-07-15T10:00:00Z' },
      contamination_risk: { risk_level: 'Low', risk_score: 0.1 },
      tank_status: { status: 'Half_Full', level_percent: 50, timestamp: '2026-07-15T10:00:00Z' },
    }, undefined, [], freshNow);

    expect(alerts).toEqual([]);
  });

  it('does not show old saved database readings as live alerts', () => {
    const now = new Date('2026-07-15T10:10:30Z').getTime();
    const freshness = getCurrentReadingFreshness(payload, now);
    const alerts = buildCurrentAlerts(payload, undefined, [], now);

    expect(freshness.hasAnyReading).toBe(true);
    expect(freshness.anyFresh).toBe(false);
    expect(alerts).toEqual([]);
  });
});
