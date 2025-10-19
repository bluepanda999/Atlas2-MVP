import { Injectable, Logger } from '@nestjs/common';
import { createWriteStream, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { pipeline } from 'stream/promises';
import { UploadProgress } from '../interfaces/upload-progress.interface';
import { UploadSession } from '../entities/upload-session.entity';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StreamingUploadService {
  private readonly logger = new Logger(StreamingUploadService.name);
  private readonly uploadDir = process.env.UPLOAD_DIR || './uploads';
  private readonly maxFileSize = parseInt(process.env.MAX_FILE_SIZE) || 3 * 1024 * 1024 * 1024; // 3GB
  private readonly chunkSize = parseInt(process.env.CHUNK_SIZE) || 64 * 1024; // 64KB

  constructor(
    @InjectRepository(UploadSession)
    private readonly uploadSessionRepository: Repository<UploadSession>,
  ) {
    this.ensureUploadDirectory();
  }

  async initializeUpload(fileName: string, fileSize: number, mimeType: string, userId?: string): Promise<UploadSession> {
    this.logger.log(`Initializing upload for file: ${fileName} (${fileSize} bytes)`);

    if (fileSize > this.maxFileSize) {
      throw new Error(`File size ${fileSize} exceeds maximum allowed size ${this.maxFileSize}`);
    }

    const uploadId = uuidv4();
    const filePath = join(this.uploadDir, `${uploadId}_${fileName}`);
    
    const uploadSession = this.uploadSessionRepository.create({
      id: uploadId,
      fileName,
      originalName: fileName,
      fileSize,
      mimeType,
      filePath,
      userId,
      status: 'initialized',
      uploadedBytes: 0,
      createdAt: new Date(),
    });

    const savedSession = await this.uploadSessionRepository.save(uploadSession);
    
    this.logger.log(`Upload session created: ${uploadId}`);
    return savedSession;
  }

  async processChunk(
    uploadId: string,
    chunk: Buffer,
    chunkIndex: number,
    isLastChunk: boolean = false,
  ): Promise<UploadProgress> {
    this.logger.debug(`Processing chunk ${chunkIndex} for upload ${uploadId}`);

    const uploadSession = await this.getUploadSession(uploadId);
    
    if (!uploadSession) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    if (uploadSession.status === 'completed') {
      throw new Error(`Upload already completed: ${uploadId}`);
    }

    if (uploadSession.status === 'failed') {
      throw new Error(`Upload failed previously: ${uploadId}`);
    }

    try {
      // Append chunk to file
      await this.appendChunkToFile(uploadSession.filePath, chunk);
      
      // Update progress
      const newUploadedBytes = uploadSession.uploadedBytes + chunk.length;
      const progress = (newUploadedBytes / uploadSession.fileSize) * 100;

      await this.updateUploadProgress(uploadId, {
        uploadedBytes: newUploadedBytes,
        status: isLastChunk ? 'completed' : 'uploading',
        completedAt: isLastChunk ? new Date() : null,
      });

      const uploadProgress: UploadProgress = {
        uploadId,
        fileName: uploadSession.fileName,
        uploadedBytes: newUploadedBytes,
        totalBytes: uploadSession.fileSize,
        progress: Math.round(progress * 100) / 100,
        status: isLastChunk ? 'completed' : 'uploading',
        chunkIndex,
        isLastChunk,
        speed: this.calculateUploadSpeed(uploadSession, newUploadedBytes),
        estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(uploadSession, newUploadedBytes),
      };

      this.logger.debug(`Chunk ${chunkIndex} processed successfully. Progress: ${progress.toFixed(2)}%`);
      
      return uploadProgress;

    } catch (error) {
      this.logger.error(`Failed to process chunk ${chunkIndex} for upload ${uploadId}: ${error.message}`, error.stack);
      
      await this.updateUploadProgress(uploadId, {
        status: 'failed',
        error: error.message,
        completedAt: new Date(),
      });

      throw error;
    }
  }

  async getUploadProgress(uploadId: string): Promise<UploadProgress> {
    const uploadSession = await this.getUploadSession(uploadId);
    
    if (!uploadSession) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    const progress = uploadSession.fileSize > 0 
      ? (uploadSession.uploadedBytes / uploadSession.fileSize) * 100 
      : 0;

    return {
      uploadId,
      fileName: uploadSession.fileName,
      uploadedBytes: uploadSession.uploadedBytes,
      totalBytes: uploadSession.fileSize,
      progress: Math.round(progress * 100) / 100,
      status: uploadSession.status,
      speed: this.calculateUploadSpeed(uploadSession, uploadSession.uploadedBytes),
      estimatedTimeRemaining: this.calculateEstimatedTimeRemaining(uploadSession, uploadSession.uploadedBytes),
      error: uploadSession.error,
      createdAt: uploadSession.createdAt,
      completedAt: uploadSession.completedAt,
    };
  }

  async pauseUpload(uploadId: string): Promise<void> {
    this.logger.log(`Pausing upload: ${uploadId}`);
    
    await this.updateUploadProgress(uploadId, {
      status: 'paused',
    });
  }

  async resumeUpload(uploadId: string): Promise<void> {
    this.logger.log(`Resuming upload: ${uploadId}`);
    
    await this.updateUploadProgress(uploadId, {
      status: 'uploading',
    });
  }

  async cancelUpload(uploadId: string): Promise<void> {
    this.logger.log(`Canceling upload: ${uploadId}`);
    
    const uploadSession = await this.getUploadSession(uploadId);
    
    if (uploadSession && existsSync(uploadSession.filePath)) {
      // Delete the partially uploaded file
      const fs = require('fs').promises;
      try {
        await fs.unlink(uploadSession.filePath);
      } catch (error) {
        this.logger.warn(`Failed to delete file ${uploadSession.filePath}: ${error.message}`);
      }
    }

    await this.updateUploadProgress(uploadId, {
      status: 'cancelled',
      completedAt: new Date(),
    });
  }

  async retryUpload(uploadId: string): Promise<UploadSession> {
    this.logger.log(`Retrying upload: ${uploadId}`);
    
    const uploadSession = await this.getUploadSession(uploadId);
    
    if (!uploadSession) {
      throw new Error(`Upload session not found: ${uploadId}`);
    }

    // Reset upload state but keep the file
    await this.updateUploadProgress(uploadId, {
      status: 'uploading',
      uploadedBytes: 0,
      error: null,
      completedAt: null,
    });

    return uploadSession;
  }

  async listUploads(userId?: string, limit: number = 50, offset: number = 0): Promise<UploadSession[]> {
    const queryBuilder = this.uploadSessionRepository.createQueryBuilder('upload_session')
      .orderBy('upload_session.createdAt', 'DESC')
      .limit(limit)
      .offset(offset);

    if (userId) {
      queryBuilder.andWhere('upload_session.userId = :userId', { userId });
    }

    return await queryBuilder.getMany();
  }

  async getUploadSession(uploadId: string): Promise<UploadSession | null> {
    return await this.uploadSessionRepository.findOne({
      where: { id: uploadId },
    });
  }

  private async appendChunkToFile(filePath: string, chunk: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      const writeStream = createWriteStream(filePath, { flags: 'a' });
      
      writeStream.write(chunk);
      writeStream.end();
      
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });
  }

  private async updateUploadProgress(uploadId: string, updates: Partial<UploadSession>): Promise<void> {
    await this.uploadSessionRepository.update(uploadId, {
      ...updates,
      updatedAt: new Date(),
    });
  }

  private calculateUploadSpeed(uploadSession: UploadSession, currentBytes: number): number {
    if (!uploadSession.createdAt) return 0;
    
    const elapsedSeconds = (Date.now() - uploadSession.createdAt.getTime()) / 1000;
    if (elapsedSeconds <= 0) return 0;
    
    return currentBytes / elapsedSeconds; // bytes per second
  }

  private calculateEstimatedTimeRemaining(uploadSession: UploadSession, currentBytes: number): number {
    const speed = this.calculateUploadSpeed(uploadSession, currentBytes);
    if (speed <= 0) return 0;
    
    const remainingBytes = uploadSession.fileSize - currentBytes;
    return remainingBytes / speed; // seconds
  }

  private ensureUploadDirectory(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.log(`Created upload directory: ${this.uploadDir}`);
    }
  }

  async cleanupOldUploads(olderThanDays: number = 7): Promise<number> {
    this.logger.log(`Cleaning up uploads older than ${olderThanDays} days`);
    
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const oldUploads = await this.uploadSessionRepository.find({
      where: {
        createdAt: { $lt: cutoffDate } as any,
        status: { $in: ['completed', 'failed', 'cancelled'] } as any,
      },
    });

    let deletedCount = 0;
    const fs = require('fs').promises;
    
    for (const upload of oldUploads) {
      try {
        // Delete the file if it exists
        if (upload.filePath && existsSync(upload.filePath)) {
          await fs.unlink(upload.filePath);
        }
        
        // Delete the database record
        await this.uploadSessionRepository.remove(upload);
        deletedCount++;
        
      } catch (error) {
        this.logger.warn(`Failed to cleanup upload ${upload.id}: ${error.message}`);
      }
    }
    
    this.logger.log(`Cleaned up ${deletedCount} old uploads`);
    return deletedCount;
  }

  async getUploadStats(userId?: string): Promise<any> {
    const queryBuilder = this.uploadSessionRepository.createQueryBuilder('upload_session')
      .select('upload_session.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('SUM(upload_session.fileSize)', 'totalBytes')
      .groupBy('upload_session.status');

    if (userId) {
      queryBuilder.andWhere('upload_session.userId = :userId', { userId });
    }

    const stats = await queryBuilder.getRawMany();
    
    return {
      totalUploads: stats.reduce((sum, stat) => sum + parseInt(stat.count), 0),
      totalBytes: stats.reduce((sum, stat) => sum + parseInt(stat.totalBytes || 0), 0),
      statusBreakdown: stats.map(stat => ({
        status: stat.status,
        count: parseInt(stat.count),
        bytes: parseInt(stat.totalBytes || 0),
      })),
    };
  }
}