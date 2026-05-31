@echo off
echo ========================================
echo   AquaGuard Backend Server
echo ========================================
echo.
echo Starting backend server...
echo Server will run on http://0.0.0.0:8000
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

pause
