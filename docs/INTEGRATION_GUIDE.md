# Stress Detection System - Integration Guide

## 📋 Project Overview

This is a **full-stack stress detection chatbot** with integrated machine learning capabilities. It combines:

- **Frontend**: HTML/JavaScript chatbot UI
- **Backend**: Node.js/Express REST API + MongoDB
- **ML Microservice**: Python Flask service with LSTM + VADER + LLM

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML/JS)                       │
│              Stress Detection Chatbot UI                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Backend (Node.js/Express + MongoDB)                │
│  - Authentication (JWT, OAuth, Email OTP)                  │
│  - Chat Management                                          │
│  - API Gateway to ML Service                                │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│       ML Microservice (Python Flask)                        │
│  - LSTM Neural Network (Stress Detection)                  │
│  - VADER Sentiment Analysis                                 │
│  - LLM Integration (LM Studio)                             │
│  - Model Management                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 File Structure

```
Project/
├── LLM_Integration.ipynb          # LLM + Stress Prediction Notebook
├── LSTM_Training.ipynb             # Model Training Notebook
├── final_stress_dataset.csv        # Training Dataset
├── tokenizer.pkl                   # Trained Tokenizer
├── sequence_config.pkl             # Sequence Configuration
├── model.pkl                        # Trained LSTM Model
├── ml_service.py                   # ML Microservice (NEW)
├── ml_requirements.txt             # Python Dependencies (NEW)
│
└── Stress Detection/
    ├── backend/
    │   ├── server.js               # Express Server
    │   ├── package.json            # Node Dependencies (UPDATED)
    │   ├── .env                    # Environment Variables
    │   ├── models/
    │   │   ├── User.js
    │   │   └── Chat.js
    │   ├── routes/
    │   │   ├── auth.js
    │   │   ├── chat.js             # Original (simple)
    │   │   └── chat_integrated.js  # NEW (ML-enhanced)
    │   ├── middleware/
    │   │   └── authMiddleware.js
    │   └── utils/
    │       ├── mailer.js
    │       ├── otp.js
    │       └── stressModel.js      # Simple Keyword-Based
    │
    └── frontend/
        ├── index.html              # Main UI
        └── js/
            ├── app.js              # Main Logic
            └── utils.js            # Utilities
```

---

## 🚀 Setup Instructions

### 1️⃣ Install Dependencies

#### Backend (Node.js)
```bash
cd "Stress Detection/backend"
npm install
```

#### ML Microservice (Python)
```bash
# Create Python virtual environment (recommended)
python -m venv ml_env
ml_env\Scripts\activate

# Install Python dependencies
pip install -r ml_requirements.txt

# Download NLTK data
python -c "import nltk; nltk.download('vader_lexicon')"
```

---

### 2️⃣ Environment Configuration

#### Backend `.env` file

Create `Stress Detection/backend/.env`:

```env
# Server
PORT=4000
NODE_ENV=development

# MongoDB
MONGO_URI=mongodb://127.0.0.1:27017/stress_detection_db

# ML Microservice
ML_SERVICE_URL=http://localhost:5000

# JWT
JWT_SECRET=your_jwt_secret_key_here

# Email (Gmail)
GMAIL_USER=your_email@gmail.com
GMAIL_PASSWORD=your_app_password

# Resend API (Optional)
RESEND_API_KEY=your_resend_key
```

---

### 3️⃣ Start Services

Open **4 terminals**:

#### Terminal 1: MongoDB
```bash
mongod
# Or if using Docker:
docker run -d -p 27017:27017 --name mongodb mongo
```

#### Terminal 2: ML Microservice
```bash
cd Project
python ml_service.py
```

Expected output:
```
======================================================================
STRESS DETECTION ML MICROSERVICE
======================================================================
[ML Service] Loading tokenizer...
[ML Service] Loading sequence config...
[ML Service] Loading LSTM model...
[ML Service] ✓ All models loaded successfully!

[ML Service] Starting Flask server on http://localhost:5000
[ML Service] Endpoints:
  - GET  /health - Health check
  - POST /predict - Single prediction
  - POST /chat - Chat with LLM integration
  - POST /batch-predict - Batch predictions
```

