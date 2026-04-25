# Backend Setup Guide

## Prerequisites

Before setting up the backend, ensure you have:

1. **Python 3.10 or higher** installed
   - Download from: https://www.python.org/downloads/
   - Verify installation: `python --version` or `python3 --version`

2. **MongoDB** installed and running
   - Download from: https://www.mongodb.com/try/download/community
   - Or use MongoDB Atlas (cloud): https://www.mongodb.com/cloud/atlas

3. **Git** (optional, for version control)

## Quick Setup

### Option 1: Automated Setup (Recommended)

**Windows:**
```bash
cd backend
setup.bat
```

**Linux/Mac:**
```bash
cd backend
chmod +x setup.sh
./setup.sh
```

### Option 2: Manual Setup

#### Step 1: Create Virtual Environment

**Windows:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate
```

**Linux/Mac:**
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
```

#### Step 2: Install Dependencies

```bash
pip install --upgrade pip
pip install -r requirements.txt
```

#### Step 3: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` file with your configuration:
- Set `MONGODB_URL` to your MongoDB connection string
- Set `JWT_SECRET_KEY` to a secure random string
- Configure other settings as needed

#### Step 4: Verify Installation

```bash
pytest
```

All tests should pass.

#### Step 5: Run the Application

```bash
python -m app.main
```

The API will be available at:
- API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Project Structure Created

```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                 # FastAPI application entry point
│   ├── config.py               # Configuration with pydantic-settings
│   ├── api/
│   │   └── v1/
│   │       └── endpoints/      # API endpoints (to be implemented)
│   ├── models/                 # Pydantic schemas (to be implemented)
│   ├── services/               # Business logic (to be implemented)
│   ├── db/                     # Database layer (to be implemented)
│   └── utils/
│       ├── __init__.py
│       └── logger.py           # Structured JSON logging
├── ml/
│   ├── __init__.py
│   └── models/                 # ML model artifacts directory
├── tests/
│   ├── __init__.py
│   ├── conftest.py             # Pytest fixtures
│   └── test_main.py            # Basic tests
├── requirements.txt            # Python dependencies
├── .env.example                # Environment variables template
├── .gitignore                  # Git ignore rules
├── pytest.ini                  # Pytest configuration
└── README.md                   # Project documentation
```

## Installed Dependencies

### Core Framework
- **FastAPI**: Modern web framework for building APIs
- **Uvicorn**: ASGI server for running FastAPI
- **Pydantic**: Data validation using Python type hints
- **Pydantic-settings**: Settings management from environment variables

### Database
- **Motor**: Async MongoDB driver for Python
- **PyMongo**: MongoDB driver (Motor dependency)

### ML Libraries
- **scikit-learn**: Machine learning library for Random Forest
- **XGBoost**: Gradient boosting library for risk prediction
- **SHAP**: Explainable AI library
- **NumPy**: Numerical computing
- **Pandas**: Data manipulation
- **Joblib**: Model serialization

### Authentication
- **python-jose**: JWT token handling
- **passlib**: Password hashing with bcrypt

### Testing
- **pytest**: Testing framework
- **pytest-asyncio**: Async test support
- **pytest-cov**: Code coverage
- **hypothesis**: Property-based testing

### Utilities
- **httpx**: HTTP client for FCM notifications
- **python-dotenv**: Environment variable loading

## Features Implemented

✅ FastAPI application with basic structure
✅ Configuration management using pydantic-settings
✅ Structured JSON logging
✅ Environment variable support
✅ CORS middleware
✅ Application lifespan management
✅ Basic health check endpoint
✅ Test infrastructure with pytest
✅ Project directory structure

## Next Steps

After completing this setup, you can proceed to:

1. **Task 2**: Implement MongoDB connection and database models
2. **Task 3**: Implement authentication and authorization
3. **Task 5**: Prepare ML training pipeline
4. And continue with remaining tasks...

## Troubleshooting

### Python not found
- Ensure Python 3.10+ is installed and added to PATH
- Try `python3` instead of `python` on Linux/Mac

### pip install fails
- Upgrade pip: `pip install --upgrade pip`
- Try installing packages individually if bulk install fails

### MongoDB connection error
- Ensure MongoDB is running: `mongod` or check MongoDB service
- Verify `MONGODB_URL` in `.env` file

### Import errors
- Ensure virtual environment is activated
- Reinstall dependencies: `pip install -r requirements.txt`

## Development Commands

```bash
# Activate virtual environment
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows

# Run application
python -m app.main

# Run with auto-reload (development)
uvicorn app.main:app --reload

# Run tests
pytest

# Run tests with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_main.py

# Format code (install black first: pip install black)
black app/ tests/

# Lint code (install flake8 first: pip install flake8)
flake8 app/ tests/
```

## Support

For issues or questions:
1. Check the main README.md
2. Review the requirements.md and design.md in .kiro/specs/
3. Consult the API documentation at /docs when running
