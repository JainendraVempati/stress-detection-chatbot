import { auth, storage, stress } from './utils.js';

// ─── App State ─────────────────────────────────────────────────────────────
const state = {
  currentUser: null,
  chats: [],
  activeChatId: null,
  isTyping: false,
  sidebarOpen: false,
  showSessionModal: false,
  deleteConfirmId: null,
  currentPage: 'home',
  inputText: '',
  loginTab: 'email',
  otpStep: 'request',
  otpIdentifier: '',
  otpMessage: '',
  otpError: '',
  signupStep: 'form',
  pendingSignup: null,
  signupMessage: '',
  signupErrorMessage: '',
  dailyStressData: [], // Track stress levels throughout the day
};

function getChatId(chat) {
  return chat?._id || chat?.id || null;
}

// ─── Daily Stress Tracking ─────────────────────────────────────────────────
function getTodayStressData() {
  const today = new Date().toDateString();
  const data = localStorage.getItem(`stress_data_${state.currentUser?.id || 'guest'}`);
  const allData = data ? JSON.parse(data) : [];
  return allData.filter(item => new Date(item.timestamp).toDateString() === today);
}

function addStressDataPoint(stressLevel) {
  if (!state.currentUser) return;
  
  const today = new Date().toDateString();
  const data = localStorage.getItem(`stress_data_${state.currentUser.id}`);
  const allData = data ? JSON.parse(data) : [];
  
  allData.push({
    timestamp: new Date().toISOString(),
    stress: stressLevel,
    date: today
  });
  
  // Keep only last 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const filtered = allData.filter(item => new Date(item.timestamp) > sevenDaysAgo);
  
  localStorage.setItem(`stress_data_${state.currentUser.id}`, JSON.stringify(filtered));
}

function calculateDailyStats() {
  const todayData = getTodayStressData();
  
  if (todayData.length === 0) {
    return {
      avg: 0,
      movingAvg: 0,
      max: 0,
      min: 0,
      count: 0,
      trend: 'stable'
    };
  }
  
  const stressValues = todayData.map(d => d.stress);
  const avg = Math.round(stressValues.reduce((a, b) => a + b, 0) / stressValues.length);
  const max = Math.max(...stressValues);
  const min = Math.min(...stressValues);
  
  // Calculate Moving Average (window of 3)
  let movingAvg = avg;
  if (stressValues.length >= 3) {
    const last3 = stressValues.slice(-3);
    movingAvg = Math.round(last3.reduce((a, b) => a + b, 0) / 3);
  } else if (stressValues.length === 2) {
    movingAvg = Math.round((stressValues[0] + stressValues[1]) / 2);
  }
  
  // Calculate trend using moving averages
  let trend = 'stable';
  if (stressValues.length >= 6) {
    const recentMA = stressValues.slice(-3).reduce((a, b) => a + b, 0) / 3;
    const earlierMA = stressValues.slice(-6, -3).reduce((a, b) => a + b, 0) / 3;
    if (recentMA > earlierMA + 8) trend = 'increasing';
    else if (recentMA < earlierMA - 8) trend = 'decreasing';
  }
  
  return { avg, movingAvg, max, min, count: stressValues.length, trend };
}

// ─── App Initializer ────────────────────────────────────────────────────────
async function init() {
  state.currentUser = auth.getCurrentUser();
  if (state.currentUser) {
    state.chats = await storage.getChats(state.currentUser.id);
  }

  const hash = window.location.hash.slice(1) || 'home';
  handleRouting(hash);

  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.slice(1) || 'home';
    handleRouting(newHash);
  });
}

function handleRouting(page) {
  // Only redirect to login if trying to access chat without auth
  if (page === 'chat' && !state.currentUser) {
    window.location.hash = '#login';
    return;
  }
  
  // Allow explicit navigation to login/signup even if logged in
  // This lets users switch accounts or re-login if needed
  if (page === 'login' || page === 'signup') {
    state.currentPage = page;
    render();
    return;
  }
  
  // Redirect authenticated users from home to chat
  if (page === 'home' && state.currentUser) {
    window.location.hash = '#chat';
    return;
  }

  state.currentPage = page;
  render();
}

// ─── UI Rendering ───────────────────────────────────────────────────────────
function render() {
  const app = document.getElementById('app');
  if (!app) return;

  switch (state.currentPage) {
    case 'home':
      app.innerHTML = renderHome();
      break;
    case 'login':
      app.innerHTML = renderLogin();
      break;
    case 'signup':
      app.innerHTML = renderSignup();
      break;
    case 'chat':
      app.innerHTML = renderChat();
      // Scroll to bottom after render
      const messageContainer = document.getElementById('message-container');
      if (messageContainer) messageContainer.scrollTop = messageContainer.scrollHeight;
      break;
    default:
      app.innerHTML = renderHome();
  }

  // Initialize Lucide icons
  lucide.createIcons();
}

