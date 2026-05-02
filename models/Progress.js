const mongoose = require('mongoose');

const openedContentSchema = new mongoose.Schema(
  {
    title: { type: String, default: '' },
    url: { type: String, default: '' },
    openedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const progressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },

    openedVideos: [openedContentSchema],
    openedPdfs: [openedContentSchema],

    lastOpenedAt: { type: Date, default: null },
    lastOpenedType: {
      type: String,
      enum: ['course', 'video', 'pdf'],
      default: 'course',
    },
    lastOpenedTitle: { type: String, default: '' },

    streakCount: { type: Number, default: 0 },
    lastStudyDate: { type: String, default: '' },
  },
  { timestamps: true }
);

progressSchema.index({ user: 1, course: 1 }, { unique: true });

module.exports = mongoose.model('Progress', progressSchema);