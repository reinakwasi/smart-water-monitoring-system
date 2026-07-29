# Water Quality Monitoring System - Backend

Backend API for the AquaGuard ESP32 water-quality monitoring prototype.

## Active Project Scope

- Physical probes: pH, turbidity index, temperature, and TDS
- Separate ultrasonic tank-level measurement
- Random Forest quality classification and temporal risk prediction (model v2.0)
- Shared AquaGuard operational bands for consistent labels across the API and app
- Device API-key authentication plus user JWT access and refresh tokens

Dissolved oxygen is not part of the active hardware or model input. Some older
file and test identifiers are retained only for backward compatibility.

## Setup

### 1. Install Dependencies

```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 3. Run Server

```bash
python -m app.main
```

Or:
```bash
uvicorn app.main:app --reload
```

### 4. Run Tests

```bash
pytest
```

## API Docs

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Tech Stack

- FastAPI
- MongoDB
- scikit-learn, XGBoost, SHAP
- Python 3.10+
