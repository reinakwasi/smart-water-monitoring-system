import { classifyParameter } from './parameterClassification';

export const APP_SETTINGS_KEY = '@app_settings';
export const DEFAULT_TANK_CAPACITY_LITRES = 1000;
export const DEVICE_OFFLINE_AFTER_MS = 120000; // 120 seconds (2 minutes)
export const DEVICE_CLOCK_SKEW_TOLERANCE_MS = 120000; // 120 seconds (2 minutes)

const finiteNumber = (value, fallback = null) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const normalizeTankCapacityLitres = (value, fallback = DEFAULT_TANK_CAPACITY_LITRES) => {
  const parsed = finiteNumber(value, null);
  return parsed && parsed > 0 ? parsed : fallback;
};

const validDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const formatTankStatus = (status) => {
  const labels = {
    Full: 'Full',
    Half_Full: 'Half full',
    Low: 'Low',
    Empty: 'Empty',
    Overflow: 'Overflow',
  };
  return labels[status] || 'Unknown';
};

export const getClassificationLabel = (classification) => {
  const labels = {
    Safe: 'No warning detected',
    Warning: 'Needs attention',
    Unsafe: 'Not safe to drink',
  };
  return labels[classification] || 'Waiting for data';
};

export const getClassificationColor = (classification) => {
  if (classification === 'Unsafe') return '#B91C1C';
  if (classification === 'Warning') return '#B7791F';
  if (classification === 'Safe') return '#0B7FA5';
  return '#475569';
};

const PARAMETER_NAMES = {
  ph: 'pH',
  turbidity_index: 'Turbidity',
  temperature: 'Temperature',
  tds: 'TDS',
};

const UNSAFE_BANDS = ['Unsafe', 'Unacceptable', 'Acidic/Unsafe', 'Alkaline/Unsafe'];
const WARNING_BANDS = ['Poor', 'Warm'];

const getParameterBand = (parameter, value, parameterClassifications = {}) => {
  const savedBand = parameterClassifications[parameter];
  if (savedBand) return savedBand;
  if (value === null || value === undefined) return null;

  try {
    return classifyParameter(parameter, value).band;
  } catch (error) {
    return null;
  }
};

const getParameterConcern = (parameters, parameterClassifications = {}) => {
  const entries = [
    ['ph', parameters.ph],
    ['turbidity_index', parameters.turbidity],
    ['temperature', parameters.temperature],
    ['tds', parameters.tds],
  ];

  for (const [parameter, value] of entries) {
    const band = getParameterBand(parameter, value, parameterClassifications);
    if (UNSAFE_BANDS.includes(band)) {
      return { level: 'Unsafe', label: `${PARAMETER_NAMES[parameter]} needs attention`, band };
    }
  }

  for (const [parameter, value] of entries) {
    const band = getParameterBand(parameter, value, parameterClassifications);
    if (WARNING_BANDS.includes(band)) {
      return { level: 'Warning', label: `${PARAMETER_NAMES[parameter]} needs attention`, band };
    }
  }

  return null;
};

export const getRiskPresentation = (riskLevel) => {
  if (riskLevel === 'High') return { label: 'High risk', color: '#FCA5A5' };
  if (riskLevel === 'Medium') return { label: 'Medium risk', color: '#FDE68A' };
  if (riskLevel === 'Low') return { label: 'Low risk', color: '#86EFAC' };
  return { label: 'Risk pending', color: '#CBD5E1' };
};

export const getTankPresentation = (status) => {
  if (status === 'Overflow' || status === 'Empty') {
    return { color: '#EF4444', backgroundColor: '#FEF2F2' };
  }
  if (status === 'Low') {
    return { color: '#D97706', backgroundColor: '#FFFBEB' };
  }
  return { color: '#10B981', backgroundColor: '#ECFDF5' };
};

