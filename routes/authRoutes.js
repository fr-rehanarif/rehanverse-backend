const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // Check karo user pehle se hai ya nahi
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered!' });
    }

    // Password encrypt karo
    const hashedPassword = await bcrypt.hash(password, 10);

    // User banao
    const user = new User({ name, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: '✅ Account created successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // User dhundo
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'User not found!' });
    }

    // Password check karo
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Wrong password!' });
    }

    // Token banao
    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});
// Apne aap ko admin banao (sirf ek baar use karna)
router.post('/make-admin', async (req, res) => {
  try {
    const { email, secretKey } = req.body;
    if (secretKey !== 'REHAN_ADMIN_SECRET') {
      return res.status(403).json({ message: 'Wrong secret key!' });
    }
    const user = await User.findOneAndUpdate(
      { email },
      { role: 'admin' },
      { new: true }
    );
    if (!user) return res.status(404).json({ message: 'User not found!' });
    res.json({ message: `✅ ${user.name} is now admin!` });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});


module.exports = router;