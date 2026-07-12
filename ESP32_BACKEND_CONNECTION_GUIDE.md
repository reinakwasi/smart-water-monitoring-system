# ESP32 to Backend Connection Guide

## Overview
This guide helps you connect your ESP32 sensors to the Python FastAPI backend for water quality monitoring.

---

## 1. Backend Setup

### Prerequisites
- Python 3.8+
- MongoDB running on localhost:27017 (or configure in `.env`)
- Virtual environment (recommended)

### Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### Configure Environment
Create a `.env` file in the `backend` folder:

```env
# App Configuration
APP_NAME="Water Quality Monitoring System"
DEBUG=True
API_V1_PREFIX="/api/v1"

# Database
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=water_quality_db

# Authentication  
JWT_SECRET_KEY=your-super-secret-key-change-this-in-production
JWT_ALGORITHM=HS256
JWT_ACCESS_TOKEN_EXPIRE_MINUTES=60

# Rate Limiting
RATE_LIMIT_PER_MINUTE=100

# CORS (add your ESP32 IP if needed)
CORS_ORIGINS=["*"]

# Logging
LOG_LEVEL=INFO
LOG_FORMAT=json

# SSL (optional - for HTTPS)
SSL_ENABLED=False
# SSL_CERTFILE=path/to/cert.pem
# SSL_KEYFILE=path/to/key.pem

# Firebase Cloud Messaging (optional - for push notifications)
# FCM_SERVER_KEY=your-fcm-server-key
```

### Start MongoDB
Make sure MongoDB is running:
```bash
# Windows
net start MongoDB

# Linux/Mac
sudo systemctl start mongod
```

### Start the Backend Server
```bash
cd backend
python -m app.main
```

The server will start on `http://localhost:8000`

You should see:
```
INFO: Starting Water Quality Monitoring System
INFO: Database connected
INFO: ML models loaded
INFO: Application startup complete
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Test the Backend
Open a browser and go to:
- **API Documentation**: http://localhost:8000/docs
- **Health Check**: http://localhost:8000/health

---

## 2. ESP32 Configuration

### Required Libraries
Install these libraries in Arduino IDE or PlatformIO:
- **WiFi.h** (ESP32 built-in)
- **HTTPClient.h** (ESP32 built-in)
- **ArduinoJson** (v6.x)
- **NTPClient** (for timestamp)

### WiFi Configuration
```cpp
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Replace with your computer's local IP address
const char* serverUrl = "http://192.168.1.100:8000/api/v1/sensor/sensor-data";
```

### Find Your Computer's IP Address
**Windows**:
```cmd
ipconfig
```
Look for "IPv4 Address" under your active network adapter.

**Linux/Mac**:
```bash
ifconfig
# or
ip addr show
```

### ESP32 Code Example

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <NTPClient.h>
#include <WiFiUdp.h>

// WiFi credentials
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Backend server URL (replace with your computer's IP)
const char* serverUrl = "http://192.168.1.100:8000/api/v1/sensor/sensor-data";

// Device ID
const char* deviceId = "ESP32_001";

// NTP Client for timestamps
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", 0, 60000); // UTC, update every 60s

void setup() {
  Serial.begin(115200);
  
  // Connect to WiFi
  WiFi.begin(ssid, password);
  Serial.print("Connecting to WiFi");
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected!");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
  
  // Initialize NTP client
  timeClient.begin();
}

void loop() {
  // Update time
  timeClient.update();
  
  // Read sensor values (replace with actual sensor reading code)
  float ph = readPH();
  float turbidity = readTurbidity();
  float temperature = readTemperature();
  float tds = readTDS();
  
  // Send data to backend
  sendSensorData(ph, turbidity, temperature, tds);
  
  // Wait 30 seconds before next reading
  delay(30000);
}

void sendSensorData(float ph, float turbidity, float temperature, float tds) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Begin HTTP connection
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    StaticJsonDocument<256> doc;
    doc["device_id"] = deviceId;
    doc["timestamp"] = getISO8601Timestamp();
    doc["ph"] = ph;
    doc["turbidity_index"] = turbidity;
    doc["temperature"] = temperature;
    doc["tds"] = tds;
    
    // Serialize JSON
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    Serial.println("Sending: " + jsonPayload);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonPayload);
    
    if (httpResponseCode > 0) {
      String response = http.getString();
      Serial.println("Response code: " + String(httpResponseCode));
      Serial.println("Response: " + response);
      
      if (httpResponseCode == 201) {
        Serial.println("✓ Data sent successfully!");
      }
    } else {
      Serial.println("✗ Error sending data");
      Serial.println("Error code: " + String(httpResponseCode));
    }
    
    http.end();
  } else {
    Serial.println("WiFi disconnected!");
  }
}

String getISO8601Timestamp() {
  unsigned long epochTime = timeClient.getEpochTime();
  
  // Convert epoch to ISO8601 format
  time_t rawtime = epochTime;
  struct tm* ti = gmtime(&rawtime);
  
  char buffer[25];
  strftime(buffer, sizeof(buffer), "%Y-%m-%dT%H:%M:%SZ", ti);
  
  return String(buffer);
}

// Placeholder sensor reading functions
// Replace these with your actual sensor code

float readPH() {
  // TODO: Read from pH sensor
  return 7.2; // Example value
}

float readTurbidity() {
  // TODO: Read from turbidity sensor
  // Return value 0-100 (relative scale, not NTU)
  return 15.5; // Example value
}

float readTemperature() {
  // TODO: Read from temperature sensor (DS18B20, DHT22, etc.)
  return 25.3; // Example value in Celsius
}

float readTDS() {
  // TODO: Read from TDS sensor
  return 150.0; // Example value in ppm
}
```

