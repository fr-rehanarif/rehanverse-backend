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
    const watermarkText = `${userName} • ${userEmail} • REHANVERSE`;

    pdfDoc.getPages().forEach((page) => {
      const { width, height } = page.getSize();

      // ✅ Premium center diagonal watermark
      page.drawText(watermarkText, {
        x: width * 0.10,
        y: height * 0.48,
        size: 22,
        font,
        color: rgb(1, 0, 0),
        opacity: 0.12,
        rotate: degrees(35),
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