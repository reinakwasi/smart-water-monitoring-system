const MEASURED_SENSOR_KEYS = ['ph', 'turbidity', 'temperature', 'tds'];
const EXPLANATION_FEATURES = ['ph', 'turbidity', 'temperature', 'tds'];

const clampPercentage = value => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return Math.round(Math.min(1, Math.max(0, number)) * 100);
};

const finiteValue = value => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const normalizeFeature = feature => {
  const raw = String(feature || '').toLowerCase();
  const timeframeMatch = raw.match(/_(current|mean|std|trend)$/);
  const timeframe = timeframeMatch?.[1] || 'current';
  const withoutTimeframe = timeframeMatch ? raw.slice(0, -timeframeMatch[0].length) : raw;
  const base = withoutTimeframe === 'turbidity_index' ? 'turbidity' : withoutTimeframe;
  return { base, timeframe };
};

export const formatFeatureName = feature => {
  const { base } = normalizeFeature(feature);
  const labels = {
    ph: 'pH',
    turbidity: 'Water cloudiness',
    tds: 'Dissolved substances',
    temperature: 'Water temperature',
  };
  return labels[base] || base.replace(/_/g, ' ') || 'Unknown factor';
};

const timeframeLabel = timeframe => {
  const labels = {
    current: 'Current reading',
    mean: 'Recent average',
    std: 'Recent variation',
    trend: 'Recent trend',
  };
  return labels[timeframe] || 'Model input';
};

const safetyPresentation = classification => {
  if (classification === 'Safe') return { status: 'No warning detected', level: 'Safe', color: '#10B981' };
  if (classification === 'Warning') return { status: 'Needs attention', level: 'Warning', color: '#F59E0B' };
  if (classification === 'Unsafe') return { status: 'Not safe to drink', level: 'Critical', color: '#EF4444' };
  return { status: 'Waiting for analysis', level: 'Pending', color: '#64748B' };
};

const riskPresentation = level => {
  if (level === 'High') return { label: 'High risk', color: '#EF4444' };
  if (level === 'Medium') return { label: 'Medium risk', color: '#F59E0B' };
  if (level === 'Low') return { label: 'Low risk', color: '#10B981' };
  return { label: 'Risk pending', color: '#64748B' };
};

const fallbackBand = (key, value) => {
  if (value === null) return 'Waiting';
  if (key === 'ph') {
    if (value < 6.5) return 'Acidic/Unsafe';
    if (value <= 8.5) return 'Good';
    return 'Alkaline/Unsafe';
  }
  if (key === 'turbidity') {
    if (value < 1) return 'Excellent';
    if (value < 5) return 'Acceptable';
    if (value < 50) return 'Poor';
    return 'Unsafe';
  }
  if (key === 'tds') {
    if (value < 300) return 'Excellent';
    if (value < 600) return 'Good';
    if (value < 900) return 'Fair';
    if (value < 1200) return 'Poor';
    return 'Unacceptable';
  }
  if (key === 'temperature') {
    if (value < 15) return 'Cold';
    if (value < 30) return 'Normal';
    return 'Warm';
  }
  return 'System value';
};

const bandTone = band => {
  if (['Unsafe', 'Unacceptable', 'Acidic/Unsafe', 'Alkaline/Unsafe'].includes(band)) {
    return { severity: 'danger', color: '#DC2626', background: '#FEF2F2' };
  }
  if (['Poor', 'Fair', 'Acceptable', 'Cold', 'Warm'].includes(band)) {
    return { severity: 'caution', color: '#D97706', background: '#FFFBEB' };
  }
  if (band === 'Waiting') return { severity: 'pending', color: '#64748B', background: '#F1F5F9' };
  return { severity: 'good', color: '#059669', background: '#ECFDF5' };
};

