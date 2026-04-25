@echo off
REM Setup script for Windows

echo Setting up Water Quality Monitoring System Backend...

REM Create virtual environment
echo Creating virtual environment...
py -m venv venv

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Upgrade pip
echo Upgrading pip...
py -m pip install --upgrade pip

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt

REM Create .env file if it doesn't exist
if not exist .env (
    echo Creating .env file from template...
    copy .env.example .env
    echo Please edit .env with your configuration
)

echo.
echo Setup complete!
echo.
echo To activate the virtual environment, run:
echo   venv\Scripts\activate
echo.
echo To start the application, run:
echo   python -m app.main
echo.
echo To run tests, run:
echo   pytest

pause
