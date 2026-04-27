/**
 * Water Quality Monitoring System - ESP32 Firmware
 * Main Sketch File
 * 
 * This is the entry point for the ESP32 water quality sensor module.
 * It coordinates sensor reading, WiFi communication, and data transmission.
 * 
 * Hardware: ESP32 DevKit V1
 * Sensors: pH, Turbidity, Temperature (DS18B20), TDS, Dissolved Oxygen, Ultrasonic
 * 
 * Requirements: 1.1-1.5 (Sensor Data Acquisition)
 */

#include <Arduino.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <Preferences.h>
#include "config.h"
#include "sensor_manager.h"
#include "calibration.h"
#include "wifi_manager.h"
#include "reading_buffer.h"
#include "http_client.h"

// Global variables
unsigned long lastReadingTime = 0;
unsigned long lastWiFiCheckTime = 0;
unsigned long lastConfigCheckTime = 0;
const unsigned long WIFI_CHECK_INTERVAL = 30000; // Check WiFi every 30 seconds
const unsigned long CONFIG_CHECK_INTERVAL = 300000; // Check for config updates every 5 minutes

// Dynamic configuration variables (can be updated from backend)
unsigned long currentPollingInterval = SENSOR_POLLING_INTERVAL_MS;

/**
 * Setup function - runs once at startup
 */
void setup() {
  // Initialize serial communication for debugging
  Serial.begin(SERIAL_BAUD_RATE);
  delay(1000); // Wait for serial to initialize
  
  DEBUG_PRINTLN("\n\n========================================");
  DEBUG_PRINTLN("Water Quality Monitoring System");
  DEBUG_PRINTLN("ESP32 Sensor Module");
  DEBUG_PRINTLN("========================================\n");
  
  DEBUG_PRINTF("Device ID: %s\n", DEVICE_ID);
  DEBUG_PRINTF("Firmware Version: 1.0.0\n");
  
  // Load saved configuration from preferences
  DEBUG_PRINTLN("[SETUP] Loading saved configuration...");
  loadSavedConfiguration();
  DEBUG_PRINTF("Polling Interval: %lu seconds\n\n", currentPollingInterval / 1000);
  
  // Initialize calibration system
  DEBUG_PRINTLN("[SETUP] Initializing calibration...");
  initializeCalibration();
  DEBUG_PRINTLN("[SETUP] Calibration initialized");
  
  // Initialize sensors
  DEBUG_PRINTLN("[SETUP] Initializing sensors...");
  initializeSensors();
  DEBUG_PRINTLN("[SETUP] Sensors initialized");
  
  // Initialize WiFi
  DEBUG_PRINTLN("[SETUP] Connecting to WiFi...");
  initializeWiFi();
  
  if (isWiFiConnected()) {
    DEBUG_PRINTLN("[SETUP] WiFi connected successfully");
    DEBUG_PRINTF("[SETUP] IP Address: %s\n", getLocalIP().c_str());
    DEBUG_PRINTF("[SETUP] Backend API: %s\n", API_BASE_URL);
  } else {
    DEBUG_PRINTLN("[SETUP] WARNING: WiFi connection failed");
    DEBUG_PRINTLN("[SETUP] Will retry in main loop");
  }
  
  // Initialize reading buffer
  DEBUG_PRINTLN("[SETUP] Initializing reading buffer...");
  if (initializeBuffer()) {
    DEBUG_PRINTLN("[SETUP] Reading buffer initialized");
    printBufferStats();
  } else {
    DEBUG_PRINTLN("[SETUP] WARNING: Buffer initialization failed or disabled");
  }
  
  DEBUG_PRINTLN("\n[SETUP] Setup complete - starting main loop\n");
  DEBUG_PRINTLN("========================================\n");
}

/**
 * Main loop function - runs continuously
 * 
 * Implements timer-based sensor polling with configurable interval
 * Handles WiFi connectivity, data transmission, and configuration updates
 * 
 * Requirements: 1.7, 2.2, 14.7
 * Task 19.1: Main loop with 30-second polling interval
 */
