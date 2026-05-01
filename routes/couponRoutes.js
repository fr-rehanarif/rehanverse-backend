const express = require('express');
const router = express.Router();

const Coupon = require('../models/Coupon');
const Course = require('../models/Course');
const User = require('../models/User');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ Helper: user id safely nikalne ke liye
const getUserId = (req) => {
  return req.user?._id || req.user?.id || req.user?.userId;
};

// ✅ Helper: coupon se final price calculate
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

// ✅ Helper: coupon validation
const validateCouponForCourse = async ({ code, couponId, courseId }) => {
  const course = await Course.findById(courseId);

  if (!course) {
    return {
      ok: false,
      status: 404,
      message: 'Course not found',
    };
  }

  let coupon = null;

  if (couponId) {
    coupon = await Coupon.findById(couponId);
  } else if (code) {
    coupon = await Coupon.findOne({
      code: String(code).toUpperCase().trim(),
    });
  }

  if (!coupon) {
    return {
      ok: false,
      status: 400,
      message: 'Invalid coupon code',
    };
  }

  if (!coupon.isActive) {
    return {
      ok: false,
      status: 400,
      message: 'Coupon is not active',
    };
  }

  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
    return {
      ok: false,
      status: 400,
      message: 'Coupon has expired',
    };
  }

  if (coupon.usageLimit > 0 && coupon.usedCount >= coupon.usageLimit) {
    return {
      ok: false,
      status: 400,
      message: 'Coupon usage limit reached',
    };
  }

  if (coupon.course && coupon.course.toString() !== courseId.toString()) {
    return {
      ok: false,
      status: 400,
      message: 'This coupon is not valid for this course',
    };
  }

  const priceData = calculateCouponPrice(course.price, coupon);

  return {
    ok: true,
    course,
    coupon,
    priceData,
  };
};

// ✅ Helper: discount value validation
const validateDiscountFields = (discountType, discountValue) => {
  if (!['free', 'percentage', 'fixed'].includes(discountType)) {
    return {
      ok: false,
      message: 'Invalid discount type',
    };
  }

  if (discountType === 'percentage') {
    const value = Number(discountValue || 0);

    if (value <= 0 || value > 100) {
      return {
        ok: false,
        message: 'Percentage discount must be between 1 and 100',
      };
    }
  }

  if (discountType === 'fixed') {
    const value = Number(discountValue || 0);

    if (value <= 0) {
      return {
        ok: false,
        message: 'Fixed discount must be greater than 0',
      };
    }
  }

  return {
    ok: true,
  };
};

// =====================================================
// ✅ ADMIN: CREATE COUPON
// POST /api/coupon/create
// =====================================================
router.post('/create', protect, adminOnly, async (req, res) => {
  try {
    const userId = getUserId(req);

    const {
      code,
      discountType,
      discountValue,
      course,
      usageLimit,
      expiresAt,
      isActive,
    } = req.body;

    if (!code || !discountType) {
      return res.status(400).json({
        message: 'Coupon code and discount type are required',
      });
    }

    const validation = validateDiscountFields(discountType, discountValue);

    if (!validation.ok) {
      return res.status(400).json({
        message: validation.message,
      });
    }

    const cleanCode = String(code).toUpperCase().trim();

    const coupon = await Coupon.create({
      code: cleanCode,
      discountType,
      discountValue: discountType === 'free' ? 0 : Number(discountValue || 0),
      course: course || null,
      usageLimit: Number(usageLimit || 0),
      expiresAt: expiresAt || null,
      isActive: isActive !== undefined ? isActive : true,
      createdBy: userId || null,
    });

    res.status(201).json({
      message: 'Coupon created successfully',
      coupon,
    });
  } catch (err) {
    console.log('Create coupon error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Coupon code already exists',
      });
    }

    res.status(500).json({
      message: 'Server error while creating coupon',
    });
  }
});

// =====================================================
// ✅ ADMIN: GET ALL COUPONS
// GET /api/coupon/all
// =====================================================
router.get('/all', protect, adminOnly, async (req, res) => {
  try {
    const coupons = await Coupon.find()
      .populate('course', 'title price isFree')
      .populate('createdBy', 'name email')
      .sort({ createdAt: -1 });

    res.json(coupons);
  } catch (err) {
    console.log('Get coupons error:', err);

    res.status(500).json({
      message: 'Server error while fetching coupons',
    });
  }
});

