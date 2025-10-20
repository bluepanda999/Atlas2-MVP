/**
 * Tests for Validation Service
 */

import { ValidationService } from '../../../api/services/validation.service';
import { WebSocketService } from '../../../api/services/websocket.service';
import { DatabaseService } from '../../../api/services/database.service';
import { 
  ValidationRule, 
  ValidationResult, 
  ValidationProgress, 
  ValidationSession,
  DataPreview 
} from '../../../src/types/validation';

// Mock dependencies
jest.mock('../../../api/services/websocket.service');
jest.mock('../../../api/services/database.service');

describe('ValidationService', () => {
  let validationService: ValidationService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;
  let mockWebSocketService: jest.Mocked<WebSocketService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockWebSocketService = new WebSocketService() as jest.Mocked<WebSocketService>;
    
    validationService = new ValidationService(mockDatabaseService, mockWebSocketService);
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createValidationSession', () => {
    it('should create a validation session successfully', async () => {
      // Arrange
      const fileId = 'test-file-id';
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

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });
      mockWebSocketService.broadcast.mockResolvedValue();

      // Act
      const result = await validationService.createValidationSession(fileId, rules);

      // Assert
      expect(result).toBeDefined();
      expect(result.fileId).toBe(fileId);
      expect(result.status).toBe('pending');
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO validation_sessions'),
        expect.arrayContaining([fileId, 'pending', expect.any(Object)])
      );
    });

    it('should throw error if file does not exist', async () => {
      // Arrange
      const fileId = 'non-existent-file';
      const rules: ValidationRule[] = [];

      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      // Act & Assert
      await expect(validationService.createValidationSession(fileId, rules))
        .rejects.toThrow('File not found');
    });
  });

  describe('validateData', () => {
    it('should validate data successfully with no errors', async () => {
      // Arrange
      const sessionId = 'session-1';
      const sampleData = [
        { email: 'test@example.com', name: 'John Doe', age: 30 },
        { email: 'jane@example.com', name: 'Jane Smith', age: 25 }
      ];
      
      const rules: ValidationRule[] = [
        {
          id: 'rule-1',
          name: 'Required Email',
          description: 'Email field is required',
          type: 'required',
          field: 'email',
          config: { allowEmpty: false },
          enabled: true
        },
        {
          id: 'rule-2',
          name: 'Valid Email Format',
          description: 'Email must be valid format',
          type: 'format',
          field: 'email',
          config: { format: 'email' },
          enabled: true
        }
      ];

      const mockSession: ValidationSession = {
        id: sessionId,
        fileId: 'file-1',
        status: 'running',
        progress: {
          currentRow: 0,
          totalRows: 2,
          percentage: 0,
          errorsFound: 0,
          warningsFound: 0,
          processingRate: 100,
          estimatedTimeRemaining: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });
      mockWebSocketService.broadcast.mockResolvedValue();

      // Act
      const result = await validationService.validateData(sessionId, sampleData, rules);

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.summary.totalRows).toBe(2);
      expect(result.summary.validRows).toBe(2);
    });

    it('should detect validation errors correctly', async () => {
      // Arrange
      const sessionId = 'session-1';
      const sampleData = [
        { email: '', name: 'John Doe', age: 30 }, // Invalid: empty email
        { email: 'invalid-email', name: 'Jane Smith', age: 25 }, // Invalid: bad email format
        { email: 'valid@example.com', name: '', age: 15 } // Invalid: empty name, age too low
      ];
      
      const rules: ValidationRule[] = [
        {
          id: 'rule-1',
          name: 'Required Email',
          description: 'Email field is required',
          type: 'required',
          field: 'email',
          config: { allowEmpty: false },
          enabled: true
        },
        {
          id: 'rule-2',
          name: 'Valid Email Format',
          description: 'Email must be valid format',
          type: 'format',
          field: 'email',
          config: { format: 'email' },
          enabled: true
        },
        {
          id: 'rule-3',
          name: 'Required Name',
          description: 'Name field is required',
          type: 'required',
          field: 'name',
          config: { allowEmpty: false },
          enabled: true
        },
        {
          id: 'rule-4',
          name: 'Age Range',
          description: 'Age must be between 18 and 100',
          type: 'range',
          field: 'age',
          config: { min: 18, max: 100 },
          enabled: true
        }
      ];

      const mockSession: ValidationSession = {
        id: sessionId,
        fileId: 'file-1',
        status: 'running',
        progress: {
          currentRow: 0,
          totalRows: 3,
          percentage: 0,
          errorsFound: 0,
          warningsFound: 0,
          processingRate: 100,
          estimatedTimeRemaining: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });
      mockWebSocketService.broadcast.mockResolvedValue();

      // Act
      const result = await validationService.validateData(sessionId, sampleData, rules);

      // Assert
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.summary.errorRows).toBe(3);
      expect(result.summary.validRows).toBe(0);
      
      // Check specific errors
      const emailErrors = result.errors.filter(e => e.field === 'email');
      expect(emailErrors.length).toBe(2);
      
      const nameErrors = result.errors.filter(e => e.field === 'name');
      expect(nameErrors.length).toBe(1);
      
      const ageErrors = result.errors.filter(e => e.field === 'age');
      expect(ageErrors.length).toBe(1);
    });
  });

  describe('validateRow', () => {
    it('should validate a single row correctly', () => {
      // Arrange
      const row = { email: 'test@example.com', name: 'John Doe', age: 30 };
      const rowIndex = 0;
      const rules: ValidationRule[] = [
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

      // Act
      const result = validationService.validateRow(row, rowIndex, rules);

      // Assert
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });

    it('should return errors for invalid row', () => {
      // Arrange
      const row = { email: '', name: 'John Doe', age: 150 };
      const rowIndex = 0;
      const rules: ValidationRule[] = [
        {
          id: 'rule-1',
          name: 'Required Email',
          description: 'Email field is required',
          type: 'required',
          field: 'email',
          config: { allowEmpty: false },
          enabled: true
        },
        {
          id: 'rule-2',
          name: 'Age Range',
          description: 'Age must be between 0 and 120',
          type: 'range',
          field: 'age',
          config: { min: 0, max: 120 },
          enabled: true
        }
      ];

      // Act
      const result = validationService.validateRow(row, rowIndex, rules);

      // Assert
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].field).toBe('email');
      expect(result.errors[1].field).toBe('age');
    });
  });

  describe('applyValidationRule', () => {
    it('should apply required field validation correctly', () => {
      // Arrange
      const rule: ValidationRule = {
        id: 'rule-1',
        name: 'Required Field',
        description: 'Field must not be empty',
        type: 'required',
        field: 'email',
        config: { allowEmpty: false },
        enabled: true
      };

      // Act & Assert
      expect(validationService.applyValidationRule('test@example.com', rule)).toBeNull();
      expect(validationService.applyValidationRule('', rule)).not.toBeNull();
      expect(validationService.applyValidationRule(null, rule)).not.toBeNull();
      expect(validationService.applyValidationRule(undefined, rule)).not.toBeNull();
    });

    it('should apply format validation correctly', () => {
      // Arrange
      const emailRule: ValidationRule = {
        id: 'rule-1',
        name: 'Email Format',
        description: 'Must be valid email',
        type: 'format',
        field: 'email',
        config: { format: 'email' },
        enabled: true
      };

      const numberRule: ValidationRule = {
        id: 'rule-2',
        name: 'Number Format',
        description: 'Must be number',
        type: 'format',
        field: 'age',
        config: { format: 'number' },
        enabled: true
      };

      // Act & Assert
      expect(validationService.applyValidationRule('test@example.com', emailRule)).toBeNull();
      expect(validationService.applyValidationRule('invalid-email', emailRule)).not.toBeNull();
      
      expect(validationService.applyValidationRule('25', numberRule)).toBeNull();
      expect(validationService.applyValidationRule('not-a-number', numberRule)).not.toBeNull();
    });

    it('should apply range validation correctly', () => {
      // Arrange
      const rule: ValidationRule = {
        id: 'rule-1',
        name: 'Age Range',
        description: 'Age must be between 18 and 100',
        type: 'range',
        field: 'age',
        config: { min: 18, max: 100 },
        enabled: true
      };

      // Act & Assert
      expect(validationService.applyValidationRule(25, rule)).toBeNull();
      expect(validationService.applyValidationRule(17, rule)).not.toBeNull();
      expect(validationService.applyValidationRule(101, rule)).not.toBeNull();
    });

    it('should apply pattern validation correctly', () => {
      // Arrange
      const rule: ValidationRule = {
        id: 'rule-1',
        name: 'Phone Pattern',
        description: 'Must match phone pattern',
        type: 'pattern',
        field: 'phone',
        config: { pattern: '^\\d{3}-\\d{3}-\\d{4}$' },
        enabled: true
      };

      // Act & Assert
      expect(validationService.applyValidationRule('123-456-7890', rule)).toBeNull();
      expect(validationService.applyValidationRule('1234567890', rule)).not.toBeNull();
      expect(validationService.applyValidationRule('12-34-5678', rule)).not.toBeNull();
    });
  });

  describe('generateDataPreview', () => {
    it('should generate data preview correctly', async () => {
      // Arrange
      const fileId = 'test-file-id';
      const sampleData = [
        { email: 'test@example.com', name: 'John Doe', age: 30 },
        { email: 'jane@example.com', name: 'Jane Smith', age: 25 },
        { email: 'bob@example.com', name: 'Bob Johnson', age: null }
      ];

      mockDatabaseService.query.mockResolvedValue({ rows: sampleData });

      // Act
      const result = await validationService.generateDataPreview(fileId, 100);

      // Assert
      expect(result).toBeDefined();
      expect(result.columns).toHaveLength(3);
      expect(result.rows).toHaveLength(3);
      expect(result.totalRows).toBe(3);
      expect(result.sampleSize).toBe(100);
      
      // Check column info
      const emailColumn = result.columns.find(col => col.name === 'email');
      expect(emailColumn).toBeDefined();
      expect(emailColumn!.type).toBe('string');
      expect(emailColumn!.nullable).toBe(false);
      expect(emailColumn!.uniqueCount).toBe(3);
      
      const ageColumn = result.columns.find(col => col.name === 'age');
      expect(ageColumn).toBeDefined();
      expect(ageColumn!.type).toBe('number');
      expect(ageColumn!.nullable).toBe(true);
      expect(ageColumn!.nullCount).toBe(1);
    });
  });

  describe('getValidationSession', () => {
    it('should return validation session by id', async () => {
      // Arrange
      const sessionId = 'session-1';
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

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });

      // Act
      const result = await validationService.getValidationSession(sessionId);

      // Assert
      expect(result).toBeDefined();
      expect(result!.id).toBe(sessionId);
      expect(result!.status).toBe('completed');
      expect(result!.result).toBeDefined();
    });

    it('should return null for non-existent session', async () => {
      // Arrange
      const sessionId = 'non-existent';
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      // Act
      const result = await validationService.getValidationSession(sessionId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe('cancelValidationSession', () => {
    it('should cancel validation session successfully', async () => {
      // Arrange
      const sessionId = 'session-1';
      const mockSession: ValidationSession = {
        id: sessionId,
        fileId: 'file-1',
        status: 'running',
        progress: {
          currentRow: 50,
          totalRows: 100,
          percentage: 50,
          errorsFound: 2,
          warningsFound: 1,
          processingRate: 100,
          estimatedTimeRemaining: 30
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });
      mockWebSocketService.broadcast.mockResolvedValue();

      // Act
      const result = await validationService.cancelValidationSession(sessionId);

      // Assert
      expect(result).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE validation_sessions'),
        expect.arrayContaining(['cancelled', sessionId])
      );
      expect(mockWebSocketService.broadcast).toHaveBeenCalledWith(
        'validation_cancelled',
        expect.objectContaining({ sessionId })
      );
    });
  });

  describe('performance tests', () => {
    it('should handle large datasets efficiently', async () => {
      // Arrange
      const sessionId = 'session-1';
      const largeDataset = Array.from({ length: 10000 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`,
        age: 20 + (i % 60)
      }));
      
      const rules: ValidationRule[] = [
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

      const mockSession: ValidationSession = {
        id: sessionId,
        fileId: 'file-1',
        status: 'running',
        progress: {
          currentRow: 0,
          totalRows: 10000,
          percentage: 0,
          errorsFound: 0,
          warningsFound: 0,
          processingRate: 0,
          estimatedTimeRemaining: 0
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockDatabaseService.query.mockResolvedValue({ rows: [mockSession] });
      mockWebSocketService.broadcast.mockResolvedValue();

      const startTime = Date.now();

      // Act
      const result = await validationService.validateData(sessionId, largeDataset, rules);

      const endTime = Date.now();
      const processingTime = endTime - startTime;

      // Assert
      expect(result.isValid).toBe(true);
      expect(result.summary.totalRows).toBe(10000);
      expect(processingTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});