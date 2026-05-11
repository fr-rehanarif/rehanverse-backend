const mongoose = require('mongoose');

const otpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    otpHash: {
      type: String,
      required: true,
    },

    purpose: {
      type: String,
      enum: ['signup', 'login'],
      required: true,
    },

    name: {
      type: String,
      default: '',
    },

    passwordHash: {
      type: String,
      default: '',
    },

    // ✅ NEW: signup OTP ke saath referral code temporarily save hoga
    referralCode: {
      type: String,
      default: '',
      uppercase: true,
      trim: true,
    },

    attempts: {
      type: Number,
      default: 0,
    },

    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // MongoDB auto delete after expiresAt
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Otp', otpSchema);