void loop() {
  unsigned long currentTime = millis();
  
  // Check WiFi connection periodically
  if (currentTime - lastWiFiCheckTime >= WIFI_CHECK_INTERVAL) {
    if (!isWiFiConnected()) {
      DEBUG_PRINTLN("[LOOP] WiFi disconnected - attempting reconnection...");
      handleWiFiReconnection();
    }
    lastWiFiCheckTime = currentTime;
  }
  
  // Check for configuration updates from backend periodically (every 5 minutes)
  if (isWiFiConnected() && (currentTime - lastConfigCheckTime >= CONFIG_CHECK_INTERVAL)) {
    DEBUG_PRINTLN("[LOOP] Checking for configuration updates from backend...");
    checkConfigurationUpdates();
    lastConfigCheckTime = currentTime;
  }
  
  // Read sensors at configured interval (default 30 seconds, configurable via backend)
  if (currentTime - lastReadingTime >= currentPollingInterval) {
    DEBUG_PRINTLN("\n========================================");
    DEBUG_PRINTLN("--- Sensor Reading Cycle ---");
    DEBUG_PRINTF("Time: %lu ms\n", currentTime);
    DEBUG_PRINTF("Polling Interval: %lu ms (%lu seconds)\n", 
                 currentPollingInterval, currentPollingInterval / 1000);
    
    // Acquire sensor data
    DEBUG_PRINTLN("[LOOP] Acquiring sensor data...");
    SensorReading reading = acquireSensorData();
    
    // Validate reading
    if (validateReading(reading)) {
      DEBUG_PRINTLN("[LOOP] Sensor reading valid");
      
      // Display sensor values
      DEBUG_PRINTLN("\nSensor Values:");
      DEBUG_PRINTF("  pH: %.2f\n", reading.ph);
      DEBUG_PRINTF("  Turbidity: %.2f NTU\n", reading.turbidity);
      DEBUG_PRINTF("  Temperature: %.2f °C\n", reading.temperature);
      DEBUG_PRINTF("  TDS: %.2f ppm\n", reading.tds);
      DEBUG_PRINTF("  Dissolved Oxygen: %.2f mg/L\n", reading.dissolvedOxygen);
      DEBUG_PRINTF("  Tank Level: %.2f cm\n", reading.tankLevel);
      
      // Transmit data to backend
      if (isWiFiConnected()) {
        DEBUG_PRINTLN("\n[LOOP] WiFi connected - transmitting data to backend...");
        
        // First, try to flush any buffered readings
        int flushedCount = flushAllBuffers();
        if (flushedCount > 0) {
          DEBUG_PRINTF("[LOOP] ✓ Flushed %d buffered readings\n", flushedCount);
        }
        
        // Transmit current sensor reading
        bool sensorSuccess = transmitSensorReading(reading);
        if (sensorSuccess) {
          DEBUG_PRINTLN("[LOOP] ✓ Sensor data transmitted successfully");
        } else {
          DEBUG_PRINTLN("[LOOP] ✗ Failed to transmit sensor data (buffered)");
        }
        
        // Transmit current tank level
        bool tankSuccess = transmitTankLevel(reading.tankLevel);
        if (tankSuccess) {
          DEBUG_PRINTLN("[LOOP] ✓ Tank level transmitted successfully");
        } else {
          DEBUG_PRINTLN("[LOOP] ✗ Failed to transmit tank level (buffered)");
        }
      } else {
        DEBUG_PRINTLN("[LOOP] ⚠ WiFi not connected - buffering data");
        bufferSensorReading(reading);
        bufferTankLevel(reading.tankLevel);
        printBufferStats();
      }
    } else {
      DEBUG_PRINTLN("[LOOP] ERROR: Sensor reading invalid - skipping transmission");
    }
    
    DEBUG_PRINTLN("--- End of Cycle ---");
    DEBUG_PRINTLN("========================================\n");
    lastReadingTime = currentTime;
  }
  
  // Small delay to prevent watchdog timer issues
  delay(100);
}

/**
 * Check for configuration updates from backend
 * Fetches current configuration and updates local settings if changed
 * 
 * Requirements: 14.7
 * Task 19.1: Handle configuration updates from backend
 */
