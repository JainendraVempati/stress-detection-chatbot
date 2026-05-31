const express = require('express');
const axios = require('axios');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/authMiddleware');
const { detectLanguage, translateToEnglish, translateFromEnglish } = require('../utils/translator');

const router = express.Router();
router.use(authMiddleware);

// ML Microservice URL
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:5000';

/**
 * Builds the shared system prompt for any LLM.
 * StressBot persona — responds like a smart, warm AI assistant.
 * Handles both emotional (mental health) and technical (factual) messages.
 */
function buildSystemPrompt(stressScore, messageCategory) {

  // ── TECHNICAL: factual / general knowledge question ──────────────────────────
  if (messageCategory === 'technical') {
    return [
      'You are StressBot — an intelligent, friendly AI assistant.',
      'The user has sent a factual or general knowledge question.',
      'Read exactly what they asked and answer THAT specific question directly.',
      'Be accurate, clear, and natural — like a knowledgeable friend explaining something.',
      'Keep your answer to 3-5 sentences.',
      'Do NOT add mental health advice, stress tips, or emotional framing to factual answers.',
      'Always respond in ENGLISH — a translation layer handles other languages.',
    ].join(' ');
  }

  // ── EMOTIONAL: stress score is the primary driver here ───────────────────────
  const stressLabel =
    stressScore >= 70 ? 'HIGH'     :
    stressScore >= 40 ? 'MODERATE' :
    stressScore > 10  ? 'MILD'     : 'LOW';

  if (stressScore >= 70) {
    return [
      'You are StressBot — a deeply compassionate mental health support assistant.',
      `The user's stress level is HIGH (${stressScore}%). They need to feel heard above all else.`,
      'Lead with strong, genuine empathy — validate their pain directly.',
      'Offer ONE grounding technique suited to what they described (e.g. box breathing for panic, journaling for overwhelm, a walk for anxiety).',
      'Gently encourage them to speak to a trusted person or a professional if their situation sounds severe.',
      'Keep it to 4-5 sentences. Write warmly and specifically — never use generic templates.',
      'Always respond in ENGLISH — the translation layer handles other languages.',
    ].join(' ');
  }

  if (stressScore >= 40) {
    return [
      'You are StressBot — a compassionate, emotionally intelligent mental health support assistant.',
      `The user's stress level is MODERATE (${stressScore}%).`,
      'Acknowledge their feelings warmly.',
      'Offer one practical, actionable stress-relief tip that fits their situation.',
      'End with a gentle follow-up question to keep them talking.',
      'Keep your response to 3-5 sentences. Be warm and human — never robotic.',
      'Always respond in ENGLISH — the translation layer handles other languages.',
    ].join(' ');
  }

  if (stressScore > 10) {
    return [
      'You are StressBot — a warm, supportive mental health assistant.',
      `The user's stress level is MILD (${stressScore}%).`,
      'Acknowledge the tension lightly and be encouraging.',
      'Offer a small, simple tip or positive reframe relevant to what they said.',
      'Keep it brief and upbeat — 2-4 sentences.',
      'Always respond in ENGLISH — the translation layer handles other languages.',
    ].join(' ');
  }

  // LOW / NO stress — calm, conversational, positive
  return [
    'You are StressBot — a friendly, upbeat AI assistant.',
    `The user's stress level is LOW (${stressScore}%). They seem calm and doing well.`,
    'Be upbeat, affirming, and conversational.',
    'Respond naturally to what they said — no need to push stress or mental health topics.',
    'Keep it to 2-3 sentences.',
    'Always respond in ENGLISH — the translation layer handles other languages.',
  ].join(' ');
}

/**
 * Builds user message content with optional conversation context.
 */
