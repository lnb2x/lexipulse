@echo off
title LexiPulse - Vocabulary App
cd /d "%~dp0"

echo ==================================================
echo      LexiPulse - Smart Vocabulary Learning
echo ==================================================
echo.

:: Kiem tra neu LexiPulse da dang chay o cong 5173
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 (
    echo [*] LexiPulse da dang chay san o dia chi: http://localhost:5173/
    echo [*] Dang mo trinh duyet...
    start http://localhost:5173/
    ping 127.0.0.1 -n 3 >nul
    exit /b 0
)

echo [*] Dang khoi dong server LexiPulse chay ngam (Background)...
echo [*] Tien trinh se hoat dong doc lap, ban co the tat cua so nay bat ky luc nao!
echo.

:: Khoi dong npm run dev chay ngam tach biet hoan toan khoi console nay
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Process cmd -ArgumentList '/c npm run dev' -WorkingDirectory '%~dp0' -WindowStyle Hidden"

:: Cho server khoi dong va bat dau lang nghe tren port 5173
echo [*] Dang ket noi server...
set RETRY=0
:WAIT_LOOP
ping 127.0.0.1 -n 2 >nul
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %ERRORLEVEL% equ 0 goto READY
set /a RETRY+=1
if %RETRY% lss 8 goto WAIT_LOOP

:READY
echo.
echo ==================================================
echo  [OK] LexiPulse da san sang tai: http://localhost:5173/
echo  [OK] Ban co the DONG cua so nay ma khong lo bi tat app!
echo  [OK] De dung ung dung khi can, hay chay file stop.bat
echo ==================================================
echo.

start http://localhost:5173/
ping 127.0.0.1 -n 3 >nul
