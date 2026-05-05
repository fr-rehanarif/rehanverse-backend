const mongoose = require('mongoose');

const studyToolSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },

    type: {
      type: String,
      enum: ['important_questions', 'quiz', 'flashcards', 'summary', 'audio'],
      required: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
    },

    sourcePdf: {
      title: {
        type: String,
        default: '',
      },
      url: {
        type: String,
        default: '',
      },
      filename: {
        type: String,
        default: '',
      },
    },

    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },

    generatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('StudyTool', studyToolSchema);