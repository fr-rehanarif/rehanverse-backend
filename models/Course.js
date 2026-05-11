const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },

    // ✅ Future use: preview video for paid course
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const pdfSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    url: { type: String, required: true },
    filename: { type: String, default: '' },

    // ✅ Future use: preview PDF for paid course
    isPreview: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true }
);

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },

    description: { type: String, required: true },

    price: {
      type: Number,
      default: 0,
    },

    isFree: {
      type: Boolean,
      default: false,
    },

    thumbnail: {
      type: String,
      default: '',
    },

    videos: [videoSchema],

    pdfs: [pdfSchema],

    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },

    // ✅ Course meta for profile/certificate/dashboard
    level: {
      type: String,
      enum: ['Beginner', 'Intermediate', 'Advanced'],
      default: 'Beginner',
    },

    duration: {
      type: String,
      default: '',
      // Example: "4 weeks", "10 hours", "15 days"
    },

    category: {
      type: String,
      default: 'General',
    },

    // ✅ Certificate control
    certificateEnabled: {
      type: Boolean,
      default: true,
    },

    certificateTitle: {
      type: String,
      default: '',
      // Agar empty hoga toh course title use hoga
    },

    // ✅ Stats
    enrolledCount: {
      type: Number,
      default: 0,
    },

    completedCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// ✅ Better searching/filtering later
courseSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Course', courseSchema);