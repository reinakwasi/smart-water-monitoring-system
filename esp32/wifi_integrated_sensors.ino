// WATER QUALITY MONITOR WITH WIFI INTEGRATION
// ESP32 + 3 Sensors + Backend Integration
// Sends data to FastAPI backend

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";

// Backend API configuration
const char* API_BASE_URL = "http://192.168.2.88:8000";  // PC Wi-Fi IPv4; update when ipconfig changes
const char* API_ENDPOINT = "/api/v1/sensor/sensor-data";

// Device ID (unique identifier for this ESP32)
const char* DEVICE_ID = "ESP32_001";

// Sensor pins
#define TDS_PIN 34        // TDS sensor on D34 (CONFIRMED WORKING!)
#define PH_PIN 35         // pH sensor on D35
#define TURBIDITY_PIN 32  // Turbidity on D32

// Timing
#define SENSOR_SAMPLE_INTERVAL 40   // Sample TDS every 40ms
#define SEND_DATA_INTERVAL 30000    // Send to backend every 30 seconds
#define WIFI_RETRY_DELAY 5000       // Retry WiFi connection every 5 seconds

// ADC Configuration
#define VREF 3.3
#define SCOUNT 30

// Turbidity calibration constant
#define CLEAR_WATER_VOLTAGE 1.85  // Reference for 0-100 turbidity index

// ============== GLOBAL VARIABLES ==============
int tdsBuffer[SCOUNT];
int tdsBufferIndex = 0;
float temperature = 25.0;  // Default temperature (you can add DS18B20 sensor later)

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

// ============== SENSOR READING ==============
struct SensorReadings {
  float ph;
  float turbidity_index;  // 0-100 relative scale, NOT NTU
  float temperature;
  float tds;
  float dissolved_oxygen;
};

SensorReadings readSensors() {
  SensorReadings readings;
  
  // Read pH and Turbidity
  int ph_adc = analogRead(PH_PIN);
  int turb_adc = analogRead(TURBIDITY_PIN);
  
  // Calculate TDS with proper formula
  int tds_median = getMedianNum(tdsBuffer, SCOUNT);
  float tds_voltage = tds_median * VREF / 4096.0;
  float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
  float compensationVoltage = tds_voltage / compensationCoefficient;
  float tds_ppm = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                   - 255.86 * compensationVoltage * compensationVoltage
                   + 857.39 * compensationVoltage) * 0.5;
  
  // Convert pH and Turbidity to voltages
  float ph_volt = ph_adc * (3.3 / 4095.0);
  float turb_volt = turb_adc * (3.3 / 4095.0);
  
  // Calculate values
  float ph_value = 7.0 + ((ph_volt - 1.65) / 0.18);
  float turbidity_index = ((CLEAR_WATER_VOLTAGE - turb_volt) / CLEAR_WATER_VOLTAGE) * 100.0;
  
  // Limit ranges
  if(ph_value < 0) ph_value = 0;
  if(ph_value > 14) ph_value = 14;
  if(turbidity_index < 0) turbidity_index = 0;
  if(turbidity_index > 100) turbidity_index = 100;
  if(tds_ppm < 0) tds_ppm = 0;
  
  // Round to correct precision
  readings.ph = round(ph_value * 10) / 10.0;  // ±0.1
  readings.turbidity_index = round(turbidity_index * 10) / 10.0;  // 0-100 scale
  readings.temperature = round(temperature * 10) / 10.0;  // ±0.5°C
  readings.tds = round(tds_ppm);  // ±10 ppm (integer)
  readings.dissolved_oxygen = 8.5;  // Default value (you can add DO sensor later)
  
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
  
  Serial.println("\n[API] Sending data to backend...");
  Serial.print("[API] URL: ");
  Serial.println(url);
  
  // Create JSON payload
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  // Timestamp omitted: the backend records its current server time.
  doc["ph"] = readings.ph;
  doc["turbidity_index"] = readings.turbidity_index;  // 0-100 relative scale
  doc["temperature"] = readings.temperature;
  doc["tds"] = readings.tds;
  doc["dissolved_oxygen"] = readings.dissolved_oxygen;
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  Serial.println("[API] Payload:");
  Serial.println(jsonPayload);
  
  // Send POST request
  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  
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
    Serial.println("[API] Check your backend URL and network connection!");
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
  Serial.print(" /100 | ");
  if(readings.turbidity_index <= 10) Serial.println("✓ Clear");
  else if(readings.turbidity_index <= 50) Serial.println("○ Cloudy");
  else Serial.println("⚠ Murky");
  
  // Temperature
  Serial.print("TEMP: ");
  Serial.print(readings.temperature, 1);
  Serial.println(" °C");
  
  Serial.println();
}

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  WATER QUALITY MONITOR             ║");
  Serial.println("║  WiFi + Backend Integration        ║");
  Serial.println("╚════════════════════════════════════╝\n");
  
  // Configure ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  pinMode(TDS_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);
  
  Serial.println("Pin Assignments:");
  Serial.println("  D34 → TDS Sensor (WORKING!)");
  Serial.println("  D35 → pH Sensor");
  Serial.println("  D32 → Turbidity Sensor\n");
  
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
  
  // Send data to backend every 30 seconds
  if (millis() - lastSendTime > SEND_DATA_INTERVAL) {
    lastSendTime = millis();
    
    // Read all sensors
    SensorReadings readings = readSensors();
    
    // Display locally
    displayReadings(readings);
    
    // Send to backend
    sendDataToBackend(readings);
  }
}
