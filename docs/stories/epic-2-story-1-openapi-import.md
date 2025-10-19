# Story 2.1: OpenAPI Specification Import - Brownfield Addition

## User Story

As a developer,
I want to import OpenAPI 3.x and Swagger 2.0 specifications through a validation service,
So that I can automatically generate API clients without manual configuration.

## Story Context

**Existing System Integration:**
- Integrates with: CSV processing pipeline (Epic 1), validation framework, metadata storage
- Technology: Node.js backend with OpenAPI parsing libraries, React frontend for import interface
- Follows pattern: RESTful API design, validation frameworks, error handling standards
- Touch points: Specification import API, validation service, metadata database, frontend import component

## Acceptance Criteria

**Functional Requirements:**
1. Import OpenAPI 3.x and Swagger 2.0 specifications from URL, file upload, or raw text
2. Validate specification syntax and structure with detailed error reporting
3. Extract and categorize endpoints, parameters, and authentication requirements
4. Support specification references ($ref) resolution including external files
5. Generate import summary with endpoint count, authentication types, and compatibility warnings

**Integration Requirements:**
4. Existing APIs remain unchanged (new specification import endpoints only)
5. New functionality follows existing validation and error handling patterns
6. Integration with metadata storage maintains current database patterns

**Quality Requirements:**
7. Specification parsing completes within 5 seconds for complex specifications
8. Validation provides clear, actionable error messages with line numbers
9. Import handles 95%+ of real-world OpenAPI specifications
10. Reference resolution works for external files up to 3 levels deep

## Technical Notes

- **Integration Approach:** Specification import service integrates with validation framework and metadata storage
- **Existing Pattern Reference:** Follow established API response formats and validation error patterns
- **Key Constraints:** Must handle various specification formats, resolve references, provide detailed validation

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (API docs, import guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Malicious or malformed specifications causing parsing failures
- **Mitigation:** Implement input validation, size limits, and sandboxed parsing environment
- **Rollback:** Disable import service and fall back to manual specification entry if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing APIs
- [ ] Database changes are additive only (new specifications table)
- [ ] Import service follows existing microservice patterns
- [ ] Validation errors follow existing response format

## Story Points Estimation

**Estimation:** 8 points
- OpenAPI parsing engine: 3 points
- Validation and error reporting: 2 points
- Reference resolution: 2 points
- Import interface and summary: 1 point

## Dependencies

- CSV processing pipeline (data source context)
- Validation framework foundation
- Metadata database schema

## Testing Requirements

**Unit Tests:**
- OpenAPI parsing logic
- Validation rule engine
- Reference resolution algorithms
- Error message generation

**Integration Tests:**
- End-to-end import workflow
- External reference resolution
- Large specification handling
- Error recovery scenarios

**Performance Tests:**
- Parsing speed with various specification sizes
- Memory usage during parsing
- Concurrent import capacity
- Reference resolution performance

## Implementation Notes

**Specification Parser:**
```javascript
class OpenApiParser {
  constructor() {
    this.supportedVersions = ['3.0.0', '3.0.1', '3.0.2', '3.0.3', '3.1.0', '2.0'];
  }
  
  async parse(specification, options = {}) {
    // Validate version compatibility
    // Resolve references
    // Extract endpoints and metadata
    // Validate structure
    return {
      endpoints: this.extractEndpoints(specification),
      authentication: this.extractAuthentication(specification),
      metadata: this.extractMetadata(specification),
      warnings: this.generateWarnings(specification)
    };
  }
}
```

**Import API:**
```javascript
app.post('/api/specs/import', async (req, res) => {
  try {
    const { source, type } = req.body; // source: url/file/text, type: openapi/swagger
    
    let specification;
    if (type === 'url') {
      specification = await fetchFromUrl(source);
    } else if (type === 'file') {
      specification = await readUploadedFile(source);
    } else {
      specification = source; // raw text
    }
    
    const parser = new OpenApiParser();
    const result = await parser.parse(specification);
    
    // Save to database
    const specId = await saveSpecification(result);
    
    res.json({
      id: specId,
      summary: {
        endpointCount: result.endpoints.length,
        authTypes: result.authentication.types,
        warnings: result.warnings.length
      }
    });
  } catch (error) {
    res.status(400).json({
      error: 'Specification import failed',
      details: error.message,
      line: error.line
    });
  }
});
```

**Reference Resolution:**
```javascript
class ReferenceResolver {
  constructor(basePath) {
    this.basePath = basePath;
    this.cache = new Map();
  }
  
  async resolve(specification) {
    const resolved = JSON.parse(JSON.stringify(specification));
    
    // Find all $ref references
    const references = this.findReferences(resolved);
    
    // Resolve each reference
    for (const ref of references) {
      const resolvedValue = await this.resolveReference(ref);
      this.replaceReference(resolved, ref, resolvedValue);
    }
    
    return resolved;
  }
  
  async resolveReference(ref) {
    if (this.cache.has(ref)) {
      return this.cache.get(ref);
    }
    
    // Handle local vs external references
    if (ref.startsWith('#/')) {
      // Local reference
      return this.resolveLocalReference(ref);
    } else {
      // External reference
      return this.resolveExternalReference(ref);
    }
  }
}
```

**Validation Rules:**
```javascript
const validationRules = [
  {
    name: 'required_fields',
    validate: (spec) => spec.openapi && spec.info && spec.paths,
    message: 'Missing required OpenAPI fields (openapi, info, paths)'
  },
  {
    name: 'version_compatibility',
    validate: (spec) => supportedVersions.includes(spec.openapi),
    message: 'Unsupported OpenAPI version'
  },
  {
    name: 'endpoint_structure',
    validate: (spec) => this.validateEndpoints(spec.paths),
    message: 'Invalid endpoint structure'
  }
];
```

**Error Handling:**
- Invalid JSON/YAML: 400 Bad Request with syntax error details
- Unsupported version: 422 Unprocessable Entity with supported versions
- Reference resolution failure: 400 Bad Request with reference path
- Network errors (URL import): 502 Bad Gateway with retry suggestion

## Success Criteria

- 95%+ of real-world OpenAPI specifications import successfully
- Parsing completes within 5 seconds for complex specifications
- Validation errors include line numbers and clear descriptions
- Reference resolution works for external files up to 3 levels deep
- Import summary provides accurate endpoint and authentication information

## Monitoring and Observability

**Metrics to Track:**
- Import success rate by specification type
- Parsing performance by specification size
- Reference resolution success rate
- Validation error categories

**Alerts:**
- Import success rate <90%
- Parsing time >10 seconds
- Reference resolution failures >10%
- Memory usage during parsing >200MB

## Integration Points

**Upstream:**
- Frontend import interface (specification source)
- File upload service (specification files)

**Downstream:**
- Client generation engine (parsed specification)
- Metadata database (specification storage)
- Validation service (error reporting)

## Supported Features

**OpenAPI 3.x Features:**
- All HTTP methods and parameters
- Request/response schemas
- Authentication methods (API Key, Bearer, OAuth2)
- Server variables and URLs
- Component references

**Swagger 2.0 Features:**
- Basic endpoint definitions
- Parameter and response models
- Security definitions
- Base URL handling

**Limitations:**
- Custom extensions ignored with warnings
- Complex polymorphism not fully supported
- Callbacks and webhooks not implemented
- Advanced OAuth2 flows simplified