const express = require('express');
const multer = require('multer');
const path = require('path');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Course = require('../models/Course');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// ✅ Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Memory storage: file pehle RAM me aayegi, phir Supabase me upload hogi
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: function (req, file, cb) {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, JPEG, WEBP images allowed!'), false);
    }

    cb(null, true);
  },
});

// ✅ USER: Payment request submit
router.post('/request', protect, upload.single('screenshot'), async (req, res) => {
  try {
    console.log('PAYMENT BODY:', req.body);
    console.log('PAYMENT FILE:', req.file);

    const { courseId } = req.body;

    if (!courseId) {
      return res.status(400).json({ message: 'Course ID zaroori hai!' });
    }

    if (!req.file) {
      return res.status(400).json({ message: 'Screenshot zaroori hai!' });
    }

    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: 'Course not found!' });
    }

    const existing = await Payment.findOne({
      user: req.user._id,
      course: courseId,
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'Payment request already pending!' });
    }

    // ✅ safe filename
    const fileExt = path.extname(req.file.originalname) || '.png';
    const safeName = req.file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.\-_]/g, '');

    const fileName = `payment-${req.user._id}-${Date.now()}-${safeName || `proof${fileExt}`}`;

    // ✅ Upload to Supabase bucket
    const { data, error } = await supabase.storage
      .from('payment-screenshots')
      .upload(fileName, req.file.buffer, {
        contentType: req.file.mimetype,
        upsert: false,
      });

    if (error) {
      console.error('SUPABASE PAYMENT UPLOAD ERROR:', error);
      return res.status(500).json({
        message: 'Screenshot Supabase upload failed!',
        error: error.message,
      });
    }

    // ✅ Public URL
    const { data: publicUrlData } = supabase.storage
      .from('payment-screenshots')
      .getPublicUrl(data.path);

    const screenshotUrl = publicUrlData.publicUrl;

    const payment = new Payment({
      user: req.user._id,
      course: courseId,
      screenshot: screenshotUrl,
      amount: course.price || 39,
      status: 'pending',
    });

    await payment.save();

    res.status(201).json({
      message: '✅ Payment request submitted!',
      payment,
    });
  } catch (error) {
    console.error('PAYMENT REQUEST ERROR:', error);
    res.status(500).json({ message: error.message || 'Server error!' });
  }
});

// ✅ ADMIN: Get all payments
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
    console.error('PAYMENT ALL ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// ✅ ADMIN: Approve payment + auto notification
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

    const course = await Course.findById(payment.course).select('title price');
    const user = await User.findById(payment.user);

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    payment.status = 'approved';
    await payment.save();

    const alreadyEnrolled = user.enrolledCourses.some(
      (courseId) => courseId.toString() === payment.course.toString()
    );

    if (!alreadyEnrolled) {
      user.enrolledCourses.push(payment.course);
      await user.save();
    }

    // ✅ AUTO NOTIFICATION: user ko payment approved ka alert
    await Notification.create({
      title: '✅ Payment Approved',
      message: course
        ? `Your payment for "${course.title}" has been approved. Course unlocked successfully!`
        : 'Your payment has been approved. Course unlocked successfully!',
      type: 'payment',
      targetType: 'user',
      userId: payment.user,
      courseId: payment.course,
      createdBy: req.user._id,
    });

    res.json({
      message: '✅ Payment approved, user enrolled & notification sent!',
    });
  } catch (error) {
    console.error('PAYMENT APPROVE ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

// ✅ ADMIN: Reject payment
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
    console.error('PAYMENT REJECT ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

module.exports = router;