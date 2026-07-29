# 🎯 COMPLETE WATER QUALITY MONITOR - WIRING GUIDE

**ESP32 + ADS1115 + Breadboard + 3 Sensors**

---

## 📦 WHAT YOU NEED:

1. ✅ ESP32 (WROOM)
2. ✅ ADS1115 module
3. ✅ Breadboard (830 points)
4. ✅ TDS sensor (pins: +, -, A)
5. ✅ Turbidity sensor (pins: U, G, A, D)
6. ✅ pH sensor (pins: U+, G, Po)
7. ✅ Jumper wires (Male-to-Male, Male-to-Female)

---

## 🔌 COMPLETE WIRING:

### **STEP 1: ESP32 to Breadboard Power**

```
ESP32 → Breadboard
━━━━━━━━━━━━━━━━━━━━━━━━
3V3 (pin 3, RIGHT) → + rail (red line)
GND (pin 2, RIGHT) → - rail (blue line)
```

---

### **STEP 2: ESP32 to ADS1115 (I2C)**

```
ESP32 → ADS1115
━━━━━━━━━━━━━━━━━━━━━━━━
GPIO 21 (D21) → SDA
GPIO 22 (D22) → SCL
3V3           → VDD
GND           → GND
```

**D21 and D22 location on ESP32:**
- LEFT side, pins 10-11 from top

---

### **STEP 3: ADS1115 Power (via Breadboard)**

```
Breadboard → ADS1115
━━━━━━━━━━━━━━━━━━━━━━━━
+ rail → VDD
- rail → GND
```

---

### **STEP 4: Connect Sensors to ADS1115**

#### **TDS Sensor:**
```
TDS Module → Breadboard/ADS1115
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
+ (power)  → + rail (breadboard)
- (ground) → - rail (breadboard)
A (signal) → A0 (ADS1115)
```

#### **Turbidity Sensor:**
```
Turbidity → Breadboard/ADS1115
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
U (power)  → + rail (breadboard)
G (ground) → - rail (breadboard)
A (signal) → A1 (ADS1115)
D (digital)→ Not connected
```

#### **pH Sensor:**
```
pH Module → Breadboard/ADS1115
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
U+ (power)  → + rail (breadboard)
G (ground)  → - rail (breadboard)
Po (signal) → A2 (ADS1115)
```

---

## 📊 CONNECTION SUMMARY:

```
        [ESP32]
          │
    ┌─────┴─────┐
    │           │
  3V3         GND
    │           │
    ↓           ↓
[Breadboard + rail] [Breadboard - rail]
    │   │   │           │   │   │
    │   │   │           │   │   │
    │   │   └──→ TDS +  │   │   └──→ TDS -
    │   │                │   │
    │   └──────→ TURB U │   └──────→ TURB G
    │                    │
    └──────────→ pH U+   └──────────→ pH G


[ESP32 D21,D22] ←I2C→ [ADS1115]
                        │
                   ┌────┼────┬────┐
                   │    │    │    │
                   A0   A1   A2   A3
                   │    │    │    │
                   │    │    │    (unused)
                   │    │    │
               TDS A  TURB A  pH Po
```

---

## 🎨 BREADBOARD LAYOUT:

```
Power Rails        Main Area
  + -
  │ │              [ESP32 here]
  │ │
  │ │              [ADS1115 here]
  │ │
  │ │←── TDS +,-
  │ │←── TURB U,G
  │ │←── pH U+,G
```

---

## 🔧 STEP-BY-STEP ASSEMBLY:

### **1. Set up breadboard power:**
- ESP32 3V3 → breadboard + rail (RED wire)
- ESP32 GND → breadboard - rail (BLACK wire)

### **2. Connect ADS1115 I2C:**
- ESP32 GPIO21 → ADS1115 SDA
- ESP32 GPIO22 → ADS1115 SCL
- Breadboard + → ADS1115 VDD
- Breadboard - → ADS1115 GND

### **3. Connect TDS sensor:**
- TDS + → breadboard +
- TDS - → breadboard -
- TDS A → ADS1115 A0

### **4. Connect Turbidity sensor:**
- TURB U → breadboard +
- TURB G → breadboard -
- TURB A → ADS1115 A1

### **5. Connect pH sensor:**
- pH U+ → breadboard +
- pH G → breadboard -
- pH Po → ADS1115 A2

---

## 📚 LIBRARY INSTALLATION:

**Before uploading code, install library:**

1. Arduino IDE → Tools → Manage Libraries
2. Search: **"Adafruit ADS1X15"**
3. Click **Install**
4. Also install: **"Adafruit BusIO"** (dependency)

---

## 📤 UPLOAD CODE:

1. Open `ADS1115_setup.ino`
2. Board: **ESP32 Dev Module**
3. Port: Your COM port
4. Upload
5. Open Serial Monitor (115200 baud)

---

## 🎯 EXPECTED OUTPUT:

```
╔════════════════════════════════════╗
║  WATER QUALITY MONITOR             ║
║  ESP32 + ADS1115 + 3 Sensors       ║
╚════════════════════════════════════╝

✓ ADS1115 initialized!

Sensor Channels:
  A0: TDS Sensor
  A1: Turbidity Sensor
  A2: pH Sensor

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TDS:  120 ppm (1.23V) | ✓ Good
TURB: 50 NTU (2.75V) | ✓ Clear
pH:   7.2 (1.68V) | ✓ Neutral
```

---

## 🔍 TROUBLESHOOTING:

### **"ADS1115 not found!"**
- Check I2C wiring (SDA, SCL)
- Check ADS1115 power (VDD, GND)
- Try different I2C address (A0/A1/A2 pins on ADS1115)

### **All readings = 0**
- Check sensor power connections
- Ensure sensors plugged into correct ADS1115 channels

### **Readings unstable**
- ADS1115 solves this! Much more stable than ESP32 ADC

---

## ✅ ADVANTAGES OF THIS SETUP:

1. ✅ **Stable readings** (16-bit ADC)
2. ✅ **No pin damage** (ADS1115 protected)
3. ✅ **All 3 sensors at once**
4. ✅ **Only 2 ESP32 pins used** (I2C)
5. ✅ **Professional grade accuracy**

---

**This is the BEST way to connect your sensors!** 🎉
