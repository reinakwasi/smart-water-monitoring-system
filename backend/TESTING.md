# Testing Guide for Water Quality Monitoring System

## Test Status

### ✅ Unit Tests (8/8 Passing)
All authentication service unit tests pass without requiring MongoDB:
- Password hashing and verification
- JWT token creation and validation
- Token expiration handling

Run unit tests only:
```bash
pytest backend/tests/test_auth.py::TestAuthService -v
```

### 🔄 Integration Tests (Require MongoDB)
Integration tests require a running MongoDB instance to test the full authentication flow including database operations.

## Setting Up MongoDB for Testing

### Option 1: Install MongoDB Locally (Recommended for Development)

1. **Download MongoDB Community Server**:
   - Visit: https://www.mongodb.com/try/download/community
   - Download the Windows installer
   - Install with default settings

2. **Start MongoDB**:
   ```bash
   # MongoDB should start automatically as a Windows service
   # Or manually start it:
   net start MongoDB
   ```

3. **Verify MongoDB is running**:
   ```bash
   # Should connect successfully
   mongosh
   ```

### Option 2: Use MongoDB Docker Container

If you have Docker installed:

```bash
# Start MongoDB container
docker run -d -p 27017:27017 --name mongodb mongo:latest

# Stop MongoDB container
docker stop mongodb

# Remove MongoDB container
docker rm mongodb
```

### Option 3: Use MongoDB Atlas (Cloud)

1. Create a free account at https://www.mongodb.com/cloud/atlas
2. Create a free cluster
3. Get your connection string
4. Update `backend/.env`:
   ```
   MONGODB_URL=mongodb+srv://username:password@cluster.mongodb.net/water_quality_db
   ```

## Running Tests

### Run All Tests (Requires MongoDB)
```bash
cd backend
pytest tests/test_auth.py -v
```

### Run Only Unit Tests (No MongoDB Required)
```bash
cd backend
pytest tests/test_auth.py::TestAuthService -v
```

### Run Specific Test
```bash
cd backend
pytest tests/test_auth.py::TestAuthEndpoints::test_login_success -v
```

### Run with Coverage
```bash
cd backend
pytest tests/test_auth.py --cov=app --cov-report=html
```

## Test Results Summary

### Current Status (Without MongoDB)
- ✅ **8/8 unit tests passing** - Core authentication logic works
- ⏸️ **12 integration tests pending** - Require MongoDB connection
- 🔧 **1 test fixed** - `test_refresh_token_no_auth` now expects correct 401 status

### Expected Results (With MongoDB Running)
All 20 tests should pass:
- 8 unit tests for auth service
- 12 integration tests for API endpoints and dependencies

## Test Coverage

The test suite covers:

1. **Password Security**:
   - Bcrypt hashing with cost factor 12
   - Password verification
   - Hash uniqueness

2. **JWT Token Management**:
   - Token creation with expiration
   - Token validation and decoding
   - Expired token handling
   - Invalid token handling

3. **User Registration**:
   - Successful registration
   - Duplicate email prevention
   - Password validation (min 8 chars)
   - Default role assignment

4. **User Login**:
   - Successful authentication
   - Invalid email handling
   - Invalid password handling
   - Token issuance

5. **Token Refresh**:
   - Valid token refresh
   - Missing authentication handling
   - Invalid token handling

6. **Authorization**:
   - Current user extraction from token
   - Admin role enforcement

## Troubleshooting

### MongoDB Connection Errors
```
pymongo.errors.ServerSelectionTimeoutError: localhost:27017
```
**Solution**: Start MongoDB service or use Docker container

### Database Not Connected
```
RuntimeError: Database not connected. Call connect() first.
```
**Solution**: The test fixtures should handle this, but ensure MongoDB is running

### Import Errors
```
ModuleNotFoundError: No module named 'app'
```
**Solution**: Run tests from the `backend` directory or install the package in development mode:
```bash
cd backend
pip install -e .
```

## Next Steps

1. **Start MongoDB** using one of the options above
2. **Run the full test suite** to verify all 20 tests pass
3. **Continue with Task 4** - Checkpoint to ensure all tests pass

## Manual Testing with API

Once MongoDB is running, you can also test the API manually:

1. **Start the backend server**:
   ```bash
   cd backend
   python -m app.main
   ```

2. **Test registration**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/register \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123","full_name":"Test User"}'
   ```

3. **Test login**:
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email":"test@example.com","password":"testpass123"}'
   ```

4. **Test token refresh** (use token from login response):
   ```bash
   curl -X POST http://localhost:8000/api/v1/auth/refresh \
     -H "Authorization: Bearer YOUR_TOKEN_HERE"
   ```
