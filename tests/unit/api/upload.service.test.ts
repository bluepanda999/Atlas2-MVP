import { UploadService } from '../../../api/services/upload.service';
import { UploadRepository } from '../../../api/repositories/upload.repository';
import { JobQueueService } from '../../../api/services/job-queue.service';
import { ProcessingJob } from '../../../api/types/upload';
import { AppError } from '../../../api/utils/errors';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('../../../api/repositories/upload.repository');
jest.mock('../../../api/services/job-queue.service');
jest.mock('fs/promises');

describe('UploadService', () => {
  let uploadService: UploadService;
  let mockUploadRepository: jest.Mocked<UploadRepository>;
  let mockJobQueueService: jest.Mocked<JobQueueService>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockUploadRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getFileData: jest.fn(),
    } as any;

    mockJobQueueService = {
      addJob: jest.fn(),
      cancelJob: jest.fn(),
    } as any;

    mockFs = fs as jest.Mocked<typeof fs>;

    uploadService = new UploadService(mockUploadRepository, mockJobQueueService);
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

    it('should successfully upload and process a CSV file', async () => {
      mockUploadRepository.create.mockResolvedValue(mockJob);
      mockJobQueueService.addJob.mockResolvedValue(undefined);

      // Mock file reading for CSV info
      const mockReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'data') {
            // Simulate CSV data
            setTimeout(() => callback(['col1', 'col2']), 0);
            setTimeout(() => callback(['val1', 'val2']), 10);
            setTimeout(() => callback(['val3', 'val4']), 20);
          } else if (event === 'end') {
            setTimeout(callback, 30);
          }
          return this;
        }),
      };

      // Mock the createReadStream function
      jest.doMock('fs', () => ({
        createReadStream: jest.fn(() => mockReadStream),
      }));

      const result = await uploadService.uploadFile(
        '/tmp/test-file.csv',
        'test.csv',
        1024,
        'test-user-id'
      );

      expect(result).toEqual(mockJob);
      expect(mockUploadRepository.create).toHaveBeenCalledWith({
        userId: 'test-user-id',
        fileName: 'test.csv',
        fileSize: 1024,
        status: 'pending',
        progress: 0,
        recordsProcessed: 0,
        totalRecords: expect.any(Number),
        csvHeaders: expect.any(Array),
        errorMessage: null,
        processingTime: null,
        estimatedTimeRemaining: null,
      });
      expect(mockJobQueueService.addJob).toHaveBeenCalledWith('csv-processing', {
        jobId: mockJob.id,
        userId: 'test-user-id',
        fileName: 'test.csv',
        filePath: '/tmp/test-file.csv',
      });
    });

    it('should handle CSV parsing errors', async () => {
      // Mock file reading that fails
      const mockReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'error') {
            setTimeout(() => callback(new Error('File read error')), 0);
          }
          return this;
        }),
      };

      jest.doMock('fs', () => ({
        createReadStream: jest.fn(() => mockReadStream),
      }));

      await expect(
        uploadService.uploadFile('/tmp/invalid.csv', 'invalid.csv', 1024, 'test-user-id')
      ).rejects.toThrow(AppError);
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

    it('should return job status for valid job ID', async () => {
      mockUploadRepository.findById.mockResolvedValue(mockJob);

      const result = await uploadService.getJobStatus('test-job-id', 'test-user-id');

      expect(result).toEqual(mockJob);
      expect(mockUploadRepository.findById).toHaveBeenCalledWith('test-job-id');
    });

    it('should throw error for non-existent job', async () => {
      mockUploadRepository.findById.mockResolvedValue(null);

      await expect(uploadService.getJobStatus('non-existent', 'test-user-id'))
        .rejects.toThrow(AppError);
    });

    it('should throw error for unauthorized access', async () => {
      const unauthorizedJob = { ...mockJob, userId: 'different-user' };
      mockUploadRepository.findById.mockResolvedValue(unauthorizedJob);

      await expect(uploadService.getJobStatus('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });

    it('should return job status without user ID check for admin', async () => {
      mockUploadRepository.findById.mockResolvedValue(mockJob);

      const result = await uploadService.getJobStatus('test-job-id');

      expect(result).toEqual(mockJob);
      expect(mockUploadRepository.findById).toHaveBeenCalledWith('test-job-id');
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
      mockUploadRepository.findByUserId.mockResolvedValue({
        jobs: mockJobs,
        total: 2,
      });

      const result = await uploadService.getUploadHistory('test-user-id', {
        page: 1,
        limit: 10,
      });

      expect(result).toEqual({
        jobs: mockJobs,
        total: 2,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockUploadRepository.findByUserId).toHaveBeenCalledWith('test-user-id', {
        limit: 10,
        offset: 0,
      });
    });

    it('should calculate total pages correctly', async () => {
      mockUploadRepository.findByUserId.mockResolvedValue({
        jobs: mockJobs,
        total: 25,
      });

      const result = await uploadService.getUploadHistory('test-user-id', {
        page: 2,
        limit: 10,
      });

      expect(result.totalPages).toBe(3);
      expect(mockUploadRepository.findByUserId).toHaveBeenCalledWith('test-user-id', {
        limit: 10,
        offset: 10,
      });
    });
  });

  describe('cancelJob', () => {
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

    it('should cancel a pending job', async () => {
      mockUploadRepository.findById.mockResolvedValue(mockJob);
      mockJobQueueService.cancelJob.mockResolvedValue(undefined);
      mockUploadRepository.update.mockResolvedValue(mockJob);

      await uploadService.cancelJob('test-job-id', 'test-user-id');

      expect(mockJobQueueService.cancelJob).toHaveBeenCalledWith('test-job-id');
      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        status: 'failed',
        errorMessage: 'Job cancelled by user',
      });
    });

    it('should throw error for non-existent job', async () => {
      mockUploadRepository.findById.mockResolvedValue(null);

      await expect(uploadService.cancelJob('non-existent', 'test-user-id'))
        .rejects.toThrow(AppError);
    });

    it('should throw error for unauthorized access', async () => {
      const unauthorizedJob = { ...mockJob, userId: 'different-user' };
      mockUploadRepository.findById.mockResolvedValue(unauthorizedJob);

      await expect(uploadService.cancelJob('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });

    it('should throw error for jobs that cannot be cancelled', async () => {
      const completedJob = { ...mockJob, status: 'completed' as const };
      mockUploadRepository.findById.mockResolvedValue(completedJob);

      await expect(uploadService.cancelJob('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });
  });

  describe('retryJob', () => {
    const mockFailedJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'failed',
      progress: 0,
      recordsProcessed: 0,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: 'Processing failed',
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockResetJob: ProcessingJob = {
      ...mockFailedJob,
      status: 'pending',
      errorMessage: null,
    };

    it('should retry a failed job', async () => {
      mockUploadRepository.findById.mockResolvedValue(mockFailedJob);
      mockUploadRepository.update.mockResolvedValue(mockResetJob);
      mockJobQueueService.addJob.mockResolvedValue(undefined);

      const result = await uploadService.retryJob('test-job-id', 'test-user-id');

      expect(result).toEqual(mockResetJob);
      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        status: 'pending',
        progress: 0,
        recordsProcessed: 0,
        errorMessage: null,
        processingTime: null,
        estimatedTimeRemaining: null,
      });
      expect(mockJobQueueService.addJob).toHaveBeenCalledWith('csv-processing', {
        jobId: mockResetJob.id,
        userId: mockResetJob.userId,
        fileName: mockResetJob.fileName,
        csvData: '',
      });
    });

    it('should throw error for non-failed jobs', async () => {
      const processingJob = { ...mockFailedJob, status: 'processing' as const };
      mockUploadRepository.findById.mockResolvedValue(processingJob);

      await expect(uploadService.retryJob('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });
  });

  describe('deleteJob', () => {
    const mockJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'completed',
      progress: 100,
      recordsProcessed: 100,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should delete a completed job', async () => {
      mockUploadRepository.findById.mockResolvedValue(mockJob);
      mockUploadRepository.delete.mockResolvedValue(undefined);

      await uploadService.deleteJob('test-job-id', 'test-user-id');

      expect(mockUploadRepository.delete).toHaveBeenCalledWith('test-job-id');
    });

    it('should throw error for active jobs', async () => {
      const processingJob = { ...mockJob, status: 'processing' as const };
      mockUploadRepository.findById.mockResolvedValue(processingJob);

      await expect(uploadService.deleteJob('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });
  });

  describe('downloadFile', () => {
    const mockJob: ProcessingJob = {
      id: 'test-job-id',
      userId: 'test-user-id',
      fileName: 'test.csv',
      fileSize: 1024,
      status: 'completed',
      progress: 100,
      recordsProcessed: 100,
      totalRecords: 100,
      csvHeaders: ['col1', 'col2'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should download a completed file', async () => {
      const fileData = 'col1,col2\nval1,val2';
      mockUploadRepository.findById.mockResolvedValue(mockJob);
      mockUploadRepository.getFileData.mockResolvedValue(fileData);

      const result = await uploadService.downloadFile('test-job-id', 'test-user-id');

      expect(result).toEqual(Buffer.from(fileData));
      expect(mockUploadRepository.getFileData).toHaveBeenCalledWith('test-job-id');
    });

    it('should throw error for non-completed jobs', async () => {
      const processingJob = { ...mockJob, status: 'processing' as const };
      mockUploadRepository.findById.mockResolvedValue(processingJob);

      await expect(uploadService.downloadFile('test-job-id', 'test-user-id'))
        .rejects.toThrow(AppError);
    });
  });

  describe('updateJobProgress', () => {
    it('should update job progress', async () => {
      mockUploadRepository.update.mockResolvedValue(undefined);

      await uploadService.updateJobProgress('test-job-id', 75, 75, 25);

      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        progress: 75,
        recordsProcessed: 75,
        estimatedTimeRemaining: 25,
      });
    });
  });

  describe('completeJob', () => {
    it('should complete a job successfully', async () => {
      mockUploadRepository.update.mockResolvedValue(undefined);

      await uploadService.completeJob('test-job-id', 'completed');

      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        status: 'completed',
        progress: 100,
        processingTime: 0,
      });
    });

    it('should fail a job with error message', async () => {
      mockUploadRepository.update.mockResolvedValue(undefined);

      await uploadService.completeJob('test-job-id', 'failed', 'Processing error');

      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        status: 'failed',
        progress: 0,
        errorMessage: 'Processing error',
      });
    });
  });
});