# Add Windows Firewall Rule for Python Backend Port 8000
# This script must be run as Administrator

Write-Host "====================================================" -ForegroundColor Cyan
Write-Host " Adding Firewall Rule for Python Backend Port 8000 " -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host ""

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)

if (-not $isAdmin) {
    Write-Host "ERROR: This script must be run as Administrator!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To run as Administrator:" -ForegroundColor Yellow
    Write-Host "1. Right-click on PowerShell" -ForegroundColor Yellow
    Write-Host "2. Select 'Run as Administrator'" -ForegroundColor Yellow
    Write-Host "3. Run this script again" -ForegroundColor Yellow
    Write-Host ""
    pause
    exit 1
}

Write-Host "Checking for existing firewall rule..." -ForegroundColor Yellow

# Remove existing rule if it exists
$existingRule = Get-NetFirewallRule -DisplayName "Python Backend Port 8000" -ErrorAction SilentlyContinue
if ($existingRule) {
    Write-Host "Removing existing rule..." -ForegroundColor Yellow
    Remove-NetFirewallRule -DisplayName "Python Backend Port 8000"
}

# Add new firewall rule
Write-Host "Adding firewall rule..." -ForegroundColor Yellow

try {
    New-NetFirewallRule `
        -DisplayName "Python Backend Port 8000" `
        -Direction Inbound `
        -Protocol TCP `
        -LocalPort 8000 `
        -Action Allow `
        -Profile Any `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "SUCCESS!" -ForegroundColor Green
    Write-Host "Firewall rule added successfully." -ForegroundColor Green
    Write-Host ""
    Write-Host "Your mobile app should now be able to connect to:" -ForegroundColor Cyan
    Write-Host "http://172.20.10.5:8000" -ForegroundColor White
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Make sure your phone is connected to the same Wi-Fi" -ForegroundColor Yellow
    Write-Host "2. Close and reopen the mobile app" -ForegroundColor Yellow
    Write-Host "3. Try logging in again" -ForegroundColor Yellow
    
} catch {
    Write-Host ""
    Write-Host "ERROR: Failed to add firewall rule" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}

Write-Host ""
pause
