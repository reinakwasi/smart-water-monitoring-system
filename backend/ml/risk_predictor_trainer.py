"""XGBoost risk predictor training module

This module handles training, evaluation, and persistence of the XGBoost
contamination risk prediction model.

Requirements: 12.3, 12.5, 12.6, 12.7, 12.8
"""

import numpy as np
import json
import joblib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from xgboost import XGBClassifier, XGBRegressor
from sklearn.model_selection import GridSearchCV, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)


class RiskPredictorTrainer:
    """
    XGBoost trainer for contamination risk prediction
    
    Handles:
    - Training XGBoost with hyperparameter tuning
    - K-fold cross-validation (k=5)
    - Model evaluation with multiple metrics including AUC-ROC
    - Model persistence with versioning
    
    Requirements: 12.3, 12.5, 12.6, 12.7, 12.8
    """
    
    def __init__(
        self,
        model_dir: str = "ml/models",
        random_state: int = 42,
        task_type: str = "classification"
    ):
        """
        Initialize RiskPredictorTrainer
        
        Args:
            model_dir: Directory to save trained models
            random_state: Random seed for reproducibility
            task_type: "classification" for risk levels or "regression" for risk scores
        """
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.random_state = random_state
        self.task_type = task_type
        self.model: Optional[Any] = None
        self.best_params: Optional[Dict[str, Any]] = None
        self.feature_names: Optional[list] = None
    
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        feature_names: Optional[list] = None,
        hyperparameter_tuning: bool = True,
        param_grid: Optional[Dict[str, list]] = None
    ):
        """
        Train XGBoost model with optional hyperparameter tuning
        
        Requirement 12.3: Train Risk_Predictor using XGBoost with configurable hyperparameters
        
        Args:
            X_train: Training feature matrix (with temporal features)
            y_train: Training target (risk scores or levels)
            feature_names: Optional list of feature names
            hyperparameter_tuning: Whether to perform grid search for hyperparameters
            param_grid: Custom parameter grid for grid search
            
        Returns:
            Trained XGBoost model
        """
        self.feature_names = feature_names
        
        if hyperparameter_tuning:
            # Default parameter grid if not provided
            if param_grid is None:
                param_grid = {
                    'n_estimators': [50, 100, 200],
                    'max_depth': [3, 5, 7, 9],
                    'learning_rate': [0.01, 0.05, 0.1, 0.2],
                    'subsample': [0.7, 0.8, 0.9, 1.0],
                    'colsample_bytree': [0.7, 0.8, 0.9, 1.0],
                    'min_child_weight': [1, 3, 5]
                }
            
            # Create base model based on task type
            if self.task_type == "classification":
                base_model = XGBClassifier(
                    random_state=self.random_state,
                    n_jobs=-1,
                    eval_metric='logloss'
                )
                scoring = 'f1_weighted'
            else:
                base_model = XGBRegressor(
                    random_state=self.random_state,
                    n_jobs=-1,
                    eval_metric='rmse'
                )
                scoring = 'neg_mean_squared_error'
            
            # Perform grid search with cross-validation
            print("Performing hyperparameter tuning with GridSearchCV...")
            grid_search = GridSearchCV(
                estimator=base_model,
                param_grid=param_grid,
                cv=5,  # Requirement 12.6: k-fold cross-validation (k=5)
                scoring=scoring,
                n_jobs=-1,
                verbose=1
            )
            
            grid_search.fit(X_train, y_train)
            
            # Get best model and parameters
            self.model = grid_search.best_estimator_
            self.best_params = grid_search.best_params_
            
            print(f"Best parameters: {self.best_params}")
            print(f"Best cross-validation score: {grid_search.best_score_:.4f}")
        else:
            # Train with default or provided parameters
            if self.task_type == "classification":
                self.model = XGBClassifier(
                    n_estimators=100,
                    max_depth=5,
                    learning_rate=0.1,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    min_child_weight=3,
                    random_state=self.random_state,
                    n_jobs=-1,
                    eval_metric='logloss'
                )
            else:
                self.model = XGBRegressor(
                    n_estimators=100,
                    max_depth=5,
                    learning_rate=0.1,
                    subsample=0.8,
                    colsample_bytree=0.8,
                    min_child_weight=3,
                    random_state=self.random_state,
                    n_jobs=-1,
                    eval_metric='rmse'
                )
            
            print("Training XGBoost risk predictor...")
            self.model.fit(X_train, y_train)
        
        return self.model
    
    def cross_validate(
        self,
        X: np.ndarray,
        y: np.ndarray,
        cv: int = 5
    ) -> Dict[str, float]:
        """
        Perform k-fold cross-validation on the model
        
        Requirement 12.6: Perform k-fold cross-validation (k=5)
        
        Args:
            X: Feature matrix
            y: Target values
            cv: Number of folds (default 5)
            
        Returns:
            Dictionary with cross-validation scores
            
        Raises:
            ValueError: If model has not been trained
        """
        if self.model is None:
            raise ValueError("Model must be trained before cross-validation")
        
        print(f"Performing {cv}-fold cross-validation...")
        
        if self.task_type == "classification":
            # Compute cross-validation scores for classification metrics
            accuracy_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='accuracy', n_jobs=-1
            )
            precision_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='precision_weighted', n_jobs=-1
            )
            recall_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='recall_weighted', n_jobs=-1
            )
            f1_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='f1_weighted', n_jobs=-1
            )
            
            cv_results = {
                'accuracy_mean': float(accuracy_scores.mean()),
                'accuracy_std': float(accuracy_scores.std()),
                'precision_mean': float(precision_scores.mean()),
                'precision_std': float(precision_scores.std()),
                'recall_mean': float(recall_scores.mean()),
                'recall_std': float(recall_scores.std()),
                'f1_mean': float(f1_scores.mean()),
                'f1_std': float(f1_scores.std())
            }
        else:
            # Compute cross-validation scores for regression metrics
            mse_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='neg_mean_squared_error', n_jobs=-1
            )
            mae_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='neg_mean_absolute_error', n_jobs=-1
            )
            r2_scores = cross_val_score(
                self.model, X, y, cv=cv, scoring='r2', n_jobs=-1
            )
            
            cv_results = {
                'mse_mean': float(-mse_scores.mean()),
                'mse_std': float(mse_scores.std()),
                'rmse_mean': float(np.sqrt(-mse_scores.mean())),
                'mae_mean': float(-mae_scores.mean()),
                'mae_std': float(mae_scores.std()),
                'r2_mean': float(r2_scores.mean()),
                'r2_std': float(r2_scores.std())
            }
        
        return cv_results
    
    def evaluate(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Dict[str, Any]:
        """
        Evaluate model on test data
        
        Requirement 12.5: Evaluate Risk_Predictor using accuracy, precision, recall, F1-score, and AUC-ROC
        Requirement 12.8: Generate model evaluation report
        
        Args:
            X_test: Test feature matrix
            y_test: Test target values
            
        Returns:
            Dictionary containing evaluation metrics
            
        Raises:
            ValueError: If model has not been trained
        """
        if self.model is None:
            raise ValueError("Model must be trained before evaluation")
        
        print("Evaluating model on test data...")
        
        # Make predictions
        y_pred = self.model.predict(X_test)
        
        evaluation_results = {}
        
        if self.task_type == "classification":
            # Classification metrics
            accuracy = accuracy_score(y_test, y_pred)
            precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
            recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
            f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
            
            # Confusion matrix
            cm = confusion_matrix(y_test, y_pred)
            
            # Classification report
            class_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
            
            # AUC-ROC (if binary or multi-class with probabilities)
            try:
                y_pred_proba = self.model.predict_proba(X_test)
                if len(np.unique(y_test)) == 2:
                    # Binary classification
                    auc_roc = roc_auc_score(y_test, y_pred_proba[:, 1])
                else:
                    # Multi-class classification
                    auc_roc = roc_auc_score(y_test, y_pred_proba, multi_class='ovr', average='weighted')
                evaluation_results['auc_roc'] = float(auc_roc)
            except Exception as e:
                print(f"Could not compute AUC-ROC: {e}")
                evaluation_results['auc_roc'] = None
            
            evaluation_results.update({
                'accuracy': float(accuracy),
                'precision': float(precision),
                'recall': float(recall),
                'f1_score': float(f1),
                'confusion_matrix': cm.tolist(),
                'classification_report': class_report
            })
            
            print(f"Accuracy: {accuracy:.4f}")
            print(f"Precision: {precision:.4f}")
            print(f"Recall: {recall:.4f}")
            print(f"F1-score: {f1:.4f}")
            if evaluation_results['auc_roc'] is not None:
                print(f"AUC-ROC: {evaluation_results['auc_roc']:.4f}")
        else:
            # Regression metrics
            mse = mean_squared_error(y_test, y_pred)
            rmse = np.sqrt(mse)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            evaluation_results.update({
                'mse': float(mse),
                'rmse': float(rmse),
                'mae': float(mae),
                'r2_score': float(r2)
            })
            
            print(f"MSE: {mse:.4f}")
            print(f"RMSE: {rmse:.4f}")
            print(f"MAE: {mae:.4f}")
            print(f"R²: {r2:.4f}")
        
        # Get feature importances
        feature_importances = None
        if self.feature_names is not None:
            importances = self.model.feature_importances_
            feature_importances = {
                name: float(importance)
                for name, importance in zip(self.feature_names, importances)
            }
            # Sort by importance
            feature_importances = dict(
                sorted(feature_importances.items(), key=lambda x: x[1], reverse=True)
            )
        
        evaluation_results['feature_importances'] = feature_importances
        
        return evaluation_results
    
    def generate_evaluation_report(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Dict[str, Any]:
        """
        Generate comprehensive evaluation report
        
        Requirement 12.8: Generate model evaluation report including performance metrics
        
        Args:
            X_train: Training feature matrix
            y_train: Training target values
            X_test: Test feature matrix
            y_test: Test target values
            
        Returns:
            Dictionary containing complete evaluation report
        """
        print("Generating evaluation report...")
        
        # Perform cross-validation on training data
        cv_results = self.cross_validate(X_train, y_train, cv=5)
        
        # Evaluate on test data
        test_results = self.evaluate(X_test, y_test)
        
        # Combine results
        model_type = 'XGBClassifier' if self.task_type == 'classification' else 'XGBRegressor'
        
        report = {
            'model_type': model_type,
            'task_type': self.task_type,
            'training_samples': int(len(X_train)),
            'test_samples': int(len(X_test)),
            'n_features': int(X_train.shape[1]),
            'cross_validation': cv_results,
            'test_performance': test_results,
            'hyperparameters': self.best_params if self.best_params else self.model.get_params(),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        return report
    
    def save_model(
        self,
        version: str = "v1.0",
        metadata: Optional[Dict[str, Any]] = None
    ) -> Tuple[Path, Path]:
        """
        Save trained model with versioning and metadata
        
        Requirement 12.7: Persist trained model artifacts in a versioned format
        
        Args:
            version: Model version string (e.g., "v1.0", "v2.1")
            metadata: Optional metadata dictionary to save with model
            
        Returns:
            Tuple of (model_path, metadata_path)
            
        Raises:
            ValueError: If model has not been trained
        """
        if self.model is None:
            raise ValueError("Model must be trained before saving")
        
        # Create version directory
        version_dir = self.model_dir / f"risk_predictor_{version}"
        version_dir.mkdir(parents=True, exist_ok=True)
        
        # Save model
        model_path = version_dir / "model.joblib"
        joblib.dump(self.model, model_path)
        print(f"Model saved to: {model_path}")
        
        # Prepare metadata
        model_type = 'XGBClassifier' if self.task_type == 'classification' else 'XGBRegressor'
        
        model_metadata = {
            'version': version,
            'model_type': model_type,
            'task_type': self.task_type,
            'feature_names': self.feature_names,
            'hyperparameters': self.best_params if self.best_params else self.model.get_params(),
            'n_features': self.model.n_features_in_,
            'saved_at': datetime.utcnow().isoformat()
        }
        
        # Add classes for classification
        if self.task_type == 'classification':
            model_metadata['n_classes'] = len(self.model.classes_)
            model_metadata['classes'] = self.model.classes_.tolist()
        
        # Add custom metadata if provided
        if metadata is not None:
            model_metadata.update(metadata)
        
        # Save metadata
        metadata_path = version_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(model_metadata, f, indent=2)
        print(f"Metadata saved to: {metadata_path}")
        
        return model_path, metadata_path
    
    def load_model(self, version: str = "v1.0"):
        """
        Load a trained model from disk
        
        Requirement 12.9: Support loading different model versions
        
        Args:
            version: Model version string to load
            
        Returns:
            Loaded XGBoost model
            
        Raises:
            FileNotFoundError: If model file does not exist
        """
        version_dir = self.model_dir / f"risk_predictor_{version}"
        model_path = version_dir / "model.joblib"
        
        if not model_path.exists():
            raise FileNotFoundError(f"Model not found: {model_path}")
        
        self.model = joblib.load(model_path)
        print(f"Model loaded from: {model_path}")
        
        # Load metadata if available
        metadata_path = version_dir / "metadata.json"
        if metadata_path.exists():
            with open(metadata_path, 'r') as f:
                metadata = json.load(f)
                self.feature_names = metadata.get('feature_names')
                self.best_params = metadata.get('hyperparameters')
                self.task_type = metadata.get('task_type', 'classification')
        
        return self.model
