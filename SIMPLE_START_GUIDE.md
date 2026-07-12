# ⚡ SUPER SIMPLE START GUIDE

## Problem Fixed!
Port 8000 was blocked. Now using port **8080** instead.

---

## 🚀 Step 1: Start the Backend

Open Command Prompt (CMD):
1. Press `Windows + R`
2. Type `cmd`
3. Press Enter

Then run these commands:
```cmd
cd "d:\Projects\Final year Project\backend"
python -m app.main
```

You should see:
```
INFO: Starting Water Quality Monitoring System
INFO: Database connected
INFO: ML models loaded
INFO: Uvicorn running on http://0.0.0.0:8080
```

✅ **Backend is running on PORT 8080 now!**

---

## 🌐 Step 2: Find Your IP Address

Open another Command Prompt and type:
```cmd
ipconfig
```

Look for **IPv4 Address** under **Wireless LAN adapter Wi-Fi**:
```
IPv4 Address. . . . . . . . . . . : 192.168.1.105
```

**Write this down!** (Example: 192.168.1.105)

---

## 🧪 Step 3: Test the Backend

Open another Command Prompt:

**Test on localhost first:**
```cmd
curl -X POST http://localhost:8080/api/v1/sensor/sensor-data -H "Content-Type: application/json" -d "{\"device_id\":\"TEST_001\",\"timestamp\":\"2025-01-15T10:30:00Z\",\"ph\":7.2,\"turbidity_index\":15.5,\"temperature\":25.3,\"tds\":150.0}"
```

If you see `"status":"success"`, it's working! ✅

**Test with your IP** (replace 192.168.1.105 with YOUR IP):
```cmd
curl -X POST http://192.168.1.105:8080/api/v1/sensor/sensor-data -H "Content-Type: application/json" -d "{\"device_id\":\"TEST_001\",\"timestamp\":\"2025-01-15T10:30:00Z\",\"ph\":7.2,\"turbidity_index\":15.5,\"temperature\":25.3,\"tds\":150.0}"
```

---

## 📱 Step 4: ESP32 Code

Use this code in Arduino IDE:

```cpp
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// ========== CHANGE THESE ==========
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverIP = "192.168.1.105";  // Your computer's IP
const int serverPort = 8080;              // PORT 8080 (not 8000!)
// ==================================

void setup() {
  Serial.begin(115200);
  Serial.println("\nConnecting to WiFi...");
  
  WiFi.begin(ssid, password);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\n✓ Connected!");
  Serial.print("ESP32 IP: ");
  Serial.println(WiFi.localIP());
}

void loop() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    
    // Build URL with PORT 8080
    String url = "http://" + String(serverIP) + ":" + String(serverPort) + "/api/v1/sensor/sensor-data";
    
    Serial.println("\n===================");
    Serial.println("Sending to: " + url);
    
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    
    // Create JSON
    StaticJsonDocument<300> doc;
    doc["device_id"] = "ESP32_001";
    doc["timestamp"] = "2025-01-15T10:30:00Z";
    doc["ph"] = 7.2;
    doc["turbidity_index"] = 15.5;
    doc["temperature"] = 25.3;
    doc["tds"] = 150.0;
    
    String json;
    serializeJson(doc, json);
    Serial.println("JSON: " + json);
    
    // Send
    int code = http.POST(json);
    Serial.print("Response Code: ");
    Serial.println(code);
    
    if (code == 201) {
      Serial.println("✓✓✓ SUCCESS! ✓✓✓");
      Serial.println(http.getString());
    } else {
      Serial.println("✗ Error: " + String(code));
      Serial.println(http.getString());
    }
    
    http.end();
    Serial.println("===================\n");
  }
  
  delay(30000); // Wait 30 seconds
}
```

---

## 🔑 Key Changes

1. ✅ Backend now runs on **PORT 8080** (not 8000)
2. ✅ ESP32 code updated to use **PORT 8080**
3. ✅ All URLs changed from `:8000` to `:8080`

---

## 🎯 Quick Checklist

- [ ] Backend running on port 8080
- [ ] Can access http://localhost:8080/docs in browser
- [ ] curl test works
- [ ] ESP32 WiFi credentials updated
- [ ] ESP32 server IP updated
- [ ] ESP32 port set to 8080
- [ ] ArduinoJson library installed

---

## 🆘 Still Having Issues?

### Issue 1: Port 8080 also blocked
Try port 8081 or 8082:
- Change `PORT=8081` in `.env` file
- Restart backend
- Update ESP32 code: `const int serverPort = 8081;`

### Issue 2: Can't access from ESP32
1. Make sure both on same WiFi
2. Disable Windows Firewall temporarily (for testing)
3. Check if backend is running

### Issue 3: curl not found
Download curl for Windows:
- Or use Postman
- Or test from browser: http://localhost:8080/docs

---

## 📞 Tell Me

After running Step 1, what do you see? Copy and paste the exact message!
