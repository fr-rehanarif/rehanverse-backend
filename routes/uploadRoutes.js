const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const upload = require('../middleware/upload');
const addWatermark = require('../utils/addWatermark');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ PDF UPLOAD + WATERMARK + SUPABASE
router.post('/pdf', upload.single('pdf'), async (req, res) => {
  try {
    console.log('PDF FILE:', req.file);

    if (!req.file) {
      return res.status(400).json({ message: 'No PDF uploaded' });
    }

    const inputPath = req.file.path;

    const watermarkedFilename = `watermarked-${Date.now()}-${req.file.originalname.replace(/\s+/g, '-')}`;
    const outputPath = path.join('uploads', watermarkedFilename);

    // ✅ watermark local temp file me lagega
    await addWatermark(
      inputPath,
      outputPath,
      'Rehan • rehanarif.mg • @REHANVERSE'
    );

    const fileBuffer = fs.readFileSync(outputPath);

    // ✅ watermarked PDF Supabase me upload
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
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({
      message: 'PDF watermarked and uploaded to Supabase',
      filename: watermarkedFilename,
      url: data.publicUrl,
    });
  } catch (error) {
    console.log('PDF watermark upload error:', error);
    res.status(500).json({
      message: 'PDF upload/watermark failed',
      error: error.message,
    });
  }
});

module.exports = router;