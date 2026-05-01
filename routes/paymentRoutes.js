const express = require('express');
const multer = require('multer');
const path = require('path');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Course = require('../models/Course');
const Coupon = require('../models/Coupon');
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

// ✅ Helper: user id safely nikalne ke liye
const getUserId = (req) => {
  return req.user?._id || req.user?.id || req.user?.userId;
};

// ✅ Helper: coupon price calculate karne ke liye
const calculateCouponPrice = (coursePrice, coupon) => {
  const originalPrice = Number(coursePrice || 0);
  let discountAmount = 0;
  let finalPrice = originalPrice;

  if (coupon.discountType === 'free') {
    discountAmount = originalPrice;
    finalPrice = 0;
  }

  if (coupon.discountType === 'percentage') {
    const percentage = Number(coupon.discountValue || 0);
    discountAmount = Math.floor((originalPrice * percentage) / 100);
    finalPrice = originalPrice - discountAmount;
  }

  if (coupon.discountType === 'fixed') {
    discountAmount = Number(coupon.discountValue || 0);
    finalPrice = originalPrice - discountAmount;
  }

  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > originalPrice) discountAmount = originalPrice;
  if (finalPrice < 0) finalPrice = 0;

  return {
    originalPrice,
    discountAmount,
    finalPrice,
    isFreeByCoupon: finalPrice === 0,
  };
};

// ✅ USER: Payment request submit
router.post('/request', protect, upload.single('screenshot'), async (req, res) => {
  try {
    console.log('PAYMENT BODY:', req.body);
    console.log('PAYMENT FILE:', req.file);

    const userId = getUserId(req);

    if (!userId) {
      return res.status(401).json({ message: 'User not authorized!' });
    }

    const { courseId, couponCode } = req.body;

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

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    const alreadyEnrolled = user.enrolledCourses.some(
      (id) => id.toString() === courseId.toString()
    );

    if (alreadyEnrolled) {
      return res.status(400).json({ message: 'Already enrolled in this course!' });
    }

    const existing = await Payment.findOne({
      user: userId,
      course: courseId,
      status: 'pending',
    });

    if (existing) {
      return res.status(400).json({ message: 'Payment request already pending!' });
    }

    let originalPrice = Number(course.price || 39);
    let finalPrice = Number(course.price || 39);
    let discountAmount = 0;
    let cleanCouponCode = '';
    let appliedCoupon = null;

    // ✅ Coupon support for discounted payment
    if (couponCode && String(couponCode).trim() !== '') {
      appliedCoupon = await Coupon.findOne({
        code: String(couponCode).toUpperCase().trim(),
        isActive: true,
      });

      if (!appliedCoupon) {
        return res.status(400).json({ message: 'Invalid coupon code!' });
      }

      if (appliedCoupon.expiresAt && new Date(appliedCoupon.expiresAt) < new Date()) {
        return res.status(400).json({ message: 'Coupon has expired!' });
      }

      if (
        appliedCoupon.usageLimit > 0 &&
        appliedCoupon.usedCount >= appliedCoupon.usageLimit
      ) {
        return res.status(400).json({ message: 'Coupon usage limit reached!' });
      }

      if (
        appliedCoupon.course &&
        appliedCoupon.course.toString() !== courseId.toString()
      ) {
        return res.status(400).json({
          message: 'This coupon is not valid for this course!',
        });
      }

      const priceData = calculateCouponPrice(course.price || 39, appliedCoupon);

      originalPrice = priceData.originalPrice;
      discountAmount = priceData.discountAmount;
      finalPrice = priceData.finalPrice;
      cleanCouponCode = appliedCoupon.code;

      // ✅ Free coupon wale case mein payment screenshot nahi lena
      if (priceData.isFreeByCoupon) {
        return res.status(400).json({
          message: 'This coupon makes course free. Use direct enroll instead!',
          isFreeByCoupon: true,
        });
      }
    }

    // ✅ safe filename
    const fileExt = path.extname(req.file.originalname) || '.png';
    const safeName = req.file.originalname
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9.\-_]/g, '');

    const fileName = `payment-${userId}-${Date.now()}-${safeName || `proof${fileExt}`}`;

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
      user: userId,
      course: courseId,
      screenshot: screenshotUrl,
      amount: finalPrice,
      originalPrice,
      finalPrice,
      discountAmount,
      couponCode: cleanCouponCode,
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

    // ✅ Coupon used count increase only after admin approval
    if (payment.couponCode && String(payment.couponCode).trim() !== '') {
      await Coupon.findOneAndUpdate(
        { code: String(payment.couponCode).toUpperCase().trim() },
        { $inc: { usedCount: 1 } }
      );
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

// ✅ ADMIN: Reject payment + auto notification
router.put('/reject/:id', protect, async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied!' });
    }

    const payment = await Payment.findById(req.params.id);

    if (!payment) {
      return res.status(404).json({ message: 'Payment not found!' });
    }

    if (payment.status === 'rejected') {
      return res.status(400).json({ message: 'Already rejected!' });
    }

    const course = await Course.findById(payment.course).select('title');

    payment.status = 'rejected';
    await payment.save();

    // ✅ AUTO NOTIFICATION: user ko payment rejected ka alert
    await Notification.create({
      title: '❌ Payment Rejected',
      message: course
        ? `Your payment proof for "${course.title}" was rejected. Please upload a clear screenshot again.`
        : 'Your payment proof was rejected. Please upload a clear screenshot again.',
      type: 'payment',
      targetType: 'user',
      userId: payment.user,
      courseId: payment.course,
      createdBy: req.user._id,
    });

    res.json({
      message: '❌ Payment rejected & notification sent!',
    });
  } catch (error) {
    console.error('PAYMENT REJECT ERROR:', error);
    res.status(500).json({ message: 'Server error!' });
  }
});

module.exports = router;