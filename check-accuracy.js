// Check what accuracy the OCR is returning
import Tesseract from 'tesseract.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

async function checkAccuracy() {
    console.log('🔍 Checking OCR accuracy...');

    const result = await Tesseract.recognize(imagePath, 'spa+eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                process.stdout.write(`\r    Progress: ${Math.round(m.progress * 100)}%`);
            }
        },
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: '1',
    });

    console.log('\n\n📊 Accuracy Analysis:');

    // Calculate average confidence
    let totalConfidence = 0;
    let wordCount = 0;
    let lowConfidenceWords = 0;

    for (const line of result.data.lines) {
        for (const word of line.words) {
            totalConfidence += word.confidence;
            wordCount++;
            if (word.confidence < 80) {
                lowConfidenceWords++;
            }
        }
    }

    const avgConfidence = wordCount > 0 ? totalConfidence / wordCount : 0;
    const accuracyPercent = Math.round(avgConfidence);
    const errorPercent = 100 - accuracyPercent;

    console.log(`  Total words: ${wordCount}`);
    console.log(`  Low confidence words (<80%): ${lowConfidenceWords}`);
    console.log(`  Average confidence: ${avgConfidence.toFixed(2)}%`);
    console.log(`  Accuracy percent (rounded): ${accuracyPercent}%`);
    console.log(`  Error percent: ${errorPercent}%`);

    console.log('\n📋 Warning threshold check:');
    if (accuracyPercent >= 85) {
        console.log('  ✅ No warning should appear (accuracy >= 85%)');
    } else if (accuracyPercent >= 70) {
        console.log('  ⚠️ Yellow warning should appear (70% <= accuracy < 85%)');
    } else {
        console.log('  🔴 Red warning should appear (accuracy < 70%)');
    }
}

checkAccuracy().catch(console.error);
