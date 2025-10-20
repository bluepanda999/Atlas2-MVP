import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../../../src/app.module';
import { UploadSession } from '../../../src/entities/upload-session.entity';

describe('Streaming Upload E2E', () => {
  let app: INestApplication;
  let module: TestingModule;

  beforeAll(async () => {
    const testDatabaseConfig = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'atlas2_test',
      entities: [UploadSession],
      synchronize: true,
      logging: false,
    };

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        TypeOrmModule.forFeature([UploadSession]),
        AppModule,
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await module.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    const repository = module.get('UploadSessionRepository');
    await repository.query('DELETE FROM upload_sessions');
  });

  describe('Complete Upload Workflow', () => {
    it('should handle complete streaming upload workflow', async () => {
      const fileName = 'test-upload.csv';
      const fileSize = 1024 * 1024; // 1MB
      const mimeType = 'text/csv';
      const userId = 'test-user';

      // 1. Initialize upload
      const initResponse = await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName,
          fileSize,
          mimeType,
          userId,
        })
        .expect(201);

      const uploadSession = initResponse.body;
      expect(uploadSession.id).toBeDefined();
      expect(uploadSession.fileName).toBe(fileName);
      expect(uploadSession.status).toBe('initialized');

      const uploadId = uploadSession.id;

      // 2. Upload chunks
      const chunkSize = 64 * 1024; // 64KB
      const totalChunks = Math.ceil(fileSize / chunkSize);
      let uploadedBytes = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        const isLastChunk = chunkIndex === totalChunks - 1;
        const currentChunkSize = isLastChunk ? fileSize - uploadedBytes : chunkSize;
        
        // Create test chunk data
        const chunkData = Buffer.alloc(currentChunkSize, 'x'); // Fill with 'x' character

        const chunkResponse = await request(app.getHttpServer())
          .post(`/api/upload/streaming/${uploadId}/chunk`)
          .field('chunkIndex', chunkIndex)
          .field('isLastChunk', isLastChunk)
          .attach('chunk', chunkData, `chunk-${chunkIndex}.bin`)
          .expect(200);

        const progress = chunkResponse.body;
        expect(progress.uploadId).toBe(uploadId);
        expect(progress.chunkIndex).toBe(chunkIndex);
        expect(progress.isLastChunk).toBe(isLastChunk);
        expect(progress.uploadedBytes).toBeGreaterThan(uploadedBytes);

        uploadedBytes = progress.uploadedBytes;

        if (isLastChunk) {
          expect(progress.status).toBe('completed');
          expect(progress.progress).toBe(100);
        } else {
          expect(progress.status).toBe('uploading');
          expect(progress.progress).toBeLessThan(100);
        }
      }

      // 3. Verify final upload progress
      const finalProgressResponse = await request(app.getHttpServer())
        .get(`/api/upload/streaming/${uploadId}/progress`)
        .expect(200);

      const finalProgress = finalProgressResponse.body;
      expect(finalProgress.status).toBe('completed');
      expect(finalProgress.progress).toBe(100);
      expect(finalProgress.uploadedBytes).toBe(fileSize);

      // 4. List uploads to verify it's in the list
      const listResponse = await request(app.getHttpServer())
        .get('/api/upload/streaming')
        .query({ userId })
        .expect(200);

      const uploads = listResponse.body;
      expect(uploads).toHaveLength(1);
      expect(uploads[0].id).toBe(uploadId);
      expect(uploads[0].status).toBe('completed');
    });

    it('should handle pause and resume functionality', async () => {
      // Initialize upload
      const initResponse = await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: 'pause-resume-test.csv',
          fileSize: 1024 * 1024,
          mimeType: 'text/csv',
        })
        .expect(201);

      const uploadId = initResponse.body.id;

      // Upload first chunk
      const chunkData = Buffer.alloc(64 * 1024, 'x');
      
      await request(app.getHttpServer())
        .post(`/api/upload/streaming/${uploadId}/chunk`)
        .field('chunkIndex', 0)
        .field('isLastChunk', false)
        .attach('chunk', chunkData, 'chunk-0.bin')
        .expect(200);

      // Pause the upload
      await request(app.getHttpServer())
        .put(`/api/upload/streaming/${uploadId}/pause`)
        .expect(200);

      // Verify upload is paused
      const pausedProgressResponse = await request(app.getHttpServer())
        .get(`/api/upload/streaming/${uploadId}/progress`)
        .expect(200);

      expect(pausedProgressResponse.body.status).toBe('paused');

      // Resume the upload
      await request(app.getHttpServer())
        .put(`/api/upload/streaming/${uploadId}/resume`)
        .expect(200);

      // Verify upload is resumed
      const resumedProgressResponse = await request(app.getHttpServer())
        .get(`/api/upload/streaming/${uploadId}/progress`)
        .expect(200);

      expect(resumedProgressResponse.body.status).toBe('uploading');

      // Cancel the upload
      await request(app.getHttpServer())
        .delete(`/api/upload/streaming/${uploadId}`)
        .expect(204);

      // Verify upload is cancelled
      const cancelledProgressResponse = await request(app.getHttpServer())
        .get(`/api/upload/streaming/${uploadId}/progress`)
        .expect(200);

      expect(cancelledProgressResponse.body.status).toBe('cancelled');
    });

    it('should handle upload errors and retry', async () => {
      // Initialize upload
      const initResponse = await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: 'error-retry-test.csv',
          fileSize: 1024 * 1024,
          mimeType: 'text/csv',
        })
        .expect(201);

      const uploadId = initResponse.body.id;

      // Upload a chunk
      const chunkData = Buffer.alloc(64 * 1024, 'x');
      
      await request(app.getHttpServer())
        .post(`/api/upload/streaming/${uploadId}/chunk`)
        .field('chunkIndex', 0)
        .field('isLastChunk', false)
        .attach('chunk', chunkData, 'chunk-0.bin')
        .expect(200);

      // Simulate upload failure by manually updating status
      const repository = module.get('UploadSessionRepository');
      await repository.update(uploadId, { status: 'failed', error: 'Simulated failure' });

      // Verify upload failed
      const failedProgressResponse = await request(app.getHttpServer())
        .get(`/api/upload/streaming/${uploadId}/progress`)
        .expect(200);

      expect(failedProgressResponse.body.status).toBe('failed');
      expect(failedProgressResponse.body.error).toBe('Simulated failure');

      // Retry the upload
      const retryResponse = await request(app.getHttpServer())
        .put(`/api/upload/streaming/${uploadId}/retry`)
        .expect(200);

      expect(retryResponse.body.status).toBe('uploading');
      expect(retryResponse.body.uploadedBytes).toBe(0);
    });
  });

  describe('Input Validation', () => {
    it('should reject oversized files', async () => {
      const oversizedFile = 4 * 1024 * 1024 * 1024; // 4GB (exceeds 3GB limit)

      await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: 'oversized-file.bin',
          fileSize: oversizedFile,
          mimeType: 'application/octet-stream',
        })
        .expect(400);
    });

    it('should reject invalid file names', async () => {
      await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: '',
          fileSize: 1024,
          mimeType: 'text/plain',
        })
        .expect(400);
    });

    it('should reject negative file sizes', async () => {
      await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: 'test.txt',
          fileSize: -100,
          mimeType: 'text/plain',
        })
        .expect(400);
    });

    it('should handle non-existent upload sessions', async () => {
      const nonExistentId = 'non-existent-upload-id';

      await request(app.getHttpServer())
        .get(`/api/upload/streaming/${nonExistentId}/progress`)
        .expect(404);

      await request(app.getHttpServer())
        .put(`/api/upload/streaming/${nonExistentId}/pause`)
        .expect(404);

      await request(app.getHttpServer())
        .delete(`/api/upload/streaming/${nonExistentId}`)
        .expect(404);
    });
  });

  describe('Performance Validation', () => {
    it('should handle concurrent uploads', async () => {
      const concurrentUploads = 5;
      const uploadPromises = [];

      for (let i = 0; i < concurrentUploads; i++) {
        const uploadPromise = (async (index) => {
          // Initialize upload
          const initResponse = await request(app.getHttpServer())
            .post('/api/upload/streaming/initialize')
            .send({
              fileName: `concurrent-test-${index}.csv`,
              fileSize: 64 * 1024, // 64KB
              mimeType: 'text/csv',
            })
            .expect(201);

          const uploadId = initResponse.body.id;

          // Upload single chunk
          const chunkData = Buffer.alloc(64 * 1024, 'x');
          
          await request(app.getHttpServer())
            .post(`/api/upload/streaming/${uploadId}/chunk`)
            .field('chunkIndex', 0)
            .field('isLastChunk', true)
            .attach('chunk', chunkData, `chunk-${index}.bin`)
            .expect(200);

          return uploadId;
        })(i);

        uploadPromises.push(uploadPromise);
      }

      const uploadIds = await Promise.all(uploadPromises);
      expect(uploadIds).toHaveLength(concurrentUploads);

      // Verify all uploads completed successfully
      for (const uploadId of uploadIds) {
        const progressResponse = await request(app.getHttpServer())
          .get(`/api/upload/streaming/${uploadId}/progress`)
          .expect(200);

        expect(progressResponse.body.status).toBe('completed');
      }
    });

    it('should complete uploads within performance thresholds', async () => {
      const startTime = Date.now();

      // Initialize and complete a small upload
      const initResponse = await request(app.getHttpServer())
        .post('/api/upload/streaming/initialize')
        .send({
          fileName: 'performance-test.csv',
          fileSize: 1024,
          mimeType: 'text/csv',
        })
        .expect(201);

      const uploadId = initResponse.body.id;

      const chunkData = Buffer.alloc(1024, 'x');
      
      await request(app.getHttpServer())
        .post(`/api/upload/streaming/${uploadId}/chunk`)
        .field('chunkIndex', 0)
        .field('isLastChunk', true)
        .attach('chunk', chunkData, 'chunk.bin')
        .expect(200);

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Should complete within 5 seconds
      expect(totalTime).toBeLessThan(5000);
    });
  });

  describe('API Endpoints', () => {
    it('should provide upload statistics', async () => {
      // Create a few test uploads first
      for (let i = 0; i < 3; i++) {
        await request(app.getHttpServer())
          .post('/api/upload/streaming/initialize')
          .send({
            fileName: `stats-test-${i}.csv`,
            fileSize: 1024,
            mimeType: 'text/csv',
          })
          .expect(201);
      }

      const statsResponse = await request(app.getHttpServer())
        .get('/api/upload/streaming/stats')
        .expect(200);

      const stats = statsResponse.body;
      expect(stats.totalUploads).toBe(3);
      expect(stats.statusBreakdown).toBeDefined();
      expect(stats.totalBytes).toBe(3072); // 3 * 1024
    });

    it('should support pagination in upload listing', async () => {
      // Create multiple uploads
      for (let i = 0; i < 15; i++) {
        await request(app.getHttpServer())
          .post('/api/upload/streaming/initialize')
          .send({
            fileName: `pagination-test-${i}.csv`,
            fileSize: 1024,
            mimeType: 'text/csv',
          })
          .expect(201);
      }

      // Test pagination
      const firstPageResponse = await request(app.getHttpServer())
        .get('/api/upload/streaming')
        .query({ limit: 10, offset: 0 })
        .expect(200);

      const secondPageResponse = await request(app.getHttpServer())
        .get('/api/upload/streaming')
        .query({ limit: 10, offset: 10 })
        .expect(200);

      expect(firstPageResponse.body).toHaveLength(10);
      expect(secondPageResponse.body).toHaveLength(5);
    });
  });
});