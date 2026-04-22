const express = require('express');
const router = express.Router();
const User = require('../models/User');
const bcrypt = require('bcryptjs');
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

// Apni profile dekho
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId)
      .select('-password -__v')
      .populate('enrolledCourses', 'title thumbnail');
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Profile update karo
router.put('/me', protect, async (req, res) => {
  try {
    const { name, phone, bio, photo, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.userId);

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (bio !== undefined) user.bio = bio;
    if (photo !== undefined) user.photo = photo;

    if (currentPassword && newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) return res.status(400).json({ message: '❌ Current password galat hai!' });
      user.password = await bcrypt.hash(newPassword, 10);
    }

    await user.save();
    res.json({
      message: '✅ Profile updated!',
      user: { id: user._id, name: user.name, email: user.email, role: user.role, phone: user.phone, bio: user.bio, photo: user.photo }
    });
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