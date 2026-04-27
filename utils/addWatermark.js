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

    const purple = rgb(0.45, 0.22, 0.95);
    const blue = rgb(0.25, 0.35, 1);

    // ✅ username - bohot upar + bigger + darker
    page.drawText(username, {
      x: centerX - boldFont.widthOfTextAtSize(username, 24) / 2,
      y: height * 0.84,
      size: 24,
      font: boldFont,
      color: purple,
      opacity: 0.34,
    });

    // ✅ REHANVERSE - logo se upar, overlap nahi karega
    const brand = 'R E H A N V E R S E';
    page.drawText(brand, {
      x: centerX - boldFont.widthOfTextAtSize(brand, 32) / 2,
      y: height * 0.68,
      size: 32,
      font: boldFont,
      color: purple,
      opacity: 0.30,
    });

    // ✅ logo center - thoda niche, readable but document disturb nahi karega
    const logoWidth = width * 0.58;
    const logoHeight = logoWidth * (logoImage.height / logoImage.width);

    page.drawImage(logoImage, {
      x: centerX - logoWidth / 2,
      y: height * 0.36,
      width: logoWidth,
      height: logoHeight,
      opacity: 0.15,
    });

    // ✅ email - bohot niche + bigger + darker
    page.drawText(email, {
      x: centerX - normalFont.widthOfTextAtSize(email, 20) / 2,
      y: height * 0.13,
      size: 20,
      font: normalFont,
      color: blue,
      opacity: 0.34,
    });
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = addWatermark;