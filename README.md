# Stress Detection Chatbot — AI-Powered Mental Wellness

A production-ready stress detection system that uses **hybrid AI** (DistilBERT fine-tuned neural network + VADER sentiment analysis + cloud LLMs) to analyze stress levels in real-time conversations and provide empathetic, context-aware support in **multiple languages**.

---

## ✨ Features

- 🧠 **Hybrid Stress Detection**: 75% DistilBERT (fine-tuned) + 25% VADER Sentiment Analysis
- 💬 **Dual LLM Chain**: Gemini 2.0 Flash (primary, free, ~1–3s) → NVIDIA NIM Llama 3.1 70B (fallback) → offline templates (last resort)
- 🌍 **Multilingual Support**: Detects and translates 10+ languages (Telugu, Hindi, Tamil, Kannada, etc.) using MyMemory + Google Translate
- 🔐 **Secure Authentication**: JWT tokens, OTP email verification (Gmail SMTP), bcrypt password hashing
- 📊 **Real-time Analytics**: Per-chat stress averages, trend analysis, stress history
- 🎨 **Modern UI**: Tailwind CSS with responsive design, dark theme chat interface
- 🔒 **Privacy-First**: Your data stays on your own MongoDB instance
- 🐳 **Docker-Ready**: Full multi-container orchestration with health checks

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STRESS DETECTION SYSTEM                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Frontend (HTML / Tailwind CSS / Vanilla JS)                     │
│       └── Served by Nginx (port 80) or opened directly           │
│                          ↕  REST/JSON                            │
│  Backend: Node.js + Express (port 4000)                          │
│       ├── Auth routes (/auth) — JWT, OTP, bcrypt                 │
│       ├── Chat routes (/chat) — messages, analytics              │
│       ├── MongoDB — users, chats, messages                       │
│       └── LLM Chain:                                             │
│              ① Gemini 2.0 Flash     (primary, ~1-3s)             │
│              ② NVIDIA NIM Llama 70B (fallback, ~5-20s)           │
│              ③ Offline templates    (last resort)                 │
│                          ↕  HTTP/Axios                           │
│  ML Microservice: Python + Flask (port 5000)                     │
│       ├── DistilBERT (fine-tuned) — 75% weight                   │
│       ├── VADER Sentiment Analysis — 25% weight                  │
│       └── Hybrid score → stress_level (1–10) + percentage        │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

### LLM Chain Logic (in backend `chat_integrated.js`)
```
User Message
  → Language Detection (langdetect)
  → Translate to English (MyMemory → Google fallback)
  → Classify: technical or emotional
  → If emotional: ML Service (DistilBERT + VADER) → stress score
  → If technical: fixed low stress (skip ML)
  → LLM Response:
        ① Gemini 2.0 Flash  (if GEMINI_API_KEY set)
        ② NVIDIA NIM        (if NVIDIA_API_KEY set)
        ③ generateBotResponse() offline fallback
  → Translate response back to user's language
  → Save to MongoDB
  → Return to Frontend
```

