# StressBot — AI-Powered Stress Detection Chatbot

## Project Overview
StressBot is a full-stack web application that detects emotional stress from chat messages using NLP and AI.
It supports multilingual input (Hindi, Telugu, Tamil, English, etc.), provides intelligent AI responses via
**Gemini 2.0 Flash** (primary) → **NVIDIA NIM Llama 3.1 70B** (fallback), and tracks emotional trends over
time with an analytics dashboard.

---

## Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Vanilla JS, Tailwind CSS, Chart.js |
| Backend | Node.js + Express (port 4000) |
| Database | MongoDB Atlas (cloud-hosted) |
| ML Service | Python Flask + DistilBERT + VADER (port 5000) |
| LLM (primary) | Google Gemini 2.0 Flash (free, ~1-2s) |
| LLM (fallback) | NVIDIA NIM — Llama 3.1 70B Instruct |
| Translation | MyMemory API (free) + Google Translate fallback |

---

## How to Run Locally

### Prerequisites
- Node.js v16+ installed
- Python 3.8+ installed
- **MongoDB Atlas** account (free tier at https://cloud.mongodb.com/) — no local MongoDB needed
- ML model files in `../ml_service/`: `stress_model.pt` + `tokenizer.pkl`

### Step 1 — Install backend dependencies
```bash
cd backend
npm install
```

### Step 2 — Set Up MongoDB Atlas
1. Sign up at [https://cloud.mongodb.com/](https://cloud.mongodb.com/) (free M0 tier is sufficient)
2. Create a cluster → **Security**: add a database user (username + password)
3. **Network Access**: add IP `0.0.0.0/0` to allow connections from anywhere
4. **Connect** → Drivers → Node.js → copy connection string
5. Replace `<username>`, `<password>` and append `/stress_detection_db` before `?`

### Step 3 — Configure environment
```bash
cp backend/.env.example backend/.env
```
Edit `backend/.env` and fill in at minimum:
```
# Your MongoDB Atlas connection string
MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/stress_detection_db?retryWrites=true&w=majority
GEMINI_API_KEY=AIza...       ← Free key from https://aistudio.google.com/app/apikey
JWT_SECRET=your_strong_secret_here
```
Optional (fallback LLM):
```
NVIDIA_API_KEY=nvapi-...     ← https://build.nvidia.com/
```
Email fields can be left blank — OTP will show on screen in debug mode.

### Step 4 — Start the ML Service (Required for stress detection)
```bash
cd ../ml_service
pip install -r ml_requirements.txt   # first time only
python ml_service.py
```
Wait for: `[ML Service] ✓ DistilBERT model loaded successfully!`

### Step 5 — Start the Backend
```bash
cd backend
npm start
```
You should see: `Server listening on http://localhost:4000`

### Step 6 — Open the Frontend
Open `frontend/index.html` directly in your browser.
No web server needed — it's a plain HTML file.

### Quick Start (Scripts)
- **Windows:** Double-click `../START_ALL.bat`
- **Mac/Linux:** Run `bash start.sh`

---

## Key Features

### Feature 1 — Email OTP Signup
- Signup asks: Name, Email, Password, Confirm Password
- OTP sent to email for verification
- If SMTP not configured, OTP appears on screen (debug mode)
- Email validated with regex before sending OTP

### Feature 2 — DistilBERT + VADER Hybrid Stress Detection
- **DistilBERT fine-tuned** (75% weight) — PyTorch-based transformer
- **VADER Sentiment** (25% weight) — rule-based sentiment analysis
- Hybrid score → stress_level (1–10) + stress_percentage (0–100%)
- Technical messages (code questions, greetings) skip ML analysis

### Feature 3 — Context Window for Better Accuracy
- Last **5 emotional user messages** from the same chat are combined before analysis
- Technical messages excluded from context

### Feature 4 — Analytics Dashboard
- **Bar chart** (Chart.js v4): X-axis = chat date, Y-axis = avg stress %
- Bars color-coded: Green (Low ≤30%), Yellow (Moderate ≤60%), Red (High >60%)
- Summary cards: Total Chats, Total Messages, Avg Stress %, Trend
- Trend direction: Increasing / Stable / Decreasing
- **Only emotional messages** count toward stress averages

### Feature 5 — Multilingual Translation Pipeline
- Language auto-detected using `langdetect`
- Non-English messages translated to English before stress analysis
- Bot response generated in English, then translated back to user's language
- Translation uses **MyMemory API** (primary, free) + Google Translate (fallback)
- Supports: Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi, etc.

### Feature 6 — LLM Chain (Gemini → NVIDIA → Offline)
- **Gemini 2.0 Flash** (primary, free): fast ~1-2s, GPT-4 quality
- **NVIDIA NIM Llama 3.1 70B** (fallback): ~5-20s
- **Offline templates** (last resort): <100ms, no API key needed
- System prompt adapts tone based on stress level (HIGH/MODERATE/MILD/LOW)
- Always responds in English → translation sends it back in user's language

### Feature 7 — Database Schema
**User document:**
```json
{ "_id", "name", "email", "password", "createdAt" }
```

**Chat document:**
```json
{
  "_id", "userId", "chatName", "avgStress", "createdAt", "updatedAt",
  "messages": [
    {
      "role": "user",
      "text": "original text",
      "originalText": "original text",
      "translatedText": "English translation",
      "language": "hi",
      "category": "emotional",
      "stress": 78,
      "stressData": {"bert": 0.78, "vader": 0.65, "combined": 0.75, "percentage": 78},
      "timestamp": "..."
    },
    {
      "role": "bot",
      "text": "bot reply in user's language"
    }
  ]
}
```
- `stressData.bert` = DistilBERT score (0–1 probability from fine-tuned classifier)
- Bot messages have no stress/category/translatedText fields
- `avgStress` computed from emotional-only user messages

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/signup | Start signup with OTP |
| POST | /auth/verify-signup-otp | Verify OTP and create account |
| POST | /auth/login | Login, returns JWT token |
| POST | /auth/google | Google login |
| POST | /auth/send-otp | Send OTP for existing users |
| POST | /auth/verify-otp | OTP-based login |
| POST | /chat/new | Create new chat session |
| POST | /chat/message | Send message, get AI response |
| GET | /chat/all | Get all chats for user |
| GET | /chat/:chatId | Get specific chat |
| PATCH | /chat/:chatId | Rename chat |
| DELETE | /chat/:chatId | Delete chat |
| GET | /chat/analytics/:userId | Get stress analytics data |
| GET | /health | Backend health check |

---

## Project Structure
```
Stress Detection/
├── frontend/
│   ├── index.html          ← Login/Signup SPA entry point
│   ├── chat.html           ← Chat interface
│   └── js/
│       ├── app.js          ← All UI logic, routing, rendering
│       └── utils.js        ← API calls, auth, storage helpers
├── backend/
│   ├── server.js           ← Express app entry point (port 4000)
│   ├── .env.example        ← Environment variable template
│   ├── routes/
│   │   ├── auth.js         ← Signup/Login/OTP routes
│   │   └── chat_integrated.js ← Chat routes + LLM chain
│   ├── models/
│   │   ├── User.js         ← User MongoDB schema
│   │   └── Chat.js         ← Chat + messages MongoDB schema
│   ├── middleware/
│   │   └── authMiddleware.js ← JWT verification
│   └── utils/
│       ├── stressModel.js  ← detectStress(), generateBotResponse(), classifyMessage()
│       ├── translator.js   ← MyMemory + Google Translate pipeline
│       ├── mailer.js       ← Gmail SMTP OTP sender
│       ├── otp.js          ← OTP generation and in-memory storage
│       ├── emailValidator.js ← Email format validation
│       └── gemini.js       ← Legacy Gemini helper (kept for reference)
├── start.sh                ← Mac/Linux startup script
└── start.bat               ← Windows startup script (in project root: START_ALL.bat)
```
