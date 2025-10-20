# Story 3.2: Field Transformation Engine - Brownfield Addition

## User Story

As a data analyst,
I want to apply data transformations to mapped fields using a visual transformation editor,
So that I can convert CSV data formats to match API requirements without writing custom code.

## Story Context

**Existing System Integration:**

- Integrates with: Drag-and-drop mapping interface (Story 3.1), CSV processing pipeline (Epic 1)
- Technology: React frontend with TypeScript, Node.js backend, lodash for transformations
- Follows pattern: React component patterns, functional transformation approach, RESTful API design
- Touch points: Mapping validation endpoint, transformation processor service, preview API

## Acceptance Criteria

**Functional Requirements:**

1. Users can select transformation types from a comprehensive library (formatting, calculations, conditionals, lookups)
2. Visual transformation builder with parameter configuration and real-time preview
3. Support for chained transformations (multiple operations applied sequentially)
4. Transformation preview shows before/after values using actual CSV data samples
5. Custom transformation support with JavaScript expression validation

**Integration Requirements:** 6. Transformation engine integrates with existing mapping validation endpoint 7. Preview functionality uses existing CSV preview data from Epic 1 8. Transformation persistence integrates with mapping storage system 9. Error handling follows existing API response patterns and error formats

**Quality Requirements:** 10. Transformation preview updates in real-time (<500ms for complex operations) 11. Transformation library supports 20+ common data operations 12. Input validation prevents invalid expressions and circular references 13. Undo/redo functionality for transformation changes 14. No regression in existing mapping or CSV processing functionality

## Technical Notes

- **Integration Approach:** New transformation service extends existing mapping validation
- **Existing Pattern Reference:** Follow established service architecture and API response patterns
- **Key Constraints:** Must handle large datasets efficiently, validate expressions safely, maintain performance

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Documentation updated (transformation library docs, API docs)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Complex transformation expressions causing performance issues or security vulnerabilities
- **Mitigation:** Implement sandboxed execution, expression validation, and performance monitoring
- **Rollback:** Disable custom transformations and fall back to basic formatting if issues occur

**Compatibility Verification:**

- [ ] No breaking changes to existing mapping or validation endpoints
- [ ] Transformation service follows existing service patterns
- [ ] Error handling integrates with existing error management
- [ ] Performance impact is minimal during transformation operations

## Story Points Estimation

**Estimation:** 8 points

- Transformation library implementation: 3 points
- Visual transformation builder: 2 points
- Preview and validation system: 2 points
- Custom expression support: 1 point

## Dependencies

- Drag-and-drop mapping interface (Story 3.1)
- CSV processing pipeline (Epic 1) for sample data
- lodash library for standard transformations
- Expression parser for custom transformations

## Testing Requirements

**Unit Tests:**

- Transformation function accuracy
- Expression validation and security
- Preview calculation logic
- Error handling scenarios

**Integration Tests:**

- Transformation engine API integration
- Preview data generation
- End-to-end transformation workflow
- Complex transformation chains

**Security Tests:**

- Custom expression sandboxing
- Code injection prevention
- Resource usage limits
- Input sanitization

## Implementation Notes

**Transformation Library:**

```typescript
interface Transformation {
  id: string;
  name: string;
  category: "formatting" | "calculation" | "conditional" | "lookup" | "custom";
  description: string;
  parameters: TransformationParameter[];
  execute: (value: any, params: any[]) => any;
}

interface TransformationParameter {
  name: string;
  type: "string" | "number" | "boolean" | "select" | "expression";
  required: boolean;
  defaultValue?: any;
  options?: string[]; // for select type
  validation?: ValidationRule[];
}
```

**Built-in Transformations:**

