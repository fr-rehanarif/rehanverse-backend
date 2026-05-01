const express = require('express');
const router = express.Router();
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

const { protect } = require('../middleware/authMiddleware');

// ✅ POST /api/pdf/view
// Body: { pdfUrl }
// Dynamic watermark using current logged-in user + REHANVERSE logo
router.post('/view', protect, async (req, res) => {
  try {
    const { pdfUrl } = req.body;

    if (!pdfUrl) {
      return res.status(400).json({ message: 'PDF URL required' });
    }

    console.log('PDF VIEW USER:', req.user);
    console.log('PDF URL:', pdfUrl);

    // ✅ Download clean PDF from Supabase/public URL
    const response = await axios.get(pdfUrl, {
      responseType: 'arraybuffer',
    });

    const pdfDoc = await PDFDocument.load(response.data);

    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

    // ✅ Logo path
    const logoPath = path.join(__dirname, '../assets/rehanverse-logo.png');

    let logoImage = null;

    if (fs.existsSync(logoPath)) {
      const logoBytes = fs.readFileSync(logoPath);
      logoImage = await pdfDoc.embedPng(logoBytes);
      console.log('✅ REHANVERSE logo loaded successfully');
    } else {
      console.log('❌ Logo not found at:', logoPath);
    }

    // ✅ Current logged-in user details
    const userName =
      req.user?.name ||
      req.user?.fullName ||
      req.user?.username ||
      'REHANVERSE USER';

    const userEmail =
      req.user?.email ||
      'protected@rehanverse.com';

    pdfDoc.getPages().forEach((page) => {
      const { width, height } = page.getSize();
      const centerX = width / 2;

      const purple = rgb(0.45, 0.22, 0.95);
      const blue = rgb(0.25, 0.35, 1);

      // ✅ USER NAME - top
      page.drawText(userName, {
        x: centerX - boldFont.widthOfTextAtSize(userName, 24) / 2,
        y: height * 0.82,
        size: 24,
        font: boldFont,
        color: purple,
        opacity: 0.34,
      });

      // ✅ BRAND TEXT
      const brand = 'R E H A N V E R S E';

      page.drawText(brand, {
        x: centerX - boldFont.widthOfTextAtSize(brand, 34) / 2,
        y: height * 0.62,
        size: 34,
        font: boldFont,
        color: purple,
        opacity: 0.30,
      });

      // ✅ LOGO CENTER WATERMARK
      if (logoImage) {
        const logoWidth = width * 0.46;
        const logoHeight = logoWidth * (logoImage.height / logoImage.width);

        page.drawImage(logoImage, {
          x: centerX - logoWidth / 2,
          y: height * 0.34,
          width: logoWidth,
          height: logoHeight,
          opacity: 0.14,
        });
      }

      // ✅ PROTECTED TEXT
      const protectedText = 'Protected Content';

      page.drawText(protectedText, {
        x: centerX - boldFont.widthOfTextAtSize(protectedText, 18) / 2,
        y: height * 0.27,
        size: 18,
        font: boldFont,
        color: purple,
        opacity: 0.20,
      });

      // ✅ EMAIL - bottom
      page.drawText(userEmail, {
        x: centerX - normalFont.widthOfTextAtSize(userEmail, 18) / 2,
        y: height * 0.12,
        size: 18,
        font: normalFont,
        color: blue,
        opacity: 0.34,
      });
    });

    const watermarkedPdf = await pdfDoc.save();

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'inline; filename="rehanverse-protected-notes.pdf"'
    );
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