# Requirements Document: Water Quality Monitoring System

## Introduction

The Water Quality Monitoring System is an intelligent IoT-based solution that provides real-time water quality classification, contamination risk prediction, and smart tank level monitoring for household and small-scale water management. The system combines sensor data acquisition, machine learning models (Random Forest and XGBoost), explainable AI (SHAP), and a React Native mobile application to deliver actionable insights and prevent water-related issues such as contamination and tank overflow.

## Glossary

- **System**: The complete Water Quality Monitoring System including sensors, microcontroller, backend, ML models, and mobile application
- **Sensor_Module**: The ESP32-based hardware component with attached water quality and tank level sensors
- **Mobile_App**: The React Native mobile application for end-user interaction
- **Backend_Service**: The Python FastAPI service that processes sensor data and serves predictions
- **ML_Classifier**: The Random Forest model that classifies water quality into Safe, Warning, or Unsafe categories
- **Risk_Predictor**: The XGBoost model that predicts contamination risk levels
- **Explainability_Engine**: The SHAP-based component that provides interpretable explanations for ML predictions
- **Notification_Service**: The Firebase Cloud Messaging component that sends alerts to users
- **Data_Store**: The MongoDB database that persists sensor readings, predictions, and system state
- **Water_Quality_Reading**: A complete set of sensor measurements including pH, turbidity, temperature, TDS, and dissolved oxygen
- **Tank_Level_Reading**: Ultrasonic sensor measurement indicating current water level in the tank
- **Quality_Classification**: A categorical label (Safe, Warning, or Unsafe) assigned to water quality
- **Contamination_Risk**: A numerical or categorical prediction of future contamination likelihood
- **Safe_Water**: Water quality classification indicating parameters are within acceptable ranges
- **Warning_Water**: Water quality classification indicating parameters are approaching unsafe thresholds
- **Unsafe_Water**: Water quality classification indicating parameters exceed safe thresholds
- **Tank_Status**: Current state of water tank (Empty, Half_Full, Full, Overflow)
- **Sensor_Calibration**: Process of adjusting sensor readings to match known reference values
- **Model_Inference**: The process of generating predictions from trained ML models
- **SHAP_Value**: A numerical contribution score indicating how each feature influences a prediction
- **Notification_Event**: A condition that triggers an alert to be sent to the Mobile_App
- **User**: The end-user who monitors water quality through the Mobile_App
- **Administrator**: A privileged user who can configure system parameters and thresholds

## Requirements

### Requirement 1: Sensor Data Acquisition

**User Story:** As a User, I want the system to continuously collect water quality measurements from sensors, so that I can monitor water conditions in real-time.

#### Acceptance Criteria

1. THE Sensor_Module SHALL measure pH levels with a precision of ±0.1 pH units
2. THE Sensor_Module SHALL measure turbidity with a precision of ±5 NTU
3. THE Sensor_Module SHALL measure temperature with a precision of ±0.5°C
4. THE Sensor_Module SHALL measure TDS (Total Dissolved Solids) with a precision of ±10 ppm
5. THE Sensor_Module SHALL measure dissolved oxygen with a precision of ±0.2 mg/L
6. WHEN a sensor reading is requested, THE Sensor_Module SHALL complete the measurement within 2 seconds
7. THE Sensor_Module SHALL transmit Water_Quality_Reading to the Backend_Service every 30 seconds
8. IF a sensor fails to provide a reading, THEN THE Sensor_Module SHALL log the failure and continue with remaining sensors
9. THE Sensor_Module SHALL validate that each sensor reading falls within the sensor's physical measurement range before transmission

### Requirement 2: Tank Level Monitoring

**User Story:** As a User, I want the system to monitor my water tank level, so that I can prevent overflow and know when the tank needs refilling.

#### Acceptance Criteria

