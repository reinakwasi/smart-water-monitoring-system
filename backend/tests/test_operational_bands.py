"""Tests for source-aligned operational water-quality bands."""

from app.utils.operational_bands import OPERATIONAL_BANDS, ParameterBand, classify_parameter


def test_tds_uses_who_palatability_bands():
    assert classify_parameter(0, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.EXCELLENT
    assert classify_parameter(299.9, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.EXCELLENT
    assert classify_parameter(300, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.GOOD
    assert classify_parameter(600, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.FAIR
    assert classify_parameter(900, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.POOR
    assert classify_parameter(1200, OPERATIONAL_BANDS.TDS_BANDS) == ParameterBand.UNACCEPTABLE


def test_turbidity_uses_clear_water_ntu_bands():
    assert classify_parameter(0.5, OPERATIONAL_BANDS.TURBIDITY_BANDS) == ParameterBand.EXCELLENT
    assert classify_parameter(1, OPERATIONAL_BANDS.TURBIDITY_BANDS) == ParameterBand.ACCEPTABLE
    assert classify_parameter(5, OPERATIONAL_BANDS.TURBIDITY_BANDS) == ParameterBand.POOR
    assert classify_parameter(50, OPERATIONAL_BANDS.TURBIDITY_BANDS) == ParameterBand.UNSAFE


def test_temperature_is_monitoring_not_health_safety_band():
    assert classify_parameter(10, OPERATIONAL_BANDS.TEMPERATURE_BANDS) == ParameterBand.COLD
    assert classify_parameter(22, OPERATIONAL_BANDS.TEMPERATURE_BANDS) == ParameterBand.NORMAL
    assert classify_parameter(30, OPERATIONAL_BANDS.TEMPERATURE_BANDS) == ParameterBand.WARM


def test_ph_uses_6_5_to_8_5_operational_guide():
    assert classify_parameter(6.49, OPERATIONAL_BANDS.PH_BANDS) == ParameterBand.ACIDIC_UNSAFE
    assert classify_parameter(6.5, OPERATIONAL_BANDS.PH_BANDS) == ParameterBand.GOOD
    assert classify_parameter(8.5, OPERATIONAL_BANDS.PH_BANDS) == ParameterBand.GOOD
    assert classify_parameter(8.51, OPERATIONAL_BANDS.PH_BANDS) == ParameterBand.ALKALINE_UNSAFE


def test_bands_are_contiguous():
    for bands in [
        OPERATIONAL_BANDS.TDS_BANDS,
        OPERATIONAL_BANDS.TURBIDITY_BANDS,
        OPERATIONAL_BANDS.TEMPERATURE_BANDS,
        OPERATIONAL_BANDS.PH_BANDS,
    ]:
        for current, following in zip(bands, bands[1:]):
            assert current[1] == following[0]
