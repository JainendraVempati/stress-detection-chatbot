#!/bin/bash

echo "========================================"
echo " StressBot - Startup Script (Mac/Linux)"
echo "========================================"
echo ""

# ── Step 1: MongoDB ───────────────────────────────────────────
echo "[1/3] Checking MongoDB..."
if ! pgrep -x "mongod" > /dev/null; then
    echo "  MongoDB not running. Starting..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew services start mongodb-community 2>/dev/null || mongod --fork --logpath /tmp/mongodb.log
    else
        sudo systemctl start mongod 2>/dev/null || mongod --fork --logpath /tmp/mongodb.log
    fi
    sleep 2
    echo "  MongoDB started."
else
    echo "  MongoDB is already running."
fi

# ── Step 2: Backend ───────────────────────────────────────────
echo ""
echo "[2/3] Starting Backend (Node.js on port 4000)..."
cd "$(dirname "$0")/backend"
npm start &
BACKEND_PID=$!
cd ..
sleep 3
echo "  Backend started (PID: $BACKEND_PID)"

# ── Step 3: Frontend ─────────────────────────────────────────
echo ""
echo "[3/3] Opening Frontend..."
FRONTEND_PATH="$(dirname "$0")/frontend/index.html"

if [[ "$OSTYPE" == "darwin"* ]]; then
    open "$FRONTEND_PATH"
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    xdg-open "$FRONTEND_PATH"
fi

echo ""
echo "========================================"
echo " All services started!"
echo "========================================"
echo ""
echo "  Backend API : http://localhost:4000"
echo "  Frontend    : Opened in browser"
echo "  ML Service  : http://localhost:5000 (start separately if needed)"
echo ""
echo "Press Ctrl+C to stop the backend."
echo ""

trap "echo 'Stopping backend...'; kill $BACKEND_PID 2>/dev/null; exit" SIGINT
wait $BACKEND_PID
