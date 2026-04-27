# Water Quality Monitoring System - Backend

Backend API for water quality monitoring with ML predictions.

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
