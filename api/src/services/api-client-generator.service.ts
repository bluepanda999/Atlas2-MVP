import { logger } from '../utils/logger';
import { OpenApiSpec } from './openapi.service';
import { AppError } from '../utils/errors';

export interface GeneratedClient {
  id: string;
  name: string;
  code: string;
  language: 'typescript' | 'javascript';
  dependencies: string[];
  usage: string;
  metadata: {
    generatedAt: Date;
    specId: string;
    endpointCount: number;
  };
}

export interface ClientGenerationOptions {
  language?: 'typescript' | 'javascript';
  includeAuth?: boolean;
  baseUrl?: string;
  clientName?: string;
}

export class ApiClientGenerator {
  async generateClient(
    spec: OpenApiSpec,
    options: ClientGenerationOptions = {}
  ): Promise<GeneratedClient> {
    try {
      const language = options.language || 'typescript';
      const clientName = options.clientName || this.generateClientName(spec.info.title);
      
      logger.info(`Generating ${language} client for ${spec.info.title}`);

      // Extract endpoints from spec
      const endpoints = this.extractEndpoints(spec);
      
      // Generate client code
      const code = language === 'typescript' 
        ? this.generateTypeScriptClient(spec, endpoints, options)
        : this.generateJavaScriptClient(spec, endpoints, options);

      // Generate usage example
      const usage = this.generateUsageExample(clientName, endpoints.slice(0, 3), options);

      const result: GeneratedClient = {
        id: this.generateId(),
        name: clientName,
        code,
        language,
        dependencies: this.getDependencies(language),
        usage,
        metadata: {
          generatedAt: new Date(),
          specId: spec.info.title, // In real implementation, use actual spec ID
          endpointCount: endpoints.length
        }
      };

      logger.info(`Successfully generated ${language} client with ${endpoints.length} endpoints`);
      return result;

    } catch (error) {
      logger.error('API client generation failed:', error);
      throw new AppError('Failed to generate API client', 500, error);
    }
  }

