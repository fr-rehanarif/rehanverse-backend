const express = require('express');
const router = express.Router();

const Progress = require('../models/Progress');
const Course = require('../models/Course');
const { protect } = require('../middleware/authMiddleware');

function getTodayKey() {
  return new Date().toISOString().split('T')[0];
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

  if (progress.lastStudyDate === today) return;

  if (progress.lastStudyDate === yesterday) {
    progress.streakCount = (progress.streakCount || 0) + 1;
    progress.lastStudyDate = today;
    return;
  }

  progress.streakCount = 1;
  progress.lastStudyDate = today;
}

function addOrUpdate(list, item, dateField = 'openedAt') {
  const index = list.findIndex((x) => x.url === item.url);

  if (index === -1) {
    list.push({
      title: item.title || '',
      url: item.url || '',
      [dateField]: new Date(),
    });
  } else {
    list[index].title = item.title || list[index].title;
    list[index][dateField] = new Date();
  }
}

function calculateProgress(course, progress) {
  const totalVideos = course.videos?.length || 0;
  const totalPdfs = course.pdfs?.length || 0;
  const totalItems = totalVideos + totalPdfs;

  if (totalItems === 0) return 0;

  const completedVideoUrls = new Set((progress.completedVideos || []).map((v) => v.url));
  const completedPdfUrls = new Set((progress.completedPdfs || []).map((p) => p.url));

  const completedItems = completedVideoUrls.size + completedPdfUrls.size;

  return Math.min(100, Math.round((completedItems / totalItems) * 100));
}

// ✅ POST /api/progress/track
// action: "open" or "complete"
router.post('/track', protect, async (req, res) => {
  try {
    const { courseId, type, title, url, action = 'open' } = req.body;

    if (!courseId || !type) {
      return res.status(400).json({ message: 'courseId and type are required' });
    }

    if (!['course', 'video', 'pdf'].includes(type)) {
      return res.status(400).json({ message: 'Invalid progress type' });
    }

    if (!['open', 'complete'].includes(action)) {
      return res.status(400).json({ message: 'Invalid progress action' });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
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
        completedVideos: [],
        completedPdfs: [],
      });
    }

    const now = new Date();

    // ✅ streak open/complete dono pe update hoga because both are real study actions
    updateStreak(progress);

    progress.lastOpenedAt = now;
    progress.lastOpenedType = type;
    progress.lastOpenedTitle =
      title || (type === 'course' ? course.title : 'Course Content');

    if (type === 'video' && url) {
      addOrUpdate(progress.openedVideos, { title, url }, 'openedAt');

      if (action === 'complete') {
        addOrUpdate(progress.completedVideos, { title, url }, 'completedAt');
      }
    }

    if (type === 'pdf' && url) {
      addOrUpdate(progress.openedPdfs, { title, url }, 'openedAt');

      if (action === 'complete') {
        addOrUpdate(progress.completedPdfs, { title, url }, 'completedAt');
      }
    }

    await progress.save();

    const progressPercent = calculateProgress(course, progress);

    res.json({
      message:
        action === 'complete'
          ? 'Content marked as done'
          : 'Content opened successfully',
      progressPercent,
      progress,
    });
  } catch (err) {
    console.log('PROGRESS TRACK ERROR:', err);
    res.status(500).json({ message: 'Progress tracking failed' });
  }
});

// ✅ GET /api/progress/my-courses
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

      const openedVideoUrls = new Set((progress?.openedVideos || []).map((v) => v.url));
      const openedPdfUrls = new Set((progress?.openedPdfs || []).map((p) => p.url));
      const completedVideoUrls = new Set((progress?.completedVideos || []).map((v) => v.url));
      const completedPdfUrls = new Set((progress?.completedPdfs || []).map((p) => p.url));

      const completedItems = completedVideoUrls.size + completedPdfUrls.size;

      const progressPercent =
        totalItems === 0 ? 0 : Math.min(100, Math.round((completedItems / totalItems) * 100));

      return {
        course,
        progress: {
          progressPercent,

          openedItems: openedVideoUrls.size + openedPdfUrls.size,
          completedItems,
          totalItems,

          openedVideosCount: openedVideoUrls.size,
          openedPdfsCount: openedPdfUrls.size,

          completedVideosCount: completedVideoUrls.size,
          completedPdfsCount: completedPdfUrls.size,

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
    res.status(500).json({ message: 'Failed to load course progress' });
  }
});

// ✅ GET /api/progress/course/:courseId
router.get('/course/:courseId', protect, async (req, res) => {
  try {
    const { courseId } = req.params;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    const progress = await Progress.findOne({
      user: req.user._id,
      course: courseId,
    });

    const totalItems = (course.videos?.length || 0) + (course.pdfs?.length || 0);

    if (!progress) {
      return res.json({
        progressPercent: 0,
        openedItems: 0,
        completedItems: 0,
        totalItems,
        openedVideosCount: 0,
        openedPdfsCount: 0,
        completedVideosCount: 0,
        completedPdfsCount: 0,
        completedVideoUrls: [],
        completedPdfUrls: [],
        streakCount: 0,
        lastStudyDate: '',
        lastOpenedAt: null,
        lastOpenedType: '',
        lastOpenedTitle: '',
      });
    }

    const openedVideoUrls = new Set((progress.openedVideos || []).map((v) => v.url));
    const openedPdfUrls = new Set((progress.openedPdfs || []).map((p) => p.url));
    const completedVideoUrls = new Set((progress.completedVideos || []).map((v) => v.url));
    const completedPdfUrls = new Set((progress.completedPdfs || []).map((p) => p.url));

    const completedItems = completedVideoUrls.size + completedPdfUrls.size;
    const progressPercent = calculateProgress(course, progress);

    res.json({
      progressPercent,

      openedItems: openedVideoUrls.size + openedPdfUrls.size,
      completedItems,
      totalItems,

      openedVideosCount: openedVideoUrls.size,
      openedPdfsCount: openedPdfUrls.size,

      completedVideosCount: completedVideoUrls.size,
      completedPdfsCount: completedPdfUrls.size,

      completedVideoUrls: Array.from(completedVideoUrls),
      completedPdfUrls: Array.from(completedPdfUrls),

      streakCount: progress.streakCount || 0,
      lastStudyDate: progress.lastStudyDate || '',
      lastOpenedAt: progress.lastOpenedAt || null,
      lastOpenedType: progress.lastOpenedType || '',
      lastOpenedTitle: progress.lastOpenedTitle || '',
    });
  } catch (err) {
    console.log('SINGLE COURSE PROGRESS ERROR:', err);
    res.status(500).json({ message: 'Failed to load course progress' });
  }
});

module.exports = router;