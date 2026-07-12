// COMPLETE WATER QUALITY MONITOR
// ESP32 + ADS1115 + TDS + Turbidity + pH sensors
// Uses I2C for reliable, accurate readings

#include <Wire.h>
#include <Adafruit_ADS1X15.h>

// Create ADS1115 object
Adafruit_ADS1115 ads;

// Sensor connections on ADS1115
#define TDS_CHANNEL      0  // A0 on ADS1115
#define TURBIDITY_CHANNEL 1  // A1 on ADS1115
#define PH_CHANNEL       2  // A2 on ADS1115

// Voltage reference
const float VREF = 3.3;

void setup() {
  Serial.begin(115200);
  delay(2000);
  
  Serial.println("\n╔════════════════════════════════════╗");
  Serial.println("║  WATER QUALITY MONITOR             ║");
  Serial.println("║  ESP32 + ADS1115 + 3 Sensors       ║");
  Serial.println("╚════════════════════════════════════╝\n");
  
  // Initialize I2C
  Wire.begin(21, 22); // SDA=21, SCL=22 on ESP32
  
  // Initialize ADS1115
  if (!ads.begin()) {
    Serial.println("✗ ADS1115 not found!");
    Serial.println("Check wiring:");
    Serial.println("  - ADS1115 VDD → ESP32 3V3");
    Serial.println("  - ADS1115 GND → ESP32 GND");
    Serial.println("  - ADS1115 SDA → ESP32 GPIO21");
    Serial.println("  - ADS1115 SCL → ESP32 GPIO22");
    while (1);
  }
  
  Serial.println("✓ ADS1115 initialized!");
  
  // Set gain for 0-3.3V range
  // GAIN_ONE = +/-4.096V (1 bit = 0.125mV)
  ads.setGain(GAIN_ONE);
  
  Serial.println("\nSensor Channels:");
  Serial.println("  A0: TDS Sensor");
  Serial.println("  A1: Turbidity Sensor");
  Serial.println("  A2: pH Sensor");
  Serial.println("\nStarting measurements...\n");
  
  delay(1000);
}

void loop() {
  // Read all sensors
  int16_t tds_raw = ads.readADC_SingleEnded(TDS_CHANNEL);
  int16_t turbidity_raw = ads.readADC_SingleEnded(TURBIDITY_CHANNEL);
  int16_t ph_raw = ads.readADC_SingleEnded(PH_CHANNEL);
  
  // Convert to voltage (ADS1115 at GAIN_ONE: 1 bit = 0.125mV)
  float tds_voltage = tds_raw * 0.125 / 1000.0;
  float turbidity_voltage = turbidity_raw * 0.125 / 1000.0;
  float ph_voltage = ph_raw * 0.125 / 1000.0;
  
  // Calculate values
  float tds_ppm = tds_voltage * 133.42;
  float turbidity_ntu = (3.3 - turbidity_voltage) * 200;
  float ph_value = 7.0 + ((ph_voltage - 1.65) / 0.18);
  
  // Limit ranges
  if(tds_ppm < 0) tds_ppm = 0;
  if(turbidity_ntu < 0) turbidity_ntu = 0;
  if(ph_value < 0) ph_value = 0;
  if(ph_value > 14) ph_value = 14;
  
  // Display
  Serial.println("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  
  // TDS
  Serial.print("TDS:  ");
  Serial.print(tds_ppm, 0);
  Serial.print(" ppm (");
  Serial.print(tds_voltage, 2);
  Serial.print("V) | ");
  if(tds_ppm < 150) Serial.println("✓ Good");
  else if(tds_ppm < 300) Serial.println("○ Fair");
  else Serial.println("⚠ High");
  
  // Turbidity
  Serial.print("TURB: ");
  Serial.print(turbidity_ntu, 0);
  Serial.print(" NTU (");
  Serial.print(turbidity_voltage, 2);
  Serial.print("V) | ");
  if(turbidity_voltage > 2.5) Serial.println("✓ Clear");
  else if(turbidity_voltage > 2.0) Serial.println("○ Cloudy");
  else Serial.println("⚠ Murky");
  
  // pH
  Serial.print("pH:   ");
  Serial.print(ph_value, 1);
  Serial.print(" (");
  Serial.print(ph_voltage, 2);
  Serial.print("V) | ");
  if(ph_value >= 6.5 && ph_value <= 8.5) Serial.println("✓ Neutral");
  else if(ph_value < 6.5) Serial.println("⚠ Acidic");
  else Serial.println("⚠ Alkaline");
  
  Serial.println();
  
  delay(2000);
}
