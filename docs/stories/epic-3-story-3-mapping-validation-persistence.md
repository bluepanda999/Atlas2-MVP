# Story 3.3: Mapping Validation & Persistence - Brownfield Addition

## User Story

As a data analyst,
I want to save, load, and validate field mapping configurations with confidence that they will work correctly,
So that I can reuse mapping configurations and ensure data integrity during API uploads.

## Story Context

**Existing System Integration:**

- Integrates with: Drag-and-drop mapping interface (Story 3.1), transformation engine (Story 3.2)
- Technology: React frontend with TypeScript, Node.js backend, PostgreSQL for persistence
- Follows pattern: RESTful API design, existing database patterns, React state management
- Touch points: Mapping validation service, configuration storage, CSV processing pipeline

## Acceptance Criteria

**Functional Requirements:**

1. Comprehensive validation system checks mapping completeness, type compatibility, and transformation correctness
2. Mapping configuration persistence with version control and change history
3. Configuration templates for common mapping patterns (quick start options)
4. Import/export functionality for mapping configurations (JSON format)
5. Bulk validation against actual CSV data samples before API upload

**Integration Requirements:** 6. Validation service integrates with existing CSV preview API and API schema service 7. Persistence layer follows existing database patterns and migration approach 8. Configuration storage integrates with existing authentication and authorization 9. Import/export works with existing file upload/download infrastructure

**Quality Requirements:** 10. Validation provides clear, actionable error messages with specific suggestions 11. Configuration changes are tracked with audit trail and rollback capability 12. Template library covers 80%+ of common mapping scenarios 13. Import/export validation prevents corrupted configuration loading 14. No regression in existing CSV processing or API generation functionality

## Technical Notes

- **Integration Approach:** New validation service extends existing mapping infrastructure
- **Existing Pattern Reference:** Follow established database schema patterns and API response formats
- **Key Constraints:** Must ensure data integrity, provide comprehensive validation, maintain performance

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Documentation updated (API docs, user guides)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Validation logic missing edge cases or providing incorrect suggestions
- **Mitigation:** Comprehensive test suite with real-world mapping scenarios and user feedback integration
- **Rollback:** Disable advanced validation and fall back to basic required field checking if issues occur

**Compatibility Verification:**

- [ ] No breaking changes to existing mapping or transformation endpoints
- [ ] Database schema changes are additive only (new mapping_configurations table)
- [ ] API responses follow existing error handling patterns
- [ ] Performance impact is minimal during validation operations

## Story Points Estimation

**Estimation:** 8 points

- Validation engine implementation: 3 points
- Persistence layer and database schema: 2 points
- Template system and import/export: 2 points
- Audit trail and version control: 1 point

## Dependencies

- Drag-and-drop mapping interface (Story 3.1)
- Field transformation engine (Story 3.2)
- PostgreSQL database for configuration storage
- Existing authentication system

## Testing Requirements

**Unit Tests:**

- Validation rule accuracy
- Database operations (CRUD)
- Template generation logic
- Import/export validation

**Integration Tests:**

- End-to-end validation workflow
- Configuration persistence and retrieval
- Template application and customization
- Bulk validation with sample data

**Performance Tests:**

- Validation speed with complex mappings
- Database query performance
- Import/export processing time
- Concurrent validation operations

## Implementation Notes

**Database Schema:**

```sql
-- Mapping configurations table
CREATE TABLE mapping_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  csv_upload_id UUID REFERENCES csv_uploads(id),
  api_spec_id UUID REFERENCES api_specifications(id),
  configuration JSONB NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  is_template BOOLEAN DEFAULT FALSE,
  template_category VARCHAR(100),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_by UUID REFERENCES users(id),
  updated_at TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

-- Mapping configuration history (audit trail)
CREATE TABLE mapping_configuration_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID REFERENCES mapping_configurations(id),
  version INTEGER NOT NULL,
  configuration JSONB NOT NULL,
  change_description TEXT,
  changed_by UUID REFERENCES users(id),
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Validation results cache
CREATE TABLE mapping_validation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id UUID REFERENCES mapping_configurations(id),
  csv_sample_hash VARCHAR(64),
  validation_result JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP
);
```

**Validation Engine:**

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  score: number; // 0-100 confidence score
}

interface ValidationError {
  fieldId: string;
  type: "required" | "type" | "transformation" | "dependency" | "format";
  severity: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
  autoFixable: boolean;
}

interface ValidationRule {
  id: string;
  name: string;
  description: string;
  category: "completeness" | "compatibility" | "transformation" | "performance";
  validate: (
    mapping: FieldMapping,
    context: ValidationContext,
  ) => ValidationError[];
}

