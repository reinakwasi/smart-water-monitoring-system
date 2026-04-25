# Design Document: Water Quality Monitoring System

## Overview

The Water Quality Monitoring System is an intelligent IoT solution that combines hardware sensors, machine learning models, and a mobile application to provide real-time water quality monitoring, contamination risk prediction, and tank level management. The system architecture follows a three-tier design:

1. **Sensor Layer**: ESP32-based microcontroller with water quality sensors (pH, turbidity, temperature, TDS, dissolved oxygen) and ultrasonic tank level sensor
2. **Backend Layer**: Python FastAPI service with ML models (Random Forest classifier, XGBoost risk predictor), SHAP explainability engine, and MongoDB persistence
3. **Presentation Layer**: React Native mobile application with real-time monitoring, historical visualization, and Firebase Cloud Messaging notifications

### Design Goals

- **Real-time Responsiveness**: End-to-end latency < 5 seconds from sensor reading to mobile display
- **ML Performance**: Model inference < 500ms for both classification and risk prediction
- **Explainability**: SHAP values computed within 1 second to provide transparent AI decisions
- **Scalability**: Support 10+ concurrent sensor modules and 50+ concurrent mobile users
- **Reliability**: 95% uptime with graceful degradation and error recovery
- **Maintainability**: Modular architecture allowing independent component updates

## Architecture

### High-Level System Architecture

```mermaid
graph TB
    subgraph "Sensor Layer"
        ESP32[ESP32 Microcontroller]
        PH[pH Sensor]
        TURB[Turbidity Sensor]
        TEMP[Temperature Sensor]
        TDS[TDS Sensor]
        DO[Dissolved Oxygen Sensor]
        US[Ultrasonic Sensor]
        
        PH --> ESP32
        TURB --> ESP32
        TEMP --> ESP32
        TDS --> ESP32
        DO --> ESP32
        US --> ESP32
    end
    
    subgraph "Backend Layer"
        API[FastAPI Service]
        RF[Random Forest Classifier]
        XGB[XGBoost Risk Predictor]
        SHAP[SHAP Explainability Engine]
        DB[(MongoDB)]
        FCM[Firebase Cloud Messaging]
        
        API --> RF
        API --> XGB
        API --> SHAP
        API --> DB
        API --> FCM
    end
    
    subgraph "Presentation Layer"
        APP[React Native Mobile App]
        NOTIF[Push Notifications]
        
        FCM --> NOTIF
        NOTIF --> APP
    end
    
    ESP32 -->|HTTP POST /api/v1/sensor-data| API
    ESP32 -->|HTTP POST /api/v1/tank-level| API
    APP -->|HTTP GET /api/v1/current-status| API
    APP -->|HTTP GET /api/v1/historical-data| API
    APP -->|HTTP POST /api/v1/auth/login| API
    
    style ESP32 fill:#e1f5ff
    style API fill:#fff4e6
    style APP fill:#f3e5f5
    style DB fill:#e8f5e9
```

### Data Flow Architecture

```mermaid
sequenceDiagram
    participant ESP32
    participant FastAPI
    participant MongoDB
    participant ML Models
    participant SHAP
    participant FCM
    participant Mobile App
    
    ESP32->>FastAPI: POST /sensor-data (every 30s)
    FastAPI->>MongoDB: Store raw sensor reading
    FastAPI->>ML Models: Classify water quality
    ML Models-->>FastAPI: Classification result
    FastAPI->>ML Models: Predict contamination risk
    ML Models-->>FastAPI: Risk score
    FastAPI->>SHAP: Compute explanations
    SHAP-->>FastAPI: SHAP values
    FastAPI->>MongoDB: Store predictions + SHAP
    
    alt Quality change detected
        FastAPI->>FCM: Send notification
        FCM->>Mobile App: Push notification
    end
    
    Mobile App->>FastAPI: GET /current-status
    FastAPI->>MongoDB: Query latest data
    MongoDB-->>FastAPI: Latest readings + predictions
    FastAPI-->>Mobile App: Status + SHAP explanations
```

### Component Interaction Model

The system follows an event-driven architecture with the following interaction patterns:

1. **Sensor → Backend**: Periodic push (every 30 seconds) via HTTP POST
2. **Backend → Database**: Asynchronous write operations using Motor (async MongoDB driver)
3. **Backend → ML Models**: Synchronous inference calls with in-memory model loading
4. **Backend → Mobile**: Pull-based (HTTP GET) for status queries, push-based (FCM) for notifications
5. **Mobile → Backend**: RESTful API calls with JWT authentication

## Components and Interfaces

### 1. Sensor Module (ESP32)

#### Responsibilities
- Acquire sensor readings from all connected sensors
- Validate sensor data ranges
- Buffer readings during network outages
- Transmit data to backend via HTTP
- Apply calibration offsets
- Handle sensor failures gracefully

#### Hardware Components
- **ESP32 DevKit V1**: Main microcontroller with WiFi capability
- **pH Sensor Module**: Analog output, range 0-14 pH
- **Turbidity Sensor**: Analog output, range 0-3000 NTU
- **DS18B20 Temperature Sensor**: Digital 1-Wire, range -55°C to +125°C
- **TDS Sensor**: Analog output, range 0-1000 ppm
- **Dissolved Oxygen Sensor**: Analog output, range 0-20 mg/L
- **HC-SR04 Ultrasonic Sensor**: Digital trigger/echo, range 2-400 cm

#### Software Architecture

```cpp
// Pseudo-code structure
class SensorModule {
    WiFiClient wifiClient;
    HTTPClient httpClient;
    CircularBuffer<Reading> readingBuffer; // 100 readings max
    CalibrationData calibration;
    
    void setup() {
        initializeWiFi();
        initializeSensors();
        loadCalibration();
    }
    
    void loop() {
        if (shouldReadSensors()) {
            Reading reading = acquireSensorData();
            if (isConnected()) {
                transmitReading(reading);
                flushBuffer();
            } else {
                bufferReading(reading);
            }
        }
    }
    
    Reading acquireSensorData() {
        Reading r;
        r.ph = readPH() + calibration.phOffset;
        r.turbidity = readTurbidity() + calibration.turbidityOffset;
        r.temperature = readTemperature() + calibration.tempOffset;
        r.tds = readTDS() + calibration.tdsOffset;
        r.dissolvedOxygen = readDO() + calibration.doOffset;
        r.tankLevel = readUltrasonic();
        r.timestamp = getCurrentTime();
        return validateReading(r);
    }
}
```

#### API Client Interface

**Endpoint**: `POST /api/v1/sensor-data`

**Request Payload**:
```json
{
  "device_id": "ESP32_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "ph": 7.2,
  "turbidity": 15.5,
  "temperature": 25.3,
  "tds": 150,
  "dissolved_oxygen": 8.5
}
```

**Endpoint**: `POST /api/v1/tank-level`

**Request Payload**:
```json
{
  "device_id": "ESP32_001",
  "timestamp": "2025-01-15T10:30:00Z",
  "distance_cm": 45.2,
  "tank_height_cm": 200
}
```

#### Error Handling
- **Sensor Failure**: Log error, skip failed sensor, continue with remaining sensors
- **Network Failure**: Buffer up to 100 readings in SPIFFS/EEPROM
- **Invalid Reading**: Discard reading if outside physical sensor range
- **HTTP Error**: Retry with exponential backoff (1s, 2s, 4s)

### 2. Backend Service (FastAPI)

#### Responsibilities
- Receive and validate sensor data
- Perform ML inference (classification + risk prediction)
- Compute SHAP explanations
- Persist data to MongoDB
- Serve mobile app API requests
- Manage user authentication
- Send push notifications via FCM
- Provide health monitoring endpoints

#### Technology Stack
- **Framework**: FastAPI 0.100+
- **Async Runtime**: uvicorn with asyncio
- **Database Driver**: motor (async MongoDB driver)
- **ML Libraries**: scikit-learn, xgboost, shap, numpy, pandas
- **Validation**: Pydantic v2
- **Authentication**: python-jose (JWT), passlib (bcrypt)
- **HTTP Client**: httpx (for FCM)

#### Project Structure
```
backend/
├── app/
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Configuration management
│   ├── dependencies.py         # Dependency injection
│   ├── api/
│   │   ├── v1/
│   │   │   ├── endpoints/
│   │   │   │   ├── sensor.py   # Sensor data endpoints
│   │   │   │   ├── status.py   # Current status endpoints
│   │   │   │   ├── historical.py # Historical data endpoints
│   │   │   │   ├── auth.py     # Authentication endpoints
│   │   │   │   ├── config.py   # Configuration endpoints
│   │   │   │   └── health.py   # Health check endpoints
│   │   │   └── router.py       # API router aggregation
│   ├── models/
│   │   ├── schemas.py          # Pydantic models
│   │   ├── database.py         # MongoDB models
│   │   └── ml_models.py        # ML model wrappers
│   ├── services/
│   │   ├── ml_service.py       # ML inference service
│   │   ├── shap_service.py     # SHAP explanation service
│   │   ├── notification_service.py # FCM notification service
│   │   └── auth_service.py     # Authentication service
│   ├── db/
│   │   ├── mongodb.py          # MongoDB connection
│   │   └── repositories.py     # Data access layer
│   └── utils/
│       ├── logger.py           # Logging configuration
│       └── cache.py            # Caching utilities
├── ml/
│   ├── train_classifier.py     # Random Forest training
│   ├── train_predictor.py      # XGBoost training
│   ├── evaluate.py             # Model evaluation
│   └── models/                 # Saved model artifacts
│       ├── rf_classifier_v1.pkl
│       └── xgb_predictor_v1.pkl
├── tests/
│   ├── test_api.py
│   ├── test_ml_service.py
│   └── test_repositories.py
├── requirements.txt
└── Dockerfile
```

#### Core Services Design

##### ML Service

```python
# ml_service.py
from typing import Dict, Tuple
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
import xgboost as xgb

class MLService:
    def __init__(self):
        self.classifier: RandomForestClassifier = None
        self.predictor: xgb.XGBClassifier = None
        self.feature_names = ['ph', 'turbidity', 'temperature', 'tds', 'dissolved_oxygen']
        self.load_models()
    
    def load_models(self):
        """Load trained models from disk"""
        self.classifier = joblib.load('ml/models/rf_classifier_v1.pkl')
        self.predictor = joblib.load('ml/models/xgb_predictor_v1.pkl')
    
    def classify_water_quality(self, features: Dict[str, float]) -> Tuple[str, float]:
        """
        Classify water quality as Safe, Warning, or Unsafe
        Returns: (classification, confidence)
        """
        X = self._prepare_features(features)
        prediction = self.classifier.predict(X)[0]
        probabilities = self.classifier.predict_proba(X)[0]
        confidence = float(np.max(probabilities))
        
        class_map = {0: 'Safe', 1: 'Warning', 2: 'Unsafe'}
        return class_map[prediction], confidence
    
    def predict_contamination_risk(self, features: Dict[str, float], 
                                   historical_features: np.ndarray) -> float:
        """
        Predict contamination risk score (0.0 - 1.0)
        Uses current features + temporal trends from historical data
        """
        X = self._prepare_features_with_history(features, historical_features)
        risk_score = self.predictor.predict_proba(X)[0][1]  # Probability of contamination
        return float(risk_score)
    
    def _prepare_features(self, features: Dict[str, float]) -> np.ndarray:
        """Convert feature dict to numpy array in correct order"""
        return np.array([[features[name] for name in self.feature_names]])
    
    def _prepare_features_with_history(self, current: Dict[str, float],
                                       historical: np.ndarray) -> np.ndarray:
        """Combine current features with temporal trends"""
        current_features = self._prepare_features(current)
        
        # Compute temporal features: mean, std, trend over last 10 readings
        if len(historical) > 0:
            mean_features = np.mean(historical, axis=0)
            std_features = np.std(historical, axis=0)
            # Simple linear trend: (last - first) / time_span
            trend_features = (historical[-1] - historical[0]) / len(historical)
            temporal = np.concatenate([mean_features, std_features, trend_features])
        else:
            temporal = np.zeros(15)  # 5 features * 3 statistics
        
        return np.concatenate([current_features[0], temporal]).reshape(1, -1)
```

