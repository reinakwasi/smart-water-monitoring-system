// TDS Sensor on D34 (GPIO 34)
// Simple test

#define TDS_PIN 34

void setup() {
  Serial.begin(115200);
  Serial.println("\n╔════════════════════════╗");
  Serial.println("║  TDS Sensor - D34      ║");
  Serial.println("╚════════════════════════╝\n");
}

void loop() {
  // Read sensor
  int adc = analogRead(TDS_PIN);
  float voltage = adc * (3.3 / 4095.0);
  float tds = voltage * 133.42;

  // Display
  Serial.print("ADC: ");
  Serial.print(adc);
  Serial.print(" | Voltage: ");
  Serial.print(voltage, 2);
  Serial.print("V | TDS: ");
  Serial.print(tds, 0);
  Serial.print(" ppm");

  // Status
  if(adc < 100) {
    Serial.println(" | ⚠ Too low");
  } else if(adc >= 4000) {
    Serial.println(" | ⚠ Floating");
  } else {
    Serial.println(" | ✓ Reading");
  }

  delay(500);
}
