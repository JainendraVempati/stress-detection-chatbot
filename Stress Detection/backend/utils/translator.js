/**
 * Translation utility — multilingual support for StressBot.
 * 
 * Translation chain (in order of priority):
 *   1. MyMemory API  — free, no key needed, generous limits, no IP bans
 *   2. Google Translate (@vitalets) — fallback when MyMemory fails
 *   3. Original text — last resort, never crashes
 *
 * Language detection uses langdetect + English word guard to prevent
 * short English sentences being misidentified as Dutch/French etc.
 */

const langdetect = require('langdetect');
const { translate } = require('@vitalets/google-translate-api');
const https = require('https');

// ─────────────────────────────────────────────────────────────
// MyMemory API helper (primary translator)
// Docs: https://mymemory.translated.net/doc/spec.php
// Free: 5000 words/day, no key, no IP blocks
// ─────────────────────────────────────────────────────────────

/**
 * Map langdetect codes to MyMemory language pair format (e.g. 'hi|en')
 * MyMemory uses ISO 639-1 codes — most match langdetect directly.
 */
const MYMEMORY_LANG_MAP = {
  hi: 'hi',  // Hindi
  te: 'te',  // Telugu
  ta: 'ta',  // Tamil
  kn: 'kn',  // Kannada
  ml: 'ml',  // Malayalam
  bn: 'bn',  // Bengali
  mr: 'mr',  // Marathi
  gu: 'gu',  // Gujarati
  pa: 'pa',  // Punjabi
  or: 'or',  // Odia
  en: 'en',
};

function myMemoryFetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('MyMemory: invalid JSON')); }
      });
    }).on('error', reject).setTimeout(8000, function () {
      this.destroy();
      reject(new Error('MyMemory: timeout'));
    });
  });
}

async function myMemoryTranslate(text, fromLang, toLang) {
  const from = MYMEMORY_LANG_MAP[fromLang] || fromLang;
  const to   = MYMEMORY_LANG_MAP[toLang]   || toLang;
  const langpair = `${from}|${to}`;
  const encoded  = encodeURIComponent(text.substring(0, 500)); // MyMemory limit
  const url = `https://api.mymemory.translated.net/get?q=${encoded}&langpair=${langpair}`;

  const json = await myMemoryFetch(url);

  // MyMemory returns responseStatus 200 on success, 429/other on error
  if (json.responseStatus !== 200) {
    throw new Error(`MyMemory: status ${json.responseStatus} — ${json.responseMessage}`);
  }

  const translated = json.responseData?.translatedText;
  if (!translated || translated.trim() === '') {
    throw new Error('MyMemory: empty translation');
  }

  // MyMemory sometimes returns "PLEASE SELECT TWO DISTINCT LANGUAGES" on error
  if (translated.toUpperCase().includes('PLEASE SELECT')) {
    throw new Error('MyMemory: language pair error');
  }

  return translated;
}

// ─────────────────────────────────────────────────────────────
// English word guard — prevents langdetect misidentifying
// short English text as Dutch/French/Afrikaans etc.
// ─────────────────────────────────────────────────────────────

const ENGLISH_COMMON_WORDS = new Set([
  'i', 'im', 'ive', "i'm", "i've", "i'll", "i'd",
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'must', 'can', 'cannot', 'cant',
  'not', 'no', 'yes', 'and', 'or', 'but', 'so', 'if', 'because',
  'my', 'me', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'it',
  'this', 'that', 'these', 'those', 'what', 'who', 'how', 'why', 'when',
  'feel', 'feeling', 'felt', 'think', 'know', 'want', 'need', 'get',
  'just', 'very', 'really', 'always', 'never', 'sometimes', 'today',
  'good', 'bad', 'tired', 'stressed', 'sleep', 'sleeping', 'work',
  'been', 'well', 'help', 'like', 'going', 'got', 'much', 'every',
]);

function looksLikeEnglish(text) {
  const words = text.toLowerCase().replace(/[^a-z\s']/g, '').split(/\s+/);
  let count = 0;
  for (const word of words) {
    if (ENGLISH_COMMON_WORDS.has(word) && ++count >= 2) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────
// detectLanguage — 3-layer guard
// ─────────────────────────────────────────────────────────────

function detectLanguage(text) {
  if (!text || typeof text !== 'string') return 'en';
  const trimmed = text.trim();

  if (trimmed.length < 15) return 'en';

  const isLatinScript = /^[\x00-\x7F\s]+$/.test(trimmed);
  if (isLatinScript && looksLikeEnglish(trimmed)) return 'en';

  try {
    const results = langdetect.detect(trimmed);
    if (!results || results.length === 0) return 'en';

    const top = results[0];

    if (isLatinScript && top.lang !== 'en' && top.prob < 0.85) return 'en';

    return top.lang;
  } catch {
    return 'en';
  }
}

// ─────────────────────────────────────────────────────────────
// translateToEnglish — MyMemory first, Google fallback
// ─────────────────────────────────────────────────────────────

async function translateToEnglish(text, sourceLang = 'auto') {
  if (!text || typeof text !== 'string') return '';

  // 1. Try MyMemory
  try {
    const lang = sourceLang === 'auto' ? 'hi' : sourceLang; // MyMemory needs explicit lang
    const result = await myMemoryTranslate(text, lang, 'en');
    console.log(`[Translator] MyMemory → EN success (${sourceLang})`);
    return result;
  } catch (mmErr) {
    console.warn('[Translator] MyMemory → EN failed:', mmErr.message, '— trying Google...');
  }

  // 2. Fallback: Google Translate
  try {
    const result = await translate(text, { from: sourceLang, to: 'en' });
    console.log(`[Translator] Google → EN success (${sourceLang})`);
    return result.text || text;
  } catch (gErr) {
    console.error('[Translator] Google → EN also failed:', gErr.message);
    return text; // Return original — never crash
  }
}

// ─────────────────────────────────────────────────────────────
// translateFromEnglish — MyMemory first, Google fallback
// ─────────────────────────────────────────────────────────────

async function translateFromEnglish(text, targetLang) {
  if (!text || typeof text !== 'string') return '';
  if (targetLang === 'en') return text;

  // 1. Try MyMemory
  try {
    const result = await myMemoryTranslate(text, 'en', targetLang);
    console.log(`[Translator] MyMemory EN → ${targetLang} success`);
    return result;
  } catch (mmErr) {
    console.warn(`[Translator] MyMemory EN → ${targetLang} failed:`, mmErr.message, '— trying Google...');
  }

  // 2. Fallback: Google Translate
  try {
    const result = await translate(text, { from: 'en', to: targetLang });
    console.log(`[Translator] Google EN → ${targetLang} success`);
    return result.text || text;
  } catch (gErr) {
    console.error(`[Translator] Google EN → ${targetLang} also failed:`, gErr.message);
    return text; // Return English — never crash
  }
}

// ─────────────────────────────────────────────────────────────
// Language display names
// ─────────────────────────────────────────────────────────────

const LANGUAGE_NAMES = {
  en: 'English',
  te: 'Telugu',
  hi: 'Hindi',
  ta: 'Tamil',
  kn: 'Kannada',
  ml: 'Malayalam',
  bn: 'Bengali',
  mr: 'Marathi',
  gu: 'Gujarati',
  pa: 'Punjabi',
  or: 'Odia',
};

function getLanguageName(code) {
  return LANGUAGE_NAMES[code] || code.toUpperCase();
}

module.exports = {
  detectLanguage,
  translateToEnglish,
  translateFromEnglish,
  getLanguageName,
};
