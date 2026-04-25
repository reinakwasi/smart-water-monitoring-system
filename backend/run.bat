@echo off
REM Quick start script for the backend server

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo Starting FastAPI server...
python -m app.main

pause