// ─── Home Page ──────────────────────────────────────────────────────────────
function renderHome() {
  const features = [
    {
      icon: 'brain',
      title: 'NLP & ML Stress Detection',
      desc: 'Advanced keyword analysis models identify stress patterns in your messages in real time.',
    },
    {
      icon: 'message-circle',
      title: 'Smart Conversations',
      desc: 'Context-aware responses tailored to your emotional state to provide meaningful support.',
    },
    {
      icon: 'trending-up',
      title: 'Stress Analytics',
      desc: 'Track your stress levels over time with per-chat average stress scores and history.',
    },
    {
      icon: 'shield',
      title: 'Secure & Private',
      desc: 'Your conversations are stored locally. No data leaves your browser without your consent.',
    },
  ];

  return `
    <div class="min-h-screen flex flex-col" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 30%, #4c1d95 60%, #1e1b4b 100%)">
      <!-- Navbar -->
      <header class="flex justify-between items-center px-6 py-4 border-b border-white/10">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <i data-lucide="brain" class="w-5 h-5 text-white"></i>
          </div>
          <span class="text-white text-lg font-semibold">StressBot</span>
        </div>
        <div class="flex gap-3">
          ${state.currentUser ? `
            <a href="#chat" class="px-5 py-2 rounded-lg bg-white text-indigo-900 hover:bg-indigo-50 transition-colors font-semibold">
              Go to Chat
            </a>
            <button onclick="handleLogout()" class="px-5 py-2 rounded-lg text-white border border-white/30 hover:bg-white/10 transition-colors">
              Logout
            </button>
          ` : `
            <a href="#login" class="px-5 py-2 rounded-lg text-white border border-white/30 hover:bg-white/10 transition-colors">
              Login
            </a>
            <a href="#signup" class="px-5 py-2 rounded-lg bg-white text-indigo-900 hover:bg-indigo-50 transition-colors font-semibold">
              Sign Up
            </a>
          `}
        </div>
      </header>

      <!-- Hero -->
      <main class="flex-1 flex flex-col items-center justify-center px-4 py-16 text-center">
        <div class="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 text-indigo-200 text-sm mb-6 border border-white/20">
          <i data-lucide="zap" class="w-4 h-4"></i>
          AI-Powered Mental Wellness
        </div>

        <h1 class="text-white mb-6 max-w-3xl" style="font-size: clamp(2.2rem, 5vw, 3.5rem); font-weight: 700; line-height: 1.2;">
          Stress Detection 
          <span style="background: linear-gradient(90deg, #a78bfa, #f0abfc); -webkit-background-clip: text; -webkit-text-fill-color: transparent;">
            Chatbot
          </span>
        </h1>

        <p class="text-indigo-200 text-lg max-w-xl mb-10 leading-relaxed">
          This chatbot detects user stress using <strong class="text-white">NLP and Machine Learning</strong>.
          Chat freely, and let our AI analyze your stress levels to provide personalized support.
        </p>

        <div class="flex flex-wrap gap-4 justify-center mb-20">
          ${state.currentUser ? `
            <a href="#chat" class="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 transition-all hover:scale-105 shadow-lg shadow-black/20 font-bold">
              Continue Chatting
              <i data-lucide="message-circle" class="w-5 h-5"></i>
            </a>
            <button onclick="handleLogout()" class="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white hover:bg-white/10 transition-all">
              Logout
            </button>
          ` : `
            <a href="#signup" class="flex items-center gap-2 px-8 py-3.5 rounded-xl bg-white text-indigo-900 hover:bg-indigo-50 transition-all hover:scale-105 shadow-lg shadow-black/20 font-bold">
              Get Started Free
              <i data-lucide="chevron-right" class="w-5 h-5"></i>
            </a>
            <a href="#login" class="flex items-center gap-2 px-8 py-3.5 rounded-xl border border-white/30 text-white hover:bg-white/10 transition-all">
              I already have an account
            </a>
          `}
        </div>

        <!-- Features Grid -->
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 max-w-5xl w-full">
          ${features.map(f => `
            <div class="p-6 rounded-2xl text-left border border-white/10 hover:border-white/25 transition-all" style="background: rgba(255,255,255,0.06); backdrop-filter: blur(10px);">
              <div class="w-11 h-11 rounded-xl bg-indigo-500/30 text-indigo-300 flex items-center justify-center mb-4">
                <i data-lucide="${f.icon}" class="w-6 h-6"></i>
              </div>
              <h3 class="text-white mb-2 font-semibold text-sm">${f.title}</h3>
              <p class="text-indigo-300 text-xs leading-relaxed">${f.desc}</p>
            </div>
          `).join('')}
        </div>
      </main>

      <!-- Footer -->
      <footer class="text-center py-6 text-indigo-400 text-sm border-t border-white/10">
        © 2026 StressBot · AI-powered stress detection for mental wellness
      </footer>
    </div>
  `;
}

