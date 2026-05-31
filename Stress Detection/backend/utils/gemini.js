/**
 * Gemini API integration for StressBot.
 * Per plan.txt Change 6:
 *   - Gemini = conversational generator ONLY
 *   - BERT/stressModel = emotional analyzer ONLY (never mix)
 *   - Gemini replies directly in the user's original language
 *   - Graceful fallback to generateBotResponse() when no API key or quota exceeded
 *
 * Architecture (from plan.txt):
 *   User Message → lang detect → translate to English (BERT only)
 *   → BERT stress score → Gemini generates response in user's language
 *   → Store in MongoDB → Send to frontend
 */

const { GoogleGenerativeAI } = require('@google/generative-ai');
const { generateBotResponse } = require('./stressModel');

// Language code → human-readable name for Gemini prompt
const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi',
  te: 'Telugu',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  fr: 'French',
  de: 'German',
  es: 'Spanish',
  ar: 'Arabic',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
};

/**
 * Build a language-aware system prompt for Gemini.
 * Instructs Gemini to act as a stress-support chatbot and reply
 * in the user's language with appropriate emotional tone.
 */
function buildSystemPrompt(detectedLang, stressScore) {
  const langName = LANGUAGE_NAMES[detectedLang] || 'the user\'s language';
  const isEnglish = detectedLang === 'en';

  // Stress level instruction for tone calibration
  let toneInstruction;
  if (stressScore >= 70) {
    toneInstruction = 'The user is experiencing HIGH stress. Be warm, deeply empathetic, and gently suggest professional help if appropriate. Do NOT be dismissive.';
  } else if (stressScore >= 40) {
    toneInstruction = 'The user is experiencing MODERATE stress. Be supportive and practical. Offer calming suggestions like breathing techniques or short breaks.';
  } else if (stressScore > 10) {
    toneInstruction = 'The user has LOW stress. Be friendly and encouraging. Acknowledge their feelings and ask follow-up questions to keep them engaged.';
  } else {
    toneInstruction = 'The user seems calm. Be warm and conversational. Celebrate their good state and ask what is on their mind.';
  }

  const languageInstruction = isEnglish
    ? 'Reply in English.'
    : `IMPORTANT: You MUST reply naturally in ${langName} (${detectedLang}). Do NOT reply in English. The user wrote in ${langName}, so your response must also be in ${langName}.`;

  return `You are StressBot, an empathetic AI mental health support assistant.
Your role is to provide emotional support, stress management advice, and compassionate responses.

RULES:
1. ${languageInstruction}
2. ${toneInstruction}
3. Keep responses concise — 2 to 4 sentences maximum.
4. Never diagnose medical conditions.
5. If the user mentions self-harm or suicidal thoughts, gently but clearly recommend professional help or a crisis helpline.
6. Do not repeat the user's words back to them verbatim.
7. Sound human and warm, not robotic.`;
}

/**
 * Call Gemini API to generate a conversational response.
 *
 * @param {string} userText       - Original user message (in their language)
 * @param {string} englishText    - English translation (used for context only)
 * @param {number} stressScore    - 0-100 stress score from BERT/stressModel
 * @param {string} detectedLang   - Language code e.g. 'hi', 'te', 'en'
 * @param {string[]} contextMsgs  - Recent English conversation context (for better replies)
 * @returns {Promise<{text: string, source: 'gemini'|'fallback'}>}
 */
async function callGemini(userText, englishText, stressScore, detectedLang = 'en', contextMsgs = []) {
  const apiKey = process.env.GEMINI_API_KEY;

  // No API key → use local fallback immediately
  if (!apiKey || apiKey.trim() === '') {
    console.log('[Gemini] No API key configured — using local fallback');
    const fallbackText = generateBotResponse(englishText, stressScore);
    return { text: fallbackText, source: 'fallback' };
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',   // Free tier, fast, multilingual
      generationConfig: {
        maxOutputTokens: 256,
        temperature: 0.75,
        topP: 0.9,
      },
    });

    // Build prompt: system instructions + recent context + current message
    const systemPrompt = buildSystemPrompt(detectedLang, stressScore);

    // Build conversation context for Gemini
    let contextSection = '';
    if (contextMsgs.length > 0) {
      contextSection = '\n\nRecent conversation context (English):\n' +
        contextMsgs.map((m, i) => `[${i + 1}] ${m}`).join('\n');
    }

    // Full prompt combining system + context + current user message
    const fullPrompt = `${systemPrompt}${contextSection}

User's current message: "${userText}"
Stress level detected: ${stressScore}/100

Your response:`;

    console.log(`[Gemini] Calling gemini-1.5-flash | lang=${detectedLang} | stress=${stressScore}`);
    const result = await model.generateContent(fullPrompt);
    const responseText = result.response.text().trim();

    if (!responseText || responseText.length < 3) {
      throw new Error('Empty response from Gemini');
    }

    console.log(`[Gemini] Response: "${responseText.substring(0, 60)}..."`);
    return { text: responseText, source: 'gemini' };

  } catch (error) {
    console.error('[Gemini] API call failed:', error.message);

    // Quota exceeded, invalid key, or network error → graceful fallback
    const fallbackText = generateBotResponse(englishText, stressScore);
    console.log('[Gemini] Using local fallback response');
    return { text: fallbackText, source: 'fallback' };
  }
}

module.exports = { callGemini };
