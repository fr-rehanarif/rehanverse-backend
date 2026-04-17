const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Saare courses lao (public)
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Single course (public)
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ message: 'Course not found' });
    res.json(course);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Course banao (admin only)
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, price, isFree, thumbnail, videos, pdfs } = req.body;
    const course = new Course({
      title, description, price, isFree, thumbnail,
      videos: videos || [],
      pdfs: pdfs || [],
      instructor: req.user.userId
    });
    await course.save();
    res.status(201).json({ message: '✅ Course created!', course });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
});

// Course update karo (admin only)
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const course = await Course.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: '✅ Course updated!', course });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Course delete karo (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    await Course.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Course deleted!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;