---

## 3. JSON Payload Format

### Sensor Data Endpoint
**URL**: `POST http://your-backend-ip:8000/api/v1/sensor/sensor-data`

**Headers**:
```
Content-Type: application/json
```

**Body** (4 parameters - NO dissolved_oxygen needed):
```json
{
  "device_id": "ESP32_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "ph": 7.2,
  "turbidity_index": 15.5,
  "temperature": 25.3,
  "tds": 150.0
}
```

**Field Validation**:
- `device_id`: String (1-100 chars)
- `timestamp`: ISO8601 format (YYYY-MM-DDTHH:MM:SSZ)
- `ph`: Float (0-14)
- `turbidity_index`: Float (0-100, relative scale)
- `temperature`: Float (-55 to 125°C)
- `tds`: Float (0-1000 ppm)

### Expected Response (201 Created)
```json
{
  "status": "success",
  "reading_id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "classification": {
    "quality": "Safe",
    "confidence": 0.92,
    "shap_explanation": { ... },
    "timestamp": "2025-01-15T10:30:01Z"
  },
  "risk_prediction": {
    "risk_score": 0.35,
    "risk_level": "Low",
    "shap_explanation": { ... },
    "timestamp": "2025-01-15T10:30:01Z"
  },
  "timestamp": "2025-01-15T10:30:01Z"
}
```

### Tank Level Endpoint (Optional)
**URL**: `POST http://your-backend-ip:8000/api/v1/sensor/tank-level`

**Body**:
```json
{
  "device_id": "ESP32_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "distance_cm": 45.2,
  "tank_height_cm": 200.0
}
```

---

## 4. Troubleshooting

### Backend Not Responding
1. Check if backend is running: `http://localhost:8000/health`
2. Check firewall settings (allow port 8000)
3. Verify MongoDB is running
4. Check logs in terminal where backend is running

### ESP32 Can't Connect
1. Verify WiFi credentials
2. Check if ESP32 and computer are on same network
3. Use computer's local IP (not 127.0.0.1)
4. Test with curl:
   ```bash
   curl -X POST http://localhost:8000/api/v1/sensor/sensor-data \
     -H "Content-Type: application/json" \
     -d '{"device_id":"TEST_001","timestamp":"2025-01-15T10:30:00Z","ph":7.2,"turbidity_index":15.5,"temperature":25.3,"tds":150.0}'
   ```

### 400 Bad Request
- Check JSON format is correct
- Verify all required fields are present
- Check value ranges (pH 0-14, turbidity 0-100, etc.)
- Verify timestamp is in ISO8601 format

### 500 Internal Server Error
- Check if ML models are loaded (see backend startup logs)
- Verify MongoDB connection
- Check backend logs for detailed error

### Rate Limit (429 Error)
- Default limit: 100 requests per minute
- Adjust in `.env`: `RATE_LIMIT_PER_MINUTE=200`

---

## 5. Testing Without ESP32

Use Postman, curl, or Python to test:

### Using curl
```bash
curl -X POST http://localhost:8000/api/v1/sensor/sensor-data \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": "TEST_001",
    "timestamp": "2025-01-15T10:30:00Z",
    "ph": 7.2,
    "turbidity_index": 15.5,
    "temperature": 25.3,
    "tds": 150.0
  }'
```

### Using Python
```python
import requests
from datetime import datetime

url = "http://localhost:8000/api/v1/sensor/sensor-data"

data = {
    "device_id": "TEST_001",
    "timestamp": datetime.utcnow().isoformat() + "Z",
    "ph": 7.2,
    "turbidity_index": 15.5,
    "temperature": 25.3,
    "tds": 150.0
}

response = requests.post(url, json=data)
print(response.status_code)
print(response.json())
```

---

## 6. Production Deployment

### Enable HTTPS
1. Get SSL certificates (Let's Encrypt recommended)
2. Update `.env`:
   ```env
   SSL_ENABLED=True
   SSL_CERTFILE=/path/to/cert.pem
   SSL_KEYFILE=/path/to/key.pem
   ```

### Secure the API
1. Change JWT_SECRET_KEY to a strong random value
2. Set DEBUG=False
3. Configure specific CORS_ORIGINS (not "*")
4. Consider adding API key authentication for ESP32

### Deploy Backend
Options:
- **AWS EC2/Lightsail**: Run on cloud instance
- **Heroku**: Easy deployment
- **Docker**: Containerize the application
- **Raspberry Pi**: Local server

---

## Summary

1. ✅ Start MongoDB
2. ✅ Configure `.env` file
3. ✅ Start backend server (python -m app.main)
4. ✅ Find your computer's IP address
5. ✅ Upload ESP32 code with correct WiFi and server URL
6. ✅ Monitor serial output for connection status
7. ✅ Verify data in MongoDB or check API docs at `/docs`

**Backend is ready to receive 4-parameter sensor data (no dissolved oxygen needed)!**
