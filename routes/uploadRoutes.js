const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

// ✅ PDF UPLOAD ROUTE
router.post('/pdf', upload.single('pdf'), (req, res) => {
  console.log("PDF FILE:", req.file);

  if (!req.file) {
    return res.status(400).json({ message: 'No PDF uploaded' });
  }

  // ✅ sirf filename bhejna hai (important)
  res.json({
    filename: req.file.filename
  });
});

module.exports = router;