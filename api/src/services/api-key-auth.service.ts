import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface ApiKeyConfig {
  key: string;
  value: string;
  addTo: 'header' | 'query';
  headerName?: string;
}

export interface AuthProfile {
  id: string;
  name: string;
  type: 'api_key' | 'basic_auth' | 'bearer_token';
  config: ApiKeyConfig | any;
  apiSpecId?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationResult {
  isValid: boolean;
  error?: string;
  statusCode?: number;
}

export class ApiKeyAuthService {
  // In-memory storage for POC (should be database in production)
  private authProfiles = new Map<string, AuthProfile>();

  async createAuthProfile(
    name: string,
    type: 'api_key' | 'basic_auth' | 'bearer_token',
    config: ApiKeyConfig | any,
    apiSpecId?: string
  ): Promise<AuthProfile> {
    try {
      const profile: AuthProfile = {
        id: this.generateId(),
        name,
        type,
        config,
        apiSpecId,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Validate the configuration
      this.validateConfig(type, config);

      // Store profile
      this.authProfiles.set(profile.id, profile);

      logger.info(`Created auth profile: ${name} (${type})`);
      return profile;

    } catch (error) {
      logger.error('Failed to create auth profile:', error);
      throw new AppError('Failed to create authentication profile', 400, error);
    }
  }

  async validateApiKey(
    apiKey: string,
    config: ApiKeyConfig
  ): Promise<ValidationResult> {
    try {
      if (!apiKey || !config) {
        return {
          isValid: false,
          error: 'Missing API key or configuration',
          statusCode: 401
        };
      }

      // For POC, we'll do simple string comparison
      // In production, you might validate against a database or external service
      const isValid = apiKey === config.value;

      if (!isValid) {
        return {
          isValid: false,
          error: 'Invalid API key',
          statusCode: 401
        };
      }

      return { isValid: true };

    } catch (error) {
      logger.error('API key validation error:', error);
      return {
        isValid: false,
        error: 'Validation failed',
        statusCode: 500
      };
    }
  }

  async testAuthentication(
    profileId: string,
    testUrl?: string
  ): Promise<{ success: boolean; error?: string; responseTime?: number }> {
    try {
      const profile = this.authProfiles.get(profileId);
      if (!profile) {
        throw new AppError('Authentication profile not found', 404);
      }

      // For POC, we'll simulate a test
      // In production, you would make an actual API call
      const startTime = Date.now();
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const responseTime = Date.now() - startTime;

      // Simulate success for valid configurations
      const success = this.isValidConfig(profile.type, profile.config);

      logger.info(`Authentication test for ${profile.name}: ${success ? 'SUCCESS' : 'FAILED'}`);
      
      return {
        success,
        responseTime,
        error: success ? undefined : 'Invalid authentication configuration'
      };

    } catch (error) {
      logger.error('Authentication test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getAuthHeaders(profile: AuthProfile): Record<string, string> {
    const headers: Record<string, string> = {};

    switch (profile.type) {
      case 'api_key':
        const apiKeyConfig = profile.config as ApiKeyConfig;
        if (apiKeyConfig.addTo === 'header') {
          const headerName = apiKeyConfig.headerName || 'X-API-Key';
          headers[headerName] = apiKeyConfig.value;
        }
        break;

      case 'bearer_token':
        headers['Authorization'] = `Bearer ${(profile.config as any).token}`;
        break;

      case 'basic_auth':
        const basicAuth = profile.config as any;
        const credentials = Buffer(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;
    }

    return headers;
  }

  getAuthQueryParams(profile: AuthProfile): Record<string, string> {
    const params: Record<string, string> = {};

    if (profile.type === 'api_key') {
      const apiKeyConfig = profile.config as ApiKeyConfig;
      if (apiKeyConfig.addTo === 'query') {
        params[apiKeyConfig.key] = apiKeyConfig.value;
      }
    }

    return params;
  }

  async getAuthProfile(profileId: string): Promise<AuthProfile | null> {
    return this.authProfiles.get(profileId) || null;
  }

  async getAllAuthProfiles(): Promise<AuthProfile[]> {
    return Array.from(this.authProfiles.values());
  }

  async updateAuthProfile(
    profileId: string,
    updates: Partial<AuthProfile>
  ): Promise<AuthProfile> {
    const profile = this.authProfiles.get(profileId);
    if (!profile) {
      throw new AppError('Authentication profile not found', 404);
    }

    const updatedProfile = {
      ...profile,
      ...updates,
      updatedAt: new Date()
    };

    this.authProfiles.set(profileId, updatedProfile);
    logger.info(`Updated auth profile: ${updatedProfile.name}`);

    return updatedProfile;
  }

  async deleteAuthProfile(profileId: string): Promise<void> {
    const profile = this.authProfiles.get(profileId);
    if (!profile) {
      throw new AppError('Authentication profile not found', 404);
    }

    this.authProfiles.delete(profileId);
    logger.info(`Deleted auth profile: ${profile.name}`);
  }

  private validateConfig(type: string, config: any): void {
    switch (type) {
      case 'api_key':
        const apiKeyConfig = config as ApiKeyConfig;
        if (!apiKeyConfig.key || !apiKeyConfig.value) {
          throw new AppError('API key configuration requires key and value', 400);
        }
        if (!['header', 'query'].includes(apiKeyConfig.addTo)) {
          throw new AppError('API key addTo must be "header" or "query"', 400);
        }
        break;

      case 'basic_auth':
        if (!config.username || !config.password) {
          throw new AppError('Basic auth configuration requires username and password', 400);
        }
        break;

      case 'bearer_token':
        if (!config.token) {
          throw new AppError('Bearer token configuration requires token', 400);
        }
        break;

      default:
        throw new AppError(`Unsupported authentication type: ${type}`, 400);
    }
  }

  private isValidConfig(type: string, config: any): boolean {
    try {
      this.validateConfig(type, config);
      return true;
    } catch {
      return false;
    }
  }

  private generateId(): string {
    return `auth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}