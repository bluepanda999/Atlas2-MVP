import { ProcessingJob, UploadHistoryOptions, UploadHistoryResult } from '../types/upload';
import { UploadRepository } from '../../repositories/upload.repository';
import { JobQueueService } from '../../services/job-queue.service';
import fs from 'fs/promises';
import path from 'path';

export class UploadService {
  constructor(
    private uploadRepository: UploadRepository,
    private jobQueueService: JobQueueService
  ) {}

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private readonly MAX_FILE_SIZE = 3 * 1024 * 1024 * 1024; // 3GB
  private readonly ALLOWED_FILE_TYPES = ['text/csv', 'application/csv', 'text/plain'];

  validateFileSize(fileSize: number): boolean {
    if (typeof fileSize !== 'number' || fileSize < 0) {
      return false;
    }
    return fileSize <= this.MAX_FILE_SIZE;
  }

  validateFileType(mimeType: string): boolean {
    if (typeof mimeType !== 'string' || !mimeType.trim()) {
      return false;
    }
    return this.ALLOWED_FILE_TYPES.includes(mimeType.trim());
  }

  async uploadFile(
    filePath: string,
    originalName: string,
    fileSize: number,
    userId: string
  ): Promise<ProcessingJob> {
    // Create processing job record
    const job: ProcessingJob = {
      id: this.generateJobId(),
      userId,
      originalName,
      filePath,
      fileSize,
      status: 'pending',
      progress: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Save job to database
    await this.uploadRepository.createJob(job);

    // Queue the job for processing
    await this.jobQueueService.addJob('csv-processing', {
      jobId: job.id,
      filePath,
      userId,
    });

    return job;
  }

  async getJobStatus(jobId: string, userId: string): Promise<ProcessingJob> {
    const job = await this.uploadRepository.getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Access denied');
    }

    return job;
  }

  async getUploadHistory(
    userId: string,
    options: UploadHistoryOptions
  ): Promise<UploadHistoryResult> {
    return await this.uploadRepository.getJobsByUserId(userId, options);
  }

  async cancelJob(jobId: string, userId: string): Promise<void> {
    const job = await this.uploadRepository.getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Access denied');
    }

    if (job.status !== 'pending' && job.status !== 'processing') {
      throw new Error('Job cannot be cancelled');
    }

    // Update job status
    await this.uploadRepository.updateJobStatus(jobId, 'cancelled');

    // Remove from job queue if still pending
    if (job.status === 'pending') {
      await this.jobQueueService.removeJob(jobId);
    }
  }

  async retryJob(jobId: string, userId: string): Promise<ProcessingJob> {
    const job = await this.uploadRepository.getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Access denied');
    }

    if (job.status !== 'failed' && job.status !== 'cancelled') {
      throw new Error('Only failed or cancelled jobs can be retried');
    }

    // Reset job status
    const updatedJob = await this.uploadRepository.updateJobStatus(jobId, 'pending');

    // Re-queue the job
    await this.jobQueueService.addJob('csv-processing', {
      jobId: job.id,
      filePath: job.filePath,
      userId: job.userId,
    });

    return updatedJob;
  }

  async deleteJob(jobId: string, userId: string): Promise<void> {
    const job = await this.uploadRepository.getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Access denied');
    }

    // Delete file from filesystem
    try {
      await fs.unlink(job.filePath);
    } catch (error) {
      // File might not exist, continue with cleanup
      console.warn(`Failed to delete file ${job.filePath}:`, error);
    }

    // Remove from job queue if still pending
    if (job.status === 'pending') {
      await this.jobQueueService.removeJob(jobId);
    }

    // Delete job record
    await this.uploadRepository.deleteJob(jobId);
  }

  async downloadFile(jobId: string, userId: string): Promise<Buffer> {
    const job = await this.uploadRepository.getJobById(jobId);
    
    if (!job) {
      throw new Error('Job not found');
    }

    if (job.userId !== userId) {
      throw new Error('Access denied');
    }

    if (job.status !== 'completed') {
      throw new Error('File is not ready for download');
    }

    // Read the processed file (assuming it's stored at the same path)
    const fileBuffer = await fs.readFile(job.filePath);
    return fileBuffer;
  }
}