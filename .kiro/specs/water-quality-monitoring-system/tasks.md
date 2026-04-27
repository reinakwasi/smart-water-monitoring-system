# Implementation Plan: Water Quality Monitoring System

## Overview

This implementation plan breaks down the Water Quality Monitoring System into discrete, manageable coding tasks aligned with the 16-week academic project timeline. The system consists of three main components:

1. **Backend Service** (Python FastAPI): ML inference, SHAP explainability, REST API, MongoDB persistence
2. **ESP32 Sensor Module** (C++/Arduino): Sensor data acquisition, WiFi transmission, buffering
3. **Mobile Application** (React Native): Real-time monitoring, historical visualization, push notifications

The implementation follows an incremental approach where each task builds on previous work, with checkpoints to ensure quality and allow for user feedback.

## Tasks

### Phase 1: Backend Foundation

- [x] 1. Set up backend project structure and core dependencies
  - Create Python virtual environment and install FastAPI, Motor, Pydantic, pytest
  - Set up project directory structure (app/, ml/, tests/)
  - Create main.py with basic FastAPI application
  - Configure environment variables using pydantic-settings
  - Set up logging configuration with structured JSON logging
  - _Requirements: 18.5_

- [x] 2. Implement MongoDB connection and database models
  - [x] 2.1 Create MongoDB connection with Motor (async driver)
    - Implement connection pooling with configurable pool size
    - Add connection lifecycle management (startup/shutdown)
    - _Requirements: 11.1, 11.2, 18.5_
  
  - [x] 2.2 Define Pydantic schemas for API validation
    - Create SensorDataRequest, TankLevelRequest models with field validation
    - Create response models: ClassificationResult, RiskPredictionResult, SensorDataResponse
    - Add custom validators for sensor ranges (pH: 0-14, turbidity: 0-3000, etc.)
    - _Requirements: 15.1, 15.2, 15.7, 15.8, 1.1-1.5_
  
  - [ ]* 2.3 Write property test for sensor data validation
    - **Property 1: Sensor Reading Validation**
    - **Validates: Requirements 1.9**
    - Use Hypothesis to generate sensor readings with values inside and outside valid ranges
    - Verify validation accepts valid readings and rejects invalid ones
  
  - [ ]* 2.4 Write property test for serialization round-trip
    - **Property 10: Serialization Round-Trip Idempotence**
    - **Validates: Requirements 15.9**
    - Use Hypothesis to generate random SensorDataRequest objects
    - Verify serialize → parse → serialize produces equivalent JSON

- [x] 3. Implement authentication and authorization
  - [x] 3.1 Create JWT authentication service
    - Implement password hashing with bcrypt (cost factor ≥ 10)
    - Create JWT token generation with configurable expiration
    - Implement token validation and decoding
    - _Requirements: 17.1, 17.2, 17.3, 20.6_
  
  - [x] 3.2 Create user management endpoints
    - POST /api/v1/auth/register (create user account)
    - POST /api/v1/auth/login (authenticate and issue JWT)
    - POST /api/v1/auth/refresh (refresh JWT token)
    - _Requirements: 20.1, 20.2, 20.3_
  
  - [x] 3.3 Implement role-based access control (RBAC)
    - Create FastAPI dependencies for authentication (get_current_user)
    - Create admin-only dependency (require_admin)
    - Apply authentication to protected endpoints
    - _Requirements: 20.4, 20.5_
  
  - [ ]* 3.4 Write unit tests for authentication
    - Test password hashing and verification
    - Test JWT token creation and validation
    - Test RBAC enforcement (user vs admin access)
    - _Requirements: 17.1, 17.2, 17.3_

- [x] 4. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

### Phase 2: ML Model Training and Integration

