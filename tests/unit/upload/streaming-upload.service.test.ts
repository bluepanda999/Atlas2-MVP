import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { StreamingUploadService } from '../../../src/services/upload/streaming-upload.service';
import { UploadSession } from '../../../src/entities/upload-session.entity';
import { UploadProgress } from '../../../src/interfaces/upload-progress.interface';

describe('StreamingUploadService', () => {
  let service: StreamingUploadService;
  let uploadSessionRepository: Repository<UploadSession>;

  const mockUploadSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    createQueryBuilder: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StreamingUploadService,
        {
          provide: getRepositoryToken(UploadSession),
          useValue: mockUploadSessionRepository,
        },
      ],
    }).compile();

    service = module.get<StreamingUploadService>(StreamingUploadService);
    uploadSessionRepository = module.get<Repository<UploadSession>>(getRepositoryToken(UploadSession));

    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock file system operations
    jest.mock('fs', () => ({
      existsSync: jest.fn(() => true),
      mkdirSync: jest.fn(),
      createWriteStream: jest.fn(() => ({
        write: jest.fn(),
        end: jest.fn(),
        on: jest.fn(),
      })),
    }));
  });

  describe('initializeUpload', () => {
    it('should initialize upload session successfully', async () => {
      // Arrange
      const fileName = 'test-file.csv';
      const fileSize = 1024 * 1024; // 1MB
      const mimeType = 'text/csv';
      const userId = 'test-user';

      const expectedSession = {
        id: 'upload-id',
        fileName,
        originalName: fileName,
        fileSize,
        mimeType,
        filePath: './uploads/upload-id_test-file.csv',
        userId,
        status: 'initialized',
        uploadedBytes: 0,
        createdAt: new Date(),
      };

      mockUploadSessionRepository.create.mockReturnValue(expectedSession);
      mockUploadSessionRepository.save.mockResolvedValue(expectedSession);

      // Act
      const result = await service.initializeUpload(fileName, fileSize, mimeType, userId);

      // Assert
      expect(uploadSessionRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          fileName,
          originalName: fileName,
          fileSize,
          mimeType,
          userId,
          status: 'initialized',
          uploadedBytes: 0,
        })
      );
      expect(uploadSessionRepository.save).toHaveBeenCalledWith(expectedSession);
      expect(result).toEqual(expectedSession);
    });

    it('should reject files larger than maximum size', async () => {
      // Arrange
      const fileName = 'large-file.bin';
      const fileSize = 4 * 1024 * 1024 * 1024; // 4GB (exceeds 3GB limit)
      const mimeType = 'application/octet-stream';

      // Act & Assert
      await expect(service.initializeUpload(fileName, fileSize, mimeType)).rejects.toThrow(
        /exceeds maximum allowed size/
      );
    });
  });

  describe('processChunk', () => {
    it('should process chunk successfully', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const chunk = Buffer.from('test chunk data');
      const chunkIndex = 0;
      const isLastChunk = false;

      const mockSession = {
        id: uploadId,
        fileName: 'test-file.csv',
        fileSize: 1024,
        filePath: './uploads/upload-id_test-file.csv',
        status: 'uploading',
        uploadedBytes: 512,
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);
      mockUploadSessionRepository.update.mockResolvedValue(undefined);

      // Mock file append operation
      const mockAppendChunkToFile = jest.spyOn(service as any, 'appendChunkToFile');
      mockAppendChunkToFile.mockResolvedValue(undefined);

      // Act
      const result = await service.processChunk(uploadId, chunk, chunkIndex, isLastChunk);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          uploadId,
          fileName: mockSession.fileName,
          uploadedBytes: mockSession.uploadedBytes + chunk.length,
          totalBytes: mockSession.fileSize,
          status: 'uploading',
          chunkIndex,
          isLastChunk,
        })
      );
      expect(uploadSessionRepository.update).toHaveBeenCalledWith(
        uploadId,
        expect.objectContaining({
          uploadedBytes: mockSession.uploadedBytes + chunk.length,
          status: 'uploading',
        })
      );
    });

    it('should mark upload as completed on last chunk', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const chunk = Buffer.from('last chunk');
      const chunkIndex = 1;
      const isLastChunk = true;

      const mockSession = {
        id: uploadId,
        fileName: 'test-file.csv',
        fileSize: 1024,
        filePath: './uploads/upload-id_test-file.csv',
        status: 'uploading',
        uploadedBytes: 512,
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);
      mockUploadSessionRepository.update.mockResolvedValue(undefined);

      const mockAppendChunkToFile = jest.spyOn(service as any, 'appendChunkToFile');
      mockAppendChunkToFile.mockResolvedValue(undefined);

      // Act
      const result = await service.processChunk(uploadId, chunk, chunkIndex, isLastChunk);

      // Assert
      expect(result.status).toBe('completed');
      expect(uploadSessionRepository.update).toHaveBeenCalledWith(
        uploadId,
        expect.objectContaining({
          status: 'completed',
          completedAt: expect.any(Date),
        })
      );
    });

    it('should handle non-existent upload session', async () => {
      // Arrange
      const uploadId = 'non-existent-id';
      const chunk = Buffer.from('test data');
      const chunkIndex = 0;

      mockUploadSessionRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.processChunk(uploadId, chunk, chunkIndex)).rejects.toThrow(
        'Upload session not found'
      );
    });

    it('should handle already completed upload', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const chunk = Buffer.from('test data');
      const chunkIndex = 0;

      const mockSession = {
        id: uploadId,
        status: 'completed',
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);

      // Act & Assert
      await expect(service.processChunk(uploadId, chunk, chunkIndex)).rejects.toThrow(
        'Upload already completed'
      );
    });
  });

  describe('getUploadProgress', () => {
    it('should return upload progress correctly', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const mockSession = {
        id: uploadId,
        fileName: 'test-file.csv',
        fileSize: 1024,
        uploadedBytes: 512,
        status: 'uploading',
        createdAt: new Date(),
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);

      // Act
      const result = await service.getUploadProgress(uploadId);

      // Assert
      expect(result).toEqual(
        expect.objectContaining({
          uploadId,
          fileName: mockSession.fileName,
          uploadedBytes: mockSession.uploadedBytes,
          totalBytes: mockSession.fileSize,
          progress: 50, // 512/1024 * 100
          status: mockSession.status,
        })
      );
    });

    it('should handle zero file size', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const mockSession = {
        id: uploadId,
        fileName: 'test-file.csv',
        fileSize: 0,
        uploadedBytes: 0,
        status: 'initialized',
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);

      // Act
      const result = await service.getUploadProgress(uploadId);

      // Assert
      expect(result.progress).toBe(0);
    });
  });

  describe('pauseUpload', () => {
    it('should pause upload successfully', async () => {
      // Arrange
      const uploadId = 'upload-id';
      mockUploadSessionRepository.update.mockResolvedValue(undefined);

      // Act
      await service.pauseUpload(uploadId);

      // Assert
      expect(uploadSessionRepository.update).toHaveBeenCalledWith(
        uploadId,
        expect.objectContaining({
          status: 'paused',
        })
      );
    });
  });

  describe('resumeUpload', () => {
    it('should resume upload successfully', async () => {
      // Arrange
      const uploadId = 'upload-id';
      mockUploadSessionRepository.update.mockResolvedValue(undefined);

      // Act
      await service.resumeUpload(uploadId);

      // Assert
      expect(uploadSessionRepository.update).toHaveBeenCalledWith(
        uploadId,
        expect.objectContaining({
          status: 'uploading',
        })
      );
    });
  });

  describe('cancelUpload', () => {
    it('should cancel upload and delete file', async () => {
      // Arrange
      const uploadId = 'upload-id';
      const mockSession = {
        id: uploadId,
        filePath: './uploads/upload-id_test-file.csv',
      };

      mockUploadSessionRepository.findOne.mockResolvedValue(mockSession);
      mockUploadSessionRepository.update.mockResolvedValue(undefined);

      // Mock file system operations
      const fs = require('fs').promises;
      jest.spyOn(fs, 'unlink').mockResolvedValue(undefined);

      // Act
      await service.cancelUpload(uploadId);

      // Assert
      expect(fs.unlink).toHaveBeenCalledWith(mockSession.filePath);
      expect(uploadSessionRepository.update).toHaveBeenCalledWith(
        uploadId,
        expect.objectContaining({
          status: 'cancelled',
          completedAt: expect.any(Date),
        })
      );
    });
  });

  describe('listUploads', () => {
    it('should list uploads with pagination', async () => {
      // Arrange
      const userId = 'test-user';
      const limit = 10;
      const offset = 0;
      const mockUploads = [
        { id: 'upload-1', fileName: 'file1.csv' },
        { id: 'upload-2', fileName: 'file2.csv' },
      ];

      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(mockUploads),
      };

      mockUploadSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.listUploads(userId, limit, offset);

      // Assert
      expect(uploadSessionRepository.createQueryBuilder).toHaveBeenCalledWith('upload_session');
      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('upload_session.createdAt', 'DESC');
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(limit);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(offset);
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('upload_session.userId = :userId', { userId });
      expect(result).toEqual(mockUploads);
    });

    it('should list all uploads when userId not provided', async () => {
      // Arrange
      const mockQueryBuilder = {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        offset: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };

      mockUploadSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      await service.listUploads();

      // Assert
      expect(mockQueryBuilder.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('getUploadStats', () => {
    it('should return upload statistics', async () => {
      // Arrange
      const userId = 'test-user';
      const mockStats = [
        { status: 'completed', count: '5', totalBytes: '5242880' },
        { status: 'uploading', count: '2', totalBytes: '1048576' },
      ];

      const mockQueryBuilder = {
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        groupBy: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawMany: jest.fn().mockResolvedValue(mockStats),
      };

      mockUploadSessionRepository.createQueryBuilder.mockReturnValue(mockQueryBuilder);

      // Act
      const result = await service.getUploadStats(userId);

      // Assert
      expect(result).toEqual({
        totalUploads: 7,
        totalBytes: 6291456,
        statusBreakdown: [
          { status: 'completed', count: 5, bytes: 5242880 },
          { status: 'uploading', count: 2, bytes: 1048576 },
        ],
      });
    });
  });
});