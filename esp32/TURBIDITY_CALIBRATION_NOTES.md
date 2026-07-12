# Turbidity Sensor Calibration Notes

## Scientific Disclaimer

⚠️ **IMPORTANT**: This project uses a **self-calibrated relative turbidity index (0-100)**, NOT certified NTU measurements.

### Why Not NTU?

**NTU (Nephelometric Turbidity Units)** is a standardized measurement that requires:
- **Formazin polymer suspension** as a calibration standard (precisely 400 NTU formazin solution)
- **NIST-traceable calibration** against known standards
- **Specific optical geometry** (90° nephelometric detection)
- **Laboratory-grade equipment** with temperature control

Without access to formazin standards and proper calibration procedures, claiming "NTU" readings would be scientifically dishonest.

---

## Our Approach: Relative Turbidity Index

Instead, we use a **self-calibrated 0-100 relative index**:

### Formula:
```
turbidityIndex = (CLEAR_WATER_VOLTAGE - currentVoltage) / CLEAR_WATER_VOLTAGE × 100
```

Where:
- **CLEAR_WATER_VOLTAGE** = Baseline voltage from clean tap water (~1.85V for this sensor)
- **currentVoltage** = Real-time sensor reading
- **turbidityIndex** = Result clamped between 0-100

### Interpretation:
- **0-10**: Very clear water (close to tap water baseline)
- **10-30**: Clear water
- **30-50**: Slightly cloudy
- **50-100**: Cloudy/murky water

---

## Calibration Process

### Step 1: Measure Clear Water Baseline
1. Fill a clean glass with fresh tap water
2. Insert turbidity sensor probe
3. Record voltage over 30 seconds
4. Take average of stable readings

**Our measurements:**
- Clean tap water: **1.74-1.79V** (typical range)
- Average: **~1.76V**

### Step 2: Set Reference Voltage
Set `CLEAR_WATER_VOLTAGE` **slightly above** measured baseline to account for day-to-day water quality variation:

```cpp
#define CLEAR_WATER_VOLTAGE 1.85  // ~0.09V margin above 1.76V average
```

This margin prevents clean water from showing negative turbidity on days when tap water is slightly cleaner.

### Step 3: Test with Dirty Water
1. Add dirt, coffee, or milk to water to create turbidity
2. Observe voltage **decreases** as water gets cloudier
3. Verify index **increases** (0 → 100) as cloudiness increases

---

## Sensor Behavior

### Voltage vs Turbidity Relationship:
| Water Condition | Voltage | Turbidity Index | Quality |
|-----------------|---------|-----------------|---------|
| Very clean      | 1.79V   | 3.2 /100       | ✓ Very Clear |
| Tap water       | 1.76V   | 4.9 /100       | ✓ Very Clear |
| Slightly cloudy | 1.50V   | 18.9 /100      | ✓ Clear |
| Cloudy          | 1.20V   | 35.1 /100      | ○ Slightly Cloudy |
| Very murky      | 0.80V   | 56.8 /100      | ⚠ Cloudy/Murky |

**Pattern:** Lower voltage = cloudier water = higher index

---

## Backend Integration Considerations

### Problem:
Your FastAPI backend expects **turbidity in NTU** (0-3000 NTU range):
```python
turbidity: float = Field(..., ge=0.0, le=3000.0, description="Turbidity in NTU (0-3000)")
```

### Solution Options:

#### **Option 1: Map Index to Approximate NTU (Quick Fix)**
Convert 0-100 index to approximate NTU range:
```cpp
// Rough mapping: 0-100 index → 0-50 NTU (WHO drinking water guideline: <5 NTU)
float approxNTU = turbidityIndex * 0.5;  // Maps 100 → 50 NTU
```

Add comment explaining this is an **approximation** without formazin calibration.

#### **Option 2: Scale to 0-3000 NTU Range (Fills Backend Range)**
```cpp
// Scale 0-100 index to backend's 0-3000 NTU range
float scaledTurbidity = turbidityIndex * 30.0;  // Maps 100 → 3000 NTU
```

This fills the backend's expected range but is **NOT real NTU**.

#### **Option 3: Update Backend Schema (Most Honest)**
Change backend to accept **turbidity index** instead of NTU:
```python
turbidity: float = Field(..., ge=0.0, le=100.0, description="Turbidity index (0-100, relative)")
```

This is the most scientifically honest approach.

---

## Code Implementation

### Current Code (all_three_sensors.ino):
```cpp
// Turbidity calibration constant
#define CLEAR_WATER_VOLTAGE 1.85

// In loop():
float turb_volt = turb_adc * (3.3 / 4095.0);

// Calculate relative turbidity index (0-100)
// NOTE: Self-calibrated, NOT certified NTU!
float turbidityIndex = ((CLEAR_WATER_VOLTAGE - turb_volt) / CLEAR_WATER_VOLTAGE) * 100.0;

// Clamp to 0-100 range
if(turbidityIndex < 0) turbidityIndex = 0;
if(turbidityIndex > 100) turbidityIndex = 100;

// Display
Serial.print("TURB: ");
Serial.print(turbidityIndex, 1);
Serial.print(" /100 (");
Serial.print(turb_volt, 2);
Serial.print("V)");
```

---

## Adjusting CLEAR_WATER_VOLTAGE

If your clean water readings seem off, adjust the reference:

### If turbidityIndex is negative for clean water:
```cpp
#define CLEAR_WATER_VOLTAGE 1.90  // Increase reference
```

### If turbidityIndex is too high for clean water (>15):
```cpp
#define CLEAR_WATER_VOLTAGE 1.80  // Decrease reference
```

**Goal:** Clean tap water should read **0-10** on the turbidity index.

---

## Future Improvements

### For More Accurate NTU Measurements:

1. **Purchase formazin standards** (e.g., 100 NTU, 800 NTU calibration solutions)
2. **Calibrate against standards:**
   - Measure voltage at 0 NTU (distilled water)
   - Measure voltage at 100 NTU (formazin)
   - Derive calibration curve
3. **Update formula** with real calibration points

**Cost:** ~$50-100 for formazin standard kit

---

## References

- WHO Guidelines for Drinking Water Quality: Turbidity should be <5 NTU
- EPA Method 180.1: Nephelometric turbidity measurement
- ISO 7027: Water quality - Determination of turbidity

---

**Summary:** We use a relative 0-100 index calibrated to this sensor's clean water baseline. This is scientifically honest and practically useful for relative water quality comparison, even though it's not a true NTU measurement.
