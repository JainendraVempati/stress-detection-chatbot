# Stress Detection System — Integration Guide (v3.0)

> **Note**: This document describes the current v3.0 architecture.
> For historical migration notes, see `INTEGRATION_COMPLETE.md` and `INTEGRATION_SUMMARY.md`.

## 📋 Project Overview

A full-stack stress detection chatbot with integrated ML capabilities:

- **Frontend**: HTML/JavaScript/Tailwind CSS chatbot UI
- **Backend**: Node.js/Express REST API + MongoDB (LLM chain: Gemini → NVIDIA → fallback)
- **ML Microservice**: Python Flask + DistilBERT (fine-tuned) + VADER

---

## 🏗️ Architecture (v3.0)

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (HTML/JS)                       │
│              Stress Detection Chatbot UI                    │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│          Backend (Node.js/Express + MongoDB)                │
│  - Authentication (JWT, OTP Email)                         │
│  - Chat Management + Analytics                             │
│  - LLM Chain: Gemini 2.0 Flash → NVIDIA NIM → fallback    │
│  - Multilingual: MyMemory + Google Translate               │
└──────────────────────────┬──────────────────────────────────┘
                           │ HTTP/REST API
                           ▼
┌─────────────────────────────────────────────────────────────┐
│       ML Microservice (Python Flask)                        │
│  - DistilBERT (fine-tuned) — 75% weight                    │
│  - VADER Sentiment Analysis — 25% weight                   │
│  - Hybrid score: stress_level (1-10) + percentage (0-100%) │
└─────────────────────────────────────────────────────────────┘
```

**Key changes from v2.0**:
- LSTM (TensorFlow) → DistilBERT (PyTorch + HuggingFace Transformers)
- LM Studio (local) → Gemini 2.0 Flash + NVIDIA NIM (cloud APIs)
- No LM Studio installation required

---

## 📁 Current File Structure

```
project-root/
├── Stress Detection/
│   ├── backend/
│   │   ├── routes/chat_integrated.js  # Main chat handler + LLM chain
│   │   ├── utils/stressModel.js       # Message classifier + offline fallback
│   │   ├── utils/translator.js        # Multilingual support
│   │   ├── utils/mailer.js            # Gmail SMTP OTP
│   │   ├── .env.example               # Environment template
│   │   └── server.js
│   └── frontend/
│       ├── index.html
│       ├── chat.html
│       └── js/{app.js, utils.js}
│
├── ml_service/
│   ├── ml_service.py           # Flask + DistilBERT + VADER + NVIDIA NIM
│   ├── ml_requirements.txt     # Python deps (torch, transformers, flask, etc.)
│   ├── stress_model.pt         # Fine-tuned DistilBERT weights (~254 MB)
│   └── tokenizer.pkl           # DistilBERT tokenizer
│
├── docker-compose.yml          # 5-container orchestration
├── Dockerfile.ml               # Python ML service container
└── nginx.conf                  # Reverse proxy
```

---

## 🚀 Setup Instructions

### 1. Install Dependencies

#### Backend (Node.js)
```bash
cd "Stress Detection/backend"
npm install
```

#### ML Microservice (Python)
```bash
cd ml_service
python -m venv ml_env          # recommended
source ml_env/bin/activate     # Linux/Mac
# ml_env\Scripts\activate      # Windows

pip install -r ml_requirements.txt

# Download NLTK VADER data (first time only)
python -c "import nltk; nltk.download('vader_lexicon')"
```

### 2. Configure Environment

```bash
cd "Stress Detection/backend"
cp .env.example .env
# Edit .env — fill in MONGO_URI (Atlas), GEMINI_API_KEY and/or NVIDIA_API_KEY
```

**Minimum required**:
```env
# MongoDB Atlas connection string (get from https://cloud.mongodb.com/)
MONGO_URI=mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/stress_detection_db?retryWrites=true&w=majority
JWT_SECRET=your_strong_secret_here
GEMINI_API_KEY=AIza...    # Free key from https://aistudio.google.com/app/apikey
```

> **MongoDB Atlas Setup** (required before starting):
> 1. Sign up at https://cloud.mongodb.com/ (free M0 tier)
> 2. Create cluster → Security: add DB user → Network Access: add `0.0.0.0/0`
> 3. Connect → Drivers → copy connection string → paste into `MONGO_URI` above

### 3. Start Services

**2 terminals** (MongoDB Atlas is cloud-hosted, no local terminal needed):

**Terminal 1 — ML Microservice**:
```bash
cd ml_service
python ml_service.py
```
Wait for: `[ML Service] ✓ DistilBERT model loaded successfully!`
(First run downloads DistilBERT base model ~250 MB — needs internet)

**Terminal 2 — Backend**:
```bash
cd "Stress Detection/backend"
npm start
```
Wait for: `✅ Connected to MongoDB Atlas` and `🚀 Server listening on http://localhost:4000`