```typescript
const transformationLibrary: Transformation[] = [
  // Formatting
  {
    id: "format-date",
    name: "Format Date",
    category: "formatting",
    description: "Convert date to specified format",
    parameters: [
      {
        name: "format",
        type: "select",
        required: true,
        options: ["ISO", "US", "EU", "custom"],
      },
      { name: "customFormat", type: "string", required: false },
    ],
    execute: (value, [format, customFormat]) => {
      /* implementation */
    },
  },

  // Calculations
  {
    id: "math-operation",
    name: "Math Operation",
    category: "calculation",
    description: "Apply mathematical operation",
    parameters: [
      {
        name: "operation",
        type: "select",
        required: true,
        options: ["add", "subtract", "multiply", "divide"],
      },
      { name: "operand", type: "number", required: true },
    ],
    execute: (value, [operation, operand]) => {
      /* implementation */
    },
  },

  // Conditionals
  {
    id: "conditional-value",
    name: "Conditional Value",
    category: "conditional",
    description: "Return different values based on conditions",
    parameters: [
      { name: "condition", type: "expression", required: true },
      { name: "trueValue", type: "string", required: true },
      { name: "falseValue", type: "string", required: true },
    ],
    execute: (value, [condition, trueValue, falseValue]) => {
      /* implementation */
    },
  },
];
```

**Visual Transformation Builder:**

```typescript
interface TransformationBuilderProps {
  fieldMapping: FieldMapping;
  sampleData: any[];
  onTransformationChange: (transformations: Transformation[]) => void;
}

const TransformationBuilder: React.FC<TransformationBuilderProps> = ({
  fieldMapping,
  sampleData,
  onTransformationChange,
}) => {
  // Component implementation with drag-and-drop transformation chaining
};
```

**Transformation Preview:**

```typescript
interface PreviewData {
  originalValue: any;
  transformedValue: any;
  transformations: Transformation[];
  isValid: boolean;
  errors: string[];
}

const generatePreview = (
  value: any,
  transformations: Transformation[],
): PreviewData => {
  // Apply transformations sequentially
  // Return preview data with validation
};
```

**API Integration:**

```typescript
// Existing mapping validation endpoint (extended)
POST /api/mappings/validate
{
  "csvUploadId": "string",
  "apiSpecId": "string",
  "mappings": "FieldMapping[]",
  "transformations": "TransformationConfig[]"
}

// New transformation preview endpoint
POST /api/transformations/preview
{
  "value": "any",
  "transformations": "TransformationConfig[]"
}

// Response format
{
  "preview": {
    "originalValue": "any",
    "transformedValue": "any",
    "isValid": "boolean",
    "errors": "string[]"
  },
  "sampleData": "PreviewData[]"
}
```

**Custom Expression Handling:**

```typescript
interface CustomTransformation {
  expression: string;
  parameters: string[];
  sandbox: {
    allowedLibraries: string[];
    memoryLimit: number;
    timeout: number;
  };
}

const executeCustomExpression = (
  expression: string,
  value: any,
  context: any,
): any => {
  // Safe expression execution in sandboxed environment
  // Input validation and sanitization
  // Resource usage monitoring
};
```

**Transformation Configuration:**

```typescript
interface TransformationConfig {
  fieldId: string;
  transformations: {
    id: string;
    type: string;
    parameters: Record<string, any>;
    order: number;
  }[];
  validation: {
    required: boolean;
    type: string;
    constraints: ValidationConstraint[];
  };
}
```

**Error Handling:**

```typescript
interface TransformationError {
  fieldId: string;
  transformationId: string;
  type: "syntax" | "runtime" | "validation" | "performance";
  message: string;
  suggestion?: string;
  severity: "error" | "warning" | "info";
}
```

**Performance Optimization:**

- Debounced preview generation (300ms delay)
- Memoized transformation results
- Virtual scrolling for large sample datasets
- Lazy loading of transformation library

## Success Criteria

- Users can apply transformations using visual builder with real-time preview
- Transformation library covers common data manipulation needs
- Custom expressions work safely within sandboxed environment
- Preview updates quickly even with complex transformation chains
- Integration with mapping validation works seamlessly

## QA Results

### Review Date: TBD

### Reviewed By: TBD

### Code Quality Assessment

_To be completed during QA review_

### Gate Status

Gate: TBD → qa.qaLocation/gates/3.2-field-transformation-engine.yml

### Recommended Status

_To be determined after implementation and review_
