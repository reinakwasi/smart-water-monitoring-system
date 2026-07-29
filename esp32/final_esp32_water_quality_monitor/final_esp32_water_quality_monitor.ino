#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

#if __has_include("local_config.h")
#include "local_config.h"
#endif

#ifndef AQUAGUARD_WIFI_SSID
#define AQUAGUARD_WIFI_SSID "YOUR_WIFI_NAME"
#endif
#ifndef AQUAGUARD_WIFI_PASSWORD
#define AQUAGUARD_WIFI_PASSWORD "YOUR_WIFI_PASSWORD"
#endif
#ifndef AQUAGUARD_SERVER_IP
#define AQUAGUARD_SERVER_IP "YOUR_LAPTOP_IPV4"
#endif
#ifndef AQUAGUARD_SERVER_PORT
#define AQUAGUARD_SERVER_PORT 8080
#endif
#ifndef AQUAGUARD_DEVICE_ID
#define AQUAGUARD_DEVICE_ID "ESP32_001"
#endif
#ifndef AQUAGUARD_DEVICE_API_KEY
#define AQUAGUARD_DEVICE_API_KEY ""
#endif

// ===================== WIFI SETTINGS =====================
// Private values should be placed in local_config.h, not committed to Git.
const char* ssid = AQUAGUARD_WIFI_SSID;
const char* password = AQUAGUARD_WIFI_PASSWORD;

// ===================== SERVICE SETTINGS ==================
// Use your laptop IPv4 address while testing on the same WiFi/hotspot.
const char* serverIP = AQUAGUARD_SERVER_IP;
const int serverPort = AQUAGUARD_SERVER_PORT;
const char* deviceId = AQUAGUARD_DEVICE_ID;

// The monitoring service currently accepts simple device uploads.
// Leave this empty unless device keys are enabled again.
const char* deviceApiKey = AQUAGUARD_DEVICE_API_KEY;

// ===================== SENSOR PINS =======================
#define TDS_PIN 34
#define TURBIDITY_PIN 32
#define ONE_WIRE_BUS 4
#define TRIG_PIN 5
#define ECHO_PIN 25
#define PH_PIN 35

// Set this to true only after the pH probe is connected and calibrated.
#define PH_SENSOR_CONNECTED false

// ===================== ADC / SAMPLING ====================
#define VREF 3.3
#define SCOUNT 30
int analogBuffer[SCOUNT];
int analogBufferIndex = 0;

// ===================== TURBIDITY CALIBRATION =============
// Step 1: Put the turbidity probe in clean/clear water, read the voltage, and put it here.
#define TURBIDITY_CLEAR_WATER_VOLTAGE 1.72
#define TURBIDITY_CLEAR_WATER_DEADBAND 0.04

// Step 2: If you do not have a bought NTU standard, use a cloudy-water reference for comparison.
// Your current sensor showed about 1.20V in a cloudy/attention condition, so this maps that area to about 400 NTU.
#define TURBIDITY_CLOUDY_REFERENCE_VOLTAGE 1.20
#define TURBIDITY_CLOUDY_REFERENCE_NTU 400.0

// ===================== PH CALIBRATION ====================
// Replace these after calibration. If you only have neutral water, start with the pH 7 value.
// Many pH modules give different voltages, so these constants must match your own probe.
#define PH_7_VOLTAGE 1.65
#define PH_4_VOLTAGE 2.10

// ===================== TEMPERATURE =======================
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature tempSensor(&oneWire);
float temperature = 25.0;

// ===================== LATEST READINGS ===================
float tdsValue = 0.0;
float averageVoltage = 0.0;
float turbidityVoltage = 0.0;
float turbidityNTU = 0.0;
float phVoltage = 0.0;
float phValue = 7.0;
float distanceCm = 0.0;

// ===================== TIMING ============================
unsigned long lastSendTime = 0;
const unsigned long sendInterval = 30000;

