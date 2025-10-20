import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { UploadService } from '../services/upload.service';
import { UploadRepository } from '../repositories/upload.repository';
import { JobQueueService } from '../services/job-queue.service';
import { logger } from '../utils/logger';

const router = Router();

// Initialize dependencies
const uploadRepository = new UploadRepository();
const jobQueueService = new JobQueueService();
const uploadService = new UploadService(uploadRepository, jobQueueService);
const uploadController = new UploadController(uploadService);

// File upload route - no authentication required for upload
router.post('/', uploadController.uploadMiddleware, uploadController.uploadFile.bind(uploadController));

// All other routes require authentication
router.get('/status/:jobId', uploadController.getJobStatus.bind(uploadController));
router.get('/history', uploadController.getUploadHistory.bind(uploadController));
router.post('/:jobId/cancel', uploadController.cancelJob.bind(uploadController));
router.post('/:jobId/retry', uploadController.retryJob.bind(uploadController));
router.delete('/:jobId', uploadController.deleteJob.bind(uploadController));
router.get('/:jobId/download', uploadController.downloadFile.bind(uploadController));

export { router as fileUploadRouter };