##### SHAP Service

```python
# shap_service.py
import shap
import numpy as np
from typing import Dict, List

class SHAPService:
    def __init__(self, ml_service: MLService):
        self.ml_service = ml_service
        self.classifier_explainer = None
        self.predictor_explainer = None
        self.initialize_explainers()
    
    def initialize_explainers(self):
        """Initialize SHAP explainers for both models"""
        # TreeExplainer is fast for tree-based models
        self.classifier_explainer = shap.TreeExplainer(
            self.ml_service.classifier
        )
        self.predictor_explainer = shap.TreeExplainer(
            self.ml_service.predictor
        )
    
    def explain_classification(self, features: Dict[str, float]) -> Dict[str, float]:
        """
        Compute SHAP values for classification
        Returns: Dict mapping feature names to SHAP values
        """
        X = self.ml_service._prepare_features(features)
        shap_values = self.classifier_explainer.shap_values(X)
        
        # For multi-class, shap_values is a list of arrays (one per class)
        # We take the predicted class's SHAP values
        predicted_class = self.ml_service.classifier.predict(X)[0]
        class_shap_values = shap_values[predicted_class][0]
        
        return {
            name: float(value) 
            for name, value in zip(self.ml_service.feature_names, class_shap_values)
        }
    
    def explain_risk_prediction(self, features: Dict[str, float],
                                historical_features: np.ndarray) -> Dict[str, float]:
        """
        Compute SHAP values for risk prediction
        Returns: Dict mapping feature names to SHAP values
        """
        X = self.ml_service._prepare_features_with_history(features, historical_features)
        shap_values = self.predictor_explainer.shap_values(X)[0]
        
        # Map SHAP values to feature names (current + temporal)
        feature_names = (
            self.ml_service.feature_names +
            [f"{name}_mean" for name in self.ml_service.feature_names] +
            [f"{name}_std" for name in self.ml_service.feature_names] +
            [f"{name}_trend" for name in self.ml_service.feature_names]
        )
        
        return {
            name: float(value)
            for name, value in zip(feature_names, shap_values)
        }
    
    def get_top_features(self, shap_values: Dict[str, float], top_n: int = 3) -> List[Dict]:
        """
        Get top N most influential features by absolute SHAP value
        Returns: List of {feature, shap_value, direction}
        """
        sorted_features = sorted(
            shap_values.items(),
            key=lambda x: abs(x[1]),
            reverse=True
        )[:top_n]
        
        return [
            {
                "feature": name,
                "shap_value": value,
                "direction": "increasing_risk" if value > 0 else "decreasing_risk"
            }
            for name, value in sorted_features
        ]
```

##### Notification Service

```python
# notification_service.py
import httpx
from typing import Dict, Optional
from datetime import datetime, timedelta

class NotificationService:
    def __init__(self, fcm_server_key: str):
        self.fcm_server_key = fcm_server_key
        self.fcm_url = "https://fcm.googleapis.com/fcm/send"
        self.notification_cache = {}  # Track last notification time per user/type
        self.throttle_duration = timedelta(hours=1)
    
    async def send_quality_change_notification(
        self,
        user_tokens: List[str],
        old_quality: str,
        new_quality: str,
        top_factor: str
    ):
        """Send notification when water quality classification changes"""
        notification_key = f"quality_{new_quality}"
        
        if self._should_throttle(notification_key):
            return
        
        priority = "high" if new_quality == "Unsafe" else "normal"
        title, body = self._format_quality_message(old_quality, new_quality, top_factor)
        
        await self._send_fcm_notification(user_tokens, title, body, priority)
        self._update_throttle_cache(notification_key)
    
    async def send_risk_change_notification(
        self,
        user_tokens: List[str],
        risk_level: str,
        risk_score: float
    ):
        """Send notification when contamination risk increases"""
        notification_key = f"risk_{risk_level}"
        
        if self._should_throttle(notification_key):
            return
        
        title = f"Contamination Risk: {risk_level}"
        body = f"Risk score: {risk_score:.2f}. Monitor water quality closely."
        
        await self._send_fcm_notification(user_tokens, title, body, "normal")
        self._update_throttle_cache(notification_key)
    
    async def send_tank_notification(
        self,
        user_tokens: List[str],
        tank_status: str,
        level_percent: float
    ):
        """Send notification for tank level changes"""
        notification_key = f"tank_{tank_status}"
        
        if self._should_throttle(notification_key):
            return
        
        priority = "high" if tank_status == "Overflow" else "normal"
        title, body = self._format_tank_message(tank_status, level_percent)
        
        await self._send_fcm_notification(user_tokens, title, body, priority)
        self._update_throttle_cache(notification_key)
    
    async def _send_fcm_notification(
        self,
        tokens: List[str],
        title: str,
        body: str,
        priority: str
    ):
        """Send notification via Firebase Cloud Messaging"""
        headers = {
            "Authorization": f"Bearer {self.fcm_server_key}",
            "Content-Type": "application/json"
        }
        
        payload = {
            "registration_ids": tokens,
            "priority": priority,
            "notification": {
                "title": title,
                "body": body,
                "sound": "default"
            },
            "data": {
                "timestamp": datetime.utcnow().isoformat()
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.fcm_url,
                    json=payload,
                    headers=headers,
                    timeout=10.0
                )
                response.raise_for_status()
            except httpx.HTTPError as e:
                # Log error and retry logic would go here
                print(f"FCM notification failed: {e}")
    
    def _should_throttle(self, notification_key: str) -> bool:
        """Check if notification should be throttled"""
        if notification_key not in self.notification_cache:
            return False
        
        last_sent = self.notification_cache[notification_key]
        return datetime.utcnow() - last_sent < self.throttle_duration
    
    def _update_throttle_cache(self, notification_key: str):
        """Update last notification timestamp"""
        self.notification_cache[notification_key] = datetime.utcnow()
    
    def _format_quality_message(self, old: str, new: str, factor: str) -> tuple:
        """Format water quality change message"""
        messages = {
            "Unsafe": (
                "⚠️ Water Quality: Unsafe",
                f"Water quality changed from {old} to {new}. Main factor: {factor}. Do not use water."
            ),
            "Warning": (
                "⚡ Water Quality: Warning",
                f"Water quality changed from {old} to {new}. Main factor: {factor}. Use caution."
            ),
            "Safe": (
                "✅ Water Quality: Safe",
                f"Water quality improved from {old} to {new}. Water is safe to use."
            )
        }
        return messages.get(new, ("Water Quality Update", f"Status: {new}"))
    
    def _format_tank_message(self, status: str, level: float) -> tuple:
        """Format tank level message"""
        messages = {
            "Overflow": (
                "🚨 Tank Overflow Alert",
                f"Tank level at {level:.1f}%. Immediate action required!"
            ),
            "Full": (
                "💧 Tank Full",
                f"Tank level at {level:.1f}%. Consider stopping water supply."
            ),
            "Empty": (
                "⚠️ Tank Empty",
                f"Tank level at {level:.1f}%. Refill needed."
            )
        }
        return messages.get(status, ("Tank Status", f"Level: {level:.1f}%"))
```


#### API Endpoints Specification

##### Sensor Data Endpoints

**POST /api/v1/sensor-data**

Receive water quality sensor readings from ESP32.

Request:
```json
{
  "device_id": "string",
  "timestamp": "ISO8601 datetime",
  "ph": "float (0-14)",
  "turbidity": "float (0-3000)",
  "temperature": "float (-55 to 125)",
  "tds": "float (0-1000)",
  "dissolved_oxygen": "float (0-20)"
}
```

Response (200 OK):
```json
{
  "status": "success",
  "reading_id": "string (MongoDB ObjectId)",
  "classification": {
    "quality": "Safe | Warning | Unsafe",
    "confidence": "float (0-1)",
    "shap_values": {
      "ph": "float",
      "turbidity": "float",
      "temperature": "float",
      "tds": "float",
      "dissolved_oxygen": "float"
    },
    "top_factors": [
      {
        "feature": "string",
        "shap_value": "float",
        "direction": "increasing_risk | decreasing_risk"
      }
    ]
  },
  "risk_prediction": {
    "risk_score": "float (0-1)",
    "risk_level": "Low | Medium | High",
    "shap_values": {
      "ph": "float",
      "ph_mean": "float",
      "ph_std": "float",
      "ph_trend": "float",
      ...
    },
    "top_factors": [...]
  },
  "timestamp": "ISO8601 datetime"
}
```

**POST /api/v1/tank-level**

Receive tank level readings from ESP32.

Request:
```json
{
  "device_id": "string",
  "timestamp": "ISO8601 datetime",
  "distance_cm": "float",
  "tank_height_cm": "float"
}
```

Response (200 OK):
```json
{
  "status": "success",
  "reading_id": "string",
  "tank_status": "Empty | Half_Full | Full | Overflow",
  "level_percent": "float (0-100)",
  "volume_liters": "float",
  "timestamp": "ISO8601 datetime"
}
```

##### Status Endpoints

**GET /api/v1/current-status**

Get current water quality and tank status.

Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

Query Parameters:
- `device_id` (optional): Filter by specific device

Response (200 OK):
```json
{
  "water_quality": {
    "classification": "Safe | Warning | Unsafe",
    "confidence": "float",
    "parameters": {
      "ph": "float",
      "turbidity": "float",
      "temperature": "float",
      "tds": "float",
      "dissolved_oxygen": "float"
    },
    "shap_explanation": {
      "values": {...},
      "top_factors": [...]
    },
    "timestamp": "ISO8601 datetime"
  },
  "contamination_risk": {
    "risk_score": "float",
    "risk_level": "Low | Medium | High",
    "shap_explanation": {
      "values": {...},
      "top_factors": [...]
    },
    "timestamp": "ISO8601 datetime"
  },
  "tank_status": {
    "status": "Empty | Half_Full | Full | Overflow",
    "level_percent": "float",
    "volume_liters": "float",
    "timestamp": "ISO8601 datetime"
  }
}
```

##### Historical Data Endpoints

**GET /api/v1/historical-data**

Retrieve historical sensor readings and predictions.

Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

Query Parameters:
- `start_date`: ISO8601 datetime (required)
- `end_date`: ISO8601 datetime (required)
- `parameter`: ph | turbidity | temperature | tds | dissolved_oxygen | tank_level | all (default: all)
- `device_id`: string (optional)
- `limit`: integer (default: 1000, max: 10000)

Response (200 OK):
```json
{
  "data": [
    {
      "timestamp": "ISO8601 datetime",
      "parameters": {
        "ph": "float",
        "turbidity": "float",
        ...
      },
      "classification": "Safe | Warning | Unsafe",
      "risk_score": "float",
      "tank_level_percent": "float"
    }
  ],
  "count": "integer",
  "start_date": "ISO8601 datetime",
  "end_date": "ISO8601 datetime"
}
```

##### Authentication Endpoints

**POST /api/v1/auth/register**

Register a new user account.

Request:
```json
{
  "email": "string (email format)",
  "password": "string (min 8 chars)",
  "full_name": "string",
  "role": "user | admin (default: user)"
}
```

Response (201 Created):
```json
{
  "user_id": "string",
  "email": "string",
  "full_name": "string",
  "role": "string",
  "created_at": "ISO8601 datetime"
}
```

**POST /api/v1/auth/login**

Authenticate user and receive JWT token.

Request:
```json
{
  "email": "string",
  "password": "string"
}
```

Response (200 OK):
```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "expires_in": "integer (seconds)",
  "user": {
    "user_id": "string",
    "email": "string",
    "full_name": "string",
    "role": "string"
  }
}
```

**POST /api/v1/auth/refresh**

Refresh JWT token.

Headers:
```
Authorization: Bearer <JWT_TOKEN>
```

Response (200 OK):
```json
{
  "access_token": "string (JWT)",
  "token_type": "bearer",
  "expires_in": "integer"
}
```

##### Configuration Endpoints (Admin Only)

**GET /api/v1/config**

Get current system configuration.

