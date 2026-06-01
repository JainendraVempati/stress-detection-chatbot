# System Architecture & Integration Map

## 🏗️ Complete System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          STRESS DETECTION SYSTEM                             │
└─────────────────────────────────────────────────────────────────────────────┘

╔════════════════════════════════════════════════════════════════════════════╗
║                          CLIENT LAYER (Port 80 / file)                    ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  Frontend (HTML/JS/Tailwind CSS)                                     │  ║
║  │  - index.html  : Login / Signup / OTP verification                  │  ║
║  │  - chat.html   : Chat interface, stress visualization               │  ║
║  │  - js/app.js   : Main application logic                             │  ║
║  │  - js/utils.js : API helpers, token management                      │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║                                   ↕ HTTP/REST                              ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  Nginx (Reverse Proxy — Docker only)                                 │  ║
║  │  - Serves static frontend files                                     │  ║
║  │  - Proxies /auth/ and /chat/ to backend:4000                        │  ║
║  │  - Proxies /ml/ to ml-service:5000                                  │  ║
║  │  - GZIP compression, static asset caching                           │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
╚════════════════════════════════════════════════════════════════════════════╝
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
║                   API GATEWAY LAYER (Port 4000)                             ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  Node.js + Express Backend                                        ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Authentication Routes (/auth)                              │ ║   ║
║  ║  │  - POST /signup          OTP email + pending user           │ ║   ║
║  ║  │  - POST /verify-signup-otp  Complete registration           │ ║   ║
║  ║  │  - POST /login           JWT token issuance                 │ ║   ║
║  ║  │  - POST /google          Google login (auto-register)       │ ║   ║
║  ║  │  - POST /send-otp        OTP for existing users             │ ║   ║
║  ║  │  - POST /verify-otp      OTP login                          │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║                              ↕                                     ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  Chat Routes (/chat) — ML-ENHANCED                          │ ║   ║
║  ║  │  - POST /new                 Create chat                    │ ║   ║
║  ║  │  - POST /message             Send message + get response    │ ║   ║
║  ║  │  - GET  /all                 List all user chats            │ ║   ║
║  ║  │  - GET  /:chatId             Get single chat                │ ║   ║
║  ║  │  - PATCH /:chatId            Rename chat                    │ ║   ║
║  ║  │  - DELETE /:chatId           Delete chat                    │ ║   ║
║  ║  │  - GET  /predict/:chatId     Standalone stress prediction   │ ║   ║
║  ║  │  - POST /batch-predict       Batch stress prediction        │ ║   ║
║  ║  │  - GET  /analytics/:userId   Stress trend analytics         │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║          ↓ Axios HTTP                                            ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  LLM Chain (chat_integrated.js)                              │ ║   ║
║  ║  │  ① callGemini()   — Gemini 2.0 Flash (PRIMARY, ~1-3s)      │ ║   ║
║  ║  │     └── if fails → ② callNvidiaLLM() (FALLBACK, ~5-20s)   │ ║   ║
║  ║  │           └── if fails → ③ generateBotResponse() (offline) │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
║                                                                            ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  MongoDB Database                                                 ║   ║
║  ║  Collections:                                                     ║   ║
║  ║    users { _id, name, email, password (bcrypt), createdAt }      ║   ║
║  ║    chats { _id, userId, chatName, messages[], avgStress }        ║   ║
║  ║  Message document:                                               ║   ║
║  ║    { text, originalText, translatedText, language,              ║   ║
║  ║      stress (0-100), stressData {bert_score, vader_score,       ║   ║
║  ║      combined, percentage}, category, role, timestamp }         ║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
║                 ML MICROSERVICE LAYER (Port 5000)                           ║
║  ╔════════════════════════════════════════════════════════════════════╗   ║
║  ║  Flask Python Application                                         ║   ║
║  ║  Endpoints:                                                       ║   ║
║  ║    GET  /health          Service status check                    ║   ║
║  ║    POST /predict         Single text stress prediction            ║   ║
║  ║    POST /chat            Prediction + NVIDIA NIM LLM response    ║   ║
║  ║    POST /batch-predict   Multiple texts prediction               ║   ║
║  ║                                                                   ║   ║
║  ║  ┌──────────────────────────────────────────────────────────────┐ ║   ║
║  ║  │  HYBRID STRESS DETECTION ENGINE                              │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  1. TEXT CLEANING                                           │ ║   ║
║  ║  │     lower() → remove extra whitespace → strip()            │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  2. DISTILBERT TOKENIZATION                                 │ ║   ║
║  ║  │     tokenizer.pkl (DistilBERT tokenizer, pickled)           │ ║   ║
║  ║  │     max_length=128, padding=max_length, truncation=True     │ ║   ║
║  ║  │     Returns: input_ids, attention_mask tensors              │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  3. DISTILBERT INFERENCE (75% weight)                       │ ║   ║
║  ║  │     Model: stress_model.pt (DistilBERT-base-uncased)        │ ║   ║
║  ║  │     Architecture:                                           │ ║   ║
║  ║  │       - DistilBERT 6-layer transformer                      │ ║   ║
║  ║  │       - CLS token pooling (index 0)                         │ ║   ║
║  ║  │       - Dropout(0.3)                                        │ ║   ║
║  ║  │       - Linear(768 → 256) + ReLU                            │ ║   ║
║  ║  │       - Linear(256 → 1) → sigmoid → bert_prob [0-1]        │ ║   ║
║  ║  │     Device: CPU (no GPU required)                           │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  4. VADER SENTIMENT (25% weight)                            │ ║   ║
║  ║  │     Library: nltk.sentiment.SentimentIntensityAnalyzer      │ ║   ║
║  ║  │     Output: compound [-1, +1]                              │ ║   ║
║  ║  │     Conversion: vader_stress = max(0.0, -compound)         │ ║   ║
║  ║  │     (neutral/positive → 0 stress, negative → stress)       │ ║   ║
║  ║  │                                                              │ ║   ║
║  ║  │  5. HYBRID SCORE CALCULATION                                │ ║   ║
║  ║  │     stress_score = 0.75×bert_prob + 0.25×vader_stress       │ ║   ║
║  ║  │     stress_level = 1 + (stress_score × 9)  → [1.0, 10.0]  │ ║   ║
║  ║  │     stress_pct   = bert_prob × 100          → [0, 100]     │ ║   ║
║  ║  └──────────────────────────────────────────────────────────────┘ ║   ║
║  ║                                                                   ║   ║
║  ║  NVIDIA NIM (inside ml_service.py — used only by /chat)          ║   ║
║  ║    Model: meta/llama-3.1-70b-instruct (configurable via env)    ║   ║
║  ║    Used as fallback LLM within the Python service.              ║   ║
║  ║    Node.js backend has its own primary LLM chain (Gemini first).║   ║
║  ╚════════════════════════════════════════════════════════════════════╝   ║
└─────────────────────────────────────────────────────────────────────────────┘
                                    ↕
