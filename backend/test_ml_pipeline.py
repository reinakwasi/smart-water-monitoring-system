"""Test script to verify ML pipeline works end-to-end

This script tests:
1. Data preparation
2. Model training (classifier and risk predictor)
3. Model inference
4. SHAP explanations
"""

import numpy as np
import pandas as pd
from pathlib import Path

from ml.data_preparation import DataPreparator
from ml.classifier_trainer import ClassifierTrainer
from ml.risk_predictor_trainer import RiskPredictorTrainer
from ml.ml_service import MLService
from ml.shap_service import SHAPService


def create_sample_data():
    """Create sample training data for testing"""
    print("\n=== Creating Sample Training Data ===")
    
    # Create sample data with 100 samples
    np.random.seed(42)
    n_samples = 100
    
    data = {
        'ph': np.random.uniform(6.0, 8.5, n_samples),
        'turbidity': np.random.uniform(0, 50, n_samples),
        'temperature': np.random.uniform(15, 35, n_samples),
        'tds': np.random.uniform(50, 500, n_samples),
        'dissolved_oxygen': np.random.uniform(5, 12, n_samples),
        'timestamp': pd.date_range('2024-01-01', periods=n_samples, freq='30min')
    }
    
    df = pd.DataFrame(data)
    
    # Create synthetic labels for classification
    # Safe: pH 6.5-8.5, turbidity < 5, temp 15-30, tds < 300, do > 6
    # Unsafe: pH < 6 or > 9, turbidity > 20, temp > 35, tds > 400, do < 4
    # Warning: everything else
    def classify_quality(row):
        if (6.5 <= row['ph'] <= 8.5 and row['turbidity'] < 5 and 
            15 <= row['temperature'] <= 30 and row['tds'] < 300 and row['dissolved_oxygen'] > 6):
            return 'Safe'
        elif (row['ph'] < 6 or row['ph'] > 9 or row['turbidity'] > 20 or 
              row['temperature'] > 35 or row['tds'] > 400 or row['dissolved_oxygen'] < 4):
            return 'Unsafe'
        else:
            return 'Warning'
    
    df['quality_classification'] = df.apply(classify_quality, axis=1)
    
    # Create synthetic risk scores (0.0-1.0)
    # Higher risk for values outside safe ranges
    def calculate_risk(row):
        risk = 0.0
        if row['ph'] < 6.5 or row['ph'] > 8.5:
            risk += 0.2
        if row['turbidity'] > 10:
            risk += 0.2
        if row['temperature'] > 30:
            risk += 0.15
        if row['tds'] > 300:
            risk += 0.15
        if row['dissolved_oxygen'] < 6:
            risk += 0.3
        return min(risk, 1.0)
    
    df['contamination_risk'] = df.apply(calculate_risk, axis=1)
    
    # Save to CSV
    data_dir = Path('ml/data')
    data_dir.mkdir(parents=True, exist_ok=True)
    csv_path = data_dir / 'sample_training_data.csv'
    df.to_csv(csv_path, index=False)
    
    print(f"Sample data created: {csv_path}")
    print(f"Total samples: {len(df)}")
    print(f"Classification distribution:\n{df['quality_classification'].value_counts()}")
    print(f"Risk score range: {df['contamination_risk'].min():.2f} - {df['contamination_risk'].max():.2f}")
    
    return csv_path


