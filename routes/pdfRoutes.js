const express = require('express');
const router = express.Router();
const axios = require('axios');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');

const { protect } = require('../middleware/authMiddleware');

// POST /api/pdf/view
router.post('/view', protect, async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ message: 'PDF URL required' });
    }

    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
    });

    const pdfDoc = await PDFDocument.load(response.data);
    const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const userName = req.user?.name || 'User';
    const userEmail = req.user?.email || 'protected-user';

    pdfDoc.getPages().forEach((page) => {
      const { width, height } = page.getSize();

      // ✅ Premium circular/stamp-style watermark
      const centerX = width * 0.5;
      const centerY = height * 0.52;

      page.drawText('REHANVERSE', {
        x: centerX - 95,
        y: centerY + 20,
        size: 34,
        font,
        color: rgb(1, 0, 0),
        opacity: 0.09,
        rotate: degrees(-18),
      });

      page.drawText('PROTECTED CONTENT', {
        x: centerX - 118,
        y: centerY - 18,
        size: 18,
        font,
        color: rgb(1, 0, 0),
        opacity: 0.08,
        rotate: degrees(-18),
      });

      page.drawText(`${userName} • ${userEmail}`, {
        x: centerX - 140,
        y: centerY - 48,
        size: 12,
        font,
        color: rgb(1, 0, 0),
        opacity: 0.07,
        rotate: degrees(-18),
      });
    });

    const watermarkedPdf = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="rehanverse-notes.pdf"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');

    return res.send(Buffer.from(watermarkedPdf));
  } catch (err) {
    console.log('PDF route error:', err);
    return res.status(500).json({
      message: 'PDF server error',
      error: err.message,
    });
  }
});

module.exports = router;