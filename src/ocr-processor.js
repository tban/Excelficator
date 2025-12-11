import Tesseract from 'tesseract.js';
import ExcelJS from 'exceljs';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Quick column detection - analyzes first image to detect columns and sample data
 * This is used for the filter configuration step before full processing
 */
export async function detectColumnsQuick(imagePath) {
    console.log(`🔍 Quick column detection: ${path.basename(imagePath)}`);

    // Extract text using OCR
    const ocrResult = await performOCR(imagePath);

    // Parse the OCR result into structured data
    const parsedData = parseOCRResult(ocrResult);

    // Detect columns and boundaries
    const columnInfo = detectColumns(parsedData);
    console.log(`  📊 Detected ${columnInfo.columns.length} columns:`, columnInfo.columns);

    // Get sample data (first 5 rows) and add source filename
    const sourceFileName = path.basename(imagePath);
    const rawSampleData = mapDataToColumns(parsedData, columnInfo.columns, columnInfo.boundaries).slice(0, 5);
    const sampleData = rawSampleData.map(row => ({
        'Archivo Origen': sourceFileName,
        ...row
    }));

    // Include "Archivo Origen" as the first column
    const columnsWithSource = ['Archivo Origen', ...columnInfo.columns];

    return {
        columns: columnsWithSource,
        boundaries: columnInfo.boundaries,
        sampleData
    };
}

/**
 * Process multiple images and convert to Excel
 * The first image determines the column structure
 * @param {string[]} imagePaths - Array of image file paths
 * @param {Object} filters - Optional filters for processing
 * @param {string[]} filters.excludeColumns - Columns to exclude from output
 * @param {Object[]} filters.omitText - Array of {column, text} to omit rows containing that text
 */
export async function processImages(imagePaths, filters = null) {
    console.log(`📷 Processing ${imagePaths.length} image(s)...`);
    if (filters) {
        console.log(`  🔧 Filters applied:`, filters);
    }

    const allData = [];
    let columnInfo = null;
    let totalLinesProcessed = 0;
    let totalConfidenceSum = 0;
    let confidenceCount = 0;
    let lowConfidenceRows = 0;
    let filteredRows = 0;

    for (let i = 0; i < imagePaths.length; i++) {
        const imagePath = imagePaths[i];
        console.log(`  Processing image ${i + 1}/${imagePaths.length}: ${path.basename(imagePath)}`);

        // Extract text using OCR
        const ocrResult = await performOCR(imagePath);

        // Track confidence statistics
        if (ocrResult.lines) {
            for (const line of ocrResult.lines) {
                totalLinesProcessed++;
                if (line.words) {
                    for (const word of line.words) {
                        if (word.confidence !== undefined) {
                            totalConfidenceSum += word.confidence;
                            confidenceCount++;
                            if (word.confidence < 60) {
                                lowConfidenceRows++;
                            }
                        }
                    }
                }
            }
        }

        // Parse the OCR result into structured data
        const parsedData = parseOCRResult(ocrResult);

        if (i === 0) {
            // First image determines the column structure and boundaries
            columnInfo = detectColumns(parsedData);
            console.log(`  📊 Detected ${columnInfo.columns.length} columns:`, columnInfo.columns);
            if (columnInfo.boundaries) {
                console.log(`  📐 Column boundaries:`, columnInfo.boundaries.map(b => `${b.start}-${b.end === Infinity ? '∞' : b.end}`));
            }
        }

        // Map data to the detected column structure using boundaries
        let mappedData = mapDataToColumns(parsedData, columnInfo.columns, columnInfo.boundaries);

        // Add source filename to each row
        const sourceFileName = path.basename(imagePath);
        mappedData = mappedData.map(row => ({
            'Archivo Origen': sourceFileName,
            ...row
        }));

        // Apply filters if provided
        if (filters) {
            const beforeFilter = mappedData.length;
            mappedData = applyFilters(mappedData, filters, columnInfo.columns);
            filteredRows += beforeFilter - mappedData.length;
        }

        allData.push(...mappedData);

        console.log(`  ✅ Image ${i + 1}: ${mappedData.length} rows extracted (Total: ${allData.length})`);

        // Clean up uploaded image
        try {
            await fs.unlink(imagePath);
        } catch (e) {
            console.warn(`Could not delete temp file: ${imagePath}`);
        }
    }

    // Calculate accuracy percentage
    const avgConfidence = confidenceCount > 0 ? (totalConfidenceSum / confidenceCount) : 0;
    const accuracyPercent = Math.round(avgConfidence);
    const errorPercent = 100 - accuracyPercent;

    console.log(`  📊 OCR Accuracy: ${accuracyPercent}% (${allData.length} total rows extracted from ${imagePaths.length} images)`);
    if (filteredRows > 0) {
        console.log(`  🔧 Rows filtered out: ${filteredRows}`);
    }

    // Add "Archivo Origen" as the first column
    let finalColumns = ['Archivo Origen', ...columnInfo.columns];
    let finalData = allData;

    // Apply column exclusion for Excel generation (but always keep Archivo Origen)
    if (filters && filters.excludeColumns && filters.excludeColumns.length > 0) {
        const excludeSet = new Set(filters.excludeColumns);
        finalColumns = finalColumns.filter(col => col === 'Archivo Origen' || !excludeSet.has(col));
        finalData = allData.map(row => {
            const newRow = {};
            for (const col of finalColumns) {
                newRow[col] = row[col];
            }
            return newRow;
        });
        console.log(`  📊 Final columns after exclusion: ${finalColumns.length}`);
    }

    // Generate Excel file
    const excelResult = await generateExcel(finalColumns, finalData);

    return {
        downloadUrl: `/api/download/${excelResult.filename}`,
        preview: finalData.slice(0, 10),
        columns: finalColumns,
        totalRows: finalData.length,
        stats: {
            accuracyPercent,
            errorPercent,
            totalLinesProcessed,
            imagesProcessed: imagePaths.length,
            filteredRows
        }
    };
}

