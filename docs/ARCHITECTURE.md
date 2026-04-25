# System Architecture & Integration Map

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STRESS DETECTION SYSTEM                             │
└─────────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════╗
║                          CLIENT LAYER (Port 80)                            ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  Frontend (HTML/JS/Tailwind)                                         │  ║
║  │  - Chatbot UI                                                        │  ║
║  │  - Authentication Pages                                             │  ║
║  │  - Stress Level Visualization                                       │  ║
║  │  - Chat History                                                     │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                   ↕ HTTP/REST                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  Nginx (Reverse Proxy)                                               │  ║
║  │  - Static file serving                                              │  ║
║  │  - API routing                                                      │  ║
║  │  - Load balancing                                                   │  ║
║  │  - GZIP compression                                                 │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
║                   API GATEWAY LAYER (Port 4000)                             ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  Express.js Backend Server                                        ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Authentication Routes (/auth)                              │ ║   ║
║  ║  │  - POST /register      (Email, Password)                    │ ║   ║
║  ║  │  - POST /login         (Email/OTP, Password)                │ ║   ║
║  ║  │  - POST /send-otp      (OTP Generation)                     │ ║   ║
║  ║  │  - POST /verify-otp    (OTP Verification)                   │ ║   ║
║  ║  │  - Middleware: JWT Authentication                           │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║                              ↕                                     ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Chat Routes (/chat) - ML-ENHANCED                          │ ║   ║
║  ║  │  - POST /new                  (Create chat)                 │ ║   ║
║  ║  │  - POST /message              (Send message + Get response) │ ║   ║
║  ║  │  - GET /predict/:chatId       (Stress prediction only)      │ ║   ║
║  ║  │  - POST /batch-predict        (Batch predictions)           │ ║   ║
║  ║  │  - GET /all                   (List all chats)              │ ║   ║
║  ║  │  - GET /:chatId               (Get chat details)            │ ║   ║
║  ║  │  - PATCH /:chatId             (Update chat name)            │ ║   ║
║  ║  │  - DELETE /:chatId            (Delete chat)                 │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↓ HTTP/REST (Axios)                                     ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Request to ML Service                                       │ ║   ║
║  ║  │  - Forwards user text to ML endpoint                         │ ║   ║
║  ║  │  - Receives stress data + LLM response                       │ ║   ║
║  ║  │  - Stores in MongoDB with predictions                        │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
║                                                                            ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  MongoDB Database                                                 ║   ║
║  ║  Collections:                                                     ║   ║
║  ║  - users (id, email, password_hash, createdAt)                   ║   ║
║  ║  - chats (id, userId, chatName, messages[], avgStress, model)   ║   ║
║  ║  Message Structure:                                              ║   ║
║  ║  {                                                               ║   ║
║  ║    text, stress, role, timestamp,                               ║   ║
║  ║    stressData: {lstm, vader, combined, percentage}              ║   ║
║  ║  }                                                               ║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
║                 ML MICROSERVICE LAYER (Port 5000)                           ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  Flask Python Application                                         ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Health Check                                               │ ║   ║
║  ║  │  - GET /health  (Service status check)                      │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Prediction Endpoints                                       │ ║   ║
║  ║  │  - POST /predict       (Single text prediction)             │ ║   ║
║  ║  │  - POST /chat          (Prediction + LLM response)          │ ║   ║
║  ║  │  - POST /batch-predict (Multiple texts)                     │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↓ Model Processing                                      ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  HYBRID STRESS DETECTION ENGINE                              │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  1. TEXT CLEANING                                           │ ║   ║
║  ║  │     text.lower() → remove extra spaces → trim()            │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  2. TOKENIZATION                                            │ ║   ║
║  ║  │     Load: tokenizer.pkl (trained on dataset)                │ ║   ║
║  ║  │     Convert text → integer sequences                        │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  3. PADDING                                                 │ ║   ║
║  ║  │     Pad sequences to MAX_LEN = 80                          │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  4. LSTM PREDICTION (75% weight)                            │ ║   ║
║  ║  │     Model: stress_lstm_model.keras                         │ ║   ║
║  ║  │     Architecture:                                           │ ║   ║
║  ║  │       - Embedding(256)                                      │ ║   ║
║  ║  │       - LSTM(128) + Dropout(0.3)                           │ ║   ║
║  ║  │       - LSTM(64) + Dropout(0.3)                            │ ║   ║
║  ║  │       - Dense(64) + Dropout(0.3)                           │ ║   ║
║  ║  │       - Dense(32) + Dropout(0.2)                           │ ║   ║
║  ║  │       - Dense(1, sigmoid) → 0-1                            │ ║   ║
║  ║  │     Output: LSTM_Probability [0-1]                         │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  5. VADER SENTIMENT (25% weight)                            │ ║   ║
║  ║  │     Library: nltk.sentiment.SentimentIntensityAnalyzer      │ ║   ║
║  ║  │     Output: compound [-1, +1]                              │ ║   ║
║  ║  │     Convert: (1 - compound) / 2 → [0-1]                    │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  6. HYBRID SCORE CALCULATION                                │ ║   ║
║  ║  │     stress_score = 0.75×LSTM + 0.25×VADER                   │ ║   ║
║  ║  │     Converts to 1-10 scale:                                 │ ║   ║
║  ║  │     stress_level = 1 + (stress_score × 9)                  │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↓ LLM Response Generation (if text != "")              ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  LM STUDIO INTEGRATION                                       │ ║   ║
║  ║  │  - Connects to localhost:1234 (LM Studio)                   │ ║   ║
║  ║  │  - Model: phi-3-mini                                        │ ║   ║
║  ║  │  - Generates contextual responses                           │ ║   ║
║  ║  │  - Includes stress level context                            │ ║   ║
║  ║  │  - Temperature: 0.4 (stable outputs)                        │ ║   ║
║  ║  │  - Max tokens: 200                                          │ ║   ║
║  ║  │  - Gracefully handles if LM Studio unavailable              │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↑ Fallback                                             ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  LM STUDIO (External)                                        │ ║   ║
║  ║  │  Port: 1234                                                 │ ║   ║
║  ║  │  Endpoint: /v1/chat/completions                             │ ║   ║
║  ║  │  (Download from: https://lmstudio.ai/)                      │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↑ Optional (graceful fallback)                          ║   ║
║  ║                                                                   ║   ║
║  ║  Response JSON:                                                  ║   ║
║  ║  {                                                               ║   ║
║  ║    "success": true,                                              ║   ║
║  ║    "stress_level": 7.5,                    (1-10 scale)         ║   ║
║  ║    "stress_percentage": 75.0,              (0-100%)             ║   ║
║  ║    "components": {                                               ║   ║
║  ║      "lstm": 0.750,                        (individual scores)  ║   ║
║  ║      "vader": 0.625,                                            ║   ║
║  ║      "combined": 0.724                                          ║   ║
║  ║    },                                                            ║   ║
║  ║    "bot_response": "..."                   (LLM response)       ║   ║
║  ║  }                                                               ║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

### User Message Flow:
```
User Types Message
        ↓
Frontend (JS) POST /chat/message
        ↓
Backend (Express)
        ├─ Validates JWT token
        ├─ Finds chat in MongoDB
        └─ Calls ML Service
                ↓
        ML Service (/chat endpoint)
        ├─ Cleans text
        ├─ Tokenizes
        ├─ Pads sequences
        ├─ LSTM prediction
        ├─ VADER sentiment
        ├─ Calculates hybrid score
        ├─ Calls LM Studio (optional)
        └─ Returns {stress_level, response}
                ↓
        Backend
        ├─ Stores message in MongoDB
        ├─ Calculates average stress
        └─ Returns to Frontend
                ↓
Frontend Displays:
- Stress Level (1-10)
- Stress Percentage
- Component breakdown
- Bot Response
```

---

## 🔄 Component Interactions

### 1. **Frontend ↔ Backend Communication**
```
Request Headers:
- Authorization: Bearer {JWT_TOKEN}
- Content-Type: application/json

Response Headers:
- Access-Control-Allow-Origin: *
- Content-Type: application/json
```

### 2. **Backend ↔ ML Service Communication**
```
Request: POST http://localhost:5000/chat
{
  "text": "user message"
}

Response:
{
  "success": true,
  "stress_level": X.X,
  "stress_percentage": X.X,
  "components": {...},
  "bot_response": "..."
}
```

### 3. **ML Service ↔ LM Studio Communication** (Optional)
```
Request: POST http://localhost:1234/v1/chat/completions
{
  "model": "phi-3-mini",
  "messages": [{"role": "user", "content": "..."}],
  "temperature": 0.4,
  "max_tokens": 200
}

Response:
{
  "choices": [{"message": {"content": "..."}}]
}
```

---

## 📦 Deployment Architecture

```
┌────────────────────────────────────────────────────────────┐
│              Docker Container Orchestration                │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Container: stress_detection_frontend              │  │
│  │  Image: nginx:alpine                               │  │
│  │  Port: 80                                           │  │
│  │  Volume: ./frontend → /usr/share/nginx/html        │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Container: stress_detection_backend               │  │
│  │  Image: node:18-alpine                             │  │
│  │  Port: 4000                                         │  │
│  │  Depends: mongodb, ml-service                       │  │
│  │  Health: HTTP health check                          │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Container: stress_detection_ml                    │  │
│  │  Image: python:3.10-slim                           │  │
│  │  Port: 5000                                         │  │
│  │  Depends: mongodb                                  │  │
│  │  Health: HTTP health check                          │  │
│  │  Volumes: Model files mounted                       │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Container: stress_detection_mongodb               │  │
│  │  Image: mongo:7                                     │  │
│  │  Port: 27017                                        │  │
│  │  Volume: mongo_data persistent volume               │  │
│  │  Authentication: admin/password                     │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Network: stress-network (bridge)                         │
│  All containers communicate via service names             │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layers

```
┌──────────────────────────────────────────────────┐
│  Frontend (Client)                               │
│  - HTTPS only (in production)                    │
│  - JWT token stored in localStorage/sessionStorage│
│  - CORS validation                               │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Nginx Reverse Proxy                             │
│  - Rate limiting                                 │
│  - DDoS protection                               │
│  - SSL/TLS termination                           │
│  - Request filtering                             │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Backend (Express)                               │
│  - JWT verification middleware                   │
│  - Input validation & sanitization               │
│  - CORS configuration                            │
│  - Error handling                                │
│  - Secure headers                                │
└──────────────────────────────────────────────────┘
                     ↓
┌──────────────────────────────────────────────────┐
│  Database (MongoDB)                              │
│  - Authentication required                       │
│  - Password hashing (bcryptjs)                  │
│  - Encrypted connections                         │
│  - Access control                                │
└──────────────────────────────────────────────────┘
```

---

## 📈 Performance Metrics

### Expected Response Times:
- **Frontend Load**: < 2 seconds
- **Authentication**: 100-500ms
- **Single Prediction**: 50-200ms
- **Chat Response (with LLM)**: 2-5 seconds
- **Batch Prediction (10 texts)**: 500-1000ms

### Resource Usage:
- **Backend Container**: ~200MB RAM
- **ML Service Container**: ~800MB RAM (model loaded)
- **MongoDB**: Variable (depends on data)
- **Frontend**: < 5MB

---

## 🚀 Scaling Strategy

```
Single Node Deployment
        ↓
Load Balancer + Multiple Backend Instances
        ↓
Backend → MongoDB Replica Set
        ↓
ML Service Scaling:
- Horizontal: Multiple ML containers
- Vertical: GPU acceleration
- Caching: Redis for frequent predictions
        ↓
CDN for Static Assets
```

---

## 📋 Integration Checklist

- ✅ ML Models (LSTM + VADER) integrated
- ✅ Flask microservice created
- ✅ Backend routes updated with ML calls
- ✅ MongoDB schema updated for predictions
- ✅ Docker setup with compose
- ✅ Nginx reverse proxy configured
- ✅ Documentation complete
- ✅ API endpoints documented
- ⏳ End-to-end testing (manual required)
- ⏳ Production deployment

---

**Architecture Version**: 1.0  
**Last Updated**: April 2024  
**Status**: ✅ Integration Complete & Ready for Testing
