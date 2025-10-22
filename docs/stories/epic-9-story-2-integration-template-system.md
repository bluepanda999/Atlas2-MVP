# Story 9.2: Integration Template System - Brownfield Addition

## User Story

As a developer,
I want to use reusable integration templates for common API patterns,
So that I can quickly configure integrations without starting from scratch.

## Story Context

**Existing System Integration:**

- Integrates with: OpenAPI client generation (Epic 2), pre-built integration catalog (Story 9.1), authentication system (Epic 4), field mapping system
- Technology: Node.js backend with Express.js, React frontend with TypeScript, JSON Schema validation, template engine
- Follows pattern: Configuration-driven development, schema validation, React form patterns, error handling standards
- Touch points: Template service API, template configuration UI, client generation service, field mapping interface, authentication system

## Acceptance Criteria

**Functional Requirements:**

1. Create and manage integration templates for common patterns (CRUD operations, authentication flows, data transformation, webhook handling)
2. Apply templates to new integrations with customizable configuration parameters
3. Support template inheritance and composition for complex integration scenarios
4. Validate template configurations using JSON Schema with real-time feedback
5. Preview generated API clients and authentication setups before applying templates

**Integration Requirements:** 4. Existing client generation functionality remains unchanged (templates enhance, don't replace) 5. New functionality follows existing configuration and validation patterns 6. Integration with field mapping system maintains current data transformation patterns 7. Template system uses existing authentication methods and security patterns

**Quality Requirements:** 7. Template application completes within 2 seconds including validation 8. Template validation provides clear, actionable error messages 9. Generated integrations maintain 95%+ compatibility with target APIs 10. All templates include comprehensive documentation and usage examples

## Technical Notes

- **Integration Approach:** Template system extends existing client generation with pattern-based configuration and validation
- **Existing Pattern Reference:** Follow established JSON Schema validation, React form patterns, and configuration management
- **Key Constraints:** Must support flexible template composition, maintain security, integrate with existing field mapping

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested (client generation, field mapping, authentication)
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (template creation guide, API docs)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Template complexity leading to configuration errors or invalid client generation
- **Mitigation:** Comprehensive schema validation, template testing framework, clear error messages
- **Rollback:** Disable template system and fall back to manual client configuration if issues occur

**Compatibility Verification:**

- [ ] No breaking changes to existing client generation APIs
- [ ] Database changes are additive only (new templates tables)
- [ ] Template service follows existing microservice patterns
- [ ] Configuration validation follows existing schema patterns

## Story Points Estimation

**Estimation:** 13 points

- Template engine and validation: 4 points
- Template database and models: 3 points
- React template configuration UI: 3 points
- Template application workflow: 2 points
- Template inheritance system: 1 point

## Dependencies

- OpenAPI client generation (Epic 2)
- Pre-built integration catalog (Story 9.1)
- Authentication system (Epic 4)
- Field mapping system
- JSON Schema validation framework

## Testing Requirements

**Unit Tests:**

- Template engine logic
- Schema validation rules
- Template inheritance algorithms
- Configuration processing

**Integration Tests:**

- End-to-end template application
- Client generation from templates
- Field mapping integration
- Authentication configuration

**Performance Tests:**

- Template application speed
- Validation performance
- Concurrent template usage
- Memory usage during processing

## Implementation Notes

**Template System Service:**

```typescript
interface TemplateService {
  getTemplates(category?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<TemplateDetail>;
  createTemplate(template: CreateTemplateRequest): Promise<Template>;
  applyTemplate(
    templateId: string,
    config: TemplateConfig,
  ): Promise<TemplateResult>;
  validateTemplate(
    templateId: string,
    config: TemplateConfig,
  ): Promise<ValidationResult>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: string;
  schema: JSONSchema;
  authenticationTypes: AuthType[];
  features: string[];
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

interface TemplateDetail extends Template {
  configuration: TemplateConfiguration;
  examples: TemplateExample[];
  documentation: string;
  dependencies: string[];
  inheritance: TemplateInheritance;
}

interface TemplateConfiguration {
  parameters: TemplateParameter[];
  authentication: AuthenticationConfig;
  endpoints: EndpointTemplate[];
  transformations: TransformationTemplate[];
  errorHandling: ErrorHandlingConfig;
}

interface TemplateParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: any;
  description: string;
  validation?: ValidationRule[];
}

enum TemplateCategory {
  CRUD = "crud",
  AUTHENTICATION = "authentication",
  TRANSFORMATION = "transformation",
  WEBHOOK = "webhook",
  BATCH = "batch",
  REALTIME = "realtime",
}
```

**Template Engine Implementation:**

```typescript
class TemplateEngine {
  async applyTemplate(
    templateId: string,
    config: TemplateConfig,
  ): Promise<TemplateResult> {
    // Load template
    const template = await this.templateService.getTemplate(templateId);

    // Validate configuration
    const validation = await this.validateConfiguration(
      template.schema,
      config,
    );
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    // Process template inheritance
    const processedTemplate = await this.processInheritance(template);

    // Generate OpenAPI specification
    const openApiSpec = await this.generateOpenAPISpec(
      processedTemplate,
      config,
    );

    // Generate client configuration
    const clientConfig = await this.generateClientConfig(
      processedTemplate,
      config,
    );

    // Apply authentication configuration
    const authConfig = await this.configureAuthentication(
      processedTemplate,
      config,
    );

    return {
      openApiSpec,
      clientConfig,
      authConfig,
      endpoints: this.generateEndpoints(processedTemplate, config),
      transformations: this.generateTransformations(processedTemplate, config),
    };
  }

  private async generateOpenAPISpec(
    template: TemplateDetail,
    config: TemplateConfig,
  ): Promise<OpenAPISpec> {
    const spec: OpenAPISpec = {
      openapi: "3.0.3",
      info: {
        title: config.name || `${template.name} Integration`,
        version: config.version || "1.0.0",
        description: config.description || template.description,
      },
      servers: this.generateServers(template, config),
      paths: {},
      components: {
        schemas: {},
        securitySchemes: this.generateSecuritySchemes(template, config),
      },
    };

    // Generate endpoints from template
    for (const endpointTemplate of template.configuration.endpoints) {
      const path = this.processTemplateString(endpointTemplate.path, config);
      const method = endpointTemplate.method;

      spec.paths[path] = {
        [method]: {
          summary: this.processTemplateString(endpointTemplate.summary, config),
          description: this.processTemplateString(
            endpointTemplate.description,
            config,
          ),
          parameters: this.generateParameters(
            endpointTemplate.parameters,
            config,
          ),
          requestBody: this.generateRequestBody(
            endpointTemplate.requestBody,
            config,
          ),
          responses: this.generateResponses(endpointTemplate.responses, config),
          security: this.generateSecurity(endpointTemplate.security, config),
        },
      };
    }

    return spec;
  }

  private processTemplateString(
    template: string,
    config: TemplateConfig,
  ): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      const value = this.getNestedValue(config, path);
      return value !== undefined ? String(value) : match;
    });
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }
}
```

**Template API Endpoints:**

```typescript
// GET /api/marketplace/templates
app.get("/api/marketplace/templates", async (req, res) => {
  try {
    const { category } = req.query;

    const templates = await templateService.getTemplates(category as string);

    res.json({
      templates,
      categories: Object.values(TemplateCategory),
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch templates",
      details: error.message,
    });
  }
});

// POST /api/marketplace/templates/:id/apply
app.post("/api/marketplace/templates/:id/apply", async (req, res) => {
  try {
    const { id } = req.params;
    const { configuration, name } = req.body;

    // Validate template configuration
    const validation = await templateService.validateTemplate(
      id,
      configuration,
    );
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid configuration",
        details: validation.errors,
      });
    }

    // Apply template
    const result = await templateService.applyTemplate(id, {
      ...configuration,
      name: name || `Template Integration`,
      userId: req.user.id,
    });

    // Generate client using existing client generation service
    const client = await clientGenerationService.generateClient(
      result.openApiSpec,
      {
        name: result.clientConfig.name,
        userId: req.user.id,
      },
    );

    res.json({
      success: true,
      clientId: client.id,
      templateResult: result,
      message: "Template applied successfully",
    });
  } catch (error) {
    res.status(500).json({
      error: "Template application failed",
      details: error.message,
    });
  }
});

// POST /api/marketplace/templates/:id/validate
app.post("/api/marketplace/templates/:id/validate", async (req, res) => {
  try {
    const { id } = req.params;
    const { configuration } = req.body;

    const validation = await templateService.validateTemplate(
      id,
      configuration,
    );

    res.json({
      valid: validation.valid,
      errors: validation.errors,
      warnings: validation.warnings,
    });
  } catch (error) {
    res.status(500).json({
      error: "Validation failed",
      details: error.message,
    });
  }
});
```

**React Template Configuration Component:**

```typescript
const TemplateConfiguration: React.FC<{ templateId: string }> = ({ templateId }) => {
  const [template, setTemplate] = useState<TemplateDetail | null>(null);
  const [configuration, setConfiguration] = useState<Record<string, any>>({});
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const form = Form.useForm();

  useEffect(() => {
    loadTemplate();
  }, [templateId]);

  const loadTemplate = async () => {
    try {
      const response = await api.get(`/marketplace/templates/${templateId}`);
      setTemplate(response.data);

      // Set default values
      const defaults = {};
      response.data.configuration.parameters.forEach(param => {
        if (param.default !== undefined) {
          defaults[param.name] = param.default;
        }
      });
      setConfiguration(defaults);
      form.setFieldsValue(defaults);
    } catch (error) {
      message.error('Failed to load template');
    }
  };

  const handleFieldChange = async (field: string, value: any) => {
    const newConfig = { ...configuration, [field]: value };
    setConfiguration(newConfig);

    // Validate configuration
    try {
      const response = await api.post(`/marketplace/templates/${templateId}/validate`, {
        configuration: newConfig
      });
      setValidation(response.data);
    } catch (error) {
      // Validation errors are expected
    }
  };

  const handleApply = async () => {
    try {
      setLoading(true);

      const response = await api.post(`/marketplace/templates/${templateId}/apply`, {
        configuration,
        name: `${template?.name} Integration`
      });

      message.success('Template applied successfully');
      // Navigate to the generated client
      history.push(`/integrations/${response.data.clientId}`);
    } catch (error) {
      message.error('Failed to apply template');
    } finally {
      setLoading(false);
    }
  };

  if (!template) return <Spin size="large" />;

  return (
    <div className="template-configuration">
      <Card title={`Configure ${template.name}`} style={{ marginBottom: 16 }}>
        <Paragraph>{template.description}</Paragraph>

        <Form
          form={form}
          layout="vertical"
          onValuesChange={(changedValues) => {
            Object.entries(changedValues).forEach(([field, value]) => {
              handleFieldChange(field, value);
            });
          }}
        >
          {template.configuration.parameters.map(param => (
            <Form.Item
              key={param.name}
              name={param.name}
              label={param.name}
              required={param.required}
              help={param.description}
              validateStatus={validation?.errors.find(e => e.field === param.name) ? 'error' : ''}
              help={validation?.errors.find(e => e.field === param.name)?.message}
            >
              {renderFormField(param)}
            </Form.Item>
          ))}
        </Form>

        <div style={{ marginTop: 24 }}>
          <Space>
            <Button
              type="primary"
              onClick={handleApply}
              loading={loading}
              disabled={!validation?.valid}
            >
              Apply Template
            </Button>
            <Button onClick={() => form.resetFields()}>
              Reset
            </Button>
          </Space>
        </div>
      </Card>

      {validation && (
        <Card title="Validation Results" style={{ marginBottom: 16 }}>
          {validation.valid ? (
            <Alert
              message="Configuration is valid"
              type="success"
              showIcon
            />
          ) : (
            <Alert
              message="Configuration has errors"
              description={
                <ul>
                  {validation.errors.map((error, index) => (
                    <li key={index}>{error.field}: {error.message}</li>
                  ))}
                </ul>
              }
              type="error"
              showIcon
            />
          )}

          {validation.warnings.length > 0 && (
            <Alert
              message="Warnings"
              description={
                <ul>
                  {validation.warnings.map((warning, index) => (
                    <li key={index}>{warning.field}: {warning.message}</li>
                  ))}
                </ul>
              }
              type="warning"
              showIcon
              style={{ marginTop: 8 }}
            />
          )}
        </Card>
      )}
    </div>
  );
};
```

**Database Schema:**

```sql
-- Templates table
CREATE TABLE integration_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(50) NOT NULL,
  version VARCHAR(50) NOT NULL,
  schema JSONB NOT NULL,
  configuration JSONB NOT NULL,
  authentication_types VARCHAR(50)[] NOT NULL,
  features TEXT[],
  examples JSONB,
  documentation TEXT,
  dependencies TEXT[],
  inheritance JSONB,
  is_built_in BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Template applications tracking
CREATE TABLE template_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES integration_templates(id),
  user_id UUID NOT NULL REFERENCES users(id),
  configuration JSONB NOT NULL,
  result JSONB NOT NULL,
  client_id UUID NOT NULL REFERENCES api_clients(id),
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_integration_templates_category ON integration_templates(category);
CREATE INDEX idx_integration_templates_active ON integration_templates(is_active);
CREATE INDEX idx_template_applications_template ON template_applications(template_id);
CREATE INDEX idx_template_applications_user ON template_applications(user_id);
```

**Built-in Templates:**

**1. CRUD Operations Template:**

```json
{
  "name": "RESTful CRUD Operations",
  "description": "Standard Create, Read, Update, Delete operations for REST APIs",
  "category": "crud",
  "parameters": [
    {
      "name": "baseUrl",
      "type": "string",
      "required": true,
      "description": "Base URL for the API"
    },
    {
      "name": "resourceName",
      "type": "string",
      "required": true,
      "description": "Name of the resource (e.g., 'users', 'products')"
    },
    {
      "name": "idField",
      "type": "string",
      "default": "id",
      "description": "Field name for the resource identifier"
    }
  ],
  "endpoints": [
    {
      "method": "get",
      "path": "/{{resourceName}}",
      "summary": "List all {{resourceName}}",
      "description": "Retrieve a list of all {{resourceName}} resources"
    },
    {
      "method": "post",
      "path": "/{{resourceName}}",
      "summary": "Create {{resourceName}}",
      "description": "Create a new {{resourceName}} resource"
    },
    {
      "method": "get",
      "path": "/{{resourceName}}/{{id}}",
      "summary": "Get {{resourceName}} by ID",
      "description": "Retrieve a specific {{resourceName}} by its {{idField}}"
    },
    {
      "method": "put",
      "path": "/{{resourceName}}/{{id}}",
      "summary": "Update {{resourceName}}",
      "description": "Update a specific {{resourceName}} by its {{idField}}"
    },
    {
      "method": "delete",
      "path": "/{{resourceName}}/{{id}}",
      "summary": "Delete {{resourceName}}",
      "description": "Delete a specific {{resourceName}} by its {{idField}}"
    }
  ]
}
```

**2. OAuth2 Authentication Template:**

```json
{
  "name": "OAuth2 Authentication",
  "description": "OAuth2 authentication flow with token management",
  "category": "authentication",
  "parameters": [
    {
      "name": "authUrl",
      "type": "string",
      "required": true,
      "description": "OAuth2 authorization URL"
    },
    {
      "name": "tokenUrl",
      "type": "string",
      "required": true,
      "description": "OAuth2 token URL"
    },
    {
      "name": "clientId",
      "type": "string",
      "required": true,
      "description": "OAuth2 client ID"
    },
    {
      "name": "scopes",
      "type": "array",
      "default": [],
      "description": "OAuth2 scopes to request"
    }
  ],
  "authentication": {
    "type": "oauth2",
    "flow": "authorizationCode",
    "authorizationUrl": "{{authUrl}}",
    "tokenUrl": "{{tokenUrl}}",
    "scopes": "{{scopes}}"
  }
}
```

## Success Criteria

- 10+ built-in templates available at launch covering common integration patterns
- Template application completes within 2 seconds
- Configuration validation provides clear, actionable error messages
- Generated integrations maintain 95%+ compatibility with target APIs
- Template inheritance and composition work for complex scenarios

## Monitoring and Observability

**Metrics to Track:**

- Template usage frequency and popularity
- Template application success rate
- Configuration validation error patterns
- Template performance benchmarks
- User-created template quality metrics

**Alerts:**

- Template application success rate <90%
- Template validation performance degradation
- Template generation failures >5%
- Database query performance issues

## Integration Points

**Upstream:**

- Template configuration UI (user input)
- Authentication system (user verification)

**Downstream:**

- Client generation service (integration creation)
- Field mapping system (data transformation)
- Metadata database (template storage)

## Security Considerations

**Template Security:**

- All templates undergo security review before publication
- Template configurations validated against injection attacks
- Authentication credentials handled securely using existing system
- Template inheritance prevents privilege escalation
- Audit logging for all template applications

**Data Protection:**

- Template configurations encrypted at rest
- Sensitive parameters masked in UI
- Access control follows existing user permissions
- Input validation and sanitization for all parameters
- Secure transmission of template data
