@echo off
echo ===================================================
echo Adding Windows Firewall Rule for Python Port 8000
echo ===================================================
echo.
echo This script requires Administrator privileges.
echo Right-click and select "Run as Administrator"
echo.
pause

netsh advfirewall firewall add rule name="Python Backend Port 8000" dir=in action=allow protocol=TCP localport=8000 profile=any

echo.
if %errorlevel% == 0 (
    echo SUCCESS: Firewall rule added successfully!
    echo Your mobile app should now be able to connect.
) else (
    echo ERROR: Failed to add firewall rule.
    echo Make sure you're running as Administrator.
)
echo.
pause