export const mapCurrentStatus = (payload = {}, options = {}) => {
  const water = payload.water_quality || {};
  const tank = payload.tank_status || {};
  const risk = payload.contamination_risk || {};
  const modelClassification = water.classification || null;
  const parameters = {
    ph: finiteNumber(water.parameters?.ph),
    turbidity: finiteNumber(water.parameters?.turbidity_index),
    temperature: finiteNumber(water.parameters?.temperature),
    tds: finiteNumber(water.parameters?.tds),
  };
  const parameterClassifications = water.parameter_classifications || {};
  const parameterConcern = getParameterConcern(parameters, parameterClassifications);
  const shouldShowParameterConcern = modelClassification === 'Safe' && parameterConcern;
  const rawClassification = shouldShowParameterConcern ? parameterConcern.level : modelClassification;
  const rawLevelPercent = finiteNumber(tank.level_percent, null);
  const levelPercent = Math.min(100, Math.max(0, rawLevelPercent ?? 0));
  const reportedVolumeLitres = Math.max(0, finiteNumber(tank.volume_liters, 0));
  const reportedCapacity = finiteNumber(tank.total_capacity, null);
  const configuredCapacity = normalizeTankCapacityLitres(options.tankCapacityLitres, null);
  const totalCapacity = configuredCapacity
    || (reportedCapacity && reportedCapacity > 0 ? reportedCapacity : null)
    || Math.max(DEFAULT_TANK_CAPACITY_LITRES, reportedVolumeLitres);
  const volumeLitres = rawLevelPercent === null
    ? reportedVolumeLitres
    : Math.max(0, (totalCapacity * levelPercent) / 100);

  return {
    waterQuality: {
      rawClassification,
      modelClassification,
      classification: shouldShowParameterConcern ? parameterConcern.label : getClassificationLabel(rawClassification),
      confidence: water.confidence == null
        ? null
        : Math.round(Math.min(1, Math.max(0, finiteNumber(water.confidence, 0))) * 100),
      parameters,
      parameterClassifications,
      parameterConcern,
      timestamp: validDate(water.timestamp),
    },
    contaminationRisk: {
      level: risk.risk_level || 'Unknown',
      score: risk.risk_score == null
        ? null
        : Math.round(Math.min(1, Math.max(0, finiteNumber(risk.risk_score, 0))) * 100),
    },
    tankStatus: {
      levelPercent: Math.round(levelPercent),
      volumeLitres: Math.round(volumeLitres),
      totalCapacity: Math.round(totalCapacity),
      rawStatus: tank.status || 'Unknown',
      status: formatTankStatus(tank.status),
      timestamp: validDate(tank.timestamp),
    },
  };
};

export const isDeviceConnected = (timestamp, now = Date.now()) => {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) return false;
  const age = now - timestamp.getTime();
  return age > -DEVICE_CLOCK_SKEW_TOLERANCE_MS && age < DEVICE_OFFLINE_AFTER_MS;
};

export const getLatestReadingTimestamp = (...timestamps) => {
  const validTimestamps = timestamps
    .map(timestamp => {
      if (timestamp instanceof Date) return timestamp;
      if (!timestamp) return null;
      const parsed = new Date(timestamp);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    })
    .filter(Boolean)
    .sort((a, b) => b.getTime() - a.getTime());

  return validTimestamps[0] || null;
};

export const formatTimeSinceUpdate = (timestamp, now = Date.now()) => {
  if (!(timestamp instanceof Date) || Number.isNaN(timestamp.getTime())) {
    return 'Waiting for the first reading';
  }
  const elapsedMs = Math.max(0, now - timestamp.getTime());
  const minutes = Math.floor(elapsedMs / 60000);
  if (minutes < 1) return 'Updated just now';
  if (minutes === 1) return 'Updated 1 min ago';
  if (minutes < 60) return `Updated ${minutes} mins ago`;
  const hours = Math.floor(minutes / 60);
  if (hours === 1) return 'Updated 1 hour ago';
  if (hours < 24) return `Updated ${hours} hours ago`;
  const days = Math.floor(hours / 24);
  return `Updated ${days} ${days === 1 ? 'day' : 'days'} ago`;
};

export const getStatusErrorMessage = (error) => {
  if (error?.code === 'ECONNABORTED' || error?.message?.toLowerCase().includes('timeout')) {
    return 'The system took too long to respond. Pull down or tap retry.';
  }
  if (error?.message === 'Network Error' || error?.code === 'ERR_NETWORK') {
    return 'AquaGuard cannot reach the monitoring system. Check your connection and try again.';
  }
  if (error?.response?.status === 401) {
    return 'Your session has expired. Sign in again to continue.';
  }
  if (error?.response?.status === 403) {
    return 'This account cannot access the selected device.';
  }
  if (error?.response?.status === 404) {
    return 'No device readings yet. Register a device and send its first reading.';
  }
  return 'We could not refresh the latest reading. Your last available values are still shown.';
};