- [x] 5. Prepare ML training pipeline
  - [x] 5.1 Create data preparation module
    - Implement DataPreparator class for loading CSV training data
    - Create feature extraction for classification (5 sensor parameters)
    - Create temporal feature extraction for risk prediction (current + mean/std/trend)
    - Implement train/test split with stratification
    - _Requirements: 12.1_
  
  - [x] 5.2 Implement Random Forest classifier training
    - Create ClassifierTrainer with hyperparameter tuning (GridSearchCV)
    - Train Random Forest with configurable parameters
    - Implement k-fold cross-validation (k=5)
    - Generate evaluation report (accuracy, precision, recall, F1, confusion matrix)
    - Save trained model with versioning and metadata
    - _Requirements: 12.2, 12.4, 12.6, 12.7, 12.8_
  
  - [x] 5.3 Implement XGBoost risk predictor training
    - Create RiskPredictorTrainer with hyperparameter tuning
    - Train XGBoost with temporal features
    - Implement k-fold cross-validation (k=5)
    - Generate evaluation report with AUC-ROC
    - Save trained model with versioning and metadata
    - _Requirements: 12.3, 12.5, 12.6, 12.7, 12.8_
  
  - [ ]* 5.4 Write unit tests for data preparation
    - Test feature extraction produces correct shape
    - Test temporal feature calculation (mean, std, trend)
    - Test train/test split maintains class balance
    - _Requirements: 12.1_

- [x] 6. Implement ML inference service
  - [x] 6.1 Create MLService for model inference
    - Load trained Random Forest classifier from disk
    - Load trained XGBoost predictor from disk
    - Implement classify_water_quality method (returns classification + confidence)
    - Implement predict_contamination_risk method (returns risk score 0.0-1.0)
    - Add model version management and loading
    - _Requirements: 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 12.9_
  
  - [ ]* 6.2 Write property test for classification uniqueness
    - **Property 2: Classification Uniqueness**
    - **Validates: Requirements 3.2**
    - Use Hypothesis to generate valid sensor readings
    - Verify classifier returns exactly one classification (Safe, Warning, or Unsafe)
  
  - [ ]* 6.3 Write property test for risk score range
    - **Property 4: Risk Score Range Invariant**
    - **Validates: Requirements 4.2**
    - Use Hypothesis to generate sensor readings (valid and edge cases)
    - Verify risk score is always in range [0.0, 1.0]
  
  - [ ]* 6.4 Write property test for risk level classification
    - **Property 5: Risk Level Classification Consistency**
    - **Validates: Requirements 4.6, 4.7, 4.8**
    - Use Hypothesis to generate risk scores in [0.0, 1.0]
    - Verify risk level follows threshold rules (Low < 0.4, Medium < 0.7, High ≥ 0.7)

- [x] 7. Implement SHAP explainability engine
  - [x] 7.1 Create SHAPService for model explanations
    - Initialize TreeExplainer for Random Forest classifier
    - Initialize TreeExplainer for XGBoost predictor
    - Implement explain_classification method (returns SHAP values per feature)
    - Implement explain_risk_prediction method (includes temporal features)
    - Implement get_top_features method (rank by absolute SHAP value)
    - _Requirements: 5.1, 5.2, 5.3_
  
  - [ ]* 7.2 Write property test for SHAP value ranking
    - **Property 6: SHAP Value Ranking**
    - **Validates: Requirements 5.3**
    - Generate random SHAP value dictionaries
    - Verify features are ranked by descending absolute value
  
  - [ ]* 7.3 Write property test for SHAP response format
    - **Property 7: SHAP Response Format**
    - **Validates: Requirements 5.4, 5.5**
    - Verify response includes SHAP values dictionary and top_factors array
    - Verify top_factors have feature, shap_value, and direction fields
  
  - [ ]* 7.4 Write property test for SHAP value sum approximation
    - **Property 8: SHAP Value Sum Approximation**
    - **Validates: Requirements 5.6**
    - Verify sum of SHAP values approximates model output within ±0.1 tolerance

- [x] 8. Checkpoint - Ensure ML pipeline works end-to-end
  - Ensure all tests pass, ask the user if questions arise.

### Phase 3: Backend API Endpoints

- [x] 9. Implement sensor data ingestion endpoints
  - [x] 9.1 Create POST /api/v1/sensor-data endpoint
    - Accept SensorDataRequest payload from ESP32
    - Validate sensor data using Pydantic model
    - Call MLService for classification and risk prediction
    - Call SHAPService for explanations
    - Persist reading + predictions to MongoDB
    - Return SensorDataResponse with classification, risk, and SHAP values
    - _Requirements: 1.7, 3.1, 4.1, 5.1, 5.2, 11.1, 11.3_
  
  - [x] 9.2 Create POST /api/v1/tank-level endpoint
    - Accept TankLevelRequest payload from ESP32
    - Calculate tank level percentage and volume
    - Classify tank status (Empty, Half_Full, Full, Overflow)
    - Persist tank reading to MongoDB
    - Return tank status response
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 11.2_
  
  - [ ]* 9.3 Write property test for data persistence with timestamp
    - **Property 3: Data Persistence with Timestamp**
    - **Validates: Requirements 3.7, 4.5**
    - Verify all persisted documents include valid ISO8601 timestamp
  
  - [ ]* 9.4 Write integration test for sensor data flow
    - Test complete flow: POST sensor data → ML inference → SHAP → persistence
    - Verify response includes classification, risk, and SHAP values
    - Verify data is persisted to MongoDB with correct structure
    - _Requirements: 1.7, 3.1, 4.1, 5.1, 11.1, 11.3_