  private extractEndpoints(spec: OpenApiSpec): Array<{
    path: string;
    method: string;
    operationId?: string;
    summary?: string;
    parameters?: any[];
    requestBody?: any;
    responses?: any;
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
              operationId: (operation as any).operationId || `${method}${path.replace(/[^a-zA-Z0-9]/g, '')}`,
              summary: (operation as any).summary,
              parameters: (operation as any).parameters,
              requestBody: (operation as any).requestBody,
              responses: (operation as any).responses
            });
          }
        });
      }
    });

    return endpoints;
  }

  private generateTypeScriptClient(
    spec: OpenApiSpec,
    endpoints: any[],
    options: ClientGenerationOptions
  ): string {
    const clientName = options.clientName || this.generateClientName(spec.info.title);
    const baseUrl = options.baseUrl || (spec.servers?.[0]?.url) || 'https://api.example.com';
    
    // Generate interfaces
    const interfaces = this.generateTypeScriptInterfaces(endpoints);
    
    // Generate methods
    const methods = endpoints.map(endpoint => this.generateTypeScriptMethod(endpoint)).join('\n\n');

    return `// Generated API Client for ${spec.info.title}
// Generated at: ${new Date().toISOString()}
// OpenAPI Version: ${spec.openapi || spec.swagger}

${interfaces}

export interface ${clientName}Config {
  baseUrl?: string;
  apiKey?: string;
  timeout?: number;
}

export class ${clientName} {
  private baseUrl: string;
  private apiKey?: string;
  private timeout: number;

  constructor(config: ${clientName}Config = {}) {
    this.baseUrl = config.baseUrl || '${baseUrl}';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  private async request<T = any>(
    method: string,
    path: string,
    data?: any,
    options?: RequestInit
  ): Promise<T> {
    const url = \`\${this.baseUrl}\${path}\`;
    
    const config: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': \`Bearer \${this.apiKey}\` }),
        ...options?.headers
      },
      ...options
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(\`API request failed: \${error.message}\`);
    }
  }

${methods}
}

// Export singleton instance
export const ${clientName.toLowerCase()}Client = new ${clientName}();

// Export types
export type {
  ${endpoints.map(e => `${this.getMethodName(e)}Response`).join(',\n  ')}
};
`;
  }

  private generateJavaScriptClient(
    spec: OpenApiSpec,
    endpoints: any[],
    options: ClientGenerationOptions
  ): string {
    const clientName = options.clientName || this.generateClientName(spec.info.title);
    const baseUrl = options.baseUrl || (spec.servers?.[0]?.url) || 'https://api.example.com';
    
    const methods = endpoints.map(endpoint => this.generateJavaScriptMethod(endpoint)).join('\n\n');

    return `// Generated API Client for ${spec.info.title}
// Generated at: ${new Date().toISOString()}
// OpenAPI Version: ${spec.openapi || spec.swagger}

class ${clientName} {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || '${baseUrl}';
    this.apiKey = config.apiKey;
    this.timeout = config.timeout || 30000;
  }

  async request(method, path, data, options = {}) {
    const url = \`\${this.baseUrl}\${path}\`;
    
    const config = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': \`Bearer \${this.apiKey}\` }),
        ...options.headers
      },
      ...options
    };

    if (data && method !== 'GET') {
      config.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}: \${response.statusText}\`);
      }

      return await response.json();
    } catch (error) {
      throw new Error(\`API request failed: \${error.message}\`);
    }
  }

${methods}
}

// Export singleton instance
const ${clientName.toLowerCase()}Client = new ${clientName}();

// Export for both CommonJS and ES modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ${clientName}, ${clientName.toLowerCase()}Client };
} else {
  window.${clientName} = ${clientName};
  window.${clientName.toLowerCase()}Client = ${clientName.toLowerCase()}Client;
}
`;
  }

  private generateTypeScriptInterfaces(endpoints: any[]): string {
    // For POC, generate basic interfaces
    return `
// Basic response types
export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
}

// Error response
export interface ErrorResponse {
  error: string;
  message?: string;
  details?: any;
}
`;
  }

  private generateTypeScriptMethod(endpoint: any): string {
    const methodName = this.getMethodName(endpoint);
    const pathParam = this.getPathParams(endpoint);
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
    const returnType = 'Promise<any>';

    return `  /**
   * ${endpoint.summary || `${endpoint.method} ${endpoint.path}`}
   */
  async ${methodName}(${pathParam}${hasBody ? 'data?: any' : ''}): ${returnType} {
    const path = \`${this.interpolatePath(endpoint.path)}\`;
    return this.request('${endpoint.method}', path${hasBody ? ', data' : ''});
  }`;
  }

  private generateJavaScriptMethod(endpoint: any): string {
    const methodName = this.getMethodName(endpoint);
    const pathParam = this.getPathParams(endpoint);
    const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);

    return `  /**
   * ${endpoint.summary || `${endpoint.method} ${endpoint.path}`}
   */
  async ${methodName}(${pathParam}${hasBody ? 'data' : ''}) {
    const path = \`${this.interpolatePath(endpoint.path)}\`;
    return this.request('${endpoint.method}', path${hasBody ? ', data' : ''});
  }`;
  }

  private getMethodName(endpoint: any): string {
    if (endpoint.operationId) {
      return endpoint.operationId.charAt(0).toLowerCase() + endpoint.operationId.slice(1);
    }
    
    const method = endpoint.method.toLowerCase();
    const path = endpoint.path.replace(/[^a-zA-Z0-9]/g, '');
    return `${method}${path.charAt(0).toUpperCase() + path.slice(1)}`;
  }

  private getPathParams(endpoint: any): string {
    if (!endpoint.parameters) return '';
    
    const pathParams = endpoint.parameters
      .filter((p: any) => p.in === 'path')
      .map((p: any) => `${p.name}: string | number`)
      .join(', ');
    
    return pathParams ? `${pathParams}, ` : '';
  }

  private interpolatePath(path: string): string {
    return path.replace(/\{([^}]+)\}/g, '${$1}');
  }

  private generateUsageExample(clientName: string, endpoints: any[], options: ClientGenerationOptions): string {
    const examples = endpoints.slice(0, 3).map(endpoint => {
      const methodName = this.getMethodName(endpoint);
      const pathParams = endpoint.parameters
        ?.filter((p: any) => p.in === 'path')
        ?.map((p: any) => `${p.name}: 'example'`)
        ?.join(', ') || '';
      
      const hasBody = ['POST', 'PUT', 'PATCH'].includes(endpoint.method);
      const dataArg = hasBody ? ', { example: "data" }' : '';
      
      return `// ${endpoint.summary || `${endpoint.method} ${endpoint.path}`}
await client.${methodName}(${pathParams}${dataArg});`;
    }).join('\n');

    return `// Usage Example for ${clientName}
import { ${clientName}, ${clientName.toLowerCase()}Client } from './${clientName.toLowerCase()}';

// Using the singleton instance
const client = ${clientName.toLowerCase()}Client;

// Configure with API key if needed
const authenticatedClient = new ${clientName}({
  baseUrl: 'https://api.example.com',
  apiKey: 'your-api-key-here'
});

${examples}

// Error handling
try {
  const result = await client.${this.getMethodName(endpoints[0])}();
  console.log('Success:', result);
} catch (error) {
  console.error('API Error:', error.message);
}`;
  }

  private getDependencies(language: string): string[] {
    if (language === 'typescript') {
      return ['typescript', '@types/node'];
    }
    return [];
  }

  private generateClientName(title: string): string {
    const sanitized = title.replace(/[^a-zA-Z0-9]/g, '');
    return `${sanitized}ApiClient`;
  }

  private generateId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}