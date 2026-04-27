"""Random Forest classifier training module

This module handles training, evaluation, and persistence of the Random Forest
water quality classification model."""

import numpy as np
import json
import joblib
from pathlib import Path
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import GridSearchCV, cross_val_score
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)


class ClassifierTrainer:
    """
    Random Forest classifier trainer for water quality classification
    
    Handles:
    - Training Random Forest with hyperparameter tuning
    - K-fold cross-validation (k=5)
    - Model evaluation with multiple metrics
    - Model persistence with versioning    """
    
    def __init__(
        self,
        model_dir: str = "ml/models",
        random_state: int = 42
    ):
        """
        Initialize ClassifierTrainer
        
        Args:
            model_dir: Directory to save trained models
            random_state: Random seed for reproducibility
        """
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.random_state = random_state
        self.model: Optional[RandomForestClassifier] = None
        self.best_params: Optional[Dict[str, Any]] = None
        self.feature_names: Optional[list] = None
    
    def train(
        self,
        X_train: np.ndarray,
        y_train: np.ndarray,
        feature_names: Optional[list] = None,
        hyperparameter_tuning: bool = True,
        param_grid: Optional[Dict[str, list]] = None
    ) -> RandomForestClassifier:
        """
        Train Random Forest classifier with optional hyperparameter tuning        
        Args:
            X_train: Training feature matrix
            y_train: Training target labels
            feature_names: Optional list of feature names
            hyperparameter_tuning: Whether to perform grid search for hyperparameters
            param_grid: Custom parameter grid for grid search
            
        Returns:
            Trained RandomForestClassifier model
        """
        self.feature_names = feature_names
        
        if hyperparameter_tuning:
            # Default parameter grid if not provided
            if param_grid is None:
                param_grid = {
                    'n_estimators': [50, 100, 200],
                    'max_depth': [10, 20, 30, None],
                    'min_samples_split': [2, 5, 10],
                    'min_samples_leaf': [1, 2, 4],
                    'max_features': ['sqrt', 'log2']
                }
            
            # Create base model
            base_model = RandomForestClassifier(
                random_state=self.random_state,
                n_jobs=-1
            )
            
            # Perform grid search with cross-validation
            print("Performing hyperparameter tuning with GridSearchCV...")
            grid_search = GridSearchCV(
                estimator=base_model,
                param_grid=param_grid,
                cv=5,  #                scoring='f1_weighted',
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
            self.model = RandomForestClassifier(
                n_estimators=100,
                max_depth=20,
                min_samples_split=5,
                min_samples_leaf=2,
                max_features='sqrt',
                random_state=self.random_state,
                n_jobs=-1
            )
            
            print("Training Random Forest classifier...")
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
        Args:
            X: Feature matrix
            y: Target labels
            cv: Number of folds (default 5)
            
        Returns:
            Dictionary with cross-validation scores
            
        Raises:
            ValueError: If model has not been trained
        """
        if self.model is None:
            raise ValueError("Model must be trained before cross-validation")
        
        print(f"Performing {cv}-fold cross-validation...")
        
        # Compute cross-validation scores for multiple metrics
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
        
        return cv_results
    
    def evaluate(
        self,
        X_test: np.ndarray,
        y_test: np.ndarray
    ) -> Dict[str, Any]:
        """
        Evaluate model on test data        
        Args:
            X_test: Test feature matrix
            y_test: Test target labels
            
        Returns:
            Dictionary containing evaluation metrics and confusion matrix
            
        Raises:
            ValueError: If model has not been trained
        """
        if self.model is None:
            raise ValueError("Model must be trained before evaluation")
        
        print("Evaluating model on test data...")
        
        # Make predictions
        y_pred = self.model.predict(X_test)
        
        # Compute metrics
        accuracy = accuracy_score(y_test, y_pred)
        precision = precision_score(y_test, y_pred, average='weighted', zero_division=0)
        recall = recall_score(y_test, y_pred, average='weighted', zero_division=0)
        f1 = f1_score(y_test, y_pred, average='weighted', zero_division=0)
        
        # Compute confusion matrix
        cm = confusion_matrix(y_test, y_pred)
        
        # Get classification report
        class_report = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
        
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
        
        evaluation_results = {
            'accuracy': float(accuracy),
            'precision': float(precision),
            'recall': float(recall),
            'f1_score': float(f1),
            'confusion_matrix': cm.tolist(),
            'classification_report': class_report,
            'feature_importances': feature_importances
        }
        
        print(f"Accuracy: {accuracy:.4f}")
        print(f"Precision: {precision:.4f}")
        print(f"Recall: {recall:.4f}")
        print(f"F1-score: {f1:.4f}")
        
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
        Args:
            X_train: Training feature matrix
            y_train: Training target labels
            X_test: Test feature matrix
            y_test: Test target labels
            
        Returns:
            Dictionary containing complete evaluation report
        """
        print("Generating evaluation report...")
        
        # Perform cross-validation on training data
        cv_results = self.cross_validate(X_train, y_train, cv=5)
        
        # Evaluate on test data
        test_results = self.evaluate(X_test, y_test)
        
        # Combine results
        report = {
            'model_type': 'RandomForestClassifier',
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
        version_dir = self.model_dir / f"classifier_{version}"
        version_dir.mkdir(parents=True, exist_ok=True)
        
        # Save model
        model_path = version_dir / "model.joblib"
        joblib.dump(self.model, model_path)
        print(f"Model saved to: {model_path}")
        
        # Prepare metadata
        model_metadata = {
            'version': version,
            'model_type': 'RandomForestClassifier',
            'feature_names': self.feature_names,
            'hyperparameters': self.best_params if self.best_params else self.model.get_params(),
            'n_features': self.model.n_features_in_,
            'n_classes': len(self.model.classes_),
            'classes': self.model.classes_.tolist(),
            'saved_at': datetime.utcnow().isoformat()
        }
        
        # Add custom metadata if provided
        if metadata is not None:
            model_metadata.update(metadata)
        
        # Save metadata
        metadata_path = version_dir / "metadata.json"
        with open(metadata_path, 'w') as f:
            json.dump(model_metadata, f, indent=2)
        print(f"Metadata saved to: {metadata_path}")
        
        return model_path, metadata_path
    
    def load_model(self, version: str = "v1.0") -> RandomForestClassifier:
        """
        Load a trained model from disk        
        Args:
            version: Model version string to load
            
        Returns:
            Loaded RandomForestClassifier model
            
        Raises:
            FileNotFoundError: If model file does not exist
        """
        version_dir = self.model_dir / f"classifier_{version}"
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
        
        return self.model