- [x] 10. Implement status and historical data endpoints
  - [x] 10.1 Create GET /api/v1/current-status endpoint
    - Require JWT authentication
    - Query latest sensor reading and tank level from MongoDB
    - Return current water quality, risk, and tank status
    - Implement response caching (30 second TTL)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 17.1_
  
  - [x] 10.2 Create GET /api/v1/historical-data endpoint
    - Require JWT authentication
    - Accept query parameters: start_date, end_date, parameter, device_id, limit
    - Query MongoDB with date range filter and projection
    - Return historical readings with pagination
    - Optimize query with indexes
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7, 11.6, 11.7_
  
  - [ ]* 10.3 Write integration tests for status endpoints
    - Test current status returns latest data within 2 seconds
    - Test historical data filtering by date range
    - Test authentication enforcement (401 for missing token)
    - _Requirements: 6.1, 10.7, 17.1_

- [x] 11. Implement configuration and calibration endpoints (admin only)
  - [x] 11.1 Create GET /api/v1/config endpoint
    - Require admin authentication
    - Return current system configuration (thresholds, polling interval, tank dimensions)
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 20.4_
  
  - [x] 11.2 Create PUT /api/v1/config endpoint
    - Require admin authentication
    - Validate configuration values are within acceptable ranges
    - Persist updated configuration to MongoDB
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 20.4_
  
  - [x] 11.3 Create POST /api/v1/calibration endpoint
    - Require admin authentication
    - Accept device_id, sensor_type, reference_value, current_reading
    - Calculate calibration offset
    - Store calibration data in sensor_devices collection
    - _Requirements: 13.1, 13.2, 13.3, 13.6, 20.4_
  
  - [ ]* 11.4 Write unit tests for configuration validation
    - Test configuration value range validation
    - Test admin-only access enforcement
    - _Requirements: 14.5, 20.4_

- [x] 12. Implement notification service
  - [x] 12.1 Create NotificationService for Firebase Cloud Messaging
    - Implement FCM notification sending with retry logic
    - Implement notification throttling (1 hour cooldown per notification type)
    - Create send_quality_change_notification method
    - Create send_risk_change_notification method
    - Create send_tank_notification method
    - Handle FCM errors and invalid tokens
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  
  - [x] 12.2 Integrate notifications into sensor data endpoint
    - Detect water quality classification changes
    - Detect contamination risk level changes
    - Detect tank status changes
    - Trigger appropriate notifications via NotificationService
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_
  
  - [ ]* 12.3 Write unit tests for notification logic
    - Test notification throttling (no duplicate notifications within 1 hour)
    - Test notification message formatting
    - Test FCM error handling and retry logic
    - _Requirements: 8.7, 9.6, 16.6_

- [x] 13. Implement health check and error handling
  - [x] 13.1 Create GET /api/v1/health endpoint
    - Check MongoDB connection status and latency
    - Check ML models loaded status and versions
    - Check notification service status
    - Report sensor device online/offline status
    - Return overall system health (healthy/degraded/unhealthy)
    - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6_
  
  - [x] 13.2 Implement global error handling middleware
    - Handle database connection failures (return 503)
    - Handle validation errors (return 400 with descriptive message)
    - Handle authentication errors (return 401)
    - Handle authorization errors (return 403)
    - Log all errors with timestamp, component, and context
    - _Requirements: 16.3, 16.4, 16.5, 16.7, 16.8_
  
  - [ ]* 13.3 Write integration tests for error handling
    - Test database unavailable scenario (503 response)
    - Test invalid JSON payload (400 response)
    - Test expired JWT token (401 response)
    - _Requirements: 16.3, 16.7_

