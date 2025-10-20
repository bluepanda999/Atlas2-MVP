import { ProcessingJob, UploadOptions } from '../types/upload';
import { UploadRepository } from '../repositories/upload.repository';
import { JobQueueService } from './job-queue.service';
import { AppError } from '../utils/errors';
import { parseCSV } from '../utils/csv-parser';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs/promises';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';

export class UploadService {
  constructor(
    private uploadRepository: UploadRepository,
    private jobQueueService: JobQueueService
  ) {}

  async uploadFile(
    filePath: string,
    originalName: string,
    size: number,
    userId: string
  ): Promise<ProcessingJob> {
    try {
      // Parse CSV to get basic info (streaming for large files)
      const csvInfo = await this.getCsvInfo(filePath);
      const headers = csvInfo.headers;
      const totalRecords = csvInfo.totalRecords;

      // Create processing job
      const job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'> = {
        userId,
        fileName: originalName,
        fileSize: size,
        status: 'pending',
        progress: 0,
        recordsProcessed: 0,
        totalRecords,
        csvHeaders: headers,
        errorMessage: null,
        processingTime: null,
        estimatedTimeRemaining: null,
      };

      const savedJob = await this.uploadRepository.create(job);

      // Add job to queue
      await this.jobQueueService.addJob('csv-processing', {
        jobId: savedJob.id,
        userId,
        fileName: originalName,
        filePath: filePath,
      });

      return savedJob;
    } catch (error) {
      throw new AppError('Failed to upload file', 500, error);
    }
  }

  async getJobStatus(jobId: string, userId?: string): Promise<ProcessingJob> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (userId && job.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return job;
  }

  async getUploadHistory(
    userId: string,
    options: UploadOptions & { page?: number; limit?: number }
  ): Promise<{
    jobs: ProcessingJob[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const { jobs, total } = await this.uploadRepository.findByUserId(userId, {
      ...options,
      limit,
      offset,
    });

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new AppError('Cannot cancel job in current status', 400);
    }

    // Cancel in queue
    await this.jobQueueService.cancelJob(jobId);

    // Update job status
    await this.uploadRepository.update(jobId, {
      status: 'failed',
      errorMessage: 'Job cancelled by user',
    });
  }

  async retryJob(jobId: string, userId: string): Promise<ProcessingJob> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (job.status !== 'failed') {
      throw new AppError('Can only retry failed jobs', 400);
    }

    // Reset job status
    const updatedJob = await this.uploadRepository.update(jobId, {
      status: 'pending',
      progress: 0,
      recordsProcessed: 0,
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
    });

    // Re-add job to queue
    await this.jobQueueService.addJob('csv-processing', {
      jobId: updatedJob.id,
      userId: updatedJob.userId,
      fileName: updatedJob.fileName,
      csvData: '', // Would need to retrieve original file
    });

    return updatedJob;
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    // Cannot delete active jobs
    if (job.status === 'processing') {
      throw new AppError('Cannot delete job while processing', 400);
    }

    await this.uploadRepository.delete(jobId);
  }

  async downloadFile(jobId: string, userId: string): Promise<Buffer> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError('Job not found', 404);
    }

    if (job.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    if (job.status !== 'completed') {
      throw new AppError('File is not ready for download', 400);
    }

    // In a real implementation, you would retrieve the processed file
    // For now, return the original CSV data
    const fileData = await this.uploadRepository.getFileData(jobId);
    return Buffer.from(fileData || '');
  }

  // Internal method for updating job progress (called by worker)
  async updateJobProgress(
    jobId: string,
    progress: number,
    recordsProcessed: number,
    estimatedTimeRemaining?: number
  ): Promise<void> {
    await this.uploadRepository.update(jobId, {
      progress,
      recordsProcessed,
      estimatedTimeRemaining,
    });
  }

  // Internal method for completing a job (called by worker)
  async completeJob(jobId: string, status: 'completed' | 'failed', errorMessage?: string): Promise<void> {
    const updates: Partial<ProcessingJob> = {
      status,
      progress: status === 'completed' ? 100 : 0,
    };

    if (errorMessage) {
      updates.errorMessage = errorMessage;
    }

    if (status === 'completed') {
      updates.processingTime = 0; // Would calculate actual processing time
    }

    await this.uploadRepository.update(jobId, updates);
  }

  private async getCsvInfo(filePath: string): Promise<{ headers: string[]; totalRecords: number }> {
    return new Promise((resolve, reject) => {
      const headers: string[] = [];
      let totalRecords = 0;
      let headerProcessed = false;

      createReadStream(filePath)
        .pipe(parse({
          delimiter: '',
          auto_parse: false,
          skip_empty_lines: true,
        }))
        .on('data', (row) => {
          if (!headerProcessed) {
            headers.push(...row);
            headerProcessed = true;
          } else {
            totalRecords++;
          }
        })
        .on('end', () => {
          resolve({ headers, totalRecords });
        })
        .on('error', (error) => {
          reject(new AppError('Failed to parse CSV file', 400, error));
        });
    });
  }
}