int getMedianNum(int values[], int length) {
  int sorted[length];
  for (int i = 0; i < length; i++) sorted[i] = values[i];

  for (int j = 0; j < length - 1; j++) {
    for (int i = 0; i < length - j - 1; i++) {
      if (sorted[i] > sorted[i + 1]) {
        int temp = sorted[i];
        sorted[i] = sorted[i + 1];
        sorted[i + 1] = temp;
      }
    }
  }

  if ((length & 1) > 0) return sorted[(length - 1) / 2];
  return (sorted[length / 2] + sorted[length / 2 - 1]) / 2;
}

int readAnalogSettled(int pin) {
  analogRead(pin);
  delayMicroseconds(100);
  return analogRead(pin);
}

float clampFloat(float value, float minimum, float maximum) {
  if (value < minimum) return minimum;
  if (value > maximum) return maximum;
  return value;
}

float readPH() {
  if (!PH_SENSOR_CONNECTED) {
    phVoltage = 0.0;
    return 7.0;
  }

  long sum = 0;
  const int samples = 10;
  for (int i = 0; i < samples; i++) {
    sum += readAnalogSettled(PH_PIN);
    delay(5);
  }

  float raw = sum / (float)samples;
  float voltage = raw * VREF / 4095.0;
  phVoltage = voltage;

  float slope = (7.0 - 4.0) / (PH_7_VOLTAGE - PH_4_VOLTAGE);
  float ph = 7.0 + ((voltage - PH_7_VOLTAGE) * slope);

  return clampFloat(ph, 0.0, 14.0);
}

float calculateTurbidityNTU(float voltage) {
  float clearVoltage = TURBIDITY_CLEAR_WATER_VOLTAGE;
  float referenceVoltage = TURBIDITY_CLOUDY_REFERENCE_VOLTAGE;
  float referenceNTU = TURBIDITY_CLOUDY_REFERENCE_NTU;

  float voltageDrop = clearVoltage - voltage;
  float referenceDrop = clearVoltage - referenceVoltage;

  // Clean water readings naturally move a little on low-cost analog sensors.
  // Treat readings close to the clean-water voltage as clear instead of making them jump into warning bands.
  if (voltageDrop <= TURBIDITY_CLEAR_WATER_DEADBAND) return 0.5;

  float adjustedDrop = voltageDrop - TURBIDITY_CLEAR_WATER_DEADBAND;
  float adjustedReferenceDrop = referenceDrop - TURBIDITY_CLEAR_WATER_DEADBAND;

  if (adjustedReferenceDrop <= 0.0) return 0.5;

  float ntu = adjustedDrop * (referenceNTU / adjustedReferenceDrop);
  return clampFloat(ntu, 0.0, 3000.0);
}

float readDistanceCm() {
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  if (duration == 0) return -1.0;
  return duration * 0.0343 / 2.0;
}

void connectWiFi() {
  Serial.println();
  Serial.println("ESP32 Water Quality Monitor");
  Serial.print("Connecting to WiFi");

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected successfully");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
    Serial.print("Monitoring service: ");
    Serial.print(serverIP);
    Serial.print(":");
    Serial.println(serverPort);
  } else {
    Serial.println();
    Serial.println("WiFi connection failed. Check WiFi name/password.");
  }
}

void sendTankLevel(float distance) {
  if (WiFi.status() != WL_CONNECTED) return;
  if (distance <= 0 || distance >= 400) return;

  HTTPClient http;
  String url = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/v1/sensor/tank-level";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (strlen(deviceApiKey) > 0) {
    http.addHeader("X-API-Key", deviceApiKey);
  }

  StaticJsonDocument<200> doc;
  doc["device_id"] = deviceId;
  doc["distance_cm"] = distance;
  doc["tank_height_cm"] = 200.0;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("Sending tank level: " + jsonPayload);
  int httpCode = http.POST(jsonPayload);
  Serial.print("Tank response code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  }

  http.end();
}