┌─────────────────────────────────────────────────────────────────────────────┐
║                 EXTERNAL LLM APIs                                           ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  ① Google Gemini 2.0 Flash (PRIMARY)                                │  ║
║  │     URL: https://generativelanguage.googleapis.com/v1beta/models/  │  ║
║  │     Free tier: 15 req/min, 1500 req/day per key                    │  ║
║  │     Response: ~1-3 seconds                                         │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
║  ┌──────────────────────────────────────────────────────────────────────┐  ║
║  │  ② NVIDIA NIM — Llama 3.1 70B (FALLBACK)                           │  ║
║  │     URL: https://integrate.api.nvidia.com/v1/chat/completions      │  ║
║  │     Paid API — used when Gemini is unavailable                     │  ║
║  │     Response: ~5-20 seconds                                        │  ║
║  └──────────────────────────────────────────────────────────────────────┘  ║
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Flow Diagram

### User Message Flow (complete)
```
User types a message
        ↓
Frontend (JS) → POST /chat/message  {chatId, text}
        ↓
Backend (Express)
  ├─ JWT verification (authMiddleware)
  ├─ detectLanguage(text)           → e.g. 'te' (Telugu)
  ├─ translateToEnglish(text, 'te') → English text for ML
  ├─ classifyMessage(englishText)   → 'emotional' or 'technical'
  │
  ├─ if TECHNICAL:
  │      stressScore = 5  (fixed, ML skipped)
  │
  └─ if EMOTIONAL:
         → POST ml-service:5000/chat {text: englishContextText}
         ← {stress_level, stress_percentage, components{bert_score, vader, combined}}
         stressScore = round(stress_level × 10)
         ↓
  callLLM(englishText, stressScore, category, contextMsgs)
    ├─ try callGemini()    → {text, source:'gemini'}
    ├─ try callNvidiaLLM() → {text, source:'nvidia'}
    └─ generateBotResponse() → {text, source:'fallback'}
         ↓
  translateFromEnglish(botText, 'te')  → Telugu response
         ↓
  MongoDB.save({userMessage, botMessage, stressData})
         ↓
Frontend displays:
  - Stress gauge (0–100%)
  - Stress level (1–10)
  - Bot response (in user's language)
  - Per-component breakdown (bert, vader, combined)
```

---

## 🔄 Multilingual Translation Chain