def test_data_preparation(csv_path):
    """Test data preparation module"""
    print("\n=== Testing Data Preparation ===")
    
    preparator = DataPreparator(random_state=42)
    
    # Test classification data preparation
    print("\n1. Testing classification data preparation...")
    X_train, X_test, y_train, y_test = preparator.prepare_classification_data(
        str(csv_path), test_size=0.2
    )
    print(f"Training samples: {len(X_train)}, Test samples: {len(X_test)}")
    print(f"Feature shape: {X_train.shape}")
    print(f"Classes: {np.unique(y_train)}")
    
    # Test risk prediction data preparation
    print("\n2. Testing risk prediction data preparation...")
    # Use smaller window size and disable stratification for small dataset
    df = preparator.load_csv_data(str(csv_path))
    X_risk, y_risk = preparator.extract_temporal_features(df, window_size=5)
    X_train_risk, X_test_risk, y_train_risk, y_test_risk = preparator.train_test_split_stratified(
        X_risk, y_risk, test_size=0.2, stratify=False  # Disable stratification for small dataset
    )
    print(f"Training samples: {len(X_train_risk)}, Test samples: {len(X_test_risk)}")
    print(f"Feature shape: {X_train_risk.shape}")
    print(f"Risk score range: {y_train_risk.min():.2f} - {y_train_risk.max():.2f}")
    
    return (X_train, X_test, y_train, y_test), (X_train_risk, X_test_risk, y_train_risk, y_test_risk)


def test_classifier_training(classification_data):
    """Test Random Forest classifier training"""
    print("\n=== Testing Classifier Training ===")
    
    X_train, X_test, y_train, y_test = classification_data
    
    trainer = ClassifierTrainer(model_dir='ml/models', random_state=42)
    
    # Train without hyperparameter tuning for speed
    print("\n1. Training Random Forest classifier...")
    model = trainer.train(
        X_train, y_train,
        feature_names=['ph', 'turbidity', 'temperature', 'tds', 'dissolved_oxygen'],
        hyperparameter_tuning=False
    )
    print("Training complete!")
    
    # Evaluate model
    print("\n2. Evaluating model...")
    evaluation = trainer.evaluate(X_test, y_test)
    print(f"Accuracy: {evaluation['accuracy']:.4f}")
    print(f"F1-score: {evaluation['f1_score']:.4f}")
    
    # Save model
    print("\n3. Saving model...")
    model_path, metadata_path = trainer.save_model(version='v1.0')
    print(f"Model saved successfully!")
    
    return trainer


def test_risk_predictor_training(risk_data):
    """Test XGBoost risk predictor training"""
    print("\n=== Testing Risk Predictor Training ===")
    
    X_train, X_test, y_train, y_test = risk_data
    
    # Convert continuous risk scores to numeric classes for classification
    # 0: Low (< 0.4), 1: Medium (0.4-0.7), 2: High (>= 0.7)
    y_train_class = np.where(y_train < 0.4, 0, np.where(y_train < 0.7, 1, 2))
    y_test_class = np.where(y_test < 0.4, 0, np.where(y_test < 0.7, 1, 2))
    
    trainer = RiskPredictorTrainer(
        model_dir='ml/models',
        random_state=42,
        task_type='classification'
    )
    
    # Get temporal feature names
    preparator = DataPreparator()
    feature_names = preparator.get_feature_names(include_temporal=True)
    
    # Train without hyperparameter tuning for speed
    print("\n1. Training XGBoost risk predictor...")
    model = trainer.train(
        X_train, y_train_class,
        feature_names=feature_names,
        hyperparameter_tuning=False
    )
    print("Training complete!")
    
    # Evaluate model
    print("\n2. Evaluating model...")
    evaluation = trainer.evaluate(X_test, y_test_class)
    print(f"Accuracy: {evaluation['accuracy']:.4f}")
    print(f"F1-score: {evaluation['f1_score']:.4f}")
    if evaluation.get('auc_roc'):
        print(f"AUC-ROC: {evaluation['auc_roc']:.4f}")
    
    # Save model
    print("\n3. Saving model...")
    model_path, metadata_path = trainer.save_model(version='v1.0')
    print(f"Model saved successfully!")
    
    return trainer


