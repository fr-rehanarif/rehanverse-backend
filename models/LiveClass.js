const mongoose = require('mongoose');

const liveClassSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      default: '',
    },

    liveUrl: {
      type: String,
      required: true,
      trim: true,
    },

    scheduledAt: {
      type: Date,
      required: true,
    },

    durationMinutes: {
      type: Number,
      default: 60,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('LiveClass', liveClassSchema);