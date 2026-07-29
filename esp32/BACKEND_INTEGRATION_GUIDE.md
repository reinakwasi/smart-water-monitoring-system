# ESP32 service integration guide

Use `final_esp32_water_quality_monitor/final_esp32_water_quality_monitor.ino` for the final project demonstration. That sketch reads the water-quality probes and sends the readings to the AquaGuard monitoring service.

## Sensors used

- pH probe on GPIO 35
- Turbidity probe on GPIO 32, reported in NTU
- DS18B20 water temperature probe on GPIO 4
- TDS probe on GPIO 34
- Ultrasonic tank-level sensor on GPIO 5 and GPIO 25

Dissolved oxygen is not part of this project device.

## Configure the sketch

Open the final ESP32 sketch and set these values:

```cpp
const char* ssid = "YOUR_WIFI_NAME";
const char* password = "YOUR_WIFI_PASSWORD";
const char* serverIP = "YOUR_LAPTOP_IPV4";
const int serverPort = 8080;
const char* deviceId = "ESP32_001";
```

The ESP32 and laptop must be on the same network. Use the laptop's IPv4 address, not `localhost`.

## Start the monitoring service

From the `backend` folder, start the API on port 8080 and allow devices on the network to reach it:

```powershell
python -m uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Confirm the data path

The serial monitor should show payloads similar to this:

```json
{
  "device_id": "ESP32_001",
  "ph": 7.2,
  "turbidity_index": 4.6,
  "temperature": 27.5,
  "tds": 180
}
```

A successful water reading returns response code `201`. The app should then update Home, Water Insights, Alerts, History, Export Data, and Tank Details using the saved reading.

## Troubleshooting

- If the app stays offline, confirm the laptop IPv4 address, port `8080`, firewall permission, and that the backend was started with `--host 0.0.0.0`.
- If readings are saved but the app does not update, pull down to refresh and confirm you are signed into the account that should view the device data.
- If turbidity, pH, or TDS looks unrealistic, recalibrate that probe before using the reading for demonstration.
- If temperature shows a sensor error, check the DS18B20 data pin, 4.7 kOhm pull-up resistor, 3.3V supply, and shared ground.

AquaGuard is a monitoring and decision-support system. It helps users understand pH, turbidity, TDS, temperature, and tank level trends, but it is not a laboratory certificate for bacteria, viruses, heavy metals, or pesticides.
