const express = require('express');
const router = express.Router();

const User = require('../models/User');
const Course = require('../models/Course');

const { protect, adminOnly } = require('../middleware/authMiddleware');

// ✅ PUBLIC: Verify certificate by certificate ID
// GET /api/certificates/verify/:certificateId
router.get('/verify/:certificateId', async (req, res) => {
  try {
    const certificateId = String(req.params.certificateId || '').trim();

    if (!certificateId) {
      return res.status(400).json({
        verified: false,
        message: 'Certificate ID required!',
      });
    }

    const user = await User.findOne({
      'certificates.certificateId': certificateId,
    })
      .select('name email certificates')
      .populate('certificates.course', 'title thumbnail category level duration');

    if (!user) {
      return res.status(404).json({
        verified: false,
        message: 'Certificate not found or invalid!',
      });
    }

    const certificate = user.certificates.find(
      (cert) => cert.certificateId === certificateId
    );

    if (!certificate) {
      return res.status(404).json({
        verified: false,
        message: 'Certificate not found!',
      });
    }

    res.json({
      verified: true,
      message: '✅ Certificate verified successfully!',
      certificate: {
        certificateId: certificate.certificateId,
        courseTitle: certificate.courseTitle,
        issuedAt: certificate.issuedAt,
        certificateUrl: certificate.certificateUrl || '',
        studentName: user.name,
        studentEmail: user.email,
        course: certificate.course || null,
      },
    });
  } catch (error) {
    console.log('CERTIFICATE VERIFY ERROR:', error);

    res.status(500).json({
      verified: false,
      message: 'Server error while verifying certificate',
    });
  }
});

// ✅ PROTECTED: Get logged-in user's all certificates
// GET /api/certificates/my
router.get('/my', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const user = await User.findById(userId)
      .select('name email certificates')
      .populate('certificates.course', 'title thumbnail category level duration');

    if (!user) {
      return res.status(404).json({
        message: 'User not found!',
      });
    }

    res.json({
      student: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      certificates: user.certificates || [],
    });
  } catch (error) {
    console.log('MY CERTIFICATES ERROR:', error);

    res.status(500).json({
      message: 'Server error while fetching certificates',
    });
  }
});

// ✅ PROTECTED: Get single certificate of logged-in user
// GET /api/certificates/my/:certificateId
router.get('/my/:certificateId', protect, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const certificateId = String(req.params.certificateId || '').trim();

    const user = await User.findById(userId)
      .select('name email certificates')
      .populate('certificates.course', 'title thumbnail category level duration');

    if (!user) {
      return res.status(404).json({
        message: 'User not found!',
      });
    }

    const certificate = (user.certificates || []).find(
      (cert) => cert.certificateId === certificateId
    );

    if (!certificate) {
      return res.status(404).json({
        message: 'Certificate not found in your account!',
      });
    }

    res.json({
      student: {
        id: user._id,
        name: user.name,
        email: user.email,
      },
      certificate,
    });
  } catch (error) {
    console.log('SINGLE MY CERTIFICATE ERROR:', error);

    res.status(500).json({
      message: 'Server error while fetching certificate',
    });
  }
});

// ✅ ADMIN: Get all certificates generated on platform
// GET /api/certificates/admin/all
router.get('/admin/all', protect, adminOnly, async (req, res) => {
  try {
    const users = await User.find({
      certificates: { $exists: true, $not: { $size: 0 } },
    })
      .select('name email photo certificates createdAt')
      .populate('certificates.course', 'title thumbnail category level duration')
      .sort({ createdAt: -1 });

    const certificates = [];

    users.forEach((user) => {
      (user.certificates || []).forEach((cert) => {
        certificates.push({
          student: {
            id: user._id,
            name: user.name,
            email: user.email,
            photo: user.photo || '',
          },
          certificate: cert,
        });
      });
    });

    certificates.sort((a, b) => {
      return new Date(b.certificate.issuedAt) - new Date(a.certificate.issuedAt);
    });

    res.json({
      totalCertificates: certificates.length,
      certificates,
    });
  } catch (error) {
    console.log('ADMIN CERTIFICATES ERROR:', error);

    res.status(500).json({
      message: 'Server error while fetching all certificates',
    });
  }
});

// ✅ ADMIN: Delete/remove certificate from a user
// DELETE /api/certificates/admin/:userId/:certificateId
router.delete('/admin/:userId/:certificateId', protect, adminOnly, async (req, res) => {
  try {
    const { userId, certificateId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        message: 'User not found!',
      });
    }

    const beforeCount = user.certificates.length;

    user.certificates = user.certificates.filter(
      (cert) => cert.certificateId !== certificateId
    );

    const afterCount = user.certificates.length;

    if (beforeCount === afterCount) {
      return res.status(404).json({
        message: 'Certificate not found!',
      });
    }

    await user.save();

    res.json({
      message: '✅ Certificate removed successfully!',
    });
  } catch (error) {
    console.log('DELETE CERTIFICATE ERROR:', error);

    res.status(500).json({
      message: 'Server error while deleting certificate',
    });
  }
});

module.exports = router;