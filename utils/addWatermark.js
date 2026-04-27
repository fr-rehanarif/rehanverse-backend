const fs = require('fs');
const { PDFDocument, rgb, degrees, StandardFonts } = require('pdf-lib');

async function addWatermark(inputPath, outputPath, watermarkText = 'Rehan • rehanarif.mg • @REHANVERSE') {
  const existingPdfBytes = fs.readFileSync(inputPath);
  const pdfDoc = await PDFDocument.load(existingPdfBytes);

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  pages.forEach((page) => {
    const { width, height } = page.getSize();

    // ✅ Har page par 6 watermark
    const positions = [
      { x: width * 0.10, y: height * 0.80 },
      { x: width * 0.45, y: height * 0.90 },
      { x: width * 0.20, y: height * 0.55 },
      { x: width * 0.55, y: height * 0.60 },
      { x: width * 0.12, y: height * 0.30 },
      { x: width * 0.50, y: height * 0.25 },
    ];

    positions.forEach((pos) => {
      page.drawText(watermarkText, {
        x: pos.x,
        y: pos.y,
        size: 18,
        font,
        color: rgb(1, 0, 0),
        opacity: 0.16,
        rotate: degrees(35),
      });
    });
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

module.exports = addWatermark;