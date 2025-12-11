// Debug column detection - with updated algorithm
import Tesseract from 'tesseract.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

async function debug() {
    console.log('🔍 Loading OCR data...');

    const result = await Tesseract.recognize(imagePath, 'spa+eng', {
        tessedit_pageseg_mode: '6',
        preserve_interword_spaces: '1',
        tessedit_ocr_engine_mode: '1',
    });

    const lines = result.data.lines;
    const parsedData = lines.map(line => ({
        text: line.text.trim(),
        words: line.words.map(w => ({
            text: w.text.trim(),
            left: w.bbox.x0,
            right: w.bbox.x1,
        })),
    }));

    const sampleLines = parsedData.slice(0, 50);

    const binSize = 8;
    const rightEdgeHistogram = {};

    for (const line of sampleLines) {
        if (!line.words || line.words.length < 1) continue;

        const usedBins = new Set();
        for (const word of line.words) {
            if (word.right === undefined) continue;
            const bin = Math.floor(word.right / binSize) * binSize;
            if (!usedBins.has(bin)) {
                usedBins.add(bin);
                if (!rightEdgeHistogram[bin]) {
                    rightEdgeHistogram[bin] = 0;
                }
                rightEdgeHistogram[bin]++;
            }
        }
    }

    const minLineCount = Math.max(3, Math.floor(sampleLines.length * 0.4));

    let columnDividers = Object.entries(rightEdgeHistogram)
        .filter(([, count]) => count >= minLineCount)
        .map(([bin, count]) => ({
            // Use center of bin + small offset
            position: parseInt(bin) + binSize / 2 + 2,
            count
        }))
        .sort((a, b) => a.position - b.position);

    console.log('\n📊 All column dividers before merge:');
    for (const d of columnDividers) {
        console.log(`  Position ${d.position} (count: ${d.count})`);
    }

    // Merge with 12px threshold
    const mergedDividers = [];
    for (const div of columnDividers) {
        if (mergedDividers.length === 0) {
            mergedDividers.push(div);
        } else {
            const lastDiv = mergedDividers[mergedDividers.length - 1];
            if (div.position - lastDiv.position < 12) {
                if (div.count > lastDiv.count) {
                    mergedDividers[mergedDividers.length - 1] = div;
                }
            } else {
                mergedDividers.push(div);
            }
        }
    }

    console.log('\n📐 Merged dividers:');
    for (const d of mergedDividers) {
        console.log(`  Position ${d.position}`);
    }

    // Create boundaries
    const boundaries = [];
    if (mergedDividers.length > 0) {
        boundaries.push({ start: 0, end: mergedDividers[0].position });
        for (let i = 0; i < mergedDividers.length - 1; i++) {
            boundaries.push({
                start: mergedDividers[i].position,
                end: mergedDividers[i + 1].position
            });
        }
        boundaries.push({
            start: mergedDividers[mergedDividers.length - 1].position,
            end: Infinity
        });
    }

    // Apply to penultimate line
    const penLine = parsedData[parsedData.length - 2];
    console.log('\n📌 Penultimate line mapping:');

    const sortedWords = [...penLine.words].sort((a, b) => a.left - b.left);

    for (let j = 0; j < boundaries.length; j++) {
        const boundary = boundaries[j];
        const wordsInColumn = sortedWords.filter(w => {
            return w.left >= boundary.start && w.left < boundary.end;
        });
        const text = wordsInColumn.map(w => w.text).join(' ');
        if (text) {
            console.log(`  Column ${j + 1} (${boundary.start}-${boundary.end}): "${text}"`);
        }
    }

    // Show AC and 8610 specifically
    console.log('\n🔍 AC and 8610 positions:');
    for (const w of sortedWords) {
        if (w.text === 'AC' || w.text === '8610') {
            console.log(`  "${w.text}": left=${w.left}, right=${w.right}`);
            for (let j = 0; j < boundaries.length; j++) {
                const b = boundaries[j];
                if (w.left >= b.start && w.left < b.end) {
                    console.log(`    -> Assigned to column ${j + 1} (${b.start}-${b.end})`);
                }
            }
        }
    }
}

debug().catch(console.error);
