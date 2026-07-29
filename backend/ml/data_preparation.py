"""Data preparation module for ML model training

This module handles loading training data, feature extraction, and train/test splitting
for both the water quality classifier and contamination risk predictor."""

import pandas as pd
import numpy as np
from typing import Tuple, List, Optional
from sklearn.model_selection import train_test_split
from pathlib import Path
import sys

# Add parent directory to path to import parameter_labeler
sys.path.insert(0, str(Path(__file__).parent))
from parameter_labeler import ParameterLabeler


class DataPreparator:
    """
    Data preparation class for ML training pipeline

    Handles:
    - Loading CSV training data
    - Feature extraction for classification (4 sensor parameters)
    - Temporal feature extraction for risk prediction (current + mean/std/trend)
    - Train/test split with stratification    """

    def __init__(self, random_state: int = 42):
        """
        Initialize DataPreparator

        Args:
            random_state: Random seed for reproducibility
        """
        self.random_state = random_state
        self.parameter_labeler = ParameterLabeler()

        # Feature columns for classification (4 sensor parameters)
        # Note: Using 'turbidity_index' to match API schema and ParameterLabeler
        self.classification_features = [
            'ph',
            'turbidity_index',
            'temperature',
            'tds'
        ]

        # Target column for classification
        self.classification_target = 'quality_classification'

        # Target column for risk prediction
        self.risk_target = 'contamination_risk'

    def load_csv_data(self, filepath: str, normalize_columns: bool = True) -> pd.DataFrame:
        """
        Load training data from CSV file
        Args:
            filepath: Path to CSV file containing training data
            normalize_columns: If True, rename 'turbidity' to 'turbidity_index' for consistency

        Returns:
            DataFrame with loaded data

        Raises:
            FileNotFoundError: If CSV file does not exist
            ValueError: If required columns are missing
        """
        # Check if file exists
        if not Path(filepath).exists():
            raise FileNotFoundError(f"Training data file not found: {filepath}")

        # Load CSV
        df = pd.read_csv(filepath)

        # Normalize column names for consistency with API schema
        if normalize_columns and 'turbidity' in df.columns and 'turbidity_index' not in df.columns:
            df = df.rename(columns={'turbidity': 'turbidity_index'})
            print("Normalized column name: 'turbidity' → 'turbidity_index'")

        # Validate required columns for classification
        missing_features = set(self.classification_features) - set(df.columns)
        if missing_features:
            raise ValueError(
                f"Missing required feature columns: {missing_features}"
            )

        return df

    def add_operational_labels(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Add AquaGuard operational-band labels to training data

        This method uses the ParameterLabeler to add quality band labels
        (e.g., "Excellent", "Good", "Acceptable", "Poor", "Unsafe") for each
        water-quality parameter. These documented project bands make labels
        consistent across training, the API, and the mobile application.

        Args:
            df: DataFrame containing sensor readings with columns:
                - ph: pH value (0-14)
                - turbidity_index: Turbidity in NTU
                - temperature: Temperature in Celsius
                - tds: Total Dissolved Solids in ppm

        Returns:
            DataFrame with operational-band label columns:
            - tds_band: TDS quality band (e.g., "Good", "Excellent")
            - turbidity_band: Turbidity quality band
            - temperature_band: Temperature quality band
            - ph_band: pH quality band

        Raises:
            ValueError: If required columns are missing

        Example:
            >>> preparator = DataPreparator()
            >>> df = preparator.load_csv_data('data/training.csv')
            >>> labeled_df = preparator.add_operational_labels(df)
            >>> print(labeled_df[['tds', 'tds_band']].head())
                 tds    tds_band
            0  274.0        Good
            1  150.0   Excellent
            2  950.0      Unsafe
        """
        print("Adding AquaGuard operational-band labels to training data...")

        # Validate required columns exist
        required_cols = ['ph', 'turbidity_index', 'temperature', 'tds']
        missing_cols = set(required_cols) - set(df.columns)
        if missing_cols:
            raise ValueError(
                f"Cannot add operational labels. Missing required columns: {missing_cols}"
            )

        # Use ParameterLabeler to add classification columns
        labeled_df = self.parameter_labeler.label_dataframe(df)

        print(f"Added operational-band labels for {len(labeled_df)} samples")
        print("Label distribution:")
        for band_col in ['tds_band', 'turbidity_band', 'temperature_band', 'ph_band']:
            if band_col in labeled_df.columns:
                print(f"  {band_col}:")
                for label, count in labeled_df[band_col].value_counts().items():
                    print(f"    {label}: {count}")

        return labeled_df

    def extract_classification_features(
        self,
        df: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract features for water quality classification

        Uses the 4 installed sensor parameters as input features:
        - pH
        - Turbidity
        - Temperature
        - TDS (Total Dissolved Solids)

        Args:
            df: DataFrame containing sensor readings and labels

        Returns:
            Tuple of (X, y) where:
                X: Feature matrix (n_samples, 4)
                y: Target labels (n_samples,)

        Raises:
            ValueError: If target column is missing
        """
        # Validate target column exists
        if self.classification_target not in df.columns:
            raise ValueError(
                f"Target column '{self.classification_target}' not found in data"
            )

        # Extract features
        X = df[self.classification_features].values

        # Extract target
        y = df[self.classification_target].values

        return X, y

    def extract_temporal_features(
        self,
        df: pd.DataFrame,
        window_size: int = 10
    ) -> Tuple[np.ndarray, np.ndarray]:
        """
        Extract temporal features for contamination risk prediction

        Creates features that include:
        - Current sensor readings (4 features)
        - Mean of last N readings (4 features)
        - Standard deviation of last N readings (4 features)
        - Trend (slope) of last N readings (4 features)

        Total: 16 features per sample

        Args:
            df: DataFrame containing sensor readings and risk labels
            window_size: Number of historical readings to use for temporal features

        Returns:
            Tuple of (X, y) where:
                X: Feature matrix (n_samples, 16)
                y: Target risk scores (n_samples,)

        Raises:
            ValueError: If target column is missing or insufficient data
        """
        # Validate target column exists
        if self.risk_target not in df.columns:
            raise ValueError(
                f"Target column '{self.risk_target}' not found in data"
            )

        # Validate sufficient data for temporal features
        if len(df) < window_size:
            raise ValueError(
                f"Insufficient data for temporal features. "
                f"Need at least {window_size} samples, got {len(df)}"
            )

        # Sort by timestamp if available
        if 'timestamp' in df.columns:
            df = df.sort_values('timestamp').reset_index(drop=True)

        # Initialize feature list
        temporal_features = []
        targets = []

        # Compute temporal features for each sample
        for i in range(window_size, len(df)):
            # Get window of historical data
            window = df.iloc[i - window_size:i]
            current = df.iloc[i]

            # Current readings (4 features)
            current_features = current[self.classification_features].values

            # Mean of window (4 features)
            mean_features = window[self.classification_features].mean().values

            # Standard deviation of window (4 features)
            std_features = window[self.classification_features].std().values

            # Trend (slope) of window (4 features)
            trend_features = []
            for feature in self.classification_features:
                # Simple linear trend: (last - first) / window_size
                trend = (window[feature].iloc[-1] - window[feature].iloc[0]) / window_size
                trend_features.append(trend)
            trend_features = np.array(trend_features)

            # Concatenate all features
            sample_features = np.concatenate([
                current_features,
                mean_features,
                std_features,
                trend_features
            ])

            temporal_features.append(sample_features)
            targets.append(current[self.risk_target])

        X = np.array(temporal_features)
        y = np.array(targets)

        return X, y

    def train_test_split_stratified(
        self,
        X: np.ndarray,
        y: np.ndarray,
        test_size: float = 0.2,
        stratify: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Split data into training and test sets with optional stratification

        Args:
            X: Feature matrix
            y: Target labels or scores
            test_size: Proportion of data to use for testing (default 0.2)
            stratify: Whether to stratify split by target classes (default True)

        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        # For classification, stratify by class labels
        # For regression, stratify by binned target values
        stratify_by = None
        if stratify:
            # Check if target is categorical (classification)
            if y.dtype == object or len(np.unique(y)) < 20:
                stratify_by = y
            else:
                # For continuous targets (risk scores), bin into quartiles
                stratify_by = pd.qcut(y, q=4, labels=False, duplicates='drop')

        X_train, X_test, y_train, y_test = train_test_split(
            X, y,
            test_size=test_size,
            random_state=self.random_state,
            stratify=stratify_by
        )

        return X_train, X_test, y_train, y_test

    def prepare_classification_data(
        self,
        filepath: str,
        test_size: float = 0.2,
        add_operational_labels: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Complete pipeline for preparing classification training data

        Args:
            filepath: Path to CSV file containing training data
            test_size: Proportion of data to use for testing
            add_operational_labels: Add the shared operational-band labels before training

        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        # Load data
        df = self.load_csv_data(filepath)

        # Add operational-band labels if requested
        if add_operational_labels:
            df = self.add_operational_labels(df)

        # Extract features
        X, y = self.extract_classification_features(df)

        # Split data
        X_train, X_test, y_train, y_test = self.train_test_split_stratified(
            X, y, test_size=test_size, stratify=True
        )

        return X_train, X_test, y_train, y_test

    def prepare_risk_prediction_data(
        self,
        filepath: str,
        window_size: int = 10,
        test_size: float = 0.2,
        add_operational_labels: bool = True
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
        """
        Complete pipeline for preparing risk prediction training data

        Args:
            filepath: Path to CSV file containing training data
            window_size: Number of historical readings for temporal features
            test_size: Proportion of data to use for testing
            add_operational_labels: Add the shared operational-band labels before training

        Returns:
            Tuple of (X_train, X_test, y_train, y_test)
        """
        # Load data
        df = self.load_csv_data(filepath)

        # Add operational-band labels if requested
        if add_operational_labels:
            df = self.add_operational_labels(df)

        # Extract temporal features
        X, y = self.extract_temporal_features(df, window_size=window_size)

        # Split data
        X_train, X_test, y_train, y_test = self.train_test_split_stratified(
            X, y, test_size=test_size, stratify=True
        )

        return X_train, X_test, y_train, y_test

    def get_feature_names(self, include_temporal: bool = False) -> List[str]:
        """
        Get feature names for the model

        Args:
            include_temporal: If True, return temporal feature names (16 features)
                            If False, return classification feature names (4 features)

        Returns:
            List of feature names
        """
        if not include_temporal:
            return self.classification_features.copy()

        # Temporal features: current + mean + std + trend
        feature_names = []

        # Current features
        feature_names.extend([f"{f}_current" for f in self.classification_features])

        # Mean features
        feature_names.extend([f"{f}_mean" for f in self.classification_features])

        # Std features
        feature_names.extend([f"{f}_std" for f in self.classification_features])

        # Trend features
        feature_names.extend([f"{f}_trend" for f in self.classification_features])

        return feature_names