void checkConfigurationUpdates() {
  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_PRINTLN("[CONFIG] WiFi not connected - skipping config check");
    return;
  }
  
  HTTPClient http;
  String url = String(API_BASE_URL) + "/api/v1/config";
  
  DEBUG_PRINTF("[CONFIG] GET %s\n", url.c_str());
  
  // Begin HTTP connection
  http.begin(url);
  http.setTimeout(API_TIMEOUT_MS);
  
  // Send GET request
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String response = http.getString();
    DEBUG_PRINTLN("[CONFIG] ✓ Configuration retrieved from backend");
    DEBUG_PRINTF("[CONFIG] Response: %s\n", response.c_str());
    
    // Parse JSON response
    StaticJsonDocument<1024> doc;
    DeserializationError error = deserializeJson(doc, response);
    
    if (error) {
      DEBUG_PRINTF("[CONFIG] ✗ JSON parsing failed: %s\n", error.c_str());
      http.end();
      return;
    }
    
    // Extract polling interval (in seconds, convert to milliseconds)
    if (doc.containsKey("sensor_polling_interval_seconds")) {
      unsigned long newInterval = doc["sensor_polling_interval_seconds"].as<unsigned long>() * 1000;
      
      // Validate interval (10 seconds to 300 seconds as per requirements)
      if (newInterval >= 10000 && newInterval <= 300000) {
        if (newInterval != currentPollingInterval) {
          DEBUG_PRINTF("[CONFIG] ✓ Updating polling interval: %lu ms -> %lu ms\n", 
                       currentPollingInterval, newInterval);
          currentPollingInterval = newInterval;
          
          // Save to preferences for persistence across reboots
          preferences.begin("config", false);
          preferences.putULong("pollInterval", currentPollingInterval);
          preferences.end();
          
          DEBUG_PRINTLN("[CONFIG] ✓ Polling interval updated and saved");
        } else {
          DEBUG_PRINTLN("[CONFIG] Polling interval unchanged");
        }
      } else {
        DEBUG_PRINTF("[CONFIG] ✗ Invalid polling interval: %lu ms (must be 10-300 seconds)\n", 
                     newInterval);
      }
    }
    
    // Extract tank dimensions if provided
    if (doc.containsKey("tank_dimensions")) {
      JsonObject tankDims = doc["tank_dimensions"];
      if (tankDims.containsKey("height_cm")) {
        float newHeight = tankDims["height_cm"].as<float>();
        DEBUG_PRINTF("[CONFIG] Tank height from backend: %.2f cm\n", newHeight);
        // Note: Tank dimensions are compile-time constants in config.h
        // In a production system, these would be stored in preferences
      }
    }
    
    DEBUG_PRINTLN("[CONFIG] Configuration check complete");
  } else if (httpResponseCode == 401 || httpResponseCode == 403) {
    DEBUG_PRINTF("[CONFIG] ✗ Authentication required (status %d)\n", httpResponseCode);
    DEBUG_PRINTLN("[CONFIG] Note: Config endpoint may require admin authentication");
  } else if (httpResponseCode > 0) {
    DEBUG_PRINTF("[CONFIG] ✗ HTTP error: %d\n", httpResponseCode);
  } else {
    DEBUG_PRINTF("[CONFIG] ✗ Request failed: %s\n", 
                 http.errorToString(httpResponseCode).c_str());
  }
  
  http.end();
}

/**
 * Load saved configuration from preferences
 * Called during setup to restore configuration from previous session
 */
void loadSavedConfiguration() {
  preferences.begin("config", true); // true = read-only
  
  // Load polling interval if saved
  if (preferences.isKey("pollInterval")) {
    unsigned long savedInterval = preferences.getULong("pollInterval", SENSOR_POLLING_INTERVAL_MS);
    
    // Validate saved interval
    if (savedInterval >= 10000 && savedInterval <= 300000) {
      currentPollingInterval = savedInterval;
      DEBUG_PRINTF("[CONFIG] Loaded saved polling interval: %lu ms (%lu seconds)\n", 
                   currentPollingInterval, currentPollingInterval / 1000);
    } else {
      DEBUG_PRINTLN("[CONFIG] Saved interval invalid - using default");
      currentPollingInterval = SENSOR_POLLING_INTERVAL_MS;
    }
  } else {
    DEBUG_PRINTLN("[CONFIG] No saved configuration - using defaults");
    currentPollingInterval = SENSOR_POLLING_INTERVAL_MS;
  }
  
  preferences.end();
}

/**
 * Placeholder implementations for modules to be completed in later tasks
 * These will be replaced with actual implementations in Tasks 17-19
 */

// Calibration functions (Task 17)
Preferences preferences;

