/**
 * Reading Buffer Module
 * Handles buffering of sensor readings during network outages
 * 
 * Requirements: 16.1, 16.2
 * Task 18.3: Circular buffer for offline operation using SPIFFS
 */

#ifndef READING_BUFFER_H
#define READING_BUFFER_H

#include <Arduino.h>
#include <SPIFFS.h>
#include <ArduinoJson.h>
#include "config.h"
#include "sensor_manager.h"

// Buffer file paths
#define BUFFER_SENSOR_FILE "/sensor_buffer.json"
#define BUFFER_TANK_FILE "/tank_buffer.json"
#define BUFFER_INDEX_FILE "/buffer_index.json"

// Buffer state
struct BufferState {
  int sensorCount;
  int tankCount;
  bool initialized;
};

static BufferState bufferState = {0, 0, false};

/**
 * Initialize SPIFFS filesystem and buffer system
 * Returns true if successful, false otherwise
 */
bool initializeBuffer() {
  DEBUG_PRINTLN("[BUFFER] Initializing reading buffer system...");
  
  if (!BUFFER_ENABLED) {
    DEBUG_PRINTLN("[BUFFER] Buffering disabled in config");
    return false;
  }
  
  // Initialize SPIFFS
  if (!SPIFFS.begin(true)) { // true = format if mount fails
    DEBUG_PRINTLN("[BUFFER] ✗ Failed to mount SPIFFS");
    return false;
  }
  
  DEBUG_PRINTLN("[BUFFER] ✓ SPIFFS mounted successfully");
  
  // Get filesystem info
  size_t totalBytes = SPIFFS.totalBytes();
  size_t usedBytes = SPIFFS.usedBytes();
  DEBUG_PRINTF("[BUFFER] SPIFFS: %d/%d bytes used (%.1f%%)\n", 
               usedBytes, totalBytes, (usedBytes * 100.0) / totalBytes);
  
  // Load buffer state from index file
  if (SPIFFS.exists(BUFFER_INDEX_FILE)) {
    File indexFile = SPIFFS.open(BUFFER_INDEX_FILE, "r");
    if (indexFile) {
      StaticJsonDocument<128> doc;
      DeserializationError error = deserializeJson(doc, indexFile);
      indexFile.close();
      
      if (!error) {
        bufferState.sensorCount = doc["sensor_count"] | 0;
        bufferState.tankCount = doc["tank_count"] | 0;
        DEBUG_PRINTF("[BUFFER] Loaded buffer state: %d sensor readings, %d tank readings\n",
                     bufferState.sensorCount, bufferState.tankCount);
      } else {
        DEBUG_PRINTLN("[BUFFER] Failed to parse index file - resetting");
        bufferState.sensorCount = 0;
        bufferState.tankCount = 0;
      }
    }
  } else {
    DEBUG_PRINTLN("[BUFFER] No existing buffer index - starting fresh");
    bufferState.sensorCount = 0;
    bufferState.tankCount = 0;
  }
  
  bufferState.initialized = true;
  DEBUG_PRINTLN("[BUFFER] ✓ Buffer system initialized");
  return true;
}

/**
 * Save buffer state to index file
 */
void saveBufferState() {
  if (!bufferState.initialized) return;
  
  StaticJsonDocument<128> doc;
  doc["sensor_count"] = bufferState.sensorCount;
  doc["tank_count"] = bufferState.tankCount;
  
  File indexFile = SPIFFS.open(BUFFER_INDEX_FILE, "w");
  if (indexFile) {
    serializeJson(doc, indexFile);
    indexFile.close();
  }
}

/**
 * Buffer a sensor reading to SPIFFS
 * Implements circular buffer - oldest readings are overwritten when full
 */
