const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Coupon = require('../models/Coupon');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ Helper: generate referral code for old users
const generateUserReferralCode = (name = 'RV') => {
  const namePart = String(name || 'RV')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase();

  const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

  return `${namePart || 'RV'}${randomPart}`;
};

// ✅ Helper: ensure unique referral code
const createUniqueReferralCode = async (name) => {
  let code = generateUserReferralCode(name);
  let exists = await User.findOne({ referralCode: code });

  while (exists) {
    code = generateUserReferralCode(name);
    exists = await User.findOne({ referralCode: code });
  }

  return code;
};

// ✅ Helper: old users ke liye missing referralCode fix
const ensureReferralCode = async (user) => {
  if (!user.referralCode) {
    user.referralCode = await createUniqueReferralCode(user.name);
    await user.save();
  }

  return user;
};

// ✅ GET LOGGED-IN USER PROFILE DASHBOARD
// GET /api/users/me
router.get('/me', protect, async (req, res) => {
  try {
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    // ✅ Old users ke liye referral code auto-generate
    await ensureReferralCode(user);

    user = await User.findById(req.user.id)
      .select('-password')
      .populate('enrolledCourses', 'title description thumbnail price isFree category level duration')
      .populate('completedCourses', 'title description thumbnail category level duration')
      .populate('certificates.course', 'title thumbnail category')
      .populate('referredBy', 'name email referralCode')
      .populate('referralRewards.referredUser', 'name email createdAt');

    const rewardCoupons = await Coupon.find({
      referralRewardFor: req.user.id,
      purpose: 'referral',
    })
      .sort({ createdAt: -1 })
      .populate('referredUser', 'name email createdAt')
      .select('code discountType discountValue usedCount usageLimit isActive referredUser createdAt');

    res.json({
      id: user._id,
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone || '',
      bio: user.bio || '',
      photo: user.photo || '',

      enrolledCourses: user.enrolledCourses || [],
      completedCourses: user.completedCourses || [],
      certificates: user.certificates || [],

      referralCode: user.referralCode || '',
      referredBy: user.referredBy || null,
      referralCount: user.referralCount || 0,
      referralRewards: user.referralRewards || [],
      rewardCoupons,

      accountCreatedAt: user.createdAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,

      stats: {
        totalEnrolledCourses: user.enrolledCourses?.length || 0,
        totalCompletedCourses: user.completedCourses?.length || 0,
        totalCertificates: user.certificates?.length || 0,
        totalReferrals: user.referralCount || 0,
        totalRewardCoupons: rewardCoupons.length || 0,
      },
    });
  } catch (err) {
    console.log('Get me error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ UPDATE LOGGED-IN USER PROFILE
// PUT /api/users/me
router.put('/me', protect, async (req, res) => {
  try {
    const { name, phone, bio, photo } = req.body;

    const updates = {
      name: String(name || '').trim(),
      phone: String(phone || '').trim(),
      bio: String(bio || '').trim(),
      photo: String(photo || '').trim(),
    };

    if (!updates.name) {
      return res.status(400).json({ message: 'Name required hai!' });
    }

    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    user.name = updates.name;
    user.phone = updates.phone;
    user.bio = updates.bio;
    user.photo = updates.photo;

    await ensureReferralCode(user);
    await user.save();

    const updatedUser = await User.findById(req.user.id)
      .select('-password')
      .populate('enrolledCourses', 'title description thumbnail price isFree category level duration')
      .populate('completedCourses', 'title description thumbnail category level duration')
      .populate('certificates.course', 'title thumbnail category')
      .populate('referredBy', 'name email referralCode')
      .populate('referralRewards.referredUser', 'name email createdAt');

    res.json({
      message: '✅ Profile updated successfully!',
      user: updatedUser,
    });
  } catch (err) {
    console.log('Update me error:', err);
    res.status(500).json({ message: 'Profile update failed' });
  }
});

// ✅ GET MY CERTIFICATES
// GET /api/users/me/certificates
router.get('/me/certificates', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('name email certificates')
      .populate('certificates.course', 'title thumbnail category level duration');

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    res.json({
      certificates: user.certificates || [],
    });
  } catch (err) {
    console.log('My certificates error:', err);
    res.status(500).json({ message: 'Certificates fetch failed' });
  }
});

// ✅ GET MY REFERRAL DASHBOARD
// GET /api/users/me/referrals
router.get('/me/referrals', protect, async (req, res) => {
  try {
    let user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: 'User not found!' });
    }

    await ensureReferralCode(user);

    user = await User.findById(req.user.id)
      .select('name email referralCode referralCount referralRewards referredBy createdAt')
      .populate('referralRewards.referredUser', 'name email createdAt')
      .populate('referredBy', 'name email referralCode');

    const rewardCoupons = await Coupon.find({
      referralRewardFor: req.user.id,
      purpose: 'referral',
    })
      .sort({ createdAt: -1 })
      .populate('referredUser', 'name email createdAt')
      .select('code discountType discountValue usedCount usageLimit isActive referredUser createdAt');

    res.json({
      referralCode: user.referralCode,
      referralCount: user.referralCount || 0,
      referredBy: user.referredBy || null,
      referralRewards: user.referralRewards || [],
      rewardCoupons,
      stats: {
        totalReferrals: user.referralCount || 0,
        totalRewards: user.referralRewards?.length || 0,
        totalCoupons: rewardCoupons.length || 0,
      },
    });
  } catch (err) {
    console.log('My referrals error:', err);
    res.status(500).json({ message: 'Referral data fetch failed' });
  }
});

// ✅ GET ALL USERS - ADMIN ONLY
// GET /api/users
router.get('/', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .populate('enrolledCourses', 'title thumbnail price isFree')
      .populate('completedCourses', 'title thumbnail')
      .populate('certificates.course', 'title thumbnail')
      .populate('referredBy', 'name email referralCode')
      .populate('referralRewards.referredUser', 'name email createdAt')
      .sort({ createdAt: -1 });

    res.json(users);
  } catch (err) {
    console.log('Users fetch error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ ADMIN REFERRAL STATS
// GET /api/users/admin/referrals
router.get('/admin/referrals', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find()
      .select('name email photo referralCode referralCount referralRewards referredBy createdAt')
      .populate('referredBy', 'name email referralCode')
      .populate('referralRewards.referredUser', 'name email createdAt')
      .sort({ referralCount: -1, createdAt: -1 });

    const referralCoupons = await Coupon.find({ purpose: 'referral' })
      .sort({ createdAt: -1 })
      .populate('referralRewardFor', 'name email referralCode')
      .populate('referredUser', 'name email createdAt');

    const totalReferrals = users.reduce(
      (sum, user) => sum + (user.referralCount || 0),
      0
    );

    const topReferrers = users
      .filter((user) => (user.referralCount || 0) > 0)
      .slice(0, 10);

    res.json({
      totalUsers: users.length,
      totalReferrals,
      totalReferralCoupons: referralCoupons.length,
      topReferrers,
      users,
      referralCoupons,
    });
  } catch (err) {
    console.log('Admin referral stats error:', err);
    res.status(500).json({ message: 'Referral stats fetch failed' });
  }
});

// ✅ DELETE USER - ADMIN ONLY
// DELETE /api/users/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    if (String(req.user.id) === String(req.params.id)) {
      return res.status(400).json({
        message: 'Apna khud ka admin account delete nahi kar sakte!',
      });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.log('Delete user error:', err);
    res.status(500).json({ message: 'Delete failed' });
  }
});

module.exports = router;