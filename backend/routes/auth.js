const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { body, validationResult } = require('express-validator');
const { OAuth2Client } = require('google-auth-library');

const router = express.Router();
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const getRole = (user) => (user.role === 'admin' || user.isAdmin ? 'admin' : 'user');
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const signUser = (user) => {
  const role = getRole(user);
  const token = jwt.sign(
    { userId: user._id, email: user.email, role },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  return {
    token,
    user: {
      id: user._id,
      email: user.email,
      role,
      isAdmin: role === 'admin'
    }
  };
};

// Register
router.post('/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 6 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const user = new User({ email, password, authProvider: 'local' });
    await user.save();

    res.status(201).json(signUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (!user.password || user.authProvider === 'google') {
      return res.status(400).json({ message: 'Continue with Google to access this account.' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (getRole(user) === 'admin') {
      return res.status(403).json({ message: 'Use the admin login page' });
    }

    res.json(signUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Google Login/Register for normal users
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ message: 'Google credential is required' });
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).json({ message: 'Google auth is not configured on the server' });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email || !payload?.email_verified) {
      return res.status(400).json({ message: 'Google account email is not verified' });
    }

    const email = normalizeEmail(payload.email);
    let user = await User.findOne({ email });

    if (user && getRole(user) === 'admin') {
      return res.status(403).json({ message: 'Use the admin login page' });
    }

    if (!user) {
      user = await User.create({
        email,
        authProvider: 'google',
        googleId: payload.sub,
      });
    } else {
      user.googleId = user.googleId || payload.sub;
      user.authProvider = 'google';
      await user.save();
    }

    res.json(signUser(user));
  } catch (error) {
    res.status(401).json({ message: 'Google authentication failed' });
  }
});

// Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    if (getRole(user) !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    res.json(signUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;