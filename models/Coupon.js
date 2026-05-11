const mongoose = require('mongoose');

const couponSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },

    discountType: {
      type: String,
      enum: ['free', 'percentage', 'fixed'],
      required: true,
    },

    discountValue: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Agar null hai to coupon all courses par valid hai
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      default: null,
    },

    usageLimit: {
      type: Number,
      default: 0, // 0 means unlimited
      min: 0,
    },

    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    expiresAt: {
      type: Date,
      default: null,
    },

    isActive: {
      type: Boolean,
      default: true,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ✅ NEW: coupon kis purpose ke liye hai
    purpose: {
      type: String,
      enum: ['manual', 'referral', 'promotion', 'special'],
      default: 'manual',
    },

    // ✅ NEW: agar referral reward coupon hai
    referralRewardFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ✅ NEW: jis user ke signup se reward mila
    referredUser: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    // ✅ NEW: readable note for admin
    note: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

// ✅ Fast lookup
couponSchema.index({ purpose: 1 });
couponSchema.index({ referralRewardFor: 1 });

module.exports = mongoose.model('Coupon', couponSchema);