/**
 * Apply filters to the mapped data
 */
function applyFilters(data, filters, columns) {
    if (!filters || !filters.omitText || filters.omitText.length === 0) {
        return data;
    }

    return data.filter(row => {
        for (const rule of filters.omitText) {
            const columnValue = row[rule.column] || '';
            const textToOmit = rule.text || '';

            if (textToOmit && columnValue.toLowerCase().includes(textToOmit.toLowerCase())) {
                return false;
            }
        }
        return true;
    });
}

/**
 * Perform OCR on a single image with optimized settings for tables and numbers
 */
async function performOCR(imagePath) {
    const result = await Tesseract.recognize(imagePath, 'spa+eng', {
        logger: m => {
            if (m.status === 'recognizing text') {
                process.stdout.write(`\r    OCR Progress: ${Math.round(m.progress * 100)}%`);
            }
        },
        // PSM 6: Assume a single uniform block of text (good for tables)
        tessedit_pageseg_mode: '6',
        // Preserve spaces between words (important for column detection)
        preserve_interword_spaces: '1',
        // OEM 1: LSTM only (more accurate than legacy)
        tessedit_ocr_engine_mode: '1',
    });
    console.log('');
    return result.data;
}

/**
 * Post-process text - currently disabled as Tesseract does a good job with numbers
 * Keeping the function for potential future use
 */
function postProcessText(text) {
    if (!text) return text;
    // Return the original text - Tesseract's output is reliable
    // Post-processing was causing more harm than good
    return text.trim();
}

/**
 * Parse OCR result into lines and cells
 */
function parseOCRResult(ocrData) {
    const lines = [];

    if (ocrData.lines && ocrData.lines.length > 0) {
        for (const line of ocrData.lines) {
            const words = line.words.map(w => ({
                text: w.text.trim(),
                left: w.bbox.x0,
                right: w.bbox.x1,
                confidence: w.confidence
            }));

            if (words.length > 0) {
                lines.push({
                    text: line.text.trim(),
                    words,
                    top: line.bbox.y0,
                    bottom: line.bbox.y1
                });
            }
        }
    } else {
        const textLines = ocrData.text.split('\n').filter(l => l.trim());
        for (const textLine of textLines) {
            lines.push({
                text: textLine.trim(),
                words: textLine.split(/\s{2,}|\t/).map(w => ({ text: w.trim() }))
            });
        }
    }

    return lines;
}

/**
 * Detect stable column boundaries from the first image's data
 * Uses right-edge analysis: columns end where words consistently end across all lines
 */
