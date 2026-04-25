@echo off
echo ========================================
echo  Stress Detection Chatbot - Startup
echo ========================================
echo.

echo [1/3] Starting ML Microservice...
start "ML Service" cmd /k "cd /d %~dp0 && python ml_service.py"
timeout /t 3 /nobreak > nul

echo [2/3] Starting Backend Server...
start "Backend" cmd /k "cd /d %~dp0\backend && npm start"
timeout /t 3 /nobreak > nul

echo [3/3] Opening Frontend...
start "" "%~dp0\frontend\index.html"

echo.
echo ========================================
echo  All services started successfully!
echo ========================================
echo.
echo Services:
echo   - ML Microservice: http://localhost:5000
echo   - Backend API: http://localhost:4000
echo   - Frontend: Opening in browser...
echo.
echo Press any key to exit this window...
pause > nul