// ─── Login Page ─────────────────────────────────────────────────────────────
function renderLogin() {
  // We'll use a data attribute to keep track of tabs
  const currentTab = state.loginTab || 'email';
  
  return `
    <div class="min-h-screen flex" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)">
      <!-- Left panel -->
      <div class="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <i data-lucide="brain" class="w-5 h-5 text-white"></i>
          </div>
          <span class="text-lg font-semibold">StressBot</span>
        </div>
        <div>
          <h2 class="text-4xl text-white mb-4 font-bold leading-tight">
            Welcome back.<br />
            <span class="text-indigo-300">Let's check in.</span>
          </h2>
          <p class="text-indigo-300 text-lg">
            Log in to continue your wellness journey and track your stress levels over time.
          </p>
        </div>
        <div class="text-indigo-400 text-sm">
          Your data stays private and secure.
        </div>
      </div>

      <!-- Right panel -->
      <div class="flex-1 flex items-center justify-center px-6 py-12">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div class="lg:hidden flex items-center gap-2 mb-6">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <i data-lucide="brain" class="w-4 h-4 text-white"></i>
            </div>
            <span class="text-indigo-900 font-bold">StressBot</span>
          </div>

          <h1 class="text-slate-900 mb-1 text-2xl font-bold">Sign In</h1>
          <p class="text-slate-500 text-sm mb-6">Choose your preferred login method</p>

          <div class="flex rounded-xl bg-slate-100 p-1 mb-6 gap-1">
            <button onclick="setLoginTab('email')" class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${currentTab === 'email' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}">
              <i data-lucide="mail" class="w-4 h-4"></i> Email
            </button>
            <button onclick="setLoginTab('google')" class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${currentTab === 'google' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}">
              <i data-lucide="chrome" class="w-4 h-4"></i> Google
            </button>
            <button onclick="setLoginTab('otp')" class="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm transition-all ${currentTab === 'otp' ? 'bg-white text-indigo-700 shadow-sm font-semibold' : 'text-slate-500 hover:text-slate-700'}">
              <i data-lucide="mail" class="w-4 h-4"></i> Email OTP
            </button>
          </div>

          <div id="login-error" class="hidden flex items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm mb-4 border border-red-200">
            <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
            <span id="error-message"></span>
          </div>

          <div id="login-form-container">
            ${renderLoginForm(currentTab)}
          </div>

          <p class="text-center text-sm text-slate-500 mt-6">
            Don't have an account? 
            <a href="#signup" class="text-indigo-600 hover:text-indigo-800 font-semibold">Sign up for free</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

function renderLoginForm(tab) {
  if (tab === 'email') {
    return `
      <form onsubmit="handleLogin(event)" class="space-y-4">
        <div>
          <label class="block text-sm text-slate-700 mb-1.5 font-medium">Email Address</label>
          <div class="relative">
            <i data-lucide="mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input type="email" id="email" required placeholder="you@example.com" class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
          </div>
        </div>
        <div>
          <label class="block text-sm text-slate-700 mb-1.5 font-medium">Password</label>
          <div class="relative">
            <i data-lucide="lock" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input type="password" id="password" required placeholder="Enter your password" class="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
            <button type="button" onclick="togglePassword('password')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <i data-lucide="eye" class="w-4 h-4" id="password-eye"></i>
            </button>
          </div>
        </div>
        <button type="submit" id="login-submit" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Sign In</button>
      </form>
    `;
  } else if (tab === 'google') {
    return `
      <form onsubmit="handleGoogleLogin(event)" class="space-y-4">
        <div class="flex items-center gap-3 p-4 rounded-xl bg-blue-50 border border-blue-100 text-blue-700 text-sm mb-2">
          <i data-lucide="chrome" class="w-5 h-5 flex-shrink-0"></i>
          <span>Enter your Google email to sign in or auto-create an account.</span>
        </div>
        <div>
          <label class="block text-sm text-slate-700 mb-1.5 font-medium">Google Email</label>
          <div class="relative">
            <i data-lucide="mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input type="email" id="googleEmail" required placeholder="your.email@gmail.com" class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
          </div>
        </div>
        <button type="submit" id="google-submit" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Continue with Google</button>
      </form>
    `;
  } else {
    return `
      <form onsubmit="${state.otpStep === 'verify' ? 'handleVerifyOtp(event)' : 'handleSendOtp(event)'}" class="space-y-4">
        <div class="p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-sm mb-2">
          <div class="flex items-center gap-2 mb-1 font-semibold text-slate-900">
            <i data-lucide="mail" class="w-4 h-4"></i> Email OTP Login
          </div>
          <p>Enter your email to receive a one-time verification code.</p>
        </div>

        <div>
          <label class="block text-sm text-slate-700 mb-1.5 font-medium">Email Address</label>
          <div class="relative">
            <i data-lucide="mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
            <input type="email" id="otpEmail" required placeholder="you@example.com" class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
          </div>
        </div>

        ${state.otpMessage ? `
          <div class="rounded-xl p-3 text-sm ${state.otpError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'}">
            ${state.otpMessage}
          </div>
        ` : ''}

        ${state.otpStep === 'verify' ? `
          <div>
            <label class="block text-sm text-slate-700 mb-1.5 font-medium">Enter OTP</label>
            <input type="text" id="otpCode" required maxlength="6" placeholder="123456" class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
          </div>
          <button type="submit" id="otp-verify" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Verify OTP</button>
          <button type="button" onclick="resetOtpState()" class="w-full py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm">Use a different email</button>
        ` : `
          <button type="submit" id="otp-send" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Send OTP</button>
        `}
      </form>
    `;
  }
}

// ─── Signup Page ────────────────────────────────────────────────────────────
function renderSignup() {
  const isVerifyStep = state.signupStep === 'verify';
  const pendingEmail = state.pendingSignup?.email || '';

  return `
    <div class="min-h-screen flex" style="background: linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #1e1b4b 100%)">
      <!-- Left panel -->
      <div class="hidden lg:flex flex-col justify-between w-1/2 p-12 text-white">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
            <i data-lucide="brain" class="w-5 h-5 text-white"></i>
          </div>
          <span class="text-lg font-semibold">StressBot</span>
        </div>
        <div>
          <h2 class="text-4xl text-white mb-4 font-bold leading-tight">
            Start your wellness<br />
            <span class="text-indigo-300">journey today.</span>
          </h2>
          <p class="text-indigo-300 text-lg mb-8">
            Create your free account and begin tracking your stress levels with AI-powered insights.
          </p>
          <div class="space-y-3">
            ${[
              'Real-time stress detection with NLP',
              'Personalized support responses',
              'Complete chat history',
              'Private & secure — data stays local',
            ].map(item => `
              <div class="flex items-center gap-2 text-indigo-200">
                <i data-lucide="check-circle-2" class="w-5 h-5 text-indigo-400 flex-shrink-0"></i>
                <span class="text-sm">${item}</span>
              </div>
            `).join('')}
          </div>
        </div>
        <div class="text-indigo-400 text-sm">
          No credit card required. Free forever.
        </div>
      </div>

      <!-- Right panel -->
      <div class="flex-1 flex items-center justify-center px-6 py-12">
        <div class="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8">
          <div class="lg:hidden flex items-center gap-2 mb-6">
            <div class="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <i data-lucide="brain" class="w-4 h-4 text-white"></i>
            </div>
            <span class="text-indigo-900 font-bold">StressBot</span>
          </div>

          <h1 class="text-slate-900 mb-1 text-2xl font-bold">${isVerifyStep ? 'Verify your email' : 'Create Account'}</h1>
          <p class="text-slate-500 text-sm mb-6">
            ${isVerifyStep ? `Enter the code sent to <strong>${pendingEmail}</strong>.` : 'Sign up to start your wellness journey'}
          </p>

          <div id="signup-error" class="${state.signupErrorMessage ? 'flex' : 'hidden'} items-center gap-2 p-3 rounded-lg bg-red-50 text-red-600 text-sm mb-4 border border-red-200">
            <i data-lucide="alert-circle" class="w-4 h-4 flex-shrink-0"></i>
            <span id="signup-error-message">${state.signupErrorMessage}</span>
          </div>

          ${state.signupMessage ? `
            <div id="signup-success" class="flex flex-col gap-2 p-4 rounded-xl bg-emerald-50 text-emerald-700 text-sm mb-4 border-2 border-emerald-300">
              <div class="flex items-center gap-2">
                <i data-lucide="check-circle-2" class="w-5 h-5 flex-shrink-0 text-emerald-600"></i>
                <span class="font-semibold text-emerald-800">${state.signupMessage.includes('✅') ? '' : 'Success!'}</span>
              </div>
              <div class="text-emerald-700 leading-relaxed">${state.signupMessage}</div>
              ${state.signupMessage.includes('OTP') && state.signupMessage.includes(':') ? `
                <div class="mt-2 p-3 bg-white rounded-lg border-2 border-emerald-400 text-center">
                  <p class="text-xs text-emerald-600 mb-1">Your Verification Code:</p>
                  <p class="text-2xl font-bold text-emerald-800 tracking-wider">${state.signupMessage.match(/: (\d+)/)?.[1] || ''}</p>
                  <p class="text-xs text-emerald-500 mt-1">Enter this code below to verify your account</p>
                </div>
              ` : ''}
            </div>
          ` : ''}

          <form onsubmit="${isVerifyStep ? 'handleVerifySignupOtp(event)' : 'handleSignup(event)'}" class="space-y-4">
            ${isVerifyStep ? `
              <div>
                <label class="block text-sm text-slate-700 mb-1.5 font-medium">Verification Code</label>
                <input type="text" id="signupOtpCode" required maxlength="6" placeholder="123456" class="w-full px-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
              </div>
              <button type="submit" id="signup-verify-submit" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Verify Code</button>
              <button type="button" onclick="resetSignupState()" class="w-full py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm">Edit account details</button>
            ` : `
              <div>
                <label class="block text-sm text-slate-700 mb-1.5 font-medium">Full Name</label>
                <div class="relative">
                  <i data-lucide="user" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                  <input type="text" id="name" required placeholder="John Doe" value="${isVerifyStep ? '' : state.pendingSignup?.name || ''}" class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
                </div>
              </div>
              <div>
                <label class="block text-sm text-slate-700 mb-1.5 font-medium">Email Address</label>
                <div class="relative">
                  <i data-lucide="mail" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                  <input type="email" id="email" required placeholder="you@example.com" value="${isVerifyStep ? '' : state.pendingSignup?.email || ''}" class="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
                </div>
              </div>
              <div>
                <label class="block text-sm text-slate-700 mb-1.5 font-medium">Password</label>
                <div class="relative">
                  <i data-lucide="lock" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                  <input type="password" id="password" required oninput="updatePasswordStrength()" placeholder="Create a strong password" value="${isVerifyStep ? '' : (state.pendingSignup?.password || '')}" class="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
                  <button type="button" onclick="togglePassword('password')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <i data-lucide="eye" class="w-4 h-4" id="password-eye"></i>
                  </button>
                </div>
                <div id="strength-container" class="hidden mt-2">
                  <div class="flex justify-between text-xs text-slate-500 mb-1">
                    <span>Password strength</span>
                    <span id="strength-label"></span>
                  </div>
                  <div class="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                    <div id="strength-bar" class="h-full rounded-full bg-indigo-600 transition-all duration-300"></div>
                  </div>
                </div>
              </div>
              <div>
                <label class="block text-sm text-slate-700 mb-1.5 font-medium">Confirm Password</label>
                <div class="relative">
                  <i data-lucide="lock" class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"></i>
                  <input type="password" id="confirmPassword" required placeholder="Re-enter your password" value="${isVerifyStep ? '' : (state.pendingSignup?.confirmPassword || '')}" class="w-full pl-10 pr-11 py-3 rounded-xl border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-slate-50">
                  <button type="button" onclick="togglePassword('confirmPassword')" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    <i data-lucide="eye" class="w-4 h-4" id="confirmPassword-eye"></i>
                  </button>
                </div>
              </div>
              <button type="submit" id="signup-submit" class="w-full py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">Create Account</button>
            `}
          </form>

          <p class="text-center text-sm text-slate-500 mt-6">
            Already have an account? 
            <a href="#login" class="text-indigo-600 hover:text-indigo-800 font-semibold">Sign in</a>
          </p>
        </div>
      </div>
    </div>
  `;
}

// ─── Chat Page ──────────────────────────────────────────────────────────────
function renderChat() {
  const activeChat = state.chats.find(c => getChatId(c) === state.activeChatId);
  const user = state.currentUser;

  return `
    <div class="flex h-screen overflow-hidden bg-slate-50">
      ${state.showSessionModal ? renderSessionModal() : ''}
      ${state.deleteConfirmId ? renderDeleteModal() : ''}

      <!-- Mobile sidebar overlay -->
      <div id="sidebar-overlay" class="${state.sidebarOpen ? '' : 'hidden'} fixed inset-0 z-30 bg-black/30 lg:hidden" onclick="toggleSidebar(false)"></div>

      <!-- Sidebar -->
      <aside class="${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'} fixed lg:relative z-40 flex flex-col h-full w-[260px] flex-shrink-0 transition-transform duration-300 ease-in-out bg-[#0f172a]">
        <!-- Header -->
        <div class="flex items-center justify-between px-4 h-14 border-b border-white/5">
          <div class="flex items-center gap-2">
            <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
              <i data-lucide="brain" class="w-3.5 h-3.5 text-white"></i>
            </div>
            <span class="text-white text-sm font-semibold">StressBot</span>
          </div>
          <button onclick="toggleSidebar(false)" class="lg:hidden text-slate-500 hover:text-white">
            <i data-lucide="x" class="w-4 h-4"></i>
          </button>
        </div>

        <!-- New chat -->
        <div class="px-3 pt-3 pb-1">
          <button onclick="handleNewChat()" class="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-slate-400 hover:bg-white/5 hover:text-white transition-all text-sm">
            <i data-lucide="plus" class="w-4 h-4"></i>
            New chat
          </button>
        </div>

        <!-- Chat list -->
        <div class="flex-1 overflow-y-auto px-2 py-1 no-scrollbar">
          ${state.chats.length === 0 ? `
            <p class="text-slate-600 text-xs text-center py-6">No conversations yet</p>
          ` : `
            <p class="text-slate-600 text-xs px-3 py-2 font-medium">Recent</p>
            ${state.chats.map(chat => {
              const chatId = getChatId(chat);
              return `
                <div onclick="selectChat('${chatId}')" class="group flex items-center gap-2 px-3 py-2 rounded-lg mb-0.5 cursor-pointer transition-all ${state.activeChatId === chatId ? 'bg-white/10 text-white' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}">
                  <i data-lucide="message-square" class="w-3.5 h-3.5 flex-shrink-0 opacity-60"></i>
                  <span class="flex-1 truncate text-sm ${state.activeChatId === chatId ? 'font-medium' : ''}">${chat.chatName}</span>
                  <button onclick="confirmDeleteChat(event, '${chatId}')" class="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition-all flex-shrink-0">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                  </button>
                </div>
              `;
            }).join('')}

          `}
        </div>

        <!-- User profile -->
        <div class="border-t border-white/5 px-3 py-3">
          <div class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
            <div class="w-7 h-7 rounded-full bg-indigo-600 flex items-center justify-center flex-shrink-0">
              <span class="text-white text-[0.7rem] font-bold">${user.name.charAt(0).toUpperCase()}</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-white truncate text-[0.8rem] font-medium">${user.name}</p>
              <p class="text-slate-500 truncate text-[0.7rem]">${user.email}</p>
            </div>
            <button onclick="handleLogout()" title="Sign out" class="text-slate-600 hover:text-red-400 transition-colors">
              <i data-lucide="log-out" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 flex flex-col min-w-0 overflow-hidden">
        <!-- Top bar -->
        <header class="flex items-center gap-3 px-4 h-14 bg-white border-b border-slate-200 flex-shrink-0">
          <button onclick="toggleSidebar(true)" class="lg:hidden text-slate-500 hover:text-slate-700">
            <i data-lucide="menu" class="w-5 h-5"></i>
          </button>

          ${activeChat ? `
            <div class="flex-1 min-w-0">
              <h2 class="text-slate-900 truncate text-sm font-semibold">${activeChat.chatName}</h2>
              <p class="text-slate-400 text-xs">${activeChat.messages.filter(m => m.sender === 'user').length} messages</p>
            </div>
            ${activeChat.messages.filter(m => m.sender === 'user' || m.role === 'user').length > 0 ? `
              <div class="flex items-center gap-3">
                <!-- Current Stress Level -->
                <div class="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-indigo-50 border border-indigo-200">
                  ${renderStressRing(activeChat.avgStress, 32)}
                  <div>
                    <p class="text-[0.65rem] text-indigo-600 font-medium">Avg Stress</p>
                    <p class="text-sm font-bold text-indigo-700">${activeChat.avgStress}%</p>
                  </div>
                </div>
              </div>
            ` : ''}
          ` : `
            <p class="text-slate-400 text-sm flex-1">StressBot</p>
          `}

          <button onclick="handleNewChat()" class="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm transition-colors">
            <i data-lucide="plus" class="w-3.5 h-3.5"></i>
            New chat
          </button>
        </header>

        <!-- Messages Area -->
        <div id="message-container" class="flex-1 overflow-y-auto custom-scrollbar">
          ${!activeChat ? `
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
              <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
                <i data-lucide="brain" class="w-7 h-7 text-indigo-600"></i>
              </div>
              <h3 class="text-slate-800 mb-1 font-bold">How are you feeling?</h3>
              <p class="text-slate-400 text-sm mb-5">Select a chat or start a new one.</p>
              <button onclick="handleNewChat()" class="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors text-sm font-semibold">
                <i data-lucide="plus" class="w-4 h-4"></i> New chat
              </button>
            </div>
          ` : activeChat.messages.length === 0 ? `
            <div class="flex flex-col items-center justify-center h-full text-center px-4">
              <div class="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
                <i data-lucide="sparkles" class="w-7 h-7 text-indigo-600"></i>
              </div>
              <h3 class="text-slate-800 mb-2 font-bold text-[1.1rem]">How are you feeling today?</h3>
              <p class="text-slate-400 text-sm max-w-sm mb-7">Share what's on your mind. I'll detect your stress level and respond with personalized support.</p>
                      
              <!-- Daily Stress Stats -->
              ${(() => {
                const stats = calculateDailyStats();
                if (stats.count === 0) return '';
                return `
                  <div class="max-w-md w-full mb-6 p-4 rounded-2xl bg-white border border-slate-200 shadow-sm">
                    <p class="text-xs font-semibold text-slate-800 mb-3">📊 Today's Stress Summary</p>
                    <div class="grid grid-cols-4 gap-3">
                      <div class="text-center">
                        <p class="text-lg font-bold text-indigo-600">${stats.movingAvg}%</p>
                        <p class="text-[0.65rem] text-slate-600">Moving Avg</p>
                      </div>
                      <div class="text-center">
                        <p class="text-lg font-bold text-purple-600">${stats.max}%</p>
                        <p class="text-[0.65rem] text-slate-600">Peak</p>
                      </div>
                      <div class="text-center">
                        <p class="text-lg font-bold text-indigo-500">${stats.min}%</p>
                        <p class="text-[0.65rem] text-slate-600">Lowest</p>
                      </div>
                      <div class="text-center">
                        <p class="text-lg font-bold text-purple-500">${stats.count}</p>
                        <p class="text-[0.65rem] text-slate-600">Messages</p>
                      </div>
                    </div>
                    ${stats.trend !== 'stable' ? `
                      <div class="mt-3 pt-3 border-t border-slate-200">
                        <p class="text-[0.7rem] text-slate-700">
                          Trend: <span class="font-semibold" style="color: ${stats.trend === 'increasing' ? '#dc2626' : '#16a34a'}">
                            ${stats.trend === 'increasing' ? '📈 Increasing' : '📉 Decreasing'}
                          </span>
                        </p>
                      </div>
                    ` : ''}
                  </div>
                `;
              })()}
                      
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-md w-full">
                ${[
                  "I've been feeling really stressed lately",
                  "Work has been overwhelming this week",
                  "I'm feeling pretty good today!",
                  "I'm anxious about something"
                ].map(s => `
                  <button onclick="setInputText('${s.replace(/'/g, "\\'")}'  )" class="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 text-sm text-left hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all">
                    ${s}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : `
            <div class="max-w-2xl mx-auto w-full px-4 py-6 space-y-5">
              ${activeChat.messages.map(msg => {
                const isUser = msg.sender === 'user' || msg.role === 'user';
                const stressValue = msg.stress || 0;
                
                return `
                <div class="flex gap-3 items-end ${isUser ? 'flex-row-reverse' : 'flex-row'}">
                  <!-- Avatar -->
                  <div class="flex-shrink-0 mb-5">
                    ${!isUser ? `
                      <div class="w-7 h-7 rounded-lg bg-indigo-100 flex items-center justify-center">
                        <i data-lucide="brain" class="w-3.5 h-3.5 text-indigo-600"></i>
                      </div>
                    ` : `
                      <div class="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center">
                        <span class="text-white text-[0.7rem] font-bold">${user.name.charAt(0).toUpperCase()}</span>
                      </div>
                    `}
                  </div>

                  <!-- Bubble -->
                  <div class="flex flex-col gap-1 max-w-[78%] ${isUser ? 'items-end' : 'items-start'}">
                    <div class="px-4 py-3 rounded-2xl text-sm ${isUser ? 'bg-indigo-600 text-white rounded-br-sm shadow-sm shadow-indigo-200' : 'bg-white text-slate-800 border border-slate-200 rounded-bl-sm shadow-sm'}" style="line-height: 1.65">
                      ${msg.text}
                    </div>
                    <div class="flex items-center gap-2 ${isUser ? 'flex-row-reverse' : 'flex-row'}">
                      <span class="text-slate-400 text-[0.7rem]">${formatTime(msg.timestamp)}</span>
                      ${isUser ? renderStressBadge(stressValue, msg.stressData) : ''}
                    </div>
                    ${isUser ? `
                      ${(() => {
                        const hasStressKeywords = msg.stressData?.hasStressKeywords || false;
                        const hasPositiveWords = msg.stressData?.hasPositiveWords || false;
                        
                        // No keywords at all - don't show anything
                        if (!hasStressKeywords && !hasPositiveWords && stressValue === 0) {
                          return '';
                        }
                        
                        // Positive words detected - show "No Stress"
                        if (hasPositiveWords && !hasStressKeywords) {
                          return `
                            <div class="mt-1 px-2 py-1 rounded-lg text-[0.65rem] font-medium bg-green-50 text-green-700 border border-green-200">
                              ✓ No Stress
                            </div>
                          `;
                        }
                        
                        // Stress keywords detected - show stress level
                        if (hasStressKeywords && stressValue > 0) {
                          return `
                            <div class="mt-1 px-2 py-1 rounded-lg text-[0.65rem] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              Stress Level: ${(stressValue / 10).toFixed(1)}/10
                            </div>
                          `;
                        }
                        
                        return '';
                      })()}
                    ` : ''}
                  </div>
                </div>
              `;
              }).join('')}
              ${state.isTyping ? `
                <div class="flex gap-3 items-end">
                  <div class="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                    <i data-lucide="brain" class="w-4 h-4 text-indigo-600"></i>
                  </div>
                  <div class="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm">
                    <div class="flex gap-1 items-center h-4">
                      <span class="w-2 h-2 rounded-full bg-indigo-400 animate-typing"></span>
                      <span class="w-2 h-2 rounded-full bg-indigo-400 animate-typing" style="animation-delay: 0.2s"></span>
                      <span class="w-2 h-2 rounded-full bg-indigo-400 animate-typing" style="animation-delay: 0.4s"></span>
                    </div>
                  </div>
                </div>
              ` : ''}
              <div id="messages-end"></div>
            </div>
          `}
        </div>

        <!-- Input Area -->
        ${activeChat ? `
          <div class="bg-white border-t border-slate-100 px-4 py-3 flex-shrink-0">
            <div class="max-w-2xl mx-auto">
              <p class="text-center mb-2 text-slate-400 text-[0.7rem]">
                <i data-lucide="bar-chart-2" class="w-3 h-3 inline mr-1"></i>
                Messages are analyzed for stress · Enter to send · Shift+Enter for new line
              </p>
              ${state.isTyping ? `
                <div class="text-center mb-2">
                  <span class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-200">
                    <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Analyzing stress & generating response...
                  </span>
                </div>
              ` : ''}
              <div class="flex items-end gap-2 bg-white rounded-2xl border border-slate-200 px-4 py-3 shadow-sm focus-within:border-indigo-400 focus-within:shadow-md focus-within:shadow-indigo-50 transition-all">
                <textarea
                  id="chat-input"
                  oninput="handleInput(this)"
                  onkeydown="handleKeyDown(event)"
                  placeholder="Message StressBot..."
                  rows="1"
                  ${state.isTyping ? 'disabled' : ''}
                  class="flex-1 bg-transparent text-slate-900 placeholder-slate-400 resize-none focus:outline-none text-sm disabled:opacity-50"
                  style="line-height: 1.6; max-height: 140px;"
                >${state.inputText}</textarea>
                <button onclick="handleSendMessage()" ${!state.inputText.trim() || state.isTyping ? 'disabled' : ''} class="flex-shrink-0 w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
                  ${state.isTyping ? '<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin"></i>' : '<i data-lucide="send" class="w-3.5 h-3.5"></i>'}
                </button>
              </div>
            </div>
          </div>
        ` : ''}
      </main>
    </div>
  `;
}

// ─── Component Helpers ──────────────────────────────────────────────────────
function renderStressBadge(score, stressData = null) {
  const badgeContent = `
    <span class="w-1.5 h-1.5 rounded-full" style="background: ${stress.getStressColor(score)}"></span>
    ${score}% · ${stress.getStressLabel(score)}
  `;
  
  // If we have ML data, add a tooltip
  if (stressData && stressData.lstm !== undefined) {
    return `
      <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${stress.getStressBg(score)} cursor-help" title="LSTM: ${(stressData.lstm * 100).toFixed(1)}% | VADER: ${(stressData.vader * 100).toFixed(1)}% | Combined: ${(stressData.combined * 100).toFixed(1)}%">
        ${badgeContent}
      </span>
    `;
  }
  
  return `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-medium ${stress.getStressBg(score)}">
      ${badgeContent}
    </span>
  `;
}

function renderStressRing(score, size = 36) {
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  return `
    <svg width="${size}" height="${size}" style="transform: rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="#e2e8f0" stroke-width="5" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${stress.getStressColor(score)}" stroke-width="5" stroke-dasharray="${circ}" stroke-dashoffset="${offset}" stroke-linecap="round" style="transition: stroke-dashoffset 0.6s ease" />
    </svg>
  `;
}

function renderSessionModal() {
  const lastChat = state.chats[0];
  if (!lastChat) return '';
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div class="bg-white rounded-2xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <div class="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center mb-4">
          <i data-lucide="sparkles" class="w-6 h-6 text-indigo-600"></i>
        </div>
        <h2 class="text-slate-900 mb-1 text-xl font-bold">Welcome back! 👋</h2>
        <p class="text-slate-500 text-sm mb-4">You have an ongoing conversation:</p>
        <div class="bg-slate-50 rounded-xl p-3 mb-6 border border-slate-200">
          <p class="text-slate-800 text-sm font-semibold">💬 ${lastChat.chatName}</p>
          <p class="text-slate-500 text-xs mt-0.5">${lastChat.messages.length} messages · Avg stress: ${lastChat.avgStress}%</p>
        </div>
        <div class="flex flex-col gap-3">
          <button onclick="continueLastChat()" class="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-semibold">
            Continue last conversation
            <i data-lucide="chevron-right" class="w-4 h-4"></i>
          </button>
          <button onclick="handleNewChat()" class="w-full py-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors text-sm">Start a new chat</button>
        </div>
      </div>
    </div>
  `;
}

