const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat_integrated'); // Use ML-integrated chat routes

dotenv.config({ path: path.resolve(__dirname, '.env') });

const app = express();
const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI;

if (!MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in environment variables.');
  console.error('   Set your MongoDB Atlas connection string in .env or Render environment.');
  process.exit(1);
}

// CORS configuration
// In production (Render), RENDER_FRONTEND_URL env var restricts access to your static site.
// In local dev, all origins are allowed (fallback to '*').
const allowedOrigins = process.env.RENDER_FRONTEND_URL
  ? [process.env.RENDER_FRONTEND_URL, 'http://localhost:4000', 'http://localhost:3000']
  : true; // allow all origins in local dev

app.use(cors({
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use('/auth', authRoutes);
app.use('/chat', chatRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    message: 'Stress Detection Chatbot backend is running.',
    version: '2.0.0',
    ml_integrated: true,
    db_connected: mongoose.connection.readyState === 1,
    timestamp: new Date().toISOString()
  });
});

// MongoDB Atlas connection
// Note: useNewUrlParser and useUnifiedTopology are removed — they are deprecated
// and not needed in Mongoose 7+ (which uses the new MongoDB Node.js driver by default).
mongoose.connect(MONGO_URI)
  .then(() => {
    console.log('✅ Connected to MongoDB Atlas');
    app.listen(PORT, () => {
      console.log(`🚀 Server listening on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('❌ MongoDB connection error:', error.message);
    console.error('   Check your MONGO_URI in .env — make sure Atlas IP whitelist includes 0.0.0.0/0');
    process.exit(1);
  });
