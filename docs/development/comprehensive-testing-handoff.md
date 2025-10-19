# Comprehensive Testing Development Handoff
**Upload and Authentication Flows - Complete Test Coverage Implementation**

**Document Version:** 1.0  
**Created:** 2025-10-19  
**Status:** Ready for Development  
**Priority:** CRITICAL  
**Target Coverage:** 90%+

---

## 🎯 Executive Summary

### Testing Gap Analysis
The Atlas2 project currently has **near-zero test coverage**, representing a critical quality risk. The QA assessment identified major gaps in testing for core functionality, particularly upload flows and authentication systems. This poses significant risks for:

- **Regression bugs** during feature development
- **Production failures** due to untested edge cases
- **Security vulnerabilities** in authentication flows
- **Performance issues** with large file uploads
- **Maintenance overhead** due to lack of test safety nets

### Solution Overview
Implement a comprehensive testing strategy that achieves 90%+ coverage through:
1. **Unit Tests** for all business logic and utilities
2. **Integration Tests** for API endpoints and database operations
3. **E2E Tests** for complete user workflows
4. **Performance Tests** for large file handling
5. **Security Tests** for authentication vulnerabilities
6. **Visual Regression Tests** for UI consistency

---

## 🏗️ Testing Architecture Strategy

### Test Pyramid Structure
```
    E2E Tests (10%)
   ─────────────────
  Integration Tests (20%)
 ─────────────────────────
Unit Tests (70%)
```

### Testing Technology Stack
- **Unit Testing**: Jest + TypeScript + React Testing Library
- **Integration Testing**: Jest + Supertest + Test Containers
- **E2E Testing**: Playwright + TypeScript
- **Performance Testing**: Artillery + Custom Benchmarks
- **Security Testing**: Jest + Security Test Utilities
- **Visual Testing**: Percy + Storybook
- **Coverage**: Jest Coverage + Istanbul Reports

### Test Organization Structure
```
tests/
├── unit/                    # 70% of tests
│   ├── components/         # React component tests
│   ├── services/           # Business logic tests
│   ├── utils/              # Utility function tests
│   ├── hooks/              # Custom hook tests
│   └── middleware/         # Express middleware tests
├── integration/            # 20% of tests
│   ├── api/                # API endpoint tests
│   ├── database/           # Database operation tests
│   └── workflows/          # Cross-service tests
├── e2e/                    # 10% of tests
│   ├── upload/             # Upload workflow tests
│   ├── auth/               # Authentication workflow tests
│   └── integration/        # API integration tests
├── performance/            # Performance benchmarks
├── security/               # Security test suites
└── fixtures/               # Test data and mocks
```

---

## 📋 Phase 1: Unit Testing Implementation (Week 1-2)

### 1.1 Upload Service Unit Tests
```typescript
// tests/unit/services/upload.service.test.ts
import { UploadService } from '@api/services/upload.service';
import { UploadRepository } from '@api/repositories/upload.repository';
import { JobQueueService } from '@api/services/job-queue.service';
import { AppError } from '@api/utils/errors';

describe('UploadService', () => {
  let uploadService: UploadService;
  let mockRepository: jest.Mocked<UploadRepository>;
  let mockJobQueue: jest.Mocked<JobQueueService>;

  beforeEach(() => {
    mockRepository = createMockUploadRepository();
    mockJobQueue = createMockJobQueueService();
    uploadService = new UploadService(mockRepository, mockJobQueue);
  });

  describe('uploadFile', () => {
    it('should successfully upload and process a CSV file', async () => {
      // Arrange
      const buffer = Buffer.from('name,email\nJohn,john@example.com');
      const originalName = 'test.csv';
      const size = buffer.length;
      const userId = 'user-123';

      const expectedJob = createMockProcessingJob();
      mockRepository.create.mockResolvedValue(expectedJob);
      mockJobQueue.addJob.mockResolvedValue(undefined);

      // Act
      const result = await uploadService.uploadFile(buffer, originalName, size, userId);

      // Assert
      expect(result).toEqual(expectedJob);
      expect(mockRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          fileName: originalName,
          fileSize: size,
          status: 'pending'
        })
      );
      expect(mockJobQueue.addJob).toHaveBeenCalledWith('csv-processing', {
        jobId: expectedJob.id,
        userId,
        fileName: originalName,
        csvData: buffer.toString()
      });
    });

    it('should handle large file streaming without memory issues', async () => {
      // Arrange
      const largeBuffer = generateLargeCSVBuffer(1000000); // 1M rows
      const userId = 'user-123';

      // Mock to track memory usage
      const initialMemory = process.memoryUsage().heapUsed;
      
      const expectedJob = createMockProcessingJob();
      mockRepository.create.mockResolvedValue(expectedJob);
      mockJobQueue.addJob.mockResolvedValue(undefined);

      // Act
      const result = await uploadService.uploadFile(
        largeBuffer, 
        'large.csv', 
        largeBuffer.length, 
        userId
      );

      // Assert
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      expect(result).toBeDefined();
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Less than 100MB increase
    });

    it('should reject files larger than 3GB', async () => {
      // Arrange
      const oversizedBuffer = Buffer.alloc(3 * 1024 * 1024 * 1024 + 1); // 3GB + 1 byte
      const userId = 'user-123';

      // Act & Assert
      await expect(
        uploadService.uploadFile(oversizedBuffer, 'oversized.csv', oversizedBuffer.length, userId)
      ).rejects.toThrow(AppError);
    });

    it('should handle malformed CSV files gracefully', async () => {
      // Arrange
      const malformedCSV = Buffer.from('invalid,csv,format\n"unclosed quote');
      const userId = 'user-123';

      // Act & Assert
      await expect(
        uploadService.uploadFile(malformedCSV, 'malformed.csv', malformedCSV.length, userId)
      ).rejects.toThrow(/CSV parsing failed/);
    });
  });

  describe('getJobStatus', () => {
    it('should return job status for valid job ID', async () => {
      // Arrange
      const jobId = 'job-123';
      const userId = 'user-123';
      const expectedJob = createMockProcessingJob({ id: jobId, userId });
      mockRepository.findById.mockResolvedValue(expectedJob);

      // Act
      const result = await uploadService.getJobStatus(jobId, userId);

      // Assert
      expect(result).toEqual(expectedJob);
      expect(mockRepository.findById).toHaveBeenCalledWith(jobId);
    });

    it('should throw error for non-existent job', async () => {
      // Arrange
      const jobId = 'non-existent';
      const userId = 'user-123';
      mockRepository.findById.mockResolvedValue(null);

      // Act & Assert
      await expect(uploadService.getJobStatus(jobId, userId))
        .rejects.toThrow('Job not found');
    });

    it('should prevent access to other users jobs', async () => {
      // Arrange
      const jobId = 'job-123';
      const userId = 'user-123';
      const otherUserJob = createMockProcessingJob({ id: jobId, userId: 'other-user' });
      mockRepository.findById.mockResolvedValue(otherUserJob);

      // Act & Assert
      await expect(uploadService.getJobStatus(jobId, userId))
        .rejects.toThrow('Access denied');
    });
  });
});

// Helper functions
function createMockUploadRepository(): jest.Mocked<UploadRepository> {
  return {
    create: jest.fn(),
    findById: jest.fn(),
    findByUserId: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getFileData: jest.fn()
  } as any;
}

function createMockJobQueueService(): jest.Mocked<JobQueueService> {
  return {
    addJob: jest.fn(),
    cancelJob: jest.fn(),
    getJobStatus: jest.fn()
  } as any;
}

function createMockProcessingJob(overrides: Partial<ProcessingJob> = {}): ProcessingJob {
  return {
    id: 'job-123',
    userId: 'user-123',
    fileName: 'test.csv',
    fileSize: 1024,
    status: 'pending',
    progress: 0,
    recordsProcessed: 0,
    totalRecords: 100,
    csvHeaders: ['name', 'email'],
    errorMessage: null,
    processingTime: null,
    estimatedTimeRemaining: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

function generateLargeCSVBuffer(rows: number): Buffer {
  const headers = 'id,name,email,age\n';
  const rowsArray = Array.from({ length: rows }, (_, i) => 
    `${i},User${i},user${i}@example.com,${20 + (i % 50)}`
  );
  return Buffer.from(headers + rowsArray.join('\n'));
}
```