function detectColumns(parsedData) {
    if (parsedData.length === 0) return { columns: ['Columna 1'], boundaries: null };

    const sampleLines = parsedData.slice(0, 50);

    // Strategy: Find positions where words consistently END (right edge)
    // These positions correspond to the vertical lines between columns

    const binSize = 8;
    const rightEdgeHistogram = {};

    // For each line, collect the right edges of words (only count each bin once per line)
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

    // Find bins where at least 40% of lines have a word ending there
    const minLineCount = Math.max(3, Math.floor(sampleLines.length * 0.4));

    let columnDividers = Object.entries(rightEdgeHistogram)
        .filter(([, count]) => count >= minLineCount)
        .map(([bin, count]) => ({
            // Use center of bin + small offset to account for spacing between columns
            position: parseInt(bin) + binSize / 2 + 2,
            count
        }))
        .sort((a, b) => a.position - b.position);

    // Merge dividers that are too close (within 12px)
    const mergedDividers = [];
    for (const div of columnDividers) {
        if (mergedDividers.length === 0) {
            mergedDividers.push(div);
        } else {
            const lastDiv = mergedDividers[mergedDividers.length - 1];
            if (div.position - lastDiv.position < 12) {
                // Keep the one with higher count
                if (div.count > lastDiv.count) {
                    mergedDividers[mergedDividers.length - 1] = div;
                }
            } else {
                mergedDividers.push(div);
            }
        }
    }

    console.log(`  📐 Detected ${mergedDividers.length + 1} columns from ${Object.keys(rightEdgeHistogram).length} edge positions`);

    // Create boundaries from the dividers
    const boundaries = [];

    if (mergedDividers.length > 0) {
        // First column: from 0 to first divider
        boundaries.push({ start: 0, end: mergedDividers[0].position });

        // Middle columns
        for (let i = 0; i < mergedDividers.length - 1; i++) {
            boundaries.push({
                start: mergedDividers[i].position,
                end: mergedDividers[i + 1].position
            });
        }

        // Last column: from last divider to infinity
        boundaries.push({
            start: mergedDividers[mergedDividers.length - 1].position,
            end: Infinity
        });
    } else {
        boundaries.push({ start: 0, end: Infinity });
    }

    // Get column names from header
    const headerLine = findHeaderLine(parsedData);
    let columnNames = [];

    if (headerLine && headerLine.words) {
        for (let i = 0; i < boundaries.length; i++) {
            const boundary = boundaries[i];
            // Use LEFT edge of word to determine which column it belongs to
            const wordsInColumn = headerLine.words
                .filter(w => {
                    if (w.left === undefined) return false;
                    return w.left >= boundary.start && w.left < boundary.end;
                })
                .map(w => w.text)
                .join(' ');
            columnNames.push(wordsInColumn || `Columna ${i + 1}`);
        }
    }

    if (columnNames.length === 0 || columnNames.every(c => c === '')) {
        columnNames = boundaries.map((_, i) => `Columna ${i + 1}`);
    }

    return { columns: columnNames, boundaries };
}

/**
 * Fallback column detection using word start positions
 */
function detectColumnsByStartPositions(parsedData) {
    const sampleLines = parsedData.slice(0, 30);
    const allPositions = [];

    for (const line of sampleLines) {
        if (line.words) {
            for (const word of line.words) {
                if (word.left !== undefined) {
                    allPositions.push(word.left);
                }
            }
        }
    }

    if (allPositions.length === 0) {
        return { columns: ['Datos'], boundaries: null };
    }

    allPositions.sort((a, b) => a - b);

    // Use a smaller gap threshold (20px instead of 50px)
    const groupedPositions = [];
    let currentGroup = [allPositions[0]];

    for (let i = 1; i < allPositions.length; i++) {
        const gap = allPositions[i] - allPositions[i - 1];
        if (gap < 20) {
            currentGroup.push(allPositions[i]);
        } else {
            if (currentGroup.length > 0) {
                groupedPositions.push({
                    start: Math.min(...currentGroup),
                    count: currentGroup.length
                });
            }
            currentGroup = [allPositions[i]];
        }
    }

    if (currentGroup.length > 0) {
        groupedPositions.push({
            start: Math.min(...currentGroup),
            count: currentGroup.length
        });
    }

    const threshold = Math.max(2, sampleLines.length * 0.1);
    const significantPositions = groupedPositions
        .filter(g => g.count >= threshold)
        .map(g => g.start)
        .sort((a, b) => a - b);

    const boundaries = [];
    for (let i = 0; i < significantPositions.length; i++) {
        const start = significantPositions[i];
        const end = i < significantPositions.length - 1
            ? significantPositions[i + 1] - 5
            : Infinity;
        boundaries.push({ start, end });
    }

    const headerLine = findHeaderLine(parsedData);
    let columnNames = [];

    if (headerLine && headerLine.words) {
        for (let i = 0; i < boundaries.length; i++) {
            const boundary = boundaries[i];
            const wordsInColumn = headerLine.words
                .filter(w => w.left !== undefined && w.left >= boundary.start && w.left < boundary.end)
                .map(w => w.text)
                .join(' ');
            columnNames.push(wordsInColumn || `Columna ${i + 1}`);
        }
    }

    if (columnNames.length === 0 || columnNames.every(c => c === '')) {
        columnNames = boundaries.map((_, i) => `Columna ${i + 1}`);
    }

    return { columns: columnNames, boundaries };
}

/**
 * Find the most likely header line in the data
 */
