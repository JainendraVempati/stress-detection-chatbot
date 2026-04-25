const BASE_URL = 'http://localhost:4000';
const TOKEN_KEY = 'sdc_token';
const USER_KEY = 'sdc_user';

async function fetchJson(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  const settings = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body) {
    settings.body = JSON.stringify(options.body);
  }

  const response = await fetch(url, settings);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    const errorMessage = data?.error || response.statusText || 'Request failed';
    throw new Error(errorMessage);
  }

  return data;
}

function tryParse(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export const auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getCurrentUser() {
    const token = this.getToken();
    const user = tryParse(localStorage.getItem(USER_KEY));
    if (!token || !user) {
      this.logout();
      return null;
    }
    return user;
  },

  setSession(session) {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  },

  logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  },

  async signup(name, email, password, confirmPassword) {
    const response = await fetchJson('/auth/signup', {
      method: 'POST',
      body: { name, email, password, confirmPassword },
    });
    return response;
  },

  async login(email, password) {
    const response = await fetchJson('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    this.setSession(response);
    return { success: true, user: response.user };
  },

  async googleLogin(email, name) {
    const response = await fetchJson('/auth/google', {
      method: 'POST',
      body: { email, name },
    });
    this.setSession(response);
    return { success: true, user: response.user };
  },

  async sendOtp(email) {
    const response = await fetchJson('/auth/send-otp', {
      method: 'POST',
      body: { email },
    });
    return response;
  },

  async verifyOtp(email, otp) {
    const response = await fetchJson('/auth/verify-otp', {
      method: 'POST',
      body: { email, otp },
    });
    this.setSession(response);
    return { success: true, user: response.user };
  },

  async verifySignupOtp(email, otp) {
    const response = await fetchJson('/auth/verify-signup-otp', {
      method: 'POST',
      body: { email, otp },
    });
    this.setSession(response);
    return { success: true, user: response.user };
  },
};