- [x] 14. Implement rate limiting and security hardening
  - [x] 14.1 Add rate limiting middleware
    - Implement rate limiter (100 requests per minute per IP)
    - Return 429 status when rate limit exceeded
    - _Requirements: 17.7_
  
  - [x] 14.2 Configure HTTPS/TLS for production
    - Configure uvicorn with SSL certificates
    - Enforce HTTPS for all API endpoints
    - _Requirements: 17.5_
  
  - [ ]* 14.3 Write security tests
    - Test rate limiting enforcement
    - Test HTTPS enforcement
    - Test JWT token expiration
    - _Requirements: 17.5, 17.7_

- [x] 15. Checkpoint - Backend API complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 4: ESP32 Sensor Module

- [x] 16. Set up ESP32 development environment
  - Install Arduino IDE or PlatformIO
  - Install ESP32 board support package
  - Install required libraries (WiFi, HTTPClient, ArduinoJson, OneWire, DallasTemperature)
  - Create project structure with main sketch and sensor modules
  - _Requirements: 1.1-1.5_

- [x] 17. Implement sensor reading functions
  - [x] 17.1 Create sensor initialization and calibration
    - Initialize all sensor pins (analog and digital)
    - Load calibration offsets from EEPROM
    - Implement sensor health check on startup
    - _Requirements: 1.1-1.5, 13.3, 13.4, 13.5_
  
  - [x] 17.2 Implement individual sensor read functions
    - Implement readPH() with analog-to-pH conversion
    - Implement readTurbidity() with analog-to-NTU conversion
    - Implement readTemperature() using DS18B20 digital sensor
    - Implement readTDS() with analog-to-ppm conversion
    - Implement readDO() (dissolved oxygen) with analog-to-mg/L conversion
    - Implement readUltrasonic() for tank level measurement
    - Apply calibration offsets to all readings
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 2.1, 13.3_
  
  - [x] 17.3 Implement sensor data acquisition with validation
    - Create acquireSensorData() function to read all sensors
    - Validate each reading is within physical sensor range
    - Handle sensor failures gracefully (log error, continue with remaining sensors)
    - Mark failed sensor readings as NaN
    - _Requirements: 1.6, 1.8, 1.9, 16.1_

- [x] 18. Implement WiFi and HTTP communication
  - [x] 18.1 Create WiFi connection manager
    - Implement WiFi connection with retry logic
    - Handle WiFi disconnection and reconnection
    - Store WiFi credentials in EEPROM or config file
    - _Requirements: 1.7, 16.1_
  
  - [x] 18.2 Implement HTTP client for backend communication
    - Create transmitReading() function to POST sensor data to backend
    - Create transmitTankLevel() function to POST tank level to backend
    - Implement exponential backoff retry (1s, 2s, 4s)
    - Handle HTTP errors (4xx, 5xx) appropriately
    - _Requirements: 1.7, 16.1_
  
  - [x] 18.3 Implement reading buffer for offline operation
    - Create circular buffer to store up to 100 readings in SPIFFS
    - Buffer readings when network is unavailable
    - Transmit buffered readings when connectivity restored
    - _Requirements: 16.1, 16.2_

- [x] 19. Implement main sensor loop
  - [x] 19.1 Create main loop with 30-second polling interval
    - Implement timer-based sensor polling (every 30 seconds)
    - Acquire sensor data and tank level
    - Transmit to backend if connected, otherwise buffer
    - Handle configuration updates from backend
    - _Requirements: 1.7, 2.2, 14.7_
  
  - [ ]* 19.2 Test ESP32 firmware on hardware
    - Test sensor readings are accurate (compare to reference values)
    - Test WiFi connection and reconnection
    - Test HTTP transmission to backend
    - Test offline buffering and recovery
    - _Requirements: 1.1-1.9, 2.1, 16.1, 16.2_

- [x] 20. Checkpoint - ESP32 firmware complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 5: React Native Mobile Application

- [ ] 21. Set up React Native project
  - Initialize React Native project with TypeScript
  - Install dependencies (React Navigation, Victory Native, Firebase, Axios, AsyncStorage)
  - Configure Firebase Cloud Messaging for push notifications
  - Set up project structure (screens, components, services, context)
  - _Requirements: 6.1_

