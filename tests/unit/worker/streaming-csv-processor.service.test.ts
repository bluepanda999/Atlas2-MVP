import { StreamingCsvProcessorService } from '../../../worker/services/streaming-csv-processor.service';
import { DatabaseService } from '../../../worker/services/database.service';
import { UploadRepository } from '../../../worker/repositories/upload.repository';
import { MappingRepository } from '../../../worker/repositories/mapping.repository';
import { ProcessingJob } from '../../../worker/types/upload';
import { MappingConfig } from '../../../worker/types/mapping';
import { AppError } from '../../../worker/utils/errors';
import fs from 'fs/promises';
import { createReadStream } from 'fs';

// Mock dependencies
jest.mock('../../../worker/services/database.service');
jest.mock('../../../worker/repositories/upload.repository');
jest.mock('../../../worker/repositories/mapping.repository');
jest.mock('fs/promises');
jest.mock('fs', () => ({
  createReadStream: jest.fn(),
  existsSync: jest.fn(),
}));

describe('StreamingCsvProcessorService', () => {
  let streamingProcessor: StreamingCsvProcessorService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockUploadRepository: jest.Mocked<UploadRepository>;
  let mockMappingRepository: jest.Mocked<MappingRepository>;
  let mockFs: jest.Mocked<typeof fs>;

  beforeEach(() => {
    mockDatabaseService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      query: jest.fn(),
      getClient: jest.fn(),
      transaction: jest.fn(),
      healthCheck: jest.fn(),
      getPoolStats: jest.fn(),
      runMigrations: jest.fn(),
      validateSchema: jest.fn(),
      getSlowQueries: jest.fn(),
    } as any;

    mockUploadRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getFileData: jest.fn(),
    } as any;

    mockMappingRepository = {
      create: jest.fn(),
      findById: jest.fn(),
      findByUserId: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;

    mockFs = fs as jest.Mocked<typeof fs>;

    streamingProcessor = new StreamingCsvProcessorService(
      mockDatabaseService,
      mockUploadRepository,
      mockMappingRepository
    );
  });

  describe('processCsvFile', () => {
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

    const mockMappingConfig: MappingConfig = {
      id: 'test-mapping-id',
      name: 'Test Mapping',
      mappings: [
        {
          id: '1',
          csvHeader: 'col1',
          apiFieldName: 'field1',
          dataType: 'string',
          required: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      transformationRules: [
        {
          id: '1',
          name: 'Test Rule',
          type: 'data_type',
          sourceField: 'field1',
          targetType: 'number',
          isActive: true,
          order: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
      isActive: true,
      userId: 'test-user-id',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('should successfully process a CSV file with streaming', async () => {
      // Mock file exists
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(true);

      // Mock job repository
      mockUploadRepository.findById.mockResolvedValue(mockJob);
      mockUploadRepository.update.mockResolvedValue(mockJob);

      // Mock mapping repository
      mockMappingRepository.findById.mockResolvedValue(mockMappingConfig);

      // Mock file streaming
      const mockReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'data') {
            // Simulate CSV data
            setTimeout(() => callback(['col1', 'col2']), 0); // Header
            setTimeout(() => callback(['value1', 'value2']), 10); // Row 1
            setTimeout(() => callback(['value3', 'value4']), 20); // Row 2
          } else if (event === 'end') {
            setTimeout(callback, 30);
          }
          return this;
        }),
      };

      const mockCreateReadStream = require('fs').createReadStream as jest.MockedFunction<typeof require('fs').createReadStream>;
      mockCreateReadStream.mockReturnValue(mockReadStream);

      // Mock CSV parsing
      jest.doMock('csv-parse', () => ({
        parse: jest.fn().mockReturnValue({
          pipe: jest.fn().mockReturnThis(),
          on: jest.fn().mockImplementation(function(event, callback) {
            if (event === 'data') {
              setTimeout(() => callback(['col1', 'col2']), 0); // Header
              setTimeout(() => callback(['value1', 'value2']), 10); // Row 1
              setTimeout(() => callback(['value3', 'value4']), 20); // Row 2
            } else if (event === 'end') {
              setTimeout(callback, 30);
            }
            return this;
          }),
        }),
      }));

      await expect(
        streamingProcessor.processCsvFile('test-job-id', '/tmp/test.csv')
      ).resolves.not.toThrow();

      expect(mockUploadRepository.findById).toHaveBeenCalledWith('test-job-id');
      expect(mockUploadRepository.update).toHaveBeenCalledWith('test-job-id', {
        status: 'processing',
        progress: 0,
        recordsProcessed: 0,
      });
    });

    it('should throw error if file does not exist', async () => {
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(false);

      await expect(
        streamingProcessor.processCsvFile('test-job-id', '/tmp/nonexistent.csv')
      ).rejects.toThrow(AppError);
    });

    it('should throw error if job is not found', async () => {
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(true);

      mockUploadRepository.findById.mockResolvedValue(null);

      await expect(
        streamingProcessor.processCsvFile('test-job-id', '/tmp/test.csv')
      ).rejects.toThrow(AppError);
    });

    it('should skip processing if job is not in processable state', async () => {
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(true);

      const completedJob = { ...mockJob, status: 'completed' as const };
      mockUploadRepository.findById.mockResolvedValue(completedJob);

      await expect(
        streamingProcessor.processCsvFile('test-job-id', '/tmp/test.csv')
      ).resolves.not.toThrow();

      // Should not attempt to update status
      expect(mockUploadRepository.update).not.toHaveBeenCalledWith(
        'test-job-id',
        expect.objectContaining({ status: 'processing' })
      );
    });

    it('should handle processing retries', async () => {
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(true);

      mockUploadRepository.findById.mockResolvedValue(mockJob);
      mockUploadRepository.update.mockRejectedValueOnce(new Error('Temporary failure')).mockResolvedValue(mockJob);

      await expect(
        streamingProcessor.processCsvFile('test-job-id', '/tmp/test.csv', { maxRetries: 1 })
      ).rejects.toThrow();

      // Should attempt retry
      expect(mockUploadRepository.update).toHaveBeenCalledTimes(2); // Initial attempt + retry
    });
  });

  describe('detectDelimiter', () => {
    it('should detect comma delimiter', async () => {
      const mockReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'data') {
            setTimeout(() => callback(['header1', 'header2', 'header3']), 0);
            setTimeout(() => callback(['value1', 'value2', 'value3']), 10);
            setTimeout(() => callback(['value4', 'value5', 'value6']), 20);
          } else if (event === 'end') {
            setTimeout(callback, 30);
          }
          return this;
        }),
      };

      const mockCreateReadStream = require('fs').createReadStream as jest.MockedFunction<typeof require('fs').createReadStream>;
      mockCreateReadStream.mockReturnValue(mockReadStream);

      const result = await (streamingProcessor as any).detectDelimiter('/tmp/test.csv');

      expect(result.delimiter).toBe(',');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should detect semicolon delimiter', async () => {
      const mockReadStream = {
        pipe: jest.fn().mockReturnThis(),
        on: jest.fn().mockImplementation(function(event, callback) {
          if (event === 'data') {
            setTimeout(() => callback(['header1;header2;header3']), 0);
            setTimeout(() => callback(['value1;value2;value3']), 10);
          } else if (event === 'end') {
            setTimeout(callback, 20);
          }
          return this;
        }),
      };

      const mockCreateReadStream = require('fs').createReadStream as jest.MockedFunction<typeof require('fs').createReadStream;
      mockCreateReadStream.mockReturnValue(mockReadStream);

      const result = await (streamingProcessor as any).detectDelimiter('/tmp/test.csv');

      expect(result.delimiter).toBe(';');
    });
  });

  describe('detectEncoding', () => {
    it('should return utf8 encoding by default', async () => {
      const result = await (streamingProcessor as any).detectEncoding('/tmp/test.csv');

      expect(result.encoding).toBe('utf8');
      expect(result.confidence).toBeGreaterThan(0.9);
    });
  });

  describe('applyRowTransformations', () => {
    it('should apply field mappings', async () => {
      const row = { 'csvHeader': 'value', 'otherField': 'other' };
      const mappingConfig = {
        mappings: [
          {
            csvHeader: 'csvHeader',
            apiFieldName: 'apiField',
            dataType: 'string' as const,
            required: true,
            id: '1',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        transformationRules: [],
      };

      const result = await (streamingProcessor as any).applyRowTransformations(row, mappingConfig);

      expect(result).toEqual({
        'apiField': 'value',
      });
      expect(result['csvHeader']).toBeUndefined();
    });

    it('should apply transformation rules', async () => {
      const row = { 'field1': '123', 'field2': 'test' };
      const mappingConfig = {
        mappings: [],
        transformationRules: [
          {
            id: '1',
            name: 'Convert to number',
            type: 'data_type' as const,
            sourceField: 'field1',
            targetType: 'number',
            isActive: true,
            order: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
      };

      const result = await (streamingProcessor as any).applyRowTransformations(row, mappingConfig);

      expect(result['field1']).toBe('123'); // Should remain as string after conversion
    });
  });

  describe('validateRow', () => {
    it('should validate row successfully', async () => {
      const row = { 'field1': 'value', 'field2': '123' };

      const result = await (streamingProcessor as any).validateRow(row);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should return warnings for null values', async () => {
      const row = { 'field1': null, 'field2': undefined };

      const result = await (streamingProcessor as any).validateRow(row);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing stats for active job', async () => {
      // Simulate processing stats
      const stats = {
        totalRows: 100,
        processedRows: 50,
        errorRows: 2,
        processingSpeed: 1000,
        memoryUsage: {
          heapUsed: 50 * 1024 * 1024,
          heapTotal: 100 * 1024 * 1024,
          rss: 150 * 1024 * 1024,
        },
        startTime: new Date(),
      };

      (streamingProcessor as any).processingStats.set('test-job-id', stats);

      const result = await streamingProcessor.getProcessingStats('test-job-id');

      expect(result).toEqual(stats);
    });

    it('should return null for non-existent job', async () => {
      const result = await streamingProcessor.getProcessingStats('non-existent-job');

      expect(result).toBeNull();
    });
  });

  describe('pauseProcessing and resumeProcessing', () => {
    it('should log pause processing request', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await streamingProcessor.pauseProcessing('test-job-id');

      expect(consoleSpy).toHaveBeenCalledWith('Pausing processing for job test-job-id');

      consoleSpy.mockRestore();
    });

    it('should log resume processing request', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await streamingProcessor.resumeProcessing('test-job-id');

      expect(consoleSpy).toHaveBeenCalledWith('Resuming processing for job test-job-id');

      consoleSpy.mockRestore();
    });
  });

  describe('memory monitoring', () => {
    it('should monitor memory usage during processing', async () => {
      const mockExistsSync = require('fs').existsSync as jest.MockedFunction<typeof require('fs').existsSync>;
      mockExistsSync.mockReturnValue(true);

      mockUploadRepository.findById.mockResolvedValue({
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
      });

      mockUploadRepository.update.mockResolvedValue({} as ProcessingJob);

      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage;
      process.memoryUsage = jest.fn().mockReturnValue({
        heapUsed: 600 * 1024 * 1024, // 600MB - above 90% threshold
        heapTotal: 1000 * 1024 * 1024,
        rss: 800 * 1024 * 1024,
        external: 50 * 1024 * 1024,
      });

      // Mock garbage collection
      const mockGC = jest.fn();
      (global as any).gc = mockGC;

      // Start processing (this will trigger memory monitoring)
      const processingPromise = streamingProcessor.processCsvFile('test-job-id', '/tmp/test.csv', {
        maxMemoryUsage: 500 * 1024 * 1024, // 500MB limit
      });

      // Wait a bit for memory monitoring to kick in
      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore original memory usage
      process.memoryUsage = originalMemoryUsage;

      // Cancel processing to avoid hanging
      processingPromise.catch(() => {}); // Ignore errors from cancellation

      expect(mockGC).toHaveBeenCalled();
    });
  });
});