// =====================================================
// ✅ ADMIN: UPDATE COUPON
// PUT /api/coupon/:id
// =====================================================
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const {
      code,
      discountType,
      discountValue,
      course,
      usageLimit,
      expiresAt,
      isActive,
    } = req.body;

    const updateData = {};

    if (code !== undefined) {
      updateData.code = String(code).toUpperCase().trim();
    }

    if (discountType !== undefined) {
      const validation = validateDiscountFields(
        discountType,
        discountValue !== undefined ? discountValue : 1
      );

      if (!validation.ok) {
        return res.status(400).json({
          message: validation.message,
        });
      }

      updateData.discountType = discountType;

      if (discountType === 'free') {
        updateData.discountValue = 0;
      }
    }

    if (discountValue !== undefined) {
      updateData.discountValue = Number(discountValue || 0);
    }

    if (course !== undefined) {
      updateData.course = course || null;
    }

    if (usageLimit !== undefined) {
      updateData.usageLimit = Number(usageLimit || 0);
    }

    if (expiresAt !== undefined) {
      updateData.expiresAt = expiresAt || null;
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const coupon = await Coupon.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });

    if (!coupon) {
      return res.status(404).json({
        message: 'Coupon not found',
      });
    }

    res.json({
      message: 'Coupon updated successfully',
      coupon,
    });
  } catch (err) {
    console.log('Update coupon error:', err);

    if (err.code === 11000) {
      return res.status(400).json({
        message: 'Coupon code already exists',
      });
    }

    res.status(500).json({
      message: 'Server error while updating coupon',
    });
  }
});

// =====================================================
// ✅ ADMIN: DELETE COUPON
// DELETE /api/coupon/:id
// =====================================================
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const coupon = await Coupon.findByIdAndDelete(req.params.id);

    if (!coupon) {
      return res.status(404).json({
        message: 'Coupon not found',
      });
    }

    res.json({
      message: 'Coupon deleted successfully',
    });
  } catch (err) {
    console.log('Delete coupon error:', err);

    res.status(500).json({
      message: 'Server error while deleting coupon',
    });
  }
});

// =====================================================
// ✅ USER: APPLY COUPON
// POST /api/coupon/apply
// =====================================================
router.post('/apply', protect, async (req, res) => {
  try {
    const { code, courseId } = req.body;

    if (!code || !courseId) {
      return res.status(400).json({
        message: 'Coupon code and course ID are required',
      });
    }

    const result = await validateCouponForCourse({
      code,
      courseId,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    const { coupon, priceData } = result;

    res.json({
      message: 'Coupon applied successfully',
      coupon: {
        id: coupon._id,
        code: coupon.code,
        discountType: coupon.discountType,
        discountValue: coupon.discountValue,
      },
      originalPrice: priceData.originalPrice,
      discountAmount: priceData.discountAmount,
      finalPrice: priceData.finalPrice,
      isFreeByCoupon: priceData.isFreeByCoupon,
    });
  } catch (err) {
    console.log('Apply coupon error:', err);

    res.status(500).json({
      message: 'Server error while applying coupon',
    });
  }
});

// =====================================================
// ✅ USER: DIRECT ENROLL IF COUPON MAKES COURSE FREE
// POST /api/coupon/enroll-free
// =====================================================
router.post('/enroll-free', protect, async (req, res) => {
  try {
    const userId = getUserId(req);
    const { courseId, couponId } = req.body;

    if (!userId) {
      return res.status(401).json({
        message: 'User not authorized',
      });
    }

    if (!courseId || !couponId) {
      return res.status(400).json({
        message: 'Course ID and Coupon ID are required',
      });
    }

    const result = await validateCouponForCourse({
      couponId,
      courseId,
    });

    if (!result.ok) {
      return res.status(result.status).json({
        message: result.message,
      });
    }

    const { coupon, priceData } = result;

    if (!priceData.isFreeByCoupon) {
      return res.status(400).json({
        message: 'This coupon does not make the course free',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found',
      });
    }

    const alreadyEnrolled = user.enrolledCourses.some(
      (id) => id.toString() === courseId.toString()
    );

    if (alreadyEnrolled) {
      return res.status(400).json({
        message: 'Already enrolled in this course',
      });
    }

    user.enrolledCourses.push(courseId);
    await user.save();

    coupon.usedCount += 1;
    await coupon.save();

    res.json({
      message: 'Enrolled successfully using coupon',
      courseId,
      couponCode: coupon.code,
    });
  } catch (err) {
    console.log('Enroll free coupon error:', err);

    res.status(500).json({
      message: 'Server error while enrolling with coupon',
    });
  }
});

module.exports = router;