function renderDeleteModal() {
  return `
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div class="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl">
        <h3 class="text-slate-900 mb-2 font-bold">Delete this chat?</h3>
        <p class="text-slate-500 text-sm mb-5">All messages in this conversation will be permanently deleted.</p>
        <div class="flex gap-3">
          <button onclick="closeDeleteModal()" class="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm">Cancel</button>
          <button onclick="deleteActiveChat()" class="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-sm font-semibold">Delete</button>
        </div>
      </div>
    </div>
  `;
}

// ─── Event Handlers ────────────────────────────────────────────────────────
window.setLoginTab = (tab) => {
  state.loginTab = tab;
  state.otpStep = 'request';
  state.otpIdentifier = '';
  state.otpMessage = '';
  state.otpError = '';
  render();
};

window.togglePassword = (id) => {
  const input = document.getElementById(id);
  const eye = document.getElementById(id + '-eye');
  if (input.type === 'password') {
    input.type = 'text';
    eye.setAttribute('data-lucide', 'eye-off');
  } else {
    input.type = 'password';
    eye.setAttribute('data-lucide', 'eye');
  }
  lucide.createIcons();
};

window.handleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  const errorDiv = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-message');
  const submitBtn = document.getElementById('login-submit');

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Signing in...';

  try {
    const result = await auth.login(email, password);
    state.currentUser = result.user;
    state.chats = await storage.getChats(state.currentUser.id);
    if (state.chats.length > 0) state.showSessionModal = true;
    window.location.hash = '#chat';
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'Login failed.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Sign In';
    lucide.createIcons();
  }
};