---

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 16.x
- **Python** >= 3.8
- **MongoDB** >= 4.4 (local) or MongoDB Atlas URI
- At least one LLM API key (Gemini is free):
  - [Gemini API key](https://aistudio.google.com/app/apikey) — free, recommended
  - [NVIDIA NIM API key](https://build.nvidia.com/) — paid, used as fallback

### ML Model Files Required
These large files are **not included in Git** (use Git LFS or share via Google Drive):
- `ml_service/stress_model.pt` — DistilBERT fine-tuned weights (~254 MB)
- `ml_service/tokenizer.pkl` — DistilBERT tokenizer (~833 KB)

---

## 📦 Installation

### 1. Clone and Configure Environment
```bash
git clone https://github.com/JainendraVempati/stress-detection-chatbot.git
cd stress-detection-chatbot

# Configure backend environment
cp "Stress Detection/backend/.env.example" "Stress Detection/backend/.env"
# Edit .env and fill in your API keys (see Configuration section below)
```

### 2. Backend Setup
```bash
cd "Stress Detection/backend"
npm install
```

### 3. ML Service Setup
```bash
cd ml_service
pip install -r ml_requirements.txt

# Download NLTK VADER data (first time only)
python -c "import nltk; nltk.download('vader_lexicon')"
```

> **Note**: On first run, DistilBERT base model (~250 MB) is auto-downloaded from HuggingFace.
> Ensure internet access for the first startup.

---

## ▶️ Running the Application

### Option 1: Manual Start (Development)

> **Note**: MongoDB Atlas is cloud-hosted — no local `mongod` needed.
> Just ensure `MONGO_URI` in `.env` points to your Atlas cluster.

**Terminal 1 — ML Service:**
```bash
cd ml_service
python ml_service.py
```
Wait for: `[ML Service] ✓ DistilBERT model loaded successfully!`

**Terminal 2 — Backend:**
```bash
cd "Stress Detection/backend"
npm start
```
Wait for: `✅ Connected to MongoDB Atlas` and `🚀 Server listening on http://localhost:4000`

**Open Frontend:**
- Open `Stress Detection/frontend/index.html` in your browser

### Option 2: Start Script (Mac/Linux)
```bash
cd "Stress Detection"
chmod +x start.sh
./start.sh
```

### Option 3: Docker (Production)
```bash
# Ensure model files exist in ml_service/ first!
docker-compose up --build

# Access at: http://localhost
# Stop: docker-compose down
```

---

## ⚙️ Configuration

### Backend Environment Variables (`Stress Detection/backend/.env`)

```env
# ── Server ───────────────────────────────────────────────────────────────────
PORT=4000

# ── Database ─────────────────────────────────────────────────────────────────
MONGO_URI=mongodb://127.0.0.1:27017/stress_detection_db

# ── JWT ──────────────────────────────────────────────────────────────────────
JWT_SECRET=your_super_secret_key_change_in_production

# ── ML Microservice ──────────────────────────────────────────────────────────
ML_SERVICE_URL=http://localhost:5000

# ── LLM API Keys (chain: Gemini → NVIDIA → offline fallback) ─────────────────
# Gemini 2.0 Flash — PRIMARY (free, fast ~1-2s)
# Get key: https://aistudio.google.com/app/apikey  (sign in → Create API key)
GEMINI_API_KEY=                         # Leave empty to skip Gemini; NVIDIA is used automatically
GEMINI_MODEL=gemini-2.0-flash           # Optional: change model variant

# NVIDIA NIM — FALLBACK (Llama 3.1 70B)
# Get key: https://build.nvidia.com/
NVIDIA_API_KEY=nvapi-...
NVIDIA_MODEL=meta/llama-3.1-70b-instruct

# ── Email (Gmail SMTP for OTP verification) ───────────────────────────────────
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password      # Use Gmail App Password, not account password
EMAIL_FROM="StressBot <your-email@gmail.com>"
```

### Gmail App Password Setup
1. Enable 2-Step Verification in Google Account
2. Go to: Google Account → Security → 2-Step Verification → **App Passwords**
3. Select "Mail" and your device type
4. Copy the 16-character password into `EMAIL_PASS`

---

## 📁 Project Structure

```
project-root/
│
├── Stress Detection/
│   ├── backend/                     # Node.js Express API
│   │   ├── models/
│   │   │   ├── User.js              # User schema (MongoDB)
│   │   │   └── Chat.js              # Chat + Message schema (MongoDB)
│   │   ├── routes/
│   │   │   ├── auth.js              # Auth endpoints (signup, login, OTP)
│   │   │   └── chat_integrated.js   # Chat endpoints + LLM chain
│   │   ├── middleware/
│   │   │   └── authMiddleware.js    # JWT verification
│   │   ├── utils/
│   │   │   ├── stressModel.js       # Message classifier + offline fallback
│   │   │   ├── translator.js        # Multilingual support (MyMemory + Google)
│   │   │   ├── mailer.js            # Gmail SMTP OTP sender
│   │   │   ├── otp.js               # OTP generation and storage
│   │   │   ├── emailValidator.js    # Email format validation
│   │   │   └── gemini.js            # Legacy Gemini helper (kept for reference)
│   │   ├── server.js                # Express entry point
│   │   ├── package.json
│   │   ├── Dockerfile               # Node.js container
│   │   └── .env.example             # Environment variable template
│   │
│   └── frontend/                    # Static HTML/CSS/JS UI
│       ├── index.html               # Login / Signup page
│       ├── chat.html                # Chat interface
│       └── js/
│           ├── app.js               # Main frontend logic
│           └── utils.js             # API helpers, constants
│
├── ml_service/                      # Python ML Microservice
│   ├── ml_service.py                # Flask app — DistilBERT + VADER + NVIDIA NIM
│   ├── ml_requirements.txt          # Python dependencies
│   ├── stress_model.pt              # DistilBERT fine-tuned weights [GIT LFS / external]
│   ├── tokenizer.pkl                # DistilBERT tokenizer            [GIT LFS / external]
│   └── health_check.py              # System health check script
│
├── data/
│   └── final_stress_dataset.csv     # Training dataset [excluded from Git]
│
├── notebooks/
│   ├── LSTM_Training.ipynb          # Original LSTM training (historical)
│   └── LLM_Integration.ipynb        # LLM integration exploration
│
├── docs/
│   ├── ARCHITECTURE.md              # Detailed system architecture
│   ├── API_DOCUMENTATION.md         # Full API reference
│   ├── INTEGRATION_GUIDE.md         # Integration walkthrough
│   ├── GMAIL_SETUP_GUIDE.md         # Gmail SMTP setup guide
│   └── OTP_GUIDE.md                 # OTP system guide
│
├── docker-compose.yml               # Multi-container Docker orchestration
├── Dockerfile.ml                    # ML service Docker build
├── nginx.conf                       # Nginx reverse proxy configuration
├── QUICK_REFERENCE.md               # Short cheat-sheet for developers
└── README.md                        # This file
```

---

## 🧪 Testing

### Health Checks
```bash
# Backend
curl http://localhost:4000/health
# Expected: {"message":"Stress Detection Chatbot backend is running.","version":"2.0.0","ml_integrated":true}

# ML Service
curl http://localhost:5000/health
# Expected: {"status":"healthy","models_loaded":true,"model_type":"DistilBERT + VADER hybrid"}
```

### Test Stress Prediction (ML Service)
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling very stressed and overwhelmed with work"}'
```
Expected response:
```json
{
  "success": true,
  "data": {
    "stress_level": 7.85,
    "stress_percentage": 76.2,
    "bert_score": 0.762,
    "vader_score": 0.631,
    "combined_score": 0.729,
    "has_stress_keywords": true,
    "has_positive_keywords": false
  }
}
```

### Test Full Chat (ML + LLM)
```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling anxious about work"}'
```

### End-to-End Test
1. Start all services
2. Open `Stress Detection/frontend/index.html`
3. Create an account (check email for OTP)
4. Click "New Chat" and name it
5. Send: *"I'm feeling really stressed about work"*
6. Verify stress score and bot response appear (should take ~1–3s with Gemini)

### Run Full Health Check
```bash
cd ml_service
pip install colorama  # if not installed
python health_check.py
```

---

## 📊 ML Model Details

### Model: DistilBERT Fine-tuned Classifier
- **Architecture**: DistilBERT-base-uncased + Dropout(0.3) + Linear(768→256) + ReLU + Linear(256→1)
- **Training**: Fine-tuned on labeled stress/non-stress text dataset
- **Inference**: CLS token → sigmoid → stress probability (0–1)
- **Device**: CPU (no GPU required for inference)

### Hybrid Score Formula
```python
# DistilBERT (75%) + VADER (25%)
stress_score   = (0.75 × bert_prob) + (0.25 × vader_stress)
stress_level   = 1 + (stress_score × 9)   # → 1.0–10.0 scale
stress_pct     = bert_prob × 100           # → 0–100%
```

### VADER Correction (updated formula)
```python
# Old (wrong): vader_stress = (1 - compound) / 2  → 0.50 for neutral text
# New (correct): only negative sentiment maps to stress
vader_stress = max(0.0, -compound)   # neutral/positive → 0 stress
```

### Model Files
| File               | Description                     | Size    |
|--------------------|---------------------------------|---------|
| `stress_model.pt`  | DistilBERT fine-tuned weights   | ~254 MB |
| `tokenizer.pkl`    | DistilBERT tokenizer (pickled)  | ~833 KB |

> **Git LFS**: Both model files are excluded from Git by default.
> Add via `git lfs track` or share via cloud storage.

---

## 🔐 Security Best Practices

1. **JWT Secret**: Use a strong random string (32+ chars) in production
2. **Password Hashing**: bcrypt with 10 salt rounds
3. **CORS**: Configure `cors()` to allow only your domain in production
4. **Rate Limiting**: Add `express-rate-limit` for production deployments
5. **Input Validation**: All user inputs sanitized via mongoose schema validators
6. **HTTPS**: Use TLS/SSL in production (Nginx handles TLS termination)
7. **Environment Variables**: Never commit `.env` — use Docker secrets or platform vaults
8. **MongoDB Authentication**: Enabled with admin/password (change defaults in production)
9. **API Keys**: Keep `GEMINI_API_KEY` and `NVIDIA_API_KEY` server-side only — never in frontend

---

## 🚨 Troubleshooting

### ML Service Won't Load
```bash
# Check model files exist
ls -lh ml_service/stress_model.pt ml_service/tokenizer.pkl

# Reinstall Python dependencies
pip install -r ml_service/ml_requirements.txt

# Check Python version (needs 3.8+)
python --version
```

### Backend 500 Error
1. Check MongoDB is running: `mongosh`
2. Check ML Service is healthy: `curl http://localhost:5000/health`
3. Check `.env` has valid `MONGO_URI`
4. Check backend console for detailed error messages

### No LLM Responses (fallback only)
1. Set `GEMINI_API_KEY` in `.env` (free at https://aistudio.google.com/app/apikey)
2. Or set `NVIDIA_API_KEY` as fallback
3. Both missing → offline template responses are used automatically

### MongoDB Connection Error
```bash
# Windows
net start MongoDB

# Linux
sudo systemctl start mongod

# macOS
brew services start mongodb-community
```

### Docker Build Fails
```bash
# Most common: model files missing
ls ml_service/stress_model.pt ml_service/tokenizer.pkl
# Both must exist before running docker-compose up --build
```

### Email OTP Not Arriving
1. Verify `EMAIL_USER` and `EMAIL_PASS` are correct in `.env`
2. Use a **Gmail App Password**, not your regular Gmail password
3. Enable 2-Step Verification in Google Account first
4. Check spam/junk folder
5. Test: `curl -X POST http://localhost:4000/auth/signup -H "Content-Type: application/json" -d '{"name":"Test","email":"test@example.com","password":"pass123","confirmPassword":"pass123"}'`
   - If `"debug":true` in response, email is not configured — the OTP is shown in the response for testing

---

## 📈 Performance

### Response Times
| Operation             | Time      | Notes                            |
|-----------------------|-----------|----------------------------------|
| Auth (login/signup)   | 100–300ms | Includes bcrypt + JWT            |
| Stress prediction     | 200–800ms | DistilBERT CPU inference         |
| Chat (Gemini)         | 1–3s      | ML + Gemini API call             |
| Chat (NVIDIA)         | 5–20s     | ML + NVIDIA NIM API call         |
| Chat (offline)        | < 100ms   | Template response, no API        |
| Batch prediction (10) | 1–3s      | Sequential DistilBERT inference  |

### Resource Usage (Docker)
| Container     | RAM       | CPU   |
|---------------|-----------|-------|
| ML Service    | ~700 MB   | Low   |
| Backend       | ~200 MB   | Low   |
| MongoDB       | ~300 MB   | Low   |
| Frontend/Nginx| ~10 MB    | Minimal |

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📝 License

This project is for educational purposes.

---

## 📞 Support

- Open GitHub Issues for bugs/questions
- See `docs/API_DOCUMENTATION.md` for full API reference
- See `docs/ARCHITECTURE.md` for system design details
- See `QUICK_REFERENCE.md` for quick setup cheat-sheet

---

**Version**: 3.0.0
**Last Updated**: June 2026
**Status**: ✅ Fully Functional
**ML Model**: DistilBERT fine-tuned (75%) + VADER (25%)
**LLM Chain**: Gemini 2.0 Flash → NVIDIA NIM Llama 3.1 70B → Offline fallback
**Response Time**: 1–3 seconds (Gemini), 5–20 seconds (NVIDIA)
