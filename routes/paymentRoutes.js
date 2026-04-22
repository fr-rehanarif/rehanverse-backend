const express = require('express');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Payment request submit karo
router.post('/request', protect, async (req, res) => {
  try {
    const { courseId, screenshotUrl } = req.body;

    if (!screenshotUrl) {
      return res.status(400).json({ message: 'Screenshot zaroori hai!' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found!' });
    }

    const existing = await Payment.findOne({
      user: req.user.userId,
      course: courseId,
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'Payment request already pending!' });
    }

    const payment = new Payment({
      user: req.user.userId,
      course: courseId,
      screenshot: screenshotUrl,
      amount: course.price || 39,
      status: 'pending',
    });

    await payment.save();
    res.status(201).json({ message: '✅ Payment request submitted!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// Saari payments dekho (admin only)
router.get('/all', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payments = await Payment.find()
      .populate('user', 'name email photo')
      .populate('course', 'title price')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// Payment approve karo
router.put('/approve/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found!' });
    }

    if (payment.status === 'approved') {
      return res.status(400).json({ message: 'Already approved!' });
    }

    payment.status = 'approved';
    await payment.save();

    const user = await User.findById(payment.user);
    if (user && !user.enrolledCourses.includes(payment.course)) {
      user.enrolledCourses.push(payment.course);
      await user.save();
    }

    res.json({ message: '✅ Payment approved & user enrolled!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// Payment reject karo
router.put('/reject/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment not found!' });
    }

    payment.status = 'rejected';
    await payment.save();

    res.json({ message: '❌ Payment rejected!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

module.exports = router;