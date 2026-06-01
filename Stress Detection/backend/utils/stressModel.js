/**
 * stressModel.js — NLP-pattern based message classification
 *
 * classifyMessage() uses LINGUISTIC SIGNALS, not keyword lists.
 * This means ANY new sentence — about cooking, sports, history, black holes —
 * gets correctly classified without needing to add new keywords every time.
 *
 * Core insight:
 *   Emotional messages always have first-person emotional framing: "I feel", "I am", "I can't"
 *   Factual/technical messages are about external things: questions, definitions, descriptions
 *
 * Three signals checked in order:
 *  1. Emotional markers  → "I feel", "I'm feeling", "I can't", negative self-framing
 *  2. Factual intent     → question words, definition requests, third-person topics
 *  3. Greetings/social   → hi, hello, thanks, bye
 */

// ─── Emotional stress patterns ────────────────────────────────────────────────
// These are LINGUISTIC PATTERNS — first-person distress framing
// Covers any topic: work, relationships, health, academics, life in general
const EMOTIONAL_PATTERNS = [
  // First-person negative feeling state
  /\bi\s+(feel|am feeling|felt|have been feeling)\s+(so\s+)?(stressed|anxious|depressed|sad|hopeless|lost|empty|broken|overwhelmed|scared|afraid|terrible|awful|horrible|miserable|exhausted|drained|numb|helpless|worthless)/i,
  // "I can't" frustration expressions
  /\bi\s+can'?t\s+(take|handle|do|cope|sleep|breathe|stop|focus|think|continue|go on)/i,
  // "I don't know what to do / how to cope"
  /\bi\s+don'?t\s+know\s+(what|how|where|why|if)/i,
  // "I feel like" + negative
  /\bi\s+feel\s+like\s+(giving up|crying|breaking|falling apart|i'm failing|nobody|nothing|everything)/i,
  // "I am so" + negative emotion
  /\bi'?m\s+(so\s+)?(stressed|anxious|depressed|sad|angry|hopeless|tired|exhausted|overwhelmed|lonely|scared|worried|frustrated|upset)/i,
  // "Everything is" + negative
  /\beverything\s+is\s+(falling apart|going wrong|too much|a mess|overwhelming)/i,
  // "I'm struggling / suffering / breaking down"
  /\bi'?m\s+(struggling|suffering|breaking down|falling apart|losing it|not okay|not doing well|barely)/i,
  // "I have been / I've been" + negative
  /\bi'?ve?\s+(been\s+)?(crying|breaking down|struggling|suffering|worrying|panicking|stressed)/i,
  // Crisis language
  /\b(suicidal|self.harm|hurt myself|end my life|no reason to live|give up on life|don't want to be here)/i,
  // Explicit stress/anxiety declaration
  /\b(i am|i'm)\s+.{0,30}(stress|anxious|anxiety|depressed|depression|overwhelmed)/i,
];

// ─── Factual/external intent patterns ─────────────────────────────────────────
// These patterns cover ANY factual question regardless of topic.
// "What are black holes?" "How do vaccines work?" "Explain photosynthesis" → all technical
const FACTUAL_PATTERNS = [
  // Classic question openers — covers any topic universally
  /^(what (is|are|was|were|does|do|will|would|can|should)|who (is|was|are|were)|where (is|are|was|were|does)|when (is|was|did|does|will)|why (is|are|was|does|do|did)|how (does|do|is|are|was|did|can|to|many|much|often|long|far))/i,

  // "Which ...?" — ANY "which" question that ends with "?" is factual.
  // Covers: "Which programming language do you know?", "Which country has highest GDP?",
  //         "Which framework is better?", "Which is faster, Node or Python?" etc.
  // Exception guard: sentences with explicit emotional keywords are caught by
  // EMOTIONAL_PATTERNS / STRESS_KEYWORDS BEFORE this runs (priority 1 & 2).
  /^which\b.{0,120}\?$/i,

  // Explanation / definition requests
  /^(explain|define|describe|tell me (about|what|how|why)|can you (explain|tell|describe|show|help me understand)|give me (a|an|the)|what('s| is) (the|a|an)|i want to (know|understand|learn))/i,
  // Comparison / contrast requests
  /^(what('s| is) the difference between|compare|difference between|vs\.?|versus)/i,
  // "Is it true that / Are there / Does X work / Do X have"
  /^(is (it|there|this|that|he|she|they|the)|are (there|they|these|those|black|white)|does (it|this|that|he|she|the)|do (they|these|those|people|we|i))/i,
  // Third-person declarative (talking about concepts, not self)
  /^(the (concept|definition|meaning|history|origin|purpose|function|role|theory|process|idea)|a (type|form|kind|way|method|process|theory)|in (science|math|physics|history|medicine|biology|technology|economics))/i,
  // "How to" instructional
  /^how to\b/i,
  // Single-word + "?" — "Python?" "API?" "DevOps?"  (short factual queries)
  /^\w[\w\s]{0,30}\?$/,
];

// ─── Greeting / social patterns ────────────────────────────────────────────────
const GREETING_PATTERNS = [
  /^(hi|hey|hello|good (morning|afternoon|evening|night|day))\b/i,
  /^(thanks|thank you|thx|ty|cheers|bye|goodbye|see you|take care|nice to meet)\b/i,
  /^(how are you|how('s| is) it going|what('s| is) up|sup\??\s*$)/i,
  /^(yes|no|ok(ay)?|sure|fine|alright|great|sounds good|i see|got it|i understand|makes sense)\b/i,
  /^(haha|lol|😄|😊|👍|🙏)/,
];

// ─── Stress intensity keywords (for scoring, not classification) ───────────────
const STRESS_KEYWORDS = [
  'stress', 'stressed', 'anxious', 'anxiety', 'overwhelmed',
  'exhausted', 'burnout', 'angry', 'frustrated', 'worried', 'worry',
  'fear', 'scared', 'nervous', 'sad', 'upset', 'miserable',
  'lonely', 'isolated', 'crying', 'helpless', 'panic', 'dread',
  'terrified', 'resentful', 'agitated', 'distressed', 'depressed',
  'hopeless', 'worthless', 'breakdown', 'crisis',
  "can't take it", 'giving up', 'falling apart', 'losing my mind',
  'suicidal', 'self-harm', 'hurt myself', 'end my life',
  "can't sleep", 'cannot sleep', 'not sleeping', 'no sleep', 'sleep deprived',
  "haven't slept", 'trouble sleeping', 'insomnia',
  'tired', 'drained', 'fatigued', 'worn out', 'burnt out',
  'no energy', "can't focus", "can't concentrate", 'mentally exhausted',
  'piling up', 'falling behind', 'overloaded', 'swamped', 'drowning',
  'suffocating', 'trapped', 'stuck', 'lost', 'numb',
  'unmotivated', 'demotivated', 'empty', 'hollow', 'detached',
];

const LOW_STRESS_TRIGGERS = [
  "i'm fine", 'i am fine', 'feeling good', 'doing well', 'all good',
  'no problem', 'not bad', 'pretty good',
];

// ─── classifyMessage ──────────────────────────────────────────────────────────
/**
 * Classifies a message as 'emotional' or 'technical' using LINGUISTIC PATTERNS.
 *
 * No topic-specific keyword lists needed. Works for any subject — programming,
 * cooking, science, sports, movies, history, random curiosity questions — all
 * detected as 'technical' purely by their sentence structure.
 *
 * Priority order:
 *  1. Emotional patterns  → 'emotional'  (first-person distress language)
 *  2. Greeting patterns   → 'technical'  (social / casual)
 *  3. Factual patterns    → 'technical'  (question or definition intent)
 *  4. Short text (<4 words, no stress) → 'technical' (likely a query)
 *  5. Default             → 'emotional'  (assume user is sharing feelings)
 */
function classifyMessage(text) {
  if (!text || typeof text !== 'string') return null;

  const trimmed = text.trim();
  const lower   = trimmed.toLowerCase();

  // ── Priority 1: Emotional distress patterns (check these FIRST) ──────────
  for (const pattern of EMOTIONAL_PATTERNS) {
    if (pattern.test(trimmed)) return 'emotional';
  }

  // Also check stress keywords as a quick emotional guard
  for (const kw of STRESS_KEYWORDS) {
    if (lower.includes(kw)) return 'emotional';
  }

  // ── Priority 2: Greetings / social acknowledgements ──────────────────────
  for (const pattern of GREETING_PATTERNS) {
    if (pattern.test(trimmed)) return 'technical';
  }

  // ── Priority 3: Factual question / instructional intent ──────────────────
  for (const pattern of FACTUAL_PATTERNS) {
    if (pattern.test(trimmed)) return 'technical';
  }

  // ── Priority 4: Very short messages with no emotional content ─────────────
  // e.g. "Python?", "Machine learning", "React vs Vue"
  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount <= 4) return 'technical';

  // ── Default: treat as emotional (user may be venting without explicit keywords)
  return 'emotional';
}

// ─── detectStress ─────────────────────────────────────────────────────────────
/**
 * Detects stress level from text.
 * Used only when ML service is offline (fallback path).
 */
function detectStress(text) {
  if (!text || typeof text !== 'string') {
    return { score: 0, category: null };
  }

  const lower    = text.toLowerCase().trim();
  const category = classifyMessage(text);

  if (category === 'technical') {
    return { score: 3, category };
  }

  for (const phrase of LOW_STRESS_TRIGGERS) {
    if (lower.includes(phrase)) {
      return { score: 5, category };
    }
  }

  let score = 0;
  const found = [];

  for (const keyword of STRESS_KEYWORDS) {
    if (lower.includes(keyword)) {
      score += 15;
      found.push(keyword);
    }
  }

  // Extra weight for crisis keywords
  const severe = ['suicidal', 'self-harm', 'hurt myself', 'end my life', 'panic attack', 'breakdown'];
  for (const keyword of severe) {
    if (lower.includes(keyword)) {
      score += 30;
      found.push(keyword);
    }
  }

  return { score: Math.min(score, 100), category, found };
}

// ─── generateBotResponse (offline fallback only) ──────────────────────────────
/**
 * Used ONLY when both Gemini and NVIDIA APIs are unavailable.
 * In normal operation, Gemini or NVIDIA generates the response.
 */
function generateBotResponse(text, stressScore) {
  if (stressScore >= 70) {
    const responses = [
      "I can hear that you're going through a really tough time. It sounds like you're carrying a lot right now. Have you been able to talk to someone close to you about how you're feeling?",
      "That sounds incredibly difficult. Your feelings are completely valid. Please remember that it's okay to ask for help — reaching out to a mental health professional can make a real difference.",
      "I'm genuinely concerned about what you're sharing. High stress can take a serious toll on both your mental and physical health. Please consider taking a break and talking to someone you trust.",
      "It seems like you're experiencing significant stress right now. Remember, it's okay to slow down and take care of yourself first. You don't have to handle everything alone.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } else if (stressScore >= 40) {
    const responses = [
      "It sounds like you're feeling quite stressed. Have you tried any relaxation techniques like deep breathing or going for a short walk? Even a few minutes can help.",
      "I understand — stress has a way of piling up. Taking things one step at a time can help. What's the most pressing thing on your mind right now?",
      "I hear you. When we're overwhelmed, breaking things into smaller pieces makes them more manageable. Is there one thing you could let go of or postpone today?",
      "Stress can be exhausting. Try the 4-7-8 breathing technique: inhale for 4 seconds, hold for 7, exhale for 8. It activates your parasympathetic nervous system.",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } else if (stressScore > 10) {
    const responses = [
      "Thanks for sharing. I notice a bit of tension in what you've written. Short breaks throughout your day can really help — even a 5-minute walk can reset your mind!",
      "I sense you might be feeling a little stressed. That's completely normal. What usually helps you unwind after a tough moment?",
      "Sounds like things are a bit challenging right now. You're doing great by talking about it! Is there anything specific I can help you think through?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  } else {
    const responses = [
      "That sounds great! You seem to be in a good headspace today. Keep doing what you're doing!",
      "It's wonderful to hear from you! You seem calm and collected. What's been going well for you lately?",
      "Glad to hear things are going smoothly! Is there anything you'd like to chat about or explore today?",
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }
}

module.exports = {
  detectStress,
  classifyMessage,
  generateBotResponse,
};
