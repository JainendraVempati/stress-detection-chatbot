const express = require('express');
const axios = require('axios');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();
router.use(authMiddleware);

// ML Microservice URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * Helper function to call ML microservice
 */
async function callMLService(endpoint, data) {
  try {
    console.log(`[ML Service] Calling ${endpoint} with data:`, JSON.stringify(data).substring(0, 100));
    const startTime = Date.now();
    const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, data, {
      timeout: 45000,  // Increased to 45 seconds for LM Studio
    });
    const elapsed = Date.now() - startTime;
    console.log(`[ML Service] Response from ${endpoint} received in ${elapsed}ms`);
    return response.data;
  } catch (error) {
    console.error(`\n[ML Service] ERROR calling ${endpoint}:`);
    console.error('[ML Service] Error message:', error.message);
    if (error.response) {
      console.error('[ML Service] Response status:', error.response.status);
      console.error('[ML Service] Response data:', error.response.data);
    } else if (error.request) {
      console.error('[ML Service] No response received - timeout or connection error');
    }
    return {
      success: false,
      error: error.message || 'ML Service unavailable',
    };
  }
}

// ─────────────────────────────────────────────────────────────
// POST /chat/new
// ─────────────────────────────────────────────────────────────
router.post('/new', async (req, res) => {
  try {
    const { chatName } = req.body;
    const userId = req.user._id;

    if (!chatName) {
      return res.status(400).json({ error: 'Chat name is required.' });
    }

    const chat = await Chat.create({
      userId,
      chatName: chatName.trim(),
      messages: [],
      avgStress: 0,
      model: 'hybrid', // LSTM + VADER + LLM
    });

    return res.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({ error: 'Could not create chat.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /chat/message
// Enhanced with ML-based stress detection
// ─────────────────────────────────────────────────────────────
router.post('/message', async (req, res) => {
  try {
    const { chatId, text } = req.body;

    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId and text are required.' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    console.log(`\n[Chat] Processing message for chat: ${chatId}`);
    console.log(`[Chat] User message: "${text.substring(0, 50)}..."`);

    // Call ML Service for stress prediction + LLM response
    console.log('[Chat] Calling ML Service...');
    const mlResult = await callMLService('/chat', { text: text.trim() });
    console.log('[Chat] ML Service response:', JSON.stringify(mlResult, null, 2));

    let stressScore = 0; // Default to calm
    let botText = '';
    let stressData = {};

    if (mlResult.success) {
      stressScore = Math.round(mlResult.stress_level * 10); // Convert 1-10 to 0-100
      botText = mlResult.bot_response;
      stressData = {
        lstm: mlResult.components.lstm,
        vader: mlResult.components.vader,
        combined: mlResult.components.combined,
        percentage: mlResult.stress_percentage,
        hasStressKeywords: mlResult.components.has_stress_keywords || false,
      };
      console.log(`[Chat] Stress score: ${stressScore}%, Bot response length: ${botText.length} chars`);
    } else {
      // Fallback: Use local keyword detection with better accuracy
      console.log('[Chat] ML Service failed, using fallback detection');
      const { detectStress, generateBotResponse } = require('../utils/stressModel');
      stressScore = detectStress(text);
      botText = generateBotResponse(text, stressScore);
      stressData = {
        fallback: true,
        percentage: stressScore,
        hasStressKeywords: stressScore > 0,
      };
    }

    console.log('[Chat] Saving user message to MongoDB...');
    // Store user message
    chat.messages.push({
      text: text.trim(),
      stress: stressScore,
      stressData,
      role: 'user',
      timestamp: new Date(),
    });

    console.log('[Chat] Saving bot response to MongoDB...');
    // Store bot response
    chat.messages.push({
      text: botText,
      stress: 0,
      role: 'bot',
      timestamp: new Date(),
    });

    // Calculate average stress from user messages
    const userMessages = chat.messages.filter((msg) => msg.role === 'user');
    const totalStress = userMessages.reduce((sum, msg) => sum + (msg.stress || 0), 0);
    chat.avgStress = userMessages.length > 0 ? Math.round(totalStress / userMessages.length) : 0;

    console.log(`[Chat] Saving chat with ${chat.messages.length} messages, avg stress: ${chat.avgStress}%`);
    await chat.save();
    console.log('[Chat] Chat saved successfully!\n');

    return res.json({
      chat,
      mlMetrics: {
        stressLevel: stressScore / 10,
        stressPercentage: stressData.percentage || 0,
        components: stressData,
      },
    });
  } catch (error) {
    console.error('\n[Chat] ERROR in /message endpoint:');
    console.error('[Chat] Error message:', error.message);
    console.error('[Chat] Error stack:', error.stack);
    console.error('[Chat] Request body:', req.body);
    console.error('[Chat] User ID:', req.user?._id);
    return res.status(500).json({ error: 'Could not add message.', details: error.message });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /chat/predict/:chatId
// Endpoint for stress predictions only (no chat)
// ─────────────────────────────────────────────────────────────
router.get('/predict/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { text } = req.query;

    if (!text) {
      return res.status(400).json({ error: 'text query parameter is required.' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    // Call ML Service for prediction only
    const mlResult = await callMLService('/predict', { text });

    if (!mlResult.success) {
      return res.status(500).json({ error: 'Prediction failed.' });
    }

    return res.json({
      stressLevel: mlResult.data.stress_level,
      stressPercentage: mlResult.data.stress_percentage,
      components: {
        lstm: mlResult.data.lstm_score,
        vader: mlResult.data.vader_score,
        combined: mlResult.data.combined_score,
      },
    });
  } catch (error) {
    console.error('Error predicting stress:', error);
    return res.status(500).json({ error: 'Could not predict stress.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /chat/batch-predict
// Batch prediction endpoint for multiple texts
// ─────────────────────────────────────────────────────────────
router.post('/batch-predict', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts array is required.' });
    }

    // Call ML Service for batch prediction
    const mlResult = await callMLService('/batch-predict', { texts });

    if (!mlResult.success) {
      return res.status(500).json({ error: 'Batch prediction failed.' });
    }

    return res.json({
      count: mlResult.count,
      predictions: mlResult.predictions,
    });
  } catch (error) {
    console.error('Error in batch prediction:', error);
    return res.status(500).json({ error: 'Batch prediction failed.' });
  }
});

// ─────────────────────────────────────────────────────────────
// PATCH /chat/:chatId
// ─────────────────────────────────────────────────────────────
router.patch('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { chatName } = req.body;

    if (!chatName) {
      return res.status(400).json({ error: 'Chat name is required.' });
    }

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId: req.user._id },
      { chatName: chatName.trim() },
      { new: true }
    );

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    return res.json({ chat });
  } catch (error) {
    console.error('Error updating chat:', error);
    return res.status(500).json({ error: 'Could not update chat.' });
  }
});

// ─────────────────────────────────────────────────────────────
// DELETE /chat/:chatId
// ─────────────────────────────────────────────────────────────
router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOneAndDelete({
      _id: chatId,
      userId: req.user._id,
    });

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    return res.json({ message: 'Chat deleted successfully.' });
  } catch (error) {
    console.error('Error deleting chat:', error);
    return res.status(500).json({ error: 'Could not delete chat.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /chat/all
// Get all chats for current user
// ─────────────────────────────────────────────────────────────
router.get('/all', async (req, res) => {
  try {
    const userId = req.user._id;

    const chats = await Chat.find({ userId })
      .sort({ updatedAt: -1 })
      .lean();

    return res.json({ chats });
  } catch (error) {
    console.error('Error fetching chats:', error);
    return res.status(500).json({ error: 'Could not fetch chats.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /chat/:chatId
// Get specific chat details
// ─────────────────────────────────────────────────────────────
router.get('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;

    const chat = await Chat.findOne({
      _id: chatId,
      userId: req.user._id,
    }).lean();

    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    return res.json({ chat });
  } catch (error) {
    console.error('Error fetching chat:', error);
    return res.status(500).json({ error: 'Could not fetch chat.' });
  }
});

// ─────────────────────────────────────────────────────────────
// GET /chat/analytics/:userId
// Get stress analytics for user
// ─────────────────────────────────────────────────────────────
router.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    if (!userId || userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const chats = await Chat.find({ userId }).lean();
    
    const analytics = {
      totalChats: chats.length,
      totalMessages: chats.reduce((sum, chat) => sum + chat.messages.filter(m => m.role === 'user').length, 0),
      avgStress: chats.length > 0 
        ? Math.round(chats.reduce((sum, chat) => sum + (chat.avgStress || 0), 0) / chats.length)
        : 0,
      stressHistory: chats.map(chat => ({
        chatId: chat._id,
        chatName: chat.chatName,
        avgStress: chat.avgStress,
        messageCount: chat.messages.filter(m => m.role === 'user').length,
        createdAt: chat.createdAt,
      })),
    };

    return res.json({ analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ error: 'Could not fetch analytics.' });
  }
});

module.exports = router;
