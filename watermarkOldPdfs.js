const fs = require('fs');
const path = require('path');
const addWatermark = require('./utils/addWatermark');

const uploadsFolder = path.join(__dirname, 'uploads');

async function watermarkOldPdfs() {
  try {
    const files = fs.readdirSync(uploadsFolder);

    for (const file of files) {
      if (
        file.toLowerCase().endsWith('.pdf') &&
        !file.startsWith('watermarked-')
      ) {
        const inputPath = path.join(uploadsFolder, file);
        const watermarkedName = `watermarked-${file}`;
        const outputPath = path.join(uploadsFolder, watermarkedName);

        console.log('Watermarking:', file);

        await addWatermark(
          inputPath,
          outputPath,
          'Rehan • rehanarif.mg • @REHANVERSE'
        );

        console.log('Done:', watermarkedName);
      }
    }

    console.log('All old PDFs watermarked ✅');
  } catch (error) {
    console.log('Error:', error);
  }
}

watermarkOldPdfs();