function buildUserContent(englishText, contextMsgs) {
  if (contextMsgs.length === 0) return englishText;
  const ctx = contextMsgs.map((m, i) => `[${i + 1}] ${m}`).join('\n');
  return `Recent conversation:\n${ctx}\n\nCurrent message: ${englishText}`;
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
/**
 * Primary LLM: Google Gemini (model set via GEMINI_MODEL env var, default gemini-2.0-flash)
 *
 * FREE TIER LIMITS: 15 requests/minute, 1500/day per API key.
 * On ANY error (401 bad key, 429 quota, 403, network) → throws immediately.
 * NO retries — retrying on 429 burns quota even faster.
 * callLLM() catches the throw and falls to NVIDIA with zero delay.
 *
 * Get a free API key: https://aistudio.google.com/app/apikey
 * Valid keys start with "AIza..."
 */
async function callGemini(englishText, stressScore, messageCategory, contextMsgs = []) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('GEMINI_API_KEY not set');
  }

  // Read model from env — defaults to gemini-2.0-flash
  const geminiModel = (process.env.GEMINI_MODEL || 'gemini-2.0-flash').trim();

  const systemPrompt = buildSystemPrompt(stressScore, messageCategory);
  const userContent  = buildUserContent(englishText, contextMsgs);

  const body = {
    contents: [
      {
        role: 'user',
        parts: [{ text: `${systemPrompt}\n\nUser: ${userContent}` }],
      },
    ],
    generationConfig: {
      temperature: 0.8,
      maxOutputTokens: 350,
      topP: 0.95,
    },
  };

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`;

  // Single attempt — NO retries (retrying burns free-tier quota faster)
  console.log(`[Gemini] Calling ${geminiModel} | stress: ${stressScore}% | category: ${messageCategory}`);

  const response = await axios.post(url, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 15000,
  });

  const text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error('Empty response from Gemini');

  console.log(`[Gemini] Success | ${text.length} chars`);
  return { text, source: 'gemini' };
}

// ─── NVIDIA NIM ───────────────────────────────────────────────────────────────
/**
 * Fallback LLM: NVIDIA NIM (Llama 3.1 70B)
 * Used when Gemini key is missing, quota hit, or any Gemini error.
 */
async function callNvidiaLLM(englishText, stressScore, messageCategory, contextMsgs = []) {
  const apiKey = process.env.NVIDIA_API_KEY;
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('NVIDIA_API_KEY not set');
  }

  const model        = process.env.NVIDIA_MODEL || 'meta/llama-3.1-70b-instruct';
  const systemPrompt = buildSystemPrompt(stressScore, messageCategory);
  const userContent  = buildUserContent(englishText, contextMsgs);

  console.log(`[NVIDIA] Calling ${model} | stress: ${stressScore}% | category: ${messageCategory}`);

  const response = await axios.post(
    'https://integrate.api.nvidia.com/v1/chat/completions',
    {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user',   content: userContent  },
      ],
      temperature: 0.8,
      max_tokens: 350,
      top_p: 0.95,
    },
    {
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      timeout: 25000,
    }
  );

  const text = response.data?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty response from NVIDIA NIM');

  console.log(`[NVIDIA] Response received: ${text.length} chars`);
  return { text, source: 'nvidia' };
}

// ─── Main LLM dispatcher ──────────────────────────────────────────────────────
/**
 * callLLM — tries providers in order: Gemini → NVIDIA → local fallback
 *
 * Gemini 2.0 Flash:     free, fast (~1-2s), GPT-4 quality   ← PRIMARY
 * NVIDIA NIM Llama 70B: paid, reliable (~5-20s)              ← FALLBACK 1
 * generateBotResponse:  offline, template-based              ← FALLBACK 2
 */
async function callLLM(englishText, stressScore, messageCategory, contextMsgs = []) {
  const { generateBotResponse } = require('../utils/stressModel');

  // ── Try Gemini first ──────────────────────────────────────────────────────
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey && geminiKey.trim() !== '') {
    try {
      return await callGemini(englishText, stressScore, messageCategory, contextMsgs);
    } catch (err) {
      const status = err.response?.status;
      if (status === 429) {
        console.warn('[Gemini] 429 Rate limit hit (free-tier quota) — falling to NVIDIA instantly');
      } else if (status === 401) {
        console.error('[Gemini] 401 Unauthorized — API key is invalid or malformed. Check GEMINI_API_KEY in .env (must start with AIza...)');
      } else {
        console.error(`[Gemini] Failed (HTTP ${status || 'network'}): ${err.message}`);
      }
      console.log('[Gemini] → Falling back to NVIDIA...');
    }
  } else {
    console.log('[Gemini] No API key set — using NVIDIA directly');
  }

  // ── Try NVIDIA ────────────────────────────────────────────────────────────
  const nvidiaKey = process.env.NVIDIA_API_KEY;
  if (nvidiaKey && nvidiaKey.trim() !== '') {
    try {
      return await callNvidiaLLM(englishText, stressScore, messageCategory, contextMsgs);
    } catch (err) {
      console.error('[NVIDIA] Failed:', err.message, '— using local fallback');
    }
  } else {
    console.log('[NVIDIA] No API key — using local fallback');
  }

  // ── Local fallback ────────────────────────────────────────────────────────
  console.log('[LLM] Both APIs unavailable — using local generateBotResponse()');
  return { text: generateBotResponse(englishText, stressScore), source: 'fallback' };
}

/**
 * Helper function to call ML microservice
 */
async function callMLService(endpoint, data) {
  try {
    console.log(`[ML Service] Calling ${endpoint} with data:`, JSON.stringify(data).substring(0, 100));
    const startTime = Date.now();
    const response = await axios.post(`${ML_SERVICE_URL}${endpoint}`, data, {
      timeout: 45000,
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
      model: 'hybrid',
    });

    return res.json({ chat });
  } catch (error) {
    console.error('Error creating chat:', error);
    return res.status(500).json({ error: 'Could not create chat.' });
  }
});

// ─────────────────────────────────────────────────────────────
// POST /chat/message
// Enhanced with ML-based stress detection + multilingual support
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

    // Step 1: Detect language
    const detectedLang = detectLanguage(text.trim());
    console.log(`[Chat] Detected language: ${detectedLang}`);

    // Step 2: Translate to English if not English
    let englishText = text.trim();
    let originalText = text.trim();

    if (detectedLang !== 'en') {
      console.log(`[Chat] Translating from ${detectedLang} to English...`);
      englishText = await translateToEnglish(text.trim(), detectedLang);
      console.log(`[Chat] Translated: "${englishText.substring(0, 50)}..."`);
    }

    // Step 3: Build context window from recent emotional messages
    const recentUserMessages = chat.messages
      .filter((msg) => msg.role === 'user' && msg.category === 'emotional')
      .slice(-5)
      .map((msg) => msg.translatedText || msg.text);

    let contextText = englishText;
    if (recentUserMessages.length > 0) {
      contextText = [...recentUserMessages, englishText].join('. ');
    }

    // Step 4: Classify message category — technical or emotional
    // Technical messages skip ML entirely (BERT score is meaningless on factual questions)
    const { classifyMessage } = require('../utils/stressModel');
    const messageCategory = classifyMessage(englishText) || 'emotional';
    console.log(`[Chat] Message category: ${messageCategory}`);

    console.log('[Chat] Context window:', recentUserMessages.length, 'previous messages');
    let stressScore = 0;
    let botText = '';
    let stressData = {};

    if (messageCategory === 'technical') {
      // Technical message — skip ML, use fixed near-zero stress
      stressScore = 5;
      stressData = {
        lstm: 0,
        vader: 0,
        combined: 0,
        percentage: 5,
        hasStressKeywords: false,
        category: 'technical',
      };
      console.log(`[Chat] Technical message — stress fixed at ${stressScore}% (ML skipped)`);
    } else {
      // Emotional message — run full DistilBERT + VADER hybrid
      console.log('[Chat] Calling ML Service...');
      const mlResult = await callMLService('/chat', { text: contextText });
      console.log('[Chat] ML Service response received');

      if (mlResult.success) {
        stressScore = Math.round(mlResult.stress_level * 10);
        stressData = {
          lstm: mlResult.components.lstm,
          vader: mlResult.components.vader,
          combined: mlResult.components.combined,
          percentage: mlResult.stress_percentage,
          hasStressKeywords: mlResult.components.has_stress_keywords || false,
          category: 'emotional',
        };
        console.log(`[Chat] Stress score: ${stressScore}%`);
      } else {
        // ML Service offline — use local keyword detection as fallback
        console.log('[Chat] ML Service offline — using local keyword detection for stress score');
        const { detectStress } = require('../utils/stressModel');
        const result = detectStress(contextText);
        stressScore = result.score;
        stressData = {
          fallback: true,
          percentage: stressScore,
          hasStressKeywords: result.found?.length > 0,
          category: result.category || 'emotional',
        };
      }
    }

    // Step 4c: Generate bot response — Gemini → NVIDIA → local fallback
    console.log('[Chat] Generating bot response via LLM...');
    const llmResult = await callLLM(
      englishText,
      stressScore,
      messageCategory,
      recentUserMessages
    );
    botText = llmResult.text;
    console.log(`[Chat] Bot response source: ${llmResult.source} | length: ${botText.length} chars`);

    // Step 5: Translate bot response back to user's language if needed
    let finalBotText = botText;
    if (detectedLang !== 'en') {
      console.log(`[Chat] Translating bot response back to ${detectedLang}...`);
      try {
        finalBotText = await translateFromEnglish(botText, detectedLang);
        console.log(`[Chat] Translated bot response: "${finalBotText.substring(0, 50)}..."`);
      } catch (translateErr) {
        console.warn('[Chat] Translation back failed, using English response:', translateErr.message);
        finalBotText = botText;
      }
    }

    // Step 6: Save to MongoDB
    console.log('[Chat] Saving user message to MongoDB...');
    chat.messages.push({
      text: originalText,
      originalText: originalText,
      translatedText: englishText,
      language: detectedLang,
      stress: stressScore,
      category: messageCategory,
      stressData,
      role: 'user',
      timestamp: new Date(),
    });

    console.log('[Chat] Saving bot response to MongoDB...');
    chat.messages.push({
      text: finalBotText,
      role: 'bot',
      timestamp: new Date(),
    });

    // Calculate average stress from emotional user messages only
    const emotionalMessages = chat.messages.filter(
      (msg) => msg.role === 'user' && msg.category === 'emotional'
    );
    const totalStress = emotionalMessages.reduce((sum, msg) => sum + (msg.stress || 0), 0);
    chat.avgStress = emotionalMessages.length > 0
      ? Math.round(totalStress / emotionalMessages.length)
      : 0;

    console.log(`[Chat] Saving chat with ${chat.messages.length} messages, avg stress: ${chat.avgStress}%`);
    await chat.save();
    console.log('[Chat] Chat saved successfully!\n');

    return res.json({
      chat,
      mlMetrics: {
        stressLevel: stressScore / 10,
        stressPercentage: stressData.percentage || 0,
        components: stressData,
        language: detectedLang,
        translated: detectedLang !== 'en',
        responseSource: llmResult.source,
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
// ─────────────────────────────────────────────────────────────
router.post('/batch-predict', async (req, res) => {
  try {
    const { texts } = req.body;

    if (!texts || !Array.isArray(texts)) {
      return res.status(400).json({ error: 'texts array is required.' });
    }

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
// ─────────────────────────────────────────────────────────────
router.get('/analytics/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId || userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const chats = await Chat.find({ userId }).lean();

    const sortedChats = [...chats].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    const stressHistory = sortedChats.map(chat => {
      const emotionalMsgs = chat.messages.filter(m => m.role === 'user' && m.category === 'emotional');
      const emotionalAvg = emotionalMsgs.length > 0
        ? Math.round(emotionalMsgs.reduce((sum, m) => sum + (m.stress || 0), 0) / emotionalMsgs.length)
        : 0;
      const stressLabel = emotionalAvg <= 30 ? 'Low' : emotionalAvg <= 60 ? 'Moderate' : 'High';
      return {
        chatId: chat._id,
        chatName: chat.chatName,
        avgStress: emotionalAvg,
        stressLabel,
        emotionalCount: emotionalMsgs.length,
        totalCount: chat.messages.filter(m => m.role === 'user').length,
        createdAt: chat.createdAt,
        dateLabel: new Date(chat.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      };
    });

    const emotionalAvgs = stressHistory.map(h => h.avgStress).filter(s => s > 0);
    let trend = 'stable';
    if (emotionalAvgs.length >= 3) {
      const recent = emotionalAvgs.slice(-3).reduce((a, b) => a + b, 0) / 3;
      const earlier = emotionalAvgs.slice(-6, -3).reduce((a, b) => a + b, 0) / (emotionalAvgs.slice(-6, -3).length || 1);
      if (recent > earlier + 8) trend = 'increasing';
      else if (recent < earlier - 8) trend = 'decreasing';
    }

    const overallAvg = chats.length > 0
      ? Math.round(chats.reduce((sum, chat) => sum + (chat.avgStress || 0), 0) / chats.length)
      : 0;

    const analytics = {
      totalChats: chats.length,
      totalMessages: chats.reduce((sum, chat) => sum + chat.messages.filter(m => m.role === 'user').length, 0),
      emotionalMessages: chats.reduce((sum, chat) => sum + chat.messages.filter(m => m.role === 'user' && m.category === 'emotional').length, 0),
      avgStress: overallAvg,
      stressLabel: overallAvg <= 30 ? 'Low' : overallAvg <= 60 ? 'Moderate' : 'High',
      trend,
      stressHistory,
    };

    return res.json({ analytics });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return res.status(500).json({ error: 'Could not fetch analytics.' });
  }
});

module.exports = router;