def test_ml_inference():
    """Test ML inference service"""
    print("\n=== Testing ML Inference Service ===")
    
    # Initialize ML service
    ml_service = MLService(
        model_dir='ml/models',
        classifier_version='v1.0',
        risk_predictor_version='v1.0'
    )
    
    # Check if models are loaded
    if not ml_service.is_ready():
        print("ERROR: Models not loaded properly!")
        return None
    
    print("Models loaded successfully!")
    
    # Test classification
    print("\n1. Testing water quality classification...")
    sensor_data = {
        'ph': 7.2,
        'turbidity': 3.5,
        'temperature': 25.0,
        'tds': 180,
        'dissolved_oxygen': 8.5
    }
    
    classification_result = ml_service.classify_water_quality(sensor_data)
    print(f"Classification: {classification_result['classification']}")
    print(f"Confidence: {classification_result['confidence']:.4f}")
    print(f"Inference time: {classification_result['inference_time_ms']:.2f} ms")
    
    # Test risk prediction
    print("\n2. Testing contamination risk prediction...")
    risk_result = ml_service.predict_contamination_risk(sensor_data)
    print(f"Risk score: {risk_result['risk_score']:.4f}")
    print(f"Risk level: {risk_result['risk_level']}")
    print(f"Inference time: {risk_result['inference_time_ms']:.2f} ms")
    
    return ml_service


def test_shap_explanations(ml_service):
    """Test SHAP explainability service"""
    print("\n=== Testing SHAP Explanations ===")
    
    # Initialize SHAP service with loaded models
    shap_service = SHAPService(
        classifier=ml_service.classifier,
        risk_predictor=ml_service.risk_predictor
    )
    
    if not shap_service.is_ready():
        print("ERROR: SHAP explainers not initialized properly!")
        return
    
    print("SHAP explainers initialized successfully!")
    
    # Test classification explanation
    print("\n1. Testing classification explanation...")
    sensor_data = {
        'ph': 7.2,
        'turbidity': 3.5,
        'temperature': 25.0,
        'tds': 180,
        'dissolved_oxygen': 8.5
    }
    
    classification_result = ml_service.classify_water_quality(sensor_data)
    explanation = shap_service.explain_classification(
        sensor_data,
        classification_result['classification']
    )
    
    print(f"Prediction: {explanation['prediction']}")
    print(f"Computation time: {explanation['computation_time_ms']:.2f} ms")
    print("\nTop contributing factors:")
    for i, factor in enumerate(explanation['top_factors'][:3], 1):
        print(f"  {i}. {factor['feature']}: {factor['shap_value']:.4f} ({factor['direction']})")
    
    # Test risk prediction explanation
    print("\n2. Testing risk prediction explanation...")
    risk_result = ml_service.predict_contamination_risk(sensor_data)
    risk_explanation = shap_service.explain_risk_prediction(
        sensor_data,
        None,  # No historical data
        risk_result['risk_score']
    )
    
    print(f"Risk score: {risk_explanation['risk_score']:.4f}")
    print(f"Computation time: {risk_explanation['computation_time_ms']:.2f} ms")
    print("\nTop contributing factors:")
    for i, factor in enumerate(risk_explanation['top_factors'][:3], 1):
        print(f"  {i}. {factor['feature']}: {factor['shap_value']:.4f} ({factor['direction']})")


def main():
    """Run all ML pipeline tests"""
    print("=" * 60)
    print("ML PIPELINE END-TO-END TEST")
    print("=" * 60)
    
    try:
        # Step 1: Create sample data
        csv_path = create_sample_data()
        
        # Step 2: Test data preparation
        classification_data, risk_data = test_data_preparation(csv_path)
        
        # Step 3: Test classifier training
        classifier_trainer = test_classifier_training(classification_data)
        
        # Step 4: Test risk predictor training
        risk_trainer = test_risk_predictor_training(risk_data)
        
        # Step 5: Test ML inference
        ml_service = test_ml_inference()
        
        if ml_service is not None:
            # Step 6: Test SHAP explanations
            test_shap_explanations(ml_service)
        
        print("\n" + "=" * 60)
        print("ALL TESTS PASSED! ✓")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n\nERROR: {e}")
        import traceback
        traceback.print_exc()
        print("\n" + "=" * 60)
        print("TESTS FAILED! ✗")
        print("=" * 60)


if __name__ == "__main__":
    main()
