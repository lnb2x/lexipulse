@echo off
title LexiPulse - Stop App
cd /d "%~dp0"

echo ==================================================
echo      LexiPulse - Dung tien trinh chay ngam
echo ==================================================
echo.

:: Kiem tra neu port 5173 co dang chay
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% neq 0 (
    echo [i] Khong tim thay tien trinh LexiPulse nao dang chay tren cong 5173.
    ping 127.0.0.1 -n 2 >nul
    exit /b 0
)

echo [*] Dang dung LexiPulse tren cong 5173...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

:: Doi 1 giay va xac nhan da tat
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% neq 0 (
    echo [OK] Da dung thanh cong ung dung LexiPulse!
) else (
    echo [!] Dang thu dong cuong che...
    powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue"
    echo [OK] Da dung hoan tat.
)

echo.
ping 127.0.0.1 -n 3 >nul
