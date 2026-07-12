# Quick Start Guide - ESP32 Water Quality Monitoring

## 🚀 Get Running in 5 Minutes

### Step 1: Start the Backend (2 minutes)

```bash
# 1. Start MongoDB
# Windows: net start MongoDB
# Linux/Mac: sudo systemctl start mongod

# 2. Navigate to backend folder
cd backend

# 3. Install dependencies (first time only)
pip install -r requirements.txt

# 4. Start the server
python -m app.main
```

You should see:
```
INFO: Starting Water Quality Monitoring System
INFO: Database connected
INFO: ML models loaded
INFO: Uvicorn running on http://0.0.0.0:8000
```

### Step 2: Find Your Computer's IP Address (30 seconds)

**Windows:**
```cmd
ipconfig
```
Look for "IPv4 Address" (example: 192.168.1.100)

**Linux/Mac:**
```bash
ip addr show
# or
ifconfig
```

### Step 3: Test with Curl (30 seconds)

Replace `192.168.1.100` with your actual IP:

```bash
curl -X POST http://192.168.1.100:8000/api/v1/sensor/sensor-data \
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

Expected response (201 Created):
```json
{
  "status": "success",
  "reading_id": "...",
  "classification": {
    "quality": "Safe",
    "confidence": 0.92
  },
  "risk_prediction": {
    "risk_score": 0.35,
    "risk_level": "Low"
  }
}
```

✅ **If you get this response, your backend is working!**

---

## 📡 ESP32 Setup (2 minutes)

### Minimal ESP32 Code

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverUrl = "http://192.168.1.100:8000/api/v1/sensor/sensor-data";

void setup() {
  Serial.begin(115200);
  WiFi.begin(ssid, password);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConnected!");
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverUrl);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON payload
    StaticJsonDocument<256> doc;
    doc["device_id"] = "ESP32_001";
    doc["timestamp"] = "2025-01-15T10:30:00Z"; // Use NTP in production
    doc["ph"] = 7.2;                            // Replace with actual sensor read
    doc["turbidity_index"] = 15.5;              // Replace with actual sensor read
    doc["temperature"] = 25.3;                  // Replace with actual sensor read
    doc["tds"] = 150.0;                         // Replace with actual sensor read
    
    String jsonPayload;
    serializeJson(doc, jsonPayload);
    
    int httpCode = http.POST(jsonPayload);
    
    if (httpCode == 201) {
      Serial.println("✓ Data sent!");
      Serial.println(http.getString());
    } else {
      Serial.println("✗ Error: " + String(httpCode));
    }
    
    http.end();
  }
  
  delay(30000); // Send every 30 seconds
}
```

**Remember to:**
1. Replace `YOUR_WIFI_NAME` and `YOUR_WIFI_PASSWORD`
2. Replace `192.168.1.100` with your computer's IP
3. Install ArduinoJson library (v6.x)

---

## ✅ Checklist

- [ ] MongoDB is running
- [ ] Backend server started (port 8000)
- [ ] curl test returns 201 status
- [ ] ESP32 WiFi credentials configured
- [ ] Server URL updated with your IP
- [ ] ArduinoJson library installed
- [ ] ESP32 code uploaded

---

## 📋 Required JSON Fields

The ESP32 must send exactly these 4 fields (no dissolved_oxygen):

```json
{
  "device_id": "ESP32_001",          // String: Your device identifier
  "timestamp": "2025-01-15T10:30:00Z", // ISO8601: UTC timestamp
  "ph": 7.2,                          // Float: 0-14
  "turbidity_index": 15.5,            // Float: 0-100 (relative scale)
  "temperature": 25.3,                // Float: -55 to 125 (Celsius)
  "tds": 150.0                        // Float: 0-1000 (ppm)
}
```

---

## 🐛 Troubleshooting

### Backend won't start
- Check MongoDB is running
- Check port 8000 is not in use
- Install dependencies: `pip install -r requirements.txt`

### ESP32 can't connect
- Verify WiFi credentials
- Check ESP32 and computer are on same network
- Use computer's local IP (not 127.0.0.1 or localhost)
- Check firewall allows port 8000

### 400 Bad Request
- Check JSON format
- Verify all 4 required fields present
- Check value ranges
- Ensure timestamp is ISO8601 format

### 500 Internal Server Error
- Check backend logs
- Verify ML models loaded
- Check MongoDB connection

---

## 📚 Additional Resources

- **Full ESP32 Guide**: See `ESP32_BACKEND_CONNECTION_GUIDE.md`
- **API Documentation**: http://localhost:8000/docs
- **Changes Made**: See `DISSOLVED_OXYGEN_CHANGES_COMPLETE.md`

---

## 🎯 You're Ready!

Your backend is configured to accept **4-parameter sensor data** from ESP32.

**No dissolved oxygen sensor needed - the backend handles it automatically!**