```
User message (any language)
        ↓
detectLanguage()    — langdetect library + English word guard
  → returns ISO 639-1 code (e.g. 'te', 'hi', 'ta', 'en')
        ↓
if NOT English:
  translateToEnglish()
    ├─ MyMemory API (primary, free, no key needed)
    └─ @vitalets/google-translate-api (fallback)
        ↓
[ML analysis + LLM response happen in English]
        ↓
if NOT English:
  translateFromEnglish()
    ├─ MyMemory API (primary)
    └─ Google Translate (fallback)
        ↓
User sees response in their language
```

**Supported languages**: English, Telugu, Hindi, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, Odia, French, German, Spanish, Arabic, Chinese, Japanese, Korean (and more via auto-detection)

---

## 📦 Deployment Architecture (Docker)

```
┌────────────────────────────────────────────────────────────┐
│              Docker Compose Orchestration                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  stress_detection_frontend (nginx:alpine)                 │
│    Port: 80 → /usr/share/nginx/html                       │
│    Routes: /auth/* /chat/* → backend:4000                  │
│            /ml/* → ml-service:5000                         │
│                                                            │
│  stress_detection_backend (node:18-alpine)                │
│    Port: 4000                                              │
│    Depends: ml-service (healthy)                           │
│    Env: MONGO_URI (Atlas URI), JWT_SECRET,                 │
│         GEMINI_API_KEY, NVIDIA_API_KEY, EMAIL_*            │
│    DB: Connects to MongoDB Atlas cloud cluster             │
│                                                            │
│  stress_detection_ml (python:3.10-slim)                   │
│    Port: 5000                                              │
│    Start period: 300s (DistilBERT model load)             │
│    Env: NVIDIA_API_KEY, NVIDIA_MODEL                       │
│                                                            │
│  ── MongoDB: MongoDB Atlas (external cloud service) ──    │
│    No local container — backend connects via MONGO_URI     │
│    Provider: MongoDB Atlas (cloud.mongodb.com)             │
│    Free M0 tier available                                  │
│                                                            │
│  Network: stress-network (bridge)                         │
└────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security Layers

```
Frontend
  - HTTPS only (production — Nginx TLS termination)
  - JWT stored in localStorage
  - No API keys in frontend code

Nginx (Docker)
  - Reverse proxy hides backend ports
  - Static file serving
  - Rate limiting (configurable)

Backend (Express)
  - JWT verification on all /chat/* routes
  - bcrypt password hashing (10 rounds)
  - Input validation via Mongoose schema
  - CORS configured

MongoDB Atlas (Cloud)
  - Authentication via Atlas database user credentials
  - Connection via TLS-encrypted mongodb+srv:// URI
  - Data persisted in Atlas cloud (managed backups available)
  - IP whitelist controls access (set 0.0.0.0/0 for Render deployment)
```

---

## 📈 Performance Metrics

| Operation                  | Time         | Notes                           |
|----------------------------|--------------|---------------------------------|
| Authentication             | 100–300ms    | bcrypt + JWT                    |
| Language detection         | < 5ms        | langdetect library              |
| Translation (MyMemory)     | 200–800ms    | Network call                    |
| DistilBERT prediction      | 200–800ms    | CPU inference                   |
| Chat (Gemini 2.0 Flash)    | 1–3s total   | ML + API call                   |
| Chat (NVIDIA NIM)          | 5–20s total  | ML + API call                   |
| Chat (offline fallback)    | ~300ms       | ML only, no API call            |
| Batch prediction (10 items)| 1–3s         | Sequential CPU inference        |

### Docker Container Resources
| Container   | RAM     | Notes                              |
|-------------|---------|------------------------------------|
| ML Service  | ~700 MB | DistilBERT model in memory         |
| Backend     | ~200 MB | Node.js + Express                  |
| MongoDB     | Cloud   | MongoDB Atlas (external, no local container) |
| Nginx       | ~10 MB  | Minimal                            |

---

## 📋 Integration Checklist

- ✅ ML Models (DistilBERT + VADER) integrated
- ✅ Flask microservice — /predict, /chat, /batch-predict, /health
- ✅ Backend LLM chain — Gemini → NVIDIA → offline fallback
- ✅ Multilingual support — 10+ languages via MyMemory + Google Translate
- ✅ Message classification — emotional vs technical routing
- ✅ MongoDB schema updated for DistilBERT + translation fields
- ✅ MongoDB Atlas cloud database (no local MongoDB container)
- ✅ Docker Compose with health checks (3 container orchestration: ml-service, backend, frontend)
- ✅ Nginx reverse proxy configured
- ✅ JWT authentication + OTP email verification
- ✅ Full documentation updated
- ⏳ End-to-end testing (manual required)
- ⏳ Production deployment (Render / Railway / VPS)

---

**Architecture Version**: 3.0
**Last Updated**: June 2026
**Key Change from v2**: LSTM replaced by DistilBERT; LM Studio replaced by Gemini/NVIDIA cloud APIs
