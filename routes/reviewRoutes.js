const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { protect } = require('../middleware/authMiddleware');

// Course ke reviews lo
router.get('/:courseId', async (req, res) => {
  try {
    const reviews = await Review.find({ course: req.params.courseId })
      .populate('user', 'name photo')
      .sort({ createdAt: -1 });

    res.json(reviews);
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Review do
router.post('/:courseId', protect, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    const existing = await Review.findOne({
      user: req.user._id,
      course: req.params.courseId,
    });

    if (existing) {
      return res.status(400).json({ message: 'Already reviewed!' });
    }

    const review = new Review({
      user: req.user._id,
      course: req.params.courseId,
      rating,
      comment,
    });

    await review.save();

    res.status(201).json({ message: '✅ Review submitted!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Review delete karo
router.delete('/:id', protect, async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: '✅ Review deleted!' });
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;