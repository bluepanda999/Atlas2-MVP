# Story 10.1: Custom Transformation Functions - Brownfield Addition

## User Story

As a data transformation specialist,
I want to create and register custom transformation functions using JavaScript code,
So that I can implement domain-specific data transformations that aren't available in the standard library.

## Story Context

**Existing System Integration:**

- Integrates with: Transformation engine (Story 3.2), transformation library, validation system
- Technology: Node.js backend with sandboxed JavaScript execution, function registry, security controls
- Follows pattern: Plugin architecture, sandboxed execution, validation patterns
- Touch points: Transformation library, security sandbox, function registry, error handling

## Acceptance Criteria

**Functional Requirements:**

1. Custom transformation function creation interface with JavaScript code editor
2. Sandboxed execution environment for custom functions with security controls
3. Function registration and management system with versioning
4. Parameter definition system with type validation and UI generation
5. Testing interface for custom functions with sample data
6. Import/export functionality for sharing custom transformations

**Integration Requirements:** 4. Existing transformation engine continues to work unchanged (custom functions extend library) 5. New functionality follows existing transformation patterns and interfaces 6. Integration with transformation library maintains current discovery and execution patterns

**Quality Requirements:** 7. Custom function execution time <100ms per transformation 8. Security sandbox prevents access to system resources and network 9. Function validation catches syntax errors before registration 10. Memory usage per custom function <10MB

## Technical Notes

