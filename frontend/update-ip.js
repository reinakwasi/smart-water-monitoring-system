#!/usr/bin/env node

/**
 * AquaGuard IP update helper.
 *
 * This detects the computer's current Wi-Fi/Ethernet IPv4 address and updates
 * src/config/api.config.js for physical-device testing.
 *
 * Usage:
 *   npm run update-ip
 */

const fs = require('fs');
const path = require('path');
const os = require('os');

const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[36m',
  red: '\x1b[31m',
};

const configPath = path.join(__dirname, 'src', 'config', 'api.config.js');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  const preferredNames = ['Wi-Fi', 'Ethernet', 'en0', 'eth0', 'wlan0'];

  for (const name of preferredNames) {
    const iface = interfaces[name]?.find(details => details.family === 'IPv4' && !details.internal);
    if (iface) return iface.address;
  }

  for (const name of Object.keys(interfaces)) {
    const iface = interfaces[name].find(
      details => details.family === 'IPv4' && !details.internal && !details.address.startsWith('169.254'),
    );
    if (iface) return iface.address;
  }

  return null;
}

function updateConfigFile(newIP) {
  try {
    let content = fs.readFileSync(configPath, 'utf8');
    const ipRegex = /PC_WIFI_IP:\s*['"]([^'"]+)['"]/;
    const currentIP = content.match(ipRegex)?.[1] || null;

    if (currentIP === newIP) {
      console.log(`${colors.green}OK${colors.reset} IP address is already up to date: ${colors.bright}${newIP}${colors.reset}`);
      return true;
    }

    content = content.replace(ipRegex, `PC_WIFI_IP: '${newIP}'`);
    fs.writeFileSync(configPath, content, 'utf8');

    console.log(`${colors.green}OK${colors.reset} Configuration updated successfully.`);
    console.log(`  Old IP: ${colors.yellow}${currentIP || 'Unknown'}${colors.reset}`);
    console.log(`  New IP: ${colors.green}${newIP}${colors.reset}`);
    return true;
  } catch (error) {
    console.error(`${colors.red}ERROR${colors.reset} Could not update configuration:`, error.message);
    return false;
  }
}

function main() {
  console.log(`\n${colors.blue}${'='.repeat(42)}${colors.reset}`);
  console.log(`${colors.bright}  AquaGuard IP update helper${colors.reset}`);
  console.log(`${colors.blue}${'='.repeat(42)}${colors.reset}\n`);

  console.log('Detecting this computer\'s IP address...');
  const localIP = getLocalIP();

  if (!localIP) {
    console.error(`${colors.red}ERROR${colors.reset} Could not detect an IPv4 address.`);
    console.log('\nPossible reasons:');
    console.log('  - Wi-Fi/Ethernet is not connected');
    console.log('  - The network interface is disabled');
    console.log('\nManual setup:');
    console.log(`  1. Run ${colors.bright}ipconfig${colors.reset} on Windows.`);
    console.log(`  2. Open ${colors.bright}${configPath}${colors.reset}.`);
    console.log('  3. Set PC_WIFI_IP to your IPv4 address.');
    process.exit(1);
  }

  console.log(`${colors.green}OK${colors.reset} Detected IP: ${colors.bright}${localIP}${colors.reset}\n`);
  console.log('Updating app configuration...');
  const success = updateConfigFile(localIP);

  if (!success) {
    console.log(`\n${colors.red}Update failed.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\n${colors.green}Done.${colors.reset} Physical-device testing will use ${colors.bright}${localIP}${colors.reset}.`);
  console.log('\nNext steps:');
  console.log('  - Android emulator: no change needed; it uses 10.0.2.2 automatically.');
  console.log('  - Physical Android device: set USE_PHYSICAL_DEVICE to true, rebuild the app, and allow port 8080 through Windows Firewall.');
}

main();
