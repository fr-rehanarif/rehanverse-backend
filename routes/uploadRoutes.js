const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const upload = require('../middleware/upload');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PDF UPLOAD (NO WATERMARK HERE)
router.post('/pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('PDF FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'No PDF uploaded' });
    }

    const inputPath = req.file.path;

    const filename = `${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;

    const fileBuffer = fs.readFileSync(inputPath);

    // ✅ Direct Supabase upload (clean PDF)
    const { error } = await supabase.storage
      .from('course-pdfs')
      .upload(filename, fileBuffer, {
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
      .getPublicUrl(filename);

    // ✅ temp file delete
    fs.unlinkSync(inputPath);

    res.json({
      message: 'PDF uploaded (clean)',
      filename: filename,
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