"""Train the deployable four-sensor AquaGuard models.

The saved v1 models used a legacy dissolved-oxygen feature. This script creates
new versioned artifacts using only the probes present on the ESP32: pH,
turbidity index, temperature, and TDS. It never overwrites the v1 artifacts.
"""

from pathlib import Path

import numpy as np
import pandas as pd

from ml.classifier_trainer import ClassifierTrainer
from ml.data_preparation import DataPreparator
from ml.risk_predictor_trainer import RiskPredictorTrainer


ROOT = Path(__file__).resolve().parents[1]
DATASET = ROOT / "ml" / "data" / "sample_training_data.csv"
MODEL_DIR = ROOT / "ml" / "models"
MODEL_VERSION = "v2.0"


def operational_classification(frame: pd.DataFrame) -> np.ndarray:
    """Create the three project labels from the configured operating bands."""
    unsafe = (
        (frame["ph"] < 6.5)
        | (frame["ph"] > 8.5)
        | (frame["turbidity_index"] >= 75)
        | (frame["temperature"] < 5)
        | (frame["temperature"] >= 35)
        | (frame["tds"] >= 900)
    )
    warning = (
        (frame["turbidity_index"] >= 25)
        | (frame["temperature"] < 15)
        | (frame["temperature"] >= 30)
        | (frame["tds"] >= 300)
    )
    return np.where(unsafe, "Unsafe", np.where(warning, "Warning", "Safe"))


def main() -> None:
    preparator = DataPreparator(random_state=42)
    frame = preparator.load_csv_data(str(DATASET))
    frame["quality_classification"] = operational_classification(frame)

    classification_features, classification_target = preparator.extract_classification_features(frame)
    x_train, x_test, y_train, y_test = preparator.train_test_split_stratified(
        classification_features,
        classification_target,
        test_size=0.2,
        stratify=True,
    )

    classifier = ClassifierTrainer(model_dir=str(MODEL_DIR), random_state=42)
    classifier.train(
        x_train,
        y_train,
        feature_names=preparator.get_feature_names(),
        hyperparameter_tuning=False,
    )
    classifier_report = classifier.generate_evaluation_report(x_train, y_train, x_test, y_test)
    classifier.save_model(
        MODEL_VERSION,
        metadata={
            "evaluation": classifier_report,
            "sensor_count": 4,
            "training_source": "project sample dataset with deterministic operational labels",
            "intended_use": "prototype monitoring and decision support",
        },
    )

    temporal_features, risk_scores = preparator.extract_temporal_features(frame, window_size=10)
    risk_levels = np.digitize(risk_scores.astype(float), bins=[0.4, 0.7]).astype(int)
    rx_train, rx_test, ry_train, ry_test = preparator.train_test_split_stratified(
        temporal_features,
        risk_levels,
        test_size=0.2,
        stratify=True,
    )

    risk_predictor = RiskPredictorTrainer(
        model_dir=str(MODEL_DIR),
        random_state=42,
        task_type="classification",
    )
    risk_predictor.train(
        rx_train,
        ry_train,
        feature_names=preparator.get_feature_names(include_temporal=True),
        hyperparameter_tuning=False,
    )
    risk_report = risk_predictor.generate_evaluation_report(
        rx_train,
        ry_train,
        rx_test,
        ry_test,
    )
    risk_predictor.save_model(
        MODEL_VERSION,
        metadata={
            "evaluation": risk_report,
            "sensor_count": 4,
            "training_source": "project sample dataset",
            "intended_use": "prototype contamination-risk trend estimation",
        },
    )

    print("Four-sensor models trained and saved as v2.0")


if __name__ == "__main__":
    main()
