# Story 2.2: Dynamic Client Generation Engine - Brownfield Addition

## User Story

As a developer,
I want to automatically generate API clients from imported specifications,
So that I can make API calls without writing manual integration code.

## Story Context

**Existing System Integration:**
- Integrates with: OpenAPI import service (Story 2.1), authentication system, HTTP client infrastructure
- Technology: Node.js backend with template engines, Axios HTTP client, React frontend for client configuration
- Follows pattern: Template generation patterns, HTTP client standards, error handling frameworks
- Touch points: Client generation API, template engine, authentication service, HTTP client wrapper

## Acceptance Criteria

**Functional Requirements:**
1. Generate JavaScript/TypeScript API clients from imported OpenAPI specifications
2. Create request/response templates for each endpoint with proper type definitions
3. Support all HTTP methods (GET, POST, PUT, DELETE, PATCH) with parameter handling
4. Integrate with authentication system for automatic credential injection
5. Provide client configuration options (base URL, timeout, retry logic)

**Integration Requirements:**
4. Existing HTTP client patterns remain unchanged (new generated clients follow same patterns)
5. New functionality follows existing authentication and error handling patterns
6. Integration with specification storage maintains current data access patterns

**Quality Requirements:**
7. Client generation completes within 2 seconds per endpoint
8. Generated clients include comprehensive TypeScript type definitions
9. All generated code follows existing code style and formatting standards
10. Clients handle authentication automatically based on specification requirements

## Technical Notes