void initializeCalibration() {
  DEBUG_PRINTLN("[CALIBRATION] Initializing calibration system...");
  
  // Initialize Preferences library for non-volatile storage
  preferences.begin("calibration", false); // false = read/write mode
  
  // Check if calibration data exists, if not, initialize with defaults
  if (!preferences.isKey("initialized")) {
    DEBUG_PRINTLN("[CALIBRATION] No calibration data found - initializing defaults");
    CalibrationData defaultCal;
    defaultCal.phOffset = CALIBRATION_PH_OFFSET;
    defaultCal.turbidityOffset = CALIBRATION_TURBIDITY_OFFSET;
    defaultCal.temperatureOffset = CALIBRATION_TEMP_OFFSET;
    defaultCal.tdsOffset = CALIBRATION_TDS_OFFSET;
    defaultCal.doOffset = CALIBRATION_DO_OFFSET;
    
    saveCalibration(defaultCal);
    preferences.putBool("initialized", true);
  }
  
  // Load and display current calibration
  CalibrationData cal = loadCalibration();
  DEBUG_PRINTLN("[CALIBRATION] Current calibration offsets:");
  DEBUG_PRINTF("  pH: %.3f\n", cal.phOffset);
  DEBUG_PRINTF("  Turbidity: %.3f NTU\n", cal.turbidityOffset);
  DEBUG_PRINTF("  Temperature: %.3f °C\n", cal.temperatureOffset);
  DEBUG_PRINTF("  TDS: %.3f ppm\n", cal.tdsOffset);
  DEBUG_PRINTF("  Dissolved Oxygen: %.3f mg/L\n", cal.doOffset);
  
  preferences.end();
  DEBUG_PRINTLN("[CALIBRATION] Calibration system initialized");
}

CalibrationData loadCalibration() {
  CalibrationData cal;
  preferences.begin("calibration", true); // true = read-only mode
  
  cal.phOffset = preferences.getFloat("phOffset", CALIBRATION_PH_OFFSET);
  cal.turbidityOffset = preferences.getFloat("turbOffset", CALIBRATION_TURBIDITY_OFFSET);
  cal.temperatureOffset = preferences.getFloat("tempOffset", CALIBRATION_TEMP_OFFSET);
  cal.tdsOffset = preferences.getFloat("tdsOffset", CALIBRATION_TDS_OFFSET);
  cal.doOffset = preferences.getFloat("doOffset", CALIBRATION_DO_OFFSET);
  
  preferences.end();
  return cal;
}

void saveCalibration(const CalibrationData& calibration) {
  preferences.begin("calibration", false); // false = read/write mode
  
  preferences.putFloat("phOffset", calibration.phOffset);
  preferences.putFloat("turbOffset", calibration.turbidityOffset);
  preferences.putFloat("tempOffset", calibration.temperatureOffset);
  preferences.putFloat("tdsOffset", calibration.tdsOffset);
  preferences.putFloat("doOffset", calibration.doOffset);
  
  preferences.end();
  
  DEBUG_PRINTLN("[CALIBRATION] Calibration data saved to non-volatile memory");
}

void resetCalibration() {
  DEBUG_PRINTLN("[CALIBRATION] Resetting calibration to defaults...");
  
  CalibrationData defaultCal;
  defaultCal.phOffset = CALIBRATION_PH_OFFSET;
  defaultCal.turbidityOffset = CALIBRATION_TURBIDITY_OFFSET;
  defaultCal.temperatureOffset = CALIBRATION_TEMP_OFFSET;
  defaultCal.tdsOffset = CALIBRATION_TDS_OFFSET;
  defaultCal.doOffset = CALIBRATION_DO_OFFSET;
  
  saveCalibration(defaultCal);
  DEBUG_PRINTLN("[CALIBRATION] Calibration reset complete");
}

float applyCalibration(float rawValue, float offset) {
  return rawValue + offset;
}

// Sensor functions (Task 17)
#include <OneWire.h>
#include <DallasTemperature.h>

// DS18B20 Temperature sensor setup
OneWire oneWire(PIN_TEMP_SENSOR);
DallasTemperature tempSensor(&oneWire);

