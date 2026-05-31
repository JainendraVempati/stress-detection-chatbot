const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  // text is the primary field: original for user, response for bot
  text: {
    type: String,
    required: true,
    trim: true,
  },
  // Translation fields (user messages only)
  originalText: {
    type: String,
    trim: true,
    default: null,
  },
  translatedText: {
    type: String,
    trim: true,
    default: null,
  },
  language: {
    type: String,
    default: 'en',
  },
  // Stress score (user messages only — bot messages don't have stress)
  stress: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
  // Enhanced ML stress data (optional)
  stressData: {
    lstm: { type: Number },
    vader: { type: Number },
    combined: { type: Number },
    percentage: { type: Number },
  },
  // Message category: emotional (stress scored) or technical (low stress)
  category: {
    type: String,
    enum: ['emotional', 'technical', null],
    default: null,
  },
  role: {
    type: String,
    required: true,
    enum: ['user', 'bot'],
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const chatSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  chatName: {
    type: String,
    required: true,
    trim: true,
    default: 'New Chat',
  },
  messages: {
    type: [messageSchema],
    default: [],
  },
  avgStress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

module.exports = mongoose.model('Chat', chatSchema);
