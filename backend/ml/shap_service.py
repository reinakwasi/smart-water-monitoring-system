"""SHAP explainability service for ML model interpretability

This module provides the SHAPService class that generates SHAP explanations
for water quality classification and contamination risk predictions."""

import numpy as np
import shap
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime


class SHAPService:
    """
    SHAP explainability service for model interpretability
    
    Handles:
    - Computing SHAP values for classification predictions
    - Computing SHAP values for risk predictions
    - Ranking features by importance
    - Generating human-readable explanations    """
    
    def __init__(
        self,
        classifier=None,
        risk_predictor=None
    ):
        """
        Initialize SHAPService
        
        Args:
            classifier: Trained Random Forest classifier
            risk_predictor: Trained XGBoost risk predictor
        """
        self.classifier = classifier
        self.risk_predictor = risk_predictor
        self.classifier_explainer = None
        self.risk_predictor_explainer = None
        
        # Feature names for classification (5 sensor parameters)
        self.classification_features = [
            'ph',
            'turbidity',
            'temperature',
            'tds',
            'dissolved_oxygen'
        ]
        
        # Feature names for risk prediction (20 temporal features)
        self.risk_prediction_features = self._get_temporal_feature_names()
        
        # Initialize explainers
        self._initialize_explainers()
    
    def _get_temporal_feature_names(self) -> List[str]:
        """
        Get feature names for temporal risk prediction features
        
        Returns:
            List of 20 feature names
        """
        feature_names = []
        
        # Current features
        feature_names.extend([f"{f}_current" for f in self.classification_features])
        
        # Mean features
        feature_names.extend([f"{f}_mean" for f in self.classification_features])
        
        # Std features
        feature_names.extend([f"{f}_std" for f in self.classification_features])
        
        # Trend features
        feature_names.extend([f"{f}_trend" for f in self.classification_features])
        
        return feature_names
    
    def _initialize_explainers(self):
        """
        Initialize SHAP TreeExplainer for both models        """
        try:
            if self.classifier is not None:
                self.classifier_explainer = shap.TreeExplainer(self.classifier)
                print("SHAP explainer initialized for classifier")
        except Exception as e:
            print(f"Error initializing classifier explainer: {e}")
        
        try:
            if self.risk_predictor is not None:
                self.risk_predictor_explainer = shap.TreeExplainer(self.risk_predictor)
                print("SHAP explainer initialized for risk predictor")
        except Exception as e:
            print(f"Error initializing risk predictor explainer: {e}")
    
    def set_models(self, classifier=None, risk_predictor=None):
        """
        Update models and reinitialize explainers
        
        Args:
            classifier: New classifier model (optional)
            risk_predictor: New risk predictor model (optional)
        """
        if classifier is not None:
            self.classifier = classifier
        
        if risk_predictor is not None:
            self.risk_predictor = risk_predictor
        
        self._initialize_explainers()
    
    def explain_classification(
        self,
        sensor_data: Dict[str, float],
        prediction: str
    ) -> Dict[str, Any]:
        """
        Generate SHAP explanation for water quality classification        
        Args:
            sensor_data: Dictionary containing sensor readings
            prediction: The classification prediction (Safe, Warning, Unsafe)
            
        Returns:
            Dictionary containing:
                - shap_values: SHAP value for each feature
                - top_factors: Top contributing factors ranked by importance
                - base_value: Base value (expected value)
                - prediction: The prediction being explained
                
        Raises:
            ValueError: If explainer is not initialized or required features are missing
        """
        if self.classifier_explainer is None:
            raise ValueError("Classifier explainer is not initialized")
        
        # Validate required features
        missing_features = set(self.classification_features) - set(sensor_data.keys())
        if missing_features:
            raise ValueError(f"Missing required features: {missing_features}")
        
        # Extract features in correct order
        features = np.array([
            sensor_data[feature] for feature in self.classification_features
        ]).reshape(1, -1)
        
        # Compute SHAP values
        start_time = datetime.utcnow()
        shap_values = self.classifier_explainer.shap_values(features)
        end_time = datetime.utcnow()
        
        # Get the SHAP values for the predicted class
        # shap_values is a list of arrays (one per class) or a single array
        class_names = self.classifier.classes_
        
        # Handle different SHAP value formats
        if isinstance(shap_values, list):
            # Multi-class: get SHAP values for predicted class
            predicted_class_idx = np.where(class_names == prediction)[0][0]
            class_shap_values = shap_values[predicted_class_idx][0]
            base_value = float(self.classifier_explainer.expected_value[predicted_class_idx])
        else:
            # Binary classification: single array of SHAP values
            class_shap_values = shap_values[0]
            if isinstance(self.classifier_explainer.expected_value, np.ndarray):
                base_value = float(self.classifier_explainer.expected_value[0])
            else:
                base_value = float(self.classifier_explainer.expected_value)
        
        # Create dictionary of feature -> SHAP value
        shap_dict = {
            feature: float(shap_value) if np.isscalar(shap_value) else float(shap_value[0])
            for feature, shap_value in zip(self.classification_features, class_shap_values)
        }
        
        # Get top factors ranked by absolute SHAP value
        top_factors = self.get_top_features(shap_dict, top_n=5)
        
        # Calculate computation time
        computation_time_ms = (end_time - start_time).total_seconds() * 1000
        
        result = {
            'shap_values': shap_dict,
            'top_factors': top_factors,
            'base_value': base_value,
            'prediction': prediction,
            'computation_time_ms': computation_time_ms,
            'timestamp': end_time.isoformat()
        }
        
        return result
    
    def explain_risk_prediction(
        self,
        current_reading: Dict[str, float],
        historical_readings: Optional[List[Dict[str, float]]],
        risk_score: float,
        window_size: int = 10
    ) -> Dict[str, Any]:
        """
        Generate SHAP explanation for contamination risk prediction        
        Args:
            current_reading: Dictionary containing current sensor readings
            historical_readings: List of historical sensor readings (optional)
            risk_score: The predicted risk score
            window_size: Number of historical readings used for temporal features
            
        Returns:
            Dictionary containing:
                - shap_values: SHAP value for each feature
                - top_factors: Top contributing factors ranked by importance
                - base_value: Base value (expected value)
                - risk_score: The risk score being explained
                
        Raises:
            ValueError: If explainer is not initialized or required features are missing
        """
        if self.risk_predictor_explainer is None:
            raise ValueError("Risk predictor explainer is not initialized")
        
        # Validate required features
        missing_features = set(self.classification_features) - set(current_reading.keys())
        if missing_features:
            raise ValueError(f"Missing required features: {missing_features}")
        
        # Extract temporal features
        if historical_readings is not None and len(historical_readings) >= window_size:
            features = self._extract_temporal_features(
                current_reading,
                historical_readings[-window_size:],
                window_size
            )
        else:
            # Use only current features (fallback)
            current_features = np.array([
                current_reading[feature] for feature in self.classification_features
            ])
            features = np.concatenate([
                current_features,
                np.zeros(5),  # mean
                np.zeros(5),  # std
                np.zeros(5)   # trend
            ]).reshape(1, -1)
        
        # Compute SHAP values
        start_time = datetime.utcnow()
        shap_values = self.risk_predictor_explainer.shap_values(features)
        end_time = datetime.utcnow()
        
        # Handle different SHAP value formats
        if isinstance(shap_values, list):
            # Classification: get SHAP values for predicted class
            # Use the highest risk class
            shap_values = shap_values[-1][0]  # Assuming last class is highest risk
        else:
            # Regression: single array of SHAP values
            shap_values = shap_values[0]
        
        # Create dictionary of feature -> SHAP value
        shap_dict = {
            feature: float(shap_value) if np.isscalar(shap_value) else float(shap_value[0] if hasattr(shap_value, '__len__') else shap_value)
            for feature, shap_value in zip(self.risk_prediction_features, shap_values)
        }
        
        # Get top factors ranked by absolute SHAP value
        top_factors = self.get_top_features(shap_dict, top_n=5)
        
        # Calculate computation time
        computation_time_ms = (end_time - start_time).total_seconds() * 1000
        
        # Get base value
        expected_value = self.risk_predictor_explainer.expected_value
        if isinstance(expected_value, (list, np.ndarray)):
            base_value = float(expected_value[-1] if len(expected_value) > 0 else 0.0)
        else:
            base_value = float(expected_value)
        
        result = {
            'shap_values': shap_dict,
            'top_factors': top_factors,
            'base_value': base_value,
            'risk_score': risk_score,
            'computation_time_ms': computation_time_ms,
            'timestamp': end_time.isoformat()
        }
        
        return result
    
    def get_top_features(
        self,
        shap_values: Dict[str, float],
        top_n: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get top N features ranked by absolute SHAP value        
        Args:
            shap_values: Dictionary of feature -> SHAP value
            top_n: Number of top features to return
            
        Returns:
            List of dictionaries containing:
                - feature: Feature name
                - shap_value: SHAP value
                - direction: "positive" or "negative"
                - abs_shap_value: Absolute SHAP value (for sorting)
        """
        # Create list of feature info
        feature_info = []
        for feature, shap_value in shap_values.items():
            feature_info.append({
                'feature': feature,
                'shap_value': shap_value,
                'direction': 'positive' if shap_value > 0 else 'negative',
                'abs_shap_value': abs(shap_value)
            })
        
        # Sort by absolute SHAP value (descending)
        feature_info.sort(key=lambda x: x['abs_shap_value'], reverse=True)
        
        # Return top N features
        return feature_info[:top_n]
    
    def _extract_temporal_features(
        self,
        current_reading: Dict[str, float],
        historical_readings: List[Dict[str, float]],
        window_size: int
    ) -> np.ndarray:
        """
        Extract temporal features from current and historical readings
        
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
        
        # Trend features
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
    
    def is_ready(self) -> bool:
        """
        Check if both explainers are initialized and ready
        
        Returns:
            True if both explainers are ready, False otherwise
        """
        return (
            self.classifier_explainer is not None and
            self.risk_predictor_explainer is not None
        )


# Global SHAP service instance (will be initialized after models are loaded)
shap_service = SHAPService()
