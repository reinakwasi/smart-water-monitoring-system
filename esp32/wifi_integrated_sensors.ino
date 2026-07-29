// WATER QUALITY MONITOR WITH WIFI INTEGRATION
// ESP32 + 4 Sensors + Service Integration
// Legacy test sketch. The final demo uses final_esp32_water_quality_monitor.ino.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ============== CONFIGURATION ==============
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Monitoring service configuration
const char* API_BASE_URL = "http://192.168.2.88:8080";  // Use your laptop IPv4 address and service port
const char* API_ENDPOINT = "/api/v1/sensor/sensor-data";

// Device ID (unique identifier for this ESP32)
const char* DEVICE_ID = "ESP32_001";
// Optional setup key for key-based uploads. Leave blank for simple project uploads when enabled.
const char* DEVICE_API_KEY = "";

// Sensor pins
#define TDS_PIN 34        // TDS sensor on D34 (CONFIRMED WORKING!)
#define PH_PIN 35         // pH sensor on D35
#define TURBIDITY_PIN 32  // Turbidity on D32
#define TEMPERATURE_PIN 33  // DS18B20 data pin; requires 4.7k pull-up to 3.3V

// Timing
#define SENSOR_SAMPLE_INTERVAL 40   // Sample TDS every 40ms
#define SEND_DATA_INTERVAL 30000    // Send to the monitoring service every 30 seconds
#define WIFI_RETRY_DELAY 5000       // Retry WiFi connection every 5 seconds

// ADC Configuration
#define VREF 3.3
#define SCOUNT 30

// Turbidity calibration constants for NTU.
// For best accuracy, update these with your own clear-water and known-NTU reference readings.
#define TURBIDITY_CLEAR_WATER_VOLTAGE 1.72
#define TURBIDITY_CLEAR_WATER_DEADBAND 0.04
#define TURBIDITY_CALIBRATION_VOLTAGE 1.20
#define TURBIDITY_CALIBRATION_NTU 400.0

// ============== GLOBAL VARIABLES ==============
int tdsBuffer[SCOUNT];
int tdsBufferIndex = 0;
OneWire oneWire(TEMPERATURE_PIN);
DallasTemperature temperatureSensors(&oneWire);

struct SensorReadings {
  float ph;
  float turbidity_index;  // Turbidity in NTU; field name kept for API compatibility
  float temperature;
  float tds;
  bool temperatureValid;
};

unsigned long lastSendTime = 0;
unsigned long lastSensorSampleTime = 0;

// ============== MEDIAN FILTER ==============
int getMedianNum(int bArray[], int iFilterLen) {
  int bTab[iFilterLen];
  for (int i = 0; i < iFilterLen; i++) bTab[i] = bArray[i];

  int i, j, bTemp;
  for (j = 0; j < iFilterLen - 1; j++) {
    for (i = 0; i < iFilterLen - j - 1; i++) {
      if (bTab[i] > bTab[i + 1]) {
        bTemp = bTab[i];
        bTab[i] = bTab[i + 1];
        bTab[i + 1] = bTemp;
      }
    }
  }

  if ((iFilterLen & 1) > 0)
    bTemp = bTab[(iFilterLen - 1) / 2];
  else
    bTemp = (bTab[iFilterLen / 2] + bTab[iFilterLen / 2 - 1]) / 2;

  return bTemp;
}

// ============== WIFI CONNECTION ==============
void connectToWiFi() {
  Serial.println("\n[WiFi] Connecting to WiFi...");
  Serial.print("[WiFi] SSID: ");
  Serial.println(WIFI_SSID);

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[WiFi] ✓ Connected!");
    Serial.print("[WiFi] IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[WiFi] ✗ Connection failed!");
    Serial.println("[WiFi] Will retry in 5 seconds...");
  }
}