- [ ] 22. Implement authentication screens
  - [ ] 22.1 Create login screen
    - Create login form with email and password inputs
    - Implement form validation
    - Call POST /api/v1/auth/login endpoint
    - Store JWT token in AsyncStorage securely
    - Navigate to dashboard on successful login
    - _Requirements: 20.2, 17.4_
  
  - [ ] 22.2 Create registration screen
    - Create registration form with email, password, full_name inputs
    - Implement form validation (email format, password min 8 chars)
    - Call POST /api/v1/auth/register endpoint
    - Navigate to login screen on successful registration
    - _Requirements: 20.1_
  
  - [ ] 22.3 Create authentication context
    - Implement AuthContext for global auth state
    - Implement login, logout, and token refresh functions
    - Implement automatic token refresh before expiration
    - _Requirements: 17.4_

- [ ] 23. Implement dashboard screen
  - [ ] 23.1 Create water quality card component
    - Display current classification (Safe/Warning/Unsafe) with color coding
    - Display confidence score
    - Display all 5 sensor parameters with current values
    - Display timestamp of last reading
    - _Requirements: 6.1, 6.2, 6.4, 6.6, 6.7_
  
  - [ ] 23.2 Create risk indicator component
    - Display contamination risk score and level (Low/Medium/High)
    - Display top 3 contributing factors from SHAP explanation
    - Use color coding for risk levels
    - _Requirements: 6.2, 7.3_
  
  - [ ] 23.3 Create tank level gauge component
    - Display tank status (Empty/Half_Full/Full/Overflow)
    - Display level percentage with visual gauge
    - Display volume in liters
    - _Requirements: 6.3_
  
  - [ ] 23.4 Implement dashboard data fetching
    - Call GET /api/v1/current-status on screen load
    - Implement pull-to-refresh functionality
    - Implement auto-refresh every 30 seconds
    - Handle network errors and display cached data with offline indicator
    - _Requirements: 6.1, 6.2, 6.3, 6.5, 6.8_

- [ ] 24. Implement SHAP explanation screen
  - [ ] 24.1 Create SHAP chart component
    - Display bar chart of SHAP values using Victory Native
    - Sort features by absolute SHAP value (top 5)
    - Color bars: red for positive (increasing risk), green for negative (decreasing risk)
    - Display legend explaining colors
    - _Requirements: 7.1, 7.2, 7.5, 7.6_
  
  - [ ] 24.2 Create feature detail view
    - Display current value and safe range when user taps feature
    - Show feature name, SHAP value, and direction
    - _Requirements: 7.7_
  
  - [ ] 24.3 Implement explanation data fetching
    - Fetch SHAP explanations from current status endpoint
    - Display separate charts for classification and risk prediction
    - _Requirements: 7.1, 7.2_

- [ ] 25. Implement historical data screen
  - [ ] 25.1 Create time range selector component
    - Allow user to select 24h, 7d, or 30d time range
    - Update charts when time range changes
    - _Requirements: 10.3_
  
  - [ ] 25.2 Create trend chart components
    - Create line charts for each parameter (pH, turbidity, temperature, TDS, DO)
    - Display classification labels on timeline
    - Display risk predictions on timeline
    - Allow user to tap point for detailed readings
    - _Requirements: 10.1, 10.2, 10.4, 10.5, 10.6_
  
  - [ ] 25.3 Implement historical data fetching
    - Call GET /api/v1/historical-data with date range
    - Handle loading state and errors
    - Cache data for offline viewing
    - _Requirements: 10.7_

- [ ] 26. Implement push notifications
  - [ ] 26.1 Set up Firebase Cloud Messaging
    - Request notification permissions on app launch
    - Register device token with backend
    - Store FCM token in user profile
    - _Requirements: 8.1, 9.1_
  
  - [ ] 26.2 Implement notification handlers
    - Handle foreground notifications (display in-app alert)
    - Handle background notifications (system notification)
    - Handle notification tap (navigate to relevant screen)
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 9.1, 9.2, 9.3_
  
  - [ ]* 26.3 Test push notifications end-to-end
    - Test water quality change notification
    - Test risk alert notification
    - Test tank level notification
    - Test notification navigation
    - _Requirements: 8.1-8.7, 9.1-9.6_