function authHeader() {
  const token = auth.getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const storage = {
  async getChats(userId) {
    if (!userId) return [];
    const response = await fetchJson('/chat/all', {
      headers: authHeader(),
    });
    return response.chats || [];
  },

  async createNewChat(userId, chatName = 'New chat') {
    const response = await fetchJson('/chat/new', {
      method: 'POST',
      headers: authHeader(),
      body: { chatName },
    });
    return response.chat;
  },

  async deleteChat(chatId) {
    await fetchJson(`/chat/${chatId}`, {
      method: 'DELETE',
      headers: authHeader(),
    });
  },

  async renameChat(chatId, chatName) {
    const response = await fetchJson(`/chat/${chatId}`, {
      method: 'PATCH',
      headers: authHeader(),
      body: { chatName },
    });
    return response.chat;
  },

  async addMessageToChat(chatId, message, botText = '') {
    const response = await fetchJson('/chat/message', {
      method: 'POST',
      headers: authHeader(),
      body: { chatId, text: message.text, botText },
    });
    return response.chat;
  },

  async predictStress(chatId, text) {
    const response = await fetchJson(`/chat/predict/${chatId}?text=${encodeURIComponent(text)}`, {
      headers: authHeader(),
    });
    return response;
  },

  async getStressAnalytics(userId) {
    const response = await fetchJson(`/chat/analytics/${userId}`, {
      headers: authHeader(),
    });
    return response;
  },
};

// ─── Stress Utils ───────────────────────────────────────────────────────────
const stressKeywordsHigh = [
  'depressed', 'depression', 'suicidal', 'hopeless', 'worthless',
  'panic attack', 'breakdown', 'crisis', 'unbearable', "can't take it",
  'cant take it', 'giving up', 'fall apart', 'losing my mind', 'no way out',
  'desperate', 'shattered', 'devastated', 'collapsing',
];

const stressKeywordsMedium = [
  'stress', 'stressed', 'anxious', 'anxiety', 'overwhelmed',
  'exhausted', 'burnout', 'angry', 'frustrated', 'worried', 'worry',
  'fear', 'scared', 'nervous', 'sad', 'upset', 'miserable',
  'lonely', 'isolated', 'crying', 'helpless', 'panic', 'dread',
  'terrified', 'resentful', 'agitated', 'irritated', 'distressed',
];

const stressKeywordsLow = [
  'tired', 'busy', 'difficult', 'hard', 'tough', 'problem',
  'issue', 'headache', 'tense', 'uneasy', 'bored', 'annoyed',
  'confused', 'lost', 'stuck', 'pressure', 'deadline', 'behind',
  'struggling', 'drained', 'off', 'unsure', 'meh',
];

export const stress = {
  detectStress(text) {
    const lowerText = text.toLowerCase();
    let score = 0;

    stressKeywordsHigh.forEach(word => {
      if (lowerText.includes(word)) score += 30;
    });

    stressKeywordsMedium.forEach(word => {
      if (lowerText.includes(word)) score += 15;
    });

    stressKeywordsLow.forEach(word => {
      if (lowerText.includes(word)) score += 8;
    });

    return Math.min(100, score);
  },

  getStressLabel(score) {
    if (score >= 70) return '8-10';
    if (score >= 40) return '5-7';
    if (score > 10) return '2-4';
    return '0-1';
  },

  getStressColor(score) {
    if (score >= 70) return '#ef4444';
    if (score >= 40) return '#f97316';
    if (score > 10) return '#eab308';
    return '#22c55e';
  },

  getStressBg(score) {
    if (score >= 70) return 'bg-red-100 text-red-700 border-red-200';
    if (score >= 40) return 'bg-orange-100 text-orange-700 border-orange-200';
    if (score > 10) return 'bg-yellow-100 text-yellow-700 border-yellow-200';
    return 'bg-green-100 text-green-700 border-green-200';
  },

  generateBotResponse(userText, stressLevel) {
    if (stressLevel >= 70) {
      const responses = [
        "I can hear that you're going through a really tough time. It sounds like you're carrying a lot right now. Have you been able to talk to someone close to you about how you're feeling?",
        "That sounds incredibly difficult. Your feelings are completely valid. Please remember that it's okay to ask for help — reaching out to a mental health professional can make a real difference.",
        "I'm genuinely concerned about what you're sharing. High stress can take a serious toll on both your mental and physical health. Please consider taking a break and talking to someone you trust.",
        "It seems like you're experiencing significant stress right now. Remember, it's okay to slow down and take care of yourself first. You don't have to handle everything alone. 💙",
        "What you're going through sounds really overwhelming. Please be gentle with yourself. If you're feeling truly overwhelmed, reaching out to a helpline or therapist is a brave and important step.",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else if (stressLevel >= 40) {
      const responses = [
        "It sounds like you're feeling quite stressed. Have you tried any relaxation techniques like deep breathing or going for a short walk? Even a few minutes can help.",
        "I understand — stress has a way of piling up. Taking things one step at a time can help. What's the most pressing thing on your mind right now?",
        "I hear you. When we're overwhelmed, breaking things into smaller pieces makes them more manageable. Is there one thing you could let go of or postpone today?",
        "That's a lot to be dealing with. Remember to be kind to yourself. Even 10 minutes of quiet time can help reset your mind and perspective.",
        "Stress can be exhausting. Try the 4-7-8 breathing technique: inhale for 4 seconds, hold for 7, exhale for 8. It activates your parasympathetic nervous system. 🌿",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else if (stressLevel > 10) {
      const responses = [
        "Thanks for sharing. I notice a bit of tension in what you've written. Short breaks throughout your day can really help — even a 5-minute walk can reset your mind!",
        "I sense you might be feeling a little stressed. That's completely normal. What usually helps you unwind after a tough moment?",
        "Sounds like things are a bit challenging right now. You're doing great by talking about it! Is there anything specific I can help you think through?",
        "A little stress is normal, and it sounds like you're managing. Try to focus on one thing at a time and remember to breathe! You've got this. 🙌",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    } else {
      const responses = [
        "That sounds great! You seem to be in a good headspace today. Keep doing what you're doing! 😊",
        "It's wonderful to hear from you! You seem calm and collected. What's been going well for you lately?",
        "Glad to hear things are going smoothly! Is there anything you'd like to chat about or explore today?",
        "You seem to be handling things really well. Remember to celebrate your wins — big and small! 🎉",
        "You're doing wonderfully! Maintaining a calm state of mind is a real strength. Keep it up, and feel free to share anything on your mind!",
      ];
      return responses[Math.floor(Math.random() * responses.length)];
    }
  }
};
