# Turbidity Schema Migration: NTU → Relative Index (0-100)

## Overview
This document outlines all changes needed to migrate from fake "NTU" turbidity values to an honest 0-100 relative turbidity index.

---

## 🎯 Goal
Replace all references to turbidity measured in "NTU" (0-3000 range) with a self-calibrated relative turbidity index (0-100 scale), since we lack formazin calibration standards required for true NTU measurements.

---

## 📋 Files to Modify

### 1. **`app/models/schemas.py`** ✏️
**Lines to change:**

#### SensorDataRequest (Line 62-63):
**Before:**
```python
turbidity: float = Field(..., ge=0.0, le=3000.0, description="Turbidity in NTU (0-3000)")
```

**After:**
```python
turbidity_index: float = Field(..., ge=0.0, le=100.0, description="Turbidity index (0-100, self-calibrated relative scale, NOT certified NTU)")
```

#### Docstring (Line 52-53):
**Before:**
```python
- Turbidity: 0-3000 NTU
```

**After:**
```python
- Turbidity Index: 0-100 (relative, self-calibrated)
```

#### field_validator (Line 87-92):
**Before:**
```python
@field_validator('turbidity')
@classmethod
def validate_turbidity_precision(cls, v: float) -> float:
    """Validate turbidity precision to ±5 NTU (Requirement 1.2)"""
    return round(v, 1)
```

**After:**
```python
@field_validator('turbidity_index')
@classmethod
def validate_turbidity_index_precision(cls, v: float) -> float:
    """Validate turbidity index precision to 0.1 units (self-calibrated relative scale)"""
    return round(v, 1)
```

#### Example JSON (Line 73):
**Before:**
```python
"turbidity": 15.5,
```

**After:**
```python
"turbidity_index": 15.5,
```

#### All other examples in schemas.py:
- Replace `"turbidity"` → `"turbidity_index"` in all JSON examples
- **Affected lines:** 151, 170, 177, 217, 224, 252, 259

---

### 2. **`app/models/database.py`** ✏️

#### SensorReading model (Line 18):
**Before:**
```python
turbidity: float
```

**After:**
```python
turbidity_index: float  # 0-100 relative scale, self-calibrated
```

#### Example JSON (Line 42):
**Before:**
```python
"turbidity": 15.5,
```

**After:**
```python
"turbidity_index": 15.5,
```

#### SHAP values examples (Lines 52, 59):
Keep as `"turbidity"` in SHAP dictionaries - this is the ML feature name.

---

### 3. **`app/api/v1/endpoints/sensor.py`** ✏️

#### sensor_dict construction (Line 172):
**Before:**
```python
sensor_dict = {
    "ph": sensor_data.ph,
    "turbidity": sensor_data.turbidity,
    ...
}
```

**After:**
```python
sensor_dict = {
    "ph": sensor_data.ph,
    "turbidity": sensor_data.turbidity_index,  # ML model still uses "turbidity" as feature name
    ...
}
```

#### Historical readings (Line 228):
**Before:**
```python
"turbidity": reading["turbidity"],
```

**After:**
```python
"turbidity": reading["turbidity_index"],
```

#### Persisting reading (Line 291):
**Before:**
```python
"turbidity": sensor_data.turbidity,
```

**After:**
```python
"turbidity_index": sensor_data.turbidity_index,
```

---

### 4. **`app/api/v1/endpoints/config.py`** ✏️

#### Default quality thresholds (Lines 68-71, 163-166):
**Before:**
```python
"turbidity": {
    "safe_max": 5.0,
    "unsafe_max": 25.0
},
```

**After:**
```python
"turbidity_index": {
    "safe_max": 10.0,   # 0-10 = clear water
    "unsafe_max": 50.0  # >50 = cloudy/unsafe
},
```

**Rationale:** On 0-100 scale:
- 0-10: Very clear/clear (equivalent to <5 NTU)
- 10-30: Slightly cloudy
- 30-50: Cloudy
- 50-100: Very murky/unsafe

#### Calibration max_offsets (Line 296):
**Before:**
```python
"turbidity": 100.0,
```

**After:**
```python
"turbidity_index": 30.0,  # Max offset on 0-100 scale
```

#### Calibration offset field (Line 319):
**Before:**
```python
"turbidity_offset": 0.0,
```

**After:**
```python
"turbidity_index_offset": 0.0,
```

---

### 5. **`app/api/v1/endpoints/status.py`** ✏️

#### Parameters dict (Lines 194, 436):
**Before:**
```python
"turbidity": latest_sensor_reading["turbidity"],
```

**After:**
```python
"turbidity_index": latest_sensor_reading["turbidity_index"],
```

#### Query parameter filter (Line 302):
**Before:**
```python
parameter: Optional[str] = Query(None, description="Filter by specific parameter (ph, turbidity, temperature, tds, dissolved_oxygen, tank_level, all)"),
```

**After:**
```python
parameter: Optional[str] = Query(None, description="Filter by specific parameter (ph, turbidity_index, temperature, tds, dissolved_oxygen, tank_level, all)"),
```

#### Valid parameters list (Line 371):
**Before:**
```python
valid_parameters = ["ph", "turbidity", "temperature", "tds", "dissolved_oxygen", "tank_level", "all", None]
```