Headers:
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Response (200 OK):
```json
{
  "sensor_polling_interval_seconds": "integer",
  "quality_thresholds": {
    "ph": {"safe_min": 6.5, "safe_max": 8.5, "unsafe_min": 5.0, "unsafe_max": 10.0},
    "turbidity": {"safe_max": 5, "unsafe_max": 25},
    "temperature": {"safe_min": 15, "safe_max": 30, "unsafe_min": 5, "unsafe_max": 40},
    "tds": {"safe_max": 300, "unsafe_max": 600},
    "dissolved_oxygen": {"safe_min": 6.0, "unsafe_min": 4.0}
  },
  "risk_thresholds": {
    "low_max": 0.4,
    "medium_max": 0.7
  },
  "tank_dimensions": {
    "height_cm": "float",
    "diameter_cm": "float",
    "capacity_liters": "float"
  }
}
```

**PUT /api/v1/config**

Update system configuration.

Headers:
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Request: Same structure as GET response

Response (200 OK):
```json
{
  "status": "success",
  "message": "Configuration updated successfully",
  "updated_at": "ISO8601 datetime"
}
```

**POST /api/v1/calibration**

Initiate sensor calibration.

Headers:
```
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

Request:
```json
{
  "device_id": "string",
  "sensor_type": "ph | turbidity | temperature | tds | dissolved_oxygen",
  "reference_value": "float",
  "current_reading": "float"
}
```

Response (200 OK):
```json
{
  "status": "success",
  "calibration_offset": "float",
  "applied_at": "ISO8601 datetime"
}
```

##### Health Check Endpoints

**GET /api/v1/health**

System health check.

Response (200 OK):
```json
{
  "status": "healthy | degraded | unhealthy",
  "timestamp": "ISO8601 datetime",
  "components": {
    "database": {
      "status": "connected | disconnected",
      "latency_ms": "float"
    },
    "ml_models": {
      "status": "loaded | not_loaded",
      "classifier_version": "string",
      "predictor_version": "string"
    },
    "notification_service": {
      "status": "operational | degraded"
    }
  },
  "sensors": [
    {
      "device_id": "string",
      "status": "online | offline",
      "last_communication": "ISO8601 datetime"
    }
  ]
}
```

### 3. Mobile Application (React Native)

#### Responsibilities
- Display real-time water quality and tank status
- Visualize SHAP explanations for AI transparency
- Show historical trends with interactive charts
- Receive and display push notifications
- Manage user authentication
- Provide configuration interface for administrators

#### Technology Stack
- **Framework**: React Native 0.72+
- **Navigation**: React Navigation 6
- **State Management**: React Context API + AsyncStorage
- **Charts**: Victory Native (react-native-victory)
- **Notifications**: @react-native-firebase/messaging
- **HTTP Client**: axios
- **UI Components**: React Native Paper (Material Design)
- **Authentication Storage**: @react-native-async-storage/async-storage (secure)

#### Application Structure
```
mobile/
├── src/
│   ├── App.tsx                 # Root component
│   ├── navigation/
│   │   ├── AppNavigator.tsx    # Main navigation
│   │   ├── AuthNavigator.tsx   # Auth flow navigation
│   │   └── TabNavigator.tsx    # Bottom tab navigation
│   ├── screens/
│   │   ├── auth/
│   │   │   ├── LoginScreen.tsx
│   │   │   └── RegisterScreen.tsx
│   │   ├── dashboard/
│   │   │   ├── DashboardScreen.tsx
│   │   │   └── components/
│   │   │       ├── WaterQualityCard.tsx
│   │   │       ├── RiskIndicator.tsx
│   │   │       └── TankLevelGauge.tsx
│   │   ├── explanations/
│   │   │   ├── ExplanationScreen.tsx
│   │   │   └── components/
│   │   │       ├── SHAPChart.tsx
│   │   │       └── FeatureDetail.tsx
│   │   ├── history/
│   │   │   ├── HistoryScreen.tsx
│   │   │   └── components/
│   │   │       ├── TimeRangeSelector.tsx
│   │   │       └── TrendChart.tsx
│   │   └── settings/
│   │       ├── SettingsScreen.tsx
│   │       └── ConfigurationScreen.tsx (admin)
│   ├── services/
│   │   ├── api.ts              # API client
│   │   ├── auth.ts             # Authentication service
│   │   └── notifications.ts    # FCM service
│   ├── context/
│   │   ├── AuthContext.tsx     # Auth state management
│   │   └── DataContext.tsx     # App data state
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useWaterQuality.ts
│   │   └── useNotifications.ts
│   ├── types/
│   │   └── index.ts            # TypeScript types
│   └── utils/
│       ├── constants.ts
│       └── formatters.ts
├── android/
├── ios/
├── package.json
└── tsconfig.json
```

#### Key Screen Designs

##### Dashboard Screen

```typescript
// DashboardScreen.tsx
import React, { useEffect, useState } from 'react';
import { View, ScrollView, RefreshControl } from 'react-native';
import { useWaterQuality } from '../hooks/useWaterQuality';
import WaterQualityCard from './components/WaterQualityCard';
import RiskIndicator from './components/RiskIndicator';
import TankLevelGauge from './components/TankLevelGauge';

const DashboardScreen = () => {
  const { currentStatus, loading, error, refresh } = useWaterQuality();
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      refresh();
    }, 30000);
    
    return () => clearInterval(interval);
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  return (
    <ScrollView
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <WaterQualityCard
        classification={currentStatus?.water_quality.classification}
        confidence={currentStatus?.water_quality.confidence}
        parameters={currentStatus?.water_quality.parameters}
        timestamp={currentStatus?.water_quality.timestamp}
      />
      
      <RiskIndicator
        riskScore={currentStatus?.contamination_risk.risk_score}
        riskLevel={currentStatus?.contamination_risk.risk_level}
        topFactors={currentStatus?.contamination_risk.shap_explanation.top_factors}
      />
      
      <TankLevelGauge
        status={currentStatus?.tank_status.status}
        levelPercent={currentStatus?.tank_status.level_percent}
        volumeLiters={currentStatus?.tank_status.volume_liters}
      />
    </ScrollView>
  );
};
```

##### SHAP Explanation Screen

```typescript
// ExplanationScreen.tsx
import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { VictoryBar, VictoryChart, VictoryAxis } from 'victory-native';

interface SHAPChartProps {
  shapValues: Record<string, number>;
  title: string;
}

const SHAPChart: React.FC<SHAPChartProps> = ({ shapValues, title }) => {
  // Sort by absolute value
  const sortedData = Object.entries(shapValues)
    .map(([feature, value]) => ({
      feature: feature.replace('_', ' '),
      value: value,
      color: value > 0 ? '#ef5350' : '#66bb6a'
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 5); // Top 5 features

  return (
    <View>
      <Text style={styles.chartTitle}>{title}</Text>
      <VictoryChart
        height={300}
        domainPadding={{ x: 20 }}
      >
        <VictoryAxis
          dependentAxis
          label="SHAP Value (Impact on Prediction)"
        />
        <VictoryAxis
          tickFormat={(t) => t}
        />
        <VictoryBar
          data={sortedData}
          x="feature"
          y="value"
          style={{
            data: {
              fill: ({ datum }) => datum.color
            }
          }}
        />
      </VictoryChart>
      
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#ef5350' }]} />
          <Text>Increasing Risk/Unsafe</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#66bb6a' }]} />
          <Text>Decreasing Risk/Safe</Text>
        </View>
      </View>
    </View>
  );
};
```

##### Historical Trends Screen

```typescript
// HistoryScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, Text } from 'react-native';
import { VictoryLine, VictoryChart, VictoryAxis, VictoryScatter } from 'victory-native';
import { useHistoricalData } from '../hooks/useHistoricalData';
import TimeRangeSelector from './components/TimeRangeSelector';

const HistoryScreen = () => {
  const [timeRange, setTimeRange] = useState('24h');
  const { data, loading } = useHistoricalData(timeRange);

  const renderParameterChart = (parameter: string, label: string, color: string) => {
    const chartData = data.map(d => ({
      x: new Date(d.timestamp),
      y: d.parameters[parameter]
    }));

    return (
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>{label}</Text>
        <VictoryChart
          height={200}
          scale={{ x: 'time' }}
        >
          <VictoryAxis
            dependentAxis
            label={label}
          />
          <VictoryAxis
            tickFormat={(t) => new Date(t).toLocaleTimeString()}
          />
          <VictoryLine
            data={chartData}
            style={{
              data: { stroke: color, strokeWidth: 2 }
            }}
          />
          <VictoryScatter
            data={chartData}
            size={3}
            style={{
              data: { fill: color }
            }}
          />
        </VictoryChart>
      </View>
    );
  };

  return (
    <ScrollView>
      <TimeRangeSelector
        selected={timeRange}
        onSelect={setTimeRange}
        options={['24h', '7d', '30d']}
      />
      
      {renderParameterChart('ph', 'pH Level', '#2196f3')}
      {renderParameterChart('turbidity', 'Turbidity (NTU)', '#ff9800')}
      {renderParameterChart('temperature', 'Temperature (°C)', '#f44336')}
      {renderParameterChart('tds', 'TDS (ppm)', '#4caf50')}
      {renderParameterChart('dissolved_oxygen', 'Dissolved Oxygen (mg/L)', '#9c27b0')}
    </ScrollView>
  );
};
```

#### Notification Handling

```typescript
// services/notifications.ts
import messaging from '@react-native-firebase/messaging';
import { Platform } from 'react-native';

export class NotificationService {
  async requestPermission(): Promise<boolean> {
    const authStatus = await messaging().requestPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  }

  async getToken(): Promise<string | null> {
    try {
      const token = await messaging().getToken();
      return token;
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  setupNotificationListeners() {
    // Foreground notifications
    messaging().onMessage(async remoteMessage => {
      console.log('Foreground notification:', remoteMessage);
      // Display in-app notification
      this.showInAppNotification(remoteMessage);
    });

    // Background/quit state notifications
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Background notification:', remoteMessage);
    });

    // Notification opened app
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log('Notification opened app:', remoteMessage);
      // Navigate to relevant screen
      this.handleNotificationNavigation(remoteMessage);
    });

    // Check if app was opened from quit state by notification
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log('App opened from quit state:', remoteMessage);
          this.handleNotificationNavigation(remoteMessage);
        }
      });
  }

  private showInAppNotification(message: any) {
    // Use react-native-toast-message or similar
    // to show notification while app is in foreground
  }

  private handleNotificationNavigation(message: any) {
    // Navigate to appropriate screen based on notification type
    const { data } = message;
    if (data?.type === 'water_quality') {
      // Navigate to dashboard
    } else if (data?.type === 'tank_level') {
      // Navigate to tank status
    }
  }
}
```

## Data Models

### MongoDB Collections

#### 1. sensor_readings Collection

```javascript
{
  _id: ObjectId,
  device_id: String,
  timestamp: ISODate,
  parameters: {
    ph: Number,
    turbidity: Number,
    temperature: Number,
    tds: Number,
    dissolved_oxygen: Number
  },
  // Denormalized for query performance
  classification: {
    quality: String,  // "Safe", "Warning", "Unsafe"
    confidence: Number,
    shap_values: {
      ph: Number,
      turbidity: Number,
      temperature: Number,
      tds: Number,
      dissolved_oxygen: Number
    },
    top_factors: [
      {
        feature: String,
        shap_value: Number,
        direction: String
      }
    ]
  },
  risk_prediction: {
    risk_score: Number,
    risk_level: String,  // "Low", "Medium", "High"
    shap_values: Object,
    top_factors: Array
  },
  created_at: ISODate
}

// Indexes
db.sensor_readings.createIndex({ device_id: 1, timestamp: -1 });
db.sensor_readings.createIndex({ timestamp: -1 });
db.sensor_readings.createIndex({ "classification.quality": 1, timestamp: -1 });
db.sensor_readings.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
```

#### 2. tank_readings Collection

```javascript
{
  _id: ObjectId,
  device_id: String,
  timestamp: ISODate,
  distance_cm: Number,
  tank_height_cm: Number,
  level_percent: Number,
  volume_liters: Number,
  status: String,  // "Empty", "Half_Full", "Full", "Overflow"
  created_at: ISODate
}

