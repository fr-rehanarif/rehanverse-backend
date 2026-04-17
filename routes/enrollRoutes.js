const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

// Course mein enroll karo
router.post('/:courseId', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    const course = await Course.findById(req.params.courseId);

    if (!course) return res.status(404).json({ message: 'Course not found!' });

    // Pehle se enrolled hai?
    if (user.enrolledCourses.includes(req.params.courseId)) {
      return res.status(400).json({ message: 'Already enrolled!' });
    }

    // Paid course check
    if (!course.isFree && course.price > 0) {
      return res.status(402).json({ message: 'PAYMENT_REQUIRED', price: course.price });
    }

    // Enroll karo
    user.enrolledCourses.push(req.params.courseId);
    await user.save();

    res.json({ message: '✅ Enrolled successfully!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Meri enrolled courses
router.get('/my/courses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).populate('enrolledCourses');
    res.json(user.enrolledCourses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;