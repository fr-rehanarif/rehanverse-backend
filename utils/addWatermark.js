const fs = require('fs');
const { PDFDocument, rgb, StandardFonts, degrees } = require('pdf-lib');

function drawArcText(page, text, centerX, centerY, radius, startAngle, endAngle, font, size, color) {
  const chars = text.split('');
  const total = chars.length;

  chars.forEach((ch, i) => {
    const angle = startAngle + ((endAngle - startAngle) * i) / Math.max(total - 1, 1);
    const rad = (Math.PI / 180) * angle;

    const x = centerX + radius * Math.cos(rad);
    const y = centerY + radius * Math.sin(rad);

    page.drawText(ch, {
      x,
      y,
      size,
      font,
      color,
      rotate: degrees(angle - 90),
      opacity: 0.18,
    });
  });
}

async function addWatermark(inputPath, outputPath, user = {}) {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const normalFont = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const username = user.name || 'REHANVERSE USER';
  const email = user.email || 'protected@rehanverse.com';

  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();

    const watermarkColor = rgb(0.45, 0.45, 0.45);

    const watermarks = [
      { x: width / 2, y: height * 0.72 },
      { x: width / 2, y: height * 0.28 },
    ];

    watermarks.forEach(({ x, y }) => {
      const outerR = 115;
      const innerR = 72;

      // outer circle
      page.drawCircle({
        x,
        y,
        size: outerR,
        borderColor: watermarkColor,
        borderWidth: 2,
        opacity: 0.16,
      });

      // inner circle
      page.drawCircle({
        x,
        y,
        size: innerR,
        borderColor: watermarkColor,
        borderWidth: 2,
        opacity: 0.14,
      });

      // RV logo center
      page.drawText('RV', {
        x: x - 48,
        y: y - 32,
        size: 64,
        font: boldFont,
        color: watermarkColor,
        opacity: 0.16,
      });

      // top rounded text
      drawArcText(
        page,
        'REHANVERSE',
        x - 8,
        y - 8,
        92,
        150,
        30,
        boldFont,
        17,
        watermarkColor
      );

      // bottom rounded text
      drawArcText(
        page,
        'PROTECTED',
        x - 5,
        y + 5,
        92,
        210,
        330,
        boldFont,
        17,
        watermarkColor
      );

      // username top
      page.drawText(username.toUpperCase(), {
        x: x - boldFont.widthOfTextAtSize(username.toUpperCase(), 14) / 2,
        y: y + 145,
        size: 14,
        font: boldFont,
        color: watermarkColor,
        opacity: 0.18,
      });

      // email bottom
      page.drawText(email.toLowerCase(), {
        x: x - normalFont.widthOfTextAtSize(email.toLowerCase(), 13) / 2,
        y: y - 158,
        size: 13,
        font: normalFont,
        color: watermarkColor,
        opacity: 0.18,
      });
    });

    // middle divider line
    page.drawLine({
      start: { x: 0, y: height / 2 },
      end: { x: width, y: height / 2 },
      thickness: 0.7,
      color: watermarkColor,
      opacity: 0.12,
    });
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = addWatermark;