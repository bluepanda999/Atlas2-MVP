import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import { processCSVFile } from '../services/csvProcessor';
import { logger } from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, '/app/uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE || '3221225472') // 3GB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || 
        file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

router.post('/', upload.single('csvFile'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No file uploaded',
        message: 'Please select a CSV file to upload'
      });
    }

    logger.info(`Processing uploaded file: ${req.file.filename}`, {
      size: req.file.size,
      mimetype: req.file.mimetype
    });

    // Start processing the file
    const processingJob = await processCSVFile(req.file);

    res.status(202).json({
      message: 'File uploaded successfully',
      jobId: processingJob.id,
      filename: req.file.filename,
      size: req.file.size,
      status: 'processing'
    });

  } catch (error) {
    logger.error('File upload error:', error);
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    });
  }
});

router.get('/status/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    // TODO: Implement job status checking
    res.json({
      jobId,
      status: 'processing',
      progress: 0,
      message: 'Processing file...'
    });
  } catch (error) {
    logger.error('Status check error:', error);
    res.status(500).json({
      error: 'Status check failed',
      message: error.message
    });
  }
});

export { router as fileUploadRouter };