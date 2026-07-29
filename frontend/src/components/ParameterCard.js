import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import {
  getParameterDisplayInfo,
  getParameterDisplayName,
  getParameterUnit,
  isParameterValueValid
} from '../utils/parameterClassification';

/**
 * ParameterCard Component
 *
 * Displays a single water quality parameter with its value, quality band classification,
 * and a color-coded badge from the configured monitoring bands.
 *
 * Features:
 * - Displays parameter name, value with unit, and quality band
 * - Color-coded badge based on classification (green for Excellent, orange for Poor, red for Unsafe)
 * - Icon representation for visual clarity
 * - Responsive design for mobile devices
 *
 * @param {Object} props - Component props
 * @param {string} props.parameter - Parameter key (tds, turbidity_index, temperature, ph)
 * @param {number} props.value - Parameter value
 * @param {string} [props.style] - Additional styles for the card container
 *
 * @example
 * <ParameterCard parameter="tds" value={274} />
 * // Displays: TDS card with 274 ppm, "Good" badge in green
 *
 * @example
 * <ParameterCard parameter="ph" value={7.2} />
 * // Displays: pH card with 7.2, "Excellent" badge in green
 *
 */
const ParameterCard = ({
  parameter,
  value,
  style,
  textColor = '#1F2937',
  secondaryTextColor = '#6B7280',
}) => {
  // Validate parameter value
  if (!isParameterValueValid(parameter, value)) {
    return (
      <View style={[styles.card, styles.errorCard, style]}>
        <Text style={styles.errorText}>Invalid {parameter} value</Text>
      </View>
    );
  }

  // Get display information using classification utility
  const displayInfo = getParameterDisplayInfo(parameter, value);
  const displayName = getParameterDisplayName(parameter);
  const unit = getParameterUnit(parameter);

  return (
    <View style={[styles.card, style]}>
      {/* Parameter Name */}
      <Text style={[styles.parameterName, { color: secondaryTextColor }]}>{displayName}</Text>

      {/* Parameter Value with Unit */}
      <View style={styles.valueContainer}>
        <Text style={[styles.value, { color: textColor }]}>{value}</Text>
        {unit && <Text style={[styles.unit, { color: secondaryTextColor }]}>{unit}</Text>}
      </View>

      <View style={[styles.badge, { backgroundColor: displayInfo.color }]}>
        <Text style={styles.badgeText}>{displayInfo.band}</Text>
      </View>

    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
    marginBottom: 12,
  },
  errorCard: {
    backgroundColor: '#FEE2E2',
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  parameterName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 12,
  },
  value: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1F2937',
    marginRight: 6,
  },
  unit: {
    fontSize: 18,
    fontWeight: '500',
    color: '#6B7280',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  helperText: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 8,
  },
  badgeText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  errorText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
    textAlign: 'center',
  },
});

export default ParameterCard;