**Frontend**: Open `Stress Detection/frontend/index.html` in browser.

---

## 📡 Key API Endpoints

See `API_DOCUMENTATION.md` for complete reference.

| Method | Endpoint              | Description                          |
|--------|-----------------------|--------------------------------------|
| POST   | `/auth/signup`        | Register + send OTP email            |
| POST   | `/auth/verify-signup-otp` | Verify OTP + complete registration |
| POST   | `/auth/login`         | Login with email + password          |
| POST   | `/chat/new`           | Create new chat session              |
| POST   | `/chat/message`       | Send message → get stress + LLM response |
| GET    | `/chat/all`           | List all user chats                  |
| GET    | `/chat/analytics/:id` | Stress trend analytics               |
| GET    | `/health`             | Backend health check                 |
| GET    | `5000/health`         | ML Service health check              |
| POST   | `5000/predict`        | Stress prediction only               |

---

## 🧠 ML Model Details (v3.0)

### DistilBERT Stress Classifier (75% weight)
```
Architecture: DistilBERT-base-uncased
  → CLS token (index 0) → Dropout(0.3)
  → Linear(768 → 256) → ReLU
  → Linear(256 → 1) → Sigmoid
  → bert_prob ∈ [0, 1]
```

### VADER Sentiment (25% weight)
```python
vader_stress = max(0.0, -compound)  # negative sentiment → stress
# neutral/positive → 0 (not 0.5 — important fix from v2!)
```

### Hybrid Score
```python
stress_score = 0.75 × bert_prob + 0.25 × vader_stress
stress_level = 1 + (stress_score × 9)   # → [1.0, 10.0]
stress_pct   = bert_prob × 100           # → [0, 100]
```

---

## 🔄 Integration Points

### Frontend → Backend
- POST `/chat/message` with `{chatId, text}`
- Receives `{chat, mlMetrics}` with stress score + bot response

### Backend → ML Microservice
- POST `ML_SERVICE_URL/chat` with `{text: englishContextText}`
- Returns `{stress_level, stress_percentage, components, bot_response}`

### Backend → LLM APIs (in order)
1. **Gemini 2.0 Flash**: `generativelanguage.googleapis.com` (set `GEMINI_API_KEY`)
2. **NVIDIA NIM**: `integrate.api.nvidia.com` (set `NVIDIA_API_KEY`)
3. **Offline**: `generateBotResponse()` in `utils/stressModel.js`

---

## 🐛 Troubleshooting

### ML Service Won't Start
```bash
# Check model files
ls -lh ml_service/stress_model.pt ml_service/tokenizer.pkl
# Both must exist!

# Check Python deps
pip install -r ml_service/ml_requirements.txt
```

### LLM Not Responding
```bash
# Add Gemini key (free!)
# https://aistudio.google.com/app/apikey
# Edit Stress Detection/backend/.env → GEMINI_API_KEY=AIza...
```

### MongoDB Atlas Connection Error
```
MongoServerSelectionError: connection to cluster0.xxxxx.mongodb.net failed
```
**Fix:**
1. Verify `MONGO_URI` in `.env` is the Atlas `mongodb+srv://` format
2. In Atlas → Network Access → add `0.0.0.0/0` (allow all IPs)
3. Check username/password are correct (URL-encode special characters)
4. If free cluster, check it isn't paused (Atlas pauses M0 after 60 days of inactivity)

---

## 📊 Monitoring

```bash
# Backend health
curl http://localhost:4000/health

# ML Service health
curl http://localhost:5000/health

# Run full system health check
cd ml_service
pip install colorama
python health_check.py
```

---

## 🐳 Docker (Production)

```bash
# Ensure model files exist in ml_service/ first
docker-compose up --build
# Access at http://localhost
```

---

**Last Updated**: June 2026
**Version**: 3.0 — DistilBERT + Gemini/NVIDIA (replaces LSTM + LM Studio)
