"""
Parameter Labeler for ML Training Data

This module labels training data using AquaGuard's documented operational
bands. It is used in the ML training pipeline to add
quality band labels to sensor readings for model training.
"""

import pandas as pd
from typing import Dict
import sys
from pathlib import Path

# Add parent directory to path to import app modules
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.utils.operational_bands import OPERATIONAL_BANDS, classify_parameter


class ParameterLabeler:
    """Label training data with the shared AquaGuard operational bands."""

    def label_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add parameter classification columns to a dataframe

        Args:
            df: DataFrame with columns: ph, turbidity_index, temperature, tds

        Returns:
            DataFrame with added columns:
            - tds_band: TDS quality band
            - turbidity_band: Turbidity quality band
            - temperature_band: Temperature quality band
            - ph_band: pH quality band

        Raises:
            ValueError: If required columns are missing

        Example:
            >>> labeler = ParameterLabeler()
            >>> df = pd.DataFrame({
            ...     'ph': [7.2, 6.0, 8.0],
            ...     'turbidity_index': [5, 15, 80],
            ...     'temperature': [22, 10, 35],
            ...     'tds': [150, 274, 950]
            ... })
            >>> labeled_df = labeler.label_dataframe(df)
            >>> labeled_df['tds_band'].tolist()
            ['Excellent', 'Good', 'Unsafe']
        """
        # Validate required columns
        required_cols = ['ph', 'turbidity_index', 'temperature', 'tds']
        missing_cols = set(required_cols) - set(df.columns)
        if missing_cols:
            raise ValueError(
                f"Missing required columns: {missing_cols}. "
                f"DataFrame must contain: {required_cols}"
            )

        # Create a copy to avoid modifying original
        labeled_df = df.copy()

        # Label each parameter
        labeled_df['tds_band'] = df['tds'].apply(
            lambda x: classify_parameter(x, OPERATIONAL_BANDS.TDS_BANDS).value
        )

        labeled_df['turbidity_band'] = df['turbidity_index'].apply(
            lambda x: classify_parameter(x, OPERATIONAL_BANDS.TURBIDITY_BANDS).value
        )

        labeled_df['temperature_band'] = df['temperature'].apply(
            lambda x: classify_parameter(x, OPERATIONAL_BANDS.TEMPERATURE_BANDS).value
        )

        labeled_df['ph_band'] = df['ph'].apply(
            lambda x: classify_parameter(x, OPERATIONAL_BANDS.PH_BANDS).value
        )

        return labeled_df

    def generate_training_data(
        self,
        input_csv: str,
        output_csv: str
    ) -> pd.DataFrame:
        """
        Generate operational-band labels from raw sensor readings

        Args:
            input_csv: Path to CSV with raw sensor readings
            output_csv: Path to save labeled training data

        Returns:
            Labeled DataFrame

        Raises:
            FileNotFoundError: If input CSV file does not exist
            ValueError: If required columns are missing

        Example:
            >>> labeler = ParameterLabeler()
            >>> labeled_df = labeler.generate_training_data(
            ...     'raw_sensor_data.csv',
            ...     'labeled_training_data.csv'
            ... )
            >>> print(f"Generated {len(labeled_df)} labeled samples")
        """
        # Check if input file exists
        input_path = Path(input_csv)
        if not input_path.exists():
            raise FileNotFoundError(f"Input CSV file not found: {input_csv}")

        # Load raw data
        df = pd.read_csv(input_csv)

        # Validate required columns
        required_cols = ['ph', 'turbidity_index', 'temperature', 'tds']
        missing_cols = set(required_cols) - set(df.columns)
        if missing_cols:
            raise ValueError(
                f"Missing required columns in input CSV: {missing_cols}. "
                f"CSV must contain: {required_cols}"
            )

        # Label data
        labeled_df = self.label_dataframe(df)

        # Save to CSV
        output_path = Path(output_csv)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        labeled_df.to_csv(output_csv, index=False)
        print(f"Labeled training data saved to: {output_csv}")
        print(f"Generated {len(labeled_df)} labeled samples")

        return labeled_df


# Script entry point for command-line usage
if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(
        description="Label sensor data with AquaGuard operational bands"
    )
    parser.add_argument(
        "input_csv",
        help="Path to input CSV file with raw sensor readings"
    )
    parser.add_argument(
        "output_csv",
        help="Path to output CSV file for labeled training data"
    )

    args = parser.parse_args()

    # Create labeler and generate training data
    labeler = ParameterLabeler()
    try:
        labeled_df = labeler.generate_training_data(args.input_csv, args.output_csv)
        print("\nSample labeled data:")
        print(labeled_df.head())
        print("\nLabel distribution:")
        for param in ['tds_band', 'turbidity_band', 'temperature_band', 'ph_band']:
            print(f"\n{param}:")
            print(labeled_df[param].value_counts())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)
