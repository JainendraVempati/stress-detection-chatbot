# Stress Detection Chatbot - Production Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js >= 16.x
- Python >= 3.8
- MongoDB >= 4.4
- LM Studio (for LLM responses)

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
python ml_service.py
```

**Terminal 3 - Backend:**
```bash
cd backend
npm start
```

**Terminal 4 - LM Studio:**
- Open LM Studio
- Load Phi-3-Mini model
- Start server on port 1234

**Open Frontend:**
- Open `frontend/index.html` in browser
- Or serve with: `python -m http.server 3000` in frontend directory

#### Option 2: Using Docker (Production)
```bash
docker-compose up --build
```

---

## 📁 Project Structure

```
Stress Detection/
├── backend/
│   ├── models/              # MongoDB schemas
│   │   ├── User.js
│   │   └── Chat.js
│   ├── routes/              # API endpoints
│   │   ├── auth.js
│   │   └── chat_integrated.js
│   ├── middleware/
│   │   └── authMiddleware.js
│   ├── utils/
│   │   ├── mailer.js
│   │   ├── otp.js
│   │   └── stressModel.js
│   ├── .env
│   ├── server.js
│   └── package.json
├── frontend/
│   ├── index.html
│   └── js/
│       ├── app.js
│       └── utils.js
├── ml_service.py            # ML microservice
├── model.pkl                # Trained LSTM model
├── tokenizer.pkl            # Text tokenizer
├── sequence_config.pkl      # Sequence configuration
├── API_DOCUMENTATION.md
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
curl -X POST http://localhost:5000/health
```

Expected response:
```json
{
  "status": "healthy",
  "models_loaded": true,
  "timestamp": "2026-04-24T10:00:00.000Z"
}
```

### Test Stress Prediction
```bash
curl -X POST http://localhost:5000/predict \
  -H "Content-Type: application/json" \
  -d '{"text": "I am feeling very stressed and overwhelmed"}'
```

### Full Integration Test
1. Start all services
2. Open frontend in browser
3. Create account
4. Send message: "I'm feeling really stressed about work"
5. Verify stress score and bot response

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

### ML Service won't start
```bash
# Check if model files exist
ls -la model.pkl tokenizer.pkl sequence_config.pkl

# Reinstall dependencies
pip install -r ml_requirements.txt

# Check Python version
python --version  # Should be 3.8+
```

### MongoDB connection error
```bash
# Check if MongoDB is running
mongod --version

# Start MongoDB
sudo systemctl start mongod  # Linux
brew services start mongodb  # macOS
```

### LM Studio connection error
- Ensure LM Studio is running
- Verify model is loaded
- Check server port (default: 1234)
- Test: `curl http://localhost:1234/v1/models`

### Frontend not connecting to backend
- Check CORS settings in server.js
- Verify BASE_URL in frontend/js/utils.js
- Open browser console for errors

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
**Last Updated**: April 24, 2026  
**Status**: Production Ready ✅
