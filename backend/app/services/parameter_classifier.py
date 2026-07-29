"""Classify sensor readings using AquaGuard's shared monitoring bands."""

from typing import Dict
from app.utils.operational_bands import (
    OPERATIONAL_BANDS,
    ParameterBand,
    classify_parameter
)


class ParameterClassifierService:
    """Service for classifying water quality parameters using shared operational bands"""

    def classify_reading(
        self,
        ph: float,
        turbidity_index: float,
        temperature: float,
        tds: float
    ) -> Dict[str, ParameterBand]:
        """
        Classify all parameters in a sensor reading

        Args:
            ph: pH value (0-14)
            turbidity_index: Turbidity in NTU
            temperature: Temperature in Celsius
            tds: Total Dissolved Solids in ppm

        Returns:
            Dictionary mapping parameter names to quality bands:
            {
                "ph": ParameterBand.EXCELLENT,
                "turbidity_index": ParameterBand.GOOD,
                "temperature": ParameterBand.ACCEPTABLE,
                "tds": ParameterBand.GOOD
            }

        Example:
            pH 7.2 -> Good
            turbidity 15.5 NTU -> Poor
            temperature 22.3 C -> Normal
            TDS 274 ppm -> Excellent
        """
        return {
            "ph": classify_parameter(ph, OPERATIONAL_BANDS.PH_BANDS),
            "turbidity_index": classify_parameter(turbidity_index, OPERATIONAL_BANDS.TURBIDITY_BANDS),
            "temperature": classify_parameter(temperature, OPERATIONAL_BANDS.TEMPERATURE_BANDS),
            "tds": classify_parameter(tds, OPERATIONAL_BANDS.TDS_BANDS)
        }

    def get_threshold_config(self) -> Dict:
        """
        Get operational band configuration for frontend/API consumers

        Returns:
            Dictionary representation of the operational bands suitable for JSON serialization.
            Each parameter has a list of threshold bands with min, max, and band label.
            Infinity values are converted to None for JSON compatibility.

        Example:
            >>> service = ParameterClassifierService()
            config["tds"][0] == {"min": 0, "max": 300, "band": "Excellent"}
        """
        def convert_value(val: float) -> float:
            """Convert infinity values to None for JSON compatibility"""
            if val == float('inf') or val == float('-inf'):
                return None
            return val

        return {
            "tds": [
                {
                    "min": convert_value(min_val),
                    "max": convert_value(max_val),
                    "band": band.value
                }
                for min_val, max_val, band in OPERATIONAL_BANDS.TDS_BANDS
            ],
            "turbidity_index": [
                {
                    "min": convert_value(min_val),
                    "max": convert_value(max_val),
                    "band": band.value
                }
                for min_val, max_val, band in OPERATIONAL_BANDS.TURBIDITY_BANDS
            ],
            "temperature": [
                {
                    "min": convert_value(min_val),
                    "max": convert_value(max_val),
                    "band": band.value
                }
                for min_val, max_val, band in OPERATIONAL_BANDS.TEMPERATURE_BANDS
            ],
            "ph": [
                {
                    "min": convert_value(min_val),
                    "max": convert_value(max_val),
                    "band": band.value
                }
                for min_val, max_val, band in OPERATIONAL_BANDS.PH_BANDS
            ]
        }