### 1.2 Authentication Service Unit Tests
```typescript
// tests/unit/services/auth.service.test.ts
import { AuthService } from '@api/services/auth.service';
import { UserRepository } from '@api/repositories/user.repository';
import { ApiKeyAuthManager } from '@api/services/api-key-auth-manager.service';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let authService: AuthService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockApiKeyManager: jest.Mocked<ApiKeyAuthManager>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockApiKeyManager = createMockApiKeyManager();
    authService = new AuthService(mockUserRepository, mockApiKeyManager);
  });

  describe('JWT Authentication', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'password123';
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = createMockUser({ email, password: hashedPassword });
      
      mockUserRepository.findByEmail.mockResolvedValue(user);

      // Act
      const result = await authService.authenticateUser(email, password);

      // Assert
      expect(result).toBeDefined();
      expect(result.token).toBeDefined();
      expect(result.user.id).toBe(user.id);
      expect(result.user.email).toBe(email);
      
      // Verify JWT token
      const decoded = jwt.verify(result.token, process.env.JWT_SECRET!) as any;
      expect(decoded.userId).toBe(user.id);
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      const email = 'test@example.com';
      const password = 'wrongpassword';
      const user = createMockUser({ email });
      
      mockUserRepository.findByEmail.mockResolvedValue(user);

      // Act & Assert
      await expect(authService.authenticateUser(email, password))
        .rejects.toThrow('Invalid credentials');
    });

    it('should handle non-existent user', async () => {
      // Arrange
      const email = 'nonexistent@example.com';
      mockUserRepository.findByEmail.mockResolvedValue(null);

      // Act & Assert
      await expect(authService.authenticateUser(email, 'password'))
        .rejects.toThrow('Invalid credentials');
    });
  });

  describe('API Key Authentication', () => {
    it('should validate API key configuration', async () => {
      // Arrange
      const configId = 'config-123';
      const testEndpoint = 'https://api.example.com/test';
      const expectedResult = { valid: true, responseTime: 150 };
      
      mockApiKeyManager.validateApiKey.mockResolvedValue(expectedResult);

      // Act
      const result = await authService.validateApiKey(configId, testEndpoint);

      // Assert
      expect(result).toEqual(expectedResult);
      expect(mockApiKeyManager.validateApiKey).toHaveBeenCalledWith(configId, testEndpoint);
    });

    it('should inject API key into requests', async () => {
      // Arrange
      const configId = 'config-123';
      const request = { method: 'GET', url: 'https://api.example.com' };
      const expectedRequest = {
        ...request,
        headers: { 'X-API-Key': 'test-key' }
      };
      
      mockApiKeyManager.injectAuthentication.mockResolvedValue(expectedRequest);

      // Act
      const result = await authService.injectApiKeyAuth(request, configId);

      // Assert
      expect(result).toEqual(expectedRequest);
      expect(mockApiKeyManager.injectAuthentication).toHaveBeenCalledWith(request, configId);
    });
  });

  describe('Basic Authentication', () => {
    it('should authenticate with valid basic auth credentials', async () => {
      // Arrange
      const credentials = Buffer.from('test@example.com:password123').toString('base64');
      const user = createMockUser({ email: 'test@example.com' });
      
      mockUserRepository.findByEmail.mockResolvedValue(user);

      // Act
      const result = await authService.authenticateBasic(credentials);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe(user.id);
    });

    it('should reject malformed basic auth header', async () => {
      // Arrange
      const malformedCredentials = 'invalid-base64';

      // Act & Assert
      await expect(authService.authenticateBasic(malformedCredentials))
        .rejects.toThrow('Invalid basic authentication format');
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should validate JWT bearer token', async () => {
      // Arrange
      const user = createMockUser();
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
      mockUserRepository.findById.mockResolvedValue(user);

      // Act
      const result = await authService.authenticateBearer(token);

      // Assert
      expect(result).toBeDefined();
      expect(result.user.id).toBe(user.id);
    });

    it('should reject expired JWT token', async () => {
      // Arrange
      const expiredToken = jwt.sign(
        { userId: 'user-123' }, 
        process.env.JWT_SECRET!, 
        { expiresIn: '-1h' }
      );

      // Act & Assert
      await expect(authService.authenticateBearer(expiredToken))
        .rejects.toThrow('Token expired');
    });
  });
});
```

