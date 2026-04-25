# Stress Detection Chatbot - API Documentation

## Overview
Production-grade Stress Detection Chatbot with ML-powered stress analysis using LSTM neural networks, VADER sentiment analysis, and LLM-based responses.

## Architecture
```
Frontend (HTML/JS/Tailwind) 
    ↓
Backend (Node.js/Express + MongoDB)
    ↓
ML Microservice (Python Flask + TensorFlow)
    ↓
LM Studio (Local LLM for responses)
```

## Base URLs
- **Backend API**: `http://localhost:4000`
- **ML Service**: `http://localhost:5000`
- **LM Studio**: `http://localhost:1234`

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
**Response**: OTP sent to email (debug mode shows OTP in response)

### 2. Verify Signup OTP
**POST** `/auth/verify-signup-otp`
```json
{
  "email": "john@example.com",
  "otp": "123456"
}
```
**Response**: `{ token, user: { id, name, email, phone } }`

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
{
  "email": "john@example.com"
}
```
**Response**: OTP sent/generated

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

### 1. Create New Chat
**POST** `/chat/new`
**Headers**: `Authorization: Bearer <token>`
```json
{
  "chatName": "Stress Check-in"
}
```
**Response**: `{ chat: { _id, userId, chatName, messages, avgStress } }`

### 2. Send Message (ML-Processed)
**POST** `/chat/message`
**Headers**: `Authorization: Bearer <token>`
```json
{
  "chatId": "507f191e810c19729de860ea",
  "text": "I'm feeling really stressed about work"
}
```
**Response**: 
```json
{
  "chat": { ... },
  "mlMetrics": {
    "stressLevel": 7.5,
    "stressPercentage": 75.2,
    "components": {
      "lstm": 0.78,
      "vader": 0.65,
      "combined": 0.74
    }
  }
}
```

### 3. Get User Chats
**GET** `/chat/:userId`
**Headers**: `Authorization: Bearer <token>`
**Response**: `{ chats: [...] }`

### 4. Get Single Chat
**GET** `/chat/:chatId`
**Headers**: `Authorization: Bearer <token>`
**Response**: `{ chat: { ... } }`

### 5. Update Chat Name
**PATCH** `/chat/:chatId`
**Headers**: `Authorization: Bearer <token>`
```json
{
  "chatName": "Updated Chat Name"
}
```
**Response**: `{ chat: { ... } }`

### 6. Delete Chat
**DELETE** `/chat/:chatId`
**Headers**: `Authorization: Bearer <token>`
**Response**: `{ message: "Chat deleted successfully." }`

### 7. Get All Chats
**GET** `/chat/all`
**Headers**: `Authorization: Bearer <token>`
**Response**: `{ chats: [...] }`

### 8. Predict Stress (No Storage)
**GET** `/chat/predict/:chatId?text=your message here`
**Headers**: `Authorization: Bearer <token>`
**Response**:
```json
{
  "stressLevel": 7.5,
  "stressPercentage": 75.2,
  "components": {
    "lstm": 0.78,
    "vader": 0.65,
    "combined": 0.74
  }
}
```

### 9. Batch Predict Stress
**POST** `/chat/batch-predict`
**Headers**: `Authorization: Bearer <token>`
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
    { "stress_level": 6.5, "stress_percentage": 65.0, ... },
    { "stress_level": 2.0, "stress_percentage": 20.0, ... },
    { "stress_level": 8.5, "stress_percentage": 85.0, ... }
  ]
}
```

### 10. Get Stress Analytics
**GET** `/chat/analytics/:userId`
**Headers**: `Authorization: Bearer <token>`
**Response**:
```json
{
  "analytics": {
    "totalChats": 5,
    "totalMessages": 42,
    "avgStress": 45,
    "stressHistory": [
      {
        "chatId": "...",
        "chatName": "...",
        "avgStress": 55,
        "messageCount": 10,
        "createdAt": "2026-04-24T10:00:00.000Z"
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
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### 2. Predict Stress
**POST** `/predict`
```json
{
  "text": "I'm feeling anxious about deadlines"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "stress_level": 7.2,
    "stress_percentage": 72.5,
    "lstm_score": 0.75,
    "vader_score": 0.68,
    "combined_score": 0.73
  }
}
```

### 3. Chat with LLM Response
**POST** `/chat`
```json
{
  "text": "I'm overwhelmed with work"
}
```
**Response**:
```json
{
  "success": true,
  "stress_level": 8.1,
  "stress_percentage": 81.0,
  "components": {
    "lstm": 0.82,
    "vader": 0.75,
    "combined": 0.80
  },
  "bot_response": "I understand you're feeling overwhelmed..."
}
```

### 4. Batch Predict
**POST** `/batch-predict`
```json
{
  "texts": ["text1", "text2", "text3"]
}
```
**Response**: `{ success: true, count: 3, predictions: [...] }`

---

## Stress Score Interpretation

| Score Range | Label | Color |
|-------------|-------|-------|
| 0-10% | Calm | 🟢 Green |
| 11-39% | Low Stress | 🟡 Yellow |
| 40-69% | Moderate Stress | 🟠 Orange |
| 70-100% | High Stress | 🔴 Red |

---

## ML Model Components

### Hybrid Stress Detection
- **LSTM (75% weight)**: Neural network trained on stress-related text
- **VADER (25% weight)**: Sentiment analysis for emotional tone
- **Combined Score**: Weighted average for final prediction

### LLM Response Generation
- **Model**: Phi-3-Mini (via LM Studio)
- **Temperature**: 0.4 (balanced creativity/consistency)
- **Max Tokens**: 200 (concise responses)
- **Context-Aware**: Responses adapt to stress level

---

## Error Handling

All endpoints return appropriate HTTP status codes:
- `200`: Success
- `400`: Bad Request (missing/invalid parameters)
- `401`: Unauthorized (invalid/missing token)
- `403`: Forbidden (access denied)
- `404`: Not Found
- `500`: Internal Server Error
- `503`: Service Unavailable (ML models not loaded)

### Error Response Format
```json
{
  "error": "Descriptive error message"
}
```

---

## Environment Variables

### Backend (.env)
```env
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/stress_detection_db
JWT_SECRET=your_secret_key_here
ML_SERVICE_URL=http://localhost:5000
LM_STUDIO_URL=http://localhost:1234
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
```

---

## Production Deployment Checklist

- [ ] Set strong JWT_SECRET
- [ ] Use production MongoDB (MongoDB Atlas)
- [ ] Enable HTTPS/TLS
- [ ] Configure CORS for production domain
- [ ] Set up rate limiting
- [ ] Add request validation middleware
- [ ] Enable logging (Winston/Morgan)
- [ ] Set up monitoring (Sentry, New Relic)
- [ ] Configure backup strategy
- [ ] Load test all endpoints
- [ ] Document API changes

---

## Version: 2.0.0
**Last Updated**: April 24, 2026
