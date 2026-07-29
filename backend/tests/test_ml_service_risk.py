from unittest.mock import Mock

import numpy as np
import pytest

from ml.ml_service import MLService


def build_service(probabilities):
    service = MLService.__new__(MLService)
    service.classification_features = ['ph', 'turbidity_index', 'temperature', 'tds']
    service.risk_predictor = Mock()
    service.risk_predictor.classes_ = np.array([0, 1, 2])
    service.risk_predictor.predict_proba.return_value = np.array([probabilities])
    service.risk_predictor_metadata = {'task_type': 'classification'}
    service.risk_predictor_version = 'test'
    return service


READING = {
    'ph': 7.2,
    'turbidity_index': 4.0,
    'temperature': 25.0,
    'tds': 200.0,
}


def test_low_risk_confidence_does_not_become_high_risk_score():
    service = build_service([0.90, 0.08, 0.02])

    result = service.predict_contamination_risk(READING)

    assert result['risk_score'] == pytest.approx(0.06)
    assert result['risk_level'] == 'Low'


def test_probability_weighted_score_can_represent_high_risk():
    service = build_service([0.02, 0.20, 0.78])

    result = service.predict_contamination_risk(READING)

    assert result['risk_score'] == pytest.approx(0.88)
    assert result['risk_level'] == 'High'
