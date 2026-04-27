const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const upload = require('../middleware/upload');
const addWatermark = require('../utils/addWatermark');
const { protect } = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PDF UPLOAD + WATERMARK + SUPABASE
router.post('/pdf', protect, upload.single('pdf'), async (req, res) => {
  try {
    console.log('PDF FILE:', req.file);
    console.log('WATERMARK USER:', req.user);

    if (!req.file) {
      return res.status(400).json({ message: 'No PDF uploaded' });
    }

    const inputPath = req.file.path;

    const watermarkedFilename = `watermarked-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
    const outputPath = path.join('uploads', watermarkedFilename);

    // ✅ Add watermark with logged-in user details
    await addWatermark(inputPath, outputPath, {
      name: req.user?.name || 'REHANVERSE USER',
      email: req.user?.email || 'protected@rehanverse.com',
    });

    const fileBuffer = fs.readFileSync(outputPath);

    // ✅ Upload watermarked PDF to Supabase
    const { error } = await supabase.storage
      .from('course-pdfs')
      .upload(watermarkedFilename, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.log('SUPABASE UPLOAD ERROR:', error);
      return res.status(500).json({
        message: 'Supabase upload failed',
        error: error.message,
      });
    }

    const { data } = supabase.storage
      .from('course-pdfs')
      .getPublicUrl(watermarkedFilename);

    // ✅ temp files delete
    if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    res.json({
      message: 'PDF uploaded with watermark',
      filename: watermarkedFilename,
      url: data.publicUrl,
    });
  } catch (error) {
    console.log('PDF upload error:', error);
    res.status(500).json({
      message: 'PDF upload failed',
      error: error.message,
    });
  }
});

module.exports = router;