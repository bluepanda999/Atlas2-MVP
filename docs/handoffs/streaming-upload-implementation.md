# Streaming Upload Implementation Development Handoff

**Document Version:** 1.0.0  
**Handoff Date:** October 19, 2025  
**Target Story:** Epic 1 - Story 1.1: CSV File Upload Interface  
**Priority:** Critical (QA Gate Status: CONCERNS)  
**Estimated Effort:** 8-10 story points  

---

## Executive Summary

### Technical Challenge
The current Atlas2 CSV upload implementation uses `multer.memoryStorage()` with a 50MB file size limit, which does not meet the story requirement of supporting 3GB file uploads. The memory-based approach will cause server exhaustion when handling large files and requires a complete architectural shift to streaming-based file processing.

### Business Impact
- **Current State:** Users cannot upload files larger than 50MB, blocking critical data import workflows
- **Target State:** Support for 3GB CSV files with real-time progress tracking and memory-efficient processing
- **Risk Level:** High - Memory exhaustion, server instability, poor user experience

### Solution Overview
Implement a comprehensive streaming upload architecture that:
- Uses disk-based storage with configurable memory limits
- Provides real-time upload progress tracking
- Maintains existing API patterns and error handling
- Includes comprehensive testing and monitoring
- Ensures security and performance at scale

---

## Detailed Technical Implementation Plan

### Phase 1: Backend Infrastructure Updates (3-4 days)

#### 1.1 Streaming Upload Middleware
**File:** `api/middleware/streaming-upload.middleware.ts` (NEW)

```typescript
import multer from 'multer';
import path from 'path';
import { Request } from 'express';

// Configure disk storage with streaming
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = process.env.UPLOAD_DIR || './uploads';
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// Configure streaming upload middleware
export const streamingUpload = multer({
  storage,
  limits: {
    fileSize: 3 * 1024 * 1024 * 1024, // 3GB
    files: 1,
    fields: 20,
    fieldNameSize: 100,
    fieldSize: 1024 * 1024, // 1MB for fields
  },
  fileFilter: (req, file, cb) => {
    // Enhanced file validation
    const allowedMimes = ['text/csv', 'application/csv', 'text/plain'];
    const allowedExtensions = ['.csv', '.txt'];
    
    const isValidMime = allowedMimes.includes(file.mimetype);
    const isValidExtension = allowedExtensions.some(ext => 
      file.originalname.toLowerCase().endsWith(ext)
    );
    
    if (isValidMime && isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV files are allowed.'));
    }
  }
});

// Progress tracking middleware
export const uploadProgress = (req: Request, res: Response, next: NextFunction) => {
  // Implement progress tracking logic
  next();
};
```

#### 1.2 Enhanced Upload Service
**File:** `api/services/upload.service.ts` (MODIFY)

Key changes required:
- Replace memory-based processing with streaming file operations
- Implement chunked CSV parsing using Papa Parse streaming
- Add progress tracking and memory management
- Enhanced error handling for large files

```typescript
// New streaming upload method
async uploadFileStream(
  file: Express.Multer.File,
  userId: string
): Promise<ProcessingJob> {
  const jobId = uuidv4();
  
  // Create initial job record
  const job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'> = {
    userId,
    fileName: file.originalname,
    fileSize: file.size,
    status: 'uploading',
    progress: 0,
    recordsProcessed: 0,
    totalRecords: 0, // Will be determined during processing
    csvHeaders: [],
    errorMessage: null,
    processingTime: null,
    estimatedTimeRemaining: null,
  };

  const savedJob = await this.uploadRepository.create(job);
  
  // Start streaming processing
  this.processFileStream(file.path, savedJob.id, userId);
  
  return savedJob;
}

private async processFileStream(
  filePath: string,
  jobId: string,
  userId: string
): Promise<void> {
  const startTime = Date.now();
  let recordsProcessed = 0;
  let headers: string[] = [];
  
  try {
    // Update job status to processing
    await this.uploadRepository.update(jobId, {
      status: 'processing',
      progress: 0
    });

    // Create read stream
    const fileStream = fs.createReadStream(filePath);
    const fileSize = fs.statSync(filePath).size;
    let bytesRead = 0;

    // Parse CSV with streaming
    return new Promise((resolve, reject) => {
      Papa.parse(fileStream, {
        header: true,
        skipEmptyLines: true,
        chunk: (results, parser) => {
          // Process chunk
          recordsProcessed += results.data.length;
          
          if (headers.length === 0 && results.data.length > 0) {
            headers = Object.keys(results.data[0]);
          }
          
          // Calculate progress
          bytesRead += parser.stream.bytesRead;
          const progress = Math.min((bytesRead / fileSize) * 100, 99);
          
          // Update progress
          this.updateJobProgress(jobId, progress, recordsProcessed);
        },
        complete: async () => {
          // Complete processing
          const processingTime = Date.now() - startTime;
          
          await this.uploadRepository.update(jobId, {
            status: 'completed',
            progress: 100,
            recordsProcessed,
            totalRecords: recordsProcessed,
            csvHeaders: headers,
            processingTime,
            estimatedTimeRemaining: 0
          });
          
          // Clean up temporary file
          fs.unlinkSync(filePath);
          
          resolve();
        },
        error: async (error) => {
          await this.uploadRepository.update(jobId, {
            status: 'failed',
            errorMessage: `Processing failed: ${error.message}`
          });
          
          // Clean up temporary file
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          
          reject(error);
        }
      });
    });
  } catch (error) {
    await this.uploadRepository.update(jobId, {
      status: 'failed',
      errorMessage: `Stream processing failed: ${error.message}`
    });
    throw error;
  }
}
```

