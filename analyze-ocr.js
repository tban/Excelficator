// Diagnostic script to analyze OCR output and gaps
import Tesseract from 'tesseract.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

async function analyzeImage() {
    console.log('🔍 Analyzing image:', imagePath);

    const result = await Tesseract.recognize(imagePath, 'spa+eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                process.stdout.write(`\r    OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        },
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: '1',
    });

    console.log('\n\n📊 Analyzing lines and gaps...\n');

    const lines = result.data.lines;

    // Analyze penultimate line specifically
    const penultimateLine = lines[lines.length - 2];

    if (penultimateLine) {
        console.log('='.repeat(80));
        console.log('📌 PENULTIMATE LINE ANALYSIS');
        console.log('='.repeat(80));
        console.log('Full text:', penultimateLine.text);
        console.log('\nWords with positions:');

        const sortedWords = [...penultimateLine.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

        for (let i = 0; i < sortedWords.length; i++) {
            const word = sortedWords[i];
            const nextWord = sortedWords[i + 1];
            const gap = nextWord ? nextWord.bbox.x0 - word.bbox.x1 : 0;

            console.log(`  [${i + 1}] "${word.text}" | left: ${word.bbox.x0}, right: ${word.bbox.x1}, width: ${word.bbox.x1 - word.bbox.x0} | gap to next: ${gap}px`);
        }
    }

    console.log('\n\n📐 GAP ANALYSIS FOR ALL LINES');
    console.log('='.repeat(80));

    // Collect all gaps from all lines
    const allGaps = [];

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
        const line = lines[lineIdx];
        const sortedWords = [...line.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);

        for (let i = 0; i < sortedWords.length - 1; i++) {
            const currentWord = sortedWords[i];
            const nextWord = sortedWords[i + 1];
            const gap = nextWord.bbox.x0 - currentWord.bbox.x1;

            if (gap > 0) {
                allGaps.push({
                    gap,
                    position: currentWord.bbox.x1 + gap / 2,
                    lineIdx,
                    words: `"${currentWord.text}" -> "${nextWord.text}"`
                });
            }
        }
    }

    // Sort gaps by size
    allGaps.sort((a, b) => b.gap - a.gap);

    console.log('\nTop 30 largest gaps:');
    for (let i = 0; i < Math.min(30, allGaps.length); i++) {
        const g = allGaps[i];
        console.log(`  Gap: ${g.gap}px at position ${Math.round(g.position)}px | Line ${g.lineIdx + 1} | ${g.words}`);
    }

    // Analyze gap distribution
    console.log('\n\n📈 GAP DISTRIBUTION');
    console.log('='.repeat(80));

    const gapValues = allGaps.map(g => g.gap);
    const avgGap = gapValues.reduce((a, b) => a + b, 0) / gapValues.length;
    const maxGap = Math.max(...gapValues);
    const minGap = Math.min(...gapValues);

    console.log(`  Min gap: ${minGap}px`);
    console.log(`  Max gap: ${maxGap}px`);
    console.log(`  Average gap: ${avgGap.toFixed(2)}px`);

    // Count gaps in different ranges
    const ranges = [5, 10, 15, 20, 25, 30, 40, 50, 100];
    console.log('\n  Gap ranges:');
    for (let i = 0; i < ranges.length; i++) {
        const min = i === 0 ? 0 : ranges[i - 1];
        const max = ranges[i];
        const count = gapValues.filter(g => g > min && g <= max).length;
        console.log(`    ${min}-${max}px: ${count} gaps`);
    }
    const largeCount = gapValues.filter(g => g > 100).length;
    console.log(`    >100px: ${largeCount} gaps`);
}

analyzeImage().catch(console.error);