void initializeSensors() {
  DEBUG_PRINTLN("[SENSORS] Initializing sensor system...");
  
  // Configure ADC
  DEBUG_PRINTLN("[SENSORS] Configuring ADC...");
  analogReadResolution(ADC_RESOLUTION);
  analogSetAttenuation(ADC_11db); // Full range: 0-3.3V
  DEBUG_PRINTLN("[SENSORS] ADC configured for 12-bit resolution (0-4095)");
  
  // Initialize analog sensor pins
  pinMode(PIN_PH_SENSOR, INPUT);
  pinMode(PIN_TURBIDITY_SENSOR, INPUT);
  pinMode(PIN_TDS_SENSOR, INPUT);
  pinMode(PIN_DO_SENSOR, INPUT);
  DEBUG_PRINTLN("[SENSORS] Analog sensor pins initialized");
  
  // Initialize DS18B20 temperature sensor
  DEBUG_PRINTLN("[SENSORS] Initializing DS18B20 temperature sensor...");
  tempSensor.begin();
  int deviceCount = tempSensor.getDeviceCount();
  if (deviceCount > 0) {
    DEBUG_PRINTF("[SENSORS] Found %d DS18B20 device(s)\n", deviceCount);
    tempSensor.setResolution(12); // 12-bit resolution (0.0625°C precision)
    DEBUG_PRINTLN("[SENSORS] DS18B20 configured for 12-bit resolution");
  } else {
    DEBUG_PRINTLN("[SENSORS] WARNING: No DS18B20 temperature sensor detected!");
  }
  
  // Initialize ultrasonic sensor pins
  pinMode(PIN_ULTRASONIC_TRIGGER, OUTPUT);
  pinMode(PIN_ULTRASONIC_ECHO, INPUT);
  digitalWrite(PIN_ULTRASONIC_TRIGGER, LOW);
  DEBUG_PRINTLN("[SENSORS] Ultrasonic sensor pins initialized");
  
  // Perform sensor health check
  DEBUG_PRINTLN("[SENSORS] Performing sensor health check...");
  delay(100); // Allow sensors to stabilize
  
  bool allHealthy = true;
  
  // Test pH sensor
  int phRaw = analogRead(PIN_PH_SENSOR);
  if (phRaw > 0 && phRaw < ADC_MAX_VALUE) {
    DEBUG_PRINTF("[SENSORS] ✓ pH sensor: OK (raw: %d)\n", phRaw);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ pH sensor: WARNING (raw: %d)\n", phRaw);
    allHealthy = false;
  }
  
  // Test turbidity sensor
  int turbRaw = analogRead(PIN_TURBIDITY_SENSOR);
  if (turbRaw > 0 && turbRaw < ADC_MAX_VALUE) {
    DEBUG_PRINTF("[SENSORS] ✓ Turbidity sensor: OK (raw: %d)\n", turbRaw);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ Turbidity sensor: WARNING (raw: %d)\n", turbRaw);
    allHealthy = false;
  }
  
  // Test temperature sensor
  tempSensor.requestTemperatures();
  float tempTest = tempSensor.getTempCByIndex(0);
  if (tempTest != DEVICE_DISCONNECTED_C && tempTest > -50 && tempTest < 100) {
    DEBUG_PRINTF("[SENSORS] ✓ Temperature sensor: OK (%.2f °C)\n", tempTest);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ Temperature sensor: FAILED (%.2f °C)\n", tempTest);
    allHealthy = false;
  }
  
  // Test TDS sensor
  int tdsRaw = analogRead(PIN_TDS_SENSOR);
  if (tdsRaw > 0 && tdsRaw < ADC_MAX_VALUE) {
    DEBUG_PRINTF("[SENSORS] ✓ TDS sensor: OK (raw: %d)\n", tdsRaw);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ TDS sensor: WARNING (raw: %d)\n", tdsRaw);
    allHealthy = false;
  }
  
  // Test DO sensor
  int doRaw = analogRead(PIN_DO_SENSOR);
  if (doRaw > 0 && doRaw < ADC_MAX_VALUE) {
    DEBUG_PRINTF("[SENSORS] ✓ DO sensor: OK (raw: %d)\n", doRaw);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ DO sensor: WARNING (raw: %d)\n", doRaw);
    allHealthy = false;
  }
  
  // Test ultrasonic sensor
  float distTest = readUltrasonic();
  if (distTest > 0 && distTest < ULTRASONIC_MAX_DISTANCE_CM) {
    DEBUG_PRINTF("[SENSORS] ✓ Ultrasonic sensor: OK (%.2f cm)\n", distTest);
  } else {
    DEBUG_PRINTF("[SENSORS] ✗ Ultrasonic sensor: WARNING (%.2f cm)\n", distTest);
    allHealthy = false;
  }
  
  if (allHealthy) {
    DEBUG_PRINTLN("[SENSORS] ✓ All sensors passed health check");
  } else {
    DEBUG_PRINTLN("[SENSORS] ⚠ Some sensors failed health check - will continue with available sensors");
  }
  
  DEBUG_PRINTLN("[SENSORS] Sensor initialization complete");
}

