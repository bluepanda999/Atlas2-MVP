# Story 3.2: Data Transformation Engine - Brownfield Addition

## User Story

As a system administrator,
I want a robust data transformation engine that processes mapped data according to user-defined rules,
So that CSV data can be accurately converted to API-compatible format with high performance.

## Story Context

**Existing System Integration:**
- Integrates with: Field mapping interface (Story 3.1), CSV processing pipeline (Epic 1), API client generation (Epic 2)
- Technology: Node.js backend with streaming transformation, rule engine, type conversion system
- Follows pattern: Streaming processing patterns, rule engine frameworks, error handling standards
- Touch points: Transformation service, rule validation, type conversion, error reporting

## Acceptance Criteria

**Functional Requirements:**
1. Streaming data transformation that processes mapped CSV data according to transformation rules
2. Type conversion system with automatic coercion and validation for all common data types
3. Rule engine supporting complex transformations (calculations, conditionals, lookups)
4. Error handling with detailed error reporting and recovery options
5. Performance optimization for processing 10,000+ rows per second

**Integration Requirements:**
4. Existing data processing patterns remain unchanged (transformation layer extends pipeline)
5. New functionality follows existing error handling and logging patterns
6. Integration with mapping interface maintains current configuration patterns

**Quality Requirements:**
7. Transformation processing maintains ≥10,000 rows/second throughput
8. Type conversion accuracy >99% for standard data types
9. Memory usage stays within 200MB during transformation
10. Error recovery allows processing to continue after individual row failures

## Technical Notes

