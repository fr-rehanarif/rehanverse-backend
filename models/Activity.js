const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    action: {
      type: String,
      required: true,
    },
    page: {
      type: String,
      default: '',
    },
    ip: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Activity', activitySchema);