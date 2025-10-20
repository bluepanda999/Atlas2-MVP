import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppModule } from '../../../src/app.module';
import { ApiKeyAuthManager } from '../../../src/services/auth/api-key-auth.manager';
import { ApiKeyConfig } from '../../../src/entities/api-key-config.entity';
import { CreateApiKeyConfigDto } from '../../../src/dto/auth/create-api-key-config.dto';
import { CryptoService } from '../../../src/services/crypto/crypto.service';

describe('ApiKeyAuth Integration', () => {
  let module: TestingModule;
  let service: ApiKeyAuthManager;
  let cryptoService: CryptoService;

  beforeAll(async () => {
    const testDatabaseConfig = {
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'test',
      password: 'test',
      database: 'atlas2_test',
      entities: [ApiKeyConfig],
      synchronize: true,
      logging: false,
    };

    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        TypeOrmModule.forFeature([ApiKeyConfig]),
        AppModule,
      ],
      providers: [ApiKeyAuthManager, CryptoService],
    }).compile();

    service = module.get<ApiKeyAuthManager>(ApiKeyAuthManager);
    cryptoService = module.get<CryptoService>(CryptoService);
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Clean up database before each test
    const repository = module.get('ApiKeyConfigRepository');
    await repository.query('DELETE FROM api_key_configs');
  });

  describe('End-to-End API Key Workflow', () => {
    it('should complete full API key lifecycle', async () => {
      // 1. Create API key configuration
      const createDto: CreateApiKeyConfigDto = {
        name: 'Integration Test API Key',
        description: 'API key for integration testing',
        permissions: ['read', 'write'],
        rateLimit: { requests: 1000, window: 3600 },
      };

      const createdConfig = await service.createApiKeyConfig('test-client', createDto);
      
      expect(createdConfig).toBeDefined();
      expect(createdConfig.id).toBeDefined();
      expect(createdConfig.name).toBe(createDto.name);
      expect(createdConfig.apiKey).toMatch(/^ak_/);
      expect(createdConfig.keyPrefix).toMatch(/^ak_/);

      const apiKey = createdConfig.apiKey;

      // 2. Validate the API key
      const validationResult = await service.validateApiKey(apiKey);
      
      expect(validationResult.valid).toBe(true);
      expect(validationResult.analysis).toBeDefined();
      expect(validationResult.analysis.keyId).toBe(createdConfig.id);

      // 3. Test authentication injection
      const request = {
        method: 'GET',
        url: 'https://api.example.com/data',
        headers: {},
      };

      const authenticatedRequest = await service.injectAuthentication(request, createdConfig.id);
      
      expect(authenticatedRequest.headers['X-API-Key']).toBe(apiKey);

      // 4. Update the configuration
      const updateDto = {
        name: 'Updated API Key Name',
        isActive: false,
      };

      const updatedConfig = await service.updateApiKeyConfig(createdConfig.id, updateDto);
      
      expect(updatedConfig.name).toBe(updateDto.name);
      expect(updatedConfig.isActive).toBe(updateDto.isActive);

      // 5. Regenerate the API key
      const regeneratedResult = await service.regenerateApiKey(createdConfig.id);
      
      expect(regeneratedResult.apiKey).toBeDefined();
      expect(regeneratedResult.apiKey).not.toBe(apiKey);
      expect(regeneratedResult.config.keyPrefix).not.toBe(createdConfig.keyPrefix);

      // 6. Validate the new API key
      const newValidationResult = await service.validateApiKey(regeneratedResult.apiKey);
      
      expect(newValidationResult.valid).toBe(true);

      // 7. Delete the configuration
      await service.deleteApiKeyConfig(createdConfig.id);

      // 8. Verify deletion
      const deletedConfig = await service.getApiKeyConfig(createdConfig.id);
      expect(deletedConfig).toBeNull();
    });

    it('should handle rate limiting and permissions', async () => {
      // Create API key with specific rate limit and permissions
      const createDto: CreateApiKeyConfigDto = {
        name: 'Rate Limited API Key',
        permissions: ['read-only'],
        rateLimit: { requests: 100, window: 3600 },
      };

      const config = await service.createApiKeyConfig('test-client', createDto);
      
      expect(config.permissions).toEqual(['read-only']);
      expect(config.rateLimit.requests).toBe(100);
      expect(config.rateLimit.window).toBe(3600);
    });

    it('should handle expired API keys', async () => {
      // Create API key with expiration
      const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
      const createDto: CreateApiKeyConfigDto = {
        name: 'Expired API Key',
        expiresAt: pastDate.toISOString(),
      };

      const config = await service.createApiKeyConfig('test-client', createDto);
      
      // Validate should fail due to expiration
      const validationResult = await service.validateApiKey(config.apiKey);
      
      expect(validationResult.valid).toBe(false);
      expect(validationResult.expired).toBe(true);
    });
  });

  describe('Security Validation', () => {
    it('should encrypt API keys in database', async () => {
      const createDto: CreateApiKeyConfigDto = {
        name: 'Security Test API Key',
      };

      const config = await service.createApiKeyConfig('test-client', createDto);
      
      // Retrieve from database to verify encryption
      const repository = module.get('ApiKeyConfigRepository');
      const storedConfig = await repository.findOne({ where: { id: config.id } });
      
      expect(storedConfig.apiKey).not.toBe(config.apiKey);
      expect(storedConfig.apiKey).toMatch(/^{.*}$/); // Should be encrypted JSON
      
      // Verify decryption works
      const decryptedKey = await cryptoService.decrypt(storedConfig.apiKey);
      expect(decryptedKey).toBe(config.apiKey);
    });

    it('should generate unique API keys', async () => {
      const createDto: CreateApiKeyConfigDto = {
        name: 'Unique Test API Key',
      };

      const config1 = await service.createApiKeyConfig('test-client', createDto);
      const config2 = await service.createApiKeyConfig('test-client', createDto);
      
      expect(config1.apiKey).not.toBe(config2.apiKey);
      expect(config1.keyPrefix).not.toBe(config2.keyPrefix);
    });

    it('should validate API key format', async () => {
      const createDto: CreateApiKeyConfigDto = {
        name: 'Format Test API Key',
      };

      const config = await service.createApiKeyConfig('test-client', createDto);
      
      expect(config.apiKey).toMatch(/^ak_[a-z0-9]+$/);
      expect(config.apiKey.length).toBeGreaterThan(20);
    });
  });

  describe('Performance Validation', () => {
    it('should complete validation within performance threshold', async () => {
      const createDto: CreateApiKeyConfigDto = {
        name: 'Performance Test API Key',
      };

      const config = await service.createApiKeyConfig('test-client', createDto);
      
      const startTime = Date.now();
      const validationResult = await service.validateApiKey(config.apiKey);
      const endTime = Date.now();
      
      const responseTime = endTime - startTime;
      
      expect(validationResult.valid).toBe(true);
      expect(responseTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(validationResult.responseTime).toBeLessThan(2000);
    });

    it('should handle concurrent API key operations', async () => {
      const createDto: CreateApiKeyConfigDto = {
        name: 'Concurrent Test API Key',
      };

      // Create multiple API keys concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        service.createApiKeyConfig('test-client', {
          ...createDto,
          name: `${createDto.name} ${i}`,
        })
      );

      const configs = await Promise.all(promises);
      
      expect(configs).toHaveLength(10);
      configs.forEach((config, index) => {
        expect(config.name).toBe(`${createDto.name} ${index}`);
        expect(config.apiKey).toMatch(/^ak_[a-z0-9]+$/);
      });

      // Validate all API keys concurrently
      const validationPromises = configs.map(config =>
        service.validateApiKey(config.apiKey)
      );

      const validationResults = await Promise.all(validationPromises);
      
      validationResults.forEach(result => {
        expect(result.valid).toBe(true);
      });
    });
  });
});