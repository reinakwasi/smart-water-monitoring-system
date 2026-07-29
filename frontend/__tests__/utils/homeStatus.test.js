import {
  DEVICE_CLOCK_SKEW_TOLERANCE_MS,
  DEVICE_OFFLINE_AFTER_MS,
  formatTimeSinceUpdate,
  getLatestReadingTimestamp,
  getStatusErrorMessage,
  isDeviceConnected,
  mapCurrentStatus,
} from '../../src/utils/homeStatus';

describe('home status utilities', () => {
  it('maps the current status without losing valid zero readings', () => {
    const mapped = mapCurrentStatus({
      water_quality: {
        classification: 'Warning',
        confidence: 0.786,
        parameters: { ph: 0, turbidity_index: 12.4, temperature: 24, tds: 310 },
        timestamp: '2026-07-15T10:00:00Z',
      },
      contamination_risk: { risk_level: 'Medium', risk_score: 0.46 },
      tank_status: {
        status: 'Half_Full',
        level_percent: 52.4,
        volume_liters: 262,
        timestamp: '2026-07-15T10:00:00Z',
      },
    });

    expect(mapped.waterQuality.classification).toBe('Needs attention');
    expect(mapped.waterQuality.confidence).toBe(79);
    expect(mapped.waterQuality.parameters.ph).toBe(0);
    expect(mapped.contaminationRisk).toEqual({ level: 'Medium', score: 46 });
    expect(mapped.tankStatus.levelPercent).toBe(52);
    expect(mapped.tankStatus.status).toBe('Half full');
  });

  it('uses the saved tank capacity when calculating available litres', () => {
    const mapped = mapCurrentStatus({
      tank_status: {
        status: 'Half_Full',
        level_percent: 50,
        volume_liters: 100,
        total_capacity: 200,
      },
    }, { tankCapacityLitres: 1000 });

    expect(mapped.tankStatus.levelPercent).toBe(50);
    expect(mapped.tankStatus.volumeLitres).toBe(500);
    expect(mapped.tankStatus.totalCapacity).toBe(1000);
  });

  it('only reports a device as connected for a recent valid timestamp', () => {
    const now = Date.parse('2026-07-15T10:05:00Z');
    expect(isDeviceConnected(new Date(now - DEVICE_OFFLINE_AFTER_MS + 1), now)).toBe(true);
    expect(isDeviceConnected(new Date(now - DEVICE_OFFLINE_AFTER_MS), now)).toBe(false);
    expect(isDeviceConnected(new Date(now + DEVICE_CLOCK_SKEW_TOLERANCE_MS - 1), now)).toBe(true);
    expect(isDeviceConnected(new Date(now + DEVICE_CLOCK_SKEW_TOLERANCE_MS), now)).toBe(false);
    expect(isDeviceConnected(null, now)).toBe(false);
  });

  it('uses the newest valid reading time from water or tank updates', () => {
    const latest = getLatestReadingTimestamp(
      '2026-07-15T10:00:00Z',
      '2026-07-15T10:04:30Z',
      'not-a-date',
    );

    expect(latest.toISOString()).toBe('2026-07-15T10:04:30.000Z');
  });



  it('marks the device offline soon after expected ESP32 uploads stop', () => {
    const now = Date.parse('2026-07-15T10:05:00Z');
    expect(isDeviceConnected(new Date(now - 89 * 1000), now)).toBe(true);
    expect(isDeviceConnected(new Date(now - 91 * 1000), now)).toBe(false);
  });

  it('formats missing and elapsed timestamps honestly', () => {
    const now = Date.parse('2026-07-15T10:30:00Z');
    expect(formatTimeSinceUpdate(null, now)).toBe('Waiting for the first reading');
    expect(formatTimeSinceUpdate(new Date(now - 60000), now)).toBe('Updated 1 min ago');
    expect(formatTimeSinceUpdate(new Date(now - 2 * 60 * 60000), now)).toBe('Updated 2 hours ago');
  });

  it('returns an actionable message for missing readings', () => {
    expect(getStatusErrorMessage({ response: { status: 404 } })).toContain('No device readings yet');
  });
});