window.handleGoogleLogin = async (e) => {
  e.preventDefault();
  const email = document.getElementById('googleEmail').value;
  const errorDiv = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-message');
  const submitBtn = document.getElementById('google-submit');

  errorDiv.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.innerText = 'Connecting...';

  try {
    const name = email.split('@')[0];
    const result = await auth.googleLogin(email, name);
    state.currentUser = result.user;
    state.chats = await storage.getChats(state.currentUser.id);
    if (state.chats.length > 0) state.showSessionModal = true;
    window.location.hash = '#chat';
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'Google login failed.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Continue with Google';
    lucide.createIcons();
  }
};

window.handleSignup = async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim().toLowerCase();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;
  const errorDiv = document.getElementById('signup-error');
  const errorMsg = document.getElementById('signup-error-message');
  const submitBtn = document.getElementById('signup-submit');

  errorDiv.classList.add('hidden');
  state.signupErrorMessage = '';
  state.signupMessage = '';

  if (password !== confirmPassword) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = 'Passwords do not match.';
    state.signupErrorMessage = 'Passwords do not match.';
    lucide.createIcons();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Sending OTP...';

  try {
    const response = await auth.signup(name, email, password, confirmPassword);
    state.signupStep = 'verify';
    state.pendingSignup = { name, email, password, confirmPassword };
    
    // Log to console for debugging
    console.log('Signup Response:', response);
    
    // Build message with prominent OTP display
    if (response.debug && response.otp) {
      state.signupMessage = `✅ OTP Generated Successfully! Your verification code is: ${response.otp}`;
      console.log(`🔑 YOUR OTP IS: ${response.otp}`);
      if (response.emailError) {
        state.signupMessage += ` (Email not configured - use the OTP shown above)`;
      }
    } else {
      state.signupMessage = response.message || 'OTP sent to your email. Verify to complete signup.';
    }
    
    state.signupErrorMessage = '';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Create Account';
    render();
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'Signup failed.';
    state.signupErrorMessage = error.message || 'Signup failed.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Create Account';
    lucide.createIcons();
  }
};