- **Integration Approach:** Custom functions extend existing transformation library through plugin architecture
- **Existing Pattern Reference:** Follow established transformation function patterns and validation
- **Key Constraints:** Must maintain security, performance, and compatibility with existing engine

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Security validation completed
- [ ] Documentation updated (custom function guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Custom functions causing security vulnerabilities or performance issues
- **Mitigation:** Implement strict sandboxing, resource limits, and code validation
- **Rollback:** Disable custom function registry and fall back to standard transformations

**Compatibility Verification:**

- [ ] No breaking changes to existing transformation engine
- [ ] Custom functions follow existing transformation interface
- [ ] Security sandbox integrates with existing error handling
- [ ] Function registry maintains existing discovery patterns

## Story Points Estimation

**Estimation:** 5 points

- Custom function editor: 1 point
- Sandboxed execution environment: 2 points
- Function registry and management: 1 point
- Security controls and validation: 1 point

## Dependencies

- Transformation engine (Story 3.2)
- Transformation library
- Validation system

## Testing Requirements

**Unit Tests:**

- Custom function parsing and validation
- Sandboxed execution security
- Function registration and discovery
- Parameter type validation

**Integration Tests:**

- Custom function integration with transformation engine
- End-to-end transformation workflow
- Security sandbox enforcement
- Performance under load

**Security Tests:**

- Code injection prevention
- Resource access restrictions
- Memory limit enforcement
- Timeout handling

## Implementation Notes

**Custom Function Manager:**

```javascript
class CustomTransformationManager {
  constructor(options = {}) {
    this.sandbox = new TransformationSandbox(options.sandbox);
    this.registry = new FunctionRegistry();
    this.validator = new FunctionValidator();
    this.security = new SecurityController();
  }

  async createCustomFunction(config) {
    // Validate function configuration
    const validation = await this.validator.validate(config);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }

    // Create function definition
    const functionDef = {
      id: config.id,
      name: config.name,
      description: config.description,
      category: "custom",
      parameters: config.parameters,
      execute: this.createSandboxedExecutor(config.code, config.parameters),
      metadata: {
        author: config.author,
        version: config.version,
        createdAt: new Date(),
        tags: config.tags || [],
      },
    };

    // Register function
    await this.registry.register(functionDef);
    return functionDef;
  }

  createSandboxedExecutor(code, parameters) {
    return async (value, params, context) => {
      try {
        // Create sandboxed execution context
        const sandboxContext = this.createSandboxContext(
          value,
          params,
          context,
          parameters,
        );

        // Execute in sandbox with timeout
        const result = await this.sandbox.execute(code, sandboxContext, {
          timeout: 5000,
          memoryLimit: 10 * 1024 * 1024, // 10MB
        });

        return result;
      } catch (error) {
        throw new CustomTransformationError(
          `Custom function execution failed: ${error.message}`,
        );
      }
    };
  }

  createSandboxContext(value, params, context, parameters) {
    // Create parameter mapping
    const paramContext = {};
    parameters.forEach((param, index) => {
      paramContext[param.name] = params[index] ?? param.defaultValue;
    });

    return {
      value,
      ...paramContext,
      context: {
        fieldName: context?.fieldName,
        rowIndex: context?.rowIndex,
        fieldMapping: context?.fieldMapping,
      },
      // Safe utility functions
      utils: {
        parseInt: Number.parseInt,
        parseFloat: Number.parseFloat,
        Math: Math,
        Date: Date,
        String: String,
        Array: Array,
        Object: Object,
      },
    };
  }

  async testCustomFunction(functionId, testData) {
    const func = await this.registry.get(functionId);
    if (!func) {
      throw new Error(`Custom function ${functionId} not found`);
    }

    const results = [];
    for (const test of testData) {
      try {
        const result = await func.execute(
          test.value,
          test.params,
          test.context,
        );
        results.push({
          input: test,
          output: result,
          success: true,
        });
      } catch (error) {
        results.push({
          input: test,
          error: error.message,
          success: false,
        });
      }
    }

    return results;
  }

  async listCustomFunctions(filters = {}) {
    return await this.registry.list(filters);
  }

  async deleteCustomFunction(functionId) {
    return await this.registry.delete(functionId);
  }
}
```

**Security Sandbox:**

```javascript
class TransformationSandbox {
  constructor(options = {}) {
    this.vm = require("vm");
    this.options = {
      timeout: options.timeout || 5000,
      memoryLimit: options.memoryLimit || 10 * 1024 * 1024,
      allowedModules: options.allowedModules || [],
      ...options,
    };
  }

  async execute(code, context, options = {}) {
    const timeout = options.timeout || this.options.timeout;
    const memoryLimit = options.memoryLimit || this.options.memoryLimit;

    // Create isolated context
    const sandbox = this.createSandbox(context);

    // Wrap code in async function
    const wrappedCode = `
      (async function() {
        ${code}
      })()
    `;

    try {
      // Execute with timeout and memory limits
      const script = new this.vm.Script(wrappedCode, {
        timeout: timeout,
        displayErrors: true,
      });

      const result = await script.runInNewContext(sandbox, {
        timeout: timeout,
        displayErrors: true,
      });

      return result;
    } catch (error) {
      throw new SandboxExecutionError(error.message);
    }
  }

  createSandbox(context) {
    // Create safe global context
    const sandbox = {
      // Safe built-ins
      console: {
        log: () => {}, // Disable console.log
        error: () => {},
        warn: () => {},
      },

      // Safe utilities
      parseInt: Number.parseInt,
      parseFloat: Number.parseFloat,
      isNaN: Number.isNaN,
      isFinite: Number.isFinite,

      // Math object (safe)
      Math: {
        abs: Math.abs,
        ceil: Math.ceil,
        floor: Math.floor,
        max: Math.max,
        min: Math.min,
        pow: Math.pow,
        random: Math.random,
        round: Math.round,
        sqrt: Math.sqrt,
        PI: Math.PI,
        E: Math.E,
      },

      // Date object (safe)
      Date: Date,

      // String methods (safe)
      String: String,

      // Array methods (safe)
      Array: Array,

      // Object methods (safe)
      Object: Object,

      // User-provided context
      ...context,
    };

    // Prevent access to dangerous globals
    Object.freeze(sandbox);

    return sandbox;
  }
}
```

**Function Validator:**

```javascript
class FunctionValidator {
  async validate(config) {
    const errors = [];

    // Validate required fields
    if (!config.id) errors.push("Function ID is required");
    if (!config.name) errors.push("Function name is required");
    if (!config.code) errors.push("Function code is required");
    if (!config.parameters || !Array.isArray(config.parameters)) {
      errors.push("Parameters must be an array");
    }

    // Validate function ID format
    if (config.id && !/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.id)) {
      errors.push(
        "Function ID must contain only letters, numbers, hyphens, and underscores",
      );
    }

    // Validate parameters
    if (config.parameters) {
      for (let i = 0; i < config.parameters.length; i++) {
        const param = config.parameters[i];
        const paramErrors = this.validateParameter(param, i);
        errors.push(...paramErrors);
      }
    }

    // Validate code syntax
    if (config.code) {
      try {
        // Check for dangerous patterns
        const dangerousPatterns = [
          /eval\s*\(/,
          /Function\s*\(/,
          /constructor\s*\(/,
          /prototype\s*\./,
          /__proto__/,
          /import\s+/,
          /require\s*\(/,
          /process\./,
          /global\./,
          /Buffer\./,
          /fs\./,
          /child_process/,
          /net\./,
          /http\./,
          /https\./,
        ];

        for (const pattern of dangerousPatterns) {
          if (pattern.test(config.code)) {
            errors.push(
              `Code contains potentially dangerous pattern: ${pattern.source}`,
            );
            break;
          }
        }

        // Basic syntax check
        new Function(config.code);
      } catch (error) {
        errors.push(`Syntax error in function code: ${error.message}`);
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  validateParameter(param, index) {
    const errors = [];
    const prefix = `Parameter ${index + 1}`;

    if (!param.name) errors.push(`${prefix}: name is required`);
    if (!param.type) errors.push(`${prefix}: type is required`);

    const validTypes = [
      "string",
      "number",
      "boolean",
      "date",
      "array",
      "object",
    ];
    if (param.type && !validTypes.includes(param.type)) {
      errors.push(`${prefix}: type must be one of ${validTypes.join(", ")}`);
    }

    if (param.defaultValue !== undefined) {
      // Validate default value type
      if (!this.isValidType(param.defaultValue, param.type)) {
        errors.push(
          `${prefix}: default value type doesn't match parameter type`,
        );
      }
    }

    return errors;
  }

  isValidType(value, type) {
    switch (type) {
      case "string":
        return typeof value === "string";
      case "number":
        return typeof value === "number" && !isNaN(value);
      case "boolean":
        return typeof value === "boolean";
      case "date":
        return value instanceof Date || !isNaN(Date.parse(value));
      case "array":
        return Array.isArray(value);
      case "object":
        return (
          typeof value === "object" && value !== null && !Array.isArray(value)
        );
      default:
        return false;
    }
  }
}
```

**Function Registry:**

```javascript
class FunctionRegistry {
  constructor(storage = new Map()) {
    this.storage = storage;
    this.indexes = {
      byCategory: new Map(),
      byAuthor: new Map(),
      byTag: new Map(),
    };
  }