function findHeaderLine(parsedData) {
    const candidates = parsedData.slice(0, 5);

    for (const line of candidates) {
        const text = line.text.toLowerCase();
        const headerKeywords = ['nombre', 'fecha', 'id', 'codigo', 'código', 'descripcion',
            'descripción', 'cantidad', 'precio', 'total', 'numero', 'número',
            'tipo', 'estado', 'documento', 'cedula', 'cédula', 'telefono',
            'teléfono', 'direccion', 'dirección', 'email', 'correo'];

        const matchCount = headerKeywords.filter(kw => text.includes(kw)).length;
        if (matchCount >= 2) {
            return line;
        }
    }

    for (const line of candidates) {
        if (line.words && line.words.length >= 2) {
            return line;
        }
    }

    return null;
}

/**
 * Map parsed data to the detected column structure using position boundaries
 * Uses word center position for more accurate column assignment
 */
function mapDataToColumns(parsedData, columns, boundaries) {
    const rows = [];
    const startIndex = findHeaderLineIndex(parsedData);

    for (let i = startIndex; i < parsedData.length; i++) {
        const line = parsedData[i];
        const row = {};

        if (line.words && line.words.length > 0 && boundaries && boundaries.length > 0) {
            const sortedWords = [...line.words].sort((a, b) => (a.left || 0) - (b.left || 0));

            for (let j = 0; j < columns.length; j++) {
                const boundary = boundaries[j];
                if (boundary) {
                    // Use LEFT edge of word to determine which column it belongs to
                    const wordsInColumn = sortedWords.filter(w => {
                        if (w.left === undefined) return false;
                        return w.left >= boundary.start && w.left < boundary.end;
                    });
                    const rawValue = wordsInColumn.map(w => w.text).join(' ').trim();
                    // Apply post-processing to fix common OCR errors
                    row[columns[j]] = postProcessText(rawValue);
                } else {
                    row[columns[j]] = '';
                }
            }
        } else if (line.words && line.words.length > 0) {
            const sortedWords = [...line.words].sort((a, b) => (a.left || 0) - (b.left || 0));
            for (let j = 0; j < columns.length; j++) {
                const rawValue = sortedWords[j]?.text || '';
                row[columns[j]] = postProcessText(rawValue);
            }
        } else {
            const parts = line.text.split(/\s{2,}|\t/).filter(p => p.trim());
            for (let j = 0; j < columns.length; j++) {
                const rawValue = parts[j]?.trim() || '';
                row[columns[j]] = postProcessText(rawValue);
            }
        }

        const hasContent = Object.values(row).some(v => v.length > 0);
        if (hasContent) {
            rows.push(row);
        }
    }

    return rows;
}

/**
 * Find the index of the header line
 */
function findHeaderLineIndex(parsedData) {
    const candidates = parsedData.slice(0, 5);

    for (let i = 0; i < candidates.length; i++) {
        const text = candidates[i].text.toLowerCase();
        const headerKeywords = ['nombre', 'fecha', 'id', 'codigo', 'descripcion',
            'cantidad', 'precio', 'total', 'numero', 'tipo'];

        const matchCount = headerKeywords.filter(kw => text.includes(kw)).length;
        if (matchCount >= 2) {
            return i + 1;
        }
    }

    return 0;
}

/**
 * Generate Excel file from the processed data
 */
async function generateExcel(columns, data) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Excelficator';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Datos Extraídos', {
        views: [{ state: 'frozen', ySplit: 1 }]
    });

    worksheet.columns = columns.map(col => ({
        header: col,
        key: col,
        width: Math.max(col.length + 5, 15)
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4A90D9' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 25;

    for (const rowData of data) {
        const row = worksheet.addRow(rowData);
        row.alignment = { vertical: 'middle' };
    }

    for (let i = 2; i <= worksheet.rowCount; i++) {
        const row = worksheet.getRow(i);
        if (i % 2 === 0) {
            row.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF5F8FC' }
            };
        }
    }

    worksheet.eachRow((row) => {
        row.eachCell((cell) => {
            cell.border = {
                top: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                left: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                bottom: { style: 'thin', color: { argb: 'FFD0D0D0' } },
                right: { style: 'thin', color: { argb: 'FFD0D0D0' } }
            };
        });
    });

    worksheet.columns.forEach(column => {
        let maxLength = column.header.length;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 0;
            maxLength = Math.max(maxLength, cellLength);
        });
        column.width = Math.min(maxLength + 2, 50);
    });

    const filename = `excelficator-${Date.now()}.xlsx`;
    const filePath = path.join(__dirname, '../uploads', filename);
    await workbook.xlsx.writeFile(filePath);

    console.log(`📁 Excel file saved: ${filename}`);

    return { filename, filePath };
}