window.handleVerifySignupOtp = async (e) => {
  e.preventDefault();
  const otpValue = document.getElementById('signupOtpCode').value.trim();
  const errorDiv = document.getElementById('signup-error');
  const errorMsg = document.getElementById('signup-error-message');
  const submitBtn = document.getElementById('signup-verify-submit');

  errorDiv.classList.add('hidden');
  state.signupErrorMessage = '';

  if (!state.pendingSignup?.email) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = 'Signup session expired. Please start again.';
    state.signupErrorMessage = 'Signup session expired. Please start again.';
    render();
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerText = 'Verifying...';

  try {
    const result = await auth.verifySignupOtp(state.pendingSignup.email, otpValue);
    state.currentUser = result.user;
    state.chats = await storage.getChats(state.currentUser.id);
    state.signupStep = 'form';
    state.pendingSignup = null;
    state.signupMessage = '';
    state.signupErrorMessage = '';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Verify Code';
    if (state.chats.length > 0) state.showSessionModal = true;
    window.location.hash = '#chat';
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'OTP verification failed.';
    state.signupErrorMessage = error.message || 'OTP verification failed.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Verify Code';
    lucide.createIcons();
  }
};

window.resetSignupState = () => {
  state.signupStep = 'form';
  state.signupMessage = '';
  state.signupErrorMessage = '';
  render();
};

