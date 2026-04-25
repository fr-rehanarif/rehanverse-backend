const express = require('express');
const router = express.Router();
const path = require('path');

const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// GET /api/pdf/:filename
router.get('/:filename', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!user.enrolledCourses || user.enrolledCourses.length === 0) {
      return res.status(403).json({ message: 'Not enrolled' });
    }

    const filePath = path.join(__dirname, '../uploads', req.params.filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store');

    res.sendFile(filePath);
  } catch (err) {
    console.log('PDF route error:', err);
    res.status(500).json({ message: 'PDF server error' });
  }
});

module.exports = router;