// Indexes
db.tank_readings.createIndex({ device_id: 1, timestamp: -1 });
db.tank_readings.createIndex({ timestamp: -1 });
db.tank_readings.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000 }); // 90 days TTL
```

#### 3. users Collection

```javascript
{
  _id: ObjectId,
  email: String,  // unique
  password_hash: String,  // bcrypt hash
  full_name: String,
  role: String,  // "user" or "admin"
  fcm_tokens: [String],  // Array of FCM device tokens
  notification_preferences: {
    water_quality_changes: Boolean,
    risk_alerts: Boolean,
    tank_alerts: Boolean
  },
  created_at: ISODate,
  updated_at: ISODate,
  last_login: ISODate
}

// Indexes
db.users.createIndex({ email: 1 }, { unique: true });
db.users.createIndex({ role: 1 });
```

#### 4. system_config Collection

```javascript
{
  _id: ObjectId,
  config_version: Number,
  sensor_polling_interval_seconds: Number,
  quality_thresholds: {
    ph: {
      safe_min: Number,
      safe_max: Number,
      unsafe_min: Number,
      unsafe_max: Number
    },
    turbidity: {
      safe_max: Number,
      unsafe_max: Number
    },
    temperature: {
      safe_min: Number,
      safe_max: Number,
      unsafe_min: Number,
      unsafe_max: Number
    },
    tds: {
      safe_max: Number,
      unsafe_max: Number
    },
    dissolved_oxygen: {
      safe_min: Number,
      unsafe_min: Number
    }
  },
  risk_thresholds: {
    low_max: Number,
    medium_max: Number
  },
  tank_dimensions: {
    height_cm: Number,
    diameter_cm: Number,
    capacity_liters: Number
  },
  updated_at: ISODate,
  updated_by: ObjectId  // Reference to users._id
}

// Indexes
db.system_config.createIndex({ config_version: -1 });
```

#### 5. sensor_devices Collection

```javascript
{
  _id: ObjectId,
  device_id: String,  // unique
  device_name: String,
  location: String,
  calibration: {
    ph_offset: Number,
    turbidity_offset: Number,
    temperature_offset: Number,
    tds_offset: Number,
    dissolved_oxygen_offset: Number,
    last_calibrated: ISODate
  },
  status: String,  // "online", "offline", "maintenance"
  last_communication: ISODate,
  firmware_version: String,
  registered_at: ISODate,
  owner_id: ObjectId  // Reference to users._id
}

// Indexes
db.sensor_devices.createIndex({ device_id: 1 }, { unique: true });
db.sensor_devices.createIndex({ owner_id: 1 });
db.sensor_devices.createIndex({ status: 1 });
```

#### 6. notification_log Collection

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  notification_type: String,  // "water_quality", "risk_alert", "tank_alert"
  title: String,
  body: String,
  data: Object,
  sent_at: ISODate,
  delivered: Boolean,
  opened: Boolean,
  opened_at: ISODate
}

// Indexes
db.notification_log.createIndex({ user_id: 1, sent_at: -1 });
db.notification_log.createIndex({ sent_at: 1 }, { expireAfterSeconds: 2592000 }); // 30 days TTL
```

### Pydantic Models (Backend Validation)

```python
# models/schemas.py
from pydantic import BaseModel, Field, EmailStr, validator
from typing import Optional, List, Dict
from datetime import datetime
from enum import Enum

class WaterQuality(str, Enum):
    SAFE = "Safe"
    WARNING = "Warning"
    UNSAFE = "Unsafe"

class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"

class TankStatus(str, Enum):
    EMPTY = "Empty"
    HALF_FULL = "Half_Full"
    FULL = "Full"
    OVERFLOW = "Overflow"

class SensorDataRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=50)
    timestamp: datetime
    ph: float = Field(..., ge=0, le=14)
    turbidity: float = Field(..., ge=0, le=3000)
    temperature: float = Field(..., ge=-55, le=125)
    tds: float = Field(..., ge=0, le=1000)
    dissolved_oxygen: float = Field(..., ge=0, le=20)
    
    class Config:
        json_schema_extra = {
            "example": {
                "device_id": "ESP32_001",
                "timestamp": "2025-01-15T10:30:00Z",
                "ph": 7.2,
                "turbidity": 15.5,
                "temperature": 25.3,
                "tds": 150,
                "dissolved_oxygen": 8.5
            }
        }

class TankLevelRequest(BaseModel):
    device_id: str = Field(..., min_length=1, max_length=50)
    timestamp: datetime
    distance_cm: float = Field(..., ge=0, le=400)
    tank_height_cm: float = Field(..., gt=0, le=500)

class SHAPFactor(BaseModel):
    feature: str
    shap_value: float
    direction: str  # "increasing_risk" or "decreasing_risk"

class ClassificationResult(BaseModel):
    quality: WaterQuality
    confidence: float = Field(..., ge=0, le=1)
    shap_values: Dict[str, float]
    top_factors: List[SHAPFactor]

class RiskPredictionResult(BaseModel):
    risk_score: float = Field(..., ge=0, le=1)
    risk_level: RiskLevel
    shap_values: Dict[str, float]
    top_factors: List[SHAPFactor]

class SensorDataResponse(BaseModel):
    status: str
    reading_id: str
    classification: ClassificationResult
    risk_prediction: RiskPredictionResult
    timestamp: datetime

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str = Field(..., min_length=1, max_length=100)
    role: str = Field(default="user")
    
    @validator('role')
    def validate_role(cls, v):
        if v not in ['user', 'admin']:
            raise ValueError('Role must be "user" or "admin"')
        return v

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: Dict

class CurrentStatusResponse(BaseModel):
    water_quality: Dict
    contamination_risk: Dict
    tank_status: Dict
```


## ML Pipeline Design

### Training Pipeline

#### Data Collection and Preparation

```python
# ml/data_preparation.py
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

class DataPreparator:
    def __init__(self):
        self.scaler = StandardScaler()
        self.feature_columns = ['ph', 'turbidity', 'temperature', 'tds', 'dissolved_oxygen']
    
    def load_training_data(self, csv_path: str) -> pd.DataFrame:
        """Load training data from CSV"""
        df = pd.read_csv(csv_path)
        required_columns = self.feature_columns + ['quality_label', 'contamination_risk']
        
        if not all(col in df.columns for col in required_columns):
            raise ValueError(f"CSV must contain columns: {required_columns}")
        
        return df
    
    def prepare_classification_data(self, df: pd.DataFrame):
        """Prepare data for Random Forest classifier"""
        X = df[self.feature_columns].values
        y = df['quality_label'].map({'Safe': 0, 'Warning': 1, 'Unsafe': 2}).values
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        # Fit scaler on training data only
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        return X_train_scaled, X_test_scaled, y_train, y_test
    
    def prepare_risk_prediction_data(self, df: pd.DataFrame):
        """Prepare data for XGBoost risk predictor with temporal features"""
        # Sort by timestamp to create temporal sequences
        df = df.sort_values('timestamp')
        
        X_list = []
        y_list = []
        
        # Create sliding windows of 10 readings
        window_size = 10
        for i in range(window_size, len(df)):
            window = df.iloc[i-window_size:i]
            current = df.iloc[i]
            
            # Current features
            current_features = current[self.feature_columns].values
            
            # Temporal features: mean, std, trend
            window_values = window[self.feature_columns].values
            mean_features = np.mean(window_values, axis=0)
            std_features = np.std(window_values, axis=0)
            trend_features = (window_values[-1] - window_values[0]) / window_size
            
            # Combine all features
            combined_features = np.concatenate([
                current_features, mean_features, std_features, trend_features
            ])
            
            X_list.append(combined_features)
            y_list.append(1 if current['contamination_risk'] > 0.5 else 0)
        
        X = np.array(X_list)
        y = np.array(y_list)
        
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42, stratify=y
        )
        
        return X_train, X_test, y_train, y_test
```

#### Model Training

```python
# ml/train_classifier.py
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV, cross_val_score
import joblib
import json
from datetime import datetime

class ClassifierTrainer:
    def __init__(self):
        self.model = None
        self.best_params = None
    
    def train(self, X_train, y_train, hyperparameter_tuning=True):
        """Train Random Forest classifier"""
        if hyperparameter_tuning:
            param_grid = {
                'n_estimators': [100, 200, 300],
                'max_depth': [10, 20, 30, None],
                'min_samples_split': [2, 5, 10],
                'min_samples_leaf': [1, 2, 4],
                'max_features': ['sqrt', 'log2']
            }
            
            rf = RandomForestClassifier(random_state=42)
            grid_search = GridSearchCV(
                rf, param_grid, cv=5, scoring='f1_weighted',
                n_jobs=-1, verbose=1
            )
            grid_search.fit(X_train, y_train)
            
            self.model = grid_search.best_estimator_
            self.best_params = grid_search.best_params_
        else:
            self.model = RandomForestClassifier(
                n_estimators=200,
                max_depth=20,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                random_state=42
            )
            self.model.fit(X_train, y_train)
    
    def evaluate(self, X_test, y_test):
        """Evaluate model performance"""
        from sklearn.metrics import (
            accuracy_score, precision_recall_fscore_support,
            confusion_matrix, classification_report
        )
        
        y_pred = self.model.predict(X_test)
        
        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_test, y_pred, average='weighted'
        )
        cm = confusion_matrix(y_test, y_pred)
        
        # Cross-validation scores
        cv_scores = cross_val_score(
            self.model, X_test, y_test, cv=5, scoring='f1_weighted'
        )
        
        report = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'confusion_matrix': cm.tolist(),
            'cv_scores': cv_scores.tolist(),
            'cv_mean': float(cv_scores.mean()),
            'cv_std': float(cv_scores.std()),
            'classification_report': classification_report(
                y_test, y_pred, target_names=['Safe', 'Warning', 'Unsafe']
            )
        }
        
        return report
    
    def save_model(self, version: str):
        """Save model with version"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_path = f'ml/models/rf_classifier_{version}_{timestamp}.pkl'
        metadata_path = f'ml/models/rf_classifier_{version}_{timestamp}_metadata.json'
        
        joblib.dump(self.model, model_path)
        
        metadata = {
            'version': version,
            'timestamp': timestamp,
            'model_type': 'RandomForestClassifier',
            'hyperparameters': self.best_params or self.model.get_params(),
            'feature_names': ['ph', 'turbidity', 'temperature', 'tds', 'dissolved_oxygen']
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return model_path, metadata_path
```

