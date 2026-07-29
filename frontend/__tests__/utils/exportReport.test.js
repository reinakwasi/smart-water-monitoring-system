import {
  formatRiskScore,
  generateCSVContent,
  generateReviewReportHTML,
  getReviewSummary,
} from '../../src/utils/exportReport';

const sampleExportData = {
  count: 2,
  data: [
    {
      timestamp: '2026-07-15T10:00:00Z',
      parameters: {
        ph: 6.42,
        turbidity_index: 72.5,
        tds: 880,
        temperature: 30.8,
      },
      classification: 'Unsafe',
      risk_score: 0.86,
      tank_level_percent: 48,
    },
    {
      timestamp: '2026-07-15T09:00:00Z',
      parameters: {
        ph: 7.18,
        turbidity_index: 11.2,
        tds: 260,
        temperature: 24.1,
      },
      classification: 'Safe',
      risk_score: 0.14,
      tank_level_percent: 52,
    },
  ],
};

describe('export report utilities', () => {
  it('formats model risk as a review-friendly percentage', () => {
    expect(formatRiskScore(0.86)).toBe('86%');
    expect(formatRiskScore(86)).toBe('86%');
    expect(formatRiskScore(null)).toBe('N/A');
  });

  it('builds a CSV export with the four project sensors and review notes', () => {
    const csv = generateCSVContent(sampleExportData);

    expect(csv).toContain('"Turbidity (NTU)"');
    expect(csv).toContain('"Risk Score (%)"');
    expect(csv).toContain('"86%"');
    expect(csv).toContain('"Do not drink until the water is treated and checked again."');
    expect(csv).not.toContain('Dissolved Oxygen');
  });

  it('summarises unsafe readings without treating missing values as zero', () => {
    const summary = getReviewSummary({
      data: [
        { timestamp: '2026-07-15T10:00:00Z', parameters: { ph: 6.5 }, classification: 'Warning', risk_score: 0.45 },
        { timestamp: '2026-07-15T11:00:00Z', parameters: {}, classification: 'Safe', risk_score: 0.15 },
      ],
    });

    expect(summary.totalReadings).toBe(2);
    expect(summary.warningCount).toBe(1);
    expect(summary.stats.ph.average).toBe(6.5);
    expect(summary.stats.temperature.average).toBeNull();
  });

  it('generates a printable review report with plain-language purpose and sensor explanations', () => {
    const html = generateReviewReportHTML(sampleExportData, 'Rein', 'rein@example.com', '7days');

    expect(html).toContain('AquaGuard Water Quality Review Report');
    expect(html).toContain('Plain summary');
    expect(html).toContain('pH, turbidity, TDS, temperature and tank monitoring');
    expect(html).toContain('not a medical diagnosis');
    expect(html).not.toContain('dissolved oxygen');
  });
});