  async register(functionDef) {
    // Check for duplicates
    if (this.storage.has(functionDef.id)) {
      throw new Error(`Function with ID ${functionDef.id} already exists`);
    }

    // Store function
    this.storage.set(functionDef.id, functionDef);

    // Update indexes
    this.updateIndexes(functionDef);

    return functionDef;
  }

  async get(functionId) {
    return this.storage.get(functionId);
  }

  async list(filters = {}) {
    let functions = Array.from(this.storage.values());

    // Apply filters
    if (filters.category) {
      functions = functions.filter((f) => f.category === filters.category);
    }

    if (filters.author) {
      functions = functions.filter((f) => f.metadata.author === filters.author);
    }

    if (filters.tags) {
      functions = functions.filter((f) =>
        filters.tags.some((tag) => f.metadata.tags.includes(tag)),
      );
    }

    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      functions = functions.filter(
        (f) =>
          f.name.toLowerCase().includes(searchLower) ||
          f.description.toLowerCase().includes(searchLower),
      );
    }

    return functions;
  }

  async delete(functionId) {
    const func = this.storage.get(functionId);
    if (!func) {
      throw new Error(`Function ${functionId} not found`);
    }

    this.storage.delete(functionId);
    this.removeIndexes(func);

    return func;
  }

  updateIndexes(functionDef) {
    // Category index
    if (!this.indexes.byCategory.has(functionDef.category)) {
      this.indexes.byCategory.set(functionDef.category, new Set());
    }
    this.indexes.byCategory.get(functionDef.category).add(functionDef.id);

    // Author index
    const author = functionDef.metadata.author;
    if (author) {
      if (!this.indexes.byAuthor.has(author)) {
        this.indexes.byAuthor.set(author, new Set());
      }
      this.indexes.byAuthor.get(author).add(functionDef.id);
    }

    // Tag index
    for (const tag of functionDef.metadata.tags) {
      if (!this.indexes.byTag.has(tag)) {
        this.indexes.byTag.set(tag, new Set());
      }
      this.indexes.byTag.get(tag).add(functionDef.id);
    }
  }

  removeIndexes(functionDef) {
    // Remove from category index
    const categorySet = this.indexes.byCategory.get(functionDef.category);
    if (categorySet) {
      categorySet.delete(functionDef.id);
    }

    // Remove from author index
    const author = functionDef.metadata.author;
    if (author) {
      const authorSet = this.indexes.byAuthor.get(author);
      if (authorSet) {
        authorSet.delete(functionDef.id);
      }
    }

    // Remove from tag indexes
    for (const tag of functionDef.metadata.tags) {
      const tagSet = this.indexes.byTag.get(tag);
      if (tagSet) {
        tagSet.delete(functionDef.id);
      }
    }
  }
}
```

## Success Criteria

- Custom functions can be created and registered successfully
- Sandboxed execution prevents security vulnerabilities
- Function validation catches errors before registration
- Custom functions integrate seamlessly with existing transformation engine
- Performance remains within acceptable limits

## Monitoring and Observability

**Metrics to Track:**

- Custom function execution count and success rate
- Average execution time per custom function
- Security violations and blocked attempts
- Memory usage by custom functions

**Alerts:**

- Custom function execution time >500ms
- Security sandbox violations
- Memory usage >20MB per function
- Function registration failures

## Integration Points

**Upstream:**

- Transformation engine (function execution)
- Function editor UI (function creation)

**Downstream:**

- Transformation library (function registration)
- Security monitoring (violation tracking)
- Performance monitoring (execution metrics)
