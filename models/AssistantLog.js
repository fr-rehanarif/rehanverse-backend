const mongoose = require('mongoose');

const assistantLogSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },

    userName: {
      type: String,
      default: 'Unknown User',
      trim: true,
    },

    userEmail: {
      type: String,
      default: 'unknown@email.com',
      trim: true,
    },

    question: {
      type: String,
      required: true,
      trim: true,
    },

    answer: {
      type: String,
      required: true,
      trim: true,
    },

    ipAddress: {
      type: String,
      default: '',
    },

    deviceInfo: {
      type: String,
      default: '',
    },

    status: {
      type: String,
      enum: ['answered', 'failed'],
      default: 'answered',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('AssistantLog', assistantLogSchema);