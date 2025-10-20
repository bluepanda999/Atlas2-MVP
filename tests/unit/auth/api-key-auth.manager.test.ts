import { Test, TestingModule } from '@nestjs/testing';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApiKeyAuthManager } from '../../../src/services/auth/api-key-auth.manager';
import { CryptoService } from '../../../src/services/crypto/crypto.service';
import { AuditService } from '../../../src/services/audit/audit.service';
import { ApiKeyConfig } from '../../../src/entities/api-key-config.entity';
import { CreateApiKeyConfigDto } from '../../../src/dto/auth/create-api-key-config.dto';
import { UpdateApiKeyConfigDto } from '../../../src/dto/auth/update-api-key-config.dto';

describe('ApiKeyAuthManager', () => {
  let service: ApiKeyAuthManager;
  let apiKeyConfigRepository: Repository<ApiKeyConfig>;
  let cryptoService: CryptoService;
  let auditService: AuditService;

  const mockApiKeyConfigRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
  };

  const mockCryptoService = {
    encrypt: jest.fn(),
    decrypt: jest.fn(),
    hash: jest.fn(),
    compareHash: jest.fn(),
    generateSecureToken: jest.fn(),
  };

  const mockAuditService = {
    logAuthEvent: jest.fn(),
    getAuditLogs: jest.fn(),
    getAuditStats: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApiKeyAuthManager,
        {
          provide: getRepositoryToken(ApiKeyConfig),
          useValue: mockApiKeyConfigRepository,
        },
        {
          provide: CryptoService,
          useValue: mockCryptoService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<ApiKeyAuthManager>(ApiKeyAuthManager);
    apiKeyConfigRepository = module.get<Repository<ApiKeyConfig>>(getRepositoryToken(ApiKeyConfig));
    cryptoService = module.get<CryptoService>(CryptoService);
    auditService = module.get<AuditService>(AuditService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('createApiKeyConfig', () => {
    it('should create API key configuration successfully', async () => {
      // Arrange
      const clientId = 'test-client';
      const createDto: CreateApiKeyConfigDto = {
        name: 'Test API Key',
        description: 'Test description',
        permissions: ['read', 'write'],
        rateLimit: { requests: 1000, window: 3600 },
      };

      const encryptedApiKey = 'encrypted-api-key';
      const expectedApiKeyConfig = {
        id: 'config-id',
        clientId,
        name: createDto.name,
        description: createDto.description,
        apiKey: encryptedApiKey,
        keyPrefix: 'ak_12345678',
        permissions: createDto.permissions,
        rateLimit: createDto.rateLimit,
        isActive: true,
        expiresAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockCryptoService.encrypt.mockResolvedValue(encryptedApiKey);
      mockApiKeyConfigRepository.create.mockReturnValue(expectedApiKeyConfig);
      mockApiKeyConfigRepository.save.mockResolvedValue(expectedApiKeyConfig);

      // Act
      const result = await service.createApiKeyConfig(clientId, createDto);

      // Assert
      expect(cryptoService.encrypt).toHaveBeenCalled();
      expect(apiKeyConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId,
          name: createDto.name,
          description: createDto.description,
          apiKey: encryptedApiKey,
          permissions: createDto.permissions,
          rateLimit: createDto.rateLimit,
        })
      );
      expect(apiKeyConfigRepository.save).toHaveBeenCalledWith(expectedApiKeyConfig);
      expect(auditService.logAuthEvent).toHaveBeenCalledWith({
        configId: expectedApiKeyConfig.id,
        configType: 'api_key',
        action: 'created',
        details: expect.objectContaining({
          clientId,
          name: createDto.name,
        }),
      });
      expect(result).toEqual(expect.objectContaining({
        ...expectedApiKeyConfig,
        apiKey: expect.any(String), // Should return unencrypted key
      }));
    });

    it('should handle creation errors gracefully', async () => {
      // Arrange
      const clientId = 'test-client';
      const createDto: CreateApiKeyConfigDto = {
        name: 'Test API Key',
      };

      mockCryptoService.encrypt.mockRejectedValue(new Error('Encryption failed'));

      // Act & Assert
      await expect(service.createApiKeyConfig(clientId, createDto)).rejects.toThrow('Encryption failed');
    });
  });

  describe('validateApiKey', () => {
    it('should validate API key successfully', async () => {
      // Arrange
      const apiKey = 'ak_test1234567890';
      const testEndpoint = 'https://api.example.com/test';
      
      const mockConfig = {
        id: 'config-id',
        apiKey: 'encrypted-key',
        isActive: true,
        expiresAt: null,
      };

      mockApiKeyConfigRepository.find.mockResolvedValue([mockConfig]);
      mockCryptoService.decrypt.mockResolvedValue(apiKey);
      global.fetch = jest.fn().mockResolvedValue({
        status: 200,
        headers: new Map([['content-type', 'application/json']]),
      });

      // Act
      const result = await service.validateApiKey(apiKey, testEndpoint);

      // Assert
      expect(result.valid).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(auditService.logAuthEvent).toHaveBeenCalledWith({
        configId: mockConfig.id,
        configType: 'api_key',
        action: 'validation',
        details: expect.objectContaining({
          endpoint: testEndpoint,
          success: true,
        }),
      });
    });

    it('should reject invalid API key', async () => {
      // Arrange
      const apiKey = 'invalid-key';
      
      mockApiKeyConfigRepository.find.mockResolvedValue([]);

      // Act
      const result = await service.validateApiKey(apiKey);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.recommendations).toContain('Check the API key and try again');
    });

    it('should handle expired API keys', async () => {
      // Arrange
      const apiKey = 'ak_expired1234567890';
      const expiredDate = new Date(Date.now() - 10000); // Past date
      
      const mockConfig = {
        id: 'config-id',
        apiKey: 'encrypted-key',
        isActive: true,
        expiresAt: expiredDate,
      };

      mockApiKeyConfigRepository.find.mockResolvedValue([mockConfig]);
      mockCryptoService.decrypt.mockResolvedValue(apiKey);

      // Act
      const result = await service.validateApiKey(apiKey);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.expired).toBe(true);
      expect(result.recommendations).toContain('Generate a new API key');
    });
  });

  describe('injectAuthentication', () => {
    it('should inject API key into request headers', async () => {
      // Arrange
      const configId = 'config-id';
      const apiKey = 'ak_test1234567890';
      const request = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      };

      const mockConfig = {
        id: configId,
        apiKey: 'encrypted-key',
        isActive: true,
        expiresAt: null,
      };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(mockConfig);
      mockCryptoService.decrypt.mockResolvedValue(apiKey);

      // Act
      const result = await service.injectAuthentication(request, configId);

      // Assert
      expect(result.headers['X-API-Key']).toBe(apiKey);
      expect(auditService.logAuthEvent).toHaveBeenCalledWith({
        configId: configId,
        configType: 'api_key',
        action: 'used',
        details: expect.objectContaining({
          endpoint: request.url,
          method: request.method,
        }),
      });
    });

    it('should throw error for inactive config', async () => {
      // Arrange
      const configId = 'config-id';
      const request = { headers: {} };

      const mockConfig = {
        id: configId,
        isActive: false,
      };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(mockConfig);

      // Act & Assert
      await expect(service.injectAuthentication(request, configId)).rejects.toThrow(
        'Invalid or inactive API key configuration'
      );
    });
  });

  describe('updateApiKeyConfig', () => {
    it('should update API key configuration successfully', async () => {
      // Arrange
      const configId = 'config-id';
      const updateDto: UpdateApiKeyConfigDto = {
        name: 'Updated Name',
        isActive: false,
      };

      const existingConfig = {
        id: configId,
        name: 'Original Name',
        isActive: true,
      };

      const updatedConfig = {
        ...existingConfig,
        ...updateDto,
        updatedAt: new Date(),
      };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(existingConfig);
      mockApiKeyConfigRepository.save.mockResolvedValue(updatedConfig);

      // Act
      const result = await service.updateApiKeyConfig(configId, updateDto);

      // Assert
      expect(apiKeyConfigRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingConfig,
          ...updateDto,
          updatedAt: expect.any(Date),
        })
      );
      expect(auditService.logAuthEvent).toHaveBeenCalledWith({
        configId: configId,
        configType: 'api_key',
        action: 'updated',
        details: expect.objectContaining({
          changes: Object.keys(updateDto),
        }),
      });
    });

    it('should throw error for non-existent config', async () => {
      // Arrange
      const configId = 'non-existent-id';
      const updateDto: UpdateApiKeyConfigDto = { name: 'Updated Name' };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(null);

      // Act & Assert
      await expect(service.updateApiKeyConfig(configId, updateDto)).rejects.toThrow(
        'API key configuration not found'
      );
    });
  });

  describe('deleteApiKeyConfig', () => {
    it('should delete API key configuration successfully', async () => {
      // Arrange
      const configId = 'config-id';
      const mockConfig = {
        id: configId,
        clientId: 'test-client',
        name: 'Test API Key',
      };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(mockConfig);
      mockApiKeyConfigRepository.remove.mockResolvedValue(mockConfig);

      // Act
      await service.deleteApiKeyConfig(configId);

      // Assert
      expect(apiKeyConfigRepository.remove).toHaveBeenCalledWith(mockConfig);
      expect(auditService.logAuthEvent).toHaveBeenCalledWith({
        configId: configId,
        configType: 'api_key',
        action: 'deleted',
        details: expect.objectContaining({
          clientId: mockConfig.clientId,
          name: mockConfig.name,
        }),
      });
    });
  });

  describe('regenerateApiKey', () => {
    it('should regenerate API key successfully', async () => {
      // Arrange
      const configId = 'config-id';
      const newApiKey = 'ak_new1234567890';
      const encryptedNewKey = 'encrypted-new-key';

      const existingConfig = {
        id: configId,
        keyPrefix: 'ak_old12345',
      };

      const updatedConfig = {
        ...existingConfig,
        keyPrefix: 'ak_new12345',
        apiKey: encryptedNewKey,
      };

      mockApiKeyConfigRepository.findOne.mockResolvedValue(existingConfig);
      mockCryptoService.encrypt.mockResolvedValue(encryptedNewKey);
      jest.spyOn(service, 'updateApiKeyConfig').mockResolvedValue(updatedConfig);

      // Act
      const result = await service.regenerateApiKey(configId);

      // Assert
      expect(cryptoService.encrypt).toHaveBeenCalled();
      expect(service.updateApiKeyConfig).toHaveBeenCalledWith(configId, {
        apiKey: encryptedNewKey,
        keyPrefix: expect.stringMatching(/^ak_/),
        updatedAt: expect.any(Date),
      });
      expect(result).toEqual({
        apiKey: newApiKey,
        config: updatedConfig,
      });
    });
  });
});