```python
# ml/train_predictor.py
import xgboost as xgb
from sklearn.model_selection import GridSearchCV, cross_val_score
import joblib
import json
from datetime import datetime

class RiskPredictorTrainer:
    def __init__(self):
        self.model = None
        self.best_params = None
    
    def train(self, X_train, y_train, hyperparameter_tuning=True):
        """Train XGBoost risk predictor"""
        if hyperparameter_tuning:
            param_grid = {
                'n_estimators': [100, 200, 300],
                'max_depth': [3, 5, 7],
                'learning_rate': [0.01, 0.1, 0.3],
                'subsample': [0.8, 0.9, 1.0],
                'colsample_bytree': [0.8, 0.9, 1.0]
            }
            
            xgb_model = xgb.XGBClassifier(
                objective='binary:logistic',
                random_state=42,
                use_label_encoder=False,
                eval_metric='logloss'
            )
            
            grid_search = GridSearchCV(
                xgb_model, param_grid, cv=5, scoring='f1',
                n_jobs=-1, verbose=1
            )
            grid_search.fit(X_train, y_train)
            
            self.model = grid_search.best_estimator_
            self.best_params = grid_search.best_params_
        else:
            self.model = xgb.XGBClassifier(
                n_estimators=200,
                max_depth=5,
                learning_rate=0.1,
                subsample=0.9,
                colsample_bytree=0.9,
                objective='binary:logistic',
                random_state=42,
                use_label_encoder=False,
                eval_metric='logloss'
            )
            self.model.fit(X_train, y_train)
    
    def evaluate(self, X_test, y_test):
        """Evaluate model performance"""
        from sklearn.metrics import (
            accuracy_score, precision_recall_fscore_support,
            confusion_matrix, roc_auc_score, roc_curve
        )
        
        y_pred = self.model.predict(X_test)
        y_pred_proba = self.model.predict_proba(X_test)[:, 1]
        
        accuracy = accuracy_score(y_test, y_pred)
        precision, recall, f1, _ = precision_recall_fscore_support(
            y_test, y_pred, average='binary'
        )
        cm = confusion_matrix(y_test, y_pred)
        auc = roc_auc_score(y_test, y_pred_proba)
        
        # Cross-validation scores
        cv_scores = cross_val_score(
            self.model, X_test, y_test, cv=5, scoring='f1'
        )
        
        report = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'auc_roc': float(auc),
            'confusion_matrix': cm.tolist(),
            'cv_scores': cv_scores.tolist(),
            'cv_mean': float(cv_scores.mean()),
            'cv_std': float(cv_scores.std())
        }
        
        return report
    
    def save_model(self, version: str):
        """Save model with version"""
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        model_path = f'ml/models/xgb_predictor_{version}_{timestamp}.pkl'
        metadata_path = f'ml/models/xgb_predictor_{version}_{timestamp}_metadata.json'
        
        joblib.dump(self.model, model_path)
        
        metadata = {
            'version': version,
            'timestamp': timestamp,
            'model_type': 'XGBClassifier',
            'hyperparameters': self.best_params or self.model.get_params(),
            'feature_names': [
                'ph', 'turbidity', 'temperature', 'tds', 'dissolved_oxygen',
                'ph_mean', 'turbidity_mean', 'temperature_mean', 'tds_mean', 'do_mean',
                'ph_std', 'turbidity_std', 'temperature_std', 'tds_std', 'do_std',
                'ph_trend', 'turbidity_trend', 'temperature_trend', 'tds_trend', 'do_trend'
            ]
        }
        
        with open(metadata_path, 'w') as f:
            json.dump(metadata, f, indent=2)
        
        return model_path, metadata_path
```

### Model Versioning and Deployment

#### Version Management Strategy

1. **Semantic Versioning**: Models use semantic versioning (v1.0.0, v1.1.0, v2.0.0)
   - Major version: Breaking changes in input/output format
   - Minor version: Improved performance, new features
   - Patch version: Bug fixes, minor improvements

2. **Model Registry**: MongoDB collection tracks all model versions
   ```javascript
   {
     _id: ObjectId,
     model_type: "classifier" | "predictor",
     version: "v1.0.0",
     file_path: String,
     metadata_path: String,
     performance_metrics: Object,
     training_date: ISODate,
     deployed: Boolean,
     deployed_at: ISODate
   }
   ```

3. **A/B Testing**: Support loading multiple model versions simultaneously
   ```python
   class ModelManager:
       def __init__(self):
           self.models = {
               'classifier': {
                   'v1': None,
                   'v2': None
               },
               'predictor': {
                   'v1': None,
                   'v2': None
               }
           }
           self.active_versions = {
               'classifier': 'v1',
               'predictor': 'v1'
           }
       
       def load_model(self, model_type: str, version: str, path: str):
           """Load a specific model version"""
           self.models[model_type][version] = joblib.load(path)
       
       def get_active_model(self, model_type: str):
           """Get currently active model"""
           version = self.active_versions[model_type]
           return self.models[model_type][version]
       
       def switch_version(self, model_type: str, version: str):
           """Switch active model version"""
           if version in self.models[model_type]:
               self.active_versions[model_type] = version
           else:
               raise ValueError(f"Version {version} not loaded")
   ```

### Inference Pipeline

#### Real-time Inference Flow

```mermaid
graph LR
    A[Sensor Data] --> B[Feature Extraction]
    B --> C[Feature Validation]
    C --> D[Model Inference]
    D --> E[SHAP Computation]
    E --> F[Result Formatting]
    F --> G[Response]
    
    H[Historical Data] --> I[Temporal Features]
    I --> D
    
    style D fill:#fff4e6
    style E fill:#e1f5ff
```

#### Performance Optimization

1. **Model Loading**: Load models once at startup, keep in memory
2. **Batch Processing**: Process multiple predictions in batch when possible
3. **Caching**: Cache SHAP explainers (TreeExplainer is fast but initialization is slow)
4. **Async Processing**: Use asyncio for non-blocking inference
5. **Connection Pooling**: Reuse database connections

```python
# Optimized inference service
class OptimizedMLService:
    def __init__(self):
        self.classifier = None
        self.predictor = None
        self.classifier_explainer = None
        self.predictor_explainer = None
        self._load_models()
        self._initialize_explainers()
    
    def _load_models(self):
        """Load models once at startup"""
        self.classifier = joblib.load('ml/models/rf_classifier_v1.pkl')
        self.predictor = joblib.load('ml/models/xgb_predictor_v1.pkl')
    
    def _initialize_explainers(self):
        """Initialize SHAP explainers once"""
        self.classifier_explainer = shap.TreeExplainer(self.classifier)
        self.predictor_explainer = shap.TreeExplainer(self.predictor)
    
    async def predict_with_explanation(self, features: Dict, historical: np.ndarray):
        """Async prediction with SHAP explanation"""
        # Run CPU-intensive work in thread pool
        loop = asyncio.get_event_loop()
        
        classification_task = loop.run_in_executor(
            None, self._classify, features
        )
        risk_task = loop.run_in_executor(
            None, self._predict_risk, features, historical
        )
        
        classification, risk = await asyncio.gather(
            classification_task, risk_task
        )
        
        return classification, risk
```

## Security Design

### Authentication and Authorization

#### JWT Token-Based Authentication

```python
# services/auth_service.py
from datetime import datetime, timedelta
from jose import JWTError, jwt
from passlib.context import CryptContext
from typing import Optional

class AuthService:
    def __init__(self, secret_key: str, algorithm: str = "HS256"):
        self.secret_key = secret_key
        self.algorithm = algorithm
        self.pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        self.access_token_expire_minutes = 60 * 24  # 24 hours
    
    def hash_password(self, password: str) -> str:
        """Hash password using bcrypt"""
        return self.pwd_context.hash(password)
    
    def verify_password(self, plain_password: str, hashed_password: str) -> bool:
        """Verify password against hash"""
        return self.pwd_context.verify(plain_password, hashed_password)
    
    def create_access_token(self, data: dict, expires_delta: Optional[timedelta] = None) -> str:
        """Create JWT access token"""
        to_encode = data.copy()
        
        if expires_delta:
            expire = datetime.utcnow() + expires_delta
        else:
            expire = datetime.utcnow() + timedelta(minutes=self.access_token_expire_minutes)
        
        to_encode.update({"exp": expire, "iat": datetime.utcnow()})
        encoded_jwt = jwt.encode(to_encode, self.secret_key, algorithm=self.algorithm)
        
        return encoded_jwt
    
    def decode_token(self, token: str) -> Optional[dict]:
        """Decode and validate JWT token"""
        try:
            payload = jwt.decode(token, self.secret_key, algorithms=[self.algorithm])
            return payload
        except JWTError:
            return None
    
    def get_current_user(self, token: str) -> Optional[dict]:
        """Extract user from token"""
        payload = self.decode_token(token)
        if payload is None:
            return None
        
        user_id = payload.get("sub")
        if user_id is None:
            return None
        
        return {"user_id": user_id, "role": payload.get("role")}
```

#### API Key Authentication for ESP32

```python
# ESP32 devices use API keys instead of JWT
class DeviceAuthService:
    def __init__(self, db):
        self.db = db
    
    async def validate_device_api_key(self, device_id: str, api_key: str) -> bool:
        """Validate device API key"""
        device = await self.db.sensor_devices.find_one({
            "device_id": device_id,
            "api_key_hash": self.hash_api_key(api_key),
            "status": {"$ne": "disabled"}
        })
        
        return device is not None
    
    def hash_api_key(self, api_key: str) -> str:
        """Hash API key for storage"""
        import hashlib
        return hashlib.sha256(api_key.encode()).hexdigest()
    
    def generate_api_key(self) -> str:
        """Generate new API key for device"""
        import secrets
        return secrets.token_urlsafe(32)
```

#### Role-Based Access Control (RBAC)

```python
# dependencies.py
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security = HTTPBearer()

async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    auth_service: AuthService = Depends()
) -> dict:
    """Dependency to get current authenticated user"""
    token = credentials.credentials
    user = auth_service.get_current_user(token)
    
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    return user

async def require_admin(
    current_user: dict = Depends(get_current_user)
) -> dict:
    """Dependency to require admin role"""
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin privileges required"
        )
    
    return current_user

# Usage in endpoints
@router.put("/config", dependencies=[Depends(require_admin)])
async def update_config(config: ConfigUpdate):
    # Only admins can access this endpoint
    pass
```

### Data Security

#### HTTPS/TLS Configuration

```python
# main.py
import uvicorn
from fastapi import FastAPI

app = FastAPI()

if __name__ == "__main__":
    uvicorn.run(
        app,
        host="0.0.0.0",
        port=443,
        ssl_keyfile="/path/to/private.key",
        ssl_certfile="/path/to/certificate.crt",
        ssl_ca_certs="/path/to/ca_bundle.crt"
    )
```

#### Rate Limiting

```python
# middleware/rate_limit.py
from fastapi import Request, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict

class RateLimiter:
    def __init__(self, requests_per_minute: int = 100):
        self.requests_per_minute = requests_per_minute
        self.requests = defaultdict(list)
    
    async def check_rate_limit(self, request: Request):
        """Check if request exceeds rate limit"""
        client_ip = request.client.host
        now = datetime.utcnow()
        
        # Clean old requests
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < timedelta(minutes=1)
        ]
        
        # Check limit
        if len(self.requests[client_ip]) >= self.requests_per_minute:
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Try again later."
            )
        
        # Add current request
        self.requests[client_ip].append(now)

# Apply to app
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(RateLimiter)
```

#### Input Validation and Sanitization

- **Pydantic Models**: Automatic validation of all request payloads
- **SQL Injection Prevention**: MongoDB driver handles parameterization
- **XSS Prevention**: No HTML rendering in backend, mobile app handles display
- **CSRF Protection**: Not needed for stateless JWT authentication

### Secrets Management

```python
# config.py
from pydantic_settings import BaseSettings
from functools import lru_cache

class Settings(BaseSettings):
    # Database
    mongodb_url: str
    mongodb_db_name: str
    
    # JWT
    jwt_secret_key: str
    jwt_algorithm: str = "HS256"
    
    # Firebase
    fcm_server_key: str
    
    # ML Models
    classifier_model_path: str
    predictor_model_path: str
    
    # API
    api_rate_limit: int = 100
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

@lru_cache()
def get_settings():
    return Settings()
```

**.env file** (not committed to version control):
```
MONGODB_URL=mongodb://localhost:27017
MONGODB_DB_NAME=water_quality_db
JWT_SECRET_KEY=your-secret-key-here-change-in-production
FCM_SERVER_KEY=your-fcm-server-key
CLASSIFIER_MODEL_PATH=ml/models/rf_classifier_v1.pkl
PREDICTOR_MODEL_PATH=ml/models/xgb_predictor_v1.pkl
```


## Deployment Architecture

### Development Environment

```
┌─────────────────────────────────────────────────────────────┐
│                    Development Setup                         │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ESP32 (Local)  ──────┐                                     │
│                        │                                     │
│                        ├──> FastAPI (localhost:8000)        │
│                        │    ├─> MongoDB (localhost:27017)   │
│                        │    └─> ML Models (local files)     │
│                        │                                     │
│  Mobile App (Emulator) ┘                                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### Production Deployment (Cloud-Based)

```
┌─────────────────────────────────────────────────────────────────┐
│                      Production Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ESP32 Devices                                                   │
│  (Home Network)                                                  │
│       │                                                          │
│       │ HTTPS                                                    │
│       ▼                                                          │
│  ┌──────────────┐                                               │
│  │ Load Balancer│ (NGINX/AWS ALB)                              │
│  └──────┬───────┘                                               │
│         │                                                        │
│         ├──> FastAPI Instance 1 ──┐                            │
│         ├──> FastAPI Instance 2 ──┼──> MongoDB Atlas           │
│         └──> FastAPI Instance 3 ──┘     (Replica Set)          │
│                                                                   │
│  Mobile Apps ──> Load Balancer ──> FastAPI Instances            │
│                                                                   │
│  Firebase Cloud Messaging ──> Mobile Apps                        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### Containerization (Docker)