SensorReading acquireSensorData() {
  SensorReading reading;
  unsigned long startTime = millis();
  
  DEBUG_PRINTLN("[SENSORS] Starting sensor data acquisition...");
  
  // Read all sensors with error handling
  reading.ph = readPH();
  reading.turbidity = readTurbidity();
  reading.temperature = readTemperature();
  reading.tds = readTDS();
  reading.dissolvedOxygen = readDissolvedOxygen();
  reading.tankLevel = readUltrasonic();
  
  // Set timestamp
  reading.timestamp = String(millis());
  
  // Validate each reading is within physical sensor range
  bool allValid = true;
  
  // Validate pH (0-14)
  if (isnan(reading.ph) || reading.ph < PH_MIN || reading.ph > PH_MAX) {
    DEBUG_PRINTF("[SENSORS] ✗ pH reading invalid: %.2f (expected %.1f-%.1f)\n", 
                 reading.ph, PH_MIN, PH_MAX);
    reading.ph = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ pH reading valid: %.2f\n", reading.ph);
  }
  
  // Validate turbidity (0-3000 NTU)
  if (isnan(reading.turbidity) || reading.turbidity < TURBIDITY_MIN || reading.turbidity > TURBIDITY_MAX) {
    DEBUG_PRINTF("[SENSORS] ✗ Turbidity reading invalid: %.2f (expected %.1f-%.1f)\n", 
                 reading.turbidity, TURBIDITY_MIN, TURBIDITY_MAX);
    reading.turbidity = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ Turbidity reading valid: %.2f NTU\n", reading.turbidity);
  }
  
  // Validate temperature (-55 to 125°C)
  if (isnan(reading.temperature) || reading.temperature < TEMP_MIN || reading.temperature > TEMP_MAX) {
    DEBUG_PRINTF("[SENSORS] ✗ Temperature reading invalid: %.2f (expected %.1f-%.1f)\n", 
                 reading.temperature, TEMP_MIN, TEMP_MAX);
    reading.temperature = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ Temperature reading valid: %.2f °C\n", reading.temperature);
  }
  
  // Validate TDS (0-1000 ppm)
  if (isnan(reading.tds) || reading.tds < TDS_MIN || reading.tds > TDS_MAX) {
    DEBUG_PRINTF("[SENSORS] ✗ TDS reading invalid: %.2f (expected %.1f-%.1f)\n", 
                 reading.tds, TDS_MIN, TDS_MAX);
    reading.tds = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ TDS reading valid: %.2f ppm\n", reading.tds);
  }
  
  // Validate dissolved oxygen (0-20 mg/L)
  if (isnan(reading.dissolvedOxygen) || reading.dissolvedOxygen < DO_MIN || reading.dissolvedOxygen > DO_MAX) {
    DEBUG_PRINTF("[SENSORS] ✗ DO reading invalid: %.2f (expected %.1f-%.1f)\n", 
                 reading.dissolvedOxygen, DO_MIN, DO_MAX);
    reading.dissolvedOxygen = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ DO reading valid: %.2f mg/L\n", reading.dissolvedOxygen);
  }
  
  // Validate tank level (ultrasonic reading)
  if (isnan(reading.tankLevel) || reading.tankLevel < 0 || reading.tankLevel > ULTRASONIC_MAX_DISTANCE_CM) {
    DEBUG_PRINTF("[SENSORS] ✗ Tank level reading invalid: %.2f (expected 0-%.1f)\n", 
                 reading.tankLevel, (float)ULTRASONIC_MAX_DISTANCE_CM);
    reading.tankLevel = NAN;
    allValid = false;
  } else {
    DEBUG_PRINTF("[SENSORS] ✓ Tank level reading valid: %.2f cm\n", reading.tankLevel);
  }
  
  // Set overall validity flag
  reading.valid = allValid;
  
  unsigned long elapsedTime = millis() - startTime;
  DEBUG_PRINTF("[SENSORS] Data acquisition completed in %lu ms\n", elapsedTime);
  
  if (elapsedTime > 2000) {
    DEBUG_PRINTLN("[SENSORS] WARNING: Acquisition time exceeded 2 second requirement!");
  }
  
  if (allValid) {
    DEBUG_PRINTLN("[SENSORS] ✓ All sensor readings valid");
  } else {
    DEBUG_PRINTLN("[SENSORS] ⚠ Some sensor readings invalid - marked as NaN");
  }
  
  return reading;
}

