/**
 * Water Quality Parameter Classification Bands
 *
 * This module provides centralized threshold definitions for classifying water quality
 * parameters (TDS, Turbidity, Temperature, pH) for consistent display across the app.
 *
 * The thresholds define quality bands (Excellent, Good, Acceptable, Poor, Unsafe) that
 * indicate the safety and palatability of drinking water.
 *
 * This implementation keeps the app display bands consistent across screens
 * Boundary semantics:
 * - Lower bounds are INCLUSIVE, upper bounds are EXCLUSIVE (except where noted)
 * - pH Good band [6.5, 8.5] has INCLUSIVE upper bound at 8.5
 */

/**
 * Configured parameter classification bands with color mappings
 *
 * Color scheme:
 * - Green (#00FF00, #32CD32): Excellent, Good
 * - Chartreuse (#7FFF00): Acceptable and Fair
 * - Orange (#FFA500): Poor and Warm
 * - Red (#FF0000): Unsafe, Unacceptable, Acidic/Unsafe, Alkaline/Unsafe
 */
export const PARAMETER_BANDS = {
  tds: [
    { min: 0, max: 300, band: 'Excellent', color: '#00FF00' },          // WHO palatability: <300 mg/L is excellent
    { min: 300, max: 600, band: 'Good', color: '#32CD32' },             // 300-600 mg/L is good
    { min: 600, max: 900, band: 'Fair', color: '#7FFF00' },             // 600-900 mg/L is fair
    { min: 900, max: 1200, band: 'Poor', color: '#FFA500' },            // 900-1200 mg/L is poor
    { min: 1200, max: Infinity, band: 'Unacceptable', color: '#FF0000' } // >1200 mg/L is unacceptable for taste
  ],

  turbidity_index: [
    { min: 0, max: 1, band: 'Excellent', color: '#00FF00' },            // Very clear water
    { min: 1, max: 5, band: 'Acceptable', color: '#7FFF00' },           // Clear-water upper guide
    { min: 5, max: 50, band: 'Poor', color: '#FFA500' },                // Cloudy; needs attention
    { min: 50, max: Infinity, band: 'Unsafe', color: '#FF0000' }        // Very cloudy; avoid drinking without treatment
  ],

  temperature: [
    { min: -Infinity, max: 15, band: 'Cold', color: '#7FFF00' },        // Temperature is monitored for taste and compensation
    { min: 15, max: 30, band: 'Normal', color: '#00FF00' },             // Normal monitoring range for this project
    { min: 30, max: Infinity, band: 'Warm', color: '#FFA500' }          // Warm water can affect taste and storage
  ],

  ph: [
    { min: 0, max: 6.5, band: 'Acidic/Unsafe', color: '#FF0000' },      // Below WHO operational pH guide
    { min: 6.5, max: 8.5, band: 'Good', color: '#00FF00' },             // WHO operational guide: usually 6.5-8.5
    { min: 8.5, max: 14, band: 'Alkaline/Unsafe', color: '#FF0000' }    // Above WHO operational pH guide
  ]
};

/**
 * Classify a parameter value into a quality band
 *
 * This function keeps the app display bands consistent with stored readings
 *
 * @param {string} parameter - Parameter name (tds, turbidity_index, temperature, ph)
 * @param {number} value - Parameter value to classify
 * @returns {{band: string, color: string}} - Quality band and color code
 * @throws {Error} If parameter name is not recognized
 *
 * @example
 * // TDS classification
 * classifyParameter('tds', 274)
 * // Returns: { band: 'Excellent', color: '#00FF00' }
 *
 * @example
 * // pH classification (boundary case)
 * classifyParameter('ph', 8.5)
 * // Returns: { band: 'Good', color: '#32CD32' }
 *
 * @example
 * // Temperature classification
 * classifyParameter('temperature', 22.3)
 * // Returns: { band: 'Normal', color: '#00FF00' }
 */
export function classifyParameter(parameter, value) {
  const thresholds = PARAMETER_BANDS[parameter];

  if (!thresholds) {
    throw new Error(`Unknown parameter: ${parameter}`);
  }

  for (const threshold of thresholds) {
    // Special case: pH GOOD band has inclusive upper bound at 8.5
    if (parameter === 'ph' && threshold.band === 'Good' && threshold.min === 6.5 && threshold.max === 8.5) {
      // pH GOOD band: [6.5, 8.5] (inclusive on both ends)
      if (value >= threshold.min && value <= threshold.max) {
        return { band: threshold.band, color: threshold.color };
      }
    }
    // Standard case: inclusive lower bound, exclusive upper bound
    else if (value >= threshold.min && value < threshold.max) {
      return { band: threshold.band, color: threshold.color };
    }
  }

  // Fallback to last band (should not happen if thresholds cover full range)
  const lastThreshold = thresholds[thresholds.length - 1];
  return { band: lastThreshold.band, color: lastThreshold.color };
}

/**
 * Get parameter classification display info.
 *
 * @param {string} parameter - Parameter name (tds, turbidity_index, temperature, ph)
 * @param {number} value - Parameter value
 * @returns {{band: string, color: string}} - Display label and color
 */
export function getParameterDisplayInfo(parameter, value) {
  const { band, color } = classifyParameter(parameter, value);
  return { band, color };
}

/**
 * Get human-readable parameter name for display
 *
 * @param {string} parameter - Parameter key (tds, turbidity_index, temperature, ph)
 * @returns {string} - Human-readable parameter name
 */
export function getParameterDisplayName(parameter) {
  const nameMap = {
    'tds': 'TDS',
    'turbidity_index': 'Turbidity',
    'temperature': 'Temperature',
    'ph': 'pH'
  };

  return nameMap[parameter] || parameter;
}

/**
 * Get parameter unit for display
 *
 * @param {string} parameter - Parameter key (tds, turbidity_index, temperature, ph)
 * @returns {string} - Unit of measurement
 */
export function getParameterUnit(parameter) {
  const unitMap = {
    'tds': 'ppm',
    'turbidity_index': 'NTU',
    'temperature': '°C',
    'ph': ''
  };

  return unitMap[parameter] || '';
}

/**
 * Validate that a parameter value is within expected range
 *
 * @param {string} parameter - Parameter name
 * @param {number} value - Parameter value
 * @returns {boolean} - True if value is within expected range
 */
export function isParameterValueValid(parameter, value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return false;
  }

  const validRanges = {
    'tds': { min: 0, max: 2000 },           // Reasonable upper limit for TDS
    'turbidity_index': { min: 0, max: 3000 }, // NTU
    'temperature': { min: -10, max: 60 },    // Reasonable temp range for water
    'ph': { min: 0, max: 14 }                // pH scale is 0-14
  };

  const range = validRanges[parameter];
  if (!range) {
    return false;
  }

  return value >= range.min && value <= range.max;
}

/**
 * Get all supported parameter keys
 *
 * @returns {string[]} - Array of parameter keys
 */
export function getSupportedParameters() {
  return ['tds', 'turbidity_index', 'temperature', 'ph'];
}

/**
 * Classify all parameters in a sensor reading.
 *
 * @param {{ph: number, turbidity_index: number, temperature: number, tds: number}} reading - Sensor reading object
 * @returns {{ph: object, turbidity_index: object, temperature: object, tds: object}} - Classification for each parameter
 */
export function classifyAllParameters(reading) {
  const result = {};

  for (const parameter of getSupportedParameters()) {
    if (reading[parameter] !== undefined && reading[parameter] !== null) {
      result[parameter] = getParameterDisplayInfo(parameter, reading[parameter]);
    }
  }

  return result;
}
