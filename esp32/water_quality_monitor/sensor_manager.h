/**
 * Sensor Manager Module
 * Handles reading from all water quality sensors
 * 
 * This module will be implemented in Task 17
 */

#ifndef SENSOR_MANAGER_H
#define SENSOR_MANAGER_H

#include <Arduino.h>
#include "config.h"

// Sensor reading structure
struct SensorReading {
  float ph;
  float turbidity;
  float temperature;
  float tds;
  float dissolvedOxygen;
  float tankLevel;
  bool valid;
  String timestamp;
};

// Function declarations (to be implemented in Task 17)
void initializeSensors();
SensorReading acquireSensorData();
bool validateReading(const SensorReading& reading);

// Individual sensor reading functions (to be implemented in Task 17)
float readPH();
float readTurbidity();
float readTemperature();
float readTDS();
float readDissolvedOxygen();
float readUltrasonic();

#endif // SENSOR_MANAGER_H