### 1.3 React Component Unit Tests
```typescript
// tests/unit/components/StreamingUpload.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StreamingUpload } from '@/components/StreamingUpload';
import { useFileUpload } from '@/hooks/useFileUpload';
import { ApiClient } from '@/services/api';

// Mock hooks and services
jest.mock('@/hooks/useFileUpload');
jest.mock('@/services/api');

const mockUseFileUpload = useFileUpload as jest.MockedFunction<typeof useFileUpload>;
const mockApiClient = ApiClient as jest.MockedClass<typeof ApiClient>;

describe('StreamingUpload Component', () => {
  const mockUploadFile = jest.fn();
  const mockUploadProgress = 0;
  const mockUploadSpeed = 0;
  const mockIsUploading = false;
  const mockError = null;

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      uploadProgress: mockUploadProgress,
      uploadSpeed: mockUploadSpeed,
      isUploading: mockIsUploading,
      error: mockError,
      resetUpload: jest.fn()
    });
  });

  it('should render upload interface correctly', () => {
    // Act
    render(<StreamingUpload />);

    // Assert
    expect(screen.getByText('Drop CSV files here or click to browse')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
  });

  it('should handle file selection', async () => {
    // Arrange
    const file = new File(['test,data'], 'test.csv', { type: 'text/csv' });
    const user = userEvent.setup();

    render(<StreamingUpload />);

    // Act
    const fileInput = screen.getByRole('button', { name: /select files/i });
    await user.click(fileInput);
    
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
    await user.upload(input, file);

    // Assert
    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file);
    });
  });

  it('should display upload progress', () => {
    // Arrange
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      uploadProgress: 45,
      uploadSpeed: 1024 * 1024, // 1MB/s
      isUploading: true,
      error: null,
      resetUpload: jest.fn()
    });

    // Act
    render(<StreamingUpload />);

    // Assert
    expect(screen.getByText('45%')).toBeInTheDocument();
    expect(screen.getByText('1 MB/s')).toBeInTheDocument();
  });

  it('should display error message', () => {
    // Arrange
    const errorMessage = 'File too large';
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      uploadProgress: 0,
      uploadSpeed: 0,
      isUploading: false,
      error: errorMessage,
      resetUpload: jest.fn()
    });

    // Act
    render(<StreamingUpload />);

    // Assert
    expect(screen.getByText(errorMessage)).toBeInTheDocument();
  });

  it('should validate file type', async () => {
    // Arrange
    const invalidFile = new File(['test'], 'test.txt', { type: 'text/plain' });
    const user = userEvent.setup();

    render(<StreamingUpload />);

    // Act
    const fileInput = screen.getByRole('button', { name: /select files/i });
    await user.click(fileInput);
    
    const input = screen.getByRole('textbox', { hidden: true }) as HTMLInputElement;
    await user.upload(input, invalidFile);

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/only csv files are allowed/i)).toBeInTheDocument();
    });
    expect(mockUploadFile).not.toHaveBeenCalled();
  });

  it('should handle drag and drop', async () => {
    // Arrange
    const file = new File(['test,data'], 'test.csv', { type: 'text/csv' });
    const user = userEvent.setup();

    render(<StreamingUpload />);

    const dropZone = screen.getByTestId('drop-zone');

    // Act
    fireEvent.dragEnter(dropZone);
    fireEvent.dragOver(dropZone);
    fireEvent.drop(dropZone, {
      dataTransfer: {
        files: [file]
      }
    });

    // Assert
    await waitFor(() => {
      expect(mockUploadFile).toHaveBeenCalledWith(file);
    });
  });

  it('should show loading state during upload', () => {
    // Arrange
    mockUseFileUpload.mockReturnValue({
      uploadFile: mockUploadFile,
      uploadProgress: 25,
      uploadSpeed: 512 * 1024,
      isUploading: true,
      error: null,
      resetUpload: jest.fn()
    });

    // Act
    render(<StreamingUpload />);

    // Assert
    expect(screen.getByRole('button', { name: /uploading/i })).toBeDisabled();
    expect(screen.getByTestId('progress-bar')).toBeInTheDocument();
  });
});
```

---

## 📋 Phase 2: Integration Testing Implementation (Week 2-3)

