// Force Pin Configuration Test
// Tests if pins work with different configurations

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  FORCE PIN CONFIGURATION TEST      ║");
  Serial.println("╚════════════════════════════════════╝\n");
  
  Serial.println("Testing D32 with different settings...\n");
  
  // Test 1: Default configuration
  Serial.println("Test 1: Default (ADC_11db, 12-bit)");
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  analogSetPinAttenuation(32, ADC_11db);
  delay(100);
  int val1 = analogRead(32);
  Serial.print("D32 ADC = ");
  Serial.println(val1);
  
  // Test 2: Different attenuation
  Serial.println("\nTest 2: ADC_6db attenuation");
  analogSetAttenuation(ADC_6db);
  analogSetPinAttenuation(32, ADC_6db);
  delay(100);
  int val2 = analogRead(32);
  Serial.print("D32 ADC = ");
  Serial.println(val2);
  
  // Test 3: 0db attenuation
  Serial.println("\nTest 3: ADC_0db attenuation");
  analogSetAttenuation(ADC_0db);
  analogSetPinAttenuation(32, ADC_0db);
  delay(100);
  int val3 = analogRead(32);
  Serial.print("D32 ADC = ");
  Serial.println(val3);
  
  // Test 4: 2.5db attenuation
  Serial.println("\nTest 4: ADC_2_5db attenuation");
  analogSetAttenuation(ADC_2_5db);
  analogSetPinAttenuation(32, ADC_2_5db);
  delay(100);
  int val4 = analogRead(32);
  Serial.print("D32 ADC = ");
  Serial.println(val4);
  
  Serial.println("\n════════════════════════════════════");
  if(val1 == 0 && val2 == 0 && val3 == 0 && val4 == 0) {
    Serial.println("✗ D32 truly damaged - all configs = 0");
  } else if(val1 > 100 || val2 > 100 || val3 > 100 || val4 > 100) {
    Serial.println("✓ D32 works with specific config!");
    Serial.println("We found the right setting!");
  } else {
    Serial.println("⚠ D32 readings very low on all configs");
  }
  Serial.println("════════════════════════════════════\n");
}

void loop() {
  delay(1000);
}
