# Turbidity calibration note

The turbidity sensor is an analog probe. The ESP32 converts its voltage reading into NTU using calibration values from the actual sensor.

Based on the clean-water readings sent on July 28, 2026, the turbidity sensor was stable around **1.69 V to 1.74 V** in clear water. The final sketch currently uses:

```cpp
#define TURBIDITY_CLEAR_WATER_VOLTAGE 1.72
#define TURBIDITY_CLEAR_WATER_DEADBAND 0.04
#define TURBIDITY_CLOUDY_REFERENCE_VOLTAGE 1.20
#define TURBIDITY_CLOUDY_REFERENCE_NTU 400.0
```

The deadband prevents normal analog movement around clean water from being wrongly classified as unsafe.

## What to tell a supervisor

The turbidity sensor was calibrated with a clean-water baseline from the actual device. A cloudy-water reference was then used to make the reading rise clearly when particles are present, such as powdered milk in water. The app reports the value in NTU and uses it to judge water clarity.

## How to recalibrate later

1. Put the turbidity sensor fully inside clear water.
2. Wait for the voltage to settle.
3. Use the stable voltage shown in the Serial Monitor as `TURBIDITY_CLEAR_WATER_VOLTAGE`.
4. Keep a small deadband such as `0.04` to avoid false warnings from tiny voltage movement.
5. Test with cloudy water and adjust the cloudy reference if the reading is too high or too low.
