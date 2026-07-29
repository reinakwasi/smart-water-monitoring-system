@echo off
echo ========================================
echo   AquaGuard Backend Server
echo ========================================
echo.
echo Starting backend server...
echo Server will run on http://0.0.0.0:8080
echo.
echo Press Ctrl+C to stop the server
echo ========================================
echo.

cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
    echo Project Python was not found.
    echo Please run setup first or ask Codex to recreate the backend environment.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

pause