const KEYWORDS = ['stress', 'anxious', 'tired', 'angry', 'depressed'];
const SCORE_PER_KEYWORD = 20;
const MAX_SCORE = 100;

function detectStress(text) {
  if (!text || typeof text !== 'string') {
    return 0;
  }

  const lowercaseText = text.toLowerCase();
  let score = 0;

  KEYWORDS.forEach((keyword) => {
    if (lowercaseText.includes(keyword)) {
      score += SCORE_PER_KEYWORD;
    }
  });

  return Math.min(score, MAX_SCORE);
}

module.exports = {
  detectStress,
};
