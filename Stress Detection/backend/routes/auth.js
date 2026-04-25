const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const { generateOTP, saveOtp, verifyOtp } = require('../utils/otp');
const { sendOTP } = require('../utils/mailer');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'stressbot_secret_key';
const JWT_EXPIRATION = '7d';


const pendingSignups = new Map();
const SIGNUP_OTP_EXPIRATION_MS = 10 * 60 * 1000;

function savePendingSignup(email, data) {
  const expiresAt = Date.now() + SIGNUP_OTP_EXPIRATION_MS;
  pendingSignups.set(email, { ...data, expiresAt });
}

function getPendingSignup(email) {
  const record = pendingSignups.get(email);
  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    pendingSignups.delete(email);
    return null;
  }
  return record;
}

function removePendingSignup(email) {
  pendingSignups.delete(email);
}

function createToken(user) {
  return jwt.sign({ userId: user._id, email: user.email }, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}


router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;
    if (!name || !email || !password || !confirmPassword) {
      return res.status(400).json({ error: 'All fields are required.' });
    }
    if (password !== confirmPassword) {
      return res.status(400).json({ error: 'Passwords do not match.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const existingPending = getPendingSignup(normalizedEmail);
    const hashedPassword = await bcrypt.hash(password, 10);
    savePendingSignup(normalizedEmail, {
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
    });

    const otp = generateOTP();
    saveOtp(normalizedEmail, otp);

    const sendResult = await sendOTP(normalizedEmail, otp);
    const sentByEmail = sendResult.sent;
    const response = {
      message: existingPending
        ? sentByEmail
          ? 'A new OTP was sent to your email. Verify it to complete signup.'
          : 'A new OTP was generated successfully.'
        : sentByEmail
          ? 'OTP sent to your email. Verify it to complete signup.'
          : 'OTP generated successfully.',
      debug: !sentByEmail,
      emailError: sendResult.error || null,
    };

    if (!sentByEmail) {
      response.otp = otp;
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Unable to create signup verification.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user || !user.password) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password.' });
    }

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return res.status(500).json({ error: 'Login failed.' });
  }
});

router.post('/send-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: 'Email is not registered. Please sign up first.' });
    }

    const otp = generateOTP();
    saveOtp(normalizedEmail, otp);

    const sendResult = await sendOTP(normalizedEmail, otp);
    const sentByEmail = sendResult.sent;
    const response = {
      message: sentByEmail ? 'OTP sent to your email.' : 'OTP generated successfully.',
      debug: !sentByEmail,
      emailError: sendResult.error || null,
    };

    if (!sentByEmail) {
      response.otp = otp;
    }

    return res.json(response);
  } catch (error) {
    return res.status(500).json({ error: 'Could not generate OTP.' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isValidOtp = verifyOtp(normalizedEmail, otp.toString());
    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(400).json({ error: 'No account found for this email.' });
    }

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return res.status(500).json({ error: 'OTP verification failed.' });
  }
});

router.post('/verify-signup-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const isValidOtp = verifyOtp(normalizedEmail, otp.toString());
    if (!isValidOtp) {
      return res.status(400).json({ error: 'Invalid or expired OTP.' });
    }

    const pending = getPendingSignup(normalizedEmail);
    if (!pending) {
      return res.status(400).json({ error: 'No pending signup found. Please start signup again.' });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      removePendingSignup(normalizedEmail);
      return res.status(400).json({ error: 'Email is already registered.' });
    }

    const user = await User.create({
      name: pending.name,
      email: normalizedEmail,
      password: pending.password,
    });

    removePendingSignup(normalizedEmail);

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return res.status(500).json({ error: 'Signup verification failed.' });
  }
});

router.post('/google', async (req, res) => {
  try {
    const { email, name } = req.body;
    if (!email || !name) {
      return res.status(400).json({ error: 'Email and name are required for Google login.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: await bcrypt.hash(Math.random().toString(36), 10),
      });
    }

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, name: user.name, email: user.email, phone: user.phone } });
  } catch (error) {
    return res.status(500).json({ error: 'Google login failed.' });
  }
});

module.exports = router;
