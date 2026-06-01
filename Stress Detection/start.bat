@echo off
echo ========================================
echo  StressBot - Startup Script (Windows)
echo ========================================
echo.

echo [1/3] Starting MongoDB...
echo  Make sure MongoDB is installed and added to PATH.
echo  If MongoDB is already running as a service, skip this.
start "MongoDB" cmd /k "mongod"
timeout /t 3 /nobreak > nul

echo.
echo [2/3] Starting Backend Server (port 4000)...
start "StressBot Backend" cmd /k "cd /d %~dp0backend && npm start"
timeout /t 4 /nobreak > nul

echo.
echo [3/3] Opening Frontend...
start "" "%~dp0frontend\index.html"

echo.
echo ========================================
echo  All services started!
echo ========================================
echo.
echo   Backend API  : http://localhost:4000
echo   Frontend     : Opened in your browser
echo   ML Service   : http://localhost:5000 (start separately if needed)
echo.
echo  NOTE: Keep the Backend terminal window open.
echo  Close it to stop the server.
echo.
pause
