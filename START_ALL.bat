@echo off
echo ===================================================================
echo  STRESS DETECTION CHATBOT - START ALL SERVICES (Windows)
echo  Architecture: DistilBERT ML + Node.js Backend + Gemini/NVIDIA LLM
echo  Database: MongoDB Atlas (cloud) -- no local MongoDB needed
echo ===================================================================
echo.

REM ── Step 1: Check .env and MongoDB Atlas MONGO_URI ────────────────────────
echo [1/3] Checking configuration...

cd /d "%~dp0Stress Detection\backend"

if not exist ".env" (
    echo   WARNING: .env file not found!
    echo   Copying .env.example to .env...
    copy .env.example .env >nul
    echo.
    echo   *** ACTION REQUIRED ***
    echo   Edit "Stress Detection\backend\.env" and set:
    echo     MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/stress_detection_db?retryWrites=true&w=majority
    echo     GEMINI_API_KEY=AIza...   (free key from https://aistudio.google.com/app/apikey)
    echo.
    echo   Then re-run this script.
    pause
    exit /b 1
)

REM Check that MONGO_URI does not still contain the placeholder
findstr /C:"<username>" .env >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    echo   WARNING: MONGO_URI still contains placeholder values!
    echo   Edit "Stress Detection\backend\.env" and replace:
    echo     MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx...
    echo   with your actual MongoDB Atlas connection string.
    echo   Get it from: https://cloud.mongodb.com/ -> Connect -> Drivers
    echo.
    pause
    exit /b 1
)

echo   Configuration OK.
cd /d "%~dp0"

REM ── Step 2: Start ML Service (Port 5000) ─────────────────────────────────
echo.
echo [2/3] Starting ML Service (Python Flask + DistilBERT, Port 5000)...
echo   Note: First startup downloads DistilBERT base model (~250 MB).
echo   This can take 2-5 minutes. Subsequent starts are much faster.
echo.

cd /d "%~dp0ml_service"

REM Check if Python is available
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERROR: Python not found! Install Python 3.8+ from https://python.org
    pause
    exit /b 1
)

REM Check if model files exist
if not exist "stress_model.pt" (
    echo   ERROR: stress_model.pt not found in ml_service/
    echo   Download it from the shared Google Drive link in your project docs.
    pause
    exit /b 1
)
if not exist "tokenizer.pkl" (
    echo   ERROR: tokenizer.pkl not found in ml_service/
    echo   Download it from the shared Google Drive link in your project docs.
    pause
    exit /b 1
)

start "ML Service - DistilBERT Stress Detection" python ml_service.py
cd /d "%~dp0"

echo   ML Service starting... (wait for "DistilBERT model loaded" in its window)
timeout /t 5 /nobreak >nul

REM ── Step 3: Start Backend (Port 4000) ────────────────────────────────────
echo.
echo [3/3] Starting Backend Server (Node.js/Express, Port 4000)...

cd /d "%~dp0Stress Detection\backend"
start "Backend Server - Stress Detection API" npm start
cd /d "%~dp0"

timeout /t 3 /nobreak >nul

REM ── Done ─────────────────────────────────────────────────────────────────
echo.
echo ===================================================================
echo  ALL SERVICES STARTING!
echo ===================================================================
echo.
echo  Services:
echo    Database  : MongoDB Atlas (cloud) -- check MONGO_URI in .env
echo    ML Service: http://localhost:5000  (wait for model to load)
echo    Backend   : http://localhost:4000
echo    Frontend  : Open manually - Stress Detection\frontend\index.html
echo.
echo  LLM Chain:
echo    Primary  : Gemini 2.0 Flash  (set GEMINI_API_KEY in .env)
echo    Fallback : NVIDIA NIM        (set NVIDIA_API_KEY in .env)
echo    Offline  : Template fallback (automatic if both keys missing)
echo.
echo  IMPORTANT:
echo    - ML Service window: wait for "DistilBERT model loaded" message
echo    - First run downloads DistilBERT (~250 MB) - needs internet
echo    - Response time: 1-3s (Gemini) or 5-20s (NVIDIA)
echo    - MongoDB Atlas: free M0 cluster pauses after 60 days of inactivity
echo      If connection fails, log in to https://cloud.mongodb.com/ and resume.
echo.

timeout /t 3 /nobreak >nul
echo Opening frontend in browser...
start "" "%~dp0Stress Detection\frontend\index.html"

echo.
echo ===================================================================
echo Press any key to exit this window (services keep running)
pause >nul
