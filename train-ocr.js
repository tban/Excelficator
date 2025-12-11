// Training script to find optimal column detection parameters
import Tesseract from 'tesseract.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

// Expected structure based on user feedback:
// The penultimate row should have: DNI (42858868), Name columns, then various data columns
// "AC" and "8610" should be SEPARATE columns
// First name and second name should be TOGETHER in one column

async function runTraining() {
    console.log('🔍 Loading OCR data...');

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

    console.log('\n\n');

    const lines = result.data.lines;
    const parsedData = lines.map(line => ({
        text: line.text.trim(),
        words: line.words.map(w => ({
            text: w.text.trim(),
            left: w.bbox.x0,
            right: w.bbox.x1,
            confidence: w.confidence
        })),
        top: line.bbox.y0,
        bottom: line.bbox.y1
    }));

    // Analyze the penultimate line
    const penultimateLine = parsedData[parsedData.length - 2];
    console.log('📌 Penultimate line:', penultimateLine.text);
    console.log('📌 Words count:', penultimateLine.words.length);

    // Test different configurations
    const configs = [];

    // Generate configurations to test
    for (let binSize = 6; binSize <= 20; binSize += 2) {
        for (let minPercent = 0.10; minPercent <= 0.30; minPercent += 0.05) {
            for (let mergeThreshold = 8; mergeThreshold <= 25; mergeThreshold += 3) {
                for (let minGapMultiplier = 1.2; minGapMultiplier <= 2.0; minGapMultiplier += 0.2) {
                    configs.push({
                        binSize,
                        minPercent: Math.round(minPercent * 100) / 100,
                        mergeThreshold,
                        minGapMultiplier: Math.round(minGapMultiplier * 10) / 10
                    });
                }
            }
        }
    }

    console.log(`\n🔧 Testing ${configs.length} configurations...\n`);

    const results = [];

    for (const config of configs) {
        const columns = detectColumnsWithConfig(parsedData, config);
        const mappedRow = mapRowToColumns(penultimateLine, columns.boundaries);

        // Score this configuration
        const score = evaluateResult(mappedRow, columns.columns.length);

        results.push({
            config,
            numColumns: columns.columns.length,
            score,
            mappedRow
        });
    }

    // Sort by score (higher is better)
    results.sort((a, b) => b.score - a.score);

    console.log('🏆 TOP 10 CONFIGURATIONS:\n');
    for (let i = 0; i < Math.min(10, results.length); i++) {
        const r = results[i];
        console.log(`#${i + 1} Score: ${r.score.toFixed(2)} | Columns: ${r.numColumns}`);
        console.log(`   Config: binSize=${r.config.binSize}, minPercent=${r.config.minPercent}, mergeThreshold=${r.config.mergeThreshold}, minGapMultiplier=${r.config.minGapMultiplier}`);
        console.log(`   Sample: ${Object.values(r.mappedRow).slice(0, 5).join(' | ')}`);
        console.log('');
    }

    // Show best config details
    const best = results[0];
    console.log('='.repeat(80));
    console.log('📊 BEST CONFIGURATION DETAILS');
    console.log('='.repeat(80));
    console.log(`binSize: ${best.config.binSize}`);
    console.log(`minPercent: ${best.config.minPercent}`);
    console.log(`mergeThreshold: ${best.config.mergeThreshold}`);
    console.log(`minGapMultiplier: ${best.config.minGapMultiplier}`);
    console.log(`\nNumber of columns detected: ${best.numColumns}`);
    console.log('\nMapped row values:');
    Object.entries(best.mappedRow).forEach(([col, val], i) => {
        console.log(`  [${i + 1}] ${col}: "${val}"`);
    });
}

