import { Router } from 'express';
import { processCSVFile } from '../services/csvProcessor';
import { logger } from '../utils/logger';
import { UploadController } from '../../../controllers/upload.controller';
import { UploadService } from '../../../services/upload.service';
import { UploadRepository } from '../../../repositories/upload.repository';
import { JobQueueService } from '../../../services/job-queue.service';

const router = Router();

// Initialize dependencies
const uploadRepository = new UploadRepository();
const jobQueueService = new JobQueueService();
const uploadService = new UploadService(uploadRepository, jobQueueService);
const uploadController = new UploadController(uploadService);

router.post('/', uploadController.uploadMiddleware, uploadController.uploadFile.bind(uploadController));
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

// All routes except upload require authentication
router.get('/status/:jobId', uploadController.getJobStatus.bind(uploadController));
router.get('/history', uploadController.getUploadHistory.bind(uploadController));
router.post('/:jobId/cancel', uploadController.cancelJob.bind(uploadController));
router.post('/:jobId/retry', uploadController.retryJob.bind(uploadController));
router.delete('/:jobId', uploadController.deleteJob.bind(uploadController));
router.get('/:jobId/download', uploadController.downloadFile.bind(uploadController));

export { router as fileUploadRouter };