const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { protect, adminOnly } = require('../middleware/authMiddleware');

// Saare courses lao (public)
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find();
    res.json(courses);
  } catch (error) {
    console.log('COURSES FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Single course (public)
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.log('SINGLE COURSE FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Course ke enrolled users (admin only)
router.get('/:id/enrolled-users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({
      enrolledCourses: req.params.id,
    }).select('name email createdAt');

    res.json(users);
  } catch (error) {
    console.log('ENROLLED USERS FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Course banao (admin only) + auto notification
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { title, description, price, isFree, thumbnail, videos, pdfs } = req.body;

    const course = new Course({
      title,
      description,
      price,
      isFree,
      thumbnail,
      videos: videos || [],
      pdfs: pdfs || [],
      instructor: req.user._id,
    });

    await course.save();

    await Notification.create({
      title: '🚀 New Course Launched',
      message: `"${course.title}" is now live on REHANVERSE. Check it out now!`,
      type: 'course',
      targetType: 'all',
      courseId: course._id,
      userId: null,
      createdBy: req.user._id,
    });

    res.status(201).json({
      message: '✅ Course created & notification sent!',
      course,
    });
  } catch (error) {
    console.log('COURSE CREATE ERROR:', error);
    res.status(500).json({ message: 'Server error', error });
  }
});

// Course update karo (admin only) + PDF/video auto notification
router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const oldCourse = await Course.findById(req.params.id);

    if (!oldCourse) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const oldPdfCount = oldCourse.pdfs?.length || 0;
    const oldVideoCount = oldCourse.videos?.length || 0;

    const course = await Course.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const newPdfCount = course.pdfs?.length || 0;
    const newVideoCount = course.videos?.length || 0;

    if (newPdfCount > oldPdfCount) {
      const addedPdf = course.pdfs[newPdfCount - 1];

      await Notification.create({
        title: '📄 New Notes Added',
        message: addedPdf?.title
          ? `"${addedPdf.title}" has been added to "${course.title}".`
          : `New notes have been added to "${course.title}".`,
        type: 'pdf',
        targetType: 'course',
        courseId: course._id,
        userId: null,
        createdBy: req.user._id,
      });
    }

    if (newVideoCount > oldVideoCount) {
      const addedVideo = course.videos[newVideoCount - 1];

      await Notification.create({
        title: '🎥 New Video Added',
        message: addedVideo?.title
          ? `"${addedVideo.title}" has been added to "${course.title}".`
          : `A new video has been added to "${course.title}".`,
        type: 'video',
        targetType: 'course',
        courseId: course._id,
        userId: null,
        createdBy: req.user._id,
      });
    }

    res.json({ message: '✅ Course updated!', course });
  } catch (error) {
    console.log('COURSE UPDATE ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// Course delete karo (admin only)
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json({ message: '✅ Course deleted!' });
  } catch (error) {
    console.log('COURSE DELETE ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;