const DATE_RANGE_LABELS = {
  '7days': 'Last 7 Days',
  '30days': 'Last 30 Days',
  all: 'Last 12 Months',
};

const SENSOR_FIELDS = [
  {
    key: 'ph',
    label: 'pH',
    unit: 'pH',
    decimals: 2,
    plainMeaning: 'Shows whether the water is too acidic or too alkaline.',
  },
  {
    key: 'turbidity_index',
    label: 'Turbidity',
    unit: 'NTU',
    decimals: 2,
    plainMeaning: 'Shows how cloudy the water is. Higher values mean more visible particles.',
  },
  {
    key: 'tds',
    label: 'TDS',
    unit: 'ppm',
    decimals: 0,
    plainMeaning: 'Shows the amount of dissolved substances in the water.',
  },
  {
    key: 'temperature',
    label: 'Temperature',
    unit: '°C',
    decimals: 1,
    plainMeaning: 'Shows how warm the water is, which can affect water condition changes.',
  },
];

const safeText = value => String(value ?? 'N/A').replace(/[<>&]/g, char => ({
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
}[char]));

const asNumber = value => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const getReadings = data => Array.isArray(data?.data) ? data.data : [];

const formatValue = (value, decimals = 2) => {
  const number = asNumber(value);
  return number === null ? 'N/A' : number.toFixed(decimals);
};

export const getDateRangeLabel = selectedDateRange => DATE_RANGE_LABELS[selectedDateRange] || DATE_RANGE_LABELS['7days'];

export const formatRiskScore = value => {
  const number = asNumber(value);
  if (number === null) {
    return 'N/A';
  }

  const percent = number <= 1 ? number * 100 : number;
  return `${Math.round(Math.max(0, Math.min(100, percent)))}%`;
};

