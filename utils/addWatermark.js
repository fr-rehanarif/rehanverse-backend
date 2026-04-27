const fs = require('fs');
const path = require('path');
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

async function addWatermark(inputPath, outputPath, user = {}) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const logoPath = path.join(__dirname, '../assets/rehanverse-logo.png');
  const logoBytes = fs.readFileSync(logoPath);
  const logoImage = await pdfDoc.embedPng(logoBytes);

  const username = user.name || 'REHANVERSE USER';
  const email = user.email || 'protected@rehanverse.com';

  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();

    const centerX = width / 2;

    // ✅ user name top
    page.drawText(username, {
      x: centerX - boldFont.widthOfTextAtSize(username, 18) / 2,
      y: height * 0.72,
      size: 18,
      font: boldFont,
      color: rgb(0.55, 0.35, 1),
      opacity: 0.16,
    });

    // ✅ REHANVERSE text above logo
    const brand = 'REHANVERSE';
    page.drawText(brand, {
      x: centerX - boldFont.widthOfTextAtSize(brand, 34) / 2,
      y: height * 0.61,
      size: 34,
      font: boldFont,
      color: rgb(0.55, 0.35, 1),
      opacity: 0.13,
    });

    // ✅ logo center
    const logoWidth = width * 0.55;
    const logoHeight = logoWidth * (logoImage.height / logoImage.width);

    page.drawImage(logoImage, {
      x: centerX - logoWidth / 2,
      y: height * 0.38,
      width: logoWidth,
      height: logoHeight,
      opacity: 0.08,
    });

    // ✅ email bottom
    page.drawText(email, {
      x: centerX - normalFont.widthOfTextAtSize(email, 16) / 2,
      y: height * 0.23,
      size: 16,
      font: normalFont,
      color: rgb(0.35, 0.35, 1),
      opacity: 0.16,
    });
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = addWatermark;