- [ ] 27. Implement settings and configuration screens
  - [ ] 27.1 Create settings screen
    - Display user profile information
    - Display system health status
    - Implement logout functionality
    - Display notification preferences
    - _Requirements: 19.7_
  
  - [ ] 27.2 Create configuration screen (admin only)
    - Display current system configuration
    - Allow admin to update thresholds and polling interval
    - Call PUT /api/v1/config endpoint
    - Implement calibration wizard for sensor calibration
    - _Requirements: 13.7, 14.8_
  
  - [ ]* 27.3 Write E2E tests for mobile app
    - Test login flow
    - Test dashboard display and refresh
    - Test historical data visualization
    - Test notification handling
    - _Requirements: 6.1, 10.1_

- [ ] 28. Checkpoint - Mobile app complete
  - Ensure all tests pass, ask the user if questions arise.

### Phase 6: Integration, Testing, and Deployment

- [ ] 29. Perform end-to-end integration testing
  - [ ] 29.1 Test complete sensor-to-mobile flow
    - ESP32 sends sensor data → Backend processes → Mobile displays
    - Verify end-to-end latency < 5 seconds
    - Test with multiple concurrent ESP32 devices
    - _Requirements: 18.1, 18.2_
  
  - [ ] 29.2 Test notification flow
    - Trigger quality change → Backend sends notification → Mobile receives
    - Verify notification delivery within 5 seconds
    - Test notification throttling
    - _Requirements: 8.1, 8.2, 8.7_
  
  - [ ]* 29.3 Write integration tests for complete workflows
    - Test user registration → login → view dashboard
    - Test sensor data ingestion → ML inference → persistence → mobile display
    - Test admin configuration update → ESP32 receives new settings
    - _Requirements: 20.1, 20.2, 6.1, 14.7_

- [ ] 30. Perform performance testing
  - [ ] 30.1 Test ML inference performance
    - Verify classification completes within 500ms
    - Verify risk prediction completes within 500ms
    - Verify SHAP computation completes within 1 second
    - _Requirements: 3.1, 4.1, 5.1, 5.2_
  
  - [ ] 30.2 Test API response time
    - Verify current status endpoint responds within 2 seconds
    - Verify historical data endpoint responds within 3 seconds
    - Test with 50 concurrent requests
    - _Requirements: 6.1, 10.7, 18.1_
  
  - [ ] 30.3 Test database performance
    - Verify queries complete within 5 seconds for 30-day range
    - Test with 1 million sensor reading records
    - Verify indexes are used for queries
    - _Requirements: 11.7, 18.3_

- [ ] 31. Set up deployment infrastructure
  - [ ] 31.1 Create Docker containers
    - Create Dockerfile for backend service
    - Create docker-compose.yml for development environment
    - Test containerized deployment locally
  
  - [ ] 31.2 Deploy to cloud platform
    - Choose deployment platform (Heroku, DigitalOcean, AWS, or local server)
    - Set up MongoDB Atlas or managed MongoDB instance
    - Deploy backend service with environment variables
    - Configure HTTPS with SSL certificates
    - Set up monitoring and logging
    - _Requirements: 17.5_
  
  - [ ] 31.3 Build and distribute mobile app
    - Build Android APK for testing
    - Build iOS app for testing (if applicable)
    - Test mobile app against production backend
    - Distribute to test users

- [ ] 32. Create documentation
  - [ ] 32.1 Write API documentation
    - Document all API endpoints with request/response examples
    - Create Postman collection for API testing
    - Document authentication flow
  
  - [ ] 32.2 Write deployment guide
    - Document backend deployment steps
    - Document ESP32 firmware flashing steps
    - Document mobile app installation steps
    - Document environment variable configuration
  
  - [ ] 32.3 Write user guide
    - Document mobile app usage (login, dashboard, historical data)
    - Document admin configuration and calibration
    - Document troubleshooting common issues

- [ ] 33. Final checkpoint - System complete
  - Ensure all tests pass, ask the user if questions arise.
  - Verify all requirements are implemented
  - Verify system meets performance targets
  - Prepare for final demonstration

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP delivery
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation and allow for user feedback
- Property-based tests validate universal correctness properties using Hypothesis
- Unit tests validate specific examples and edge cases
- Integration tests validate component interactions and end-to-end workflows
- The implementation follows a bottom-up approach: backend foundation → ML pipeline → API endpoints → ESP32 firmware → mobile app → integration
- Estimated timeline: Weeks 1-4 (Backend), Weeks 5-8 (ML + API), Weeks 9-11 (ESP32), Weeks 12-14 (Mobile), Weeks 15-16 (Integration + Deployment)
