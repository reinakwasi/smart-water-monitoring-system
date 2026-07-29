# AquaGuard ESP32 code

Use **`final_esp32_water_quality_monitor/final_esp32_water_quality_monitor.ino`** for the final project device.

This is the integrated sketch for the presentation build. It reads and sends:

- pH, or neutral pH 7.0 when the pH sensor is disabled
- turbidity in NTU
- DS18B20 water temperature
- total dissolved solids (TDS)
- ultrasonic tank level

Before uploading, set the Wi-Fi name/password, the laptop IPv4 address, the service port, and the device ID inside the sketch.

The other `.ino` files are older single-sensor tests or calibration references. Keep them only for troubleshooting; do not use them as the final presentation sketch.