#### 1.3 Updated Upload Controller
**File:** `api/controllers/upload.controller.ts` (MODIFY)

```typescript
// Replace existing upload middleware
uploadMiddleware = streamingUpload.single('file');

// Update uploadFile method
uploadFile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      throw new Error('User not authenticated');
    }

    if (!req.file) {
      throw new Error('No file uploaded');
    }

    // Use streaming upload service
    const job: ProcessingJob = await this.uploadService.uploadFileStream(
      req.file,
      userId
    );

    const response: ApiResponse<ProcessingJob> = {
      success: true,
      data: job,
      message: 'File upload started successfully',
    };

    res.status(202).json(response); // 202 Accepted for async processing
  } catch (error) {
    next(error);
  }
};
```

### Phase 2: Frontend Updates (2-3 days)

#### 2.1 Enhanced Upload Component
**File:** `src/components/features/Upload/StreamingUpload.tsx` (NEW)

```typescript
import React, { useState, useCallback } from 'react';
import { Upload, Progress, Button, message, Alert } from 'antd';
import { InboxOutlined } from '@ant-design/icons';
import { useApi } from '../../hooks/useApi';
import type { UploadProps } from 'antd';

const { Dragger } = Upload;

interface StreamingUploadProps {
  onUploadComplete?: (jobId: string) => void;
  maxFileSize?: number; // in bytes
}

export const StreamingUpload: React.FC<StreamingUploadProps> = ({
  onUploadComplete,
  maxFileSize = 3 * 1024 * 1024 * 1024 // 3GB
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [currentJob, setCurrentJob] = useState<string | null>(null);
  
  const { data: jobStatus, refetch } = useApi(
    () => currentJob ? fetch(`/api/upload/jobs/${currentJob}`) : null,
    [currentJob]
  );

  // Poll for progress updates
  React.useEffect(() => {
    if (currentJob && jobStatus?.status === 'processing') {
      const interval = setInterval(() => {
        refetch();
      }, 1000); // Update every second
      
      return () => clearInterval(interval);
    }
    
    if (jobStatus?.status === 'completed') {
      setUploading(false);
      setUploadProgress(100);
      onUploadComplete?.(currentJob);
    }
  }, [currentJob, jobStatus?.status, refetch, onUploadComplete]);

  const handleUpload = useCallback(async (file: File) => {
    // Validate file size
    if (file.size > maxFileSize) {
      message.error(`File size exceeds ${maxFileSize / (1024 * 1024 * 1024)}GB limit`);
      return false;
    }

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.csv')) {
      message.error('Only CSV files are allowed');
      return false;
    }

    setUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const result = await response.json();
      setCurrentJob(result.data.id);
      
      message.success('Upload started successfully');
      return true;
    } catch (error) {
      message.error(`Upload failed: ${error.message}`);
      setUploading(false);
      return false;
    }
  }, [maxFileSize]);

  const uploadProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.csv',
    beforeUpload: handleUpload,
    showUploadList: false,
    disabled: uploading
  };

  return (
    <div className="streaming-upload">
      <Alert
        message="Large File Upload"
        description={`Support for files up to ${maxFileSize / (1024 * 1024 * 1024)}GB. Upload progress will be shown in real-time.`}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Dragger {...uploadProps}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">
          Click or drag CSV file to this area to upload
        </p>
        <p className="ant-upload-hint">
          Support for single CSV file upload. Maximum file size: {maxFileSize / (1024 * 1024 * 1024)}GB
        </p>
      </Dragger>

      {uploading && (
        <div style={{ marginTop: 16 }}>
          <Progress
            percent={jobStatus?.progress || 0}
            status={jobStatus?.status === 'failed' ? 'exception' : 'active'}
            format={(percent) => `${percent?.toFixed(1)}%`}
          />
          {jobStatus && (
            <div style={{ marginTop: 8, fontSize: '12px', color: '#666' }}>
              Status: {jobStatus.status} | 
              Records: {jobStatus.recordsProcessed || 0} | 
              {jobStatus.estimatedTimeRemaining && 
                ` ETA: ${Math.round(jobStatus.estimatedTimeRemaining / 1000)}s`
              }
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

### Phase 3: Database Schema Updates (1 day)

#### 3.1 Enhanced Upload Jobs Table
**File:** `database/migrations/003_enhance_upload_jobs.sql` (NEW)

```sql
-- Add enhanced tracking for streaming uploads
ALTER TABLE upload_jobs 
ADD COLUMN IF NOT EXISTS file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS chunk_size INTEGER DEFAULT 10000,
ADD COLUMN IF NOT EXISTS memory_usage BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS upload_speed BIGINT DEFAULT 0, -- bytes per second
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_retries INTEGER DEFAULT 3,
ADD COLUMN IF NOT EXISTS error_details JSONB;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_upload_jobs_status_progress 
ON upload_jobs(status, progress) 
WHERE status IN ('uploading', 'processing');

