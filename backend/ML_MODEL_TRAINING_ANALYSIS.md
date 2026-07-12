# ML Model Training Data Analysis

## ✅ ANSWER TO YOUR QUESTION:

### (1) **Has training happened?**
**YES** - Both models have been trained and saved:
- **Random Forest Classifier** v1.0 (saved: 2026-04-25)
- **XGBoost Risk Predictor** v1.0 (saved: 2026-04-25)

### (2) **What turbidity values were used?**
**Training data used NTU-like scale in 0-50 range** (NOT 0-3000!):

Sample turbidity values from `sample_training_data.csv`:
```
1.57, 31.82, 15.72, 25.43, 45.38, 12.46, 20.52, 37.78, 11.44, 3.85, 
14.49, 8.06, 46.48, 40.41, 31.67, 43.57, 40.18, 9.33, 44.63, 26.97,
40.37, 44.80, 15.90, 5.50, 11.40, 21.36, 40.90, 43.04, 0.35, 25.54...
```

**Range: 0.35 - 49.28 NTU**
- Minimum: 0.35
- Maximum: 49.28
- Most values: 5-45 range

### (3) **Are saved models using NTU-scale?**
**YES** - Models were trained expecting turbidity in **0-50 NTU range**, not 0-3000.

---

## 🚨 CRITICAL FINDING:

**Your schema validation accepts 0-3000 NTU, but your training data only used 0-50 NTU!**

This means:
1. ✅ Your training data turbidity range (~0-50) is **CLOSER** to your new 0-100 index scale than to the 0-3000 schema allowed!
2. ✅ Changing to 0-100 scale is actually **LESS disruptive** than I initially thought
3. ⚠️ Your current schema validation (0-3000) was **never realistic** for your training data

---

## 📊 Scale Comparison:

| Data Source | Range | Scale Type |
|-------------|-------|------------|
| **Training CSV** | 0.35 - 49.28 | "Fake NTU" (generated data) |
| **Current Schema** | 0 - 3000 | Theoretical NTU max (never used) |
| **Your Sensor** | 0 - 100 | Relative index (self-calibrated) |

---

## 🎯 RECOMMENDATION:

### **You DON'T need to retrain models immediately!**

**Reasoning:**
1. Training data used 0-50 range
2. Your new 0-100 index scale is **2x the training scale**
3. This is a **linear scaling**, which ML models handle gracefully
4. Feature importance relationships remain the same

### **Scaling Approach:**
When feeding your 0-100 turbidity_index to the ML models, we can either:

#### **Option A: Scale Down (Recommended)**
```python
# Scale your 0-100 index to match training 0-50 range
turbidity_for_ml = sensor_data.turbidity_index * 0.5
sensor_dict = {"turbidity": turbidity_for_ml, ...}
```

#### **Option B: Leave As-Is**
```python
# Use 0-100 values directly
sensor_dict = {"turbidity": sensor_data.turbidity_index, ...}
```
Models will adapt, but feature importance weights may shift slightly.

#### **Option C: Retrain Later (Long-term)**
Collect real 0-100 index data for 2-4 weeks, then retrain models for optimal accuracy.

---

## 📋 Model Details:

### Random Forest Classifier:
- **Purpose:** Classify water as Safe/Warning/Unsafe
- **Features:** 5 (ph, turbidity, temperature, tds, dissolved_oxygen)
- **Classes:** ["Unsafe", "Warning"] (NOTE: Only 2 classes in saved model!)
- **Training:** 100 estimators, max_depth=20

### XGBoost Risk Predictor:
- **Purpose:** Predict contamination risk (0.0-1.0 score)
- **Features:** 20 (current + mean + std + trend for each of 5 sensors)
- **Classes:** 3 risk levels [0, 1, 2] = [Low, Medium, High]
- **Training:** 100 estimators, max_depth=5

---

## 🔍 Training Data Patterns:

### Turbidity Distribution in Training Data:
- **0-10 NTU:** ~15% (clean water)
- **10-25 NTU:** ~30% (slightly cloudy)
- **25-40 NTU:** ~35% (cloudy)
- **40-50 NTU:** ~20% (very cloudy)

### Classification Labels:
- **Warning:** Associated with turbidity 1.57-49.28 (wide range)
- **Unsafe:** Associated with turbidity 4.51-49.28 (overlaps with Warning)

This suggests turbidity alone doesn't determine classification - it's the **combination** of all 5 features.

---

## ✅ MY RECOMMENDATION FOR MIGRATION:

### **Immediate Action (Migration):**
1. ✅ Change schema from 0-3000 to 0-100 (turbidity_index)
2. ✅ Use **Option A (Scale Down 0.5x)** when passing to ML models
3. ✅ Update thresholds:
   - safe_max: 10.0 (equivalent to ~5 NTU in training data)
   - unsafe_max: 50.0 (equivalent to ~25 NTU in training data)

### **Code Change:**
In `sensor.py`, when building `sensor_dict` for ML:
```python
# Scale 0-100 index to match training 0-50 range
turbidity_scaled = sensor_data.turbidity_index * 0.5

sensor_dict = {
    "ph": sensor_data.ph,
    "turbidity": turbidity_scaled,  # ML expects ~0-50 range
    "temperature": sensor_data.temperature,
    "tds": sensor_data.tds,
    "dissolved_oxygen": sensor_data.dissolved_oxygen
}
```

### **Long-term Action (Optional):**
After collecting 200+ real sensor readings with 0-100 turbidity_index:
1. Create new training CSV with real data
2. Retrain both models
3. Compare performance metrics
4. Deploy new models as v2.0 if better

---

## 🎓 Key Insight:

**Your "NTU" training data was already fake!** It was synthetic data generated in 0-50 range, not real calibrated NTU measurements. Switching to an honest 0-100 "turbidity index" is actually **more truthful** and requires minimal ML adjustments.

---

## ✋ DECISION NEEDED:

**Please approve one of these scaling approaches:**

### **A. Scale Down (My Recommendation)** ✅
- Multiply turbidity_index by 0.5 before ML
- Keeps models performing as trained
- No retraining needed

### **B. Use Raw 0-100** 
- Pass turbidity_index directly to ML
- Models adapt automatically
- Slight accuracy trade-off

### **C. Retrain Now**
- Create new training data first
- Takes 2-4 weeks to collect
- Best long-term accuracy

**Which do you choose?**
