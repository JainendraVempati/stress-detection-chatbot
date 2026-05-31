# Quick Reference - Stress Detection Chatbot

## 🚀 Start Everything (Windows)
```bash
START_ALL.bat
```

## 🔧 Manual Start

### 1. LM Studio (MUST be first!)
- Open LM Studio
- Load model: `phi-3-mini-4k-instruct`
- Click Server icon (⚡) → Start Server
- Port: 1234

### 2. ML Service
```bash
cd ml_service
python ml_service.py
```
Look for: `[LM Studio] Auto-detected model: phi-3-mini-4k-instruct`

### 3. Backend
```bash
cd "Stress Detection/backend"
npm start
```
Look for: `Connected to MongoDB`

### 4. Frontend
Open: `Stress Detection/frontend/index.html`

---

## 🧪 Quick Tests

```bash
# Test Backend
curl http://localhost:4000/health

# Test ML Service
curl http://localhost:5000/health

# Test LM Studio
curl http://localhost:1234/v1/models

# Test Full Chat
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling stressed"}'
```

---

## ⏱️ Expected Response Times

- **First message**: 25-35 seconds (cold start)
- **After that**: 10-20 seconds
- **This is NORMAL** for local LLMs!

---

## 🆘 Common Issues

| Problem | Solution |
|---------|----------|
| LM Studio not connecting | Start server in LM Studio (⚡ icon) |
| Backend 500 error | Check MongoDB is running |
| ML Service won't start | Check model files exist |
| Timeout errors | Wait longer, LM Studio is slow |
| Model name error | Restart ML Service (auto-detects) |

---

## 📁 Important Files

- `README.md` - Full documentation
- `START_ALL.bat` - Automated startup
- `ml_service/ml_service.py` - ML server
- `Stress Detection/backend/server.js` - Backend server
- `Stress Detection/frontend/index.html` - Frontend

---

## 🔑 Ports

- **1234**: LM Studio
- **4000**: Backend (Express)
- **5000**: ML Service (Flask)
- **27017**: MongoDB

---

**For full documentation, see README.md**