window.handleSendOtp = async (e) => {
  e.preventDefault();
  const email = document.getElementById('otpEmail').value.trim().toLowerCase();
  const errorDiv = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-message');
  const submitBtn = document.getElementById('otp-send');

  errorDiv.classList.add('hidden');
  errorMsg.innerText = '';
  submitBtn.disabled = true;
  submitBtn.innerText = 'Sending OTP...';

  try {
    const response = await auth.sendOtp(email);
    state.otpStep = 'verify';
    state.otpIdentifier = email;
    state.otpError = false;
    state.otpMessage = response.debug ? `OTP: ${response.otp} (debug mode)` : 'OTP sent to your email.';
    state.loginTab = 'otp';
    render();
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'Could not send OTP.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Send OTP';
    lucide.createIcons();
  }
};

window.handleVerifyOtp = async (e) => {
  e.preventDefault();
  const otpValue = document.getElementById('otpCode').value.trim();
  const errorDiv = document.getElementById('login-error');
  const errorMsg = document.getElementById('error-message');
  const submitBtn = document.getElementById('otp-verify');

  errorDiv.classList.add('hidden');
  errorMsg.innerText = '';
  submitBtn.disabled = true;
  submitBtn.innerText = 'Verifying...';

  try {
    const result = await auth.verifyOtp(state.otpIdentifier, otpValue);
    state.currentUser = result.user;
    state.chats = await storage.getChats(state.currentUser.id);
    if (state.chats.length > 0) state.showSessionModal = true;
    window.location.hash = '#chat';
  } catch (error) {
    errorDiv.classList.remove('hidden');
    errorMsg.innerText = error.message || 'OTP verification failed.';
    submitBtn.disabled = false;
    submitBtn.innerText = 'Verify OTP';
    lucide.createIcons();
  }
};

window.resetOtpState = () => {
  state.otpStep = 'request';
  state.otpIdentifier = '';
  state.otpMessage = '';
  state.otpError = false;
  render();
};

