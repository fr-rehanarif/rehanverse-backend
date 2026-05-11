const express = require('express');
const router = express.Router();

const Course = require('../models/Course');
const User = require('../models/User');
const Notification = require('../models/Notification');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ Helper: generate certificate ID
const generateCertificateId = () => {
  const year = new Date().getFullYear();
  const randomPart = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `RV-CERT-${year}-${randomPart}`;
};

// ✅ Helper: ensure unique certificate ID
const createUniqueCertificateId = async () => {
  let certificateId = generateCertificateId();

  let existingUser = await User.findOne({
    'certificates.certificateId': certificateId,
  });

  while (existingUser) {
    certificateId = generateCertificateId();

    existingUser = await User.findOne({
      'certificates.certificateId': certificateId,
    });
  }

  return certificateId;
};

// ✅ Saare courses lao (public)
// GET /api/courses
router.get('/', async (req, res) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.log('COURSES FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Course complete karo + certificate generate
// POST /api/courses/:id/complete
router.post('/:id/complete', protect, async (req, res) => {
  try {
    const courseId = req.params.id;
    const userId = req.user.id || req.user._id;

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({
        message: 'Course not found!',
      });
    }

    if (course.certificateEnabled === false) {
      return res.status(400).json({
        message: 'Is course ke liye certificate enabled nahi hai.',
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found!',
      });
    }

    const isEnrolled = (user.enrolledCourses || []).some(
      (id) => String(id) === String(courseId)
    );

    if (!isEnrolled) {
      return res.status(403).json({
        message: 'Pehle course enroll karo, phir complete kar sakte ho.',
      });
    }

    const alreadyCompleted = (user.completedCourses || []).some(
      (id) => String(id) === String(courseId)
    );

    const existingCertificate = (user.certificates || []).find(
      (cert) => String(cert.course) === String(courseId)
    );

    if (alreadyCompleted && existingCertificate) {
      return res.json({
        message: '✅ Course already completed. Certificate already generated.',
        alreadyCompleted: true,
        certificate: existingCertificate,
      });
    }

    if (!alreadyCompleted) {
      user.completedCourses.push(course._id);
      course.completedCount = (course.completedCount || 0) + 1;
    }

    let certificate = existingCertificate;

    if (!certificate) {
      const certificateId = await createUniqueCertificateId();

      certificate = {
        course: course._id,
        courseTitle: course.certificateTitle || course.title,
        certificateId,
        issuedAt: new Date(),
        certificateUrl: '',
      };

      user.certificates.push(certificate);
    }

    await user.save();
    await course.save();

    // ✅ User notification
    try {
      await Notification.create({
        title: '🎓 Certificate Generated',
        message: `Congratulations! Your certificate for "${course.title}" is ready.`,
        type: 'certificate',
        targetType: 'user',
        courseId: course._id,
        userId: user._id,
        createdBy: user._id,
      });
    } catch (notificationErr) {
      console.log('CERTIFICATE NOTIFICATION ERROR:', notificationErr);
    }

    res.status(200).json({
      message: '🎓 Course completed successfully! Certificate generated.',
      completed: true,
      course: {
        id: course._id,
        title: course.title,
        completedCount: course.completedCount,
      },
      certificate,
    });
  } catch (error) {
    console.log('COURSE COMPLETE ERROR:', error);
    res.status(500).json({
      message: error.message || 'Server error while completing course',
    });
  }
});

// ✅ Course ke enrolled users (admin only)
// GET /api/courses/:id/enrolled-users
router.get('/:id/enrolled-users', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({
      enrolledCourses: req.params.id,
    }).select('name email photo createdAt');

    res.json(users);
  } catch (error) {
    console.log('ENROLLED USERS FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Single course (public)
// GET /api/courses/:id
router.get('/:id', async (req, res) => {
  try {
    const course = await Course.findById(req.params.id)
      .populate('instructor', 'name email photo');

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    res.json(course);
  } catch (error) {
    console.log('SINGLE COURSE FETCH ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Course banao (admin only) + auto notification
// POST /api/courses
router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const {
      title,
      description,
      price,
      isFree,
      thumbnail,
      videos,
      pdfs,
      level,
      duration,
      category,
      certificateEnabled,
      certificateTitle,
    } = req.body;

    const course = new Course({
      title,
      description,
      price,
      isFree,
      thumbnail,
      videos: videos || [],
      pdfs: pdfs || [],
      instructor: req.user._id || req.user.id,

      // ✅ New fields
      level: level || 'Beginner',
      duration: duration || '',
      category: category || 'General',
      certificateEnabled:
        typeof certificateEnabled === 'boolean' ? certificateEnabled : true,
      certificateTitle: certificateTitle || '',
    });

    await course.save();

    await Notification.create({
      title: '🚀 New Course Launched',
      message: `"${course.title}" is now live on REHANVERSE. Check it out now!`,
      type: 'course',
      targetType: 'all',
      courseId: course._id,
      userId: null,
      createdBy: req.user._id || req.user.id,
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

// ✅ Course update karo (admin only) + PDF/video auto notification
// PUT /api/courses/:id
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
      runValidators: true,
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
        createdBy: req.user._id || req.user.id,
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
        createdBy: req.user._id || req.user.id,
      });
    }

    res.json({ message: '✅ Course updated!', course });
  } catch (error) {
    console.log('COURSE UPDATE ERROR:', error);
    res.status(500).json({
      message: error.message || 'Server error',
    });
  }
});

// ✅ Course delete karo (admin only)
// DELETE /api/courses/:id
router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const course = await Course.findByIdAndDelete(req.params.id);

    if (!course) {
      return res.status(404).json({ message: 'Course not found' });
    }

    // ✅ Deleted course ko users ke enrolled/completed/certificates se clean karo
    await User.updateMany(
      {},
      {
        $pull: {
          enrolledCourses: course._id,
          completedCourses: course._id,
          certificates: { course: course._id },
        },
      }
    );

    res.json({ message: '✅ Course deleted!' });
  } catch (error) {
    console.log('COURSE DELETE ERROR:', error);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;