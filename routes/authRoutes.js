const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const User = require('../models/User');
const Otp = require('../models/Otp');

const { sendWelcomeEmail, sendAdminNotification } = require('../utils/email');
const sendOtpEmail = require('../utils/sendOtpEmail');

// ✅ Helper: generate 6 digit OTP
const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// ✅ Helper: normalize email
const normalizeEmail = (email = '') => {
  return email.trim().toLowerCase();
};

// ✅ Helper: create hashed OTP
const hashOtp = async (otp) => {
  return bcrypt.hash(otp, 10);
};

// ✅ Helper: JWT token
const createToken = (user) => {
  return jwt.sign(
    {
      userId: user._id,
      role: user.role,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// ✅ STEP 1: SIGNUP - Send OTP
// POST /api/auth/signup
router.post('/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    const cleanName = String(name || '').trim();
    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');

    if (!cleanName || !cleanEmail || !cleanPassword) {
      return res.status(400).json({
        message: 'Name, email aur password zaroori hai!',
      });
    }

    if (cleanPassword.length < 6) {
      return res.status(400).json({
        message: 'Password at least 6 characters ka hona chahiye!',
      });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      return res.status(400).json({
        message: 'Email already registered!',
      });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);
    const passwordHash = await bcrypt.hash(cleanPassword, 10);

    // Purana signup OTP delete karo
    await Otp.deleteMany({
      email: cleanEmail,
      purpose: 'signup',
    });

    await Otp.create({
      email: cleanEmail,
      otpHash,
      purpose: 'signup',
      name: cleanName,
      passwordHash,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await sendOtpEmail(cleanEmail, otp, 'signup');

    res.status(200).json({
      message: '✅ OTP sent to your email. Please verify to create account.',
      email: cleanEmail,
      step: 'verify-signup-otp',
    });
  } catch (error) {
    console.error('SIGNUP OTP ERROR:', error);

    res.status(500).json({
      message: error.message || 'Server error while sending signup OTP',
    });
  }
});

// ✅ STEP 2: VERIFY SIGNUP OTP - Create account
// POST /api/auth/verify-signup
router.post('/verify-signup', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanOtp = String(otp || '').trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({
        message: 'Email aur OTP zaroori hai!',
      });
    }

    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      purpose: 'signup',
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        message: 'OTP expired ya invalid hai. Dobara signup karo.',
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        message: 'OTP expired ho gaya. Dobara signup karo.',
      });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        message: 'Too many wrong attempts. Dobara OTP bhejo.',
      });
    }

    const isOtpMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isOtpMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        message: 'Wrong OTP!',
      });
    }

    const existingUser = await User.findOne({ email: cleanEmail });
    if (existingUser) {
      await Otp.deleteMany({ email: cleanEmail, purpose: 'signup' });

      return res.status(400).json({
        message: 'Email already registered!',
      });
    }

    const user = new User({
      name: otpRecord.name,
      email: cleanEmail,
      password: otpRecord.passwordHash,
    });

    await user.save();

    await Otp.deleteMany({
      email: cleanEmail,
      purpose: 'signup',
    });

    // Emails bhejo
    try {
      sendWelcomeEmail(user.name, user.email);
      sendAdminNotification(user.name, user.email);
    } catch (mailErr) {
      console.log('WELCOME EMAIL ERROR:', mailErr);
    }

    res.status(201).json({
      message: '✅ Account verified and created successfully!',
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('VERIFY SIGNUP ERROR:', error);

    res.status(500).json({
      message: error.message || 'Server error while verifying signup OTP',
    });
  }
});

// ✅ STEP 1: LOGIN - Check password and send OTP
// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanPassword = String(password || '');

    if (!cleanEmail || !cleanPassword) {
      return res.status(400).json({
        message: 'Email aur password zaroori hai!',
      });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      return res.status(400).json({
        message: 'User not found!',
      });
    }

    const isMatch = await bcrypt.compare(cleanPassword, user.password);

    if (!isMatch) {
      return res.status(400).json({
        message: 'Wrong password!',
      });
    }

    const otp = generateOtp();
    const otpHash = await hashOtp(otp);

    await Otp.deleteMany({
      email: cleanEmail,
      purpose: 'login',
    });

    await Otp.create({
      email: cleanEmail,
      otpHash,
      purpose: 'login',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });

    await sendOtpEmail(cleanEmail, otp, 'login');

    res.status(200).json({
      message: '✅ Login OTP sent to your email.',
      email: cleanEmail,
      step: 'verify-login-otp',
    });
  } catch (error) {
    console.error('LOGIN OTP ERROR:', error);

    res.status(500).json({
      message: error.message || 'Server error while sending login OTP',
    });
  }
});

// ✅ STEP 2: VERIFY LOGIN OTP - Generate token
// POST /api/auth/verify-login
router.post('/verify-login', async (req, res) => {
  try {
    const { email, otp } = req.body;

    const cleanEmail = normalizeEmail(email);
    const cleanOtp = String(otp || '').trim();

    if (!cleanEmail || !cleanOtp) {
      return res.status(400).json({
        message: 'Email aur OTP zaroori hai!',
      });
    }

    const otpRecord = await Otp.findOne({
      email: cleanEmail,
      purpose: 'login',
    }).sort({ createdAt: -1 });

    if (!otpRecord) {
      return res.status(400).json({
        message: 'OTP expired ya invalid hai. Dobara login karo.',
      });
    }

    if (otpRecord.expiresAt < new Date()) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        message: 'OTP expired ho gaya. Dobara login karo.',
      });
    }

    if (otpRecord.attempts >= 5) {
      await Otp.deleteOne({ _id: otpRecord._id });

      return res.status(400).json({
        message: 'Too many wrong attempts. Dobara login karo.',
      });
    }

    const isOtpMatch = await bcrypt.compare(cleanOtp, otpRecord.otpHash);

    if (!isOtpMatch) {
      otpRecord.attempts += 1;
      await otpRecord.save();

      return res.status(400).json({
        message: 'Wrong OTP!',
      });
    }

    const user = await User.findOne({ email: cleanEmail });

    if (!user) {
      await Otp.deleteMany({ email: cleanEmail, purpose: 'login' });

      return res.status(400).json({
        message: 'User not found!',
      });
    }

    const token = createToken(user);

    await Otp.deleteMany({
      email: cleanEmail,
      purpose: 'login',
    });

    res.json({
      message: '✅ Login successful!',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error('VERIFY LOGIN ERROR:', error);

    res.status(500).json({
      message: error.message || 'Server error while verifying login OTP',
    });
  }
});

// ✅ Apne aap ko admin banao — sirf ek baar use karna
router.post('/make-admin', async (req, res) => {
  try {
    const { email, secretKey } = req.body;

    if (secretKey !== 'REHAN_ADMIN_SECRET') {
      return res.status(403).json({
        message: 'Wrong secret key!',
      });
    }

    const cleanEmail = normalizeEmail(email);

    const user = await User.findOneAndUpdate(
      { email: cleanEmail },
      { role: 'admin' },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({
        message: 'User not found!',
      });
    }

    res.json({
      message: `✅ ${user.name} is now admin!`,
    });
  } catch (error) {
    console.error('MAKE ADMIN ERROR:', error);

    res.status(500).json({
      message: 'Server error',
    });
  }
});

module.exports = router;