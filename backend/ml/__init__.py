"""ML module for water quality monitoring

This module provides machine learning services for:
- Data preparation and feature extraction
- Model training (Random Forest classifier and XGBoost risk predictor)
- Real-time inference
- SHAP-based explainability
"""

from ml.data_preparation import DataPreparator
from ml.classifier_trainer import ClassifierTrainer
from ml.risk_predictor_trainer import RiskPredictorTrainer
from ml.ml_service import MLService, ml_service
from ml.shap_service import SHAPService, shap_service

__all__ = [
    'DataPreparator',
    'ClassifierTrainer',
    'RiskPredictorTrainer',
    'MLService',
    'ml_service',
    'SHAPService',
    'shap_service'
]