function detectColumnsWithConfig(parsedData, config) {
    const sampleLines = parsedData.slice(0, 50);
    const gapPositions = [];

    for (const line of sampleLines) {
        if (!line.words || line.words.length < 2) continue;

        const sortedWords = [...line.words]
            .filter(w => w.left !== undefined && w.right !== undefined)
            .sort((a, b) => a.left - b.left);

        const lineGaps = [];
        for (let i = 0; i < sortedWords.length - 1; i++) {
            const currentWord = sortedWords[i];
            const nextWord = sortedWords[i + 1];
            const gap = nextWord.left - currentWord.right;
            if (gap > 0) {
                lineGaps.push({
                    gap,
                    position: currentWord.right + (gap / 2),
                    rightEdge: currentWord.right
                });
            }
        }

        if (lineGaps.length > 1) {
            const avgGap = lineGaps.reduce((sum, g) => sum + g.gap, 0) / lineGaps.length;

            for (const lg of lineGaps) {
                if (lg.gap >= avgGap * config.minGapMultiplier) {
                    gapPositions.push({
                        position: lg.position,
                        gap: lg.gap
                    });
                }
            }
        }
    }

    if (gapPositions.length === 0) {
        return { columns: ['Data'], boundaries: [{ start: 0, end: Infinity }] };
    }

    const histogram = {};
    for (const gp of gapPositions) {
        const bin = Math.floor(gp.position / config.binSize) * config.binSize;
        if (!histogram[bin]) {
            histogram[bin] = { count: 0, totalGap: 0 };
        }
        histogram[bin].count++;
        histogram[bin].totalGap += gp.gap;
    }

    const minCount = Math.max(3, Math.floor(sampleLines.length * config.minPercent));
    const significantBins = Object.entries(histogram)
        .filter(([, data]) => data.count >= minCount)
        .map(([bin, data]) => ({
            position: parseInt(bin) + config.binSize / 2,
            count: data.count,
            avgGap: data.totalGap / data.count
        }))
        .sort((a, b) => a.position - b.position);

    const mergedBins = [];
    for (const bin of significantBins) {
        if (mergedBins.length === 0) {
            mergedBins.push(bin);
        } else {
            const lastBin = mergedBins[mergedBins.length - 1];
            if (bin.position - lastBin.position < config.mergeThreshold) {
                if (bin.count > lastBin.count) {
                    mergedBins[mergedBins.length - 1] = bin;
                }
            } else {
                mergedBins.push(bin);
            }
        }
    }

    const boundaries = [];
    if (mergedBins.length > 0) {
        boundaries.push({ start: 0, end: mergedBins[0].position });
        for (let i = 0; i < mergedBins.length - 1; i++) {
            boundaries.push({
                start: mergedBins[i].position,
                end: mergedBins[i + 1].position
            });
        }
        boundaries.push({
            start: mergedBins[mergedBins.length - 1].position,
            end: Infinity
        });
    } else {
        boundaries.push({ start: 0, end: Infinity });
    }

    const columns = boundaries.map((_, i) => `Col${i + 1}`);
    return { columns, boundaries };
}

function mapRowToColumns(line, boundaries) {
    const row = {};
    const sortedWords = [...line.words].sort((a, b) => (a.left || 0) - (b.left || 0));

    for (let j = 0; j < boundaries.length; j++) {
        const boundary = boundaries[j];
        const wordsInColumn = sortedWords.filter(w => {
            if (w.left === undefined) return false;
            const wordCenter = w.left + ((w.right || w.left) - w.left) / 2;
            return wordCenter >= boundary.start && wordCenter < boundary.end;
        });
        row[`Col${j + 1}`] = wordsInColumn.map(w => w.text).join(' ').trim();
    }

    return row;
}

function evaluateResult(mappedRow, numColumns) {
    let score = 0;
    const values = Object.values(mappedRow);

    // Criteria 1: DNI detection (should be first column, 8 digits)
    const firstCol = values[0] || '';
    if (/^\d{8}$/.test(firstCol.replace(/\s/g, ''))) {
        score += 20;
    }

    // Criteria 2: "AC" should be in its own column (not merged with numbers)
    const hasACColumn = values.some(v => v.trim() === 'AC');
    if (hasACColumn) {
        score += 15;
    }

    // Criteria 3: "8610" should be separate from "AC"
    const has8610Separate = values.some(v => v.trim() === '8610');
    if (has8610Separate) {
        score += 15;
    }

    // Criteria 4: Names should be together (ESTEBAN RAFAEL in one column)
    const hasFullName = values.some(v => v.includes('ESTEBAN') && v.includes('RAFAEL'));
    if (hasFullName) {
        score += 20;
    }

    // Criteria 5: No empty columns (penalize ghost columns)
    const emptyColumns = values.filter(v => !v || v.trim() === '').length;
    score -= emptyColumns * 5;

    // Criteria 6: Reasonable number of columns (15-25 is probably right for this table)
    if (numColumns >= 15 && numColumns <= 25) {
        score += 10;
    } else if (numColumns >= 12 && numColumns <= 28) {
        score += 5;
    }

    // Criteria 7: ACTIVIDADES HOSPITALARIAS should be together
    const hasFullActivity = values.some(v => v.includes('ACTIVIDADES') && v.includes('HOSPITALARIAS'));
    if (hasFullActivity) {
        score += 10;
    }

    return score;
}

runTraining().catch(console.error);
