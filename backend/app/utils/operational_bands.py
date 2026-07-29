"""Shared monitoring bands for the water-quality parameters measured by AquaGuard."""

from typing import List, Tuple
from enum import Enum


class ParameterBand(str, Enum):
    """Quality band classifications for water parameters"""

    # App display bands used consistently across the API and mobile app.
    EXCELLENT = "Excellent"
    GOOD = "Good"
    ACCEPTABLE = "Acceptable"
    FAIR = "Fair"
    POOR = "Poor"
    UNSAFE = "Unsafe"
    UNACCEPTABLE = "Unacceptable"
    COLD = "Cold"
    NORMAL = "Normal"
    WARM = "Warm"
    ACIDIC_UNSAFE = "Acidic/Unsafe"
    ALKALINE_UNSAFE = "Alkaline/Unsafe"


class OPERATIONAL_BANDS:
    """Documented bands for the four sensors used by the project."""

    # TDS thresholds (ppm). TDS is treated mainly as a taste/acceptability indicator.
    TDS_BANDS: List[Tuple[float, float, ParameterBand]] = [
        (0, 300, ParameterBand.EXCELLENT),
        (300, 600, ParameterBand.GOOD),
        (600, 900, ParameterBand.FAIR),
        (900, 1200, ParameterBand.POOR),
        (1200, float('inf'), ParameterBand.UNACCEPTABLE),
    ]

    # Turbidity thresholds (NTU). Low turbidity supports clear water and effective treatment.
    TURBIDITY_BANDS: List[Tuple[float, float, ParameterBand]] = [
        (0, 1, ParameterBand.EXCELLENT),
        (1, 5, ParameterBand.ACCEPTABLE),
        (5, 50, ParameterBand.POOR),
        (50, float('inf'), ParameterBand.UNSAFE),
    ]

    # Temperature is monitored for taste, storage, and sensor compensation.
    TEMPERATURE_BANDS: List[Tuple[float, float, ParameterBand]] = [
        (-float('inf'), 15, ParameterBand.COLD),
        (15, 30, ParameterBand.NORMAL),
        (30, float('inf'), ParameterBand.WARM),
    ]

    # pH thresholds. The normal operational range used for drinking-water monitoring is 6.5-8.5.
    PH_BANDS: List[Tuple[float, float, ParameterBand]] = [
        (0, 6.5, ParameterBand.ACIDIC_UNSAFE),
        (6.5, 8.5, ParameterBand.GOOD),
        (8.5, 14, ParameterBand.ALKALINE_UNSAFE),
    ]




def classify_parameter(value: float, bands: List[Tuple[float, float, ParameterBand]]) -> ParameterBand:
    """
    Classify a parameter value into a quality band

    Args:
        value: The parameter value to classify
        bands: List of (min, max, band) tuples defining classification ranges

    Returns:
        The ParameterBand classification

    Note:
        - Lower bounds are inclusive, upper bounds are exclusive (except for last band)
        - For pH GOOD band specifically, the upper bound (8.5) is inclusive

    Example:
        >>> classify_parameter(274, OPERATIONAL_BANDS.TDS_BANDS)
        ParameterBand.GOOD

        >>> classify_parameter(7.2, OPERATIONAL_BANDS.PH_BANDS)
        ParameterBand.GOOD
    """
    for min_val, max_val, band in bands:
        # Special case: pH GOOD band has inclusive upper bound at 8.5
        # Check if this is pH GOOD band by looking at specific threshold values
        if band == ParameterBand.GOOD and min_val == 6.5 and max_val == 8.5:
            # pH GOOD band: [6.5, 8.5] (inclusive on both ends)
            if value >= min_val and value <= max_val:
                return band
        # Standard case: inclusive lower bound, exclusive upper bound
        elif value >= min_val and value < max_val:
            return band

    # Fallback (should not reach here if bands cover all ranges)
    return bands[-1][2]
