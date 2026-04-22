const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Saare users dekho (admin only)
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password -__v')
      .populate('enrolledCourses', 'title');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// User delete karo (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found!' });
    if (user.role === 'admin') return res.status(403).json({ message: 'Admin ko delete nahi kar sakte!' });
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ User deleted!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;