// ============== TURBIDITY CONVERSION ==============
float calculateTurbidityNTU(float turbidityVoltage) {
  float voltageDrop = TURBIDITY_CLEAR_WATER_VOLTAGE - turbidityVoltage;
  float calibrationDrop = TURBIDITY_CLEAR_WATER_VOLTAGE - TURBIDITY_CALIBRATION_VOLTAGE;

  if (voltageDrop <= TURBIDITY_CLEAR_WATER_DEADBAND) return 0.5;

  float adjustedDrop = voltageDrop - TURBIDITY_CLEAR_WATER_DEADBAND;
  float adjustedCalibrationDrop = calibrationDrop - TURBIDITY_CLEAR_WATER_DEADBAND;

  if (adjustedCalibrationDrop <= 0) return 0.5;

  float ntu = adjustedDrop * (TURBIDITY_CALIBRATION_NTU / adjustedCalibrationDrop);
  if (ntu < 0) ntu = 0;
  if (ntu > 3000) ntu = 3000;
  return ntu;
}

// ============== SENSOR READING ==============
SensorReadings readSensors() {
  SensorReadings readings;

  // Read the DS18B20 first so its actual value can compensate the TDS reading.
  temperatureSensors.requestTemperatures();
  float measuredTemperature = temperatureSensors.getTempCByIndex(0);
  readings.temperatureValid = measuredTemperature != DEVICE_DISCONNECTED_C
    && measuredTemperature != 85.0
    && !isnan(measuredTemperature)
    && measuredTemperature >= -55.0
    && measuredTemperature <= 125.0;
  readings.temperature = readings.temperatureValid
    ? round(measuredTemperature * 10) / 10.0
    : NAN;

  // Read pH and Turbidity
  int ph_adc = analogRead(PH_PIN);
  int turb_adc = analogRead(TURBIDITY_PIN);

  // Calculate TDS with proper formula
  int tds_median = getMedianNum(tdsBuffer, SCOUNT);
  float tds_voltage = tds_median * VREF / 4096.0;
  float compensationTemperature = readings.temperatureValid ? readings.temperature : 25.0;
  float compensationCoefficient = 1.0 + 0.02 * (compensationTemperature - 25.0);
  float compensationVoltage = tds_voltage / compensationCoefficient;
  float tds_ppm = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                   - 255.86 * compensationVoltage * compensationVoltage
                   + 857.39 * compensationVoltage) * 0.5;

  // Convert pH and Turbidity to voltages
  float ph_volt = ph_adc * (3.3 / 4095.0);
  float turb_volt = turb_adc * (3.3 / 4095.0);

  // Calculate values
  float ph_value = 7.0 + ((ph_volt - 1.65) / 0.18);
  float turbidity_ntu = calculateTurbidityNTU(turb_volt);

  // Limit ranges
  if(ph_value < 0) ph_value = 0;
  if(ph_value > 14) ph_value = 14;
  if(turbidity_ntu < 0) turbidity_ntu = 0;
  if(turbidity_ntu > 3000) turbidity_ntu = 3000;
  if(tds_ppm < 0) tds_ppm = 0;

  // Round to correct precision
  readings.ph = round(ph_value * 10) / 10.0;  // ±0.1
  readings.turbidity_index = round(turbidity_ntu * 10) / 10.0;  // Estimated NTU
  readings.tds = round(tds_ppm);  // ±10 ppm (integer)

  return readings;
}

// ============== SEND DATA TO BACKEND ==============
bool sendDataToBackend(SensorReadings readings) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[API] ✗ WiFi not connected!");
    return false;
  }

  HTTPClient http;

  // Build full URL
  String url = String(API_BASE_URL) + String(API_ENDPOINT);

  Serial.println("\n[API] Sending data to monitoring service...");
  Serial.print("[API] URL: ");
  Serial.println(url);

  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  // Timestamp omitted: the service records its current time.
  doc["ph"] = readings.ph;
  doc["turbidity_index"] = readings.turbidity_index;  // Estimated NTU
  doc["temperature"] = readings.temperature;
  doc["tds"] = readings.tds;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("[API] Payload:");
  Serial.println(jsonPayload);

  // Send POST request
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (strlen(DEVICE_API_KEY) > 0) {
    http.addHeader("X-API-Key", DEVICE_API_KEY);
  }

  int httpResponseCode = http.POST(jsonPayload);

  if (httpResponseCode > 0) {
    Serial.print("[API] ✓ Response code: ");
    Serial.println(httpResponseCode);

    String response = http.getString();
    Serial.println("[API] Response:");
    Serial.println(response);

    // Parse response to show classification
    StaticJsonDocument<1024> responseDoc;
    DeserializationError error = deserializeJson(responseDoc, response);

    if (!error) {
      const char* quality = responseDoc["classification"]["quality"];
      float confidence = responseDoc["classification"]["confidence"];
      const char* risk_level = responseDoc["risk_prediction"]["risk_level"];
      float risk_score = responseDoc["risk_prediction"]["risk_score"];

      Serial.println("\n╔════════════════════════════════════╗");
      Serial.println("║  BACKEND CLASSIFICATION RESULT     ║");
      Serial.println("╚════════════════════════════════════╝");
      Serial.print("Water Quality: ");
      Serial.print(quality);
      Serial.print(" (");
      Serial.print(confidence * 100, 1);
      Serial.println("%)");
      Serial.print("Risk Level: ");
      Serial.print(risk_level);
      Serial.print(" (");
      Serial.print(risk_score * 100, 1);
      Serial.println("%)");
      Serial.println();
    }

    http.end();
    return true;
  } else {
    Serial.print("[API] ✗ Error code: ");
    Serial.println(httpResponseCode);
    Serial.println("[API] Check the service URL and network connection!");
    http.end();
    return false;
  }
}