CREATE INDEX IF NOT EXISTS idx_upload_jobs_user_status 
ON upload_jobs(user_id, status);

-- Add table for upload chunks tracking
CREATE TABLE IF NOT EXISTS upload_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES upload_jobs(id) ON DELETE CASCADE,
    chunk_number INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    processing_time_ms INTEGER,
    UNIQUE(job_id, chunk_number)
);

CREATE INDEX IF NOT EXISTS idx_upload_chunks_job_id 
ON upload_chunks(job_id, chunk_number);
```

### Phase 4: Testing Implementation (2-3 days)

#### 4.1 Unit Tests
**File:** `tests/unit/services/upload.service.test.ts` (NEW)

```typescript
import { UploadService } from '../../../api/services/upload.service';
import { UploadRepository } from '../../../api/repositories/upload.repository';
import { JobQueueService } from '../../../api/services/job-queue.service';
import fs from 'fs';
import path from 'path';

describe('UploadService - Streaming Upload', () => {
  let uploadService: UploadService;
  let mockRepository: jest.Mocked<UploadRepository>;
  let mockJobQueue: jest.Mocked<JobQueueService>;
  const testUploadDir = './test-uploads';

  beforeEach(() => {
    mockRepository = createMockUploadRepository();
    mockJobQueue = createMockJobQueueService();
    uploadService = new UploadService(mockRepository, mockJobQueue);
    
    // Create test upload directory
    if (!fs.existsSync(testUploadDir)) {
      fs.mkdirSync(testUploadDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testUploadDir)) {
      fs.rmSync(testUploadDir, { recursive: true, force: true });
    }
  });

  describe('uploadFileStream', () => {
    it('should handle large CSV file streaming', async () => {
      // Arrange
      const largeCsvPath = path.join(testUploadDir, 'large-test.csv');
      createLargeTestCSV(largeCsvPath, 100000); // 100k rows
      
      const mockFile: Express.Multer.File = {
        originalname: 'large-test.csv',
        path: largeCsvPath,
        size: fs.statSync(largeCsvPath).size,
        mimetype: 'text/csv',
        fieldname: 'file',
        encoding: 'utf8',
        destination: testUploadDir,
        filename: 'large-test.csv'
      };

      const expectedJob: ProcessingJob = {
        id: 'job-id',
        userId: 'user-id',
        fileName: 'large-test.csv',
        fileSize: mockFile.size,
        status: 'uploading',
        progress: 0,
        recordsProcessed: 0,
        totalRecords: 0,
        csvHeaders: [],
        errorMessage: null,
        processingTime: null,
        estimatedTimeRemaining: null,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockRepository.create.mockResolvedValue(expectedJob);

      // Act
      const result = await uploadService.uploadFileStream(mockFile, 'user-id');

      // Assert
      expect(result).toEqual(expectedJob);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-id',
          fileName: 'large-test.csv',
          fileSize: mockFile.size,
          status: 'uploading'
        })
      );
    });

    it('should handle file processing errors gracefully', async () => {
      // Arrange
      const invalidCsvPath = path.join(testUploadDir, 'invalid.csv');
      fs.writeFileSync(invalidCsvPath, 'invalid,csv,content\n"unclosed quote');

      const mockFile: Express.Multer.File = {
        originalname: 'invalid.csv',
        path: invalidCsvPath,
        size: fs.statSync(invalidCsvPath).size,
        mimetype: 'text/csv',
        fieldname: 'file',
        encoding: 'utf8',
        destination: testUploadDir,
        filename: 'invalid.csv'
      };

      // Act & Assert
      await expect(
        uploadService.uploadFileStream(mockFile, 'user-id')
      ).rejects.toThrow();

      // Verify error handling
      expect(mockRepository.update).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('Processing failed')
        })
      );
    });
  });

  function createLargeTestCSV(filePath: string, rows: number): void {
    const writeStream = fs.createWriteStream(filePath);
    
    // Write header
    writeStream.write('id,name,email,age,city\n');
    
    // Write data rows
    for (let i = 1; i <= rows; i++) {
      writeStream.write(
        `${i},User ${i},user${i}@example.com,${20 + (i % 50)},City ${i % 10}\n`
      );
    }
    
    writeStream.end();
  }
});
```

#### 4.2 Integration Tests
**File:** `tests/integration/upload.integration.test.ts` (NEW)

```typescript
import request from 'supertest';
import { app } from '../../api/index';
import { setupTestDatabase, cleanupTestDatabase } from '../helpers/database';
import path from 'path';
import fs from 'fs';