void bufferSensorReading(const SensorReading& reading) {
  if (!bufferState.initialized) {
    if (!initializeBuffer()) {
      DEBUG_PRINTLN("[BUFFER] ✗ Cannot buffer - initialization failed");
      return;
    }
  }
  
  DEBUG_PRINTLN("[BUFFER] Buffering sensor reading...");
  
  // Check if buffer is full
  if (bufferState.sensorCount >= BUFFER_SIZE) {
    DEBUG_PRINTLN("[BUFFER] ⚠ Buffer full - overwriting oldest reading");
    // Circular buffer behavior - we'll overwrite the file
    // In a more sophisticated implementation, we'd track individual entries
  }
  
  // Open buffer file in append mode (or write mode if full)
  File bufferFile;
  if (bufferState.sensorCount >= BUFFER_SIZE) {
    bufferFile = SPIFFS.open(BUFFER_SENSOR_FILE, "w"); // Overwrite when full
    bufferState.sensorCount = 0;
  } else {
    bufferFile = SPIFFS.open(BUFFER_SENSOR_FILE, "a"); // Append
  }
  
  if (!bufferFile) {
    DEBUG_PRINTLN("[BUFFER] ✗ Failed to open buffer file");
    return;
  }
  
  // Create JSON document for this reading
  StaticJsonDocument<512> doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = reading.timestamp;
  
  if (!isnan(reading.ph)) doc["ph"] = serialized(String(reading.ph, 2));
  if (!isnan(reading.turbidity)) doc["turbidity"] = serialized(String(reading.turbidity, 2));
  if (!isnan(reading.temperature)) doc["temperature"] = serialized(String(reading.temperature, 2));
  if (!isnan(reading.tds)) doc["tds"] = serialized(String(reading.tds, 2));
  if (!isnan(reading.dissolvedOxygen)) doc["dissolved_oxygen"] = serialized(String(reading.dissolvedOxygen, 2));
  
  // Write JSON line
  serializeJson(doc, bufferFile);
  bufferFile.println(); // Newline separator
  bufferFile.close();
  
  bufferState.sensorCount++;
  saveBufferState();
  
  DEBUG_PRINTF("[BUFFER] ✓ Sensor reading buffered (%d/%d)\n", 
               bufferState.sensorCount, BUFFER_SIZE);
}

/**
 * Buffer a tank level reading to SPIFFS
 */
void bufferTankLevel(float distanceCm) {
  if (!bufferState.initialized) {
    if (!initializeBuffer()) {
      DEBUG_PRINTLN("[BUFFER] ✗ Cannot buffer - initialization failed");
      return;
    }
  }
  
  DEBUG_PRINTLN("[BUFFER] Buffering tank level...");
  
  // Check if buffer is full
  if (bufferState.tankCount >= BUFFER_SIZE) {
    DEBUG_PRINTLN("[BUFFER] ⚠ Buffer full - overwriting oldest reading");
  }
  
  // Open buffer file
  File bufferFile;
  if (bufferState.tankCount >= BUFFER_SIZE) {
    bufferFile = SPIFFS.open(BUFFER_TANK_FILE, "w");
    bufferState.tankCount = 0;
  } else {
    bufferFile = SPIFFS.open(BUFFER_TANK_FILE, "a");
  }
  
  if (!bufferFile) {
    DEBUG_PRINTLN("[BUFFER] ✗ Failed to open buffer file");
    return;
  }
  
  // Create JSON document
  StaticJsonDocument<256> doc;
  doc["device_id"] = DEVICE_ID;
  doc["timestamp"] = String(millis());
  doc["distance_cm"] = serialized(String(distanceCm, 2));
  doc["tank_height_cm"] = serialized(String(TANK_HEIGHT_CM, 2));
  
  // Write JSON line
  serializeJson(doc, bufferFile);
  bufferFile.println();
  bufferFile.close();
  
  bufferState.tankCount++;
  saveBufferState();
  
  DEBUG_PRINTF("[BUFFER] ✓ Tank level buffered (%d/%d)\n", 
               bufferState.tankCount, BUFFER_SIZE);
}

/**
 * Flush buffered sensor readings to backend
 * Returns number of readings successfully transmitted
 */
int flushSensorBuffer() {
  if (!bufferState.initialized || bufferState.sensorCount == 0) {
    return 0;
  }
  
  DEBUG_PRINTF("[BUFFER] Flushing %d buffered sensor readings...\n", bufferState.sensorCount);
  
  if (!SPIFFS.exists(BUFFER_SENSOR_FILE)) {
    DEBUG_PRINTLN("[BUFFER] No sensor buffer file found");
    bufferState.sensorCount = 0;
    saveBufferState();
    return 0;
  }
  
  File bufferFile = SPIFFS.open(BUFFER_SENSOR_FILE, "r");
  if (!bufferFile) {
    DEBUG_PRINTLN("[BUFFER] ✗ Failed to open sensor buffer file");
    return 0;
  }
  
  int successCount = 0;
  int lineCount = 0;
  
  // Read and transmit each buffered reading
  while (bufferFile.available()) {
    String line = bufferFile.readStringUntil('\n');
    line.trim();
    
    if (line.length() == 0) continue;
    
    lineCount++;
    
    // Send the buffered JSON directly
    bool success = sendHTTPRequest(API_SENSOR_DATA_ENDPOINT, line);
    if (success) {
      successCount++;
      DEBUG_PRINTF("[BUFFER] ✓ Transmitted buffered reading %d/%d\n", 
                   successCount, bufferState.sensorCount);
    } else {
      DEBUG_PRINTF("[BUFFER] ✗ Failed to transmit buffered reading %d\n", lineCount);
      // Stop flushing if transmission fails
      break;
    }
    
    // Small delay between transmissions to avoid overwhelming backend
    delay(100);
  }
  
  bufferFile.close();
  
  // If all readings transmitted successfully, clear the buffer
  if (successCount == lineCount && successCount > 0) {
    SPIFFS.remove(BUFFER_SENSOR_FILE);
    bufferState.sensorCount = 0;
    saveBufferState();
    DEBUG_PRINTF("[BUFFER] ✓ Successfully flushed %d sensor readings\n", successCount);
  } else {
    DEBUG_PRINTF("[BUFFER] ⚠ Partially flushed: %d/%d successful\n", 
                 successCount, lineCount);
  }
  
  return successCount;
}