window.updatePasswordStrength = () => {
  const password = document.getElementById('password').value;
  const container = document.getElementById('strength-container');
  const label = document.getElementById('strength-label');
  const bar = document.getElementById('strength-bar');

  if (password.length === 0) {
    container.classList.add('hidden');
    return;
  }

  container.classList.remove('hidden');
  let strength = { label: 'Weak', color: 'bg-red-400', width: '25%' };
  
  if (password.length >= 6) {
    if (password.length < 8) strength = { label: 'Fair', color: 'bg-orange-400', width: '50%' };
    else if (password.length < 12 || !/[A-Z]/.test(password) || !/[0-9]/.test(password))
      strength = { label: 'Good', color: 'bg-yellow-400', width: '75%' };
    else strength = { label: 'Strong', color: 'bg-green-500', width: '100%' };
  }

  label.innerText = strength.label;
  label.className = strength.label === 'Strong' ? 'text-green-600' : strength.label === 'Weak' ? 'text-red-500' : 'text-orange-500';
  bar.className = 'h-full rounded-full transition-all ' + strength.color;
  bar.style.width = strength.width;
};

window.updateConfirmMatch = () => {
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  const text = document.getElementById('match-text');
  
  if (confirm.length === 0) {
    text.classList.add('hidden');
    return;
  }

  text.classList.remove('hidden');
  if (password === confirm) {
    text.innerText = '✓ Passwords match';
    text.className = 'text-xs mt-1 text-green-600';
  } else {
    text.innerText = '✗ Passwords do not match';
    text.className = 'text-xs mt-1 text-red-500';
  }
};

window.handleLogout = () => {
  auth.logout();
  state.currentUser = null;
  state.chats = [];
  state.activeChatId = null;
  window.location.hash = '#home';
};

// ─── Chat Handlers ──────────────────────────────────────────────────────────
window.toggleSidebar = (open) => {
  state.sidebarOpen = open;
  render();
};

window.selectChat = (id) => {
  state.activeChatId = id;
  state.sidebarOpen = false;
  state.showSessionModal = false;
  render();
};

window.handleNewChat = async () => {
  try {
    const newChat = await storage.createNewChat(state.currentUser.id);
    state.chats = await storage.getChats(state.currentUser.id);
    state.activeChatId = newChat._id || newChat.id;
    state.sidebarOpen = false;
    state.showSessionModal = false;
    render();
  } catch (error) {
    console.error('Error creating chat:', error.message || error);
  }
};

window.continueLastChat = () => {
  if (state.chats.length > 0) {
    state.activeChatId = state.chats[0]._id || state.chats[0].id;
  }
  state.showSessionModal = false;
  render();
};

window.confirmDeleteChat = (e, id) => {
  e.stopPropagation();
  state.deleteConfirmId = id;
  render();
};

window.closeDeleteModal = () => {
  state.deleteConfirmId = null;
  render();
};

window.deleteActiveChat = async () => {
  try {
    await storage.deleteChat(state.deleteConfirmId);
    if (state.activeChatId === state.deleteConfirmId) state.activeChatId = null;
    state.chats = await storage.getChats(state.currentUser.id);
    state.deleteConfirmId = null;
    render();
  } catch (error) {
    console.error('Error deleting chat:', error.message || error);
  }
};

window.handleInput = (el) => {
  state.inputText = el.value;
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
  // Note: we don't re-render here to keep focus and speed, 
  // just update the button state if needed
  const btn = el.nextElementSibling;
  btn.disabled = !state.inputText.trim() || state.isTyping;
};

window.setInputText = (text) => {
  state.inputText = text;
  render();
  const input = document.getElementById('chat-input');
  if (input) {
    input.focus();
    input.style.height = 'auto';
    input.style.height = Math.min(input.scrollHeight, 140) + 'px';
  }
};

window.handleKeyDown = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSendMessage();
  }
};

window.handleSendMessage = async () => {
  if (!state.inputText.trim() || !state.activeChatId || state.isTyping) return;

  const text = state.inputText.trim();
  console.log('📤 Sending message:', text);
  state.inputText = '';
  state.isTyping = true;
  render();

  try {
    const currentChat = state.chats.find(c => (c._id || c.id) === state.activeChatId);
    const isFirstMessage = currentChat?.messages?.filter(m => m.sender === 'user').length === 0;

    if (isFirstMessage) {
      const chatName = text.length > 42 ? text.slice(0, 42).trimEnd() + '…' : text;
      await storage.renameChat(state.activeChatId, chatName);
    }

    // Send message to backend (ML service will process it)
    const updatedChat = await storage.addMessageToChat(state.activeChatId, { text, stress: 0, sender: 'user' }, '');
    console.log('✅ Message sent, chat updated:', updatedChat);

    // Refresh chats from backend
    state.chats = await storage.getChats(state.currentUser.id);
    state.activeChatId = updatedChat._id || updatedChat.id;
    
    // Track stress data point
    const userMessages = updatedChat.messages.filter(m => m.role === 'user' || m.sender === 'user');
    const lastUserMsg = userMessages[userMessages.length - 1];
    console.log('📊 User messages:', userMessages);
    console.log('📊 Last user message:', lastUserMsg);
    if (lastUserMsg && lastUserMsg.stress) {
      console.log('📈 Adding stress data point:', lastUserMsg.stress);
      addStressDataPoint(lastUserMsg.stress);
    }
  } catch (error) {
    console.error('❌ Could not send message:', error.message || error);
    // Fallback to local stress detection if backend fails
    const stressScore = stress.detectStress(text);
    console.log('⚠️ Using fallback stress detection, score:', stressScore);
    const botText = stress.generateBotResponse(text, stressScore);
    
    const updatedChat = await storage.addMessageToChat(state.activeChatId, { text, stress: stressScore, sender: 'user' }, botText);
    state.chats = await storage.getChats(state.currentUser.id);
    state.activeChatId = updatedChat._id || updatedChat.id;
    
    // Track stress data point
    console.log('📈 Adding fallback stress data point:', stressScore);
    addStressDataPoint(stressScore);
  }

  state.isTyping = false;
  render();
};

// ─── Formatters ─────────────────────────────────────────────────────────────
function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// ─── Start App ──────────────────────────────────────────────────────────────
try {
  console.log('Initializing StressBot...');
  init();
  console.log('StressBot initialized successfully!');
} catch (error) {
  console.error('Failed to initialize StressBot:', error);
  const app = document.getElementById('app');
  if (app) {
    app.innerHTML = `
      <div class="min-h-screen flex items-center justify-center bg-slate-50">
        <div class="text-center p-8">
          <div class="text-red-600 text-6xl mb-4">⚠️</div>
          <h1 class="text-2xl font-bold text-slate-800 mb-2">Loading Error</h1>
          <p class="text-slate-600 mb-4">Failed to initialize the application</p>
          <p class="text-sm text-slate-500 mb-4">Error: ${error.message}</p>
          <button onclick="location.reload()" class="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Reload Page
          </button>
        </div>
      </div>
    `;
  }
}
