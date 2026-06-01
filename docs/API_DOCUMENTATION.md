# Stress Detection Chatbot — API Documentation

## Overview
Production-grade Stress Detection Chatbot with ML-powered stress analysis using **DistilBERT fine-tuned neural network** (75%) + **VADER sentiment analysis** (25%), with **Gemini 2.0 Flash** as the primary LLM and **NVIDIA NIM Llama 3.1 70B** as fallback.

## Architecture
```
Frontend (HTML/JS/Tailwind CSS)
    ↓
Backend (Node.js/Express + MongoDB)
    ├─ LLM Chain: Gemini 2.0 Flash → NVIDIA NIM → Offline fallback
    └─ Multilingual: MyMemory + Google Translate (10+ languages)
    ↓
ML Microservice (Python Flask + DistilBERT + VADER)
```

## Base URLs
- **Backend API**: `http://localhost:4000`
- **ML Service**: `http://localhost:5000`

> ⚠️ LM Studio is no longer required. LLM responses are handled via cloud APIs (Gemini/NVIDIA).

---

## Authentication Endpoints

### 1. Sign Up (with OTP Verification)
**POST** `/auth/signup`
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "securepassword",
  "confirmPassword": "securepassword"
}
```
**Response**: OTP sent to email. If email is not configured, OTP is returned in response (debug mode).
```json
{ "message": "OTP sent to your email. Verify it to complete signup.", "debug": false }
```

### 2. Verify Signup OTP
**POST** `/auth/verify-signup-otp`
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```
**Response**: `{ token, user: { id, name, email } }`

### 3. Login
**POST** `/auth/login`
```json
{
  "email": "john@example.com",
  "password": "securepassword"
}
```
**Response**: `{ token, user }`

### 4. Google Login (Auto-create account)
**POST** `/auth/google`
```json
{
  "email": "john@gmail.com",
  "name": "John Doe"
}
```
**Response**: `{ token, user }`

### 5. Send OTP (for existing users)
**POST** `/auth/send-otp`
```json
{ "email": "john@example.com" }
```
**Response**: OTP sent to email

