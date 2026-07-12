# ESP32 Backend Integration Guide

## Overview
This guide shows how to connect your ESP32 TDS sensor to your FastAPI backend.

---

## Step 1: Install Required Library

You need the **ArduinoJson** library for JSON handling.

### In Arduino IDE:
1. Go to **Sketch** → **Include Library** → **Manage Libraries**
2. Search for **"ArduinoJson"**
3. Install **ArduinoJson by Benoit Blanchon** (version 6.x)

---

## Step 2: Configure WiFi and Backend URL

Open `tds_wifi_backend.ino` and update these lines:

```cpp
// WiFi credentials
const char* WIFI_SSID = "YOUR_WIFI_SSID";        // Your WiFi name
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD"; // Your WiFi password

// Backend API configuration
const char* API_BASE_URL = "http://192.168.1.100:8000";  // Your backend IP
```

### Finding Your Backend IP Address:

**On Windows (Backend computer):**
1. Open Command Prompt
2. Type: `ipconfig`
3. Look for "IPv4 Address" (e.g., `192.168.1.100`)

**Example:**
```cpp
const char* WIFI_SSID = "MyHomeWiFi";
const char* WIFI_PASSWORD = "mypassword123";
const char* API_BASE_URL = "http://192.168.1.100:8000";
```

---

## Step 3: Start Your Backend

Make sure your FastAPI backend is running:

```bash
cd "d:\Projects\Final year Project\backend"
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

---

## Step 4: Upload Code to ESP32

1. **Connect TDS sensor to ESP32:**
   - TDS **+** → ESP32 **3V3**
   - TDS **-** → ESP32 **GND**
   - TDS **A** → ESP32 **D34**

2. **Select board in Arduino IDE:**
   - Board: **"ESP32 Dev Module"**
   - Upload Speed: **115200**
   - Port: **COM7** (or your ESP32 port)

3. **Upload `tds_wifi_backend.ino`**

4. **Open Serial Monitor** (115200 baud)

---

## Step 5: Test Connection

After uploading, you should see in Serial Monitor:

```
╔════════════════════════════════════╗
║  TDS SENSOR - WIFI INTEGRATION     ║
║  Backend Testing                   ║
╚════════════════════════════════════╝

Pin Assignment:
  D34 → TDS Sensor (WORKING!)

Configuration:
  WiFi SSID: MyHomeWiFi
  Backend URL: http://192.168.1.100:8000
  Device ID: ESP32_001

[WiFi] Connecting to WiFi...
[WiFi] SSID: MyHomeWiFi
..........
[WiFi] ✓ Connected!
[WiFi] IP Address: 192.168.1.150

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TDS: 42 ppm | ✓ Good

⏰ Time to send data to backend!
[API] Sending data to backend...
[API] URL: http://192.168.1.100:8000/api/v1/sensor/sensor-data
[API] Payload:
{"device_id":"ESP32_001","timestamp":"2025-01-15T10:30:00Z","ph":7.0,"turbidity":5.0,"temperature":25.0,"tds":42.0,"dissolved_oxygen":8.5}
[API] ✓ Response code: 201
[API] Response:
{"status":"success","reading_id":"...","classification":{"quality":"Safe","confidence":0.92},...}

╔════════════════════════════════════╗
║  BACKEND CLASSIFICATION RESULT     ║
╚════════════════════════════════════╝
Water Quality: Safe (92.0% confidence)
Risk Level: Low (35.0% risk)
```

---

## What Happens:

1. **Every 40ms**: ESP32 samples TDS sensor
2. **Every 2 seconds**: Displays TDS value locally
3. **Every 30 seconds**: Sends TDS data to backend
4. **Backend processes**:
   - Classifies water quality (Safe/Warning/Unsafe)
   - Predicts contamination risk (Low/Medium/High)
   - Returns ML predictions with confidence scores

---

## Troubleshooting

### WiFi Connection Failed
- ✓ Check WiFi SSID and password are correct
- ✓ Make sure ESP32 and backend are on same network
- ✓ Check WiFi signal strength

### API Error 404 (Not Found)
- ✓ Check backend is running (`python -m uvicorn app.main:app --host 0.0.0.0 --port 8000`)
- ✓ Verify backend URL is correct (IP address and port)

### API Error 500 (Internal Server Error)
- ✓ Check backend logs for errors
- ✓ Make sure MongoDB is running
- ✓ Verify ML models are loaded

### API Error (Connection Refused)
- ✓ Firewall might be blocking port 8000
- ✓ Backend might not be listening on `0.0.0.0` (use `--host 0.0.0.0`)

---

## Next Steps

Once TDS sensor works with backend:

1. ✅ **TDS sensor** - Working now!
2. ⏭️ **pH sensor** - Add to D35
3. ⏭️ **Turbidity sensor** - Add to D32
4. ⏭️ **Temperature sensor** (optional) - Add DS18B20 for accurate temperature
5. ⏭️ **Dissolved Oxygen** (optional) - Add DO sensor

---

## Code Features

### Current Implementation:
- ✅ TDS sensor with proper cubic formula
- ✅ Median filtering (30 samples)
- ✅ WiFi connection with auto-retry
- ✅ HTTP POST to backend API
- ✅ JSON payload formatting
- ✅ Response parsing and display
- ✅ Default values for pH, turbidity, temperature, DO

### What Backend Receives:
```json
{
  "device_id": "ESP32_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "ph": 7.0,              // Default (will update when you add pH sensor)
  "turbidity": 5.0,       // Default (will update when you add turbidity sensor)
  "temperature": 25.0,    // Default (will update when you add temp sensor)
  "tds": 42.0,           // ACTUAL TDS VALUE from sensor!
  "dissolved_oxygen": 8.5 // Default (will update when you add DO sensor)
}
```

### What Backend Returns:
```json
{
  "status": "success",
  "reading_id": "65a1b2c3d4e5f6g7h8i9j0k1",
  "classification": {
    "quality": "Safe",
    "confidence": 0.92,
    "shap_explanation": {...}
  },
  "risk_prediction": {
    "risk_score": 0.35,
    "risk_level": "Low",
    "shap_explanation": {...}
  },
  "timestamp": "2025-01-15T10:30:01Z"
}
```

---

## File Location

- **Arduino Code**: `d:\Projects\Final year Project\esp32\tds_wifi_backend.ino`
- **Backend**: `d:\Projects\Final year Project\backend\`

---

**Ready to test! Upload the code and watch the Serial Monitor!** 🚀
