const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: 'student' },
  enrolledCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
  phone: { type: String, default: '' },
  bio: { type: String, default: '' },
  photo: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);