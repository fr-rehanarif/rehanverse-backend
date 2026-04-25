const express = require('express');
const router = express.Router();
const User = require('../models/User');

const { protect } = require('../middleware/authMiddleware');

// ✅ GET ALL USERS
router.get('/', protect, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('enrolledCourses', 'title');

    res.json(users);
  } catch (err) {
    console.log('Users fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ DELETE USER
router.delete('/:id', protect, async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.log('Delete user error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;