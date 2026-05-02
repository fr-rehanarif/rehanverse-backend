const express = require('express');
const router = express.Router();

const Progress = require('../models/Progress');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

function getTodayKey() {
  const now = new Date();
  return now.toISOString().split('T')[0];
}

function getYesterdayKey() {
  const date = new Date();
  date.setDate(date.getDate() - 1);
  return date.toISOString().split('T')[0];
}

function updateStreak(progress) {
  const today = getTodayKey();
  const yesterday = getYesterdayKey();

  if (!progress.lastStudyDate) {
    progress.streakCount = 1;
    progress.lastStudyDate = today;
    return;
  }

  if (progress.lastStudyDate === today) {
    return;
  }

  if (progress.lastStudyDate === yesterday) {
    progress.streakCount = (progress.streakCount || 0) + 1;
    progress.lastStudyDate = today;
    return;
  }

  progress.streakCount = 1;
  progress.lastStudyDate = today;
}

function calculateProgress(course, progress) {
  const totalVideos = course.videos?.length || 0;
  const totalPdfs = course.pdfs?.length || 0;
  const totalItems = totalVideos + totalPdfs;

  if (totalItems === 0) return 0;

  const openedVideoUrls = new Set((progress.openedVideos || []).map((v) => v.url));
  const openedPdfUrls = new Set((progress.openedPdfs || []).map((p) => p.url));

  const completedItems = openedVideoUrls.size + openedPdfUrls.size;

  return Math.min(100, Math.round((completedItems / totalItems) * 100));
}

// ✅ Track real user activity
// POST /api/progress/track
router.post('/track', protect, async (req, res) => {
  try {
    const { courseId, type, title, url } = req.body;

    if (!courseId || !type) {
      return res.status(400).json({
        message: 'courseId and type are required',
      });
    }

    if (!['course', 'video', 'pdf'].includes(type)) {
      return res.status(400).json({
        message: 'Invalid progress type',
      });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        message: 'Course not found',
      });
    }

    let progress = await Progress.findOne({
      user: req.user._id,
      course: courseId,
    });

    if (!progress) {
      progress = await Progress.create({
        user: req.user._id,
        course: courseId,
        openedVideos: [],
        openedPdfs: [],
      });
    }

    const now = new Date();

    // ✅ streak sirf actual learning activity pe update hoga
    updateStreak(progress);

    progress.lastOpenedAt = now;
    progress.lastOpenedType = type;
    progress.lastOpenedTitle =
      title || (type === 'course' ? course.title : 'Course Content');

    if (type === 'video' && url) {
      const alreadyOpened = progress.openedVideos.some((v) => v.url === url);

      if (!alreadyOpened) {
        progress.openedVideos.push({
          title: title || 'Video',
          url,
          openedAt: now,
        });
      } else {
        progress.openedVideos = progress.openedVideos.map((v) =>
          v.url === url
            ? {
                ...v.toObject?.() || v,
                openedAt: now,
              }
            : v
        );
      }
    }

    if (type === 'pdf' && url) {
      const alreadyOpened = progress.openedPdfs.some((p) => p.url === url);

      if (!alreadyOpened) {
        progress.openedPdfs.push({
          title: title || 'PDF',
          url,
          openedAt: now,
        });
      } else {
        progress.openedPdfs = progress.openedPdfs.map((p) =>
          p.url === url
            ? {
                ...p.toObject?.() || p,
                openedAt: now,
              }
            : p
        );
      }
    }

    await progress.save();

    const progressPercent = calculateProgress(course, progress);

    res.json({
      message: 'Progress tracked successfully',
      progressPercent,
      progress,
    });
  } catch (err) {
    console.log('PROGRESS TRACK ERROR:', err);
    res.status(500).json({
      message: 'Progress tracking failed',
    });
  }
});

// ✅ Get progress for all enrolled courses
// GET /api/progress/my-courses
router.get('/my-courses', protect, async (req, res) => {
  try {
    const user = req.user;

    await user.populate('enrolledCourses');

    const courses = user.enrolledCourses || [];

    const progressDocs = await Progress.find({
      user: user._id,
      course: { $in: courses.map((c) => c._id) },
    });

    const progressMap = {};

    progressDocs.forEach((p) => {
      progressMap[p.course.toString()] = p;
    });

    const data = courses.map((course) => {
      const progress = progressMap[course._id.toString()];

      const totalVideos = course.videos?.length || 0;
      const totalPdfs = course.pdfs?.length || 0;
      const totalItems = totalVideos + totalPdfs;

      const openedVideos = progress?.openedVideos || [];
      const openedPdfs = progress?.openedPdfs || [];

      const openedVideoUrls = new Set(openedVideos.map((v) => v.url));
      const openedPdfUrls = new Set(openedPdfs.map((p) => p.url));

      const completedItems = openedVideoUrls.size + openedPdfUrls.size;

      const progressPercent =
        totalItems === 0 ? 0 : Math.min(100, Math.round((completedItems / totalItems) * 100));

      return {
        course,
        progress: {
          progressPercent,
          completedItems,
          totalItems,
          openedVideosCount: openedVideoUrls.size,
          openedPdfsCount: openedPdfUrls.size,
          streakCount: progress?.streakCount || 0,
          lastStudyDate: progress?.lastStudyDate || '',
          lastOpenedAt: progress?.lastOpenedAt || null,
          lastOpenedType: progress?.lastOpenedType || '',
          lastOpenedTitle: progress?.lastOpenedTitle || '',
        },
      };
    });

    res.json(data);
  } catch (err) {
    console.log('MY COURSE PROGRESS ERROR:', err);
    res.status(500).json({
      message: 'Failed to load course progress',
    });
  }
});

// ✅ Get progress of single course
// GET /api/progress/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        message: 'Course not found',
      });
    }

    const progress = await Progress.findOne({
      user: req.user._id,
      course: courseId,
    });

    if (!progress) {
      return res.json({
        progressPercent: 0,
        completedItems: 0,
        totalItems: (course.videos?.length || 0) + (course.pdfs?.length || 0),
        openedVideosCount: 0,
        openedPdfsCount: 0,
        streakCount: 0,
        lastStudyDate: '',
        lastOpenedAt: null,
        lastOpenedType: '',
        lastOpenedTitle: '',
      });
    }

    const progressPercent = calculateProgress(course, progress);

    res.json({
      progressPercent,
      completedItems:
        new Set((progress.openedVideos || []).map((v) => v.url)).size +
        new Set((progress.openedPdfs || []).map((p) => p.url)).size,
      totalItems: (course.videos?.length || 0) + (course.pdfs?.length || 0),
      openedVideosCount: new Set((progress.openedVideos || []).map((v) => v.url)).size,
      openedPdfsCount: new Set((progress.openedPdfs || []).map((p) => p.url)).size,
      streakCount: progress.streakCount || 0,
      lastStudyDate: progress.lastStudyDate || '',
      lastOpenedAt: progress.lastOpenedAt || null,
      lastOpenedType: progress.lastOpenedType || '',
      lastOpenedTitle: progress.lastOpenedTitle || '',
    });
  } catch (err) {
    console.log('SINGLE COURSE PROGRESS ERROR:', err);
    res.status(500).json({
      message: 'Failed to load course progress',
    });
  }
});

module.exports = router;