export const getReviewSummary = data => {
  const readings = getReadings(data);
  const latest = [...readings].sort((a, b) => new Date(b.timestamp || 0) - new Date(a.timestamp || 0))[0] || null;
  const classifications = readings.reduce((counts, point) => {
    const key = point.classification || 'Unknown';
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const stats = SENSOR_FIELDS.reduce((result, field) => {
    const values = readings
      .map(point => asNumber(point.parameters?.[field.key]))
      .filter(value => value !== null);

    result[field.key] = {
      label: field.label,
      unit: field.unit,
      average: values.length
        ? values.reduce((sum, value) => sum + value, 0) / values.length
        : null,
      minimum: values.length ? Math.min(...values) : null,
      maximum: values.length ? Math.max(...values) : null,
      decimals: field.decimals,
    };

    return result;
  }, {});

  const riskValues = readings
    .map(point => asNumber(point.risk_score))
    .filter(value => value !== null);
  const highestRisk = riskValues.length ? Math.max(...riskValues) : null;
  const safeCount = classifications.Safe || 0;
  const warningCount = classifications.Warning || 0;
  const unsafeCount = classifications.Unsafe || 0;

  let plainSummary = 'The exported readings did not contain enough data for a final water condition summary.';
  if (readings.length) {
    if (unsafeCount > 0) {
      plainSummary = 'Some readings were marked unsafe. The water should be treated as not suitable for drinking until the issue is corrected and readings improve.';
    } else if (warningCount > 0) {
      plainSummary = 'Some readings need attention. The water may not be dangerous, but the sensor values should be watched closely and rechecked.';
    } else {
      plainSummary = 'The readings in this export were mainly within the normal monitoring condition used by the system.';
    }
  }

  return {
    totalReadings: readings.length,
    latestClassification: latest?.classification || 'N/A',
    latestRiskScore: formatRiskScore(latest?.risk_score),
    highestRiskScore: formatRiskScore(highestRisk),
    safeCount,
    warningCount,
    unsafeCount,
    safePercentage: readings.length ? ((safeCount / readings.length) * 100).toFixed(1) : '0.0',
    plainSummary,
    stats,
  };
};

const csvCell = value => {
  const text = value === undefined || value === null || value === '' ? 'N/A' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

export const generateCSVContent = data => {
  const readings = getReadings(data);
  const header = [
    'Timestamp',
    'pH',
    'Turbidity (NTU)',
    'TDS (ppm)',
    'Temperature (°C)',
    'Classification',
    'Risk Score (%)',
    'Tank Level (%)',
    'Review Note',
  ];

  const rows = readings.map(point => {
    const classification = point.classification || 'N/A';
    const reviewNote = classification === 'Unsafe'
      ? 'Do not drink until the water is treated and checked again.'
      : classification === 'Warning'
        ? 'Repeat the reading and watch the highlighted sensor values.'
        : 'No immediate warning from this reading.';

    return [
      point.timestamp ? new Date(point.timestamp).toLocaleString() : 'N/A',
      formatValue(point.parameters?.ph, 2),
      formatValue(point.parameters?.turbidity_index, 2),
      formatValue(point.parameters?.tds, 0),
      formatValue(point.parameters?.temperature, 1),
      classification,
      formatRiskScore(point.risk_score),
      formatValue(point.tank_level_percent, 0),
      reviewNote,
    ].map(csvCell).join(',');
  });

  return [header.map(csvCell).join(','), ...rows].join('\n');
};

export const generateReviewReportHTML = (data, userName, userEmail, selectedDateRange = '7days') => {
  const readings = getReadings(data);
  const summary = getReviewSummary(data);
  const dateRangeName = getDateRangeLabel(selectedDateRange);
  const generatedAt = new Date().toLocaleString();

  const statCards = SENSOR_FIELDS.map(field => {
    const stat = summary.stats[field.key];
    return `
      <div class="card">
        <div class="label">Average ${safeText(field.label)}</div>
        <div class="value">${stat.average === null ? 'N/A' : stat.average.toFixed(field.decimals)}</div>
        <div class="hint">${safeText(field.unit)} · low ${stat.minimum === null ? 'N/A' : stat.minimum.toFixed(field.decimals)} · high ${stat.maximum === null ? 'N/A' : stat.maximum.toFixed(field.decimals)}</div>
      </div>
    `;
  }).join('');

  const sensorNotes = SENSOR_FIELDS.map(field => `
    <li><strong>${safeText(field.label)}:</strong> ${safeText(field.plainMeaning)}</li>
  `).join('');

  const rows = readings.map((point, index) => {
    const classification = point.classification || 'N/A';
    const statusClass = classification === 'Safe'
      ? 'safe'
      : classification === 'Warning'
        ? 'warning'
        : classification === 'Unsafe'
          ? 'unsafe'
          : 'unknown';

    return `
      <tr>
        <td>${index + 1}</td>
        <td>${point.timestamp ? safeText(new Date(point.timestamp).toLocaleString()) : 'N/A'}</td>
        <td>${formatValue(point.parameters?.ph, 2)}</td>
        <td>${formatValue(point.parameters?.turbidity_index, 2)}</td>
        <td>${formatValue(point.parameters?.tds, 0)}</td>
        <td>${formatValue(point.parameters?.temperature, 1)}</td>
        <td>${formatRiskScore(point.risk_score)}</td>
        <td>${formatValue(point.tank_level_percent, 0)}</td>
        <td><span class="pill ${statusClass}">${safeText(classification)}</span></td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>AquaGuard Water Quality Review Report</title>
        <style>
          body { margin: 0; background: #e0f2fe; color: #0f172a; font-family: Arial, Helvetica, sans-serif; line-height: 1.5; }
          .page { max-width: 1120px; margin: 24px auto; background: #ffffff; border-radius: 24px; overflow: hidden; box-shadow: 0 20px 60px rgba(15, 23, 42, 0.18); }
          .hero { background: linear-gradient(135deg, #075985, #0891b2); color: white; padding: 34px; }
          .hero h1 { margin: 0 0 8px; font-size: 32px; }
          .hero p { margin: 4px 0; color: #cffafe; }
          .content { padding: 28px; }
          .notice { background: #f0f9ff; border: 1px solid #bae6fd; border-left: 6px solid #0891b2; border-radius: 16px; padding: 18px; margin-bottom: 24px; }
          .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 14px; margin: 18px 0 26px; }
          .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 16px; padding: 18px; }
          .label { color: #64748b; font-size: 12px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
          .value { color: #0f766e; font-size: 28px; font-weight: 800; margin-top: 6px; }
          .hint { color: #64748b; font-size: 12px; margin-top: 4px; }
          h2 { color: #0e7490; margin-top: 28px; }
          ul { padding-left: 20px; }
          li { margin: 8px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 14px; font-size: 13px; }
          th { background: #0e7490; color: white; padding: 12px 10px; text-align: left; }
          td { border-bottom: 1px solid #e2e8f0; padding: 10px; }
          tr:nth-child(even) { background: #f8fafc; }
          .pill { border-radius: 999px; display: inline-block; font-weight: 800; padding: 5px 12px; }
          .safe { background: #dcfce7; color: #166534; }
          .warning { background: #fef3c7; color: #92400e; }
          .unsafe { background: #fee2e2; color: #991b1b; }
          .unknown { background: #e2e8f0; color: #334155; }
          .footer { background: #0f172a; color: #cbd5e1; padding: 22px 28px; font-size: 12px; }
          @media print { body { background: white; } .page { box-shadow: none; margin: 0; border-radius: 0; } }
        </style>
      </head>
      <body>
        <main class="page">
          <section class="hero">
            <h1>AquaGuard Water Quality Review Report</h1>
            <p>Generated ${safeText(generatedAt)} · ${safeText(dateRangeName)}</p>
            <p>Prepared for ${safeText(userName)} (${safeText(userEmail)})</p>
          </section>

          <section class="content">
            <div class="notice">
              <strong>Plain summary:</strong> ${safeText(summary.plainSummary)}
              <br />
              <small>This export supports water-quality review and project documentation. It is not a medical diagnosis or laboratory certificate.</small>
            </div>

            <div class="grid">
              <div class="card"><div class="label">Readings exported</div><div class="value">${summary.totalReadings}</div><div class="hint">records</div></div>
              <div class="card"><div class="label">Latest result</div><div class="value">${safeText(summary.latestClassification)}</div><div class="hint">risk ${safeText(summary.latestRiskScore)}</div></div>
              <div class="card"><div class="label">Highest risk seen</div><div class="value">${safeText(summary.highestRiskScore)}</div><div class="hint">during this period</div></div>
              <div class="card"><div class="label">Reading split</div><div class="value">${summary.safePercentage}%</div><div class="hint">${summary.safeCount} safe · ${summary.warningCount} warning · ${summary.unsafeCount} unsafe</div></div>
            </div>

            <h2>Sensor measurements included</h2>
            <ul>${sensorNotes}</ul>

            <h2>Review focus</h2>
            <ul>
              <li>Check any reading marked <strong>Unsafe</strong> or <strong>Warning</strong> first.</li>
              <li>Look for repeated changes in pH, turbidity, TDS, or temperature instead of judging from one reading only.</li>
              <li>If the water is marked unsafe, do not use it for drinking until the source is checked, the water is treated, and a fresh reading improves.</li>
            </ul>

            <h2>Summary statistics</h2>
            <div class="grid">${statCards}</div>

            <h2>Detailed readings</h2>
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Timestamp</th>
                  <th>pH</th>
                  <th>Turbidity (NTU)</th>
                  <th>TDS (ppm)</th>
                  <th>Temp (°C)</th>
                  <th>Risk</th>
                  <th>Tank (%)</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </section>

          <footer class="footer">
            AquaGuard Water Quality Monitoring System · pH, turbidity, TDS, temperature and tank monitoring · Model-assisted risk prediction.
          </footer>
        </main>
      </body>
    </html>
  `;
};