#### Backend Dockerfile

```dockerfile
# Dockerfile
FROM python:3.9-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY app/ ./app/
COPY ml/ ./ml/

# Create non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/api/v1/health')"

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

#### Docker Compose (Development)

```yaml
# docker-compose.yml
version: '3.8'

services:
  mongodb:
    image: mongo:6.0
    container_name: water_quality_mongodb
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    networks:
      - water_quality_network

  backend:
    build: ./backend
    container_name: water_quality_backend
    ports:
      - "8000:8000"
    volumes:
      - ./backend/app:/app/app
      - ./backend/ml:/app/ml
    environment:
      MONGODB_URL: mongodb://admin:password@mongodb:27017
      MONGODB_DB_NAME: water_quality_db
      JWT_SECRET_KEY: dev-secret-key
      FCM_SERVER_KEY: ${FCM_SERVER_KEY}
    depends_on:
      - mongodb
    networks:
      - water_quality_network
    restart: unless-stopped

volumes:
  mongodb_data:

networks:
  water_quality_network:
    driver: bridge
```

### Cloud Deployment Options

#### Option 1: AWS Deployment

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Architecture                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  Route 53 (DNS)                                              │
│       │                                                       │
│       ▼                                                       │
│  Application Load Balancer                                   │
│       │                                                       │
│       ▼                                                       │
│  ECS Fargate (FastAPI Containers)                           │
│       │                                                       │
│       ├──> MongoDB Atlas (or DocumentDB)                     │
│       ├──> S3 (ML Model Storage)                            │
│       └──> CloudWatch (Logging & Monitoring)                │
│                                                               │
│  SNS/SQS (Optional: Async notification queue)               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Services Used**:
- **ECS Fargate**: Serverless container orchestration
- **Application Load Balancer**: HTTPS termination, routing
- **MongoDB Atlas**: Managed MongoDB (or AWS DocumentDB)
- **S3**: ML model artifact storage
- **CloudWatch**: Logging, metrics, alarms
- **Route 53**: DNS management
- **ACM**: SSL/TLS certificates

#### Option 2: Heroku Deployment (Simpler for Academic Project)

```bash
# Procfile
web: uvicorn app.main:app --host 0.0.0.0 --port $PORT

# Deploy commands
heroku create water-quality-monitor
heroku addons:create mongolab:sandbox
heroku config:set JWT_SECRET_KEY=your-secret-key
heroku config:set FCM_SERVER_KEY=your-fcm-key
git push heroku main
```

#### Option 3: DigitalOcean App Platform

```yaml
# .do/app.yaml
name: water-quality-monitor
services:
  - name: backend
    github:
      repo: your-username/water-quality-backend
      branch: main
    build_command: pip install -r requirements.txt
    run_command: uvicorn app.main:app --host 0.0.0.0 --port 8080
    envs:
      - key: MONGODB_URL
        value: ${mongodb.DATABASE_URL}
      - key: JWT_SECRET_KEY
        type: SECRET
      - key: FCM_SERVER_KEY
        type: SECRET
    health_check:
      http_path: /api/v1/health
    http_port: 8080
    instance_count: 2
    instance_size_slug: basic-xs

databases:
  - name: mongodb
    engine: MONGODB
    version: "6"
```

### Scaling Strategy

#### Horizontal Scaling

1. **Stateless Backend**: FastAPI instances are stateless, can scale horizontally
2. **Load Balancing**: Distribute requests across multiple instances
3. **Database Scaling**: MongoDB replica sets for read scaling
4. **Caching**: Redis for frequently accessed data (optional)

#### Vertical Scaling

1. **Instance Size**: Increase CPU/RAM for ML inference performance
2. **Database Resources**: Increase MongoDB instance size for larger datasets

#### Auto-Scaling Configuration (AWS ECS)

```json
{
  "scalingPolicies": [
    {
      "policyName": "cpu-scaling",
      "targetTrackingScaling": {
        "targetValue": 70.0,
        "predefinedMetricSpecification": {
          "predefinedMetricType": "ECSServiceAverageCPUUtilization"
        },
        "scaleOutCooldown": 60,
        "scaleInCooldown": 300
      }
    }
  ],
  "minCapacity": 2,
  "maxCapacity": 10
}
```

## Error Handling and Recovery

### Error Classification

#### 1. Sensor Errors
- **Sensor Failure**: Individual sensor not responding
- **Out of Range**: Reading outside physical sensor range
- **Calibration Drift**: Readings inconsistent with expected values

**Handling**:
```cpp
// ESP32 error handling
Reading acquireSensorData() {
    Reading r;
    
    try {
        r.ph = readPH();
        if (r.ph < 0 || r.ph > 14) {
            logError("pH out of range");
            r.ph = NAN;  // Mark as invalid
        }
    } catch (SensorException& e) {
        logError("pH sensor failed: " + e.message);
        r.ph = NAN;
    }
    
    // Continue with other sensors...
    
    return r;
}
```

#### 2. Network Errors
- **Connection Timeout**: ESP32 cannot reach backend
- **HTTP Errors**: 4xx, 5xx responses
- **DNS Failure**: Cannot resolve backend hostname

**Handling**:
```cpp
// ESP32 network error handling with exponential backoff
void transmitReading(Reading r) {
    int retries = 0;
    int backoff = 1000;  // Start with 1 second
    
    while (retries < 3) {
        HTTPClient http;
        http.begin(API_ENDPOINT);
        http.setTimeout(10000);  // 10 second timeout
        
        int httpCode = http.POST(serializeReading(r));
        
        if (httpCode == 200) {
            return;  // Success
        } else if (httpCode == 401) {
            logError("Authentication failed");
            return;  // Don't retry auth errors
        } else {
            logError("HTTP error: " + String(httpCode));
            retries++;
            delay(backoff);
            backoff *= 2;  // Exponential backoff
        }
    }
    
    // After 3 retries, buffer the reading
    bufferReading(r);
}
```

#### 3. Database Errors
- **Connection Lost**: MongoDB connection dropped
- **Write Failure**: Cannot persist data
- **Query Timeout**: Slow query exceeds timeout

**Handling**:
```python
# Backend database error handling
from motor.motor_asyncio import AsyncIOMotorClient
from pymongo.errors import ConnectionFailure, ServerSelectionTimeoutError

class DatabaseRepository:
    async def save_sensor_reading(self, reading: dict):
        try:
            result = await self.db.sensor_readings.insert_one(reading)
            return str(result.inserted_id)
        except ConnectionFailure:
            logger.error("Database connection lost")
            raise HTTPException(
                status_code=503,
                detail="Database temporarily unavailable"
            )
        except ServerSelectionTimeoutError:
            logger.error("Database query timeout")
            raise HTTPException(
                status_code=504,
                detail="Database query timeout"
            )
        except Exception as e:
            logger.error(f"Unexpected database error: {e}")
            raise HTTPException(
                status_code=500,
                detail="Internal server error"
            )
```

#### 4. ML Model Errors
- **Model Not Loaded**: Model file missing or corrupted
- **Inference Failure**: Exception during prediction
- **Invalid Input**: Features outside training distribution

**Handling**:
```python
# ML service error handling
class MLService:
    def classify_water_quality(self, features: Dict[str, float]) -> Tuple[str, float]:
        try:
            if self.classifier is None:
                raise ModelNotLoadedError("Classifier not loaded")
            
            X = self._prepare_features(features)
            
            # Validate input is within reasonable bounds
            if not self._validate_features(X):
                raise InvalidInputError("Features outside expected range")
            
            prediction = self.classifier.predict(X)[0]
            confidence = float(np.max(self.classifier.predict_proba(X)[0]))
            
            return self._map_prediction(prediction), confidence
            
        except ModelNotLoadedError:
            logger.error("Classifier not loaded")
            # Return last known classification from cache
            return self._get_cached_classification()
        except Exception as e:
            logger.error(f"Classification failed: {e}")
            # Return safe default
            return "Warning", 0.5
```

#### 5. Notification Errors
- **FCM Failure**: Cannot send notification
- **Invalid Token**: Device token expired or invalid
- **Rate Limit**: FCM rate limit exceeded

**Handling**:
```python
# Notification service error handling with retry
class NotificationService:
    async def _send_fcm_notification(self, tokens: List[str], title: str, body: str, priority: str):
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                async with httpx.AsyncClient() as client:
                    response = await client.post(
                        self.fcm_url,
                        json=self._build_payload(tokens, title, body, priority),
                        headers=self._get_headers(),
                        timeout=10.0
                    )
                    
                    if response.status_code == 200:
                        # Check for invalid tokens in response
                        await self._handle_fcm_response(response.json())
                        return
                    elif response.status_code == 429:
                        # Rate limit, wait and retry
                        await asyncio.sleep(2 ** retry_count)
                        retry_count += 1
                    else:
                        logger.error(f"FCM error: {response.status_code}")
                        return
                        
            except httpx.TimeoutException:
                logger.error("FCM request timeout")
                retry_count += 1
                await asyncio.sleep(2 ** retry_count)
            except Exception as e:
                logger.error(f"FCM notification failed: {e}")
                return
        
        logger.error("FCM notification failed after retries")
    
    async def _handle_fcm_response(self, response_data: dict):
        """Remove invalid tokens from database"""
        if 'results' in response_data:
            for idx, result in enumerate(response_data['results']):
                if 'error' in result:
                    error = result['error']
                    if error in ['InvalidRegistration', 'NotRegistered']:
                        # Remove invalid token from database
                        await self._remove_invalid_token(tokens[idx])
```

### Graceful Degradation

When components fail, the system should degrade gracefully:

1. **Sensor Failure**: Continue with remaining sensors, mark failed sensor in response
2. **ML Model Failure**: Return last known classification with warning flag
3. **Database Failure**: Return cached data, queue writes for retry
4. **Notification Failure**: Log error, don't block main flow
5. **SHAP Failure**: Return prediction without explanation

### Logging Strategy

```python
# utils/logger.py
import logging
from logging.handlers import RotatingFileHandler
import json
from datetime import datetime

class StructuredLogger:
    def __init__(self, name: str):
        self.logger = logging.getLogger(name)
        self.logger.setLevel(logging.INFO)
        
        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(logging.INFO)
        
        # File handler with rotation
        file_handler = RotatingFileHandler(
            'logs/app.log',
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.INFO)
        
        # JSON formatter for structured logging
        formatter = logging.Formatter(
            '{"timestamp": "%(asctime)s", "level": "%(levelname)s", '
            '"logger": "%(name)s", "message": "%(message)s"}'
        )
        
        console_handler.setFormatter(formatter)
        file_handler.setFormatter(formatter)
        
        self.logger.addHandler(console_handler)
        self.logger.addHandler(file_handler)
    
    def log_sensor_data(self, device_id: str, data: dict):
        """Log sensor data ingestion"""
        self.logger.info(json.dumps({
            "event": "sensor_data_received",
            "device_id": device_id,
            "timestamp": datetime.utcnow().isoformat(),
            "parameters": data
        }))
    
    def log_ml_inference(self, model_type: str, duration_ms: float, result: str):
        """Log ML inference performance"""
        self.logger.info(json.dumps({
            "event": "ml_inference",
            "model_type": model_type,
            "duration_ms": duration_ms,
            "result": result,
            "timestamp": datetime.utcnow().isoformat()
        }))
    
    def log_error(self, error_type: str, error_message: str, context: dict = None):
        """Log errors with context"""
        self.logger.error(json.dumps({
            "event": "error",
            "error_type": error_type,
            "error_message": error_message,
            "context": context or {},
            "timestamp": datetime.utcnow().isoformat()
        }))
