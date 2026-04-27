/**
 * Configuration File for Water Quality Monitoring System
 * ESP32 Sensor Module
 * 
 * Configure WiFi credentials, backend API, sensor pins, and calibration values
 */

#ifndef CONFIG_H
#define CONFIG_H

// ============================================================================
// WiFi Configuration
// ============================================================================

#define WIFI_SSID "YOUR_WIFI_SSID"          // Replace with your WiFi network name
#define WIFI_PASSWORD "YOUR_WIFI_PASSWORD"  // Replace with your WiFi password
#define WIFI_TIMEOUT_MS 20000               // WiFi connection timeout (20 seconds)
#define WIFI_RETRY_DELAY_MS 5000            // Delay between WiFi reconnection attempts

// ============================================================================
// Backend API Configuration
// ============================================================================

#define API_BASE_URL "http://192.168.1.100:8000"  // Replace with your backend URL
#define API_SENSOR_DATA_ENDPOINT "/api/v1/sensor-data"
#define API_TANK_LEVEL_ENDPOINT "/api/v1/tank-level"
#define API_TIMEOUT_MS 10000                // HTTP request timeout (10 seconds)

// ============================================================================
// Device Configuration
// ============================================================================

#define DEVICE_ID "ESP32_001"               // Unique device identifier
#define SENSOR_POLLING_INTERVAL_MS 30000    // Sensor reading interval (30 seconds)

// ============================================================================
// Sensor Pin Assignments (GPIO)
// ============================================================================

// Analog Sensors (ADC1 pins - compatible with WiFi)
#define PIN_PH_SENSOR 34                    // GPIO 34 (ADC1_CH6)
#define PIN_TURBIDITY_SENSOR 35             // GPIO 35 (ADC1_CH7)
#define PIN_TDS_SENSOR 32                   // GPIO 32 (ADC1_CH4)
#define PIN_DO_SENSOR 33                    // GPIO 33 (ADC1_CH5)

// Digital Sensors
#define PIN_TEMP_SENSOR 4                   // GPIO 4 (DS18B20 1-Wire)
#define PIN_ULTRASONIC_TRIGGER 5            // GPIO 5 (HC-SR04 Trigger)
#define PIN_ULTRASONIC_ECHO 18              // GPIO 18 (HC-SR04 Echo)

// ============================================================================
// ADC Configuration
// ============================================================================

#define ADC_RESOLUTION 12                   // 12-bit ADC (0-4095)
#define ADC_MAX_VALUE 4095                  // Maximum ADC reading
#define ADC_VOLTAGE 3.3                     // ESP32 ADC reference voltage (3.3V)
#define ADC_SAMPLES 10                      // Number of samples for averaging

// ============================================================================
// Sensor Calibration Offsets
// ============================================================================
// These values are added to raw sensor readings
// Adjust after calibration with reference solutions

#define CALIBRATION_PH_OFFSET 0.0           // pH calibration offset
#define CALIBRATION_TURBIDITY_OFFSET 0.0    // Turbidity calibration offset (NTU)
#define CALIBRATION_TEMP_OFFSET 0.0         // Temperature calibration offset (°C)
#define CALIBRATION_TDS_OFFSET 0.0          // TDS calibration offset (ppm)
#define CALIBRATION_DO_OFFSET 0.0           // Dissolved Oxygen calibration offset (mg/L)

// ============================================================================
// Sensor Conversion Constants
// ============================================================================

// pH Sensor (assuming linear voltage-to-pH conversion)
#define PH_VOLTAGE_AT_7 2.5                 // Voltage at pH 7 (neutral)
#define PH_VOLTAGE_PER_UNIT 0.18            // Voltage change per pH unit

// Turbidity Sensor (NTU conversion)
#define TURBIDITY_CLEAR_VOLTAGE 4.2         // Voltage for clear water (0 NTU)
#define TURBIDITY_MAX_NTU 3000              // Maximum turbidity reading

// TDS Sensor (ppm conversion)
#define TDS_CONVERSION_FACTOR 0.5           // Conversion factor for TDS calculation
#define TDS_TEMP_COEFFICIENT 0.02           // Temperature compensation coefficient

// Dissolved Oxygen Sensor (mg/L conversion)
#define DO_VOLTAGE_AT_0 0.0                 // Voltage at 0 mg/L
#define DO_VOLTAGE_AT_MAX 3.3               // Voltage at maximum DO
#define DO_MAX_VALUE 20.0                   // Maximum DO reading (mg/L)

// ============================================================================
// Tank Configuration
// ============================================================================

#define TANK_HEIGHT_CM 200                  // Total tank height in centimeters
#define TANK_DIAMETER_CM 100                // Tank diameter in centimeters
#define ULTRASONIC_MAX_DISTANCE_CM 400      // Maximum ultrasonic sensor range

// ============================================================================
// Data Buffering Configuration
// ============================================================================

#define BUFFER_SIZE 100                     // Maximum number of readings to buffer
#define BUFFER_ENABLED true                 // Enable/disable offline buffering

// ============================================================================
// Sensor Validation Ranges
// ============================================================================
// Readings outside these ranges are considered invalid

#define PH_MIN 0.0
#define PH_MAX 14.0

#define TURBIDITY_MIN 0.0
#define TURBIDITY_MAX 3000.0

#define TEMP_MIN -55.0
#define TEMP_MAX 125.0

#define TDS_MIN 0.0
#define TDS_MAX 1000.0

#define DO_MIN 0.0
#define DO_MAX 20.0

// ============================================================================
// Debug Configuration
// ============================================================================

#define DEBUG_ENABLED true                  // Enable/disable serial debug output
#define SERIAL_BAUD_RATE 115200            // Serial monitor baud rate

// Debug macros
#if DEBUG_ENABLED
  #define DEBUG_PRINT(x) Serial.print(x)
  #define DEBUG_PRINTLN(x) Serial.println(x)
  #define DEBUG_PRINTF(x, ...) Serial.printf(x, __VA_ARGS__)
#else
  #define DEBUG_PRINT(x)
  #define DEBUG_PRINTLN(x)
  #define DEBUG_PRINTF(x, ...)
#endif

// ============================================================================
// HTTP Retry Configuration
// ============================================================================

#define HTTP_MAX_RETRIES 3                  // Maximum number of HTTP retry attempts
#define HTTP_RETRY_DELAY_MS 1000            // Initial retry delay (exponential backoff)

#endif // CONFIG_H