#### Terminal 3: Backend Server
```bash
cd "Stress Detection/backend"
npm install
npm start
```

Expected output:
```
Server listening on http://localhost:4000
Connected to MongoDB
```

#### Terminal 4: LM Studio (Optional - for advanced chatbot)
```bash
# Download and run LM Studio from: https://lmstudio.ai/
lm-studio  # Then load "phi-3-mini" model
```

#### Terminal 5: Frontend (Development Server)
```bash
cd "Stress Detection/frontend"
# If you have a local server like Live Server
# Or simply open index.html in browser: file:///path/to/index.html
```

---

## 📡 API Endpoints

### Authentication Endpoints
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/send-otp` - Send OTP for login
- `POST /auth/verify-otp` - Verify OTP

### Chat Endpoints (ML-Enhanced)

#### 1. Create New Chat
```http
POST /chat/new
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatName": "My Stress Session"
}

Response:
{
  "chat": {
    "_id": "...",
    "chatName": "My Stress Session",
    "messages": [],
    "avgStress": 0,
    "model": "hybrid"
  }
}
```

#### 2. Send Message with Stress Detection
```http
POST /chat/message
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatId": "...",
  "text": "I'm feeling really anxious about my exam tomorrow"
}

Response:
{
  "chat": {...},
  "mlMetrics": {
    "stressLevel": 7.5,
    "stressPercentage": 85.2,
    "components": {
      "lstm": 0.852,
      "vader": 0.632,
      "combined": 0.791,
      "percentage": 85.2
    }
  }
}
```

#### 3. Get Stress Prediction Only
```http
GET /chat/predict/{chatId}?text=I'm%20stressed
Authorization: Bearer <token>

Response:
{
  "stressLevel": 7.5,
  "stressPercentage": 85.2,
  "components": {
    "lstm": 0.852,
    "vader": 0.632,
    "combined": 0.791
  }
}
```

#### 4. Batch Prediction
```http
POST /chat/batch-predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "texts": [
    "I'm feeling great!",
    "I'm so stressed",
    "Everything is fine"
  ]
}

Response:
{
  "count": 3,
  "predictions": [
    {"stress_level": 2.1, ...},
    {"stress_level": 8.5, ...},
    {"stress_level": 1.8, ...}
  ]
}
```

#### 5. Get All Chats
```http
GET /chat/all
Authorization: Bearer <token>

Response:
{
  "chats": [
    {"_id": "...", "chatName": "...", "avgStress": 45, ...},
    ...
  ]
}
```

#### 6. Update Chat Name
```http
PATCH /chat/{chatId}
Authorization: Bearer <token>
Content-Type: application/json

{
  "chatName": "Updated Name"
}
```

#### 7. Delete Chat
```http
DELETE /chat/{chatId}
Authorization: Bearer <token>

Response:
{
  "message": "Chat deleted successfully."
}
```

---

## 🧠 ML Model Details

### LSTM Neural Network
- **Architecture**: Embedding → LSTM(128) → LSTM(64) → Dense layers
- **Input**: Text sequences (max 80 tokens)
- **Output**: Binary classification (Stress: 0-1)
- **Training**: 15 epochs with early stopping

### VADER Sentiment Analysis
- **Purpose**: Complementary stress detection using sentiment
- **Range**: -1 (negative) to +1 (positive)
- **Converted**: (1 - compound) / 2 → 0-1 stress scale

### Hybrid Score Formula
```
Stress Score = (0.75 × LSTM_Probability) + (0.25 × VADER_Stress)
Stress Level = 1 + (Stress Score × 9)  → 1-10 scale
```

---

## 🔄 Integration Points

### Frontend → Backend
- Sends chat message to `/chat/message` endpoint
- Receives stress level, bot response, and metrics

### Backend → ML Microservice
- Forwards user text to `/chat` endpoint (Flask)
- Receives stress prediction + LLM response

### ML Microservice → External Services
- **LM Studio**: Gets contextual responses (localhost:1234)
- **NLTK**: Uses VADER for sentiment analysis

---

## 🐛 Troubleshooting

### ML Service Won't Start
```
Problem: "Models not found"
Solution: Ensure these files exist in project root:
  - tokenizer.pkl
  - sequence_config.pkl
  - model.pkl