```

## Performance Optimization

### Backend Optimizations

#### 1. Connection Pooling

```python
# db/mongodb.py
from motor.motor_asyncio import AsyncIOMotorClient

class Database:
    client: AsyncIOMotorClient = None
    
    @classmethod
    async def connect_db(cls):
        """Create connection pool"""
        cls.client = AsyncIOMotorClient(
            settings.mongodb_url,
            maxPoolSize=50,
            minPoolSize=10,
            maxIdleTimeMS=45000,
            serverSelectionTimeoutMS=5000
        )
    
    @classmethod
    async def close_db(cls):
        """Close connection pool"""
        cls.client.close()
    
    @classmethod
    def get_db(cls):
        """Get database instance"""
        return cls.client[settings.mongodb_db_name]
```

#### 2. Response Caching

```python
# utils/cache.py
from functools import lru_cache
from datetime import datetime, timedelta
import asyncio

class AsyncCache:
    def __init__(self, ttl_seconds: int = 30):
        self.cache = {}
        self.ttl = timedelta(seconds=ttl_seconds)
    
    async def get(self, key: str):
        """Get cached value if not expired"""
        if key in self.cache:
            value, timestamp = self.cache[key]
            if datetime.utcnow() - timestamp < self.ttl:
                return value
            else:
                del self.cache[key]
        return None
    
    async def set(self, key: str, value):
        """Set cached value with timestamp"""
        self.cache[key] = (value, datetime.utcnow())
    
    async def invalidate(self, key: str):
        """Invalidate cached value"""
        if key in self.cache:
            del self.cache[key]

# Usage
cache = AsyncCache(ttl_seconds=30)

@router.get("/current-status")
async def get_current_status(device_id: str = None):
    cache_key = f"status:{device_id or 'all'}"
    
    # Try cache first
    cached = await cache.get(cache_key)
    if cached:
        return cached
    
    # Fetch from database
    status = await fetch_current_status(device_id)
    
    # Cache result
    await cache.set(cache_key, status)
    
    return status
```

#### 3. Database Query Optimization

```python
# Optimized queries with projections and indexes
class SensorRepository:
    async def get_latest_reading(self, device_id: str):
        """Get latest reading with projection"""
        return await self.db.sensor_readings.find_one(
            {"device_id": device_id},
            sort=[("timestamp", -1)],
            projection={
                "_id": 0,
                "parameters": 1,
                "classification": 1,
                "risk_prediction": 1,
                "timestamp": 1
            }
        )
    
    async def get_historical_data(self, start_date, end_date, device_id=None):
        """Get historical data with efficient query"""
        query = {
            "timestamp": {"$gte": start_date, "$lte": end_date}
        }
        if device_id:
            query["device_id"] = device_id
        
        cursor = self.db.sensor_readings.find(
            query,
            projection={
                "_id": 0,
                "timestamp": 1,
                "parameters": 1,
                "classification.quality": 1,
                "risk_prediction.risk_score": 1
            }
        ).sort("timestamp", 1).limit(10000)
        
        return await cursor.to_list(length=10000)
```

### Mobile App Optimizations

#### 1. Data Prefetching

```typescript
// Prefetch data on app launch
useEffect(() => {
  const prefetchData = async () => {
    // Fetch current status
    const statusPromise = api.getCurrentStatus();
    // Fetch recent history
    const historyPromise = api.getHistoricalData('24h');
    
    // Wait for both in parallel
    const [status, history] = await Promise.all([statusPromise, historyPromise]);
    
    setCurrentStatus(status);
    setHistoricalData(history);
  };
  
  prefetchData();
}, []);
```

#### 2. Image and Asset Optimization

- Use vector graphics (SVG) for icons
- Compress images with tools like ImageOptim
- Lazy load charts and heavy components
- Use React.memo for expensive components

#### 3. List Virtualization

```typescript
// Use FlatList for large historical data lists
import { FlatList } from 'react-native';

const HistoryList = ({ data }) => {
  const renderItem = ({ item }) => (
    <HistoryItem reading={item} />
  );
  
  return (
    <FlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={(item) => item.timestamp}
      initialNumToRender={20}
      maxToRenderPerBatch={10}
      windowSize={5}
      removeClippedSubviews={true}
    />
  );
};
```

### ESP32 Optimizations

#### 1. Power Management

```cpp
// Use deep sleep between readings
void loop() {
    Reading reading = acquireSensorData();
    transmitReading(reading);
    
    // Deep sleep for 30 seconds
    esp_sleep_enable_timer_wakeup(30 * 1000000);  // microseconds
    esp_deep_sleep_start();
}
```

#### 2. WiFi Management

```cpp
// Disconnect WiFi when not needed
void transmitReading(Reading r) {
    WiFi.begin(SSID, PASSWORD);
    
    // Wait for connection with timeout
    int timeout = 0;
    while (WiFi.status() != WL_CONNECTED && timeout < 20) {
        delay(500);
        timeout++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        sendHTTPRequest(r);
    }
    
    WiFi.disconnect(true);  // Disconnect to save power
}
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property Reflection

After analyzing all acceptance criteria, I identified the following testable properties. Some properties were combined to eliminate redundancy:

- Properties 3.7 and 4.5 (persistence with timestamp) can be combined into a single property about data persistence
- Properties 5.4 and 5.5 (SHAP data structure and inclusion) can be combined into a single property about SHAP response format
- Properties 4.6-4.8 (risk level classification) are all testing the same mapping logic and can be combined

### Property 1: Sensor Reading Validation

*For any* sensor reading with parameter values, the validation function SHALL accept the reading if and only if all parameters fall within their respective physical sensor ranges (pH: 0-14, turbidity: 0-3000 NTU, temperature: -55 to 125°C, TDS: 0-1000 ppm, dissolved oxygen: 0-20 mg/L).

**Validates: Requirements 1.9**

### Property 2: Classification Uniqueness

*For any* valid Water_Quality_Reading, the ML_Classifier SHALL return exactly one Quality_Classification (Safe, Warning, or Unsafe), never zero classifications and never multiple classifications.

**Validates: Requirements 3.2**

### Property 3: Data Persistence with Timestamp

*For any* classification result or risk prediction, when persisted to the Data_Store, the stored document SHALL include a timestamp field with a valid ISO8601 datetime value.

**Validates: Requirements 3.7, 4.5**

### Property 4: Risk Score Range Invariant

*For any* Water_Quality_Reading input (valid or edge case), the Risk_Predictor SHALL output a risk_score value that satisfies 0.0 ≤ risk_score ≤ 1.0.

**Validates: Requirements 4.2**

### Property 5: Risk Level Classification Consistency

*For any* risk_score value, the risk_level classification SHALL be: "Low" if risk_score < 0.4, "Medium" if 0.4 ≤ risk_score < 0.7, and "High" if risk_score ≥ 0.7.

**Validates: Requirements 4.6, 4.7, 4.8**

### Property 6: SHAP Value Ranking

*For any* set of SHAP values computed by the Explainability_Engine, when ranked by the system, the features SHALL be ordered by descending absolute SHAP value magnitude (|SHAP_value|).

**Validates: Requirements 5.3**

### Property 7: SHAP Response Format

*For any* classification or risk prediction response, the response payload SHALL include a SHAP explanation object containing: (1) a dictionary of feature names to SHAP values, and (2) an array of top factors with feature name, SHAP value, and direction fields.

**Validates: Requirements 5.4, 5.5**

### Property 8: SHAP Value Sum Approximation

*For any* prediction with SHAP explanation, the sum of all SHAP values SHALL approximate the model's output within a tolerance of ±0.1 (accounting for base value and numerical precision).

**Validates: Requirements 5.6**

### Property 9: Input Validation Completeness

*For any* incoming API request payload, the validation layer SHALL verify that: (1) all required fields are present, (2) all field values match their expected data types, and (3) all numeric values fall within acceptable ranges, rejecting invalid payloads with HTTP 400.

**Validates: Requirements 15.7, 15.8**

### Property 10: Serialization Round-Trip Idempotence

*For any* valid data object (SensorDataRequest, ClassificationResult, RiskPredictionResult), serializing to JSON, then parsing back to object, then serializing again SHALL produce an equivalent JSON representation (round-trip property).

**Validates: Requirements 15.9**

## Error Handling

### Error Categories and Strategies

#### 1. Sensor Layer Errors

**Sensor Hardware Failures**:
- **Detection**: Timeout on sensor read, out-of-range values, NaN returns
- **Response**: Log error, mark sensor as failed, continue with remaining sensors
- **Recovery**: Retry on next polling cycle, alert if failure persists > 5 minutes

**Network Connectivity Loss**:
- **Detection**: HTTP request timeout, DNS resolution failure
- **Response**: Buffer readings in local SPIFFS (up to 100 readings)
- **Recovery**: Transmit buffered readings when connectivity restored, exponential backoff retry

**Calibration Drift**:
- **Detection**: Readings inconsistent with historical patterns
- **Response**: Flag readings with warning, continue operation
- **Recovery**: Admin-initiated recalibration via mobile app

#### 2. Backend Service Errors

**Database Connection Failures**:
- **Detection**: MongoDB connection timeout, authentication failure
- **Response**: Return HTTP 503 Service Unavailable
- **Recovery**: Automatic reconnection with exponential backoff, connection pooling

**ML Model Inference Failures**:
- **Detection**: Exception during predict(), model not loaded
- **Response**: Return last known classification from cache with warning flag
- **Recovery**: Reload model, fallback to rule-based classification if model unavailable

**SHAP Computation Failures**:
- **Detection**: Exception during SHAP value calculation
- **Response**: Return prediction without explanation, log error
- **Recovery**: Continue operation, SHAP is non-critical for core functionality

**FCM Notification Failures**:
- **Detection**: HTTP error from FCM, timeout
- **Response**: Retry up to 3 times with exponential backoff
- **Recovery**: Log failure, don't block main request flow

#### 3. Mobile App Errors

**Network Unavailability**:
- **Detection**: HTTP request timeout, no internet connection
- **Response**: Display cached data with "Offline" indicator
- **Recovery**: Auto-retry when connectivity detected, show sync status

**Invalid Server Response**:
- **Detection**: JSON parse error, missing required fields
- **Response**: Display user-friendly error message
- **Recovery**: Retry request, fallback to cached data

**Push Notification Failures**:
- **Detection**: FCM token registration failure
- **Response**: Continue app operation, disable push features
- **Recovery**: Retry token registration on next app launch

### Logging and Monitoring

All errors are logged with:
- Timestamp (ISO8601)
- Component name (sensor/backend/mobile)
- Error type and message
- Context (device_id, user_id, request_id)
- Stack trace (for exceptions)

Critical errors trigger alerts:
- Database unavailable > 5 minutes
- ML model failures > 10 consecutive requests
- Sensor offline > 30 minutes

## Testing Strategy

### Testing Approach

The Water Quality Monitoring System requires a comprehensive testing strategy that combines:

1. **Property-Based Testing**: For core data transformation and validation logic
2. **Unit Testing**: For specific business logic and edge cases
3. **Integration Testing**: For component interactions, ML models, and external services
4. **End-to-End Testing**: For complete user workflows
5. **Performance Testing**: For ML inference and API response times

### Property-Based Testing

**Applicability Assessment**: Property-based testing IS appropriate for this system because:
- The backend contains pure data transformation functions (validation, serialization, risk level mapping)
- There are universal properties that should hold across all inputs (range validation, round-trip serialization)
- The system processes a wide variety of sensor readings with different value combinations

**PBT Library**: Use **Hypothesis** (Python) for backend property tests

**Configuration**: Each property test SHALL run minimum 100 iterations with randomized inputs

