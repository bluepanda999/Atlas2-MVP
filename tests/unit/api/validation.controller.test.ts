/**
 * Tests for Validation Controller
 */

import { ValidationController } from '../../../api/controllers/validation.controller';
import { ValidationService } from '../../../api/services/validation.service';
import { Request, Response, NextFunction } from 'express';
import { 
  ValidationRule, 
  ValidationResult, 
  ValidationSession,
  DataPreview 
} from '../../../src/types/validation';

// Mock dependencies
jest.mock('../../../api/services/validation.service');

describe('ValidationController', () => {
  let validationController: ValidationController;
  let mockValidationService: jest.Mocked<ValidationService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: jest.MockedFunction<NextFunction>;

  beforeEach(() => {
    mockValidationService = new ValidationService(null, null) as jest.Mocked<ValidationService>;
    validationController = new ValidationController(mockValidationService);
    
    mockRequest = {
      body: {},
      params: {},
      user: { id: 'user-1', email: 'test@example.com' }
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    
    mockNext = jest.fn();
    
    jest.clearAllMocks();
  });

  describe('createValidationSession', () => {
    it('should create validation session successfully', async () => {
      // Arrange
      const fileId = 'file-1';
      const rules: ValidationRule[] = [
        {
          id: 'rule-1',
          name: 'Required Field',
          description: 'Field must not be empty',
          type: 'required',
          field: 'email',
          config: { allowEmpty: false },
          enabled: true
        }
      ];

      mockRequest.body = { fileId, rules, fullValidation: true };
      
      const mockSession: ValidationSession = {
        id: 'session-1',
        fileId,
        status: 'pending',
        progress: {
          currentRow: 0,
          totalRows: 1000,
          percentage: 0,
          errorsFound: 0,
          warningsFound: 0,
          processingRate: 0,
          estimatedTimeRemaining: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockValidationService.createValidationSession.mockResolvedValue(mockSession);

      // Act
      await validationController.createValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.createValidationSession).toHaveBeenCalledWith(
        fileId,
        rules,
        true,
        undefined
      );
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession,
        message: 'Validation session created successfully'
      });
    });

    it('should handle validation errors', async () => {
      // Arrange
      mockRequest.body = { fileId: '', rules: [] };
      
      const error = new Error('File ID is required');
      mockValidationService.createValidationSession.mockRejectedValue(error);

      // Act
      await validationController.createValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('getValidationSession', () => {
    it('should return validation session successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const mockSession: ValidationSession = {
        id: sessionId,
        fileId: 'file-1',
        status: 'completed',
        progress: {
          currentRow: 100,
          totalRows: 100,
          percentage: 100,
          errorsFound: 5,
          warningsFound: 2,
          processingRate: 150,
          estimatedTimeRemaining: 0
        },
        result: {
          isValid: false,
          errors: [],
          warnings: [],
          summary: {
            totalRows: 100,
            validRows: 95,
            errorRows: 5,
            warningRows: 2,
            errorCount: 5,
            warningCount: 2,
            completionPercentage: 100
          }
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        completedAt: new Date()
      };

      mockValidationService.getValidationSession.mockResolvedValue(mockSession);

      // Act
      await validationController.getValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getValidationSession).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockSession
      });
    });

    it('should return 404 for non-existent session', async () => {
      // Arrange
      const sessionId = 'non-existent';
      mockRequest.params = { sessionId };
      
      mockValidationService.getValidationSession.mockResolvedValue(null);

      // Act
      await validationController.getValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation session not found'
      });
    });
  });

  describe('getValidationProgress', () => {
    it('should return validation progress successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const mockProgress = {
        currentRow: 75,
        totalRows: 100,
        percentage: 75,
        errorsFound: 3,
        warningsFound: 1,
        processingRate: 120,
        estimatedTimeRemaining: 15
      };

      mockValidationService.getValidationProgress.mockResolvedValue(mockProgress);

      // Act
      await validationController.getValidationProgress(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getValidationProgress).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockProgress
      });
    });

    it('should handle progress retrieval errors', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const error = new Error('Session not found');
      mockValidationService.getValidationProgress.mockRejectedValue(error);

      // Act
      await validationController.getValidationProgress(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });

  describe('cancelValidationSession', () => {
    it('should cancel validation session successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      mockValidationService.cancelValidationSession.mockResolvedValue(true);

      // Act
      await validationController.cancelValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.cancelValidationSession).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Validation session cancelled successfully'
      });
    });

    it('should handle cancellation failure', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      mockValidationService.cancelValidationSession.mockResolvedValue(false);

      // Act
      await validationController.cancelValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Failed to cancel validation session'
      });
    });
  });

  describe('getValidationResult', () => {
    it('should return validation result successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const mockResult: ValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        summary: {
          totalRows: 100,
          validRows: 100,
          errorRows: 0,
          warningRows: 0,
          errorCount: 0,
          warningCount: 0,
          completionPercentage: 100
        }
      };

      mockValidationService.getValidationResult.mockResolvedValue(mockResult);

      // Act
      await validationController.getValidationResult(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getValidationResult).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult
      });
    });

    it('should return 404 when no result found', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      mockValidationService.getValidationResult.mockResolvedValue(null);

      // Act
      await validationController.getValidationResult(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation result not found'
      });
    });
  });

  describe('getDataPreview', () => {
    it('should return data preview successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const mockPreview: DataPreview = {
        columns: [
          {
            name: 'email',
            index: 0,
            type: 'string',
            nullable: false,
            unique: true,
            sampleValues: ['test@example.com'],
            nullCount: 0,
            uniqueCount: 100
          }
        ],
        rows: [['test@example.com', 'John Doe', 30]],
        totalRows: 100,
        sampleSize: 10,
        hasHeaders: true,
        delimiter: ',',
        encoding: 'utf-8'
      };

      mockValidationService.getDataPreview.mockResolvedValue(mockPreview);

      // Act
      await validationController.getDataPreview(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getDataPreview).toHaveBeenCalledWith(sessionId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockPreview
      });
    });
  });

  describe('createValidationRule', () => {
    it('should create validation rule successfully', async () => {
      // Arrange
      const rule: ValidationRule = {
        id: 'rule-1',
        name: 'Required Email',
        description: 'Email field is required',
        type: 'required',
        field: 'email',
        config: { allowEmpty: false },
        enabled: true
      };

      mockRequest.body = rule;
      
      const createdRule = { ...rule, id: 'rule-1-created' };
      mockValidationService.createValidationRule.mockResolvedValue(createdRule);

      // Act
      await validationController.createValidationRule(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.createValidationRule).toHaveBeenCalledWith(rule);
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: createdRule,
        message: 'Validation rule created successfully'
      });
    });
  });

  describe('getValidationRules', () => {
    it('should return all validation rules', async () => {
      // Arrange
      const mockRules: ValidationRule[] = [
        {
          id: 'rule-1',
          name: 'Required Email',
          description: 'Email field is required',
          type: 'required',
          field: 'email',
          config: { allowEmpty: false },
          enabled: true
        }
      ];

      mockValidationService.getValidationRules.mockResolvedValue(mockRules);

      // Act
      await validationController.getValidationRules(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getValidationRules).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockRules
      });
    });
  });

  describe('updateValidationRule', () => {
    it('should update validation rule successfully', async () => {
      // Arrange
      const ruleId = 'rule-1';
      const updatedRule: ValidationRule = {
        id: ruleId,
        name: 'Updated Required Email',
        description: 'Updated description',
        type: 'required',
        field: 'email',
        config: { allowEmpty: false },
        enabled: true
      };

      mockRequest.params = { ruleId };
      mockRequest.body = updatedRule;
      
      mockValidationService.updateValidationRule.mockResolvedValue(updatedRule);

      // Act
      await validationController.updateValidationRule(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.updateValidationRule).toHaveBeenCalledWith(ruleId, updatedRule);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: updatedRule,
        message: 'Validation rule updated successfully'
      });
    });
  });

  describe('deleteValidationRule', () => {
    it('should delete validation rule successfully', async () => {
      // Arrange
      const ruleId = 'rule-1';
      mockRequest.params = { ruleId };
      
      mockValidationService.deleteValidationRule.mockResolvedValue(true);

      // Act
      await validationController.deleteValidationRule(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.deleteValidationRule).toHaveBeenCalledWith(ruleId);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        message: 'Validation rule deleted successfully'
      });
    });

    it('should handle rule not found', async () => {
      // Arrange
      const ruleId = 'non-existent';
      mockRequest.params = { ruleId };
      
      mockValidationService.deleteValidationRule.mockResolvedValue(false);

      // Act
      await validationController.deleteValidationRule(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: false,
        error: 'Validation rule not found'
      });
    });
  });

  describe('getValidationStatistics', () => {
    it('should return validation statistics', async () => {
      // Arrange
      const mockStats = {
        totalSessions: 100,
        completedSessions: 85,
        failedSessions: 5,
        averageProcessingTime: 45.5,
        averageRowsPerSecond: 1250,
        mostCommonErrors: [
          { rule: 'Required Email', count: 25, percentage: 25.0 }
        ]
      };

      mockValidationService.getValidationStatistics.mockResolvedValue(mockStats);

      // Act
      await validationController.getValidationStatistics(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockValidationService.getValidationStatistics).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        data: mockStats
      });
    });
  });

  describe('error handling', () => {
    it('should handle service errors consistently', async () => {
      // Arrange
      const sessionId = 'session-1';
      mockRequest.params = { sessionId };
      
      const error = new Error('Database connection failed');
      mockValidationService.getValidationSession.mockRejectedValue(error);

      // Act
      await validationController.getValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
      expect(mockResponse.status).not.toHaveBeenCalled();
      expect(mockResponse.json).not.toHaveBeenCalled();
    });

    it('should handle validation errors with proper status codes', async () => {
      // Arrange
      mockRequest.body = { fileId: '', rules: [] };
      
      const error = new Error('Invalid input');
      error.name = 'ValidationError';
      mockValidationService.createValidationSession.mockRejectedValue(error);

      // Act
      await validationController.createValidationSession(
        mockRequest as Request,
        mockResponse as Response,
        mockNext
      );

      // Assert
      expect(mockNext).toHaveBeenCalledWith(error);
    });
  });
});