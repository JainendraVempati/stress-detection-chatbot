# StressBot — AI-Powered Stress Detection Chatbot

## Project Overview
StressBot is a full-stack web application that detects emotional stress from chat messages using NLP and AI.
It supports multilingual input (Hindi, Telugu, Tamil, English etc.), provides intelligent AI responses via
NVIDIA NIM (Llama 3.1 70B), and tracks emotional trends over time with an analytics dashboard.

---

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS, Tailwind CSS, Chart.js |
| Backend | Node.js + Express (port 4000) |
| Database | MongoDB (port 27017) |
| ML Service | Python Flask (port 5000) — optional |
| LLM | NVIDIA NIM — Llama 3.1 70B Instruct |
| Translation | MyMemory API (free) + Google Translate fallback |

---

## How to Run Locally

### Prerequisites
- Node.js v16+ installed
- MongoDB installed and running
- npm installed

### Step 1 — Install backend dependencies
```bash
cd backend
npm install
```

### Step 2 — Configure environment
Open `backend/.env` and fill in:
```
NVIDIA_API_KEY=nvapi-your-key-here       ← Required for AI responses
MONGO_URI=mongodb://127.0.0.1:27017/stress_detection_db
JWT_SECRET=stressbot_super_secret_key_2026
```
Email fields can be left blank — OTP will show on screen in debug mode.

### Step 3 — Start MongoDB
**Windows:**
```
net start MongoDB
```
**Mac:**
```
brew services start mongodb-community
```
**Linux:**
```
sudo systemctl start mongod
```

### Step 4 — Start the Backend
```bash
cd backend
npm start
```
You should see: `Server listening on http://localhost:4000`

### Step 5 — Open the Frontend
Open `frontend/index.html` directly in your browser.
No web server needed — it's a plain HTML file.

### Quick Start (Scripts)
- **Windows:** Double-click `start.bat`
- **Mac/Linux:** Run `bash start.sh`

---

## 7 Changes Implemented

### Change 1 — Email OTP Signup
- Simplified login UI — single email + password form
- Signup asks: Name, Email, Password, Confirm Password
- OTP sent to email for verification
- If SMTP not configured, OTP appears on screen (debug mode)
- Email validated with regex before sending OTP

### Change 2 — Database Improvements
- Stress score stored **only on user messages** — bot messages have no stress field
- `chatName` stored in every chat document
- Technical messages (code questions, greetings) get stress = 3 (near-zero)
- Technical messages excluded from average stress calculation
- `category` field on every user message: `emotional` or `technical`

### Change 3 — BERT Context Window
- Last **5 emotional user messages** from the same chat are combined before analysis
- Context string: `"prev1. prev2. prev3. current"` sent to stress model
- Technical messages excluded from context (they don't add emotional signal)
- Sleep/fatigue/pressure keywords expanded (+25 new terms)
- Fixed Dutch/French misdetection of short English sentences

### Change 4 — Analytics Dashboard
- New `#analytics` page accessible from chat header and sidebar
- **Bar chart** (Chart.js v4): X-axis = chat date, Y-axis = avg stress %
- Bars color-coded: Green (Low ≤30%), Yellow (Moderate ≤60%), Red (High >60%)
- Summary cards: Total Chats, Total Messages, Avg Stress %, Trend
- Trend direction: Increasing / Stable / Decreasing (based on last 6 chats)
- Per-chat breakdown table below the chart
- **Only emotional messages** count toward stress averages

### Change 5 — Multilingual Translation Pipeline
- Language auto-detected using `langdetect`
- Non-English messages translated to English before stress analysis
- Bot response generated in English, then translated back to user's language
- Translation uses **MyMemory API** (primary, no rate limits) + Google Translate (fallback)
- Stored in DB: `originalText` (native) + `translatedText` (English) + `language` code
- Supports: Hindi, Telugu, Tamil, Kannada, Malayalam, Bengali, Marathi, Gujarati, Punjabi

### Change 6 — NVIDIA NIM LLM Integration
- **NVIDIA NIM** (Llama 3.1 70B Instruct) generates all bot responses
- System prompt is stress-aware: tone adapts based on stress level
  - High stress (≥70%) → empathetic, grounding techniques
  - Moderate (≥40%) → supportive, coping tips
  - Mild (>10%) → encouraging, positive steps
  - Calm (≤10%) → light, wellness reinforcement
- Always responds in English → translation (Change 5) sends it back in user's language
- Falls back to `generateBotResponse()` if NVIDIA key missing or API fails
- `responseSource` field in API response: `'nvidia'` or `'fallback'`

### Change 7 — Database Schema Verification
All MongoDB documents verified to match plan.txt spec:

**User document:**
```json
{ "_id", "name", "email", "password", "preferredLanguage", "createdAt" }
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
      "timestamp": "..."
    },
    {
      "role": "bot",
      "text": "bot reply in user's language"
    }
  ]
}
```
- Bot messages have **no** stress, category, or translatedText fields
- avgStress computed from emotional-only user messages

---

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /auth/signup | Start signup with OTP |
| POST | /auth/verify-otp | Verify OTP and create account |
| POST | /auth/login | Login, returns JWT token |
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
│   ├── index.html          ← Main SPA entry point
│   └── js/
│       ├── app.js          ← All UI logic, routing, rendering
│       └── utils.js        ← API calls, auth, storage helpers
├── backend/
│   ├── server.js           ← Express app entry point (port 4000)
│   ├── .env                ← Environment variables (NVIDIA key etc.)
│   ├── routes/
│   │   ├── auth.js         ← Signup/Login/OTP routes
│   │   └── chat_integrated.js ← All chat routes + NVIDIA LLM
│   ├── models/
│   │   ├── User.js         ← User schema
│   │   └── Chat.js         ← Chat + messages schema
│   ├── middleware/
│   │   └── authMiddleware.js ← JWT verification
│   └── utils/
│       ├── stressModel.js  ← detectStress(), generateBotResponse(), classifyMessage()
│       ├── translator.js   ← MyMemory + Google Translate pipeline
│       └── gemini.js       ← Dormant (not used — kept for future)
├── ml_service/
│   └── ml_service.py       ← Flask LSTM service (optional — fallback active if offline)
├── start.sh                ← Mac/Linux startup script
└── start.bat               ← Windows startup script
```
