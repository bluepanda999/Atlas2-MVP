import { ApiKeyAuthService, ApiKeyConfig } from '../../../src/services/api-key-auth.service';

describe('ApiKeyAuthService', () => {
  let service: ApiKeyAuthService;

  beforeEach(() => {
    service = new ApiKeyAuthService();
  });

  describe('Basic functionality', () => {
    it('should create service instance', () => {
      expect(service).toBeDefined();
      expect(service).toBeInstanceOf(ApiKeyAuthService);
    });

    it('should have required methods', () => {
      expect(typeof service.createAuthProfile).toBe('function');
      expect(typeof service.validateApiKey).toBe('function');
      expect(typeof service.testAuthentication).toBe('function');
      expect(typeof service.getAuthHeaders).toBe('function');
      expect(typeof service.getAuthQueryParams).toBe('function');
    });
  });

  describe('Auth Profile Management', () => {
    it('should create API key auth profile', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key-123',
        addTo: 'header',
        headerName: 'X-API-Key'
      };

      const profile = await service.createAuthProfile(
        'Test API Profile',
        'api_key',
        config
      );

      expect(profile).toBeDefined();
      expect(profile.name).toBe('Test API Profile');
      expect(profile.type).toBe('api_key');
      expect(profile.isActive).toBe(true);
      expect(profile.id).toMatch(/^auth_\d+_[a-z0-9]+$/);
    });

    it('should create Basic auth profile', async () => {
      const config = {
        username: 'testuser',
        password: 'testpass'
      };

      const profile = await service.createAuthProfile(
        'Test Basic Auth',
        'basic_auth',
        config
      );

      expect(profile.type).toBe('basic_auth');
      expect(profile.config).toEqual(config);
    });

    it('should create Bearer token profile', async () => {
      const config = {
        token: 'bearer-token-123'
      };

      const profile = await service.createAuthProfile(
        'Test Bearer Token',
        'bearer_token',
        config
      );

      expect(profile.type).toBe('bearer_token');
      expect(profile.config).toEqual(config);
    });
  });

  describe('API Key Validation', () => {
    it('should validate correct API key', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'correct-key',
        addTo: 'header'
      };

      const result = await service.validateApiKey('correct-key', config);

      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject incorrect API key', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'correct-key',
        addTo: 'header'
      };

      const result = await service.validateApiKey('wrong-key', config);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Invalid API key');
      expect(result.statusCode).toBe(401);
    });

    it('should handle missing API key', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key',
        addTo: 'header'
      };

      const result = await service.validateApiKey('', config);

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Missing API key or configuration');
    });
  });

  describe('Auth Headers Generation', () => {
    it('should generate API key headers', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key-123',
        addTo: 'header',
        headerName: 'X-Custom-Key'
      };

      const profile = await service.createAuthProfile('Test', 'api_key', config);
      const headers = service.getAuthHeaders(profile);

      expect(headers['X-Custom-Key']).toBe('test-key-123');
    });

    it('should generate Bearer token headers', async () => {
      const config = { token: 'bearer-token-123' };
      const profile = await service.createAuthProfile('Test', 'bearer_token', config);
      const headers = service.getAuthHeaders(profile);

      expect(headers['Authorization']).toBe('Bearer bearer-token-123');
    });

    it('should generate Basic auth headers', async () => {
      const config = { username: 'user', password: 'pass' };
      const profile = await service.createAuthProfile('Test', 'basic_auth', config);
      const headers = service.getAuthHeaders(profile);

      expect(headers['Authorization']).toBe('Basic dXNlcjpwYXNz');
    });
  });

  describe('Auth Query Parameters', () => {
    it('should generate query params for API key', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key-123',
        addTo: 'query'
      };

      const profile = await service.createAuthProfile('Test', 'api_key', config);
      const params = service.getAuthQueryParams(profile);

      expect(params['api_key']).toBe('test-key-123');
    });

    it('should not generate query params for header API key', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key-123',
        addTo: 'header'
      };

      const profile = await service.createAuthProfile('Test', 'api_key', config);
      const params = service.getAuthQueryParams(profile);

      expect(Object.keys(params)).toHaveLength(0);
    });
  });

  describe('Authentication Testing', () => {
    it('should test authentication successfully', async () => {
      const config: ApiKeyConfig = {
        key: 'api_key',
        value: 'test-key',
        addTo: 'header'
      };

      const profile = await service.createAuthProfile('Test', 'api_key', config);
      const result = await service.testAuthentication(profile.id);

      expect(result.success).toBe(true);
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeUndefined();
    });

    it('should handle non-existent profile in test', async () => {
      const result = await service.testAuthentication('non-existent');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('Profile Management', () => {
    it('should retrieve all profiles', async () => {
      await service.createAuthProfile('Profile 1', 'api_key', {
        key: 'key1',
        value: 'value1',
        addTo: 'header'
      });

      await service.createAuthProfile('Profile 2', 'basic_auth', {
        username: 'user',
        password: 'pass'
      });

      const profiles = await service.getAllAuthProfiles();

      expect(profiles).toHaveLength(2);
      expect(profiles[0].name).toBe('Profile 1');
      expect(profiles[1].name).toBe('Profile 2');
    });

    it('should update profile', async () => {
      const profile = await service.createAuthProfile('Original', 'api_key', {
        key: 'key',
        value: 'value',
        addTo: 'header'
      });

      const updated = await service.updateAuthProfile(profile.id, {
        name: 'Updated Name',
        isActive: false
      });

      expect(updated.name).toBe('Updated Name');
      expect(updated.isActive).toBe(false);
      expect(updated.updatedAt).not.toEqual(profile.updatedAt);
    });

    it('should delete profile', async () => {
      const profile = await service.createAuthProfile('To Delete', 'api_key', {
        key: 'key',
        value: 'value',
        addTo: 'header'
      });

      await service.deleteAuthProfile(profile.id);

      const retrieved = await service.getAuthProfile(profile.id);
      expect(retrieved).toBeNull();
    });
  });
});