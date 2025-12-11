// Analyze word edges to find column boundaries
import Tesseract from 'tesseract.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

async function analyzeWordEdges() {
    console.log('🔍 Loading OCR data...');

    const result = await Tesseract.recognize(imagePath, 'spa+eng', {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: '1',
    });

    console.log('\n\n📊 Analyzing word RIGHT EDGES across all lines...\n');

    const lines = result.data.lines;

    // Collect all right edges of words
    const rightEdges = [];
    const leftEdges = [];

    for (const line of lines) {
        for (const word of line.words) {
            rightEdges.push(word.bbox.x1);
            leftEdges.push(word.bbox.x0);
        }
    }

    // Create histogram of right edges
    console.log('RIGHT EDGE HISTOGRAM (where columns might end):');
    const rightHist = createHistogram(rightEdges, 10);
    printTopBins(rightHist, 25);

    console.log('\n\nLEFT EDGE HISTOGRAM (where columns might start):');
    const leftHist = createHistogram(leftEdges, 10);
    printTopBins(leftHist, 25);

    // Now analyze the penultimate line specifically
    const penLine = lines[lines.length - 2];
    console.log('\n\n📌 PENULTIMATE LINE WORD POSITIONS:');
    console.log('Full text:', penLine.text);
    console.log('\nWord boundaries:');

    const sortedWords = [...penLine.words].sort((a, b) => a.bbox.x0 - b.bbox.x0);
    for (let i = 0; i < sortedWords.length; i++) {
        const w = sortedWords[i];
        console.log(`  "${w.text.padEnd(20)}" | left: ${String(w.bbox.x0).padStart(4)} | right: ${String(w.bbox.x1).padStart(4)} | width: ${String(w.bbox.x1 - w.bbox.x0).padStart(3)}`);
    }

    // Find the most common right edges that could be column boundaries
    console.log('\n\n🔍 SEARCHING FOR COLUMN BOUNDARIES...');
    console.log('Looking for positions where many words end (right edge):\n');

    const binSize = 8;
    const histRight = {};

    for (const line of lines) {
        const usedBins = new Set(); // Only count each bin once per line
        for (const word of line.words) {
            const bin = Math.floor(word.bbox.x1 / binSize) * binSize;
            if (!usedBins.has(bin)) {
                usedBins.add(bin);
                if (!histRight[bin]) histRight[bin] = 0;
                histRight[bin]++;
            }
        }
    }

    const sortedBins = Object.entries(histRight)
        .map(([bin, count]) => ({ pos: parseInt(bin), count }))
        .filter(b => b.count >= lines.length * 0.4) // At least 40% of lines have a word ending here
        .sort((a, b) => a.pos - b.pos);

    console.log('Positions where at least 40% of lines have a word ending:');
    for (const b of sortedBins) {
        console.log(`  Position ${b.pos}-${b.pos + binSize}: ${b.count} lines (${Math.round(b.count / lines.length * 100)}%)`);
    }

    // These positions are likely column boundaries!
    console.log('\n\n📐 SUGGESTED COLUMN BOUNDARIES (right edges):');

    // Merge close positions
    const merged = [];
    for (const b of sortedBins) {
        if (merged.length === 0 || b.pos - merged[merged.length - 1].pos > 20) {
            merged.push(b);
        } else if (b.count > merged[merged.length - 1].count) {
            merged[merged.length - 1] = b;
        }
    }

    console.log('Merged boundaries:');
    for (const b of merged) {
        console.log(`  ~${b.pos}px`);
    }

    // Apply these boundaries to the penultimate line
    console.log('\n\n📊 APPLYING BOUNDARIES TO PENULTIMATE LINE:');

    let colStart = 0;
    for (let i = 0; i < merged.length; i++) {
        const colEnd = merged[i].pos + binSize;
        const wordsInCol = sortedWords.filter(w => {
            const center = (w.bbox.x0 + w.bbox.x1) / 2;
            return center >= colStart && center < colEnd;
        });
        const text = wordsInCol.map(w => w.text).join(' ');
        console.log(`  Column ${i + 1} (${colStart}-${colEnd}): "${text}"`);
        colStart = colEnd;
    }

    // Last column
    const lastWords = sortedWords.filter(w => {
        const center = (w.bbox.x0 + w.bbox.x1) / 2;
        return center >= colStart;
    });
    console.log(`  Column ${merged.length + 1} (${colStart}-∞): "${lastWords.map(w => w.text).join(' ')}"`);
}

function createHistogram(values, binSize) {
    const hist = {};
    for (const v of values) {
        const bin = Math.floor(v / binSize) * binSize;
        if (!hist[bin]) hist[bin] = 0;
        hist[bin]++;
    }
    return hist;
}

function printTopBins(hist, n) {
    const sorted = Object.entries(hist)
        .map(([bin, count]) => ({ bin: parseInt(bin), count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, n);

    for (const b of sorted) {
        console.log(`  ${b.bin}-${b.bin + 10}px: ${'█'.repeat(Math.min(b.count, 50))} (${b.count})`);
    }
}

analyzeWordEdges().catch(console.error);
