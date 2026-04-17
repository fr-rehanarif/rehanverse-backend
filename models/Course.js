const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: { type: String, required: true },
  price: { type: Number, default: 0 }, // 0 = free
  isFree: { type: Boolean, default: false },
  thumbnail: { type: String },
  videos: [{ title: String, url: String }],
  pdfs: [{ title: String, url: String }],
  instructor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Course', courseSchema);