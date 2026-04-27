const express = require('express');
const router = express.Router();
const Activity = require('../models/Activity');
const { protect } = require('../middleware/authMiddleware');

router.post('/log', protect, async (req, res) => {
  try {
    const { action, page } = req.body;

    const ip =
      req.headers['x-forwarded-for']?.split(',')[0] ||
      req.socket.remoteAddress ||
      '';

    const device = req.headers['user-agent'] || '';

    const activity = await Activity.create({
      user: req.user.id,
      action,
      page,
      ip,
      device,
    });

    res.status(201).json(activity);
  } catch (err) {
    console.log('Activity log error:', err);
    res.status(500).json({ message: 'Activity log failed' });
  }
});

router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin only' });
    }

    const activities = await Activity.find()
      .populate('user', 'name email role')
      .sort({ createdAt: -1 });

    res.json(activities);
  } catch (err) {
    console.log('Fetch activities error:', err);
    res.status(500).json({ message: 'Failed to fetch activities' });
  }
});

module.exports = router;