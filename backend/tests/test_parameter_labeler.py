"""Tests for ParameterLabeler source-aligned bands."""

import sys
from pathlib import Path

import pandas as pd
import pytest

sys.path.insert(0, str(Path(__file__).parent.parent))

from ml.parameter_labeler import ParameterLabeler


@pytest.fixture
def labeler():
    return ParameterLabeler()


def test_label_dataframe_adds_expected_columns(labeler):
    df = pd.DataFrame({
        'ph': [7.2],
        'turbidity_index': [3],
        'temperature': [22],
        'tds': [274],
    })

    labeled = labeler.label_dataframe(df)

    assert {'tds_band', 'turbidity_band', 'temperature_band', 'ph_band'}.issubset(labeled.columns)
    assert {'ph', 'turbidity_index', 'temperature', 'tds'}.issubset(labeled.columns)


def test_label_dataframe_uses_correct_bands(labeler):
    df = pd.DataFrame({
        'ph': [6.4, 7.2, 8.6],
        'turbidity_index': [0.5, 3, 60],
        'temperature': [10, 22, 31],
        'tds': [274, 650, 1250],
    })

    labeled = labeler.label_dataframe(df)

    assert labeled['ph_band'].tolist() == ['Acidic/Unsafe', 'Good', 'Alkaline/Unsafe']
    assert labeled['turbidity_band'].tolist() == ['Excellent', 'Acceptable', 'Unsafe']
    assert labeled['temperature_band'].tolist() == ['Cold', 'Normal', 'Warm']
    assert labeled['tds_band'].tolist() == ['Excellent', 'Fair', 'Unacceptable']


def test_label_dataframe_does_not_modify_original(labeler):
    df = pd.DataFrame({
        'ph': [7.0],
        'turbidity_index': [3],
        'temperature': [22],
        'tds': [300],
    })
    original_columns = set(df.columns)

    labeled = labeler.label_dataframe(df)

    assert set(df.columns) == original_columns
    assert 'tds_band' in labeled.columns
    assert 'tds_band' not in df.columns


def test_missing_columns_raise_error(labeler):
    df = pd.DataFrame({'ph': [7.0], 'turbidity_index': [3]})

    with pytest.raises(ValueError, match='Missing required columns'):
        labeler.label_dataframe(df)