void sendDataToService(float ph, float turbidity, float temp, float tds, float distance) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("WiFi not connected. Skipping send.");
    return;
  }

  HTTPClient http;
  String url = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/v1/sensor/sensor-data";

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  if (strlen(deviceApiKey) > 0) {
    http.addHeader("X-API-Key", deviceApiKey);
  }

  StaticJsonDocument<300> doc;
  doc["device_id"] = deviceId;
  doc["ph"] = ph;
  doc["turbidity_index"] = turbidity;
  doc["temperature"] = temp;
  doc["tds"] = tds;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println();
  Serial.println("Sending water reading: " + jsonPayload);

  int httpCode = http.POST(jsonPayload);
  Serial.print("Water response code: ");
  Serial.println(httpCode);

  if (httpCode > 0) {
    Serial.println(http.getString());
  } else {
    Serial.println("Could not reach monitoring service. Check laptop IP, port, hotspot/WiFi, and firewall.");
  }

  http.end();
  sendTankLevel(distance);
}

void setup() {
  Serial.begin(115200);

  pinMode(TDS_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);
  pinMode(ONE_WIRE_BUS, INPUT_PULLUP);
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PH_PIN, INPUT);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  tempSensor.begin();
  connectWiFi();
  delay(2000);
}

void loop() {
  static unsigned long analogSampleTimepoint = millis();
  if (millis() - analogSampleTimepoint > 40) {
    analogSampleTimepoint = millis();
    analogBuffer[analogBufferIndex] = readAnalogSettled(TDS_PIN);
    analogBufferIndex++;
    if (analogBufferIndex == SCOUNT) analogBufferIndex = 0;
  }

  static unsigned long printTimepoint = millis();
  if (millis() - printTimepoint > 800) {
    printTimepoint = millis();

    tempSensor.requestTemperatures();
    float tempReading = tempSensor.getTempCByIndex(0);
    if (tempReading != DEVICE_DISCONNECTED_C && tempReading != 85.0) {
      temperature = tempReading;
    }

    int medianValue = getMedianNum(analogBuffer, SCOUNT);
    averageVoltage = medianValue * VREF / 4096.0;
    float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
    float compensationVoltage = averageVoltage / compensationCoefficient;
    tdsValue = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                - 255.86 * compensationVoltage * compensationVoltage
                + 857.39 * compensationVoltage) * 0.5;
    if (tdsValue < 0) tdsValue = 0;

    long turbiditySum = 0;
    const int turbiditySamples = 10;
    for (int i = 0; i < turbiditySamples; i++) {
      turbiditySum += readAnalogSettled(TURBIDITY_PIN);
      delay(2);
    }

    int turbidityRaw = turbiditySum / turbiditySamples;
    turbidityVoltage = turbidityRaw * VREF / 4095.0;
    turbidityNTU = calculateTurbidityNTU(turbidityVoltage);

    phValue = readPH();
    distanceCm = readDistanceCm();

    Serial.print("pH: ");
    if (PH_SENSOR_CONNECTED) {
      Serial.print(phValue, 1);
      Serial.print("(");
      Serial.print(phVoltage, 2);
      Serial.print("V)");
    } else {
      Serial.print("sensor disabled - sending neutral pH 7.0");
    }
    Serial.print(" | Temp: ");
    if (tempReading == DEVICE_DISCONNECTED_C || tempReading == 85.0) {
      Serial.print("ERROR");
    } else {
      Serial.print(temperature, 1);
      Serial.print("C");
    }
    Serial.print(" | TDS: ");
    Serial.print(tdsValue, 0);
    Serial.print("ppm(");
    Serial.print(averageVoltage, 2);
    Serial.print("V) | Turbidity: ");
    Serial.print(turbidityNTU, 1);
    Serial.print(" NTU(");
    Serial.print(turbidityVoltage, 2);
    Serial.print("V) | Distance: ");
    if (distanceCm < 0) {
      Serial.print("ERROR");
    } else {
      Serial.print(distanceCm, 1);
      Serial.print("cm");
    }
    Serial.println();
  }

  if (millis() - lastSendTime >= sendInterval) {
    lastSendTime = millis();

    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi disconnected. Reconnecting...");
      connectWiFi();
    } else {
      sendDataToService(phValue, turbidityNTU, temperature, tdsValue, distanceCm);
    }
  }
}