- **Integration Approach:** Transformation engine integrates with CSV processor and mapping interface through streaming pipeline
- **Existing Pattern Reference:** Follow established streaming processing and error handling patterns
- **Key Constraints:** Must maintain high performance, handle complex transformations, provide robust error recovery

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (transformation guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Complex transformations causing performance bottlenecks
- **Mitigation:** Implement lazy evaluation, caching, and configurable transformation complexity
- **Rollback:** Disable complex transformations and provide basic field mapping if performance issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing data processing pipeline
- [ ] Transformation engine follows existing streaming patterns
- [ ] Error handling integrates with existing logging framework
- [ ] Type conversion maintains existing data integrity standards

## Story Points Estimation

**Estimation:** 8 points
- Streaming transformation engine: 3 points
- Type conversion system: 2 points
- Rule engine implementation: 2 points
- Error handling and recovery: 1 point

## Dependencies

- Field mapping interface (Story 3.1)
- CSV processing pipeline (Epic 1)
- API client generation (Epic 2)

## Testing Requirements

**Unit Tests:**
- Transformation algorithms
- Type conversion functions
- Rule engine logic
- Error handling mechanisms

**Integration Tests:**
- End-to-end transformation workflow
- Large dataset processing
- Error recovery scenarios
- Performance under load

**Performance Tests:**
- Processing speed benchmarks
- Memory usage profiling
- Concurrent transformation capacity
- Rule evaluation performance

## Implementation Notes

**Transformation Engine:**
```javascript
class DataTransformationEngine {
  constructor(options = {}) {
    this.ruleEngine = new RuleEngine();
    this.typeConverter = new TypeConverter();
    this.errorHandler = new TransformationErrorHandler();
    this.performanceMonitor = new PerformanceMonitor();
  }

  async transform(inputStream, mappings, transformations, options = {}) {
    const results = {
      processed: 0,
      errors: [],
      transformed: []
    };

    return new Promise((resolve, reject) => {
      const transformStream = new Transform({
        objectMode: true,
        transform: async (row, encoding, callback) => {
          try {
            const startTime = Date.now();
            
            // Apply mappings and transformations
            const transformedRow = await this.transformRow(
              row, 
              mappings, 
              transformations
            );
            
            // Validate transformed data
            const validation = await this.validateRow(transformedRow);
            
            if (validation.valid) {
              results.transformed.push(transformedRow);
              results.processed++;
              
              // Emit transformed row
              this.push(transformedRow);
            } else {
              results.errors.push({
                row: results.processed,
                errors: validation.errors,
                originalRow: row
              });
            }
            
            // Monitor performance
            const processingTime = Date.now() - startTime;
            this.performanceMonitor.recordProcessingTime(processingTime);
            
            callback();
          } catch (error) {
            results.errors.push({
              row: results.processed,
              error: error.message,
              originalRow: row
            });
            
            // Continue processing other rows
            callback();
          }
        }
      });

      inputStream
        .pipe(transformStream)
        .on('finish', () => resolve(results))
        .on('error', reject);
    });
  }

  async transformRow(row, mappings, transformations) {
    const transformed = {};
    
    // Apply field mappings
    for (const [targetField, sourceField] of Object.entries(mappings)) {
      const sourceValue = row[sourceField];
      const transformationKey = `${sourceField}->${targetField}`;
      const transformation = transformations[transformationKey];
      
      if (transformation) {
        transformed[targetField] = await this.applyTransformation(
          sourceValue,
          transformation
        );
      } else {
        transformed[targetField] = sourceValue;
      }
    }
    
    return transformed;
  }

  async applyTransformation(value, transformation) {
    switch (transformation.type) {
      case 'type_convert':
        return this.typeConverter.convert(value, transformation.targetType);
      case 'calculate':
        return this.ruleEngine.calculate(value, transformation.expression);
      case 'conditional':
        return this.ruleEngine.conditional(value, transformation);
      case 'lookup':
        return this.ruleEngine.lookup(value, transformation.lookupTable);
      case 'format':
        return this.ruleEngine.format(value, transformation.pattern);
      case 'validate':
        return this.ruleEngine.validate(value, transformation.rules);
      default:
        return value;
    }
  }
}
```

**Type Conversion System:**
```javascript
class TypeConverter {
  constructor() {
    this.converters = {
      'string': this.toString.bind(this),
      'integer': this.toInteger.bind(this),
      'float': this.toFloat.bind(this),
      'boolean': this.toBoolean.bind(this),
      'date': this.toDate.bind(this),
      'email': this.toEmail.bind(this),
      'url': this.toUrl.bind(this)
    };
  }

  async convert(value, targetType) {
    if (value === null || value === undefined || value === '') {
      return this.getDefaultValue(targetType);
    }

    const converter = this.converters[targetType];
    if (!converter) {
      throw new Error(`Unsupported target type: ${targetType}`);
    }

    try {
      return await converter(value);
    } catch (error) {
      throw new ConversionError(value, targetType, error.message);
    }
  }

  toString(value) {
    return String(value);
  }

  toInteger(value) {
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      throw new Error(`Cannot convert "${value}" to integer`);
    }
    return num;
  }

  toFloat(value) {
    const num = parseFloat(value);
    if (isNaN(num)) {
      throw new Error(`Cannot convert "${value}" to float`);
    }
    return num;
  }

  toBoolean(value) {
    const str = String(value).toLowerCase();
    if (['true', 'yes', '1', 'on'].includes(str)) {
      return true;
    } else if (['false', 'no', '0', 'off'].includes(str)) {
      return false;
    } else {
      throw new Error(`Cannot convert "${value}" to boolean`);
    }
  }

  toDate(value) {
    const date = new Date(value);
    if (isNaN(date.getTime())) {
      throw new Error(`Cannot convert "${value}" to date`);
    }
    return date;
  }

  toEmail(value) {
    const email = String(value).trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error(`Invalid email format: "${value}"`);
    }
    return email;
  }

  toUrl(value) {
    try {
      new URL(String(value));
      return String(value);
    } catch (error) {
      throw new Error(`Invalid URL format: "${value}"`);
    }
  }

  getDefaultValue(targetType) {
    const defaults = {
      'string': '',
      'integer': 0,
      'float': 0.0,
      'boolean': false,
      'date': null,
      'email': '',
      'url': ''
    };
    return defaults[targetType];
  }
}
```

**Rule Engine:**
```javascript
class RuleEngine {
  constructor() {
    this.functions = {
      'upper': (value) => String(value).toUpperCase(),
      'lower': (value) => String(value).toLowerCase(),
      'trim': (value) => String(value).trim(),
      'length': (value) => String(value).length,
      'round': (value, decimals = 0) => Math.round(Number(value) * Math.pow(10, decimals)) / Math.pow(10, decimals),
      'abs': (value) => Math.abs(Number(value)),
      'now': () => new Date(),
      'uuid': () => this.generateUUID()
    };
  }

  async calculate(value, expression) {
    try {
      // Safe expression evaluation
      const safeExpression = this.sanitizeExpression(expression);
      const context = { value, ...this.functions };
      
      return this.evaluateExpression(safeExpression, context);
    } catch (error) {
      throw new RuleError(`Calculation failed: ${error.message}`);
    }
  }

  async conditional(value, config) {
    try {
      const condition = this.evaluateCondition(config.condition, { value });
      return condition ? config.trueValue : config.falseValue;
    } catch (error) {
      throw new RuleError(`Conditional evaluation failed: ${error.message}`);
    }
  }

  async lookup(value, lookupTable) {
    try {
      // Support different lookup strategies
      if (Array.isArray(lookupTable)) {
        return this.arrayLookup(value, lookupTable);
      } else if (typeof lookupTable === 'object') {
        return this.objectLookup(value, lookupTable);
      } else {
        throw new Error('Invalid lookup table format');
      }
    } catch (error) {
      throw new RuleError(`Lookup failed: ${error.message}`);
    }
  }

  async format(value, pattern) {
    try {
      return pattern.replace(/\{\{value\}\}/g, value)
                   .replace(/\{\{upper\}\}/g, String(value).toUpperCase())
                   .replace(/\{\{lower\}\}/g, String(value).toLowerCase())
                   .replace(/\{\{trim\}\}/g, String(value).trim());
    } catch (error) {
      throw new RuleError(`Format failed: ${error.message}`);
    }
  }

  async validate(value, rules) {
    const errors = [];
    
    for (const rule of rules) {
      try {
        const result = this.applyValidationRule(value, rule);
        if (!result.valid) {
          errors.push(result.message);
        }
      } catch (error) {
        errors.push(`Validation error: ${error.message}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  sanitizeExpression(expression) {
    // Remove potentially dangerous operations
    return expression
      .replace(/eval|function|constructor|prototype/gi, '')
      .replace(/[^a-zA-Z0-9+\-*/().<>=!&| ]/g, '');
  }

  evaluateExpression(expression, context) {
    // Create safe evaluation context
    const func = new Function(...Object.keys(context), `return ${expression}`);
    return func(...Object.values(context));
  }

  evaluateCondition(condition, context) {
    return this.evaluateExpression(condition, context);
  }

  arrayLookup(value, table) {
    const match = table.find(item => 
      item.key === value || item.from === value
    );
    return match ? match.value || match.to : value;
  }

  objectLookup(value, table) {
    return table.hasOwnProperty(value) ? table[value] : value;
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
}
```

**Error Handler:**
```javascript
class TransformationErrorHandler {
  constructor(options = {}) {
    this.maxErrors = options.maxErrors || 1000;
    this.errorStrategies = {
      'skip': this.skipRow.bind(this),
      'retry': this.retryRow.bind(this),
      'abort': this.abortTransformation.bind(this),
      'default': this.useDefaultValue.bind(this)
    };
  }

  async handleError(error, row, context, strategy = 'skip') {
    const errorInfo = {
      timestamp: new Date(),
      row: context.rowIndex,
      field: context.field,
      error: error.message,
      originalValue: context.value,
      strategy
    };

    // Log error
    this.logError(errorInfo);

    // Apply error strategy
    const handler = this.errorStrategies[strategy] || this.errorStrategies.default;
    return await handler(error, row, context);
  }

  skipRow(error, row, context) {
    // Skip the entire row
    return { action: 'skip', data: null };
  }

  retryRow(error, row, context) {
    // Retry with alternative approach
    if (context.retries < 3) {
      return { action: 'retry', data: row, retries: context.retries + 1 };
    } else {
      return this.skipRow(error, row, context);
    }
  }

  abortTransformation(error, row, context) {
    // Stop the entire transformation
    throw new AbortTransformationError(error.message, context);
  }

  useDefaultValue(error, row, context) {
    // Use default value for the field
    const defaultValue = this.getDefaultValue(context.field, context.targetType);
    return { action: 'continue', data: { ...row, [context.field]: defaultValue } };
  }

  getDefaultValue(field, targetType) {
    const defaults = {
      'string': '',
      'integer': 0,
      'float': 0.0,
      'boolean': false,
      'date': null
    };
    return defaults[targetType] || null;
  }

  logError(errorInfo) {
    console.error('Transformation Error:', errorInfo);
    // Send to monitoring system
  }
}
```

**Performance Monitor:**
```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      totalRows: 0,
      totalErrors: 0,
      totalTime: 0,
      averageTime: 0,
      rowsPerSecond: 0
    };
    this.startTime = null;
  }

  start() {
    this.startTime = Date.now();
  }

  recordProcessingTime(processingTime) {
    this.metrics.totalRows++;
    this.metrics.totalTime += processingTime;
    this.metrics.averageTime = this.metrics.totalTime / this.metrics.totalRows;
    
    if (this.startTime) {
      const elapsed = Date.now() - this.startTime;
      this.metrics.rowsPerSecond = (this.metrics.totalRows / elapsed) * 1000;
    }
  }

  recordError() {
    this.metrics.totalErrors++;
  }

  getMetrics() {
    return { ...this.metrics };
  }
}
```

**Error Handling:**
- Type conversion failures: Automatic fallback with warnings
- Rule evaluation errors: Default value application
- Memory pressure: Automatic batch size adjustment
- Processing timeouts: Graceful degradation with partial results

## Success Criteria

- Transformation processing maintains ≥10,000 rows/second throughput
- Type conversion accuracy >99% for standard data types
- Memory usage stays within 200MB during transformation
- Error recovery allows processing to continue after individual row failures
- Complex transformations (calculations, conditionals) work correctly

## Monitoring and Observability

**Metrics to Track:**
- Processing speed (rows/second)
- Error rates by category
- Memory usage during transformation
- Type conversion success rates

**Alerts:**
- Processing speed <5,000 rows/second
- Error rate >10%
- Memory usage >300MB
- Transformation timeout failures

## Integration Points

**Upstream:**
- Field mapping interface (transformation rules)
- CSV processing pipeline (source data)

**Downstream:**
- API client generation (transformed data)
- Error reporting system (error aggregation)
- Monitoring service (performance metrics)

## Transformation Features

**Type Conversions:**
- String, integer, float, boolean, date, email, URL
- Automatic type detection and coercion
- Custom format patterns
- Validation with error reporting

**Rule Engine:**
- Mathematical calculations
- Conditional logic
- Lookup tables
- String formatting functions
- Custom validation rules

**Performance Features:**
- Streaming processing
- Parallel transformation
- Memory optimization
- Configurable batch sizes
- Progress monitoring