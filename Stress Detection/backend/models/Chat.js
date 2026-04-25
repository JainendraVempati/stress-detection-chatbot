const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
  },
  stress: {
    type: Number,
    required: true,
    min: 0,
    max: 100,
  },
  // Enhanced ML stress data (optional)
  stressData: {
    lstm: { type: Number },
    vader: { type: Number },
    combined: { type: Number },
    percentage: { type: Number },
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
