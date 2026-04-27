/**
 * HTTP Client Module
 * Handles HTTP communication with backend API
 * 
 * Requirements: 1.7, 16.1
 * Task 18.2: HTTP client with exponential backoff retry logic
 */

#ifndef HTTP_CLIENT_H
#define HTTP_CLIENT_H

#include <Arduino.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFi.h>
#include "config.h"
#include "sensor_manager.h"

// Forward declaration for buffer functions
void bufferSensorReading(const SensorReading& reading);
void bufferTankLevel(float distanceCm);

/**
 * Send HTTP POST request with exponential backoff retry
 * Implements retry logic: 1s, 2s, 4s delays
 * Returns true if request successful (2xx status), false otherwise
 */
bool sendHTTPRequest(const String& endpoint, const String& jsonPayload) {
  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_PRINTLN("[HTTP] ✗ WiFi not connected - cannot send request");
    return false;
  }
  
  HTTPClient http;
  String url = String(API_BASE_URL) + endpoint;
  
  DEBUG_PRINTF("[HTTP] POST %s\n", url.c_str());
  DEBUG_PRINTF("[HTTP] Payload: %s\n", jsonPayload.c_str());
  
  // Retry with exponential backoff: 1s, 2s, 4s
  int retryDelays[] = {1000, 2000, 4000};
  int maxRetries = HTTP_MAX_RETRIES;
  
  for (int attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      int delayMs = retryDelays[attempt - 1];
      DEBUG_PRINTF("[HTTP] Retry attempt %d/%d after %d ms delay\n", 
                   attempt + 1, maxRetries, delayMs);
      delay(delayMs);
      
      // Check WiFi still connected before retry
      if (WiFi.status() != WL_CONNECTED) {
        DEBUG_PRINTLN("[HTTP] ✗ WiFi disconnected during retry - aborting");
        http.end();
        return false;
      }
    }
    
    // Begin HTTP connection
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    http.setTimeout(API_TIMEOUT_MS);
    
    // Send POST request
    int httpResponseCode = http.POST(jsonPayload);
    
    DEBUG_PRINTF("[HTTP] Response code: %d\n", httpResponseCode);
    
    // Handle response
    if (httpResponseCode > 0) {
      String response = http.getString();
      DEBUG_PRINTF("[HTTP] Response: %s\n", response.c_str());
      
      // Check for success (2xx status codes)
      if (httpResponseCode >= 200 && httpResponseCode < 300) {
        DEBUG_PRINTLN("[HTTP] ✓ Request successful");
        http.end();
        return true;
      }
      // Handle 4xx client errors (don't retry)
      else if (httpResponseCode >= 400 && httpResponseCode < 500) {
        DEBUG_PRINTF("[HTTP] ✗ Client error %d - not retrying\n", httpResponseCode);
        http.end();
        return false;
      }
      // Handle 5xx server errors (retry)
      else if (httpResponseCode >= 500) {
        DEBUG_PRINTF("[HTTP] ✗ Server error %d - will retry\n", httpResponseCode);
        // Continue to retry
      }
      // Handle other status codes
      else {
        DEBUG_PRINTF("[HTTP] ✗ Unexpected status %d - will retry\n", httpResponseCode);
        // Continue to retry
      }
    } else {
      // HTTP request failed (network error, timeout, etc.)
      DEBUG_PRINTF("[HTTP] ✗ Request failed: %s\n", http.errorToString(httpResponseCode).c_str());
      // Continue to retry
    }
    
    http.end();
  }
  
  DEBUG_PRINTLN("[HTTP] ✗ All retry attempts exhausted - request failed");
  return false;
}

/**
 * Transmit sensor reading to backend API
 * POST /api/v1/sensor-data
 * Returns true if successful, false otherwise
 */
bool transmitSensorReading(const SensorReading& reading) {
  DEBUG_PRINTLN("[HTTP] Preparing sensor data transmission...");
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_PRINTLN("[HTTP] ✗ WiFi not connected - buffering reading");
    bufferSensorReading(reading);
    return false;
  }
  
  // Create JSON document
  StaticJsonDocument<512> doc;
  
  // Add device ID
  doc["device_id"] = DEVICE_ID;
  
  // Add timestamp (ISO8601 format approximation)
  // In production, use NTP time sync for accurate timestamps
  doc["timestamp"] = reading.timestamp;
  
  // Add sensor readings (handle NaN values)
  if (!isnan(reading.ph)) {
    doc["ph"] = serialized(String(reading.ph, 2));
  } else {
    doc["ph"] = nullptr;
  }
  
  if (!isnan(reading.turbidity)) {
    doc["turbidity"] = serialized(String(reading.turbidity, 2));
  } else {
    doc["turbidity"] = nullptr;
  }
  
  if (!isnan(reading.temperature)) {
    doc["temperature"] = serialized(String(reading.temperature, 2));
  } else {
    doc["temperature"] = nullptr;
  }
  
  if (!isnan(reading.tds)) {
    doc["tds"] = serialized(String(reading.tds, 2));
  } else {
    doc["tds"] = nullptr;
  }
  
  if (!isnan(reading.dissolvedOxygen)) {
    doc["dissolved_oxygen"] = serialized(String(reading.dissolvedOxygen, 2));
  } else {
    doc["dissolved_oxygen"] = nullptr;
  }
  
  // Serialize to JSON string
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  // Send HTTP request
  bool success = sendHTTPRequest(API_SENSOR_DATA_ENDPOINT, jsonPayload);
  
  if (!success) {
    DEBUG_PRINTLN("[HTTP] ✗ Failed to transmit sensor data - buffering");
    bufferSensorReading(reading);
  }
  
  return success;
}

/**
 * Transmit tank level to backend API
 * POST /api/v1/tank-level
 * Returns true if successful, false otherwise
 */
bool transmitTankLevel(float distanceCm) {
  DEBUG_PRINTLN("[HTTP] Preparing tank level transmission...");
  
  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    DEBUG_PRINTLN("[HTTP] ✗ WiFi not connected - buffering tank level");
    bufferTankLevel(distanceCm);
    return false;
  }
  
  // Validate distance reading
  if (isnan(distanceCm) || distanceCm < 0 || distanceCm > ULTRASONIC_MAX_DISTANCE_CM) {
    DEBUG_PRINTLN("[HTTP] ✗ Invalid tank level reading - not transmitting");
    return false;
  }
  
  // Create JSON document
  StaticJsonDocument<256> doc;
  
  // Add device ID
  doc["device_id"] = DEVICE_ID;
  
  // Add timestamp
  doc["timestamp"] = String(millis());
  
  // Add distance and tank height
  doc["distance_cm"] = serialized(String(distanceCm, 2));
  doc["tank_height_cm"] = serialized(String(TANK_HEIGHT_CM, 2));
  
  // Serialize to JSON string
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  // Send HTTP request
  bool success = sendHTTPRequest(API_TANK_LEVEL_ENDPOINT, jsonPayload);
  
  if (!success) {
    DEBUG_PRINTLN("[HTTP] ✗ Failed to transmit tank level - buffering");
    bufferTankLevel(distanceCm);
  }
  
  return success;
}

#endif // HTTP_CLIENT_H