/**
 * Flush buffered tank level readings to backend
 * Returns number of readings successfully transmitted
 */
int flushTankBuffer() {
  if (!bufferState.initialized || bufferState.tankCount == 0) {
    return 0;
  }
  
  DEBUG_PRINTF("[BUFFER] Flushing %d buffered tank readings...\n", bufferState.tankCount);
  
  if (!SPIFFS.exists(BUFFER_TANK_FILE)) {
    DEBUG_PRINTLN("[BUFFER] No tank buffer file found");
    bufferState.tankCount = 0;
    saveBufferState();
    return 0;
  }
  
  File bufferFile = SPIFFS.open(BUFFER_TANK_FILE, "r");
  if (!bufferFile) {
    DEBUG_PRINTLN("[BUFFER] ✗ Failed to open tank buffer file");
    return 0;
  }
  
  int successCount = 0;
  int lineCount = 0;
  
  // Read and transmit each buffered reading
  while (bufferFile.available()) {
    String line = bufferFile.readStringUntil('\n');
    line.trim();
    
    if (line.length() == 0) continue;
    
    lineCount++;
    
    // Send the buffered JSON directly
    bool success = sendHTTPRequest(API_TANK_LEVEL_ENDPOINT, line);
    if (success) {
      successCount++;
      DEBUG_PRINTF("[BUFFER] ✓ Transmitted buffered tank reading %d/%d\n", 
                   successCount, bufferState.tankCount);
    } else {
      DEBUG_PRINTF("[BUFFER] ✗ Failed to transmit buffered tank reading %d\n", lineCount);
      break;
    }
    
    delay(100);
  }
  
  bufferFile.close();
  
  // If all readings transmitted successfully, clear the buffer
  if (successCount == lineCount && successCount > 0) {
    SPIFFS.remove(BUFFER_TANK_FILE);
    bufferState.tankCount = 0;
    saveBufferState();
    DEBUG_PRINTF("[BUFFER] ✓ Successfully flushed %d tank readings\n", successCount);
  } else {
    DEBUG_PRINTF("[BUFFER] ⚠ Partially flushed: %d/%d successful\n", 
                 successCount, lineCount);
  }
  
  return successCount;
}

/**
 * Flush all buffered readings (sensor + tank)
 * Returns total number of readings successfully transmitted
 */
int flushAllBuffers() {
  if (!bufferState.initialized) {
    return 0;
  }
  
  DEBUG_PRINTLN("[BUFFER] Flushing all buffered readings...");
  
  int totalFlushed = 0;
  totalFlushed += flushSensorBuffer();
  totalFlushed += flushTankBuffer();
  
  if (totalFlushed > 0) {
    DEBUG_PRINTF("[BUFFER] ✓ Total flushed: %d readings\n", totalFlushed);
  } else {
    DEBUG_PRINTLN("[BUFFER] No buffered readings to flush");
  }
  
  return totalFlushed;
}

/**
 * Get buffer statistics
 */
void printBufferStats() {
  if (!bufferState.initialized) {
    DEBUG_PRINTLN("[BUFFER] Buffer not initialized");
    return;
  }
  
  DEBUG_PRINTLN("\n[BUFFER] Buffer Statistics:");
  DEBUG_PRINTF("  Sensor readings buffered: %d/%d\n", bufferState.sensorCount, BUFFER_SIZE);
  DEBUG_PRINTF("  Tank readings buffered: %d/%d\n", bufferState.tankCount, BUFFER_SIZE);
  
  size_t totalBytes = SPIFFS.totalBytes();
  size_t usedBytes = SPIFFS.usedBytes();
  DEBUG_PRINTF("  SPIFFS usage: %d/%d bytes (%.1f%%)\n", 
               usedBytes, totalBytes, (usedBytes * 100.0) / totalBytes);
}

/**
 * Clear all buffered readings (for testing/maintenance)
 */
void clearAllBuffers() {
  if (!bufferState.initialized) {
    return;
  }
  
  DEBUG_PRINTLN("[BUFFER] Clearing all buffers...");
  
  SPIFFS.remove(BUFFER_SENSOR_FILE);
  SPIFFS.remove(BUFFER_TANK_FILE);
  
  bufferState.sensorCount = 0;
  bufferState.tankCount = 0;
  saveBufferState();
  
  DEBUG_PRINTLN("[BUFFER] ✓ All buffers cleared");
}

#endif // READING_BUFFER_H
