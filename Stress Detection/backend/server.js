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

app.use(cors());
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
