import { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { UploadService } from '../services/upload.service';
import { ApiResponse } from '../types/api';
import { ProcessingJob } from '../types/upload';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  },
});

export class UploadController {
  constructor(private uploadService: UploadService) {}

  uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      if (!req.file) {
        throw new Error('No file uploaded');
      }

      const job: ProcessingJob = await this.uploadService.uploadFile(
        req.file.buffer,
        req.file.originalname,
        req.file.size,
        userId
      );

      const response: ApiResponse<ProcessingJob> = {
        success: true,
        data: job,
        message: 'File uploaded successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getJobStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      const job = await this.uploadService.getJobStatus(jobId, userId);

      const response: ApiResponse<ProcessingJob> = {
        success: true,
        data: job,
        message: 'Job status retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getUploadHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const status = req.query.status as ProcessingJob['status'];

      const result = await this.uploadService.getUploadHistory(userId, {
        page,
        limit,
        status,
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'Upload history retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  cancelJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      await this.uploadService.cancelJob(jobId, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Job cancelled successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  retryJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      const job = await this.uploadService.retryJob(jobId, userId);

      const response: ApiResponse<ProcessingJob> = {
        success: true,
        data: job,
        message: 'Job retry initiated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      await this.uploadService.deleteJob(jobId, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Job deleted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  downloadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      const fileBuffer = await this.uploadService.downloadFile(jobId, userId);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="download.csv"');
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  };

  // Middleware for handling file upload
  uploadMiddleware = upload.single('file');
}