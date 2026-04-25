@echo off
echo ===================================================================
echo STRESS DETECTION SYSTEM - STARTING ALL SERVICES
echo ===================================================================
echo.

echo [1/3] Testing LM Studio Connection...
cd /d "%~dp0ml_service"
python test_lmstudio.py
if %errorlevel% neq 0 (
    echo.
    echo WARNING: LM Studio is not responding!
    echo Please make sure:
    echo   1. LM Studio is open
    echo   2. Server is started (click the Server icon)
    echo   3. A model is loaded
    echo.
    pause
    exit /b 1
)

echo.
echo [2/3] Starting ML Service (Port 5000)...
start "ML Service - Stress Detection" python ml_service.py
timeout /t 3 /nobreak >nul

echo.
echo [3/3] Starting Backend Server (Port 4000)...
cd /d "%~dp0Stress Detection\backend"
start "Backend Server - Stress Detection" npm start

echo.
echo ===================================================================
echo ALL SERVICES STARTED!
echo ===================================================================
echo.
echo Services running:
echo   - LM Studio: http://localhost:1234 (already running)
echo   - ML Service: http://localhost:5000
echo   - Backend: http://localhost:4000
echo   - Frontend: Open Stress Detection\frontend\index.html
echo.
echo IMPORTANT: 
echo   - First chat request will take 25-35 seconds (model loading)
echo   - Subsequent requests: 10-20 seconds
echo   - Check console logs for detailed information
echo.
echo Opening frontend in browser...
timeout /t 2 /nobreak >nul
start "" "%~dp0Stress Detection\frontend\index.html"

echo.
echo ===================================================================
pause
