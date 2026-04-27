/**
 * Calibration Module
 * Handles sensor calibration and offset management
 * 
 * This module will be implemented in Task 17
 */

#ifndef CALIBRATION_H
#define CALIBRATION_H

#include <Arduino.h>
#include <Preferences.h>
#include "config.h"

// Calibration data structure
struct CalibrationData {
  float phOffset;
  float turbidityOffset;
  float temperatureOffset;
  float tdsOffset;
  float doOffset;
};

// Function declarations (to be implemented in Task 17)
void initializeCalibration();
CalibrationData loadCalibration();
void saveCalibration(const CalibrationData& calibration);
void resetCalibration();
float applyCalibration(float rawValue, float offset);

#endif // CALIBRATION_H
