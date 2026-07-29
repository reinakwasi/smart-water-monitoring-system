@echo off
REM Quick start script for the backend server

cd /d "%~dp0"

echo Starting AquaGuard backend server...
if not exist ".venv\Scripts\python.exe" (
    echo Project Python was not found.
    echo Please run setup first or ask Codex to recreate the backend environment.
    pause
    exit /b 1
)

".venv\Scripts\python.exe" -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8080

pause