bool validateReading(const SensorReading& reading) {
  // Check if reading has valid flag set
  if (!reading.valid) {
    DEBUG_PRINTLN("[VALIDATION] Reading marked as invalid");
    return false;
  }
  
  // Count how many sensors have valid readings
  int validCount = 0;
  int totalCount = 6;
  
  if (!isnan(reading.ph)) validCount++;
  if (!isnan(reading.turbidity)) validCount++;
  if (!isnan(reading.temperature)) validCount++;
  if (!isnan(reading.tds)) validCount++;
  if (!isnan(reading.dissolvedOxygen)) validCount++;
  if (!isnan(reading.tankLevel)) validCount++;
  
  DEBUG_PRINTF("[VALIDATION] Valid sensors: %d/%d\n", validCount, totalCount);
  
  // Require at least 4 out of 6 sensors to have valid readings
  if (validCount < 4) {
    DEBUG_PRINTLN("[VALIDATION] ✗ Too many sensor failures - reading rejected");
    return false;
  }
  
  DEBUG_PRINTLN("[VALIDATION] ✓ Reading validation passed");
  return true;
}

float readPH() {
  // Read multiple samples and average for stability
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_PH_SENSOR);
    delay(10);
  }
  float avgRaw = sum / (float)ADC_SAMPLES;
  
  // Convert ADC value to voltage
  float voltage = (avgRaw / ADC_MAX_VALUE) * ADC_VOLTAGE;
  
  // Convert voltage to pH using linear conversion
  // pH = 7 + (voltage - PH_VOLTAGE_AT_7) / PH_VOLTAGE_PER_UNIT
  float ph = 7.0 + (voltage - PH_VOLTAGE_AT_7) / PH_VOLTAGE_PER_UNIT;
  
  // Apply calibration offset
  CalibrationData cal = loadCalibration();
  ph = applyCalibration(ph, cal.phOffset);
  
  DEBUG_PRINTF("[SENSOR] pH: raw=%.0f, voltage=%.3fV, pH=%.2f\n", avgRaw, voltage, ph);
  return ph;
}

float readTurbidity() {
  // Read multiple samples and average
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_TURBIDITY_SENSOR);
    delay(10);
  }
  float avgRaw = sum / (float)ADC_SAMPLES;
  
  // Convert ADC value to voltage
  float voltage = (avgRaw / ADC_MAX_VALUE) * ADC_VOLTAGE;
  
  // Convert voltage to NTU (inverse relationship - higher voltage = clearer water)
  // NTU = MAX_NTU * (1 - voltage / CLEAR_VOLTAGE)
  float ntu = 0.0;
  if (voltage < TURBIDITY_CLEAR_VOLTAGE) {
    ntu = TURBIDITY_MAX_NTU * (1.0 - (voltage / TURBIDITY_CLEAR_VOLTAGE));
  }
  
  // Ensure non-negative
  if (ntu < 0) ntu = 0;
  
  // Apply calibration offset
  CalibrationData cal = loadCalibration();
  ntu = applyCalibration(ntu, cal.turbidityOffset);
  
  // Ensure within valid range
  if (ntu < 0) ntu = 0;
  if (ntu > TURBIDITY_MAX_NTU) ntu = TURBIDITY_MAX_NTU;
  
  DEBUG_PRINTF("[SENSOR] Turbidity: raw=%.0f, voltage=%.3fV, NTU=%.2f\n", avgRaw, voltage, ntu);
  return ntu;
}

float readTemperature() {
  // Request temperature reading from DS18B20
  tempSensor.requestTemperatures();
  
  // Get temperature in Celsius
  float tempC = tempSensor.getTempCByIndex(0);
  
  // Check for sensor error
  if (tempC == DEVICE_DISCONNECTED_C) {
    DEBUG_PRINTLN("[SENSOR] Temperature: ERROR - Sensor disconnected");
    return NAN;
  }
  
  // Apply calibration offset
  CalibrationData cal = loadCalibration();
  tempC = applyCalibration(tempC, cal.temperatureOffset);
  
  DEBUG_PRINTF("[SENSOR] Temperature: %.2f °C\n", tempC);
  return tempC;
}