**After:**
```python
valid_parameters = ["ph", "turbidity_index", "temperature", "tds", "dissolved_oxygen", "tank_level", "all", None]
```

---

### 6. **`ml/data_preparation.py`** ⚠️ **NO CHANGE NEEDED**

**Keep as is!** The ML model feature name remains `"turbidity"` internally. When we pass data to the ML model, we map:
```python
sensor_dict["turbidity"] = sensor_data.turbidity_index
```

This keeps the ML model interface unchanged while updating the API schema.

---

### 7. **`app/services/email_service.py`** ✏️

#### Email template (Line 309):
**Before:**
```python
Track pH, Turbidity, TDS, and Temperature 24/7
```

**After:**
```python
Track pH, Turbidity Index, TDS, and Temperature 24/7
```

---

### 8. **Test Files** ✏️

#### `tests/conftest.py` (Line 93):
**Before:**
```python
"turbidity": 15.5,
```

**After:**
```python
"turbidity_index": 15.5,
```

#### `insert_sample_data.py` (Line 29):
**Before:**
```python
"turbidity": 3.1,
```

**After:**
```python
"turbidity_index": 3.1,
```

#### Display (Line 61):
**Before:**
```python
print(f"   Turbidity: {sensor_data['turbidity']}")
```

**After:**
```python
print(f"   Turbidity Index: {sensor_data['turbidity_index']} /100")
```

---

### 9. **SensorType Enum** ✏️

#### `app/models/schemas.py` (Line 601):
**Before:**
```python
TURBIDITY = "turbidity"
```

**After:**
```python
TURBIDITY_INDEX = "turbidity_index"
```

---

## ⚠️ CRITICAL: ML Model Compatibility

### Internal ML Feature Mapping:
The ML models (Random Forest classifier, XGBoost risk predictor) were trained with feature name **"turbidity"**.

**Solution:** When constructing `sensor_dict` for ML inference, we map:
```python
sensor_dict = {
    "ph": sensor_data.ph,
    "turbidity": sensor_data.turbidity_index,  # <-- Map API field to ML feature name
    "temperature": sensor_data.temperature,
    "tds": sensor_data.tds,
    "dissolved_oxygen": sensor_data.dissolved_oxygen
}
```

This keeps ML models working without retraining while updating the API to be scientifically honest.

---

## 🎨 Frontend/App Changes Needed

**File:** `flutter_app/lib/.../` (or React/Vue files)

### Display Labels:
**Before:**
```
"Turbidity: 15.5 NTU"
```

**After:**
```
"Turbidity Index: 15.5 /100"
```

### JSON Field Names:
Update API request/response parsing:
```dart
// Before
double turbidity = response['turbidity'];

// After
double turbidityIndex = response['turbidity_index'];
```

---

## 📊 Database Migration

### Existing MongoDB Documents:
If you have existing sensor_readings documents with `"turbidity"` field:

**Option 1: Migration Script (Recommended)**
```javascript
db.sensor_readings.updateMany(
  { turbidity: { $exists: true } },
  { $rename: { "turbidity": "turbidity_index" } }
)
```

**Option 2: Backward Compatibility (temporary)**
Update `sensor.py` to handle both field names during transition:
```python
turbidity_value = reading.get("turbidity_index") or reading.get("turbidity")
```

---

## 🧪 Testing Checklist

After migration, test:

1. ✅ ESP32 can send turbidity_index (0-100) to backend
2. ✅ Backend accepts turbidity_index in range 0-100
3. ✅ ML models still work with mapped "turbidity" feature
4. ✅ Frontend displays "Turbidity Index: X /100" not "X NTU"
5. ✅ Configuration endpoints accept turbidity_index thresholds
6. ✅ Historical data queries work with new field name
7. ✅ Calibration endpoint works with turbidity_index

---

## 📝 Documentation Updates

### API Documentation:
Update OpenAPI/Swagger descriptions to clarify:
- Turbidity index is 0-100 relative scale
- NOT calibrated NTU measurement
- Self-calibrated against clean water baseline

### README Updates:
Add disclaimer about sensor limitations and calibration approach.

---

## 🚀 Deployment Steps

1. **Backend Migration:**
   - Apply schema changes to `schemas.py`
   - Update all endpoint handlers
   - Test with Postman/curl

2. **Database Migration:**
   - Run MongoDB field rename script
   - Verify no documents lost

3. **ESP32 Update:**
   - Upload new Arduino code with `turbidity_index` JSON field
   - Test data transmission

4. **Frontend Update:**
   - Update API client code
   - Change display labels
   - Deploy to app stores

---

## ⏱️ Estimated Time

- Backend changes: **30-45 minutes**
- Database migration: **5 minutes**
- Testing: **20 minutes**
- Frontend changes: **15-30 minutes** (depending on framework)
- **Total: ~1.5-2 hours**

---

## 🎓 Educational Value

This migration demonstrates:
- Scientific honesty in engineering (admitting calibration limitations)
- Proper handling of sensor data without misrepresenting accuracy
- Clean schema migration without ML model retraining

**Result:** A more honest, defensible project that acknowledges real-world constraints rather than faking precision we don't have.

---

Ready to execute? Let me know and I'll start making the changes! 🚀
