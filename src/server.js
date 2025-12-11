import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { processImages, detectColumnsQuick } from './ocr-processor.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + file.originalname);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp', 'image/tiff'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos de imagen'));
    }
  }
});

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Quick column detection endpoint - analyze first image to detect columns
app.post('/api/detect', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos' });
    }

    const imagePaths = req.files.map(f => f.path);

    // Quick detection on first image only
    const result = await detectColumnsQuick(imagePaths[0]);

    res.json({
      success: true,
      columns: result.columns,
      sampleData: result.sampleData,
      imagePaths: imagePaths, // Return paths for subsequent processing
      totalImages: imagePaths.length
    });
  } catch (error) {
    console.error('Error detecting columns:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload and process images endpoint with filters
app.post('/api/process', express.json(), async (req, res) => {
  try {
    const { imagePaths, filters } = req.body;

    if (!imagePaths || imagePaths.length === 0) {
      return res.status(400).json({ error: 'No hay imágenes para procesar' });
    }

    // Process images with filters and generate Excel
    const result = await processImages(imagePaths, filters);

    res.json({
      success: true,
      message: `Se procesaron ${imagePaths.length} imagen(es)`,
      downloadUrl: result.downloadUrl,
      preview: result.preview,
      columns: result.columns,
      totalRows: result.totalRows,
      stats: result.stats
    });
  } catch (error) {
    console.error('Error processing images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Legacy endpoint for direct processing (without filter step)
app.post('/api/process-direct', upload.array('images', 50), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No se subieron archivos' });
    }

    const imagePaths = req.files.map(f => f.path);

    // Process images and generate Excel
    const result = await processImages(imagePaths);

    res.json({
      success: true,
      message: `Se procesaron ${req.files.length} imagen(es)`,
      downloadUrl: result.downloadUrl,
      preview: result.preview,
      columns: result.columns,
      totalRows: result.totalRows,
      stats: result.stats
    });
  } catch (error) {
    console.error('Error processing images:', error);
    res.status(500).json({ error: error.message });
  }
});

// Download Excel file
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(__dirname, '../uploads', req.params.filename);
  res.download(filePath);
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Excelficator running at http://localhost:${PORT}`);
});