float readTDS() {
  // Read multiple samples and average
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_TDS_SENSOR);
    delay(10);
  }
  float avgRaw = sum / (float)ADC_SAMPLES;
  
  // Convert ADC value to voltage
  float voltage = (avgRaw / ADC_MAX_VALUE) * ADC_VOLTAGE;
  
  // Get temperature for compensation (use last reading or default)
  float temperature = 25.0; // Default temperature
  tempSensor.requestTemperatures();
  float tempReading = tempSensor.getTempCByIndex(0);
  if (tempReading != DEVICE_DISCONNECTED_C) {
    temperature = tempReading;
  }
  
  // Convert voltage to TDS with temperature compensation
  // TDS (ppm) = (voltage * conversion_factor) / (1 + temp_coefficient * (temperature - 25))
  float compensationCoefficient = 1.0 + TDS_TEMP_COEFFICIENT * (temperature - 25.0);
  float tds = (voltage * TDS_CONVERSION_FACTOR * 1000.0) / compensationCoefficient;
  
  // Apply calibration offset
  CalibrationData cal = loadCalibration();
  tds = applyCalibration(tds, cal.tdsOffset);
  
  // Ensure within valid range
  if (tds < 0) tds = 0;
  if (tds > TDS_MAX) tds = TDS_MAX;
  
  DEBUG_PRINTF("[SENSOR] TDS: raw=%.0f, voltage=%.3fV, temp=%.1f°C, ppm=%.2f\n", 
               avgRaw, voltage, temperature, tds);
  return tds;
}

float readDissolvedOxygen() {
  // Read multiple samples and average
  long sum = 0;
  for (int i = 0; i < ADC_SAMPLES; i++) {
    sum += analogRead(PIN_DO_SENSOR);
    delay(10);
  }
  float avgRaw = sum / (float)ADC_SAMPLES;
  
  // Convert ADC value to voltage
  float voltage = (avgRaw / ADC_MAX_VALUE) * ADC_VOLTAGE;
  
  // Convert voltage to dissolved oxygen (mg/L)
  // Linear conversion: DO = (voltage - DO_VOLTAGE_AT_0) * (DO_MAX_VALUE / (DO_VOLTAGE_AT_MAX - DO_VOLTAGE_AT_0))
  float doValue = ((voltage - DO_VOLTAGE_AT_0) / (DO_VOLTAGE_AT_MAX - DO_VOLTAGE_AT_0)) * DO_MAX_VALUE;
  
  // Ensure non-negative
  if (doValue < 0) doValue = 0;
  
  // Apply calibration offset
  CalibrationData cal = loadCalibration();
  doValue = applyCalibration(doValue, cal.doOffset);
  
  // Ensure within valid range
  if (doValue < 0) doValue = 0;
  if (doValue > DO_MAX_VALUE) doValue = DO_MAX_VALUE;
  
  DEBUG_PRINTF("[SENSOR] DO: raw=%.0f, voltage=%.3fV, mg/L=%.2f\n", avgRaw, voltage, doValue);
  return doValue;
}

float readUltrasonic() {
  // Clear trigger pin
  digitalWrite(PIN_ULTRASONIC_TRIGGER, LOW);
  delayMicroseconds(2);
  
  // Send 10us pulse to trigger
  digitalWrite(PIN_ULTRASONIC_TRIGGER, HIGH);
  delayMicroseconds(10);
  digitalWrite(PIN_ULTRASONIC_TRIGGER, LOW);
  
  // Read echo pulse duration (timeout after 30ms = ~5m range)
  long duration = pulseIn(PIN_ULTRASONIC_ECHO, HIGH, 30000);
  
  // Calculate distance in cm
  // Speed of sound = 343 m/s = 0.0343 cm/us
  // Distance = (duration / 2) * 0.0343
  float distanceCm = (duration / 2.0) * 0.0343;
  
  // Check for timeout or invalid reading
  if (duration == 0 || distanceCm > ULTRASONIC_MAX_DISTANCE_CM) {
    DEBUG_PRINTLN("[SENSOR] Ultrasonic: ERROR - No echo received or out of range");
    return NAN;
  }
  
  DEBUG_PRINTF("[SENSOR] Ultrasonic: duration=%ldus, distance=%.2f cm\n", duration, distanceCm);
  return distanceCm;
}


