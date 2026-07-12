// ESP32 PIN TEST - Test all ADC pins before using sensors
// This confirms your new ESP32 is working properly

const int TEST_PINS[] = {36, 39, 34, 35, 32, 33};
const char* PIN_NAMES[] = {"D36", "D39", "D34", "D35", "D32", "D33"};
const int NUM_PINS = 6;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  ESP32 PIN TEST                    ║");
  Serial.println("║  Testing ADC pins                  ║");
  Serial.println("╚════════════════════════════════════╝\n");
  
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  Serial.println("Testing pins (nothing should be connected)...\n");
  delay(1000);
  
  bool allGood = true;
  
  for(int i = 0; i < NUM_PINS; i++) {
    int pin = TEST_PINS[i];
    analogSetPinAttenuation(pin, ADC_11db);
    
    // Take 10 readings
    long total = 0;
    for(int j = 0; j < 10; j++) {
      total += analogRead(pin);
      delay(10);
    }
    int avg = total / 10;
    float voltage = avg * (3.3 / 4095.0);
    
    Serial.print(PIN_NAMES[i]);
    Serial.print(": ADC=");
    Serial.print(avg);
    Serial.print(" (");
    Serial.print(voltage, 2);
    Serial.print("V) ");
    
    if(avg == 0) {
      Serial.println("✗ SHORTED");
      allGood = false;
    } else if(avg >= 3800) {
      Serial.println("✓ WORKING");
    } else {
      Serial.println("⚠ UNUSUAL");
      allGood = false;
    }
  }
  
  Serial.println("\n════════════════════════════════════");
  if(allGood) {
    Serial.println("✓ ALL PINS WORKING!");
    Serial.println("✓ ESP32 is healthy!");
    Serial.println("✓ Ready for sensors!");
  } else {
    Serial.println("✗ SOME PINS HAVE ISSUES");
    Serial.println("Check connections or try different ESP32");
  }
  Serial.println("════════════════════════════════════\n");
}

void loop() {
  delay(1000);
}
