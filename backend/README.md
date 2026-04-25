# Water Quality Monitoring System - Backend

Intelligent IoT-based water quality monitoring with ML predictions and explainable AI.

## Project Structure

```
backend/
├── app/
│   ├── main.py                 # FastAPI application entry
│   ├── config.py               # Configuration management
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/      # API endpoints
│   ├── models/                 # Pydantic schemas and database models
│   ├── services/               # Business logic services
│   ├── db/                     # Database connection and repositories
│   └── utils/                  # Utility modules
├── ml/
│   ├── models/                 # Trained ML model artifacts
│   └── (training scripts)      # Model training scripts
├── tests/                      # Test suite
├── requirements.txt            # Python dependencies
└── .env                        # Environment variables (create from .env.example)
```

## Setup Instructions

### 1. Create Virtual Environment

```bash
cd backend
python -m venv venv
```

### 2. Activate Virtual Environment

**Windows:**
```bash
venv\Scripts\activate
```

**Linux/Mac:**
```bash
source venv/bin/activate
```

### 3. Install Dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure Environment Variables

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 5. Run the Application

```bash
python -m app.main
```

Or using uvicorn directly:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 6. Run Tests

```bash
pytest
```

With coverage:
```bash
pytest --cov=app --cov-report=html
```

## API Documentation

Once the application is running, visit:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Development

- **Python Version**: 3.10+
- **Framework**: FastAPI
- **Database**: MongoDB
- **ML Libraries**: scikit-learn, XGBoost, SHAP

## Requirements Mapping

This backend service implements:
- Requirement 18.5: Performance and Scalability
- Additional requirements will be implemented in subsequent tasks
