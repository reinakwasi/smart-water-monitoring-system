// COMPLETE WATER QUALITY MONITOR
// ESP32 + 3 Sensors (Direct Connection)
// Using proper TDS calculation with median filtering

#define TDS_PIN 34        // TDS sensor on D34 (CONFIRMED WORKING!)
#define PH_PIN 35         // pH sensor on D35
#define TURBIDITY_PIN 32  // Turbidity on D32

#define VREF 3.3
#define SCOUNT 30

// Turbidity calibration: Clear water reference voltage
// Based on measured clear tap water baseline (~1.74-1.79V)
// Set slightly above to allow for natural day-to-day variation
#define CLEAR_WATER_VOLTAGE 1.85

int tdsBuffer[SCOUNT];
int tdsBufferIndex = 0;
float temperature = 25.0;

// Median filter function
int getMedianNum(int bArray[], int iFilterLen) {
  int bTab[iFilterLen];
  for (int i = 0; i < iFilterLen; i++) bTab[i] = bArray[i];
  
  int i, j, bTemp;
  for (j = 0; j < iFilterLen - 1; j++) {
    for (i = 0; i < iFilterLen - j - 1; i++) {
      if (bTab[i] > bTab[i + 1]) {
        bTemp = bTab[i];
        bTab[i] = bTab[i + 1];
        bTab[i + 1] = bTemp;
      }
    }
  }
  
  if ((iFilterLen & 1) > 0)
    bTemp = bTab[(iFilterLen - 1) / 2];
  else
    bTemp = (bTab[iFilterLen / 2] + bTab[iFilterLen / 2 - 1]) / 2;
  
  return bTemp;
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  WATER QUALITY MONITOR             ║");
  Serial.println("║  3 Sensors Direct Connection       ║");
  Serial.println("╚════════════════════════════════════╝\n");
  
  // Configure ADC
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);
  
  pinMode(TDS_PIN, INPUT);
  pinMode(PH_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);
  
  Serial.println("Pin Assignments:");
  Serial.println("  D34 → TDS Sensor (WORKING!)");
  Serial.println("  D35 → pH Sensor");
  Serial.println("  D32 → Turbidity Sensor\n");
  
  delay(1000);
}

void loop() {
  // Sample TDS sensor
  static unsigned long tds_sample_time = millis();
  if (millis() - tds_sample_time > 40) {
    tds_sample_time = millis();
    tdsBuffer[tdsBufferIndex] = analogRead(TDS_PIN);
    tdsBufferIndex++;
    if (tdsBufferIndex == SCOUNT) tdsBufferIndex = 0;
  }
  
  // Print readings every 2 seconds
  static unsigned long print_time = millis();
  if (millis() - print_time > 2000) {
    print_time = millis();
    
    // Read pH and Turbidity
    int ph_adc = analogRead(PH_PIN);
    int turb_adc = analogRead(TURBIDITY_PIN);
    
    // Calculate TDS with proper formula
    int tds_median = getMedianNum(tdsBuffer, SCOUNT);
    float tds_voltage = tds_median * VREF / 4096.0;
    float compensationCoefficient = 1.0 + 0.02 * (temperature - 25.0);
    float compensationVoltage = tds_voltage / compensationCoefficient;
    float tds_ppm = (133.42 * compensationVoltage * compensationVoltage * compensationVoltage
                     - 255.86 * compensationVoltage * compensationVoltage
                     + 857.39 * compensationVoltage) * 0.5;
    
    // Convert pH and Turbidity to voltages
    float ph_volt = ph_adc * (3.3 / 4095.0);
    float turb_volt = turb_adc * (3.3 / 4095.0);
    
    // Calculate pH value
    float ph_value = 7.0 + ((ph_volt - 1.65) / 0.18);
    
    // Calculate relative turbidity index (0-100)
    // NOTE: This is a self-calibrated relative index, NOT a certified NTU measurement!
    // True NTU requires formazin calibration standards which are not available.
    // Formula: index = (clearWaterReference - currentVoltage) / clearWaterReference * 100
    // Higher index = more turbid (cloudier) water
    float turbidityIndex = ((CLEAR_WATER_VOLTAGE - turb_volt) / CLEAR_WATER_VOLTAGE) * 100.0;
    
    // Limit ranges
    if(ph_value < 0) ph_value = 0;
    if(ph_value > 14) ph_value = 14;
    if(turbidityIndex < 0) turbidityIndex = 0;
    if(turbidityIndex > 100) turbidityIndex = 100;
    if(tds_ppm < 0) tds_ppm = 0;
    
    // Display
    Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    
    // TDS (using proper formula!)
    Serial.print("TDS:  ");
    Serial.print(tds_ppm, 0);
    Serial.print(" ppm (");
    Serial.print(tds_voltage, 2);
    Serial.print("V) | ");
    if(tds_ppm < 150) Serial.println("✓ Good");
    else if(tds_ppm < 300) Serial.println("○ Fair");
    else Serial.println("⚠ High");
    
    // pH
    Serial.print("pH:   ");
    Serial.print(ph_value, 1);
    Serial.print(" (");
    Serial.print(ph_volt, 2);
    Serial.print("V) | ");
    if(ph_value >= 6.5 && ph_value <= 8.5) Serial.println("✓ Neutral");
    else if(ph_value < 6.5) Serial.println("⚠ Acidic");
    else Serial.println("⚠ Alkaline");
    
    // Turbidity (Relative Index 0-100, self-calibrated)
    Serial.print("TURB: ");
    Serial.print(turbidityIndex, 1);
    Serial.print(" /100 (");
    Serial.print(turb_volt, 2);
    Serial.print("V) | ");
    if(turbidityIndex < 10) Serial.println("✓ Very Clear");
    else if(turbidityIndex < 30) Serial.println("✓ Clear");
    else if(turbidityIndex < 50) Serial.println("○ Slightly Cloudy");
    else Serial.println("⚠ Cloudy/Murky");
    
    Serial.println();
  }
}
