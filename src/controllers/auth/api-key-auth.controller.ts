import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { ApiKeyAuthManager } from '../../services/auth/api-key-auth.manager';
import { CreateApiKeyConfigDto } from '../../dto/auth/create-api-key-config.dto';
import { UpdateApiKeyConfigDto } from '../../dto/auth/update-api-key-config.dto';
import { ValidationRequestDto } from '../../dto/auth/validation-request.dto';
import { JwtAuthGuard } from '../../guards/jwt-auth.guard';
import { ApiKeyConfig } from '../../entities/api-key-config.entity';

@ApiTags('API Key Authentication')
@Controller('api/auth/api-key')
@UseGuards(JwtAuthGuard)
export class ApiKeyAuthController {
  constructor(private readonly apiKeyAuthManager: ApiKeyAuthManager) {}

  @Post('configs')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new API key configuration' })
  @ApiResponse({ status: 201, description: 'API key configuration created successfully', type: ApiKeyConfig })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async createConfig(@Body() createDto: CreateApiKeyConfigDto): Promise<ApiKeyConfig> {
    // In a real implementation, clientId would come from the authenticated user
    const clientId = 'default-client';
    return await this.apiKeyAuthManager.createApiKeyConfig(clientId, createDto);
  }

  @Get('configs')
  @ApiOperation({ summary: 'Get all API key configurations for a client' })
  @ApiResponse({ status: 200, description: 'API key configurations retrieved successfully', type: [ApiKeyConfig] })
  @ApiQuery({ name: 'clientId', required: false, description: 'Client ID to filter configurations' })
  async getConfigs(@Query('clientId') clientId?: string): Promise<ApiKeyConfig[]> {
    if (clientId) {
      return await this.apiKeyAuthManager.getApiKeyConfigsByClient(clientId);
    }
    
    // In a real implementation, this would get configs for the authenticated user's client
    return await this.apiKeyAuthManager.getApiKeyConfigsByClient('default-client');
  }

  @Get('configs/:configId')
  @ApiOperation({ summary: 'Get a specific API key configuration' })
  @ApiResponse({ status: 200, description: 'API key configuration retrieved successfully', type: ApiKeyConfig })
  @ApiResponse({ status: 404, description: 'API key configuration not found' })
  @ApiParam({ name: 'configId', description: 'API key configuration ID' })
  async getConfig(@Param('configId') configId: string): Promise<ApiKeyConfig> {
    const config = await this.apiKeyAuthManager.getApiKeyConfig(configId);
    if (!config) {
      throw new Error('API key configuration not found');
    }
    return config;
  }

  @Put('configs/:configId')
  @ApiOperation({ summary: 'Update an API key configuration' })
  @ApiResponse({ status: 200, description: 'API key configuration updated successfully', type: ApiKeyConfig })
  @ApiResponse({ status: 404, description: 'API key configuration not found' })
  @ApiParam({ name: 'configId', description: 'API key configuration ID' })
  async updateConfig(
    @Param('configId') configId: string,
    @Body() updateDto: UpdateApiKeyConfigDto,
  ): Promise<ApiKeyConfig> {
    return await this.apiKeyAuthManager.updateApiKeyConfig(configId, updateDto);
  }

  @Delete('configs/:configId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an API key configuration' })
  @ApiResponse({ status: 204, description: 'API key configuration deleted successfully' })
  @ApiResponse({ status: 404, description: 'API key configuration not found' })
  @ApiParam({ name: 'configId', description: 'API key configuration ID' })
  async deleteConfig(@Param('configId') configId: string): Promise<void> {
    await this.apiKeyAuthManager.deleteApiKeyConfig(configId);
  }

  @Post('configs/:configId/regenerate')
  @ApiOperation({ summary: 'Regenerate an API key' })
  @ApiResponse({ status: 200, description: 'API key regenerated successfully' })
  @ApiResponse({ status: 404, description: 'API key configuration not found' })
  @ApiParam({ name: 'configId', description: 'API key configuration ID' })
  async regenerateApiKey(@Param('configId') configId: string): Promise<{ apiKey: string; config: ApiKeyConfig }> {
    return await this.apiKeyAuthManager.regenerateApiKey(configId);
  }

  @Post('validate')
  @ApiOperation({ summary: 'Validate an API key' })
  @ApiResponse({ status: 200, description: 'API key validation result' })
  @ApiResponse({ status: 400, description: 'Invalid validation request' })
  async validateApiKey(@Body() validationRequest: { apiKey: string; testEndpoint?: string }) {
    return await this.apiKeyAuthManager.validateApiKey(
      validationRequest.apiKey,
      validationRequest.testEndpoint,
    );
  }

  @Post('configs/:configId/validate')
  @ApiOperation({ summary: 'Validate an API key configuration against a test endpoint' })
  @ApiResponse({ status: 200, description: 'Validation result' })
  @ApiResponse({ status: 404, description: 'API key configuration not found' })
  @ApiParam({ name: 'configId', description: 'API key configuration ID' })
  async validateConfig(
    @Param('configId') configId: string,
    @Body() validationRequest: ValidationRequestDto,
  ) {
    // First get the config to retrieve the API key
    const config = await this.apiKeyAuthManager.getApiKeyConfig(configId);
    if (!config) {
      throw new Error('API key configuration not found');
    }

    // Decrypt the API key for validation
    const cryptoService = require('../../services/crypto/crypto.service').CryptoService;
    const crypto = new cryptoService();
    const apiKey = await crypto.decrypt(config.apiKey);

    return await this.apiKeyAuthManager.validateApiKey(apiKey, validationRequest.testEndpoint);
  }
}