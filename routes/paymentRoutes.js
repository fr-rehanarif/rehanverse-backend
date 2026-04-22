const express = require('express');
const multer = require('multer');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Course = require('../models/Course');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    const uniqueName = Date.now() + '-' + file.originalname.replace(/\s+/g, '-');
    cb(null, uniqueName);
  },
});

const upload = multer({ storage });

router.post('/request', authMiddleware, upload.single('screenshot'), async (req, res) => {
  try {
    const { courseId } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: 'Screenshot required!' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found!' });
    }

    const existing = await Payment.findOne({
      user: req.user.id,
      course: courseId,
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'Payment request already pending!' });
    }

    const payment = new Payment({
      user: req.user.id,
      course: courseId,
      screenshot: req.file.path,
      amount: 39,
      status: 'pending',
    });

    await payment.save();

    res.status(201).json({ message: 'Payment request submitted successfully!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

router.get('/all', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payments = await Payment.find()
      .populate('user', 'name email')
      .populate('course', 'title')
      .sort({ createdAt: -1 });

    res.json(payments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

router.put('/approve/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment request not found!' });
    }

    if (payment.status === 'approved') {
      return res.status(400).json({ message: 'Already approved!' });
    }

    payment.status = 'approved';
    await payment.save();

    const user = await User.findById(payment.user);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    if (!user.enrolledCourses.includes(payment.course)) {
      user.enrolledCourses.push(payment.course);
      await user.save();
    }

    res.json({ message: 'Payment approved and user enrolled!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

router.put('/reject/:id', authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment request not found!' });
    }

    payment.status = 'rejected';
    await payment.save();

    res.json({ message: 'Payment rejected!' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error!' });
  }
});

module.exports = router;