// ============== DISPLAY READINGS ==============
void displayReadings(SensorReadings readings) {
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // TDS
  Serial.print("TDS:  ");
  Serial.print(readings.tds, 0);
  Serial.print(" ppm | ");
  if(readings.tds < 150) Serial.println("✓ Good");
  else if(readings.tds < 300) Serial.println("○ Fair");
  else Serial.println("⚠ High");

  // pH
  Serial.print("pH:   ");
  Serial.print(readings.ph, 1);
  Serial.print(" | ");
  if(readings.ph >= 6.5 && readings.ph <= 8.5) Serial.println("✓ Neutral");
  else if(readings.ph < 6.5) Serial.println("⚠ Acidic");
  else Serial.println("⚠ Alkaline");

  // Turbidity
  Serial.print("TURB: ");
  Serial.print(readings.turbidity_index, 1);
  Serial.print(" NTU | ");
  if(readings.turbidity_index < 5) Serial.println("? Low turbidity");
  else if(readings.turbidity_index < 50) Serial.println("? Needs attention");
  else Serial.println("? High turbidity");

  // Temperature
  Serial.print("TEMP: ");
  if (readings.temperatureValid) {
    Serial.print(readings.temperature, 1);
    Serial.println(" °C");
  } else {
    Serial.println("SENSOR ERROR (check DS18B20 wiring)");
  }

  Serial.println();
}

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  WATER QUALITY MONITOR             ║");
  Serial.println("║  WiFi + Service Integration        ║");
  Serial.println("╚════════════════════════════════════╝\n");

  // Configure ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  pinMode(TDS_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);

  temperatureSensors.begin();
  temperatureSensors.setResolution(12);

  Serial.println("Pin Assignments:");
  Serial.println("  D34 → TDS Sensor (WORKING!)");
  Serial.println("  D35 → pH Sensor");
  Serial.println("  D32 → Turbidity Sensor");
  Serial.println("  D33 → DS18B20 Temperature Sensor\n");
  Serial.print("DS18B20 sensors detected: ");
  Serial.println(temperatureSensors.getDeviceCount());

  // Connect to WiFi
  connectToWiFi();

  delay(1000);
}

// ============== MAIN LOOP ==============
void loop() {
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Connection lost! Reconnecting...");
    connectToWiFi();
  }

  // Sample TDS sensor continuously
  if (millis() - lastSensorSampleTime > SENSOR_SAMPLE_INTERVAL) {
    lastSensorSampleTime = millis();
    tdsBuffer[tdsBufferIndex] = analogRead(TDS_PIN);
    tdsBufferIndex++;
    if (tdsBufferIndex == SCOUNT) tdsBufferIndex = 0;
  }

  // Send data to monitoring service every 30 seconds
  if (millis() - lastSendTime > SEND_DATA_INTERVAL) {
    lastSendTime = millis();

    // Read all sensors
    SensorReadings readings = readSensors();

    // Display locally
    displayReadings(readings);

    // Never send the DS18B20's error values (-127 °C or 85 °C) as real water data.
    if (readings.temperatureValid) {
      sendDataToBackend(readings);
    } else {
      Serial.println("[API] Reading skipped: no valid temperature measurement.");
    }
  }
}