const sensorNarrative = (key, value) => {
  if (value === null) {
    return {
      headline: 'Waiting for a reading',
      explanation: 'The device has not provided this measurement yet.',
      nextStep: 'Keep the device powered on and wait for the next automatic update.',
    };
  }

  if (key === 'ph') {
    if (value < 6.5) return {
      headline: 'The water is too acidic',
      explanation: 'The pH reading shows the water is too acidic. Acidic water may taste sour and may slowly damage metal pipes or containers.',
      nextStep: 'Do not use it for drinking yet. Use another water source or treat the water before use.',
    };
    if (value > 8.5) return {
      headline: 'The water is too alkaline',
      explanation: 'The pH reading shows the water is too alkaline. It may taste bitter or soapy and may leave mineral deposits.',
      nextStep: 'Do not use it for drinking yet. Use another water source or treat the water before use.',
    };
    return {
      headline: 'Acidity is in range',
      explanation: 'The pH reading is in a normal area, so the water is not strongly acidic or strongly alkaline.',
      nextStep: 'No pH action is needed from this reading. Still check the other readings before drinking.',
    };
  }

  if (key === 'turbidity') {
    if (value >= 50) return {
      headline: 'The water is very cloudy',
      explanation: 'The cloudiness reading is very high. This usually means the water has many tiny particles in it, such as powder, dirt, or other fine matter. Water in this condition may look milky, muddy, or unclear.',
      nextStep: 'Do not use it for drinking yet. Let the water settle, filter or treat it, and check again after the reading improves.',
    };
    if (value >= 10) return {
      headline: 'The water is cloudy',
      explanation: 'The cloudiness reading is above the clear-water level. The water may contain small visible particles or may not be clear enough.',
      nextStep: 'If the value stays high, let the water settle, filter or treat it, or avoid drinking it.',
    };
    if (value >= 5) return {
      headline: 'Slight cloudiness was detected',
      explanation: 'The cloudiness reading needs attention. It may mean the water has small particles in it and is not as clear as expected.',
      nextStep: 'Keep monitoring the water. If the value rises, let it settle or filter it before drinking.',
    };
    return {
      headline: 'The water appears clear',
      explanation: 'The cloudiness reading is low. This usually means the water looks clear and has little visible floating material.',
      nextStep: 'No cloudiness action is needed from this reading.',
    };
  }

  if (key === 'tds') {
    if (value >= 1200) return {
      headline: 'Dissolved substances are unacceptable',
      explanation: 'The reading shows an unacceptable amount of dissolved substances for drinking-water taste. These may be minerals, salts, or other dissolved matter.',
      nextStep: 'Do not use it for drinking yet. Use filtration/treatment or another water source, then check again.',
    };
    if (value >= 900) return {
      headline: 'Dissolved substances are high',
      explanation: 'There may be many dissolved minerals or salts in the water. This can affect taste and may cause deposits or scaling.',
      nextStep: 'Filter or treat the water if the value remains high.',
    };
    if (value >= 600) return {
      headline: 'Dissolved substances need attention',
      explanation: 'The reading is in a fair taste band. It can affect taste, but this reading does not tell exactly which substances are present.',
      nextStep: 'Keep monitoring. If it keeps rising, filter/treat the water before drinking.',
    };
    return {
      headline: 'Dissolved substances are in range',
      explanation: 'The reading shows a low-to-moderate amount of dissolved substances in the water.',
      nextStep: 'No TDS action is needed from this reading.',
    };
  }

  if (value < 15) return {
    headline: 'The water is cold',
    explanation: 'The water is cold. This may affect taste, but temperature alone does not prove the water is contaminated.',
    nextStep: 'Keep monitoring the other sensor values.',
  };
  if (value < 30) return {
    headline: 'Temperature is normal',
    explanation: 'The water temperature is in a comfortable range. This also helps the app calculate the dissolved-substances reading more accurately.',
    nextStep: 'No temperature action is needed from this reading.',
  };
  return {
    headline: 'The water is warm',
    explanation: 'The water is warm. Warm water may taste different and can become unsafe faster if other readings are also poor.',
    nextStep: 'Avoid storing it warm for long. Use treatment or another source if other readings also look unsafe.',
  };
};

const buildSensorAssessment = (key, rawValue) => {
  const value = finiteValue(rawValue);
  const metadata = {
    ph: { name: 'Acidity (pH)', unit: '', range: 'Guide: 6.5-8.5' },
    turbidity: { name: 'Water cloudiness', unit: 'NTU', range: 'Clear-water guide: below 5 NTU' },
    temperature: { name: 'Water temperature', unit: '°C', range: 'Comfortable guide: 15-25 °C' },
    tds: { name: 'Dissolved substances', unit: 'ppm', range: 'Taste guide: below 600 ppm' },
  }[key];
  const band = fallbackBand(key, value);
  const narrative = sensorNarrative(key, value);

  return {
    key,
    ...metadata,
    value,
    band,
    ...bandTone(band),
    ...narrative,
  };
};

const buildPlainLanguage = (safety, risk, assessments) => {
  const concerns = assessments.filter(item => ['caution', 'danger'].includes(item.severity));
  let summary;

  if (concerns.length > 0) {
    summary = concerns.length === 1
      ? `${concerns[0].name} needs attention in this water check.`
      : `${concerns.map(item => item.name).join(', ')} need attention in this water check.`;
  } else if (safety.level === 'Safe' && risk.level === 'Low') {
    summary = 'The current readings do not show a warning sign.';
  } else {
    summary = 'The readings look mostly acceptable, but the app noticed a pattern worth watching.';
  }

  let action;
  if (safety.level === 'Critical' || risk.level === 'High') {
    action = 'Do not use this water for drinking yet. Use another water source or treat/filter the water, then check again after the reading improves.';
  } else if (safety.level === 'Warning' || risk.level === 'Medium' || concerns.length > 0) {
    action = 'Use caution. If the reading still needs attention, let the water settle, filter/treat it, or avoid drinking it.';
  } else {
    action = 'No immediate warning is present. Continue monitoring for any change.';
  }

  return {
    summary,
    concernDetails: concerns.map(item => item.explanation),
    action,
  };
};