1. THE Sensor_Module SHALL measure tank water level using an ultrasonic sensor with a precision of ±2 cm
2. THE Sensor_Module SHALL transmit Tank_Level_Reading to the Backend_Service every 30 seconds
3. WHEN the tank level reaches 90% capacity, THE System SHALL classify Tank_Status as Full
4. WHEN the tank level reaches 50% capacity, THE System SHALL classify Tank_Status as Half_Full
5. WHEN the tank level falls below 10% capacity, THE System SHALL classify Tank_Status as Empty
6. WHEN the tank level exceeds 95% capacity, THE System SHALL classify Tank_Status as Overflow
7. THE System SHALL calculate tank volume percentage based on Tank_Level_Reading and configured tank dimensions

### Requirement 3: Water Quality Classification

**User Story:** As a User, I want the system to classify my water quality as Safe, Warning, or Unsafe, so that I can make informed decisions about water usage.

#### Acceptance Criteria

1. WHEN a Water_Quality_Reading is received, THE ML_Classifier SHALL classify the water quality within 500 milliseconds
2. THE ML_Classifier SHALL output exactly one Quality_Classification per Water_Quality_Reading
3. THE ML_Classifier SHALL use all five sensor parameters (pH, turbidity, temperature, TDS, dissolved oxygen) as input features
4. THE ML_Classifier SHALL classify water as Safe_Water when all parameters are within WHO-recommended safe ranges
5. THE ML_Classifier SHALL classify water as Unsafe_Water when any parameter exceeds critical safety thresholds
6. THE ML_Classifier SHALL classify water as Warning_Water when parameters approach but do not exceed critical thresholds
7. THE Backend_Service SHALL persist each Quality_Classification with timestamp to the Data_Store

### Requirement 4: Contamination Risk Prediction

**User Story:** As a User, I want the system to predict future contamination risk, so that I can take preventive action before water becomes unsafe.

#### Acceptance Criteria

1. WHEN a Water_Quality_Reading is received, THE Risk_Predictor SHALL generate a Contamination_Risk prediction within 500 milliseconds
2. THE Risk_Predictor SHALL output a risk score between 0.0 (no risk) and 1.0 (high risk)
3. THE Risk_Predictor SHALL use current and historical Water_Quality_Reading data as input features
4. THE Risk_Predictor SHALL consider temporal trends in sensor readings when generating predictions
5. THE Backend_Service SHALL persist each Contamination_Risk prediction with timestamp to the Data_Store
6. WHEN the Contamination_Risk score exceeds 0.7, THE System SHALL classify the risk as High
7. WHEN the Contamination_Risk score is between 0.4 and 0.7, THE System SHALL classify the risk as Medium
8. WHEN the Contamination_Risk score is below 0.4, THE System SHALL classify the risk as Low

### Requirement 5: Explainable AI Integration

**User Story:** As a User, I want to understand why the system made a particular classification or prediction, so that I can trust the AI decisions and take appropriate action.

#### Acceptance Criteria

1. WHEN a Quality_Classification is generated, THE Explainability_Engine SHALL compute SHAP_Value contributions for each input feature within 1 second
2. WHEN a Contamination_Risk prediction is generated, THE Explainability_Engine SHALL compute SHAP_Value contributions for each input feature within 1 second
3. THE Explainability_Engine SHALL rank features by absolute SHAP_Value magnitude to identify the most influential parameters
4. THE Explainability_Engine SHALL provide SHAP_Value data in a format suitable for visualization in the Mobile_App
5. THE Backend_Service SHALL include SHAP_Value data in the response payload for classification and prediction requests
6. THE Explainability_Engine SHALL ensure that the sum of SHAP_Value contributions approximates the model's output

### Requirement 6: Real-Time Mobile Monitoring

**User Story:** As a User, I want to view current water quality and tank status on my mobile device, so that I can monitor my water system from anywhere.

#### Acceptance Criteria

