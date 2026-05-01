const express = require('express');
const router = express.Router();
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const upload = require('../middleware/upload');
const { protect } = require('../middleware/authMiddleware');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PDF UPLOAD CLEAN + SUPABASE
// IMPORTANT:
// User-specific watermark upload time pe mat lagao.
// Dynamic user watermark PDF view/open time pe lagega.
router.post('/pdf', protect, upload.single('pdf'), async (req, res) => {
  try {
    console.log('PDF FILE:', req.file);
    console.log('UPLOAD USER:', req.user);

    if (!req.file) {
      return res.status(400).json({ message: 'No PDF uploaded' });
    }

    const inputPath = req.file.path;

    const cleanFilename = `clean-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;

    const fileBuffer = fs.readFileSync(inputPath);

    // ✅ Upload original/clean PDF to Supabase
    const { error } = await supabase.storage
      .from('course-pdfs')
      .upload(cleanFilename, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false,
      });

    if (error) {
      console.log('SUPABASE UPLOAD ERROR:', error);

      if (fs.existsSync(inputPath)) {
        fs.unlinkSync(inputPath);
      }

      return res.status(500).json({
        message: 'Supabase upload failed',
        error: error.message,
      });
    }

    const { data } = supabase.storage
      .from('course-pdfs')
      .getPublicUrl(cleanFilename);

    // ✅ temp local file delete
    if (fs.existsSync(inputPath)) {
      fs.unlinkSync(inputPath);
    }

    res.json({
      message: 'PDF uploaded successfully',
      filename: cleanFilename,
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