const mongoose = require('mongoose');

const certificateSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    courseTitle: {
      type: String,
      required: true,
    },

    certificateId: {
      type: String,
      required: true,
      unique: true,
    },

    issuedAt: {
      type: Date,
      default: Date.now,
    },

    certificateUrl: {
      type: String,
      default: '',
    },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    password: { type: String, required: true },

    role: {
      type: String,
      enum: ['student', 'admin'],
      default: 'student',
    },

    enrolledCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],

    // ✅ Student profile upgrade
    phone: { type: String, default: '' },
    bio: { type: String, default: '' },
    photo: { type: String, default: '' },

    // ✅ Completed courses
    completedCourses: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course',
      },
    ],

    // ✅ Certificates
    certificates: [certificateSchema],

    // ✅ Referral system
    referralCode: {
      type: String,
      unique: true,
      sparse: true,
      uppercase: true,
      trim: true,
    },

    referredBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    referralCount: {
      type: Number,
      default: 0,
    },

    referralRewards: [
      {
        referredUser: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },

        rewardType: {
          type: String,
          enum: ['coupon', 'manual', 'none'],
          default: 'coupon',
        },

        couponCode: {
          type: String,
          default: '',
        },

        status: {
          type: String,
          enum: ['pending', 'given', 'used'],
          default: 'given',
        },

        createdAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  { timestamps: true }
);

// ✅ Auto referral code generator
userSchema.pre('save', function () {
  if (!this.referralCode) {
    const namePart = this.name
      ? this.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase()
      : 'RV';

    const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();

    this.referralCode = `${namePart || 'RV'}${randomPart}`;
  }
});

module.exports = mongoose.model('User', userSchema);
