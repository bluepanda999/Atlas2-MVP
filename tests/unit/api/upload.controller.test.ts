import request from 'supertest';
import express from 'express';
import { UploadController } from '../../../api/controllers/upload.controller';
import { UploadService } from '../../../api/services/upload.service';
import { ProcessingJob } from '../../../api/types/upload';
import { AuthMiddleware } from '../../../api/middleware/auth.middleware';

// Mock dependencies
jest.mock('../../../api/services/upload.service');
jest.mock('../../../api/middleware/auth.middleware');

describe('UploadController', () => {
  let app: express.Application;
  let uploadController: UploadController;
  let mockUploadService: jest.Mocked<UploadService>;
  let mockAuthMiddleware: jest.Mocked<AuthMiddleware>;

  beforeEach(() => {
    mockUploadService = {
      uploadFile: jest.fn(),
      getJobStatus: jest.fn(),
      getUploadHistory: jest.fn(),
      cancelJob: jest.fn(),
      retryJob: jest.fn(),
      deleteJob: jest.fn(),
      downloadFile: jest.fn(),
    } as any;

    mockAuthMiddleware = {
      authenticate: jest.fn((req, res, next) => {
        req.user = { id: 'test-user-id', email: 'test@example.com' };
        next();
      }),
    } as any;

    uploadController = new UploadController(mockUploadService);
    
    app = express();
    app.use(express.json());
    
    // Mock authentication middleware
    app.use('/api/upload', (req, res, next) => {
      req.user = { id: 'test-user-id', email: 'test@example.com' };
      next();
    });

    // Setup routes
    app.post('/api/upload', uploadController.uploadMiddleware, uploadController.uploadFile);
    app.get('/api/upload/:jobId', uploadController.getJobStatus);
    app.get('/api/upload/history', uploadController.getUploadHistory);
    app.delete('/api/upload/:jobId', uploadController.deleteJob);
    app.post('/api/upload/:jobId/cancel', uploadController.cancelJob);
    app.post('/api/upload/:jobId/retry', uploadController.retryJob);
    app.get('/api/upload/:jobId/download', uploadController.downloadFile);
  });

  describe('uploadFile', () => {
    const mockJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'pending',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully upload a CSV file', async () => {
      mockUploadService.uploadFile.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('col1,col2\nval1,val2'), 'test.csv')
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockJob);
      expect(response.body.message).toBe('File uploaded successfully');
      expect(mockUploadService.uploadFile).toHaveBeenCalledWith(
        expect.any(String), // filePath
        'test.csv',
        expect.any(Number), // size
        'test-user-id'
      );
    });

    it('should reject non-CSV files', async () => {
      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('test content'), 'test.txt')
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Only CSV files are allowed');
    });

    it('should handle files up to 3GB', async () => {
      mockUploadService.uploadFile.mockResolvedValue(mockJob);

      // Create a large buffer (1MB for testing)
      const largeBuffer = Buffer.alloc(1024 * 1024, 'x');
      
      const response = await request(app)
        .post('/api/upload')
        .attach('file', largeBuffer, 'large.csv')
        .expect(201);

      expect(response.body.success).toBe(true);
    });

    it('should require authentication', async () => {
      // Remove mock user for this test
      app.use('/api/upload', (req, res, next) => {
        req.user = undefined;
        next();
      });

      const response = await request(app)
        .post('/api/upload')
        .attach('file', Buffer.from('col1,col2\nval1,val2'), 'test.csv')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('getJobStatus', () => {
    const mockJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'processing',
      progress: 50,
      recordsProcessed: 50,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: 30,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should return job status for authenticated user', async () => {
      mockUploadService.getJobStatus.mockResolvedValue(mockJob);

      const response = await request(app)
        .get('/api/upload/test-job-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockJob);
      expect(mockUploadService.getJobStatus).toHaveBeenCalledWith('test-job-id', 'test-user-id');
    });

    it('should return 404 for non-existent job', async () => {
      mockUploadService.getJobStatus.mockRejectedValue(new Error('Job not found'));

      const response = await request(app)
        .get('/api/upload/non-existent-job')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('getUploadHistory', () => {
    const mockJobs = [
      {
        id: 'job1',
        userId: 'test-user-id',
        fileName: 'test1.csv',
        status: 'completed' as const,
        createdAt: new Date(),
      },
      {
        id: 'job2',
        userId: 'test-user-id',
        fileName: 'test2.csv',
        status: 'processing' as const,
        createdAt: new Date(),
      },
    ];

    it('should return paginated upload history', async () => {
      mockUploadService.getUploadHistory.mockResolvedValue({
        jobs: mockJobs,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/api/upload/history')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.jobs).toEqual(mockJobs);
      expect(response.body.data.total).toBe(2);
      expect(mockUploadService.getUploadHistory).toHaveBeenCalledWith('test-user-id', {
        page: 1,
        limit: 10,
        status: undefined,
      });
    });

    it('should support pagination parameters', async () => {
      mockUploadService.getUploadHistory.mockResolvedValue({
        jobs: mockJobs,
        total: 2,
        page: 2,
        limit: 5,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/api/upload/history?page=2&limit=5')
        .expect(200);

      expect(response.body.data.page).toBe(2);
      expect(response.body.data.limit).toBe(5);
    });

    it('should filter by status', async () => {
      mockUploadService.getUploadHistory.mockResolvedValue({
        jobs: mockJobs.filter(job => job.status === 'completed'),
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });

      const response = await request(app)
        .get('/api/upload/history?status=completed')
        .expect(200);

      expect(response.body.data.jobs).toHaveLength(1);
      expect(response.body.data.jobs[0].status).toBe('completed');
    });
  });

  describe('cancelJob', () => {
    it('should cancel a pending job', async () => {
      mockUploadService.cancelJob.mockResolvedValue(undefined);

      const response = await request(app)
        .post('/api/upload/test-job-id/cancel')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Job cancelled successfully');
      expect(mockUploadService.cancelJob).toHaveBeenCalledWith('test-job-id', 'test-user-id');
    });

    it('should handle job cancellation errors', async () => {
      mockUploadService.cancelJob.mockRejectedValue(new Error('Cannot cancel job in current status'));

      const response = await request(app)
        .post('/api/upload/test-job-id/cancel')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('retryJob', () => {
    const mockJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'pending',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should retry a failed job', async () => {
      mockUploadService.retryJob.mockResolvedValue(mockJob);

      const response = await request(app)
        .post('/api/upload/test-job-id/retry')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockJob);
      expect(response.body.message).toBe('Job retry initiated successfully');
      expect(mockUploadService.retryJob).toHaveBeenCalledWith('test-job-id', 'test-user-id');
    });
  });

  describe('deleteJob', () => {
    it('should delete a completed job', async () => {
      mockUploadService.deleteJob.mockResolvedValue(undefined);

      const response = await request(app)
        .delete('/api/upload/test-job-id')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Job deleted successfully');
      expect(mockUploadService.deleteJob).toHaveBeenCalledWith('test-job-id', 'test-user-id');
    });

    it('should handle job deletion errors', async () => {
      mockUploadService.deleteJob.mockRejectedValue(new Error('Cannot delete job while processing'));

      const response = await request(app)
        .delete('/api/upload/test-job-id')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });

  describe('downloadFile', () => {
    it('should download a processed file', async () => {
      const fileBuffer = Buffer.from('col1,col2\nval1,val2');
      mockUploadService.downloadFile.mockResolvedValue(fileBuffer);

      const response = await request(app)
        .get('/api/upload/test-job-id/download')
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv');
      expect(response.headers['content-disposition']).toBe('attachment; filename="download.csv"');
      expect(response.body).toEqual(fileBuffer);
      expect(mockUploadService.downloadFile).toHaveBeenCalledWith('test-job-id', 'test-user-id');
    });

    it('should handle download errors', async () => {
      mockUploadService.downloadFile.mockRejectedValue(new Error('File is not ready for download'));

      const response = await request(app)
        .get('/api/upload/test-job-id/download')
        .expect(500);

      expect(response.body.success).toBe(false);
    });
  });
});