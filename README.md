# Stress Detection Chatbot - AI-Powered Mental Wellness

A production-ready stress detection system that uses **hybrid AI** (LSTM neural network + VADER sentiment analysis + Local LLM) to analyze stress levels in real-time conversations and provide empathetic, context-aware support.

## ✨ Features

- 🧠 **Hybrid Stress Detection**: 75% LSTM Neural Network + 25% VADER Sentiment Analysis
- 💬 **LM Studio Integration**: Local LLM generates empathetic responses based on stress levels
- 🔐 **Secure Authentication**: JWT tokens, OTP verification, Google login
- 📊 **Real-time Analytics**: Track stress levels over time with per-chat averages
- 🎨 **Modern UI**: Tailwind CSS with responsive design
- 🔒 **Privacy-First**: All data stored locally, LM Studio runs on your machine
- 📈 **Stress Tracking**: Daily stress summaries with moving averages and trends

## 🚀 Quick Start

### Prerequisites
- **Node.js** >= 16.x
- **Python** >= 3.8
- **MongoDB** >= 4.4
- **LM Studio** (download from https://lmstudio.ai/)

### Important: LM Studio Setup

**Before starting the app, you MUST setup LM Studio:**

1. **Download & Install** LM Studio from https://lmstudio.ai/
2. **Download a model** (recommended: `phi-3-mini-4k-instruct`)
3. **Start the server**:
   - Click the Server icon (⚡)
   - Click "Start Server"
   - Verify port is `1234`
   - Wait for model to load completely
4. **Test connection**:
   ```bash
   curl http://localhost:1234/v1/models
   ```

**⚠️ Performance Note:**
- First message: 25-35 seconds (LM Studio cold start)
- Subsequent messages: 10-20 seconds
- This is normal for local LLMs!

### Installation

#### 1. Backend Setup
```bash
cd backend
npm install
cp .env.example .env  # Configure your environment variables
```

#### 2. ML Service Setup
```bash
# Install Python dependencies
pip install -r ../ml_requirements.txt

# Download NLTK data
python -c "import nltk; nltk.download('vader_lexicon')"
```

#### 3. Frontend Setup
No installation required - serves static files directly.

### Running the Application

#### Option 1: Manual Start (Development)

**Terminal 1 - MongoDB:**
```bash
mongod
```

**Terminal 2 - ML Service:**
```bash
cd ml_service
python ml_service.py
```
Wait for: `[LM Studio] Auto-detected model: phi-3-mini-4k-instruct`

**Terminal 3 - Backend:**
```bash
cd "Stress Detection/backend"
npm start
```
Wait for: `Connected to MongoDB` and `Server listening on http://localhost:4000`

**Terminal 4 - LM Studio:**
- Open LM Studio (must be running before starting app)
- Load `phi-3-mini-4k-instruct` model
- Start server on port 1234
- Wait for model to load

**Open Frontend:**
- Open `Stress Detection/frontend/index.html` in browser

#### Option 2: Automated Start (Windows)
```bash
START_ALL.bat
```
This script will:
1. Test LM Studio connection
2. Start ML Service
3. Start Backend Server
4. Open frontend in browser

#### Option 3: Using Docker (Production)
```bash
docker-compose up --build
```

---

## 📁 Project Structure

```
project-root/
│
├── Stress Detection/
│   ├── backend/              # Node.js Express API
│   │   ├── models/           # MongoDB schemas
│   │   ├── routes/           # API endpoints
│   │   ├── middleware/       # Auth middleware
│   │   ├── utils/            # Helper functions
│   │   ├── server.js
│   │   └── package.json
│   └── frontend/             # HTML/CSS/JS UI
│       ├── index.html
│       └── js/
│
├── ml_service/               # Python ML microservice
│   ├── ml_service.py
│   ├── model.pkl             # Trained LSTM model
│   ├── tokenizer.pkl
│   ├── sequence_config.pkl
│   └── ml_requirements.txt
│
├── data/                     # Datasets
│   └── final_stress_dataset.csv
│
├── notebooks/                # Jupyter notebooks
│   ├── LSTM_Training.ipynb
│   └── LLM_Integration.ipynb
│
├── docs/                     # Documentation
│   ├── ARCHITECTURE.md
│   ├── INTEGRATION_GUIDE.md
│   └── (other docs)
│
├── docker-compose.yml        # Docker orchestration
├── Dockerfile.ml             # ML service container
├── nginx.conf                # Nginx configuration
├── QUICK_START.md            # Quick setup guide
└── README.md
```

---

## 🔧 Configuration

### Backend Environment Variables (.env)

```env
# Server
PORT=4000
MONGO_URI=mongodb://127.0.0.1:27017/stress_detection_db
JWT_SECRET=your_super_secret_key_change_in_production

# ML Service
ML_SERVICE_URL=http://localhost:5000

# LM Studio
LM_STUDIO_URL=http://localhost:1234

# Email (Gmail)
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_SECURE=false
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
EMAIL_FROM="StressBot <your-email@gmail.com>"
```

### Gmail Setup for OTP
1. Enable 2-Step Verification in Google Account
2. Generate App Password:
   - Go to Google Account → Security → 2-Step Verification → App Passwords
   - Select "Mail" and your device
   - Copy the 16-character password
3. Use this password in `EMAIL_PASS`

---

## 🧪 Testing

### Test Backend
```bash
curl http://localhost:4000/health
```

Expected response:
```json
{
  "message": "Stress Detection Chatbot backend is running.",
  "version": "2.0.0",
  "ml_integrated": true,
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### Test ML Service
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### Test LM Studio
```bash
curl http://localhost:1234/v1/models
```

Expected: List of loaded models including `phi-3-mini-4k-instruct`

### Test Stress Prediction
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling very stressed and overwhelmed"}'
```

### Test Full Chat (with LLM)
```bash
curl -X POST http://localhost:5000/chat \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling anxious about work"}'
```

Expected response (takes 10-30 seconds):
```json
{
  "success": true,
  "stress_level": 6.78,
  "stress_percentage": 65.23,
  "components": {
    "lstm": 0.652,
    "vader": 0.613,
    "combined": 0.643,
    "has_stress_keywords": true,
    "has_positive_keywords": false
  },
  "bot_response": "I understand you're feeling anxious..."
}
```

### Full Integration Test
1. Start all services
2. Open frontend in browser
3. Create account
4. Create a new chat
5. Send message: "I'm feeling really stressed about work"
6. **Wait 20-40 seconds** (LM Studio is slow!)
7. Verify stress score and bot response appear

---

## 📊 ML Model Details

### Architecture
- **LSTM Neural Network** (75% weight)
  - Trained on labeled stress dataset
  - Processes sequential text data
  - Outputs stress probability (0-1)

- **VADER Sentiment Analysis** (25% weight)
  - Rule-based sentiment scorer
  - Analyzes emotional tone
  - Converts to stress scale

### Hybrid Score Calculation
```python
stress_score = (0.75 * lstm_prob) + (0.25 * vader_stress)
stress_level = 1 + (stress_score * 9)  # Scale to 1-10
stress_percentage = lstm_prob * 100    # Scale to 0-100
```

### Model Files
- `model.pkl`: Trained LSTM model (TensorFlow/Keras)
- `tokenizer.pkl`: Text preprocessing tokenizer
- `sequence_config.pkl`: Sequence padding configuration

---

## 🔐 Security Best Practices

1. **JWT Secret**: Use strong random string in production
2. **Password Hashing**: bcrypt with salt rounds >= 10
3. **CORS**: Configure allowed origins for production
4. **Rate Limiting**: Implement request throttling
5. **Input Validation**: Sanitize all user inputs
6. **HTTPS**: Use TLS in production
7. **Environment Variables**: Never commit .env files
8. **MongoDB**: Enable authentication and use strong passwords

---

## 🚨 Troubleshooting

### LM Studio Not Connecting
**Error:** `LM Studio service unavailable`

**Fix:**
1. Open LM Studio
2. Click Server icon (⚡)
3. Click "Start Server"
4. Verify port is `1234`
5. Ensure model is loaded (not still loading)
6. Test: `curl http://localhost:1234/v1/models`

### Backend 500 Error When Sending Message
**Error:** `Failed to load resource: the server responded with a status of 500`

**Check:**
1. **MongoDB is running**: `mongosh` (should connect)
2. **ML Service is running**: `curl http://localhost:5000/health`
3. **Backend console logs**: Look for detailed error messages
4. **You're logged in**: Check browser console for auth errors
5. **A chat exists**: Click "New chat" before sending messages

**Common causes:**
- ML Service not running
- MongoDB not connected
- Missing authentication token
- No chat selected

### ML Service Won't Start
**Error:** `Failed to load models`

**Fix:**
```bash
# Check if model files exist
ls model.pkl tokenizer.pkl sequence_config.pkl

# Reinstall dependencies
pip install -r ml_requirements.txt

# Check Python version
python --version  # Should be 3.8+
```

### MongoDB Connection Error
**Error:** `MongoDB connection error`

**Fix:**
```bash
# Check if MongoDB is running
mongosh

# Start MongoDB (Windows)
net start MongoDB

# Start MongoDB (Linux)
sudo systemctl start mongod

# Start MongoDB (macOS)
brew services start mongodb
```

### Frontend Not Connecting to Backend
**Check:**
1. CORS settings in `server.js`
2. `BASE_URL` in `frontend/js/utils.js` (should be `http://localhost:4000`)
3. Browser console for errors
4. Backend is running on port 4000

### Slow LM Studio Responses (>60 seconds)
**This is normal for first message!**

**To improve speed:**
1. **Use GPU acceleration**: LM Studio Settings → GPU Offload → Max
2. **Keep LM Studio running**: Don't close between messages
3. **Close other apps**: Free up RAM/CPU
4. **Use smaller models**: phi-3-mini (3.8B) is faster than Llama-3-8B
5. **Wait for model to load**: Don't send messages until LM Studio shows "Ready"

### Model Name Mismatch
**Error:** `Invalid model identifier "phi-3-mini"`

**Fix:**
The ML Service auto-detects the model name. If it fails:
1. Check available models: `curl http://localhost:1234/v1/models`
2. Restart ML Service: `python ml_service.py`
3. Look for: `[LM Studio] Auto-detected model: phi-3-mini-4k-instruct`

### Timeout Errors
**Error:** `LM Studio request timed out`

**Fix:**
1. Backend timeout is set to 45 seconds (line 18 in `chat_integrated.js`)
2. ML Service timeout is 30 seconds (line 258 in `ml_service.py`)
3. If still timing out, increase these values
4. Check if LM Studio model is fully loaded

---

## 📈 Performance Optimization

### Production Recommendations
1. **Database**: Use MongoDB Atlas with indexes
2. **Caching**: Implement Redis for session/token caching
3. **Load Balancing**: Use Nginx reverse proxy
4. **CDN**: Serve static frontend files via CDN
5. **Compression**: Enable gzip compression
6. **Connection Pooling**: Configure MongoDB connection pool
7. **Async Processing**: Use message queue for email sending

### Monitoring
- Application: PM2 or forever for process management
- Logs: Winston + Morgan for structured logging
- APM: New Relic, Datadog, or Sentry
- Metrics: Prometheus + Grafana

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is for educational purposes.

---

## 📞 Support

For issues and questions:
- Open GitHub Issues
- Check API_DOCUMENTATION.md
- Review troubleshooting section

---

**Version**: 2.0.0  
**Last Updated**: April 25, 2026  
**Status**: Fully Functional ✅  
**LM Studio Model**: phi-3-mini-4k-instruct (auto-detected)  
**Response Time**: 10-30 seconds (normal for local LLM)
