const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');


// SIGNUP
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      role: 'student' // default role
    });

    await user.save();

    res.json({ message: 'Signup successful' });

  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});


// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Wrong password' });
    }

    // 🔥 TOKEN BAN RAHA HAI
    const token = jwt.sign(
      { id: user._id, role: user.role }, // 👈 IMPORTANT
      'secret123',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user
    });

  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;