1. THE Mobile_App SHALL display the most recent Quality_Classification within 2 seconds of opening the app
2. THE Mobile_App SHALL display the most recent Contamination_Risk prediction within 2 seconds of opening the app
3. THE Mobile_App SHALL display the current Tank_Status within 2 seconds of opening the app
4. THE Mobile_App SHALL display current values for all five water quality parameters (pH, turbidity, temperature, TDS, dissolved oxygen)
5. THE Mobile_App SHALL refresh displayed data automatically every 30 seconds when the app is in the foreground
6. THE Mobile_App SHALL display the timestamp of the most recent sensor reading
7. THE Mobile_App SHALL use color coding to indicate Safe_Water (green), Warning_Water (yellow), and Unsafe_Water (red)
8. WHEN network connectivity is unavailable, THE Mobile_App SHALL display the last cached data with a connectivity warning

### Requirement 7: SHAP Visualization

**User Story:** As a User, I want to see visual explanations of AI decisions in the mobile app, so that I can understand which water parameters are causing quality issues.

#### Acceptance Criteria

1. THE Mobile_App SHALL display a feature importance chart showing SHAP_Value contributions for the current Quality_Classification
2. THE Mobile_App SHALL display a feature importance chart showing SHAP_Value contributions for the current Contamination_Risk prediction
3. THE Mobile_App SHALL highlight the top 3 most influential features in the explanation view
4. THE Mobile_App SHALL use bar charts or waterfall plots to visualize SHAP_Value contributions
5. THE Mobile_App SHALL display positive SHAP_Value contributions (increasing risk/unsafe classification) in red
6. THE Mobile_App SHALL display negative SHAP_Value contributions (decreasing risk/safe classification) in green
7. WHEN a User taps on a feature in the explanation view, THE Mobile_App SHALL display the current value and safe range for that parameter

### Requirement 8: Intelligent Notifications for Water Quality

**User Story:** As a User, I want to receive notifications when water quality changes or contamination risk increases, so that I can respond quickly to water safety issues.

#### Acceptance Criteria

1. WHEN Quality_Classification changes from Safe_Water to Warning_Water, THE Notification_Service SHALL send a notification to the Mobile_App within 5 seconds
2. WHEN Quality_Classification changes from Warning_Water to Unsafe_Water, THE Notification_Service SHALL send a high-priority notification to the Mobile_App within 5 seconds
3. WHEN Quality_Classification changes from Unsafe_Water to Safe_Water, THE Notification_Service SHALL send a notification to the Mobile_App within 5 seconds
4. WHEN Contamination_Risk increases from Low to Medium or High, THE Notification_Service SHALL send a notification to the Mobile_App within 5 seconds
5. THE Notification_Service SHALL include the Quality_Classification and top contributing factor in the notification message
6. THE Notification_Service SHALL include actionable recommendations in the notification (e.g., "High turbidity detected - check water filter")
7. THE Notification_Service SHALL limit repeated notifications for the same condition to once per hour to avoid notification fatigue
8. WHERE the User has enabled notification preferences, THE Notification_Service SHALL respect user-configured notification settings

### Requirement 9: Intelligent Notifications for Tank Status

**User Story:** As a User, I want to receive notifications about tank level changes, so that I can prevent overflow and ensure continuous water availability.

#### Acceptance Criteria

1. WHEN Tank_Status changes to Overflow, THE Notification_Service SHALL send a high-priority notification to the Mobile_App within 5 seconds
2. WHEN Tank_Status changes to Full, THE Notification_Service SHALL send a notification to the Mobile_App within 5 seconds
3. WHEN Tank_Status changes to Empty, THE Notification_Service SHALL send a notification to the Mobile_App within 5 seconds
4. THE Notification_Service SHALL include the current tank level percentage in the notification message
5. THE Notification_Service SHALL include estimated time until overflow or empty based on historical fill/drain rates
6. THE Notification_Service SHALL limit repeated notifications for the same Tank_Status to once per hour

### Requirement 10: Historical Data Visualization

**User Story:** As a User, I want to view historical trends of water quality parameters and tank levels, so that I can identify patterns and recurring issues.

#### Acceptance Criteria

