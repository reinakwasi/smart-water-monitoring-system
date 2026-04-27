# ESP32 Water Quality Sensor Module

Firmware for ESP32-based water quality monitoring.

## Hardware

- ESP32 DevKit V1
- pH Sensor (Analog, 0-14 pH)
- Turbidity Sensor (Analog, 0-3000 NTU)
- DS18B20 Temperature Sensor (Digital 1-Wire)
- TDS Sensor (Analog, 0-1000 ppm)
- Dissolved Oxygen Sensor (Analog, 0-20 mg/L)
- HC-SR04 Ultrasonic Sensor (Digital)

## Setup

### Arduino IDE

1. Install Arduino IDE 2.0+
2. Add ESP32 board support:
   - File > Preferences
   - Add URL: `https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json`
   - Tools > Board > Boards Manager > Install "esp32"

3. Install libraries:
   - ArduinoJson (v6.x)
   - OneWire
   - DallasTemperature

4. Configure board:
   - Board: "ESP32 Dev Module"
   - Upload Speed: 115200
   - Flash Size: 4MB

### PlatformIO

```bash
cd esp32
pio init --board esp32dev
pio run --target upload
```

## Configuration

Edit `config.h`:
- WiFi SSID and password
- Backend API URL
- Device ID
- Pin assignments

## Pin Assignments

| Sensor | Pin | Type |
|--------|-----|------|
| pH | GPIO 34 | Analog |
| Turbidity | GPIO 35 | Analog |
| TDS | GPIO 32 | Analog |
| DO | GPIO 33 | Analog |
| Temperature | GPIO 4 | Digital |
| Ultrasonic Trigger | GPIO 5 | Digital |
| Ultrasonic Echo | GPIO 18 | Digital |

## Upload

1. Connect ESP32 via USB
2. Select correct COM port
3. Upload sketch
4. Open Serial Monitor (115200 baud)

## Troubleshooting

- **WiFi issues**: Check SSID/password, use 2.4GHz
- **Upload fails**: Hold BOOT button during upload
- **Sensor errors**: Check wiring and power supply
