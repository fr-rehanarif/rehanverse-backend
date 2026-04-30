const express = require('express');
const router = express.Router();

const LiveClass = require('../models/LiveClass');
const User = require('../models/User');

// ✅ IMPORTANT: agar tera authMiddleware export { protect, adminOnly } karta hai
const { protect, adminOnly } = require('../middleware/authMiddleware');

/*
  ✅ ADMIN: Create live class
  POST /api/live-classes
*/
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { course, title, description, liveUrl, scheduledAt, durationMinutes } = req.body;

    if (!course || !title || !liveUrl || !scheduledAt) {
      return res.status(400).json({
        message: 'Course, title, live link and scheduled time are required',
      });
    }

    const liveClass = await LiveClass.create({
      course,
      title,
      description,
      liveUrl,
      scheduledAt,
      durationMinutes: durationMinutes || 60,
    });

    res.status(201).json({
      message: 'Live class created successfully',
      liveClass,
    });
  } catch (err) {
    console.log('Create live class error:', err);
    res.status(500).json({ message: 'Server error while creating live class' });
  }
});

/*
  ✅ STUDENT/ADMIN: Get live classes by course
  GET /api/live-classes/course/:courseId
*/
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const liveClasses = await LiveClass.find({
      course: req.params.courseId,
    }).sort({ scheduledAt: 1 });

    res.json(liveClasses);
  } catch (err) {
    console.log('Fetch live classes error:', err);
    res.status(500).json({ message: 'Server error while fetching live classes' });
  }
});

/*
  ✅ STUDENT/ADMIN: Secure join link
  GET /api/live-classes/join/:id
*/
router.get('/join/:id', protect, async (req, res) => {
  try {
    const liveClass = await LiveClass.findById(req.params.id);

    if (!liveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    const user = await User.findById(req.user.id || req.user.userId);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isAdmin = user.role === 'admin';

    const isEnrolled = user.enrolledCourses.some(
      (courseId) => courseId.toString() === liveClass.course.toString()
    );

    if (!isAdmin && !isEnrolled) {
      return res.status(403).json({
        message: 'You are not enrolled in this course',
      });
    }

    res.json({
      liveUrl: liveClass.liveUrl,
    });
  } catch (err) {
    console.log('Join live class error:', err);
    res.status(500).json({ message: 'Server error while joining live class' });
  }
});

/*
  ✅ ADMIN: Update live class
  PUT /api/live-classes/:id
*/
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const updatedLiveClass = await LiveClass.findByIdAndUpdate(
      req.params.id,
      req.body,
      { returnDocument: 'after' }
    );

    if (!updatedLiveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    res.json({
      message: 'Live class updated successfully',
      liveClass: updatedLiveClass,
    });
  } catch (err) {
    console.log('Update live class error:', err);
    res.status(500).json({ message: 'Server error while updating live class' });
  }
});

/*
  ✅ ADMIN: Delete live class
  DELETE /api/live-classes/:id
*/
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const deletedLiveClass = await LiveClass.findByIdAndDelete(req.params.id);

    if (!deletedLiveClass) {
      return res.status(404).json({ message: 'Live class not found' });
    }

    res.json({ message: 'Live class deleted successfully' });
  } catch (err) {
    console.log('Delete live class error:', err);
    res.status(500).json({ message: 'Server error while deleting live class' });
  }
});

module.exports = router;