### 6. Verify OTP (login)
**POST** `/auth/verify-otp`
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```
**Response**: `{ token, user }`

---

## Chat Endpoints (All require Bearer token)

All chat endpoints require:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 1. Create New Chat
**POST** `/chat/new`
```json
{ "chatName": "Work Stress Check-in" }
```
**Response**: `{ chat: { _id, userId, chatName, messages: [], avgStress: 0 } }`

### 2. Send Message (ML-Processed)
**POST** `/chat/message`
```json
{
  "chatId": "507f191e810c19729de860ea",
  "text": "I'm feeling really stressed about work"
}
```
**Response**:
```json
{
  "chat": {
    "_id": "...",
    "chatName": "Work Stress",
    "messages": [
      {
        "text": "I'm feeling really stressed about work",
        "originalText": "I'm feeling really stressed about work",
        "translatedText": "I'm feeling really stressed about work",
        "language": "en",
        "stress": 76,
        "stressData": {
          "bert": 0.762,
          "vader": 0.631,
          "combined": 0.729,
          "percentage": 76.2
        },
        "category": "emotional",
        "role": "user",
        "timestamp": "2026-06-01T10:00:00.000Z"
      },
      {
        "text": "I understand you're feeling really stressed...",
        "role": "bot",
        "timestamp": "2026-06-01T10:00:02.000Z"
      }
    ],
    "avgStress": 76
  },
  "mlMetrics": {
    "stressLevel": 7.62,
    "stressPercentage": 76.2,
    "components": {
      "bert": 0.762,
      "vader": 0.631,
      "combined": 0.729,
      "hasStressKeywords": true,
      "hasPositiveKeywords": false
    },
    "language": "en",
    "translated": false,
    "responseSource": "gemini"
  }
}
```

> **Note on `components.bert`**: This field contains the DistilBERT score (probability 0–1). Formerly named `lstm` — fully renamed to `bert` to reflect the actual model.

### 3. Get All Chats
**GET** `/chat/all`
**Response**: `{ chats: [...] }`

### 4. Get Single Chat
**GET** `/chat/:chatId`
**Response**: `{ chat: { ... } }`

### 5. Rename Chat
**PATCH** `/chat/:chatId`
```json
{ "chatName": "New Chat Name" }
```
**Response**: `{ chat: { ... } }`

### 6. Delete Chat
**DELETE** `/chat/:chatId`
**Response**: `{ message: "Chat deleted successfully." }`

### 7. Predict Stress (No Storage)
**GET** `/chat/predict/:chatId?text=I feel anxious`
**Response**:
```json
{
  "stressLevel": 7.2,
  "stressPercentage": 72.5,
  "components": {
    "bert": 0.725,
    "vader": 0.680,
    "combined": 0.714
  }
}
```

### 8. Batch Predict Stress
**POST** `/chat/batch-predict`
```json
{
  "texts": [
    "I'm feeling stressed",
    "Life is good today",
    "Work is overwhelming"
  ]
}
```
**Response**:
```json
{
  "count": 3,
  "predictions": [
    { "stress_level": 6.5, "stress_percentage": 62.0, "bert_score": 0.62, "vader_score": 0.55, "combined_score": 0.60 },
    { "stress_level": 1.8, "stress_percentage": 9.0,  "bert_score": 0.09, "vader_score": 0.00, "combined_score": 0.07 },
    { "stress_level": 8.5, "stress_percentage": 83.0, "bert_score": 0.83, "vader_score": 0.74, "combined_score": 0.81 }
  ]
}
```

### 9. Get Stress Analytics
**GET** `/chat/analytics/:userId`
**Response**:
```json
{
  "analytics": {
    "totalChats": 5,
    "totalMessages": 42,
    "emotionalMessages": 30,
    "avgStress": 45,
    "stressLabel": "Moderate",
    "trend": "decreasing",
    "stressHistory": [
      {
        "chatId": "...",
        "chatName": "Monday Check-in",
        "avgStress": 55,
        "stressLabel": "Moderate",
        "emotionalCount": 8,
        "totalCount": 10,
        "createdAt": "2026-06-01T10:00:00.000Z",
        "dateLabel": "Jun 1"
      }
    ]
  }
}
```

---

## ML Microservice Endpoints

### 1. Health Check
**GET** `/health`
**Response**:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "model_type": "DistilBERT + VADER hybrid",
  "device": "cpu",
  "timestamp": "2026-06-01T10:00:00.000Z"
}
```

### 2. Predict Stress
**POST** `/predict`
```json
{ "text": "I'm feeling anxious about deadlines" }
```
**Response**:
```json
{
  "success": true,
  "data": {
    "stress_level": 7.2,
    "stress_percentage": 72.5,
    "bert_score": 0.725,
    "vader_score": 0.680,
    "combined_score": 0.714,
    "has_stress_keywords": true,
    "has_positive_keywords": false
  }
}
```

### 3. Chat with LLM Response (stress + NVIDIA NIM response)
**POST** `/chat`
```json
{ "text": "I'm overwhelmed with work" }
```
**Response**:
```json
{
  "success": true,
  "stress_level": 8.1,
  "stress_percentage": 83.0,
  "components": {
    "bert": 0.830,
    "vader": 0.750,
    "combined": 0.810,
    "has_stress_keywords": true,
    "has_positive_keywords": false
  },
  "bot_response": "I understand you're feeling overwhelmed with work..."
}
```

> **Note**: The `components.bert` key contains the DistilBERT score. The `stressData.bert` field is stored in MongoDB.

### 4. Batch Predict
**POST** `/batch-predict`
```json
{ "texts": ["text1", "text2", "text3"] }
```
**Response**: `{ "success": true, "count": 3, "predictions": [...] }`

---

## Stress Score Interpretation

| Stress % | Label           | LLM Tone                             |
|----------|-----------------|--------------------------------------|
| 0–10%    | Calm            | Upbeat, conversational               |
| 11–39%   | Low Stress      | Friendly, mildly supportive          |
| 40–69%   | Moderate Stress | Empathetic, practical coping tips    |
| 70–100%  | High Stress     | Serious, compassionate, professional |

---

## ML Model Components