1. THE Mobile_App SHALL display line charts showing water quality parameter trends for the past 24 hours
2. THE Mobile_App SHALL display line charts showing tank level trends for the past 24 hours
3. THE Mobile_App SHALL allow the User to select different time ranges (24 hours, 7 days, 30 days)
4. THE Mobile_App SHALL display historical Quality_Classification labels on the timeline
5. THE Mobile_App SHALL display historical Contamination_Risk predictions on the timeline
6. WHEN a User taps on a point in the historical chart, THE Mobile_App SHALL display detailed readings for that timestamp
7. THE Mobile_App SHALL retrieve historical data from the Backend_Service within 3 seconds

### Requirement 11: Data Persistence and Retrieval

**User Story:** As a System Administrator, I want all sensor readings and predictions to be stored reliably, so that historical data is available for analysis and model retraining.

#### Acceptance Criteria

1. WHEN a Water_Quality_Reading is received, THE Backend_Service SHALL persist it to the Data_Store within 1 second
2. WHEN a Tank_Level_Reading is received, THE Backend_Service SHALL persist it to the Data_Store within 1 second
3. WHEN a Quality_Classification is generated, THE Backend_Service SHALL persist it with associated SHAP_Value data to the Data_Store within 1 second
4. WHEN a Contamination_Risk prediction is generated, THE Backend_Service SHALL persist it with associated SHAP_Value data to the Data_Store within 1 second
5. THE Data_Store SHALL retain all sensor readings and predictions for at least 90 days
6. THE Backend_Service SHALL provide an API endpoint to retrieve historical data filtered by date range and parameter type
7. THE Backend_Service SHALL return historical data queries within 5 seconds for date ranges up to 30 days

### Requirement 12: Model Training and Evaluation

**User Story:** As a System Administrator, I want to train and evaluate ML models using collected data, so that I can ensure prediction accuracy and improve model performance over time.

#### Acceptance Criteria

1. THE System SHALL provide a training pipeline that accepts labeled water quality datasets in CSV format
2. THE System SHALL train the ML_Classifier using the Random Forest algorithm with configurable hyperparameters
3. THE System SHALL train the Risk_Predictor using the XGBoost algorithm with configurable hyperparameters
4. THE System SHALL evaluate the ML_Classifier using accuracy, precision, recall, and F1-score metrics
5. THE System SHALL evaluate the Risk_Predictor using accuracy, precision, recall, and F1-score metrics
6. THE System SHALL perform k-fold cross-validation (k=5) during model evaluation
7. THE System SHALL persist trained model artifacts in a versioned format
8. THE System SHALL generate a model evaluation report including confusion matrix and performance metrics
9. THE System SHALL support loading different model versions for A/B testing

### Requirement 13: Sensor Calibration

**User Story:** As a System Administrator, I want to calibrate sensors against known reference values, so that sensor readings remain accurate over time.

#### Acceptance Criteria

1. WHERE calibration mode is enabled, THE Sensor_Module SHALL accept reference values for each sensor type
2. WHEN a reference value is provided, THE Sensor_Module SHALL compute a calibration offset by comparing the current reading to the reference value
3. THE Sensor_Module SHALL apply calibration offsets to all subsequent sensor readings
4. THE Sensor_Module SHALL persist calibration offsets to non-volatile memory
5. THE Sensor_Module SHALL restore calibration offsets after power cycle
6. THE Backend_Service SHALL provide an API endpoint to initiate sensor calibration remotely
7. THE Mobile_App SHALL provide a calibration wizard interface for Administrators

### Requirement 14: System Configuration

**User Story:** As an Administrator, I want to configure system parameters such as sensor polling intervals and notification thresholds, so that I can optimize the system for different deployment scenarios.

#### Acceptance Criteria

