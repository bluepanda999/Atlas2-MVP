import { Router } from 'express';
import { UploadController } from '../controllers/upload.controller';
import { AuthMiddleware } from '../middleware/auth.middleware';
import { ErrorMiddleware } from '../middleware/error.middleware';

export function createUploadRoutes(
  uploadController: UploadController,
  authMiddleware: AuthMiddleware,
  errorMiddleware: ErrorMiddleware
): Router {
  const router = Router();

  // All upload routes require authentication
  router.use(authMiddleware.authenticate);

  // File upload
  router.post(
    '/upload',
    uploadController.uploadMiddleware,
    errorMiddleware.asyncHandler(uploadController.uploadFile)
  );

  // Job management
  router.get('/jobs/:jobId', errorMiddleware.asyncHandler(uploadController.getJobStatus));
  router.get('/jobs', errorMiddleware.asyncHandler(uploadController.getUploadHistory));
  router.post('/jobs/:jobId/cancel', errorMiddleware.asyncHandler(uploadController.cancelJob));
  router.post('/jobs/:jobId/retry', errorMiddleware.asyncHandler(uploadController.retryJob));
  router.delete('/jobs/:jobId', errorMiddleware.asyncHandler(uploadController.deleteJob));

  // File download
  router.get('/jobs/:jobId/download', errorMiddleware.asyncHandler(uploadController.downloadFile));

  return router;
}