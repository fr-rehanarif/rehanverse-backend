const express = require('express');
const router = express.Router();
const upload = require('../middleware/upload');

router.post('/image', upload.single('image'), (req, res) => {
  console.log("REQ FILE:", req.file);

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  const url = `http://localhost:5000/uploads/${req.file.filename}`;
  res.json({ url });
});

module.exports = router;