describe('Upload Integration Tests', () => {
  let authToken: string;
  let testUserId: string;

  beforeAll(async () => {
    await setupTestDatabase();
    
    // Create test user and get auth token
    const registerResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      });

    testUserId = registerResponse.body.data.id;
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });

    authToken = loginResponse.body.data.token;
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/upload', () => {
    it('should upload and process large CSV file', async () => {
      // Create test CSV file (100MB)
      const testCsvPath = path.join(__dirname, '../fixtures/large-test.csv');
      createTestCSV(testCsvPath, 1000000); // 1M rows

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testCsvPath)
        .expect(202);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.status).toBe('uploading');
      expect(response.body.data.fileName).toBe('large-test.csv');

      const jobId = response.body.data.id;

      // Poll for completion
      let jobStatus;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds max

      do {
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        const statusResponse = await request(app)
          .get(`/api/upload/jobs/${jobId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        jobStatus = statusResponse.body.data;
        attempts++;
      } while (
        ['uploading', 'processing'].includes(jobStatus.status) && 
        attempts < maxAttempts
      );

      expect(jobStatus.status).toBe('completed');
      expect(jobStatus.progress).toBe(100);
      expect(jobStatus.recordsProcessed).toBeGreaterThan(0);
      expect(jobStatus.csvHeaders).toContain('id');
      expect(jobStatus.csvHeaders).toContain('name');

      // Clean up
      fs.unlinkSync(testCsvPath);
    }, 120000); // 2 minute timeout

    it('should reject files larger than 3GB', async () => {
      // Create a file larger than 3GB (mock for testing)
      const largeFilePath = path.join(__dirname, '../fixtures/oversized.csv');
      
      // Create a file that exceeds the limit
      const writeStream = fs.createWriteStream(largeFilePath);
      writeStream.write('id,name\n');
      
      // Write enough data to exceed 3GB
      for (let i = 0; i < 3000000; i++) {
        writeStream.write(`${i},"Name ${i}"\n`);
      }
      writeStream.end();

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', largeFilePath)
        .expect(413);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('File too large');

      // Clean up
      fs.unlinkSync(largeFilePath);
    });
  });

  function createTestCSV(filePath: string, rows: number): void {
    const writeStream = fs.createWriteStream(filePath);
    
    writeStream.write('id,name,email,age,city\n');
    
    for (let i = 1; i <= rows; i++) {
      writeStream.write(
        `${i},User ${i},user${i}@example.com,${20 + (i % 50)},City ${i % 10}\n`
      );
    }
    
    writeStream.end();
  }
});
```

#### 4.3 Performance Tests
**File:** `tests/performance/upload.performance.test.ts` (NEW)

```typescript
import { performance } from 'perf_hooks';
import request from 'supertest';
import { app } from '../../api/index';
import path from 'path';
import fs from 'fs';

describe('Upload Performance Tests', () => {
  let authToken: string;

  beforeAll(async () => {
    // Setup auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.data.token;
  });

  describe('Memory Usage', () => {
    it('should maintain memory usage under 100MB for 1GB file', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Create 1GB test file
      const testFilePath = path.join(__dirname, '../fixtures/1gb-test.csv');
      createLargeCSV(testFilePath, 10000000); // 10M rows

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath)
        .expect(202);

      // Wait a bit for processing to start
      await new Promise(resolve => setTimeout(resolve, 5000));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024; // MB

      expect(memoryIncrease).toBeLessThan(100); // Should use less than 100MB additional memory

      // Clean up
      fs.unlinkSync(testFilePath);
    }, 300000); // 5 minute timeout
  });

  describe('Upload Speed', () => {
    it('should maintain upload speed of at least 10MB/s', async () => {
      const testFilePath = path.join(__dirname, '../fixtures/100mb-test.csv');
      createLargeCSV(testFilePath, 1000000); // 1M rows (~100MB)

      const startTime = performance.now();

      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', testFilePath)
        .expect(202);

      const endTime = performance.now();
      const durationSeconds = (endTime - startTime) / 1000;
      const fileSizeMB = fs.statSync(testFilePath).size / 1024 / 1024;
      const uploadSpeedMBps = fileSizeMB / durationSeconds;

      expect(uploadSpeedMBps).toBeGreaterThan(10); // At least 10MB/s

      // Clean up
      fs.unlinkSync(testFilePath);
    }, 120000); // 2 minute timeout
  });

  function createLargeCSV(filePath: string, rows: number): void {
    const writeStream = fs.createWriteStream(filePath);
    
    writeStream.write('id,name,email,age,city\n');
    
    for (let i = 1; i <= rows; i++) {
      writeStream.write(
        `${i},User ${i},user${i}@example.com,${20 + (i % 50)},City ${i % 10}\n`
      );
    }
    
    writeStream.end();
  }
});
```

### Phase 5: Monitoring and Observability (1 day)

#### 5.1 Upload Metrics
**File:** `api/middleware/upload-metrics.middleware.ts` (NEW)

```typescript
import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Define metrics
const uploadRequests = new Counter({
  name: 'upload_requests_total',
  help: 'Total number of upload requests',
  labelNames: ['status', 'user_id']
});

const uploadDuration = new Histogram({
  name: 'upload_duration_seconds',
  help: 'Duration of upload processing',
  labelNames: ['file_size_range'],
  buckets: [1, 5, 10, 30, 60, 120, 300, 600, 1800, 3600] // up to 1 hour
});

const activeUploads = new Gauge({
  name: 'active_uploads',
  help: 'Number of currently active uploads'
});

const uploadSize = new Histogram({
  name: 'upload_size_bytes',
  help: 'Size of uploaded files',
  labelNames: ['status'],
  buckets: [1024*1024, 10*1024*1024, 100*1024*1024, 1024*1024*1024, 3*1024*1024*1024]
});

export const uploadMetrics = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Increment active uploads
  activeUploads.inc();
  
  // Track file size if available
  if (req.file) {
    uploadSize.observe({ status: 'started' }, req.file.size);
  }

  // Override res.end to track completion
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = (Date.now() - startTime) / 1000;
    
    // Record metrics
    uploadDuration.observe(
      { file_size_range: getFileSizeRange(req.file?.size || 0) },
      duration
    );
    
    uploadRequests.inc({
      status: res.statusCode < 400 ? 'success' : 'error',
      user_id: req.user?.id || 'anonymous'
    });
    
    if (req.file) {
      uploadSize.observe(
        { status: res.statusCode < 400 ? 'success' : 'error' },
        req.file.size
      );
    }
    
    // Decrement active uploads
    activeUploads.dec();
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

function getFileSizeRange(size: number): string {
  if (size < 10 * 1024 * 1024) return '0-10MB';
  if (size < 100 * 1024 * 1024) return '10-100MB';
  if (size < 1024 * 1024 * 1024) return '100MB-1GB';
  return '1GB+';
}
```

---

## Code Architecture and Patterns

### 1. Streaming Architecture Pattern
```
Client Request → Upload Middleware → Disk Storage → Stream Processing → Database Updates
     ↓              ↓                    ↓              ↓                ↓
  Validation    File Storage      Chunked Reading   Progress Tracking   Job Completion
```

### 2. Error Handling Pattern
```typescript
// Consistent error handling across all layers
class UploadError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public details?: any
  ) {
    super(message);
    this.name = 'UploadError';
  }
}

// Error categories
const UPLOAD_ERRORS = {
  FILE_TOO_LARGE: 'FILE_TOO_LARGE',
  INVALID_FORMAT: 'INVALID_FORMAT',
  PROCESSING_FAILED: 'PROCESSING_FAILED',
  STORAGE_ERROR: 'STORAGE_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR'
};
```

### 3. Progress Tracking Pattern
```typescript
interface ProgressTracker {
  jobId: string;
  totalBytes: number;
  processedBytes: number;
  recordsProcessed: number;
  startTime: number;
  lastUpdateTime: number;
  
  getProgress(): number;
  getEstimatedTimeRemaining(): number;
  getUploadSpeed(): number;
}
```

### 4. Memory Management Pattern
```typescript
// Configurable memory limits
const MEMORY_CONFIG = {
  maxChunkSize: 1024 * 1024, // 1MB chunks
  maxConcurrentUploads: 5,
  memoryThreshold: 0.8, // 80% of available memory
  gcInterval: 30000 // 30 seconds
};

// Memory monitoring
class MemoryMonitor {
  checkMemoryUsage(): boolean {
    const usage = process.memoryUsage();
    const totalMemory = require('os').totalmem();
    const usagePercent = usage.heapUsed / totalMemory;
    
    if (usagePercent > MEMORY_CONFIG.memoryThreshold) {
      // Force garbage collection
      if (global.gc) {
        global.gc();
      }
      return false;
    }
    
    return true;
  }
}
```

---

## Specific File Modifications Required

### Backend Files
1. **NEW** `api/middleware/streaming-upload.middleware.ts`
2. **MODIFY** `api/controllers/upload.controller.ts`
   - Replace multer configuration
   - Update uploadFile method
   - Add progress tracking
3. **MODIFY** `api/services/upload.service.ts`
   - Add streaming upload method
   - Implement chunked processing
   - Add memory management
4. **MODIFY** `api/routes/upload.routes.ts`
   - Add metrics middleware
   - Update error handling
5. **NEW** `api/middleware/upload-metrics.middleware.ts`
6. **NEW** `database/migrations/003_enhance_upload_jobs.sql`

### Frontend Files
1. **NEW** `src/components/features/Upload/StreamingUpload.tsx`
2. **MODIFY** `src/pages/Upload.tsx`
   - Replace existing upload component
   - Add progress display
3. **MODIFY** `src/services/api.ts`
   - Add upload progress handling
   - Update error handling

### Configuration Files
1. **MODIFY** `docker-compose.dev.yml`
   - Add volume mounts for upload directory
   - Increase memory limits
2. **MODIFY** `docker-compose.prod.yml`
   - Add persistent storage for uploads
   - Configure resource limits
3. **MODIFY** `nginx.conf`
   - Increase client_max_body_size
   - Add timeout configurations

### Environment Variables
```bash
# Upload configuration
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=3221225472  # 3GB in bytes
MAX_CONCURRENT_UPLOADS=5
UPLOAD_TIMEOUT=3600000    # 1 hour in milliseconds
CHUNK_SIZE=1048576        # 1MB

# Memory management
MEMORY_THRESHOLD=0.8
GC_INTERVAL=30000

# Monitoring
ENABLE_UPLOAD_METRICS=true
METRICS_PORT=9090
```

---

## Testing Strategy and Requirements

### 1. Unit Testing (Target: 90% coverage)
- **Upload Service**: Streaming methods, error handling, progress tracking
- **Upload Controller**: Request handling, validation, response formatting
- **Middleware**: File validation, progress tracking, metrics collection
- **Repository**: Database operations, transaction handling

### 2. Integration Testing
- **End-to-end upload workflow**: From file selection to completion
- **Large file handling**: Test with files from 100MB to 3GB
- **Concurrent uploads**: Multiple simultaneous uploads
- **Error scenarios**: Network failures, disk full, invalid files

### 3. Performance Testing
- **Memory usage**: Must stay under 100MB for 1GB files
- **Upload speed**: Minimum 10MB/s sustained
- **Concurrent capacity**: Support 5+ simultaneous uploads
- **Database performance**: Query times under 100ms

### 4. Load Testing
```bash
# Artillery load test configuration
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 300
      arrivalRate: 10
      name: "Sustained load"
    - duration: 60
      arrivalRate: 20
      name: "Peak load"

scenarios:
  - name: "Upload large CSV"
    weight: 70
    flow:
      - post:
          url: "/api/auth/login"
          json:
            email: "test@example.com"
            password: "password123"
          capture:
            - json: "$.data.token"
              as: "authToken"
      
      - post:
          url: "/api/upload"
          headers:
            Authorization: "Bearer {{ authToken }}"
          formData:
            file: "@./test-files/large-test.csv"
```

### 5. Security Testing
- **File validation**: Malicious file detection
- **Size limits**: Enforcement of 3GB limit
- **Authentication**: Proper token validation
- **Rate limiting**: Upload frequency limits

### 6. Browser Compatibility Testing
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers (iOS Safari, Android Chrome)
- Progress indicator functionality
- File drag-and-drop support

---

## Deployment Considerations

### 1. Infrastructure Requirements
```yaml
# Docker resource limits
services:
  api:
    deploy:
      resources:
        limits:
          memory: 2G
          cpus: '1.0'
        reservations:
          memory: 1G
          cpus: '0.5'
    volumes:
      - ./uploads:/app/uploads
      - upload-temp:/tmp/uploads
    environment:
      - NODE_OPTIONS=--max-old-space-size=1536

volumes:
  upload-temp:
    driver: local
```

### 2. Storage Configuration
```bash
# Create upload directories with proper permissions
mkdir -p ./uploads ./uploads/temp ./uploads/processing
chmod 755 ./uploads
chmod 755 ./uploads/temp
chmod 755 ./uploads/processing

# Set up automatic cleanup
find ./uploads/temp -type f -mtime +1 -delete
find ./uploads/processing -type f -mtime +7 -delete
```

### 3. Nginx Configuration
```nginx
# nginx.conf updates
client_max_body_size 3G;
client_body_timeout 300s;
client_header_timeout 300s;
proxy_read_timeout 300s;
proxy_connect_timeout 300s;
proxy_send_timeout 300s;

# Upload endpoint specific configuration
location /api/upload {
    proxy_pass http://api:3000;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
}
```

### 4. Monitoring Setup
```yaml
# Prometheus configuration for upload metrics
scrape_configs:
  - job_name: 'atlas2-upload-metrics'
    static_configs:
      - targets: ['api:3000']
    metrics_path: '/metrics'
    scrape_interval: 5s
```

### 5. Health Checks
```typescript
// Enhanced health check for upload functionality
export const uploadHealthCheck = async (): Promise<HealthStatus> => {
  const checks = {
    uploadDirectory: await checkUploadDirectory(),
    diskSpace: await checkDiskSpace(),
    memoryUsage: checkMemoryUsage(),
    databaseConnection: await checkDatabaseConnection()
  };

  const healthy = Object.values(checks).every(check => check.healthy);

  return {
    status: healthy ? 'healthy' : 'unhealthy',
    checks,
    timestamp: new Date().toISOString()
  };
};
```

---

## Risk Mitigation Strategies

### 1. Memory Exhaustion Risks
**Risk**: Large files causing server memory exhaustion
**Mitigation**:
- Implement streaming processing with configurable chunk sizes
- Monitor memory usage and trigger garbage collection
- Set hard memory limits with process monitoring
- Implement queue system for upload throttling

```typescript
// Memory monitoring and protection
class MemoryProtection {
  private memoryThreshold = 0.8; // 80% of available memory
  
  async checkMemoryBeforeUpload(fileSize: number): Promise<boolean> {
    const memUsage = process.memoryUsage();
    const totalMem = require('os').totalmem();
    const usagePercent = memUsage.heapUsed / totalMem;
    
    if (usagePercent > this.memoryThreshold) {
      throw new UploadError(
        'Server memory usage too high. Please try again later.',
        'MEMORY_THRESHOLD_EXCEEDED',
        503
      );
    }
    
    return true;
  }
}
```

### 2. Disk Space Risks
**Risk**: Uploads filling up disk space
**Mitigation**:
- Monitor available disk space before accepting uploads
- Implement automatic cleanup of temporary files
- Set disk usage alerts and quotas
- Use separate storage volume for uploads

```typescript
// Disk space monitoring
class DiskSpaceMonitor {
  private minFreeSpaceGB = 10; // Minimum 10GB free space
  
  async checkDiskSpace(fileSize: number): Promise<boolean> {
    const stats = await fs.promises.statfs('./uploads');
    const freeSpaceGB = stats.bavail * stats.bsize / (1024 * 1024 * 1024);
    
    if (freeSpaceGB < this.minFreeSpaceGB) {
      throw new UploadError(
        'Insufficient disk space for upload.',
        'INSUFFICIENT_DISK_SPACE',
        507
      );
    }
    
    return true;
  }
}
```

### 3. Processing Timeout Risks
**Risk**: Large files causing processing timeouts
**Mitigation**:
- Implement configurable timeout handling
- Use background job processing for CSV parsing
- Add retry logic for failed processing
- Provide progress updates to prevent user abandonment

### 4. Security Risks
**Risk**: Malicious files or upload attacks
**Mitigation**:
- Enhanced file validation and scanning
- Rate limiting on upload endpoints
- File type and content verification
- Isolated processing environment

```typescript
// Security validation
class SecurityValidator {
  async validateFile(file: Express.Multer.File): Promise<boolean> {
    // Check file signature
    const buffer = fs.readFileSync(file.path, { start: 0, end: 1024 });
    const signature = buffer.toString('binary', 0, 4);
    
    // CSV files should start with text characters
    if (!/^[\x20-\x7E]/.test(signature)) {
      throw new UploadError(
        'Invalid file signature.',
        'INVALID_FILE_SIGNATURE',
        400
      );
    }
    
    // Scan for malicious patterns
    const content = fs.readFileSync(file.path, 'utf8');
    const maliciousPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i
    ];
    
    for (const pattern of maliciousPatterns) {
      if (pattern.test(content)) {
        throw new UploadError(
          'Potentially malicious content detected.',
          'MALICIOUS_CONTENT',
          400
        );
      }
    }
    
    return true;
  }
}
```

### 5. Data Corruption Risks
**Risk**: File corruption during upload or processing
**Mitigation**:
- Implement file integrity checks (hashing)
- Add transaction-based processing
- Create backup copies before processing
- Implement rollback mechanisms

```typescript
// File integrity verification
class IntegrityChecker {
  async calculateFileHash(filePath: string): Promise<string> {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256');
    const stream = fs.createReadStream(filePath);
    
    return new Promise((resolve, reject) => {
      stream.on('data', data => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
  
  async verifyFileIntegrity(filePath: string, expectedHash?: string): Promise<boolean> {
    const actualHash = await this.calculateFileHash(filePath);
    
    if (expectedHash && actualHash !== expectedHash) {
      throw new UploadError(
        'File integrity check failed.',
        'INTEGRITY_CHECK_FAILED',
        400
      );
    }
    
    return true;
  }
}
```

---

## Acceptance Criteria and Verification Steps

### Functional Acceptance Criteria

#### AC1: Large File Support
**Criteria**: Users can successfully upload CSV files up to 3GB
**Verification Steps**:
1. [ ] Upload 100MB CSV file - Success
2. [ ] Upload 500MB CSV file - Success  
3. [ ] Upload 1GB CSV file - Success
4. [ ] Upload 2GB CSV file - Success
5. [ ] Upload 3GB CSV file - Success
6. [ ] Upload 3.1GB CSV file - Rejected with appropriate error

#### AC2: Real-time Progress Tracking
**Criteria**: Upload progress is accurately displayed in real-time
**Verification Steps**:
1. [ ] Progress bar updates smoothly during upload
2. [ ] Percentage complete is accurate
3. [ ] Estimated time remaining is calculated and displayed
4. [ ] Records processed count updates during CSV parsing
5. [ ] Status changes correctly (uploading → processing → completed)

#### AC3: Memory Efficiency
**Criteria**: Memory usage remains within acceptable limits
**Verification Steps**:
1. [ ] Upload 1GB file - Memory usage stays under 100MB additional
2. [ ] Monitor memory during processing - No memory leaks detected
3. [ ] Multiple concurrent uploads - Memory scales linearly
4. [ ] Garbage collection works properly - Memory freed after completion

#### AC4: Error Handling
**Criteria**: Comprehensive error handling with user-friendly messages
**Verification Steps**:
1. [ ] Invalid file type - Clear error message
2. [ ] File too large - Specific size limit error
3. [ ] Network interruption - Graceful handling with retry option
4. [ ] Corrupted CSV file - Detailed error with line information
5. [ ] Server memory full - Friendly "try again later" message

#### AC5: Performance Standards
**Criteria**: Upload and processing meet performance requirements
**Verification Steps**:
1. [ ] Upload speed - Minimum 10MB/s sustained
2. [ ] Processing speed - 1000+ records/second
3. [ ] API response time - Under 200ms for status checks
4. [ ] Concurrent uploads - Support 5+ simultaneous uploads
5. [ ] Database queries - Under 100ms average response time

### Technical Acceptance Criteria

#### AC6: Code Quality
**Criteria**: Code follows established patterns and standards
**Verification Steps**:
1. [ ] TypeScript strict mode compliance
2. [ ] ESLint rules pass without warnings
3. [ ] Code coverage meets 90% threshold
4. [ ] All unit tests pass
5. [ ] Integration tests pass
6. [ ] Performance tests meet benchmarks

#### AC7: Security Compliance
**Criteria**: Security best practices are implemented
**Verification Steps**:
1. [ ] File validation prevents malicious uploads
2. [ ] Rate limiting prevents abuse
3. [ ] Authentication properly enforced
4. [ ] Error messages don't expose sensitive information
5. [ ] Input sanitization implemented
6. [ ] Security scan passes

#### AC8: Monitoring and Observability
**Criteria**: Comprehensive monitoring is in place
**Verification Steps**:
1. [ ] Upload metrics collected in Prometheus
2. [ ] Grafana dashboards display upload statistics
3. [ ] Error tracking implemented
4. [ ] Performance monitoring active
5. [ ] Health checks include upload functionality
6. [ ] Alerting configured for critical issues

### Integration Acceptance Criteria

#### AC9: API Compatibility
**Criteria**: Existing API patterns are maintained
**Verification Steps**:
1. [ ] Response format consistent with other endpoints
2. [ ] Error handling follows established patterns
3. [ ] Authentication unchanged
4. [ ] Rate limiting consistent
5. [ ] Documentation updated

#### AC10: Database Integration
**Criteria**: Database operations are efficient and reliable
**Verification Steps**:
1. [ ] Migration scripts run without errors
2. [ ] Database indexes improve query performance
3. [ ] Transactions properly handled
4. [ ] Connection pooling effective
5. [ ] Data integrity maintained

### User Experience Acceptance Criteria

#### AC11: Interface Responsiveness
**Criteria**: UI remains responsive during uploads
**Verification Steps**:
1. [ ] Page doesn't freeze during large uploads
2. [ ] User can navigate away and return to upload
3. [ ] Progress continues when tab is in background
4. [ ] Multiple uploads can be managed simultaneously
5. [ ] Interface works on mobile devices

#### AC12: Accessibility
**Criteria**: Upload interface meets accessibility standards
**Verification Steps**:
1. [ ] Screen reader compatibility
2. [ ] Keyboard navigation support
3. [ ] Color contrast compliance
4. [ ] Focus management proper
5. [ ] ARIA labels implemented

### Final Verification Checklist

#### Pre-deployment Verification
- [ ] All acceptance criteria met
- [ ] Performance benchmarks achieved
- [ ] Security scan passed
- [ ] Load testing completed
- [ ] Documentation updated
- [ ] Monitoring configured
- [ ] Backup procedures tested
- [ ] Rollback plan validated

#### Post-deployment Verification
- [ ] Production deployment successful
- [ ] Monitoring shows normal operation
- [ ] Sample uploads tested in production
- [ ] User acceptance testing completed
- [ ] Performance metrics within expected ranges
- [ ] Error rates within acceptable limits
- [ ] User feedback collected and positive

---

## Success Metrics and KPIs

### Technical Metrics
- **Upload Success Rate**: > 99%
- **Average Upload Speed**: > 10MB/s
- **Memory Usage**: < 100MB additional for 1GB files
- **API Response Time**: < 200ms for status checks
- **Error Rate**: < 1% for valid uploads

### Business Metrics
- **User Completion Rate**: > 95% for upload workflows
- **Support Tickets**: < 5 per week related to uploads
- **User Satisfaction**: > 4.5/5 rating
- **Processing Time**: < 5 minutes for 1GB files

### Monitoring Alerts
- Memory usage > 80%
- Disk space < 10GB free
- Upload failure rate > 5%
- API response time > 1s
- Concurrent uploads > 10

---

## Conclusion

This comprehensive handoff document provides the development team with all necessary information to successfully implement streaming upload functionality for 3GB CSV files in the Atlas2 project. The implementation addresses all identified QA concerns while maintaining system performance, security, and user experience standards.

The phased approach ensures systematic delivery with proper testing at each stage, while the risk mitigation strategies protect against potential issues. The acceptance criteria provide clear verification steps to ensure the implementation meets all requirements.

**Next Steps:**
1. Review and approve this handoff document
2. Assign development team members to each phase
3. Set up development environment with required dependencies
4. Begin Phase 1 implementation
5. Regular progress reviews and quality gate checks

**Estimated Timeline:** 10-12 business days from start to production deployment.