- **Integration Approach:** Client generation engine integrates with specification storage and authentication system
- **Existing Pattern Reference:** Follow established HTTP client patterns and authentication integration methods
- **Key Constraints:** Must generate type-safe clients, handle authentication, support various endpoint types

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (client usage guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Generated clients incompatible with target APIs due to specification ambiguities
- **Mitigation:** Implement comprehensive testing with real APIs and fallback to manual configuration
- **Rollback:** Disable automatic generation and provide manual client templates if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing HTTP client patterns
- [ ] Generated clients follow existing authentication patterns
- [ ] Client generation API follows existing REST patterns
- [ ] TypeScript definitions are compatible with existing codebase

## Story Points Estimation

**Estimation:** 8 points
- Client generation engine: 3 points
- Template system with TypeScript: 2 points
- Authentication integration: 2 points
- HTTP client wrapper: 1 point

## Dependencies

- OpenAPI import service (Story 2.1)
- Authentication system foundation
- HTTP client library (Axios)

## Testing Requirements

**Unit Tests:**
- Client generation logic
- Template rendering accuracy
- TypeScript type generation
- Authentication injection

**Integration Tests:**
- End-to-end client generation
- Real API call testing
- Authentication flow testing
- Error handling verification

**Performance Tests:**
- Generation speed by endpoint count
- Memory usage during generation
- Concurrent generation capacity
- Generated client performance

## Implementation Notes

**Client Generator:**
```javascript
class ApiClientGenerator {
  constructor(options) {
    this.templateEngine = options.templateEngine;
    this.typeGenerator = options.typeGenerator;
    this.authIntegrator = options.authIntegrator;
  }
  
  async generateClient(specification, options = {}) {
    const client = {
      name: specification.info.title,
      version: specification.info.version,
      baseUrl: specification.servers[0]?.url || 'https://api.example.com',
      endpoints: [],
      types: {},
      authentication: {}
    };
    
    // Generate endpoints
    for (const [path, pathItem] of Object.entries(specification.paths)) {
      for (const [method, operation] of Object.entries(pathItem)) {
        if (this.isHttpMethod(method)) {
          const endpoint = await this.generateEndpoint(path, method, operation);
          client.endpoints.push(endpoint);
        }
      }
    }
    
    // Generate TypeScript types
    client.types = await this.typeGenerator.generate(specification);
    
    // Integrate authentication
    client.authentication = await this.authIntegrator.integrate(specification);
    
    return client;
  }
  
  async generateEndpoint(path, method, operation) {
    return {
      path,
      method: method.toUpperCase(),
      operationId: operation.operationId,
      summary: operation.summary,
      parameters: this.processParameters(operation.parameters),
      requestBody: this.processRequestBody(operation.requestBody),
      responses: this.processResponses(operation.responses),
      authentication: operation.security
    };
  }
}
```

**TypeScript Type Generator:**
```javascript
class TypeScriptTypeGenerator {
  generate(specification) {
    const types = {};
    
    // Generate types from schemas
    if (specification.components?.schemas) {
      for (const [name, schema] of Object.entries(specification.components.schemas)) {
        types[name] = this.generateTypeFromSchema(name, schema);
      }
    }
    
    return types;
  }
  
  generateTypeFromSchema(name, schema) {
    if (schema.type === 'object' && schema.properties) {
      const properties = Object.entries(schema.properties)
        .map(([propName, propSchema]) => {
          const type = this.getTsType(propSchema);
          const optional = !schema.required?.includes(propName);
          return `  ${propName}${optional ? '?' : ''}: ${type};`;
        })
        .join('\n');
      
      return `export interface ${name} {\n${properties}\n}`;
    }
    
    return `export type ${name} = ${this.getTsType(schema)};`;
  }
  
  getTsType(schema) {
    switch (schema.type) {
      case 'string': return 'string';
      case 'number': case 'integer': return 'number';
      case 'boolean': return 'boolean';
      case 'array': return `${this.getTsType(schema.items)}[]`;
      case 'object': return 'Record<string, any>';
      default: return 'any';
    }
  }
}
```

**Generated Client Template:**
```typescript
// Generated API Client
export class {{clientName}}Client {
  private baseUrl: string;
  private httpClient: AxiosInstance;
  private auth: {{authType}};

  constructor(options: ClientOptions) {
    this.baseUrl = options.baseUrl || '{{defaultBaseUrl}}';
    this.auth = options.auth;
    this.httpClient = axios.create({
      baseURL: this.baseUrl,
      timeout: options.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    });
    
    this.setupAuthentication();
  }

  {{#each endpoints}}
  async {{camelCase operationId}}({{#if parameters}}{{parameterNames}}{{/if}}): Promise<{{responseType}}> {
    const config: AxiosRequestConfig = {
      method: '{{method}}',
      url: `{{path}}`{{#if parameters}},
      {{#each parameters}}
      {{#if this.in.path}}
      params: { {{this.name}} },
      {{/if}}
      {{#if this.in.query}}
      params: { {{this.name}} },
      {{/if}}
      {{/each}}
      {{/if}}
    };

    {{#if requestBody}}
    config.data = requestBody;
    {{/if}}

    try {
      const response = await this.httpClient.request(config);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }
  {{/each}}

  private setupAuthentication() {
    {{#if authentication}}
    this.httpClient.interceptors.request.use((config) => {
      // Add authentication headers
      return config;
    });
    {{/if}}
  }

  private handleError(error: AxiosError): ApiError {
    return {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    };
  }
}
```

**Authentication Integration:**
```javascript
class AuthenticationIntegrator {
  integrate(specification) {
    const auth = {};
    
    if (specification.components?.securitySchemes) {
      for (const [name, scheme] of Object.entries(specification.components.securitySchemes)) {
        auth[name] = this.createAuthConfig(scheme);
      }
    }
    
    return auth;
  }
  
  createAuthConfig(scheme) {
    switch (scheme.type) {
      case 'apiKey':
        return {
          type: 'apiKey',
          name: scheme.name,
          location: scheme.in // header, query, cookie
        };
      case 'http':
        return {
          type: scheme.scheme, // basic, bearer
          bearerFormat: scheme.bearerFormat
        };
      case 'oauth2':
        return {
          type: 'oauth2',
          flows: scheme.flows
        };
      default:
        return { type: 'none' };
    }
  }
}
```

**Error Handling:**
- Generation failures: Detailed error messages with specification location
- Template errors: Fallback to basic client template
- Authentication errors: Clear configuration requirements
- Runtime errors: Standardized error format across all clients

## Success Criteria

- Client generation completes within 2 seconds per endpoint
- Generated TypeScript clients compile without errors
- All HTTP methods and parameter types are supported
- Authentication is automatically configured based on specification
- Generated clients follow existing code style patterns

## Monitoring and Observability

**Metrics to Track:**
- Client generation success rate
- Generation performance by endpoint count
- TypeScript compilation success rate
- Authentication integration success rate

**Alerts:**
- Generation failure rate >5%
- Generation time >5 seconds
- TypeScript compilation errors
- Authentication configuration failures

## Integration Points

**Upstream:**
- Specification storage (parsed OpenAPI specs)
- Authentication service (credential management)

**Downstream:**
- HTTP client infrastructure (Axios configuration)
- Frontend client configuration interface
- Error reporting system (generation failures)

## Generated Client Features

**HTTP Methods:**
- GET, POST, PUT, DELETE, PATCH support
- Query parameter handling
- Path parameter substitution
- Request body serialization

**Authentication:**
- API Key (header, query, cookie)
- HTTP Basic Authentication
- Bearer Token (JWT)
- OAuth2 flows (simplified)

**Type Safety:**
- Request parameter types
- Response body types
- Error response types
- Configuration option types

**Error Handling:**
- Standardized error format
- HTTP status code mapping
- Network error handling
- Timeout and retry logic