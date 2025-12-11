// Quick test of the new column detection
import { detectColumnsQuick } from './src/ocr-processor.js';

const imagePath = './test/MANTENIMINETO 3.jpg';

async function test() {
    console.log('Testing column detection...\n');

    const result = await detectColumnsQuick(imagePath);

    console.log(`Columns detected: ${result.columns.length}`);
    console.log('\nColumns:');
    result.columns.forEach((col, i) => {
        console.log(`  [${i + 1}] ${col}`);
    });

    console.log('\nSample data (first row):');
    if (result.sampleData.length > 0) {
        const firstRow = result.sampleData[0];
        Object.entries(firstRow).forEach(([key, value]) => {
            console.log(`  ${key}: "${value}"`);
        });
    }
}

test().catch(console.error);