**Test Organization**:
```python
# tests/property_tests/test_validation_properties.py
from hypothesis import given, strategies as st
import pytest

# Property 1: Sensor Reading Validation
@given(
    ph=st.floats(min_value=-10, max_value=20),
    turbidity=st.floats(min_value=-100, max_value=5000),
    temperature=st.floats(min_value=-100, max_value=200),
    tds=st.floats(min_value=-100, max_value=2000),
    dissolved_oxygen=st.floats(min_value=-10, max_value=30)
)
def test_sensor_validation_accepts_valid_rejects_invalid(ph, turbidity, temperature, tds, dissolved_oxygen):
    """
    Feature: water-quality-monitoring-system, Property 1:
    For any sensor reading, validation accepts if all parameters in range, rejects otherwise
    """
    reading = {
        'ph': ph,
        'turbidity': turbidity,
        'temperature': temperature,
        'tds': tds,
        'dissolved_oxygen': dissolved_oxygen
    }
    
    is_valid = validate_sensor_reading(reading)
    
    expected_valid = (
        0 <= ph <= 14 and
        0 <= turbidity <= 3000 and
        -55 <= temperature <= 125 and
        0 <= tds <= 1000 and
        0 <= dissolved_oxygen <= 20
    )
    
    assert is_valid == expected_valid

# Property 4: Risk Score Range Invariant
@given(
    ph=st.floats(min_value=0, max_value=14),
    turbidity=st.floats(min_value=0, max_value=3000),
    temperature=st.floats(min_value=-55, max_value=125),
    tds=st.floats(min_value=0, max_value=1000),
    dissolved_oxygen=st.floats(min_value=0, max_value=20)
)
def test_risk_score_always_in_valid_range(ph, turbidity, temperature, tds, dissolved_oxygen):
    """
    Feature: water-quality-monitoring-system, Property 4:
    For any input, risk score is in [0.0, 1.0]
    """
    features = {
        'ph': ph,
        'turbidity': turbidity,
        'temperature': temperature,
        'tds': tds,
        'dissolved_oxygen': dissolved_oxygen
    }
    
    risk_score = ml_service.predict_contamination_risk(features, historical_data=[])
    
    assert 0.0 <= risk_score <= 1.0

# Property 5: Risk Level Classification Consistency
@given(risk_score=st.floats(min_value=0.0, max_value=1.0))
def test_risk_level_classification_thresholds(risk_score):
    """
    Feature: water-quality-monitoring-system, Property 5:
    Risk level classification follows threshold rules
    """
    risk_level = classify_risk_level(risk_score)
    
    if risk_score < 0.4:
        assert risk_level == "Low"
    elif risk_score < 0.7:
        assert risk_level == "Medium"
    else:
        assert risk_level == "High"

# Property 10: Serialization Round-Trip
@given(
    device_id=st.text(min_size=1, max_size=50),
    ph=st.floats(min_value=0, max_value=14),
    turbidity=st.floats(min_value=0, max_value=3000),
    temperature=st.floats(min_value=-55, max_value=125),
    tds=st.floats(min_value=0, max_value=1000),
    dissolved_oxygen=st.floats(min_value=0, max_value=20)
)
def test_sensor_data_serialization_round_trip(device_id, ph, turbidity, temperature, tds, dissolved_oxygen):
    """
    Feature: water-quality-monitoring-system, Property 10:
    Serialization round-trip produces equivalent representation
    """
    from datetime import datetime
    
    original = SensorDataRequest(
        device_id=device_id,
        timestamp=datetime.utcnow(),
        ph=ph,
        turbidity=turbidity,
        temperature=temperature,
        tds=tds,
        dissolved_oxygen=dissolved_oxygen
    )
    
    # Serialize to JSON
    json_str1 = original.model_dump_json()
    
    # Parse back to object
    parsed = SensorDataRequest.model_validate_json(json_str1)
    
    # Serialize again
    json_str2 = parsed.model_dump_json()
    
    # Should be equivalent
    assert json_str1 == json_str2
```

### Unit Testing

**Scope**: Individual functions, classes, and modules

**Framework**: pytest

**Coverage Target**: 80% code coverage minimum

**Key Areas**:
- Data validation logic
- Risk level classification
- SHAP value ranking
- Error handling functions
- Authentication and authorization
- Notification formatting

**Example**:
```python
# tests/unit/test_ml_service.py
def test_classification_returns_exactly_one_result():
    """Test that classifier returns exactly one classification"""
    features = {'ph': 7.0, 'turbidity': 10, 'temperature': 25, 'tds': 150, 'dissolved_oxygen': 8}
    
    classification, confidence = ml_service.classify_water_quality(features)
    
    assert classification in ['Safe', 'Warning', 'Unsafe']
    assert isinstance(confidence, float)
    assert 0.0 <= confidence <= 1.0

def test_sensor_failure_handling():
    """Test that system continues when sensor fails"""
    # Simulate pH sensor failure
    with patch('sensor_module.read_ph', side_effect=SensorException("pH sensor timeout")):
        reading = sensor_module.acquire_sensor_data()
        
        # Should have NaN for pH but other sensors should work
        assert math.isnan(reading.ph)
        assert not math.isnan(reading.turbidity)
        assert not math.isnan(reading.temperature)
```

### Integration Testing

**Scope**: Component interactions, database operations, ML model inference, API endpoints

**Framework**: pytest with pytest-asyncio

**Key Areas**:
- API endpoint workflows (sensor data ingestion → ML inference → persistence)
- Database CRUD operations
- ML model loading and inference
- FCM notification sending
- Authentication flows

**Example**:
```python
# tests/integration/test_sensor_data_flow.py
@pytest.mark.asyncio
async def test_sensor_data_ingestion_complete_flow():
    """Test complete flow from sensor data to database persistence"""
    # Arrange
    sensor_data = {
        "device_id": "TEST_ESP32",
        "timestamp": datetime.utcnow().isoformat(),
        "ph": 7.2,
        "turbidity": 15.5,
        "temperature": 25.3,
        "tds": 150,
        "dissolved_oxygen": 8.5
    }
    
    # Act
    async with AsyncClient(app=app, base_url="http://test") as client:
        response = await client.post("/api/v1/sensor-data", json=sensor_data)
    
    # Assert
    assert response.status_code == 200
    result = response.json()
    
    # Verify classification was performed
    assert "classification" in result
    assert result["classification"]["quality"] in ["Safe", "Warning", "Unsafe"]
    
    # Verify risk prediction was performed
    assert "risk_prediction" in result
    assert 0.0 <= result["risk_prediction"]["risk_score"] <= 1.0
    
    # Verify data was persisted
    reading_id = result["reading_id"]
    db_record = await db.sensor_readings.find_one({"_id": ObjectId(reading_id)})
    assert db_record is not None
    assert db_record["parameters"]["ph"] == 7.2
```

### End-to-End Testing

**Scope**: Complete user workflows from mobile app through backend to database

**Framework**: Detox (React Native E2E testing)

**Key Workflows**:
- User login → View dashboard → See current water quality
- Receive notification → Open app → View details
- View historical data → Select time range → See charts
- Admin configuration → Update thresholds → Verify applied

**Example**:
```javascript
// e2e/dashboard.test.js
describe('Dashboard Screen', () => {
  beforeAll(async () => {
    await device.launchApp();
    await login('test@example.com', 'password');
  });

  it('should display current water quality status', async () => {
    await expect(element(by.id('water-quality-card'))).toBeVisible();
    await expect(element(by.id('quality-classification'))).toHaveText('Safe');
    await expect(element(by.id('risk-indicator'))).toBeVisible();
  });

  it('should refresh data on pull-to-refresh', async () => {
    await element(by.id('dashboard-scroll')).swipe('down', 'fast');
    await waitFor(element(by.id('loading-indicator')))
      .not.toBeVisible()
      .withTimeout(5000);
    await expect(element(by.id('water-quality-card'))).toBeVisible();
  });
});
```

### Performance Testing

**Scope**: ML inference time, API response time, database query performance

**Tools**: pytest-benchmark, locust (load testing)

**Performance Requirements**:
- ML inference < 500ms (Requirements 3.1, 4.1)
- SHAP computation < 1s (Requirements 5.1, 5.2)
- API response < 2s (Requirement 6.1)
- End-to-end latency < 5s (Non-functional requirement)

**Example**:
```python
# tests/performance/test_ml_performance.py
def test_classification_performance(benchmark):
    """Test that classification completes within 500ms"""
    features = {'ph': 7.0, 'turbidity': 10, 'temperature': 25, 'tds': 150, 'dissolved_oxygen': 8}
    
    result = benchmark(ml_service.classify_water_quality, features)
    
    # Benchmark automatically measures execution time
    assert benchmark.stats['mean'] < 0.5  # 500ms

def test_concurrent_requests_performance():
    """Test system handles 50 concurrent requests"""
    import concurrent.futures
    
    def make_request():
        response = requests.post(
            'http://localhost:8000/api/v1/sensor-data',
            json=generate_sensor_data()
        )
        return response.elapsed.total_seconds()
    
    with concurrent.futures.ThreadPoolExecutor(max_workers=50) as executor:
        futures = [executor.submit(make_request) for _ in range(50)]
        response_times = [f.result() for f in futures]
    
    # All requests should complete within 5 seconds
    assert all(t < 5.0 for t in response_times)
    # Average response time should be under 2 seconds
    assert sum(response_times) / len(response_times) < 2.0
```

### Test Data Management

**Training Data**:
- Collect real sensor data during development phase
- Use WHO water quality standards to label data
- Augment with synthetic data for edge cases
- Minimum 1000 samples for training, 200 for testing

**Test Fixtures**:
```python
# tests/conftest.py
@pytest.fixture
def sample_sensor_reading():
    return {
        'device_id': 'TEST_001',
        'timestamp': datetime.utcnow(),
        'ph': 7.2,
        'turbidity': 15.5,
        'temperature': 25.3,
        'tds': 150,
        'dissolved_oxygen': 8.5
    }

@pytest.fixture
def mock_ml_models():
    """Mock ML models for testing without loading actual models"""
    with patch('app.services.ml_service.MLService') as mock:
        mock.classify_water_quality.return_value = ('Safe', 0.95)
        mock.predict_contamination_risk.return_value = 0.2
        yield mock
```

### Continuous Integration

**CI Pipeline** (GitHub Actions / GitLab CI):
```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mongodb:
        image: mongo:6.0
        ports:
          - 27017:27017
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Set up Python
        uses: actions/setup-python@v2
        with:
          python-version: '3.9'
      
      - name: Install dependencies
        run: |
          pip install -r requirements.txt
          pip install pytest pytest-cov hypothesis pytest-asyncio
      
      - name: Run unit tests
        run: pytest tests/unit --cov=app --cov-report=xml
      
      - name: Run property-based tests
        run: pytest tests/property_tests -v
      
      - name: Run integration tests
        run: pytest tests/integration
        env:
          MONGODB_URL: mongodb://localhost:27017
      
      - name: Upload coverage
        uses: codecov/codecov-action@v2
```

### Testing Timeline (16-week project)

- **Weeks 1-4**: Unit tests developed alongside core backend logic
- **Weeks 5-8**: Property-based tests for validation and serialization
- **Weeks 9-12**: Integration tests for API endpoints and ML pipeline
- **Weeks 13-14**: End-to-end tests for mobile app workflows
- **Weeks 15-16**: Performance testing and optimization

## Summary

This design document provides a comprehensive technical blueprint for the Water Quality Monitoring System. The architecture follows a three-tier design with clear separation of concerns:

- **Sensor Layer**: ESP32-based hardware with robust error handling and buffering
- **Backend Layer**: FastAPI service with async operations, ML inference, and SHAP explainability
- **Presentation Layer**: React Native mobile app with real-time updates and push notifications

Key design decisions:
1. **Async Architecture**: Motor (async MongoDB driver) and FastAPI for high concurrency
2. **ML Model Management**: In-memory model loading with versioning support
3. **SHAP Integration**: TreeExplainer for fast explanations of tree-based models
4. **Security**: JWT authentication, bcrypt password hashing, HTTPS, rate limiting
5. **Scalability**: Stateless backend, connection pooling, caching, horizontal scaling
6. **Error Handling**: Graceful degradation, retry mechanisms, comprehensive logging
7. **Testing**: Property-based testing for core logic, comprehensive integration and E2E tests

The system is designed to be implementable within a 16-week academic timeline while maintaining production-quality standards for reliability, security, and performance.
