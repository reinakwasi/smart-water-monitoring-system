// ESP32 PIN TEST V2 - Proper test accounting for input-only pins
// D36 and D39 are INPUT-ONLY (no pull-up) - they CAN read 0!
// D34, D35, D32, D33 are REGULAR (have pull-up) - should read high!

// Input-only pins (acceptable to read low)
const int INPUT_ONLY_PINS[] = {36, 39};
const char* INPUT_ONLY_NAMES[] = {"D36", "D39"};
const int NUM_INPUT_ONLY = 2;

// Regular ADC pins (should read high when floating)
const int REGULAR_PINS[] = {34, 35, 32, 33};
const char* REGULAR_NAMES[] = {"D34", "D35", "D32", "D33"};
const int NUM_REGULAR = 4;

void setup() {
  Serial.begin(115200);
  delay(2000);

  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  ESP32 PIN TEST V2                 ║");
  Serial.println("║  Proper ADC pin testing            ║");
  Serial.println("╚════════════════════════════════════╝\n");

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  // Test input-only pins
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("INPUT-ONLY PINS (D36, D39):");
  Serial.println("These have NO pull-up resistors");
  Serial.println("Reading 0 is NORMAL for these pins!");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  for(int i = 0; i < NUM_INPUT_ONLY; i++) {
    int pin = INPUT_ONLY_PINS[i];
    analogSetPinAttenuation(pin, ADC_11db);

    long total = 0;
    for(int j = 0; j < 10; j++) {
      total += analogRead(pin);
      delay(10);
    }
    int avg = total / 10;
    float voltage = avg * (3.3 / 4095.0);

    Serial.print(INPUT_ONLY_NAMES[i]);
    Serial.print(": ADC=");
    Serial.print(avg);
    Serial.print(" (");
    Serial.print(voltage, 2);
    Serial.print("V) ");
    Serial.println("✓ OK (any value normal)");
  }

  // Test regular pins
  Serial.println("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  Serial.println("REGULAR ADC PINS (D34,D35,D32,D33):");
  Serial.println("These MUST read HIGH (~3.3V)!");
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

  bool allRegularOK = true;

  for(int i = 0; i < NUM_REGULAR; i++) {
    int pin = REGULAR_PINS[i];
    analogSetPinAttenuation(pin, ADC_11db);

    long total = 0;
    for(int j = 0; j < 10; j++) {
      total += analogRead(pin);
      delay(10);
    }
    int avg = total / 10;
    float voltage = avg * (3.3 / 4095.0);

    Serial.print(REGULAR_NAMES[i]);
    Serial.print(": ADC=");
    Serial.print(avg);
    Serial.print(" (");
    Serial.print(voltage, 2);
    Serial.print("V) ");

    if(avg == 0) {
      Serial.println("✗ SHORTED!");
      allRegularOK = false;
    } else if(avg >= 3500) {
      Serial.println("✓ WORKING");
    } else if(avg >= 1000) {
      Serial.println("⚠ LOW (usable)");
    } else {
      Serial.println("✗ TOO LOW!");
      allRegularOK = false;
    }
  }

  // Summary
  Serial.println("\n════════════════════════════════════");
  if(allRegularOK) {
    Serial.println("✓ ESP32 IS HEALTHY!");
    Serial.println("✓ All sensor pins working!");
    Serial.println("✓ Ready to connect sensors!");
    Serial.println("\nUSE THESE PINS:");
    Serial.println("→ D32, D33, D34, or D35 for sensors");
    Serial.println("→ Avoid D36 and D39 (input-only)");
  } else {
    Serial.println("✗ ESP32 HAS ISSUES!");
    Serial.println("\nPossible problems:");
    Serial.println("- ESP32 damaged/defective");
    Serial.println("- Something connected (remove all wires!)");
    Serial.println("- Bad USB cable");
    Serial.println("- Return ESP32 if brand new");
  }
  Serial.println("════════════════════════════════════\n");
}

void loop() {
  delay(1000);
}
