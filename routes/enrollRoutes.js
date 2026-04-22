const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

// User ke enrolled courses lao
router.get('/my/courses', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('enrolledCourses');

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    res.json(user.enrolledCourses || []);
  } catch (error) {
    console.error('MY COURSES ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// Course enroll karo
router.post('/:courseId', protect, async (req, res) => {
  try {
    const { courseId } = req.params;

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found!' });
    }

    const alreadyEnrolled = user.enrolledCourses.some(
      (id) => id.toString() === courseId
    );

    if (alreadyEnrolled) {
      return res.status(400).json({ message: 'Already enrolled!' });
    }

    user.enrolledCourses.push(courseId);
    await user.save();

    res.json({ message: '✅ Enrolled successfully!' });
  } catch (error) {
    console.error('ENROLL ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

module.exports = router;