```

### Cannot Connect to ML Service
```
Problem: "ML Service unavailable"
Solution:
  1. Check if ML Service is running: http://localhost:5000/health
  2. Verify ML_SERVICE_URL in .env matches Flask port
  3. Check firewall settings allow localhost:5000
```

### LM Studio Not Responding
```
Problem: "Cannot connect to LM Studio"
Solution:
  1. Download LM Studio: https://lmstudio.ai/
  2. Load "phi-3-mini" model
  3. Server should run on http://localhost:1234
  4. Predictions will fallback gracefully if unavailable
```

### MongoDB Connection Failed
```
Problem: "MongoDB connection error"
Solution:
  1. Start MongoDB: mongod
  2. Or use Docker: docker run -d -p 27017:27017 mongo
  3. Verify MONGO_URI in .env
```

---

## 📊 Monitoring & Testing

### Health Check ML Service
```bash
curl http://localhost:5000/health
```

### Test Stress Prediction
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text":"I am stressed and anxious"}'
```

### Test Chat Endpoint
```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"text":"I am stressed and anxious"}'
```

---

## 🔐 Security Considerations

1. **JWT Tokens**: All chat endpoints require authentication
2. **CORS**: Configured to allow frontend requests
3. **MongoDB**: Use authentication in production
4. **ML Service**: Should be on private network in production
5. **Environment Variables**: Never commit .env files

---

## 📈 Performance Tips

- **Batch Predictions**: Use `/batch-predict` for multiple texts
- **Model Caching**: ML models are loaded once on startup
- **Async Processing**: Consider Redis for high-load scenarios
- **Model Optimization**: Can quantize LSTM for faster inference

---

## 🚀 Deployment

### Production Checklist
- [ ] Set `NODE_ENV=production`
- [ ] Use strong `JWT_SECRET`
- [ ] Configure MongoDB Atlas
- [ ] Deploy ML Service to separate container/server
- [ ] Setup HTTPS/SSL certificates
- [ ] Configure environment variables securely
- [ ] Setup logging and monitoring
- [ ] Enable rate limiting on API endpoints

### Docker Deployment
```dockerfile
# Backend
FROM node:18-alpine
WORKDIR /app
COPY package.json .
RUN npm install
COPY . .
EXPOSE 4000
CMD ["npm", "start"]

# ML Service
FROM python:3.10-slim
WORKDIR /app
COPY ml_requirements.txt .
RUN pip install -r ml_requirements.txt
COPY ml_service.py .
EXPOSE 5000
CMD ["python", "ml_service.py"]
```

---

## 📚 Model Training (Advanced)

To retrain the LSTM model with new data:

1. Update `final_stress_dataset.csv` with new labeled data
2. Run `LSTM_Training.ipynb`
3. This generates: `tokenizer.pkl`, `sequence_config.pkl`, `model.pkl`
4. Restart ML Service to reload models

---

## 🔗 Quick Start Summary

```bash
# 1. Install dependencies
cd "Stress Detection\backend" && npm install
pip install -r ml_requirements.txt

# 2. Start MongoDB
mongod

# 3. Start ML Service (Python)
python ml_service.py

# 4. Start Backend (Node.js)
cd "Stress Detection\backend" && npm start

# 5. Open Frontend
# Open index.html in browser or setup dev server

# 6. (Optional) Start LM Studio
# Download from https://lmstudio.ai/
```

---

## 📞 Support & Documentation

- **LSTM Training**: See [LSTM_Training.ipynb](LSTM_Training.ipynb)
- **LLM Integration**: See [LLM_Integration.ipynb](LLM_Integration.ipynb)
- **ML Service**: See [ml_service.py](ml_service.py) docstrings
- **Backend Routes**: See [chat_integrated.js](Stress%20Detection/backend/routes/chat_integrated.js)

---

**Last Updated**: April 2024  
**Version**: 1.0 - Full Stack Integration Complete