const getObservedValue = (base, timeframe, parameters) => {
  if (timeframe !== 'current') return null;
  const key = base === 'turbidity' ? 'turbidity_index' : base;
  return finiteValue(parameters?.[key]);
};

const formatObservedValue = (base, value) => {
  if (value === null) return null;
  if (base === 'temperature') return `${value} °C`;
  if (base === 'tds') return `${value} ppm`;
  if (base === 'turbidity') return `${value} NTU`;
  return String(value);
};

const buildModelExplanation = (safety, risk, topFactor) => {
  if (!topFactor) {
    return `The app returned ${safety.status.toLowerCase()} and ${risk.label.toLowerCase()}, but it could not explain which readings affected this result.`;
  }

  const effect = topFactor.direction === 'decreasing_risk' ? 'lowered' : 'raised';
  const timing = topFactor.timeframe === 'current'
    ? 'current reading'
    : topFactor.contextLabel.toLowerCase();
  return `${topFactor.name} (${timing}) had the biggest effect on this prediction and ${effect} the app's risk score. This explains the prediction only; the reading cards above explain what the water result means.`;
};

export const buildWaterInsights = (payload = {}) => {
  const water = payload.water_quality || {};
  const riskData = payload.contamination_risk || {};
  const parameters = water.parameters || {};
  const safety = safetyPresentation(water.classification);
  const risk = riskPresentation(riskData.risk_level);
  const sensorAssessments = MEASURED_SENSOR_KEYS.map(key => buildSensorAssessment(
    key,
    key === 'turbidity' ? parameters.turbidity_index : parameters[key],
  ));

  const rawFactors = riskData.shap_explanation?.top_factors || [];
  const factors = rawFactors
    .filter(factor => factor && Number.isFinite(Number(factor.shap_value)))
    .map(factor => ({ factor, normalized: normalizeFeature(factor.feature) }))
    .filter(({ normalized }) => EXPLANATION_FEATURES.includes(normalized.base))
    .map(({ factor, normalized }) => {
      const observedValue = getObservedValue(normalized.base, normalized.timeframe, parameters);
      return {
        feature: factor.feature,
        baseFeature: normalized.base,
        name: formatFeatureName(factor.feature),
        shapValue: Number(factor.shap_value),
        direction: factor.direction || (Number(factor.shap_value) >= 0 ? 'increasing_risk' : 'decreasing_risk'),
        timeframe: normalized.timeframe,
        contextLabel: timeframeLabel(normalized.timeframe),
        observedValue,
        observedLabel: formatObservedValue(normalized.base, observedValue),
        effectLabel: (factor.direction || (Number(factor.shap_value) >= 0 ? 'increasing_risk' : 'decreasing_risk')) === 'decreasing_risk'
          ? 'Lowered app concern'
          : 'Raised app concern',
        effectExplanation: (factor.direction || (Number(factor.shap_value) >= 0 ? 'increasing_risk' : 'decreasing_risk')) === 'decreasing_risk'
          ? 'For this prediction, this reading made the app less worried. Check its card above before deciding the water is safe.'
          : 'For this prediction, this reading made the app more worried. Check its card above for what it means.',
        isMeasured: MEASURED_SENSOR_KEYS.includes(normalized.base),
      };
    });

  const topFactor = factors.find(factor => factor.isMeasured) || factors[0] || null;
  const plainLanguage = buildPlainLanguage(safety, { ...risk, level: riskData.risk_level }, sensorAssessments);

  return {
    safety: { ...safety, confidence: clampPercentage(water.confidence) },
    risk: {
      ...risk,
      level: riskData.risk_level || 'Unknown',
      score: clampPercentage(riskData.risk_score),
    },
    sensorAssessments,
    supportingTemperature: {
      value: finiteValue(parameters.temperature),
      isMeasured: true,
      explanation: 'The temperature reading helps the app understand the water condition and calculate dissolved substances more steadily.',
    },
    sensorScope: {
      measuredCount: 4,
      measuredNames: ['pH', 'Turbidity', 'Temperature', 'TDS'],
    },
    factors,
    topFactor,
    explanation: buildModelExplanation(safety, risk, topFactor),
    plainLanguage,
    timestamp: water.timestamp ? new Date(water.timestamp) : null,
  };
};






