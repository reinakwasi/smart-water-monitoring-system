# DS18B20 temperature sensor setup

The final sketch reads the DS18B20 water-temperature sensor and sends that value as `temperature`. The same measured temperature is also used to compensate the TDS calculation before the reading is uploaded.

## Wiring

| DS18B20 connection | ESP32 connection |
| --- | --- |
| VDD / red | 3.3V |
| GND / black | GND |
| DATA / yellow or white | GPIO 4 |

Place a **4.7 k? resistor between DATA and 3.3V**. The sensor and all other sensor boards must share the ESP32 ground.

For a waterproof probe, wire colours can vary between manufacturers. Confirm its datasheet before applying power.

## What the sketch does

1. Reads the DS18B20 in degrees Celsius.
2. Rejects disconnected/startup readings such as `-127 ?C` and `85 ?C`.
3. Uses the valid temperature for TDS compensation.
4. Sends pH, turbidity, temperature, and TDS to the monitoring service.
5. Sends tank distance separately for tank-level display.

## First test

Open the Serial Monitor at 115200 baud after uploading the sketch. It should show:

- a plausible temperature value rather than `ERROR`
- a JSON water-reading payload
- a successful HTTP response code

If the temperature shows `ERROR`, check GPIO 4, the 4.7 k? pull-up resistor, probe wire order, 3.3V, and the shared ground.
