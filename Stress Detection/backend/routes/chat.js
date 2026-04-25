const express = require('express');
const Chat = require('../models/Chat');
const authMiddleware = require('../middleware/authMiddleware');
const { detectStress } = require('../utils/stressModel');

const router = express.Router();
router.use(authMiddleware);

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
    });

    return res.json({ chat });
  } catch (error) {
    return res.status(500).json({ error: 'Could not create chat.' });
  }
});

router.post('/message', async (req, res) => {
  try {
    const { chatId, text, botText } = req.body;
    if (!chatId || !text) {
      return res.status(400).json({ error: 'chatId and text are required.' });
    }

    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }

    const stressScore = detectStress(text);
    chat.messages.push({
      text: text.trim(),
      stress: stressScore,
      role: 'user',
      timestamp: new Date(),
    });

    if (botText) {
      chat.messages.push({
        text: botText.trim(),
        stress: 0,
        role: 'bot',
        timestamp: new Date(),
      });
    }

    const userMessages = chat.messages.filter((message) => message.role === 'user');
    const totalStress = userMessages.reduce((sum, message) => sum + (message.stress || 0), 0);
    chat.avgStress = userMessages.length > 0 ? Math.round(totalStress / userMessages.length) : 0;
    await chat.save();

    return res.json({ chat });
  } catch (error) {
    return res.status(500).json({ error: 'Could not add message.' });
  }
});

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
    return res.status(500).json({ error: 'Could not update chat.' });
  }
});

router.delete('/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOneAndDelete({ _id: chatId, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    return res.json({ message: 'Chat deleted successfully.' });
  } catch (error) {
    return res.status(500).json({ error: 'Could not delete chat.' });
  }
});

router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    if (!userId || userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Access denied.' });
    }

    const chats = await Chat.find({ userId: req.user._id }).sort({ updatedAt: -1 });
    return res.json({ chats });
  } catch (error) {
    return res.status(500).json({ error: 'Could not retrieve chats.' });
  }
});

router.get('/single/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params;
    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) {
      return res.status(404).json({ error: 'Chat not found.' });
    }
    return res.json({ chat });
  } catch (error) {
    return res.status(500).json({ error: 'Could not retrieve chat.' });
  }
});

module.exports = router;