### DistilBERT Stress Classifier (75% weight)
- **Architecture**: DistilBERT-base-uncased + Dropout(0.3) + Linear(768→256) + ReLU + Linear(256→1)
- **Output**: Sigmoid probability — `bert_prob` ∈ [0, 1]
- **Device**: CPU (no GPU required)
- **Tokenization**: max_length=128, padding=max_length, truncation=True

### VADER Sentiment Analyzer (25% weight)
- **Library**: `nltk.sentiment.SentimentIntensityAnalyzer`
- **Output formula**: `vader_stress = max(0.0, -compound)` → [0, 1]
  - Negative text → high stress value
  - Neutral/positive text → 0 stress (not 0.5 — this was the old bug)

### Hybrid Score
```python
stress_score     = 0.75 × bert_prob + 0.25 × vader_stress
stress_level     = round(1 + stress_score × 9, 2)   # → [1.0, 10.0]
stress_percentage = round(bert_prob × 100, 2)         # → [0, 100]
```

### LLM Response Generation (Node.js backend)
| Provider         | Priority | Speed   | Cost      | Config                    |
|------------------|----------|---------|-----------|---------------------------|
| Gemini 2.0 Flash | 1st      | 1–3s    | Free      | `GEMINI_API_KEY` in .env  |
| NVIDIA NIM       | 2nd      | 5–20s   | Paid      | `NVIDIA_API_KEY` in .env  |
| Offline fallback | 3rd      | <100ms  | Free      | Always available          |

---

## Message Category Routing

Messages are classified before ML processing:

| Category    | ML Processing | Stress Score | LLM Prompt Style        |
|-------------|---------------|--------------|-------------------------|
| `emotional` | Full DistilBERT + VADER | Actual ML score | Stress-aware, empathetic |
| `technical` | Skipped       | Fixed: 5%    | Factual assistant        |

Classification uses linguistic patterns — any factual question (e.g. "What is Python?") routes as `technical`.

---

## Error Handling

All endpoints return standard HTTP status codes:

| Code | Meaning                                          |
|------|--------------------------------------------------|
| 200  | Success                                          |
| 400  | Bad Request (missing/invalid parameters)         |
| 401  | Unauthorized (invalid/missing JWT token)         |
| 403  | Forbidden (access to another user's resource)    |
| 404  | Not Found                                        |
| 500  | Internal Server Error                            |
| 503  | Service Unavailable (ML models not loaded yet)   |

### Error Response Format
```json
{ "error": "Descriptive error message" }
```

---

## Environment Variables

### Backend (`.env`)
```env
PORT=4000
# MongoDB Atlas cloud connection string
# Get from: https://cloud.mongodb.com/ → Connect → Drivers
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/stress_detection_db?retryWrites=true&w=majority
JWT_SECRET=your_strong_secret_here
ML_SERVICE_URL=http://localhost:5000
GEMINI_API_KEY=AIza...           # Primary LLM (free)
GEMINI_MODEL=gemini-2.0-flash
NVIDIA_API_KEY=nvapi-...         # Fallback LLM
NVIDIA_MODEL=meta/llama-3.1-70b-instruct
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
```

---

## Production Deployment Checklist

- [ ] Set strong `JWT_SECRET` (32+ random characters)
- [x] Use production MongoDB (MongoDB Atlas) — already configured
- [ ] Restrict Atlas IP whitelist to known IPs in production (currently 0.0.0.0/0 for Render)
- [ ] Enable Atlas automated backups (M10+ tier required)
- [ ] Enable HTTPS/TLS (Nginx handles termination)
- [ ] Configure CORS for production domain only
- [ ] Add `express-rate-limit` middleware
- [ ] Store API keys in Docker secrets or platform vault (not `.env` files)
- [ ] Set up monitoring (Sentry, New Relic, or Datadog)
- [ ] Load test all endpoints before launch

---

**Version**: 3.1.0
**Last Updated**: June 2026
**Database**: MongoDB Atlas (cloud-hosted, replaced local MongoDB)
**ML Model**: DistilBERT fine-tuned + VADER (replaced LSTM + TensorFlow)
**LLM**: Gemini 2.0 Flash → NVIDIA NIM Llama 3.1 70B (replaced LM Studio)