### 2.1 API Endpoint Integration Tests
```typescript
// tests/integration/api/upload.test.ts
import request from 'supertest';
import { app } from '@api/app';
import { setupTestDatabase, cleanupTestDatabase } from '@tests/helpers/database';
import { createTestUser, generateAuthToken } from '@tests/helpers/auth';

describe('Upload API Integration Tests', () => {
  let authToken: string;
  let testUser: any;

  beforeAll(async () => {
    await setupTestDatabase();
    testUser = await createTestUser();
    authToken = generateAuthToken(testUser.id);
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/upload', () => {
    it('should upload a CSV file successfully', async () => {
      // Arrange
      const csvContent = 'name,email\nJohn Doe,john@example.com';
      const buffer = Buffer.from(csvContent);

      // Act
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', buffer, 'test.csv')
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        fileName: 'test.csv',
        fileSize: buffer.length,
        status: 'pending'
      });
      expect(response.body.data.id).toBeDefined();
    });

    it('should handle large file uploads', async () => {
      // Arrange
      const largeCsv = generateLargeCSVContent(10000); // 10K rows
      const buffer = Buffer.from(largeCsv);

      // Act
      const startTime = Date.now();
      const response = await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', buffer, 'large.csv')
        .expect(201);
      const duration = Date.now() - startTime;

      // Assert
      expect(response.body.success).toBe(true);
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should reject files larger than 3GB', async () => {
      // Arrange
      const oversizedBuffer = Buffer.alloc(3 * 1024 * 1024 * 1024 + 1);

      // Act & Assert
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', oversizedBuffer, 'oversized.csv')
        .expect(413);
    });

    it('should require authentication', async () => {
      // Arrange
      const buffer = Buffer.from('test,data');

      // Act & Assert
      await request(app)
        .post('/api/upload')
        .attach('file', buffer, 'test.csv')
        .expect(401);
    });

    it('should validate file type', async () => {
      // Arrange
      const buffer = Buffer.from('test content');

      // Act & Assert
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', buffer, 'test.txt')
        .expect(400);
    });
  });

  describe('GET /api/upload/:jobId/status', () => {
    it('should return job status for valid job', async () => {
      // Arrange
      const uploadResponse = await uploadTestFile(authToken);
      const jobId = uploadResponse.body.data.id;

      // Act
      const response = await request(app)
        .get(`/api/upload/${jobId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(jobId);
    });

    it('should prevent access to other users jobs', async () => {
      // Arrange
      const otherUser = await createTestUser();
      const otherToken = generateAuthToken(otherUser.id);
      const uploadResponse = await uploadTestFile(otherToken);
      const jobId = uploadResponse.body.data.id;

      // Act & Assert
      await request(app)
        .get(`/api/upload/${jobId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);
    });
  });

  // Helper functions
  async function uploadTestFile(token: string) {
    const csvContent = 'name,email\nTest User,test@example.com';
    return await request(app)
      .post('/api/upload')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', Buffer.from(csvContent), 'test.csv');
  }

  function generateLargeCSVContent(rows: number): string {
    const headers = 'id,name,email,age\n';
    const rowsArray = Array.from({ length: rows }, (_, i) => 
      `${i},User${i},user${i}@example.com,${20 + (i % 50)}`
    );
    return headers + rowsArray.join('\n');
  }
});
```

### 2.2 Authentication Integration Tests
```typescript
// tests/integration/api/auth.test.ts
import request from 'supertest';
import { app } from '@api/app';
import { setupTestDatabase, cleanupTestDatabase } from '@tests/helpers/database';

describe('Authentication API Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await cleanupTestDatabase();
  });

  describe('POST /api/auth/login', () => {
    it('should authenticate user with valid credentials', async () => {
      // Arrange
      const testUser = {
        email: 'test@example.com',
        password: 'password123'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/login')
        .send(testUser)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.token).toBeDefined();
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should reject invalid credentials', async () => {
      // Arrange
      const invalidCredentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Act & Assert
      await request(app)
        .post('/api/auth/login')
        .send(invalidCredentials)
        .expect(401);
    });
  });

  describe('API Key Authentication', () => {
    it('should create API key configuration', async () => {
      // Arrange
      const user = await createTestUser();
      const token = generateAuthToken(user.id);
      const apiKeyConfig = {
        clientId: 'client-123',
        name: 'Test API Key',
        key: 'test-api-key-123',
        location: 'header',
        keyName: 'X-API-Key'
      };

      // Act
      const response = await request(app)
        .post('/api/auth/api-keys')
        .set('Authorization', `Bearer ${token}`)
        .send(apiKeyConfig)
        .expect(201);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(apiKeyConfig.name);
      expect(response.body.data.key).toBeUndefined(); // Should not return actual key
    });

    it('should validate API key with test endpoint', async () => {
      // Arrange
      const user = await createTestUser();
      const token = generateAuthToken(user.id);
      const config = await createApiKeyConfig(user.id);
      
      // Act
      const response = await request(app)
        .post(`/api/auth/api-keys/${config.id}/validate`)
        .set('Authorization', `Bearer ${token}`)
        .send({ testEndpoint: 'https://httpbin.org/get' })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.valid).toBeDefined();
      expect(response.body.data.responseTime).toBeDefined();
    });
  });

  describe('Basic Authentication', () => {
    it('should authenticate with basic auth header', async () => {
      // Arrange
      const user = await createTestUser();
      const credentials = Buffer.from(`${user.email}:password123`).toString('base64');

      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Basic ${credentials}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(user.email);
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should authenticate with JWT bearer token', async () => {
      // Arrange
      const user = await createTestUser();
      const token = generateAuthToken(user.id);

      // Act
      const response = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.data.email).toBe(user.email);
    });

    it('should reject expired bearer token', async () => {
      // Arrange
      const expiredToken = generateExpiredToken();

      // Act & Assert
      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);
    });
  });
});
```

---

## 📋 Phase 3: E2E Testing Implementation (Week 3-4)

### 3.1 Upload Workflow E2E Tests
```typescript
// tests/e2e/upload-workflow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Upload Workflow E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Login before each test
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');
  });

  test('should complete full upload workflow', async ({ page }) => {
    // Navigate to upload page
    await page.click('[data-testid=upload-nav]');
    await page.waitForURL('/upload');

    // Upload a CSV file
    const fileContent = 'name,email\nJohn Doe,john@example.com\nJane Smith,jane@example.com';
    const file = new Buffer(fileContent);
    
    await page.setInputFiles('[data-testid=file-input]', {
      name: 'test.csv',
      mimeType: 'text/csv',
      buffer: file
    });

    // Wait for upload to start
    await expect(page.locator('[data-testid=upload-progress]')).toBeVisible();
    
    // Wait for upload to complete
    await expect(page.locator('[data-testid=upload-status]')).toContainText('Completed', {
      timeout: 30000
    });

    // Verify upload appears in history
    await page.click('[data-testid=history-tab]');
    await expect(page.locator('[data-testid=upload-item]')).toHaveCount(1);
    await expect(page.locator('[data-testid=upload-item]')).toContainText('test.csv');
  });

  test('should handle large file upload', async ({ page }) => {
    // Generate large CSV file (10MB)
    const largeCsv = generateLargeCSVContent(100000);
    const file = new Buffer(largeCsv);

    await page.goto('/upload');
    await page.setInputFiles('[data-testid=file-input]', {
      name: 'large.csv',
      mimeType: 'text/csv',
      buffer: file
    });

    // Monitor progress
    await expect(page.locator('[data-testid=upload-progress]')).toBeVisible();
    
    // Verify progress updates
    let lastProgress = 0;
    for (let i = 0; i < 10; i++) {
      const progressText = await page.locator('[data-testid=progress-percentage]').textContent();
      const currentProgress = parseInt(progressText || '0');
      expect(currentProgress).toBeGreaterThanOrEqual(lastProgress);
      lastProgress = currentProgress;
      await page.waitForTimeout(1000);
    }

    // Wait for completion
    await expect(page.locator('[data-testid=upload-status]')).toContainText('Completed', {
      timeout: 60000
    });
  });

  test('should show appropriate error for invalid file type', async ({ page }) => {
    await page.goto('/upload');
    
    // Try to upload a non-CSV file
    await page.setInputFiles('[data-testid=file-input]', {
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test content')
    });

    // Verify error message
    await expect(page.locator('[data-testid=error-message]')).toContainText('Only CSV files are allowed');
  });

  test('should handle upload cancellation', async ({ page }) => {
    // Start upload of a large file
    const largeCsv = generateLargeCSVContent(50000);
    const file = new Buffer(largeCsv);

    await page.goto('/upload');
    await page.setInputFiles('[data-testid=file-input]', {
      name: 'large.csv',
      mimeType: 'text/csv',
      buffer: file
    });

    // Wait for upload to start
    await expect(page.locator('[data-testid=upload-progress]')).toBeVisible();

    // Cancel upload
    await page.click('[data-testid=cancel-button]');

    // Verify cancellation
    await expect(page.locator('[data-testid=upload-status]')).toContainText('Cancelled');
  });

  test('should support drag and drop upload', async ({ page }) => {
    await page.goto('/upload');

    const fileContent = 'name,email\nTest User,test@example.com';
    const file = new Buffer(fileContent);

    // Create a DataTransfer object for drag and drop
    const dataTransfer = await page.evaluateHandle(() => new DataTransfer());
    await dataTransfer.evaluate((dt: any, fileData, fileName) => {
      const file = new File([fileData], fileName, { type: 'text/csv' });
      dt.items.add(file);
    }, file, 'drag-drop.csv');

    // Perform drag and drop
    await page.locator('[data-testid=drop-zone]').dispatchEvent('dragover', { dataTransfer });
    await page.locator('[data-testid=drop-zone]').dispatchEvent('drop', { dataTransfer });

    // Verify upload starts
    await expect(page.locator('[data-testid=upload-progress]')).toBeVisible();
  });

  function generateLargeCSVContent(rows: number): string {
    const headers = 'id,name,email,age\n';
    const rowsArray = Array.from({ length: rows }, (_, i) => 
      `${i},User${i},user${i}@example.com,${20 + (i % 50)}`
    );
    return headers + rowsArray.join('\n');
  }
});
```

### 3.2 Authentication Workflow E2E Tests
```typescript
// tests/e2e/auth-workflow.test.ts
import { test, expect } from '@playwright/test';

test.describe('Authentication Workflow E2E Tests', () => {
  test('should complete login workflow', async ({ page }) => {
    // Navigate to login page
    await page.goto('/login');

    // Fill login form
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');

    // Verify successful login
    await expect(page).toHaveURL('/dashboard');
    await expect(page.locator('[data-testid=user-menu]')).toContainText('test@example.com');
  });

  test('should show error for invalid credentials', async ({ page }) => {
    await page.goto('/login');

    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'wrongpassword');
    await page.click('[data-testid=login-button]');

    await expect(page.locator('[data-testid=error-message]')).toContainText('Invalid credentials');
    await expect(page).toHaveURL('/login');
  });

  test('should handle API key configuration workflow', async ({ page }) => {
    // Login first
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // Navigate to API integration
    await page.click('[data-testid=integration-nav]');
    await page.click('[data-testid=add-api-key]');

    // Fill API key form
    await page.fill('[data-testid=config-name]', 'Test API Key');
    await page.fill('[data-testid=api-key]', 'test-api-key-123');
    await page.selectOption('[data-testid=key-location]', 'header');
    await page.fill('[data-testid=key-name]', 'X-API-Key');

    // Test API key
    await page.fill('[data-testid=test-endpoint]', 'https://httpbin.org/get');
    await page.click('[data-testid=test-button]');

    // Wait for test results
    await expect(page.locator('[data-testid=test-result]')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('[data-testid=test-result]')).toContainText('Valid');

    // Save configuration
    await page.click('[data-testid=save-button]');

    // Verify configuration appears in list
    await expect(page.locator('[data-testid=api-key-list]')).toContainText('Test API Key');
  });

  test('should handle session timeout', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');

    // Simulate session timeout by clearing cookies
    await page.context().clearCookies();

    // Try to access protected page
    await page.goto('/dashboard');

    // Should redirect to login
    await expect(page).toHaveURL('/login');
    await expect(page.locator('[data-testid=timeout-message]')).toContainText('Session expired');
  });

  test('should support logout workflow', async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.fill('[data-testid=email]', 'test@example.com');
    await page.fill('[data-testid=password]', 'password123');
    await page.click('[data-testid=login-button]');
    await page.waitForURL('/dashboard');

    // Logout
    await page.click('[data-testid=user-menu]');
    await page.click('[data-testid=logout-button]');

    // Verify logout
    await expect(page).toHaveURL('/login');
    
    // Try to access protected page
    await page.goto('/dashboard');
    await expect(page).toHaveURL('/login');
  });
});
```

---

## 📋 Phase 4: Performance Testing Implementation (Week 4)

### 4.1 Upload Performance Tests
```typescript
// tests/performance/upload-performance.test.ts
import { performance } from 'perf_hooks';
import { UploadService } from '@api/services/upload.service';
import { generateLargeCSVBuffer } from '@tests/helpers/csv-generator';

describe('Upload Performance Tests', () => {
  let uploadService: UploadService;

  beforeAll(() => {
    uploadService = new UploadService(/* dependencies */);
  });

  describe('Memory Usage Tests', () => {
    it('should handle 1GB file with <100MB memory increase', async () => {
      // Arrange
      const largeBuffer = generateLargeCSVBuffer(1000000); // 1M rows ~1GB
      const initialMemory = process.memoryUsage().heapUsed;

      // Act
      const startTime = performance.now();
      await uploadService.uploadFile(largeBuffer, 'large.csv', largeBuffer.length, 'user-123');
      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      // Assert
      const memoryIncrease = finalMemory - initialMemory;
      const processingTime = endTime - startTime;

      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // <100MB
      expect(processingTime).toBeLessThan(30000); // <30 seconds
    });

    it('should process multiple concurrent uploads efficiently', async () => {
      // Arrange
      const concurrentUploads = 10;
      const fileBuffer = generateLargeCSVBuffer(10000); // 10K rows each
      const initialMemory = process.memoryUsage().heapUsed;

      // Act
      const uploadPromises = Array.from({ length: concurrentUploads }, (_, i) =>
        uploadService.uploadFile(fileBuffer, `file-${i}.csv`, fileBuffer.length, 'user-123')
      );

      const startTime = performance.now();
      await Promise.all(uploadPromises);
      const endTime = performance.now();
      const finalMemory = process.memoryUsage().heapUsed;

      // Assert
      const memoryIncrease = finalMemory - initialMemory;
      const totalTime = endTime - startTime;
      const averageTime = totalTime / concurrentUploads;

      expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // <200MB total
      expect(averageTime).toBeLessThan(5000); // <5 seconds per upload
    });
  });

  describe('Processing Speed Tests', () => {
    it('should process CSV data at >10MB/s', async () => {
      // Arrange
      const testSize = 50 * 1024 * 1024; // 50MB
      const csvBuffer = generateLargeCSVBuffer(Math.floor(testSize / 50)); // ~50 bytes per row

      // Act
      const startTime = performance.now();
      await uploadService.uploadFile(csvBuffer, 'speed-test.csv', csvBuffer.length, 'user-123');
      const endTime = performance.now();

      // Assert
      const processingTime = (endTime - startTime) / 1000; // Convert to seconds
      const speedMBps = testSize / (1024 * 1024) / processingTime;

      expect(speedMBps).toBeGreaterThan(10); // >10MB/s
    });

    it('should maintain performance under load', async () => {
      // Arrange
      const loadTestDuration = 60000; // 1 minute
      const uploadInterval = 1000; // 1 upload per second
      const fileBuffer = generateLargeCSVBuffer(1000);

      const results: number[] = [];
      const startTime = performance.now();

      // Act
      while (performance.now() - startTime < loadTestDuration) {
        const uploadStart = performance.now();
        await uploadService.uploadFile(fileBuffer, 'load-test.csv', fileBuffer.length, 'user-123');
        const uploadTime = performance.now() - uploadStart;
        results.push(uploadTime);

        await new Promise(resolve => setTimeout(resolve, uploadInterval));
      }

      // Assert
      const averageTime = results.reduce((a, b) => a + b, 0) / results.length;
      const maxTime = Math.max(...results);

      expect(averageTime).toBeLessThan(2000); // <2 seconds average
      expect(maxTime).toBeLessThan(5000); // <5 seconds max
    });
  });
});
```

### 4.2 Load Testing with Artillery
```yaml
# tests/performance/artillery-upload-config.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 5
      name: "Warm up"
    - duration: 120
      arrivalRate: 10
      name: "Load test"
    - duration: 60
      arrivalRate: 20
      name: "Stress test"
  payload:
    path: "./tests/fixtures/csv-files.csv"
    fields:
      - "filename"
      - "filepath"
  processor: "./tests/performance/upload-processor.js"

scenarios:
  - name: "Upload CSV File"
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
            file: "@{{ filepath }}"
          capture:
            - json: "$.data.id"
              as: "jobId"

      - get:
          url: "/api/upload/{{ jobId }}/status"
          headers:
            Authorization: "Bearer {{ authToken }}"

  - name: "Check Upload Status"
    weight: 30
    flow:
      - get:
          url: "/api/upload/history"
          headers:
            Authorization: "Bearer {{ authToken }}"
```

---

## 📋 Phase 5: Security Testing Implementation (Week 4-5)

### 5.1 Authentication Security Tests
```typescript
// tests/security/auth-security.test.ts
import request from 'supertest';
import { app } from '@api/app';

describe('Authentication Security Tests', () => {
  describe('Input Validation', () => {
    it('should prevent SQL injection in login', async () => {
      const maliciousInput = "'; DROP TABLE users; --";
      
      await request(app)
        .post('/api/auth/login')
        .send({
          email: maliciousInput,
          password: 'password'
        })
        .expect(401);
    });

    it('should prevent XSS in authentication responses', async () => {
      const xssPayload = '<script>alert("xss")</script>';
      
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: xssPayload,
          password: 'password'
        })
        .expect(401);

      expect(response.body.error).not.toContain('<script>');
    });

    it('should enforce rate limiting on login attempts', async () => {
      const credentials = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      // Make multiple failed attempts
      for (let i = 0; i < 10; i++) {
        await request(app)
          .post('/api/auth/login')
          .send(credentials)
          .expect(401);
      }

      // Should be rate limited
      await request(app)
        .post('/api/auth/login')
        .send(credentials)
        .expect(429);
    });
  });

  describe('Token Security', () => {
    it('should reject malformed JWT tokens', async () => {
      const malformedTokens = [
        'invalid.token',
        'invalid.token.format',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.invalid.signature',
        ''
      ];

      for (const token of malformedTokens) {
        await request(app)
          .get('/api/auth/profile')
          .set('Authorization', `Bearer ${token}`)
          .expect(401);
      }
    });

    it('should reject tokens with invalid algorithm', async () => {
      // Create a token with 'none' algorithm
      const maliciousToken = Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64') + 
                           '.' + 
                           Buffer.from('{"userId":"admin"}').toString('base64') + 
                           '.';

      await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${maliciousToken}`)
        .expect(401);
    });

    it('should have reasonable token expiration', async () => {
      // This test would need to check token configuration
      // Token should expire within a reasonable time (e.g., 24 hours)
      const token = generateAuthToken('user-123');
      const decoded = jwt.decode(token) as any;
      
      const expirationTime = decoded.exp;
      const currentTime = Math.floor(Date.now() / 1000);
      const maxAllowedExpiration = 24 * 60 * 60; // 24 hours
      
      expect(expirationTime - currentTime).toBeLessThanOrEqual(maxAllowedExpiration);
    });
  });

  describe('API Key Security', () => {
    it('should encrypt API keys at rest', async () => {
      // This test would verify that API keys are encrypted in the database
      const apiKeyConfig = await createApiKeyConfig('user-123');
      
      // Check database directly to ensure key is encrypted
      const storedConfig = await getApiKeyConfigFromDB(apiKeyConfig.id);
      expect(storedConfig.encrypted_credential).toBeDefined();
      expect(storedConfig.encrypted_credential).not.toContain('test-api-key');
    });

    it('should prevent API key enumeration', async () => {
      const authToken = generateAuthToken('user-123');
      
      // Try to enumerate API key IDs
      for (let i = 1; i <= 10; i++) {
        await request(app)
          .get(`/api/auth/api-keys/config-${i}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(404);
      }
    });

    it('should audit all API key operations', async () => {
      const user = await createTestUser();
      const authToken = generateAuthToken(user.id);
      
      // Create API key
      await request(app)
        .post('/api/auth/api-keys')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: 'Test Key',
          key: 'test-key-123',
          location: 'header'
        });

      // Check audit log
      const auditLogs = await getAuditLogsForUser(user.id);
      const apiKeyCreationLog = auditLogs.find(log => log.event === 'api_key_created');
      
      expect(apiKeyCreationLog).toBeDefined();
      expect(apiKeyCreationLog.metadata.configId).toBeDefined();
      expect(apiKeyCreationLog.ipAddress).toBeDefined();
    });
  });

  describe('File Upload Security', () => {
    it('should prevent malicious file uploads', async () => {
      const authToken = generateAuthToken('user-123');
      
      // Try to upload executable file
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('malicious content'), 'malicious.exe')
        .expect(400);

      // Try to upload script file
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('<script>alert("xss")</script>'), 'xss.html')
        .expect(400);
    });

    it('should validate file content type', async () => {
      const authToken = generateAuthToken('user-123');
      
      // Upload file with wrong MIME type
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('fake csv content'), 'fake.csv')
        .set('Content-Type', 'application/octet-stream')
        .expect(400);
    });

    it('should scan uploaded files for malware', async () => {
      // This test would integrate with virus scanning
      const authToken = generateAuthToken('user-123');
      const maliciousBuffer = Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE');
      
      await request(app)
        .post('/api/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', maliciousBuffer, 'eicar.csv')
        .expect(400);
    });
  });
});
```

---

## 📋 Phase 6: Test Infrastructure and CI/CD (Week 5)

### 6.1 Test Configuration Updates
```javascript
// jest.config.js (Updated)
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src', '<rootDir>/api', '<rootDir>/worker'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'api/**/*.{ts,tsx}',
    'worker/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 90,
      lines: 90,
      statements: 90
    },
    './api/services/': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95
    },
    './src/components/': {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@worker/(.*)$': '<rootDir>/worker/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  testTimeout: 30000,
  verbose: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/unit/setup.ts']
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/integration/setup.ts',
      globalTeardown: '<rootDir>/tests/integration/teardown.ts',
      setupFilesAfterEnv: ['<rootDir>/tests/integration/setup.ts']
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/e2e/setup.ts',
      globalTeardown: '<rootDir>/tests/e2e/teardown.ts'
    },
    {
      displayName: 'performance',
      testMatch: ['<rootDir>/tests/performance/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/performance/setup.ts']
    },
    {
      displayName: 'security',
      testMatch: ['<rootDir>/tests/security/**/*.test.ts'],
      testEnvironment: 'node',
      setupFilesAfterEnv: ['<rootDir>/tests/security/setup.ts']
    }
  ]
};
```

### 6.2 CI/CD Pipeline Configuration
```yaml
# .github/workflows/test.yml
name: Test Suite

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18.x, 20.x]
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js ${{ matrix.node-version }}
      uses: actions/setup-node@v3
      with:
        node-version: ${{ matrix.node-version }}
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run unit tests
      run: npm run test:unit -- --coverage
    
    - name: Upload coverage to Codecov
      uses: codecov/codecov-action@v3
      with:
        file: ./coverage/lcov.info

  integration-tests:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 5432:5432
      
      redis:
        image: redis:7
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        ports:
          - 6379:6379

    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Setup test database
      run: npm run test:db:setup
    
    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test_db
        REDIS_URL: redis://localhost:6379

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Playwright
      run: npx playwright install --with-deps
    
    - name: Build application
      run: npm run build
    
    - name: Start application
      run: npm run start:test &
    
    - name: Wait for application
      run: npx wait-on http://localhost:3000
    
    - name: Run E2E tests
      run: npm run test:e2e
    
    - name: Upload test results
      uses: actions/upload-artifact@v3
      if: failure()
      with:
        name: playwright-report
        path: playwright-report/

  performance-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Install Artillery
      run: npm install -g artillery
    
    - name: Start application
      run: npm run start:test &
    
    - name: Wait for application
      run: npx wait-on http://localhost:3000
    
    - name: Run performance tests
      run: npm run test:performance
    
    - name: Upload performance results
      uses: actions/upload-artifact@v3
      with:
        name: performance-results
        path: artillery-report/

  security-tests:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Use Node.js 18.x
      uses: actions/setup-node@v3
      with:
        node-version: 18.x
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run security tests
      run: npm run test:security
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run CodeQL Analysis
      uses: github/codeql-action/analyze@v2
      with:
        languages: javascript

  quality-gate:
    needs: [unit-tests, integration-tests, e2e-tests, performance-tests, security-tests]
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Download coverage reports
      uses: actions/download-artifact@v3
      with:
        name: coverage-reports
    
    - name: Check coverage thresholds
      run: |
        COVERAGE=$(cat coverage-summary.json | jq '.total.lines.pct')
        if (( $(echo "$COVERAGE < 90" | bc -l) )); then
          echo "Coverage $COVERAGE% is below 90% threshold"
          exit 1
        fi
    
    - name: Check performance benchmarks
      run: |
        # Check if performance tests meet benchmarks
        node scripts/check-performance-benchmarks.js
    
    - name: Quality gate passed
      run: echo "All quality gates passed! ✅"
```

---

## 📊 Test Coverage Requirements and Quality Gates

### Coverage Targets
```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 90,
      "lines": 90,
      "statements": 90
    },
    "api/services/": {
      "branches": 90,
      "functions": 95,
      "lines": 95,
      "statements": 95
    },
    "src/components/": {
      "branches": 85,
      "functions": 90,
      "lines": 90,
      "statements": 90
    },
    "src/hooks/": {
      "branches": 90,
      "functions": 95,
      "lines": 95,
      "statements": 95
    }
  }
}
```

### Quality Gate Criteria
1. **Test Coverage**: ≥90% overall, ≥95% for critical services
2. **Unit Tests**: All business logic covered
3. **Integration Tests**: All API endpoints covered
4. **E2E Tests**: All critical user journeys covered
5. **Performance Tests**: All benchmarks met
6. **Security Tests**: All security controls validated

### Test Execution Requirements
- **Unit Tests**: < 5 minutes total execution time
- **Integration Tests**: < 10 minutes total execution time
- **E2E Tests**: < 15 minutes total execution time
- **Performance Tests**: < 5 minutes total execution time
- **Security Tests**: < 10 minutes total execution time

---

## 📋 Mock and Fixture Management

### Test Data Factory
```typescript
// tests/factories/user-factory.ts
import { User } from '@api/types/user';
import { faker } from '@faker-js/faker';

export class UserFactory {
  static create(overrides: Partial<User> = {}): User {
    return {
      id: faker.datatype.uuid(),
      email: faker.internet.email(),
      password: faker.internet.password(),
      firstName: faker.name.firstName(),
      lastName: faker.name.lastName(),
      isActive: true,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }

  static createMany(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }
}

// tests/factories/upload-factory.ts
export class UploadFactory {
  static create(overrides: Partial<ProcessingJob> = {}): ProcessingJob {
    return {
      id: faker.datatype.uuid(),
      userId: faker.datatype.uuid(),
      fileName: `${faker.system.fileName()}.csv`,
      fileSize: faker.datatype.number({ min: 1024, max: 1024 * 1024 * 1024 }),
      status: faker.helpers.arrayElement(['pending', 'processing', 'completed', 'failed']),
      progress: faker.datatype.number({ min: 0, max: 100 }),
      recordsProcessed: faker.datatype.number({ min: 0, max: 10000 }),
      totalRecords: faker.datatype.number({ min: 1000, max: 10000 }),
      csvHeaders: ['name', 'email', 'age'],
      errorMessage: null,
      processingTime: null,
      estimatedTimeRemaining: null,
      createdAt: faker.date.past(),
      updatedAt: faker.date.recent(),
      ...overrides
    };
  }
}
```

### Mock Services
```typescript
// tests/mocks/api-service.mock.ts
import { ApiClient } from '@/services/api';

export class MockApiClient {
  private responses = new Map<string, any>();
  private delays = new Map<string, number>();

  setResponse(endpoint: string, response: any, delay = 0): void {
    this.responses.set(endpoint, response);
    if (delay > 0) {
      this.delays.set(endpoint, delay);
    }
  }

  async post(endpoint: string, data?: any): Promise<any> {
    const delay = this.delays.get(endpoint) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response configured for ${endpoint}`);
    }

    return response;
  }

  async get(endpoint: string): Promise<any> {
    const delay = this.delays.get(endpoint) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    const response = this.responses.get(endpoint);
    if (!response) {
      throw new Error(`No mock response configured for ${endpoint}`);
    }

    return response;
  }
}

// Usage in tests
const mockApi = new MockApiClient();
mockApi.setResponse('/api/upload', { success: true, data: { id: 'job-123' } }, 1000);
```

---

## ✅ Acceptance Criteria

### Testing Requirements
- [ ] Unit test coverage ≥90% overall, ≥95% for critical services
- [ ] All API endpoints covered by integration tests
- [ ] All critical user journeys covered by E2E tests
- [ ] Performance benchmarks met and validated
- [ ] Security controls tested and verified
- [ ] Test execution time within acceptable limits

### Quality Requirements
- [ ] All tests pass consistently in CI/CD pipeline
- [ ] No flaky tests (tests that pass/fail intermittently)
- [ ] Proper test data management and cleanup
- [ ] Comprehensive error scenario coverage
- [ ] Mock and fixture management implemented

### Infrastructure Requirements
- [ ] CI/CD pipeline configured for all test types
- [ ] Test environments properly isolated
- [ ] Test data automatically created and cleaned up
- [ ] Coverage reports generated and published
- [ ] Performance benchmarks tracked over time

---

## 📋 Implementation Timeline

### Week 1-2: Unit Testing
- Day 1-3: Upload service unit tests
- Day 4-5: Authentication service unit tests
- Day 6-7: React component unit tests
- Day 8-10: Utility and hook unit tests

### Week 2-3: Integration Testing
- Day 1-3: API endpoint integration tests
- Day 4-5: Database operation tests
- Day 6-7: Cross-service workflow tests

### Week 3-4: E2E Testing
- Day 1-3: Upload workflow E2E tests
- Day 4-5: Authentication workflow E2E tests
- Day 6-7: Integration workflow E2E tests

### Week 4: Performance and Security Testing
- Day 1-2: Performance benchmark tests
- Day 3-4: Security vulnerability tests
- Day 5: Load testing configuration

### Week 5: Infrastructure and CI/CD
- Day 1-2: CI/CD pipeline setup
- Day 3-4: Quality gate configuration
- Day 5: Documentation and training

---

## 🎯 Success Metrics

### Coverage Metrics
- **Overall Coverage**: ≥90%
- **Critical Services Coverage**: ≥95%
- **Branch Coverage**: ≥80%
- **Function Coverage**: ≥90%

### Performance Metrics
- **Test Execution Time**: <45 minutes total
- **Unit Test Time**: <5 minutes
- **Integration Test Time**: <10 minutes
- **E2E Test Time**: <15 minutes

### Quality Metrics
- **Test Pass Rate**: 100%
- **Flaky Test Rate**: 0%
- **Security Test Coverage**: 100%
- **Performance Benchmark Pass Rate**: 100%

---

**This comprehensive testing handoff provides everything needed to achieve 90%+ test coverage for upload and authentication flows. The implementation follows testing best practices and includes proper infrastructure setup for maintaining high-quality code.**