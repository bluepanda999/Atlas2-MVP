import { config } from 'dotenv';
import { Logger } from '@nestjs/common';

// Load test environment variables
config({ path: '.env.test' });

// Set test environment
process.env.NODE_ENV = 'test';

// Global test setup
beforeAll(async () => {
  const logger = new Logger('TestSetup');
  logger.log('Setting up test environment...');
  
  // Set default test values
  process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/atlas2_test';
  process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
  process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret';
  process.env.ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'test-encryption-key-32-chars-long';
  process.env.UPLOAD_DIR = process.env.UPLOAD_DIR || './test-uploads';
  process.env.MAX_FILE_SIZE = process.env.MAX_FILE_SIZE || '3221225472'; // 3GB
  process.env.CHUNK_SIZE = process.env.CHUNK_SIZE || '65536'; // 64KB
});

afterAll(async () => {
  const logger = new Logger('TestSetup');
  logger.log('Cleaning up test environment...');
  
  // Cleanup test files
  const fs = require('fs').promises;
  const path = require('path');
  
  try {
    const testUploadDir = process.env.UPLOAD_DIR || './test-uploads';
    await fs.rmdir(testUploadDir, { recursive: true });
  } catch (error) {
    // Ignore cleanup errors
  }
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});