1. THE Backend_Service SHALL provide an API endpoint to update sensor polling interval (minimum 10 seconds, maximum 300 seconds)
2. THE Backend_Service SHALL provide an API endpoint to update Quality_Classification thresholds for each water parameter
3. THE Backend_Service SHALL provide an API endpoint to update Contamination_Risk threshold values
4. THE Backend_Service SHALL provide an API endpoint to update tank dimensions for volume calculation
5. THE Backend_Service SHALL validate that configuration values are within acceptable ranges before applying them
6. WHEN configuration is updated, THE Backend_Service SHALL persist the new configuration to the Data_Store
7. WHEN configuration is updated, THE Backend_Service SHALL notify the Sensor_Module to apply new settings within 10 seconds
8. THE Mobile_App SHALL provide a settings interface for Administrators to modify system configuration

### Requirement 15: API Data Parsing and Serialization

**User Story:** As a Developer, I want the system to parse and serialize data correctly between components, so that sensor readings and predictions are transmitted accurately.

#### Acceptance Criteria

1. THE Backend_Service SHALL parse incoming Water_Quality_Reading JSON payloads from the Sensor_Module
2. THE Backend_Service SHALL parse incoming Tank_Level_Reading JSON payloads from the Sensor_Module
3. THE Backend_Service SHALL serialize Quality_Classification responses as JSON for the Mobile_App
4. THE Backend_Service SHALL serialize Contamination_Risk predictions as JSON for the Mobile_App
5. THE Backend_Service SHALL serialize SHAP_Value explanations as JSON for the Mobile_App
6. WHEN invalid JSON is received, THE Backend_Service SHALL return a descriptive error message with HTTP status 400
7. THE Backend_Service SHALL validate that all required fields are present in incoming payloads
8. THE Backend_Service SHALL validate that field values match expected data types (number, string, boolean)
9. FOR ALL valid data objects, serializing then parsing then serializing SHALL produce an equivalent JSON representation (round-trip property)

### Requirement 16: Error Handling and Recovery

**User Story:** As a User, I want the system to handle errors gracefully and continue operating, so that temporary issues do not cause complete system failure.

#### Acceptance Criteria

1. IF the Sensor_Module loses network connectivity, THEN THE Sensor_Module SHALL buffer up to 100 readings in local memory
2. WHEN network connectivity is restored, THE Sensor_Module SHALL transmit buffered readings to the Backend_Service
3. IF the Backend_Service cannot reach the Data_Store, THEN THE Backend_Service SHALL return an error response with HTTP status 503
4. IF the ML_Classifier fails to generate a prediction, THEN THE Backend_Service SHALL log the error and return the last known Quality_Classification
5. IF the Risk_Predictor fails to generate a prediction, THEN THE Backend_Service SHALL log the error and return a default risk level of Medium
6. IF the Notification_Service fails to send a notification, THEN THE System SHALL retry up to 3 times with exponential backoff
7. THE Mobile_App SHALL display user-friendly error messages when the Backend_Service is unreachable
8. THE System SHALL log all errors with timestamp, component name, and error details to the Data_Store

### Requirement 17: Security and Authentication

**User Story:** As a User, I want my water monitoring data to be secure and accessible only to authorized users, so that my privacy is protected.

#### Acceptance Criteria

1. THE Backend_Service SHALL require authentication tokens for all API endpoints except health checks
2. THE Backend_Service SHALL validate authentication tokens before processing requests
3. WHEN an invalid or expired token is provided, THE Backend_Service SHALL return an error response with HTTP status 401
4. THE Mobile_App SHALL securely store authentication tokens using platform-specific secure storage
5. THE Backend_Service SHALL use HTTPS for all API communications
6. THE Sensor_Module SHALL authenticate with the Backend_Service using a device-specific API key
7. THE Backend_Service SHALL implement rate limiting to prevent API abuse (maximum 100 requests per minute per user)

### Requirement 18: Performance and Scalability

**User Story:** As a System Administrator, I want the system to handle multiple concurrent users and sensors efficiently, so that performance remains consistent as the system scales.

#### Acceptance Criteria

