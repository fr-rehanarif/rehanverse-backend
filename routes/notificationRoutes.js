const express = require('express');
const router = express.Router();

const Notification = require('../models/Notification');
const User = require('../models/User');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ ADMIN: CREATE NOTIFICATION
router.post('/create', protect, adminOnly, async (req, res) => {
  try {
    const {
      title,
      message,
      type,
      targetType,
      courseId,
      userId,
    } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        message: 'Title and message are required',
      });
    }

    const notification = await Notification.create({
      title,
      message,
      type: type || 'general',
      targetType: targetType || 'all',
      courseId: courseId || null,
      userId: userId || null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: 'Notification created successfully',
      notification,
    });
  } catch (err) {
    console.log('Create notification error:', err);
    res.status(500).json({
      message: 'Server error while creating notification',
    });
  }
});

// ✅ USER: GET MY NOTIFICATIONS
router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('enrolledCourses');

    const enrolledCourseIds = user.enrolledCourses || [];

    const notifications = await Notification.find({
      $or: [
        { targetType: 'all' },
        { targetType: 'user', userId: userId },
        { targetType: 'course', courseId: { $in: enrolledCourseIds } },
      ],
    })
      .sort({ createdAt: -1 })
      .limit(50);

    const formattedNotifications = notifications.map((n) => ({
      _id: n._id,
      title: n.title,
      message: n.message,
      type: n.type,
      targetType: n.targetType,
      courseId: n.courseId,
      userId: n.userId,
      createdAt: n.createdAt,
      isRead: n.readBy.some(
        (readUserId) => readUserId.toString() === userId.toString()
      ),
    }));

    res.json(formattedNotifications);
  } catch (err) {
    console.log('Fetch my notifications error:', err);
    res.status(500).json({
      message: 'Server error while fetching notifications',
    });
  }
});

// ✅ USER: MARK SINGLE NOTIFICATION AS READ
router.put('/read/:id', protect, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found',
      });
    }

    const alreadyRead = notification.readBy.some(
      (readUserId) => readUserId.toString() === req.user._id.toString()
    );

    if (!alreadyRead) {
      notification.readBy.push(req.user._id);
      await notification.save();
    }

    res.json({
      message: 'Notification marked as read',
      notification,
    });
  } catch (err) {
    console.log('Mark notification read error:', err);
    res.status(500).json({
      message: 'Server error while marking notification as read',
    });
  }
});

// ✅ USER: MARK ALL MY NOTIFICATIONS AS READ
router.put('/read-all', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    const user = await User.findById(userId).select('enrolledCourses');
    const enrolledCourseIds = user.enrolledCourses || [];

    await Notification.updateMany(
      {
        $or: [
          { targetType: 'all' },
          { targetType: 'user', userId: userId },
          { targetType: 'course', courseId: { $in: enrolledCourseIds } },
        ],
        readBy: { $ne: userId },
      },
      {
        $addToSet: { readBy: userId },
      }
    );

    res.json({
      message: 'All notifications marked as read',
    });
  } catch (err) {
    console.log('Mark all notifications read error:', err);
    res.status(500).json({
      message: 'Server error while marking all notifications as read',
    });
  }
});

// ✅ ADMIN: GET ALL NOTIFICATIONS
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const notifications = await Notification.find()
      .populate('courseId', 'title')
      .populate('userId', 'name email')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(notifications);
  } catch (err) {
    console.log('Fetch all notifications error:', err);
    res.status(500).json({
      message: 'Server error while fetching all notifications',
    });
  }
});

// ✅ ADMIN: DELETE NOTIFICATION
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);

    if (!notification) {
      return res.status(404).json({
        message: 'Notification not found',
      });
    }

    await notification.deleteOne();

    res.json({
      message: 'Notification deleted successfully',
    });
  } catch (err) {
    console.log('Delete notification error:', err);
    res.status(500).json({
      message: 'Server error while deleting notification',
    });
  }
});

module.exports = router;