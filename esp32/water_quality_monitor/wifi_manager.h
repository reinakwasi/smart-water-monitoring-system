/**
 * WiFi Manager Module
 * Handles WiFi connection and reconnection logic
 * 
 * Requirements: 1.7, 16.1
 * Task 18.1: WiFi connection manager with retry logic
 */

#ifndef WIFI_MANAGER_H
#define WIFI_MANAGER_H

#include <Arduino.h>
#include <WiFi.h>
#include "config.h"

// WiFi connection state
static unsigned long lastConnectionAttempt = 0;
static int connectionRetries = 0;
static const int MAX_CONNECTION_RETRIES = 5;

/**
 * Initialize WiFi and attempt initial connection
 * Implements retry logic with delays between attempts
 */
void initializeWiFi() {
  DEBUG_PRINTLN("[WIFI] Initializing WiFi manager...");
  DEBUG_PRINTF("[WIFI] SSID: %s\n", WIFI_SSID);
  
  // Set WiFi mode to station (client)
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.persistent(true);
  
  // Attempt initial connection
  connectionRetries = 0;
  bool connected = connectWiFi();
  
  if (connected) {
    DEBUG_PRINTLN("[WIFI] ✓ WiFi initialized and connected");
    DEBUG_PRINTF("[WIFI] IP Address: %s\n", getLocalIP().c_str());
    DEBUG_PRINTF("[WIFI] Signal Strength: %d dBm\n", WiFi.RSSI());
  } else {
    DEBUG_PRINTLN("[WIFI] ✗ WiFi initialization failed - will retry in main loop");
  }
}

/**
 * Attempt to connect to WiFi with timeout and retry logic
 * Returns true if connection successful, false otherwise
 */
bool connectWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    DEBUG_PRINTLN("[WIFI] Already connected");
    return true;
  }
  
  connectionRetries++;
  DEBUG_PRINTF("[WIFI] Connection attempt %d/%d\n", connectionRetries, MAX_CONNECTION_RETRIES);
  
  // Start connection
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  // Wait for connection with timeout
  unsigned long startTime = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - startTime < WIFI_TIMEOUT_MS) {
    delay(500);
    DEBUG_PRINT(".");
  }
  DEBUG_PRINTLN();
  
  if (WiFi.status() == WL_CONNECTED) {
    DEBUG_PRINTLN("[WIFI] ✓ Connected successfully");
    DEBUG_PRINTF("[WIFI] IP: %s\n", WiFi.localIP().toString().c_str());
    DEBUG_PRINTF("[WIFI] Gateway: %s\n", WiFi.gatewayIP().toString().c_str());
    DEBUG_PRINTF("[WIFI] Subnet: %s\n", WiFi.subnetMask().toString().c_str());
    DEBUG_PRINTF("[WIFI] DNS: %s\n", WiFi.dnsIP().toString().c_str());
    DEBUG_PRINTF("[WIFI] RSSI: %d dBm\n", WiFi.RSSI());
    
    connectionRetries = 0; // Reset retry counter on success
    lastConnectionAttempt = millis();
    return true;
  } else {
    DEBUG_PRINTLN("[WIFI] ✗ Connection failed");
    DEBUG_PRINTF("[WIFI] Status code: %d\n", WiFi.status());
    
    // Check if we should retry
    if (connectionRetries < MAX_CONNECTION_RETRIES) {
      DEBUG_PRINTF("[WIFI] Waiting %d ms before retry...\n", WIFI_RETRY_DELAY_MS);
      delay(WIFI_RETRY_DELAY_MS);
      return connectWiFi(); // Recursive retry
    } else {
      DEBUG_PRINTLN("[WIFI] ✗ Max retries reached - giving up");
      connectionRetries = 0; // Reset for next attempt cycle
      lastConnectionAttempt = millis();
      return false;
    }
  }
}

/**
 * Check if WiFi is currently connected
 * Returns true if connected, false otherwise
 */
bool isWiFiConnected() {
  return WiFi.status() == WL_CONNECTED;
}

/**
 * Handle WiFi disconnection and attempt reconnection
 * Implements retry logic with delays between attempts
 */
void handleWiFiReconnection() {
  if (WiFi.status() == WL_CONNECTED) {
    return; // Already connected
  }
  
  // Check if enough time has passed since last attempt
  unsigned long currentTime = millis();
  if (currentTime - lastConnectionAttempt < WIFI_RETRY_DELAY_MS) {
    return; // Too soon to retry
  }
  
  DEBUG_PRINTLN("[WIFI] Disconnected - attempting reconnection...");
  DEBUG_PRINTF("[WIFI] Disconnect reason: %d\n", WiFi.status());
  
  // Disconnect cleanly before reconnecting
  WiFi.disconnect();
  delay(100);
  
  // Attempt reconnection
  bool connected = connectWiFi();
  
  if (connected) {
    DEBUG_PRINTLN("[WIFI] ✓ Reconnection successful");
  } else {
    DEBUG_PRINTLN("[WIFI] ✗ Reconnection failed - will retry later");
  }
}

/**
 * Get local IP address as string
 * Returns IP address or "0.0.0.0" if not connected
 */
String getLocalIP() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFi.localIP().toString();
  }
  return "0.0.0.0";
}

/**
 * Get WiFi signal strength in dBm
 * Returns RSSI value or 0 if not connected
 */
int getWiFiSignalStrength() {
  if (WiFi.status() == WL_CONNECTED) {
    return WiFi.RSSI();
  }
  return 0;
}

/**
 * Get WiFi connection status as human-readable string
 */
String getWiFiStatusString() {
  switch (WiFi.status()) {
    case WL_CONNECTED:
      return "Connected";
    case WL_NO_SHIELD:
      return "No WiFi shield";
    case WL_IDLE_STATUS:
      return "Idle";
    case WL_NO_SSID_AVAIL:
      return "SSID not available";
    case WL_SCAN_COMPLETED:
      return "Scan completed";
    case WL_CONNECT_FAILED:
      return "Connection failed";
    case WL_CONNECTION_LOST:
      return "Connection lost";
    case WL_DISCONNECTED:
      return "Disconnected";
    default:
      return "Unknown";
  }
}

#endif // WIFI_MANAGER_H