1. THE Backend_Service SHALL handle at least 50 concurrent API requests without degradation in response time
2. THE Backend_Service SHALL process Water_Quality_Reading data from at least 10 Sensor_Modules simultaneously
3. THE Data_Store SHALL support at least 1 million sensor reading records without query performance degradation
4. THE Mobile_App SHALL render the dashboard view within 2 seconds on devices with at least 2GB RAM
5. THE Backend_Service SHALL use connection pooling for Data_Store connections to optimize resource usage
6. THE Backend_Service SHALL implement caching for frequently accessed data (current readings, recent predictions)

### Requirement 19: System Health Monitoring

**User Story:** As a System Administrator, I want to monitor the health of system components, so that I can detect and resolve issues proactively.

#### Acceptance Criteria

1. THE Backend_Service SHALL provide a health check endpoint that returns system status within 500 milliseconds
2. THE Backend_Service SHALL report the status of the Data_Store connection in the health check response
3. THE Backend_Service SHALL report the status of the Notification_Service in the health check response
4. THE Backend_Service SHALL report the last successful communication timestamp for each registered Sensor_Module
5. THE Backend_Service SHALL report current ML model versions in the health check response
6. WHEN a Sensor_Module has not communicated for more than 5 minutes, THE Backend_Service SHALL mark it as offline
7. THE Mobile_App SHALL display system health status in the settings view

### Requirement 20: User Management

**User Story:** As an Administrator, I want to manage user accounts and permissions, so that I can control who has access to the system.

#### Acceptance Criteria

1. THE Backend_Service SHALL provide an API endpoint to create new user accounts with email and password
2. THE Backend_Service SHALL provide an API endpoint to authenticate users and issue authentication tokens
3. THE Backend_Service SHALL support two user roles: User and Administrator
4. THE Backend_Service SHALL restrict configuration and calibration endpoints to Administrator role
5. THE Backend_Service SHALL allow Users to view their own sensor data and predictions
6. THE Backend_Service SHALL hash passwords using a secure algorithm (bcrypt with cost factor ≥ 10)
7. THE Mobile_App SHALL provide login and registration interfaces

## Non-Functional Requirements

### Performance
- The System SHALL maintain end-to-end latency from sensor reading to Mobile_App display of less than 5 seconds under normal network conditions
- The ML_Classifier and Risk_Predictor SHALL complete inference within 500 milliseconds on hardware with at least 2 CPU cores and 4GB RAM

### Reliability
- The System SHALL maintain 95% uptime over any 30-day period
- The Sensor_Module SHALL operate continuously for at least 30 days without requiring restart

### Usability
- The Mobile_App SHALL be usable by individuals with basic smartphone literacy without requiring technical training
- The Mobile_App SHALL support both light and dark themes for user comfort

### Maintainability
- The System SHALL use modular architecture to allow independent updates of Sensor_Module, Backend_Service, and Mobile_App components
- The System SHALL include comprehensive logging to facilitate debugging and troubleshooting

### Portability
- The Mobile_App SHALL run on Android devices with API level 21 (Android 5.0) or higher
- The Mobile_App SHALL run on iOS devices with iOS 12.0 or higher
- The Backend_Service SHALL run on Linux, Windows, and macOS operating systems

### Compatibility
- The System SHALL use standard communication protocols (HTTP/HTTPS, MQTT, or WebSocket) for component integration
- The System SHALL export data in standard formats (CSV, JSON) for interoperability with external tools

## Constraints

- The project SHALL be completed within 16 weeks
- The System SHALL be designed for household and small-scale water management (not industrial-scale)
- The Sensor_Module SHALL use ESP32 microcontroller
- The ML models SHALL use Random Forest (classification) and XGBoost (risk prediction) algorithms
- The Mobile_App SHALL be built using React Native framework
- The Backend_Service SHALL be built using Python and FastAPI framework
- The Data_Store SHALL use MongoDB database

## Assumptions

- Users have access to smartphones with Android 5.0+ or iOS 12.0+
- Users have reliable internet connectivity for real-time monitoring
- Sensors are properly installed and positioned in the water system
- Initial training data for ML models is available or will be collected during system deployment
- WHO water quality standards are used as reference thresholds for Safe/Warning/Unsafe classification
