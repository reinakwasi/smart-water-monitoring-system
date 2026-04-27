"""ML inference service for water quality classification and risk prediction

This module provides the MLService class that loads trained models and performs
real-time inference for water quality classification and contamination risk prediction."""

import numpy as np
import joblib
import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime


class MLService:
    """
    ML inference service for water quality monitoring
    
    Handles:
    - Loading trained Random Forest classifier and XGBoost risk predictor
    - Real-time water quality classification
    - Real-time contamination risk prediction
    - Model version management    """
    
    def __init__(
        self,
        model_dir: str = "ml/models",
        classifier_version: str = "v1.0",
        risk_predictor_version: str = "v1.0"
    ):
        """
        Initialize MLService
        
        Args:
            model_dir: Directory containing trained models
            classifier_version: Version of classifier model to load
            risk_predictor_version: Version of risk predictor model to load
        """
        self.model_dir = Path(model_dir)
        self.classifier = None
        self.risk_predictor = None
        self.classifier_metadata = None
        self.risk_predictor_metadata = None
        self.classifier_version = classifier_version
        self.risk_predictor_version = risk_predictor_version
        
        # Feature names for classification (5 sensor parameters)
        self.classification_features = [
            'ph',
            'turbidity',
            'temperature',
            'tds',
            'dissolved_oxygen'
        ]
        
        # Load models
        self._load_models()
    
    def _load_models(self):
        """
        Load trained models from disk        """
        # Load classifier
        try:
            classifier_dir = self.model_dir / f"classifier_{self.classifier_version}"
            classifier_path = classifier_dir / "model.joblib"
            
            if classifier_path.exists():
                self.classifier = joblib.load(classifier_path)
                print(f"Classifier loaded: {classifier_path}")
                
                # Load metadata
                metadata_path = classifier_dir / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        self.classifier_metadata = json.load(f)
            else:
                print(f"Warning: Classifier not found at {classifier_path}")
        except Exception as e:
            print(f"Error loading classifier: {e}")
    
        # Load risk predictor
        try:
            risk_predictor_dir = self.model_dir / f"risk_predictor_{self.risk_predictor_version}"
            risk_predictor_path = risk_predictor_dir / "model.joblib"
            
            if risk_predictor_path.exists():
                self.risk_predictor = joblib.load(risk_predictor_path)
                print(f"Risk predictor loaded: {risk_predictor_path}")
                
                # Load metadata
                metadata_path = risk_predictor_dir / "metadata.json"
                if metadata_path.exists():
                    with open(metadata_path, 'r') as f:
                        self.risk_predictor_metadata = json.load(f)
            else:
                print(f"Warning: Risk predictor not found at {risk_predictor_path}")
        except Exception as e:
            print(f"Error loading risk predictor: {e}")
    
    def reload_models(
        self,
        classifier_version: Optional[str] = None,
        risk_predictor_version: Optional[str] = None
    ):
        """
        Reload models with different versions        
        Args:
            classifier_version: New classifier version to load (optional)
            risk_predictor_version: New risk predictor version to load (optional)
        """
        if classifier_version is not None:
            self.classifier_version = classifier_version
        
        if risk_predictor_version is not None:
            self.risk_predictor_version = risk_predictor_version
        
        self._load_models()
    
    def classify_water_quality(
        self,
        sensor_data: Dict[str, float]
    ) -> Dict[str, Any]:
        """
        Classify water quality based on sensor readings        
        Args:
            sensor_data: Dictionary containing sensor readings:
                - ph: pH level (0-14)
                - turbidity: Turbidity in NTU
                - temperature: Temperature in Celsius
                - tds: Total Dissolved Solids in ppm
                - dissolved_oxygen: Dissolved oxygen in mg/L
                
        Returns:
            Dictionary containing:
                - classification: Quality classification (Safe, Warning, or Unsafe)
                - confidence: Confidence score (0.0-1.0)
                - probabilities: Probability for each class
                - timestamp: Timestamp of classification
                
        Raises:
            ValueError: If classifier is not loaded or required features are missing
        """
        if self.classifier is None:
            raise ValueError("Classifier model is not loaded")
        
        # Validate required features
        missing_features = set(self.classification_features) - set(sensor_data.keys())
        if missing_features:
            raise ValueError(f"Missing required features: {missing_features}")
        
        # Extract features in correct order
        features = np.array([
            sensor_data[feature] for feature in self.classification_features
        ]).reshape(1, -1)
        
        # Make prediction
        start_time = datetime.utcnow()
        prediction = self.classifier.predict(features)[0]
        probabilities = self.classifier.predict_proba(features)[0]
        end_time = datetime.utcnow()
        
        # Get confidence (max probability)
        confidence = float(np.max(probabilities))
        
        # Get class names
        class_names = self.classifier.classes_
        class_probabilities = {
            class_name: float(prob)
            for class_name, prob in zip(class_names, probabilities)
        }
        
        # Calculate inference time
        inference_time_ms = (end_time - start_time).total_seconds() * 1000
        
        result = {
            'classification': str(prediction),
            'confidence': confidence,
            'probabilities': class_probabilities,
            'inference_time_ms': inference_time_ms,
            'timestamp': end_time.isoformat(),
            'model_version': self.classifier_version
        }
        
        return result
    
    def predict_contamination_risk(
        self,
        current_reading: Dict[str, float],
        historical_readings: Optional[List[Dict[str, float]]] = None,
        window_size: int = 10
    ) -> Dict[str, Any]:
        """
        Predict contamination risk based on current and historical readings        
        Args:
            current_reading: Dictionary containing current sensor readings
            historical_readings: List of historical sensor readings (optional)
            window_size: Number of historical readings to use for temporal features
            
        Returns:
            Dictionary containing:
                - risk_score: Risk score (0.0-1.0)
                - risk_level: Risk level (Low, Medium, High)
                - probabilities: Probability for each risk level (if classification)
                - timestamp: Timestamp of prediction
                
        Raises:
            ValueError: If risk predictor is not loaded or required features are missing
        """
        if self.risk_predictor is None:
            raise ValueError("Risk predictor model is not loaded")
        
        # Validate required features in current reading
        missing_features = set(self.classification_features) - set(current_reading.keys())
        if missing_features:
            raise ValueError(f"Missing required features: {missing_features}")
        
        # Extract temporal features if historical data is provided
        if historical_readings is not None and len(historical_readings) >= window_size:
            features = self._extract_temporal_features(
                current_reading,
                historical_readings[-window_size:],
                window_size
            )
        else:
            # Use only current features (fallback if no historical data)
            # Pad with zeros for temporal features
            current_features = np.array([
                current_reading[feature] for feature in self.classification_features
            ])
            # Create 20 features: current + mean + std + trend (all zeros for temporal)
            features = np.concatenate([
                current_features,
                np.zeros(5),  # mean
                np.zeros(5),  # std
                np.zeros(5)   # trend
            ]).reshape(1, -1)
        
        # Make prediction
        start_time = datetime.utcnow()
        
        # Check if model is classifier or regressor
        task_type = self.risk_predictor_metadata.get('task_type', 'classification') if self.risk_predictor_metadata else 'classification'
        
        if task_type == 'classification':
            # Classification: predict risk level directly
            prediction = self.risk_predictor.predict(features)[0]
            probabilities = self.risk_predictor.predict_proba(features)[0]
            
            # Get class names and probabilities
            class_names = self.risk_predictor.classes_
            class_probabilities = {
                class_name: float(prob)
                for class_name, prob in zip(class_names, probabilities)
            }
            
            # Map prediction to risk score (0.0-1.0)
            # Assuming classes are ordered: Low, Medium, High
            risk_level = str(prediction)
            risk_score = float(np.max(probabilities))
        else:
            # Regression: predict risk score directly
            risk_score = float(self.risk_predictor.predict(features)[0])
            
            # Ensure risk score is in valid range [0.0, 1.0]
            risk_score = np.clip(risk_score, 0.0, 1.0)
            
            # Classify risk level based on score
            # Requirement 4.6, 4.7, 4.8: Risk level thresholds
            if risk_score >= 0.7:
                risk_level = "High"
            elif risk_score >= 0.4:
                risk_level = "Medium"
            else:
                risk_level = "Low"
            
            class_probabilities = None
        
        end_time = datetime.utcnow()
        
        # Calculate inference time
        inference_time_ms = (end_time - start_time).total_seconds() * 1000
        
        result = {
            'risk_score': risk_score,
            'risk_level': risk_level,
            'inference_time_ms': inference_time_ms,
            'timestamp': end_time.isoformat(),
            'model_version': self.risk_predictor_version
        }
        
        if class_probabilities is not None:
            result['probabilities'] = class_probabilities
        
        return result
    
    def _extract_temporal_features(
        self,
        current_reading: Dict[str, float],
        historical_readings: List[Dict[str, float]],
        window_size: int
    ) -> np.ndarray:
        """
        Extract temporal features from current and historical readings
        
        Creates 20 features:
        - Current readings (5 features)
        - Mean of historical readings (5 features)
        - Std of historical readings (5 features)
        - Trend of historical readings (5 features)
        
        Args:
            current_reading: Current sensor reading
            historical_readings: List of historical readings
            window_size: Number of historical readings to use
            
        Returns:
            Feature array of shape (1, 20)
        """
        # Current features
        current_features = np.array([
            current_reading[feature] for feature in self.classification_features
        ])
        
        # Extract historical values for each feature
        historical_values = {
            feature: [reading[feature] for reading in historical_readings]
            for feature in self.classification_features
        }
        
        # Mean features
        mean_features = np.array([
            np.mean(historical_values[feature])
            for feature in self.classification_features
        ])
        
        # Std features
        std_features = np.array([
            np.std(historical_values[feature])
            for feature in self.classification_features
        ])
        
        # Trend features (simple linear trend)
        trend_features = np.array([
            (historical_values[feature][-1] - historical_values[feature][0]) / window_size
            for feature in self.classification_features
        ])
        
        # Concatenate all features
        features = np.concatenate([
            current_features,
            mean_features,
            std_features,
            trend_features
        ]).reshape(1, -1)
        
        return features
    
    def get_model_info(self) -> Dict[str, Any]:
        """
        Get information about loaded models
        
        Returns:
            Dictionary containing model information
        """
        info = {
            'classifier': {
                'loaded': self.classifier is not None,
                'version': self.classifier_version,
                'metadata': self.classifier_metadata
            },
            'risk_predictor': {
                'loaded': self.risk_predictor is not None,
                'version': self.risk_predictor_version,
                'metadata': self.risk_predictor_metadata
            }
        }
        
        return info
    
    def is_ready(self) -> bool:
        """
        Check if both models are loaded and ready for inference
        
        Returns:
            True if both models are loaded, False otherwise
        """
        return self.classifier is not None and self.risk_predictor is not None


# Global ML service instance
ml_service = MLService()