const validationRules: ValidationRule[] = [
  // Required field validation
  {
    id: "required-fields",
    name: "Required Fields",
    description: "Ensure all required API parameters are mapped",
    category: "completeness",
    validate: (mapping, context) => {
      /* implementation */
    },
  },

  // Type compatibility validation
  {
    id: "type-compatibility",
    name: "Type Compatibility",
    description: "Check data type compatibility between source and target",
    category: "compatibility",
    validate: (mapping, context) => {
      /* implementation */
    },
  },

  // Transformation validation
  {
    id: "transformation-validity",
    name: "Transformation Validity",
    description: "Validate transformation logic and parameters",
    category: "transformation",
    validate: (mapping, context) => {
      /* implementation */
    },
  },
];
```

**Configuration Management:**

```typescript
interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  csvUploadId: string;
  apiSpecId: string;
  mappings: FieldMapping[];
  transformations: TransformationConfig[];
  metadata: {
    version: number;
    createdAt: Date;
    updatedAt: Date;
    createdBy: string;
    tags: string[];
  };
}

class ConfigurationManager {
  async saveConfiguration(config: MappingConfiguration): Promise<string>;
  async loadConfiguration(id: string): Promise<MappingConfiguration>;
  async deleteConfiguration(id: string): Promise<void>;
  async listConfigurations(
    filters?: ConfigurationFilters,
  ): Promise<MappingConfiguration[]>;
  async duplicateConfiguration(id: string, newName: string): Promise<string>;
  async getVersionHistory(id: string): Promise<ConfigurationVersion[]>;
  async rollbackToVersion(id: string, version: number): Promise<void>;
}
```

**Template System:**

```typescript
interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: "ecommerce" | "crm" | "analytics" | "general";
  sourcePattern: string; // Regex or pattern description
  targetPattern: string; // API type or pattern
  mappings: FieldMapping[];
  transformations: TransformationConfig[];
  popularity: number;
  usageCount: number;
}

const templateLibrary: MappingTemplate[] = [
  {
    id: "ecommerce-product-import",
    name: "E-commerce Product Import",
    description: "Map product CSV data to e-commerce API",
    category: "ecommerce",
    sourcePattern: "product.*csv",
    targetPattern: "product-api",
    mappings: [
      /* predefined mappings */
    ],
    transformations: [
      /* common transformations */
    ],
    popularity: 95,
    usageCount: 1250,
  },
];
```

**API Endpoints:**

```typescript
// Validation endpoints
POST /api/mappings/validate
{
  "configuration": "MappingConfiguration",
  "csvSampleData": "any[]",
  "options": "ValidationOptions"
}

// Configuration management endpoints
POST /api/mapping-configurations
GET /api/mapping-configurations
GET /api/mapping-configurations/{id}
PUT /api/mapping-configurations/{id}
DELETE /api/mapping-configurations/{id}

// Template endpoints
GET /api/mapping-templates
GET /api/mapping-templates/{id}
POST /api/mapping-templates/{id}/apply

// Import/Export endpoints
POST /api/mapping-configurations/import
GET /api/mapping-configurations/{id}/export

// Version control endpoints
GET /api/mapping-configurations/{id}/history
POST /api/mapping-configurations/{id}/rollback/{version}
```

**Import/Export Format:**

```typescript
interface MappingConfigurationExport {
  version: string;
  exportedAt: string;
  configuration: MappingConfiguration;
  metadata: {
    exportVersion: string;
    compatibility: string[];
    notes?: string;
  };
}
```

**Validation Context:**

```typescript
interface ValidationContext {
  csvColumns: CsvColumn[];
  apiParameters: ApiParameter[];
  sampleData: any[];
  transformationLibrary: Transformation[];
  validationOptions: ValidationOptions;
}

interface ValidationOptions {
  strictMode: boolean;
  includeWarnings: boolean;
  maxSampleSize: number;
  timeout: number;
}
```

**Error Handling and Suggestions:**

```typescript
interface ValidationSuggestion {
  type: "auto-fix" | "manual" | "template";
  description: string;
  action: () => Promise<void>; // For auto-fix
  confidence: number; // 0-100
}

const generateSuggestions = (
  errors: ValidationError[],
  context: ValidationContext,
): ValidationSuggestion[] => {
  // Analyze errors and generate actionable suggestions
  // Include template recommendations for common patterns
  // Provide auto-fix options where possible
};
```

**Performance Optimization:**

- Validation result caching with hash-based invalidation
- Incremental validation for large configurations
- Background validation for complex scenarios
- Debounced validation during configuration editing

## Success Criteria

- Validation catches all mapping errors before API upload
- Configuration persistence works reliably with version control
- Template system accelerates common mapping scenarios
- Import/export maintains configuration integrity
- Integration with existing systems works seamlessly

## QA Results

### Review Date: TBD

### Reviewed By: TBD

### Code Quality Assessment

_To be completed during QA review_

### Gate Status

Gate: TBD → qa.qaLocation/gates/3.3-mapping-validation-persistence.yml

### Recommended Status

_To be determined after implementation and review_
