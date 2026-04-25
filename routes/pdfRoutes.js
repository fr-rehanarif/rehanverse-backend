const express = require('express');
const router = express.Router();
const path = require('path');

const authMiddleware = require('../middleware/authMiddleware');
const User = require('../models/User');

// URL: /api/pdf/:filename
router.get('/:filename', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;

    // user nikaal
    const user = await User.findById(userId);

    if (!user) return res.status(401).json({ message: 'Unauthorized' });

    // agar enrolled nahi hai kisi course me → block
    if (!user.enrolledCourses || user.enrolledCourses.length === 0) {
      return res.status(403).json({ message: 'Not enrolled' });
    }

    const filePath = path.join(__dirname, '../uploads', req.params.filename);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline'); // download nahi, sirf view
    res.setHeader('Cache-Control', 'no-store');

    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ message: 'Error' });
  }
});

module.exports = router;