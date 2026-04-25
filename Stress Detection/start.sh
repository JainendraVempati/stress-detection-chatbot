#!/bin/bash

echo "========================================"
echo " Stress Detection Chatbot - Startup"
echo "========================================"
echo ""

echo "[1/4] Checking MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "MongoDB is not running. Starting MongoDB..."
    mongod --fork --logpath /var/log/mongodb.log
    sleep 2
else
    echo "MongoDB is already running."
fi

echo ""
echo "[2/4] Starting ML Microservice..."
python3 ml_service.py &
ML_PID=$!
sleep 3

echo ""
echo "[3/4] Starting Backend Server..."
cd backend
npm start &
BACKEND_PID=$!
cd ..
sleep 2

echo ""
echo "[4/4] Opening Frontend..."
if [[ "$OSTYPE" == "darwin"* ]]; then
    open frontend/index.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open frontend/index.html
fi

echo ""
echo "========================================"
echo " All services started successfully!"
echo "========================================"
echo ""
echo "Services:"
echo "  - ML Microservice: http://localhost:5000 (PID: $ML_PID)"
echo "  - Backend API: http://localhost:4000 (PID: $BACKEND_PID)"
echo "  - Frontend: Opened in browser"
echo ""
echo "To stop all services, press Ctrl+C"
echo ""

# Trap SIGINT to clean up processes
trap "echo 'Stopping services...'; kill $ML_PID $BACKEND_PID 2>/dev/null; exit" SIGINT

# Wait for processes
wait
