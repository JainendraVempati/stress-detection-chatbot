# Quick Reference — Stress Detection Chatbot

## 🏗️ Architecture Overview
```
Frontend (HTML/Tailwind)
    ↓
Backend (Node.js/Express)  ←→  MongoDB Atlas (cloud DB)
    ↓                      ←→  Gemini 2.0 Flash (primary LLM)
    ↓                      ←→  NVIDIA NIM Llama 3.1 70B (fallback)
ML Service (Python Flask)
    └─ DistilBERT (75%) + VADER (25%)
```

---

## ☁️ MongoDB Atlas Setup (One-Time, Required)

1. Sign up at [https://cloud.mongodb.com/](https://cloud.mongodb.com/) (free M0 tier)
2. Create cluster → **Build a Database** → **FREE M0**
3. **Security**: create a DB user (username + password)
4. **Network Access**: Add `0.0.0.0/0` to allow connections from anywhere
5. **Connect** → Drivers → Node.js → copy the connection string
6. Edit your `.env`:
   ```env
   MONGO_URI=mongodb+srv://myuser:mypassword@cluster0.abcde.mongodb.net/stress_detection_db?retryWrites=true&w=majority
   ```

---

## 🚀 Option A — Manual Start (Development)

### 1. ML Service (Port 5000)
```bash
cd ml_service
pip install -r ml_requirements.txt           # first time only
python -c "import nltk; nltk.download('vader_lexicon')"  # first time only
python ml_service.py
```
Wait for: `[ML Service] ✓ DistilBERT model loaded successfully!`

### 2. Backend (Port 4000)
```bash
cd "Stress Detection/backend"
npm install      # first time only
npm start
```
Wait for: `✅ Connected to MongoDB Atlas` and `🚀 Server listening on http://localhost:4000`

> MongoDB Atlas is cloud-hosted — no local `mongod` needed.

### 3. Frontend
Open `Stress Detection/frontend/index.html` in your browser.

---

## 🐳 Option B — Docker (Production)
```bash
# Copy and configure environment
cp Stress\ Detection/backend/.env.example Stress\ Detection/backend/.env
# Edit .env: set MONGO_URI (Atlas), GEMINI_API_KEY and/or NVIDIA_API_KEY

# Build and start all containers (3 services: ml-service, backend, frontend)
docker-compose up --build

# Stop
docker-compose down
```

Access: http://localhost (port 80)

> **Note**: Docker Compose no longer includes a local MongoDB container.
> The backend connects directly to your MongoDB Atlas cluster via `MONGO_URI`.

---

## 🔑 Ports

| Service     | Port  | Notes                          |
|-------------|-------|--------------------------------|
| Frontend    | 80    | Nginx (Docker) or file open    |
| Backend API | 4000  | Node.js/Express                |
| ML Service  | 5000  | Python Flask + DistilBERT      |
| MongoDB     | Cloud | MongoDB Atlas (no local port)  |

---

## 🧪 Quick Health Checks

```bash
# Backend
curl http://localhost:4000/health

# ML Service
curl http://localhost:5000/health

# Test stress prediction
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling very stressed and overwhelmed"}'

# Test full chat (stress + LLM response)
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling anxious about work"}'
```

---

## ⏱️ Expected Response Times

| LLM Provider     | Response Time | Notes                          |
|------------------|---------------|--------------------------------|
| Gemini 2.0 Flash | 1–3 seconds   | Primary — free tier, very fast |
| NVIDIA NIM       | 5–20 seconds  | Fallback — paid API            |
| Local fallback   | < 100ms       | Offline templates, last resort |

---

## 🆘 Common Issues

| Problem                      | Solution                                                                     |
|------------------------------|------------------------------------------------------------------------------|
| ML Service won't start       | Check `stress_model.pt` and `tokenizer.pkl` exist in `ml_service/`          |
| `Models not loaded` error    | Wait longer on first start — DistilBERT takes 1-3 min                       |
| Backend 500 on message send  | Check Atlas connection (MONGO_URI) + ML Service healthy                      |
| MongoDB connection error     | Check MONGO_URI format, IP whitelist (0.0.0.0/0), and Atlas user credentials |
| Atlas cluster paused         | Free M0 clusters pause after 60 days — click Resume in Atlas dashboard       |
| Gemini 429 error             | Quota exceeded — auto-falls to NVIDIA                                        |
| NVIDIA 401 error             | Check `NVIDIA_API_KEY` in `.env`                                             |
| No LLM response              | Both API keys missing → using offline fallback templates                     |
| Email/OTP not sending        | Check `EMAIL_USER` and `EMAIL_PASS` in `.env`                                |
| Docker build fails           | Ensure `stress_model.pt` + `tokenizer.pkl` are in `ml_service/`             |

---

## 📁 Key Files

| File                                      | Purpose                              |
|-------------------------------------------|--------------------------------------|
| `README.md`                               | Full documentation                   |
| `docker-compose.yml`                      | Docker orchestration (3 services)    |
| `Dockerfile.ml`                           | ML service container build           |
| `ml_service/ml_service.py`                | DistilBERT + VADER Flask service     |
| `ml_service/stress_model.pt`              | Fine-tuned DistilBERT weights        |
| `ml_service/tokenizer.pkl`                | DistilBERT tokenizer                 |
| `ml_service/ml_requirements.txt`          | Python dependencies                  |
| `Stress Detection/backend/server.js`      | Node.js Express entry point          |
| `Stress Detection/backend/.env.example`   | Environment variable template        |
| `Stress Detection/frontend/index.html`    | Main frontend entry                  |
| `nginx.conf`                              | Nginx reverse proxy config           |

---

## 🔑 Environment Variables (backend/.env)

```env
# Required — MongoDB Atlas connection string
# Get from: https://cloud.mongodb.com/ → Connect → Drivers
MONGO_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/stress_detection_db?retryWrites=true&w=majority

JWT_SECRET=your_strong_secret_here

# LLM (at least one required)
GEMINI_API_KEY=AIza...          # Free: https://aistudio.google.com/app/apikey
NVIDIA_API_KEY=nvapi-...        # Paid: https://build.nvidia.com/

# Email OTP
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
```

---

**For full documentation, see README.md**
