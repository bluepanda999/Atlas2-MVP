import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CryptoService } from '../crypto/crypto.service';
import { AuditService } from '../audit/audit.service';
import { ApiKeyConfig } from '../../entities/api-key-config.entity';
import { CreateApiKeyConfigDto } from '../../dto/auth/create-api-key-config.dto';
import { UpdateApiKeyConfigDto } from '../../dto/auth/update-api-key-config.dto';
import { ValidationResult } from '../../interfaces/validation-result.interface';

@Injectable()
export class ApiKeyAuthManager {
  private readonly logger = new Logger(ApiKeyAuthManager.name);

  constructor(
    @InjectRepository(ApiKeyConfig)
    private readonly apiKeyConfigRepository: Repository<ApiKeyConfig>,
    private readonly cryptoService: CryptoService,
    private readonly auditService: AuditService,
  ) {}

  async createApiKeyConfig(clientId: string, config: CreateApiKeyConfigDto): Promise<ApiKeyConfig> {
    this.logger.log(`Creating API key configuration for client: ${clientId}`);

    const apiKey = this.generateApiKey();
    const encryptedApiKey = await this.cryptoService.encrypt(apiKey);

    const apiKeyConfig = this.apiKeyConfigRepository.create({
      clientId,
      name: config.name,
      description: config.description,
      apiKey: encryptedApiKey,
      keyPrefix: apiKey.substring(0, 8),
      permissions: config.permissions || [],
      rateLimit: config.rateLimit || { requests: 1000, window: 3600 },
      isActive: true,
      expiresAt: config.expiresAt ? new Date(config.expiresAt) : null,
    });

    const savedConfig = await this.apiKeyConfigRepository.save(apiKeyConfig);

    // Audit the creation
    await this.auditService.logAuthEvent({
      configId: savedConfig.id,
      configType: 'api_key',
      action: 'created',
      details: {
        clientId,
        name: config.name,
        keyPrefix: savedConfig.keyPrefix,
        permissions: config.permissions,
      },
    });

    this.logger.log(`API key configuration created successfully: ${savedConfig.id}`);
    
    // Return the config with the actual API key (only time it's shown)
    return {
      ...savedConfig,
      apiKey, // Return unencrypted key for initial display
    };
  }

