// TDS SENSOR WITH WIFI INTEGRATION
// ESP32 + TDS Sensor + Service Integration
// Legacy TDS-only test sketch. The final demo uses final_esp32_water_quality_monitor.ino.

#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ============== CONFIGURATION ==============
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // Change this to your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Change this to your WiFi password

// Monitoring service configuration
const char* API_BASE_URL = "http://192.168.1.100:8000";  // Change to your laptop IPv4 address and service port
const char* API_ENDPOINT = "/api/v1/sensor/sensor-data";

// Device ID (unique identifier for this ESP32)
const char* DEVICE_ID = "ESP32_001";
// Optional setup key for key-based uploads. Leave blank for simple project uploads when enabled.
const char* DEVICE_API_KEY = "";

// Sensor pin
#define TDS_PIN 34        // TDS sensor on D34 (CONFIRMED WORKING!)

// Timing
#define SENSOR_SAMPLE_INTERVAL 40   // Sample TDS every 40ms
#define SEND_DATA_INTERVAL 30000    // Send to the monitoring service every 30 seconds

// ADC Configuration
#define VREF 3.3
#define SCOUNT 30

// ============== GLOBAL VARIABLES ==============
int tdsBuffer[SCOUNT];
int tdsBufferIndex = 0;
float temperature = 25.0;

unsigned long lastSendTime = 0;
unsigned long lastSensorSampleTime = 0;
unsigned long lastDisplayTime = 0;

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
    Serial.println("[WiFi] Will retry later...");
  }
}

// ============== READ TDS SENSOR ==============
float readTDS() {
  // Calculate TDS with proper formula
  int tds_median = getMedianNum(tdsBuffer, SCOUNT);
  float tds_voltage = tds_median * VREF / 4096.0;
  float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
  float compensationVoltage = tds_voltage / compensationCoefficient;
  float tds_ppm = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                   - 255.86 * compensationVoltage * compensationVoltage
                   + 857.39 * compensationVoltage) * 0.5;

  // Limit range
  if(tds_ppm < 0) tds_ppm = 0;
  if(tds_ppm > 1000) tds_ppm = 1000;

  // Round to correct precision (±10 ppm)
  return round(tds_ppm);
}

// ============== SEND DATA TO BACKEND ==============
bool sendDataToBackend(float tds_value) {
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
  // Backend expects: device_id, timestamp, ph, turbidity_index (NTU), temperature, and tds
  // For now, we send TDS + default values for others
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = "2025-01-15T10:30:00Z";  // You can add RTC module for real timestamp
  doc["ph"] = 7.0;                            // Default neutral pH
  doc["turbidity_index"] = 1.0;               // Default low turbidity in NTU
  doc["temperature"] = temperature;           // Using global temperature
  doc["tds"] = tds_value;                     // ACTUAL TDS VALUE

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
      Serial.println("% confidence)");
      Serial.print("Risk Level: ");
      Serial.print(risk_level);
      Serial.print(" (");
      Serial.print(risk_score * 100, 1);
      Serial.println("% risk)");
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

// ============== SETUP ==============
void setup() {
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  TDS SENSOR - WIFI INTEGRATION     ║");
  Serial.println("║  Backend Testing                   ║");
  Serial.println("╚════════════════════════════════════╝\n");

  // Configure ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  pinMode(TDS_PIN, INPUT);

  Serial.println("Pin Assignment:");
  Serial.println("  D34 → TDS Sensor (WORKING!)\n");

  Serial.println("Configuration:");
  Serial.print("  WiFi SSID: ");
  Serial.println(WIFI_SSID);
  Serial.print("  Backend URL: ");
  Serial.println(API_BASE_URL);
  Serial.print("  Device ID: ");
  Serial.println(DEVICE_ID);
  Serial.println();

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
    delay(5000);
  }

  // Sample TDS sensor continuously
  if (millis() - lastSensorSampleTime > SENSOR_SAMPLE_INTERVAL) {
    lastSensorSampleTime = millis();
    tdsBuffer[tdsBufferIndex] = analogRead(TDS_PIN);
    tdsBufferIndex++;
    if (tdsBufferIndex == SCOUNT) tdsBufferIndex = 0;
  }

  // Display TDS reading every 2 seconds
  if (millis() - lastDisplayTime > 2000) {
    lastDisplayTime = millis();
    float tds_value = readTDS();

    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    Serial.print("TDS: ");
    Serial.print(tds_value, 0);
    Serial.print(" ppm | ");
    if(tds_value < 150) Serial.println("✓ Good");
    else if(tds_value < 300) Serial.println("○ Fair");
    else Serial.println("⚠ High");
  }

  // Send data to monitoring service every 30 seconds
  if (millis() - lastSendTime > SEND_DATA_INTERVAL) {
    lastSendTime = millis();

    float tds_value = readTDS();
    Serial.println("\n⏰ Time to send data to monitoring service!");
    sendDataToBackend(tds_value);
  }
}
