import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface OpenApiSpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  paths: Record<string, any>;
  components?: {
    schemas?: Record<string, any>;
    securitySchemes?: Record<string, any>;
  };
  security?: any[];
  servers?: Array<{
    url: string;
    description?: string;
  }>;
}

export interface ImportResult {
  id: string;
  spec: OpenApiSpec;
  summary: {
    endpointCount: number;
    authTypes: string[];
    title: string;
    version: string;
    warnings: string[];
  };
  metadata: {
    importDate: Date;
    source: 'url' | 'file' | 'text';
    size: number;
  };
}

export interface ImportOptions {
  source: 'url' | 'file' | 'text';
  content: string;
  format?: 'openapi' | 'swagger';
}

export class OpenApiService {
  private supportedVersions = ['3.0.0', '3.0.1', '3.0.2', '3.0.3', '3.1.0', '2.0'];

  async importSpecification(options: ImportOptions): Promise<ImportResult> {
    try {
      logger.info(`Starting OpenAPI import from ${options.source}`);
      
      // Step 1: Fetch specification content
      let specContent: string;
      if (options.source === 'url') {
        specContent = await this.fetchFromUrl(options.content);
      } else {
        specContent = options.content;
      }

      // Step 2: Parse specification
      const spec = this.parseSpecification(specContent);
      
      // Step 3: Validate specification
      this.validateSpecification(spec);
      
      // Step 4: Extract summary information
      const summary = this.extractSummary(spec);
      
      // Step 5: Generate result
      const result: ImportResult = {
        id: this.generateId(),
        spec,
        summary,
        metadata: {
          importDate: new Date(),
          source: options.source,
          size: specContent.length
        }
      };

      logger.info(`Successfully imported OpenAPI spec: ${summary.title} with ${summary.endpointCount} endpoints`);
      return result;

    } catch (error) {
      logger.error('OpenAPI import failed:', error);
      throw new AppError('Failed to import OpenAPI specification', 400, error);
    }
  }

  private async fetchFromUrl(url: string): Promise<string> {
    try {
      const response = await fetch(url, {
        timeout: 10000, // 10 second timeout
        headers: {
          'User-Agent': 'Atlas2-OpenAPI-Importer/1.0'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.text();
    } catch (error) {
      throw new AppError(`Failed to fetch OpenAPI spec from URL: ${error.message}`, 400, error);
    }
  }

  private parseSpecification(content: string): OpenApiSpec {
    try {
      // Try JSON first
      if (content.trim().startsWith('{')) {
        return JSON.parse(content);
      }
      
      // Try YAML (simplified for POC - in production, use js-yaml)
      if (content.includes('openapi:') || content.includes('swagger:')) {
        throw new AppError('YAML support not implemented in POC - please use JSON format', 400);
      }
      
      throw new AppError('Invalid specification format - must be JSON or YAML', 400);
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError('Failed to parse OpenAPI specification - invalid JSON', 400, error);
    }
  }

  private validateSpecification(spec: OpenApiSpec): void {
    const warnings: string[] = [];

    // Check required fields
    if (!spec.info) {
      throw new AppError('Missing required field: info', 400);
    }
    
    if (!spec.info.title) {
      throw new AppError('Missing required field: info.title', 400);
    }
    
    if (!spec.info.version) {
      throw new AppError('Missing required field: info.version', 400);
    }

    if (!spec.paths || Object.keys(spec.paths).length === 0) {
      throw new AppError('Missing or empty paths field', 400);
    }

    // Check version compatibility
    const version = spec.openapi || spec.swagger;
    if (!version) {
      throw new AppError('Missing OpenAPI/Swagger version', 400);
    }

    if (!this.supportedVersions.some(v => version.startsWith(v.replace(/\.\d+$/, '')))) {
      warnings.push(`Unsupported version: ${version}. Supported versions: ${this.supportedVersions.join(', ')}`);
    }

    // Check for security schemes
    if (spec.components?.securitySchemes) {
      const authTypes = Object.keys(spec.components.securitySchemes);
      if (authTypes.length === 0) {
        warnings.push('No authentication schemes defined');
      }
    } else if (spec.security) {
      warnings.push('Global security defined but no security schemes found');
    } else {
      warnings.push('No authentication defined - APIs may require authentication');
    }

    // Store warnings in spec for later retrieval
    (spec as any)._warnings = warnings;
  }

  private extractSummary(spec: OpenApiSpec): ImportResult['summary'] {
    let endpointCount = 0;
    const authTypes: string[] = [];
    const warnings = (spec as any)._warnings || [];

    // Count endpoints
    Object.values(spec.paths).forEach(pathItem => {
      if (typeof pathItem === 'object') {
        Object.keys(pathItem).forEach(method => {
          if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method)) {
            endpointCount++;
          }
        });
      }
    });

    // Extract authentication types
    if (spec.components?.securitySchemes) {
      Object.values(spec.components.securitySchemes).forEach(scheme => {
        if (typeof scheme === 'object' && scheme.type) {
          authTypes.push(scheme.type);
        }
      });
    }

    return {
      endpointCount,
      authTypes: [...new Set(authTypes)], // Remove duplicates
      title: spec.info.title,
      version: spec.info.version,
      warnings
    };
  }

  private generateId(): string {
    return `spec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Helper method to extract endpoints for client generation
  extractEndpoints(spec: OpenApiSpec): Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    parameters?: any[];
    requestBody?: any;
    responses?: any;
    security?: any[];
  }> {
    const endpoints: any[] = [];

    Object.entries(spec.paths).forEach(([path, pathItem]) => {
      if (typeof pathItem === 'object') {
        Object.entries(pathItem).forEach(([method, operation]) => {
          if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method) &&
              typeof operation === 'object') {
            
            endpoints.push({
              path,
              method: method.toUpperCase(),
              operationId: (operation as any).operationId,
              summary: (operation as any).summary,
              parameters: (operation as any).parameters,
              requestBody: (operation as any).requestBody,
              responses: (operation as any).responses,
              security: (operation as any).security
            });
          }
        });
      }
    });

    return endpoints;
  }
}