  async validateApiKey(apiKey: string, testEndpoint?: string): Promise<ValidationResult> {
    const startTime = Date.now();

    try {
      // Find the API key config by comparing encrypted values
      const configs = await this.apiKeyConfigRepository.find({
        where: { isActive: true },
      });

      let matchedConfig: ApiKeyConfig | null = null;

      for (const config of configs) {
        const decryptedKey = await this.cryptoService.decrypt(config.apiKey);
        if (decryptedKey === apiKey) {
          matchedConfig = config;
          break;
        }
      }

      if (!matchedConfig) {
        const responseTime = Date.now() - startTime;
        
        await this.auditService.logAuthEvent({
          configId: 'unknown',
          configType: 'api_key',
          action: 'validation_failed',
          details: {
            reason: 'invalid_key',
            responseTime,
          },
        });

        return {
          valid: false,
          responseTime,
          error: 'Invalid API key',
          recommendations: ['Check the API key and try again', 'Ensure the key is active and not expired'],
        };
      }

      // Check expiration
      if (matchedConfig.expiresAt && new Date() > matchedConfig.expiresAt) {
        return {
          valid: false,
          error: 'API key has expired',
          expired: true,
          recommendations: ['Generate a new API key', 'Update your integration with the new key'],
        };
      }

      // If test endpoint provided, make a test request
      if (testEndpoint) {
        const testResult = await this.testApiKeyEndpoint(matchedConfig, apiKey, testEndpoint);
        const responseTime = Date.now() - startTime;

        await this.auditService.logAuthEvent({
          configId: matchedConfig.id,
          configType: 'api_key',
          action: 'validation',
          details: {
            endpoint: testEndpoint,
            success: testResult.valid,
            responseTime,
          },
        });

        return {
          valid: testResult.valid,
          responseTime,
          statusCode: testResult.statusCode,
          analysis: testResult.analysis,
          recommendations: testResult.recommendations,
        };
      }

      const responseTime = Date.now() - startTime;

      await this.auditService.logAuthEvent({
        configId: matchedConfig.id,
        configType: 'api_key',
        action: 'validation',
        details: {
          success: true,
          responseTime,
        },
      });

      return {
        valid: true,
        responseTime,
        analysis: {
          keyId: matchedConfig.id,
          keyPrefix: matchedConfig.keyPrefix,
          permissions: matchedConfig.permissions,
          expiresAt: matchedConfig.expiresAt,
        },
        recommendations: ['API key is valid and active'],
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      this.logger.error(`API key validation failed: ${error.message}`, error.stack);

      await this.auditService.logAuthEvent({
        configId: 'unknown',
        configType: 'api_key',
        action: 'validation_error',
        details: {
          error: error.message,
          responseTime,
        },
      });

      return {
        valid: false,
        responseTime,
        error: 'Validation failed',
        recommendations: ['Try again later', 'Contact support if the issue persists'],
      };
    }
  }

  async injectAuthentication(request: any, configId: string): Promise<any> {
    const config = await this.getApiKeyConfig(configId);
    if (!config || !config.isActive) {
      throw new Error(`Invalid or inactive API key configuration: ${configId}`);
    }

    // Check expiration
    if (config.expiresAt && new Date() > config.expiresAt) {
      throw new Error(`API key has expired: ${configId}`);
    }

    // Decrypt the API key
    const apiKey = await this.cryptoService.decrypt(config.apiKey);

    // Inject API key into request
    request.headers = request.headers || {};
    request.headers['X-API-Key'] = apiKey;

    // Audit authentication usage
    await this.auditService.logAuthEvent({
      configId: config.id,
      configType: 'api_key',
      action: 'used',
      details: {
        endpoint: request.url,
        method: request.method,
      },
    });

    return request;
  }

  async getApiKeyConfig(configId: string): Promise<ApiKeyConfig | null> {
    return await this.apiKeyConfigRepository.findOne({
      where: { id: configId },
    });
  }

  async getApiKeyConfigsByClient(clientId: string): Promise<ApiKeyConfig[]> {
    return await this.apiKeyConfigRepository.find({
      where: { clientId },
      order: { createdAt: 'DESC' },
    });
  }

  async updateApiKeyConfig(configId: string, updates: UpdateApiKeyConfigDto): Promise<ApiKeyConfig> {
    const existingConfig = await this.getApiKeyConfig(configId);
    if (!existingConfig) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    const updatedConfig = {
      ...existingConfig,
      ...updates,
      updatedAt: new Date(),
    };

    const savedConfig = await this.apiKeyConfigRepository.save(updatedConfig);

    // Audit the update
    await this.auditService.logAuthEvent({
      configId: savedConfig.id,
      configType: 'api_key',
      action: 'updated',
      details: {
        changes: Object.keys(updates),
      },
    });

    this.logger.log(`API key configuration updated: ${configId}`);
    return savedConfig;
  }

  async deleteApiKeyConfig(configId: string): Promise<void> {
    const config = await this.getApiKeyConfig(configId);
    if (!config) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    await this.apiKeyConfigRepository.remove(config);

    // Audit the deletion
    await this.auditService.logAuthEvent({
      configId: config.id,
      configType: 'api_key',
      action: 'deleted',
      details: {
        clientId: config.clientId,
        name: config.name,
      },
    });

    this.logger.log(`API key configuration deleted: ${configId}`);
  }

  async regenerateApiKey(configId: string): Promise<{ apiKey: string; config: ApiKeyConfig }> {
    const config = await this.getApiKeyConfig(configId);
    if (!config) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    const newApiKey = this.generateApiKey();
    const encryptedApiKey = await this.cryptoService.encrypt(newApiKey);

    const updatedConfig = await this.updateApiKeyConfig(configId, {
      apiKey: encryptedApiKey,
      keyPrefix: newApiKey.substring(0, 8),
      updatedAt: new Date(),
    });

    // Audit the regeneration
    await this.auditService.logAuthEvent({
      configId: config.id,
      configType: 'api_key',
      action: 'regenerated',
      details: {
        oldKeyPrefix: config.keyPrefix,
        newKeyPrefix: updatedConfig.keyPrefix,
      },
    });

    this.logger.log(`API key regenerated: ${configId}`);
    
    return {
      apiKey: newApiKey,
      config: updatedConfig,
    };
  }

  private generateApiKey(): string {
    const prefix = 'ak_';
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 15);
    const random2 = Math.random().toString(36).substring(2, 15);
    
    return `${prefix}${timestamp}${random}${random2}`;
  }

  private async testApiKeyEndpoint(
    config: ApiKeyConfig,
    apiKey: string,
    testEndpoint: string,
  ): Promise<ValidationResult> {
    try {
      const response = await fetch(testEndpoint, {
        method: 'GET',
        headers: {
          'X-API-Key': apiKey,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      });

      const analysis = this.analyzeTestResponse(response, config);

      return {
        valid: response.status >= 200 && response.status < 300,
        statusCode: response.status,
        analysis: analysis.details,
        recommendations: analysis.recommendations,
      };

    } catch (error) {
      return {
        valid: false,
        error: error.message,
        recommendations: this.generateErrorRecommendations(error),
      };
    }
  }

  private analyzeTestResponse(response: Response, config: ApiKeyConfig) {
    const success = response.status >= 200 && response.status < 300;
    
    const details = {
      statusCode: response.status,
      contentType: response.headers.get('content-type'),
      keyId: config.id,
      keyPrefix: config.keyPrefix,
      permissions: config.permissions,
    };

    const recommendations = [];

    if (response.status === 401) {
      recommendations.push('API key is invalid or expired');
    } else if (response.status === 403) {
      recommendations.push('API key is valid but lacks permission for this endpoint');
    } else if (response.status === 429) {
      recommendations.push('Rate limit exceeded. Check your rate limit settings');
    } else if (success) {
      recommendations.push('API key authentication is working correctly');
    }

    return {
      success,
      details,
      recommendations,
    };
  }

  private generateErrorRecommendations(error: any): string[] {
    const recommendations = [];

    if (error.name === 'AbortError') {
      recommendations.push('Request timed out. Check the endpoint URL and network connectivity');
    } else if (error.code === 'ECONNREFUSED') {
      recommendations.push('Unable to connect to the API endpoint. Check the URL');
    } else if (error.code === 'ENOTFOUND') {
      recommendations.push('API endpoint hostname could not be resolved. Check the URL');
    } else {
      recommendations.push('Network error occurred. Check your connection and try again');
    }

    return recommendations;
  }
}