const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

const { protect } = require('../middleware/authMiddleware');
const User = require('../models/User');

// GET /api/pdf/:filename
router.get('/:filename', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId || req.user._id;
    const filename = req.params.filename;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(401).json({ message: 'Unauthorized user' });
    }

    if (!user.enrolledCourses || user.enrolledCourses.length === 0) {
      return res.status(403).json({ message: 'Not enrolled in any course' });
    }

    const filePath = path.join(__dirname, '..', 'uploads', filename);

    if (!fs.existsSync(filePath)) {
      console.log('❌ PDF file not found:', filePath);
      return res.status(404).json({
        message: 'PDF file not found on server',
        filename,
      });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return res.sendFile(filePath);
  } catch (err) {
    console.log('PDF route error:', err);
    return res.status(500).json({ message: 'PDF server error' });
  }
});

module.exports = router;