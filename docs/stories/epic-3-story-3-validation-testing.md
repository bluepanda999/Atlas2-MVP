# Story 3.3: Mapping Validation & Testing - Brownfield Addition

## User Story

As a data analyst,
I want to validate and test my field mappings before processing the entire dataset,
So that I can identify and fix issues early without wasting processing time.

## Story Context

**Existing System Integration:**
- Integrates with: Field mapping interface (Story 3.1), transformation engine (Story 3.2), data validation system
- Technology: React frontend for validation interface, Node.js backend for validation logic, real-time feedback
- Follows pattern: Validation frameworks, testing patterns, error reporting standards
- Touch points: Validation API, testing interface, error reporting, preview system

## Acceptance Criteria

**Functional Requirements:**
1. Comprehensive mapping validation with type compatibility checking and required field verification
2. Test data processing using sample dataset (first 100 rows) with detailed error reporting
3. Validation rule configuration with custom constraints and business logic validation
4. Real-time validation feedback with error highlighting and correction suggestions
5. Validation report generation with summary statistics and detailed error analysis

**Integration Requirements:**
4. Existing validation patterns remain unchanged (new mapping validation extends framework)
5. New functionality follows existing error handling and reporting patterns
6. Integration with transformation engine maintains current data flow patterns

**Quality Requirements:**
7. Validation completes within 5 seconds for 100-row sample dataset
8. Type compatibility checking accuracy >99% for common data types
9. Error messages are clear, actionable, and include specific field context
10. Validation interface responds within 200ms to user interactions

## Technical Notes

- **Integration Approach:** Validation system integrates with mapping interface and transformation engine
- **Existing Pattern Reference:** Follow established validation frameworks and error reporting patterns
- **Key Constraints:** Must provide fast feedback, handle complex validation rules, support custom business logic

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (validation guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Complex validation rules causing performance issues during testing
- **Mitigation:** Implement incremental validation, caching, and configurable validation depth
- **Rollback:** Disable complex validation and provide basic type checking if performance issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing validation framework
- [ ] Mapping validation follows existing error handling patterns
- [ ] Testing interface uses existing UI component patterns
- [ ] Validation reports follow existing documentation standards

## Story Points Estimation

**Estimation:** 5 points
- Validation engine: 2 points
- Testing interface: 2 points
- Validation reporting: 1 point

## Dependencies

- Field mapping interface (Story 3.1)
- Transformation engine (Story 3.2)
- Data validation framework foundation

## Testing Requirements

**Unit Tests:**
- Validation rule engine
- Type compatibility checking
- Error message generation
- Validation report creation

**Integration Tests:**
- End-to-end validation workflow
- Sample data processing
- Error reporting accuracy
- Performance under load

**Performance Tests:**
- Validation speed with various dataset sizes
- Memory usage during validation
- Concurrent validation capacity
- Real-time feedback responsiveness

## Implementation Notes

**Mapping Validator:**
```javascript
class MappingValidator {
  constructor(options = {}) {
    this.typeChecker = new TypeCompatibilityChecker();
    this.ruleEngine = new ValidationRuleEngine();
    this.errorReporter = new ValidationErrorReporter();
  }

  async validateMappings(mappings, transformations, sampleData, targetSchema) {
    const results = {
      valid: true,
      errors: [],
      warnings: [],
      summary: {
        totalFields: Object.keys(mappings).length,
        mappedFields: Object.values(mappings).filter(v => v).length,
        requiredFields: targetSchema.required?.length || 0,
        sampleSize: sampleData.length
      }
    };

    // Validate field mappings
    await this.validateFieldMappings(mappings, targetSchema, results);
    
    // Validate type compatibility
    await this.validateTypeCompatibility(mappings, transformations, sampleData, results);
    
    // Validate required fields
    await this.validateRequiredFields(mappings, targetSchema, results);
    
    // Test transformation on sample data
    await this.testTransformations(mappings, transformations, sampleData, results);

    results.valid = results.errors.length === 0;
    return results;
  }

  async validateFieldMappings(mappings, targetSchema, results) {
    for (const [targetField, sourceField] of Object.entries(mappings)) {
      if (!sourceField) {
        if (targetSchema.required?.includes(targetField)) {
          results.errors.push({
            type: 'missing_required_field',
            field: targetField,
            message: `Required field "${targetField}" is not mapped`
          });
        } else {
          results.warnings.push({
            type: 'unmapped_optional_field',
            field: targetField,
            message: `Optional field "${targetField}" is not mapped`
          });
        }
      }
    }
  }

  async validateTypeCompatibility(mappings, transformations, sampleData, results) {
    for (const [targetField, sourceField] of Object.entries(mappings)) {
      if (!sourceField) continue;

      const targetSchema = this.getTargetFieldSchema(targetField);
      const sourceValues = sampleData.map(row => row[sourceField]).filter(v => v != null);
      
      if (sourceValues.length === 0) {
        results.warnings.push({
          type: 'empty_source_field',
          field: targetField,
          sourceField,
          message: `Source field "${sourceField}" contains no data`
        });
        continue;
      }

      const compatibility = await this.typeChecker.checkCompatibility(
        sourceValues,
        targetSchema.type,
        transformations[`${sourceField}->${targetField}`]
      );

      if (!compatibility.compatible) {
        results.errors.push({
          type: 'type_incompatibility',
          field: targetField,
          sourceField,
          targetType: targetSchema.type,
          detectedType: compatibility.detectedType,
          message: compatibility.message,
          suggestions: compatibility.suggestions
        });
      } else if (compatibility.warnings.length > 0) {
        compatibility.warnings.forEach(warning => {
          results.warnings.push({
            type: 'type_warning',
            field: targetField,
            sourceField,
            message: warning
          });
        });
      }
    }
  }

  async validateRequiredFields(mappings, targetSchema, results) {
    if (!targetSchema.required) return;

    const mappedFields = Object.keys(mappings);
    const missingRequired = targetSchema.required.filter(
      field => !mappedFields.includes(field) || !mappings[field]
    );

    missingRequired.forEach(field => {
      results.errors.push({
        type: 'missing_required_field',
        field,
        message: `Required field "${field}" is not mapped`
      });
    });
  }

  async testTransformations(mappings, transformations, sampleData, results) {
    const transformationEngine = new DataTransformationEngine();
    
    try {
      const testResults = await transformationEngine.transform(
        sampleData,
        mappings,
        transformations
      );

      // Analyze transformation results
      const errorRate = testResults.errors.length / sampleData.length;
      
      if (errorRate > 0.1) { // More than 10% errors
        results.errors.push({
          type: 'high_transformation_error_rate',
          errorRate,
          message: `Transformation error rate is ${(errorRate * 100).toFixed(1)}%`
        });
      } else if (errorRate > 0.05) { // More than 5% errors
        results.warnings.push({
          type: 'moderate_transformation_error_rate',
          errorRate,
          message: `Transformation error rate is ${(errorRate * 100).toFixed(1)}%`
        });
      }

      // Add sample errors to results
      results.sampleErrors = testResults.errors.slice(0, 10);
      
    } catch (error) {
      results.errors.push({
        type: 'transformation_failure',
        message: `Transformation test failed: ${error.message}`
      });
    }
  }

  getTargetFieldSchema(fieldName) {
    // This would come from the API schema
    return {
      type: 'string', // default
      required: false
    };
  }
}
```

**Type Compatibility Checker:**
```javascript
class TypeCompatibilityChecker {
  async checkCompatibility(sourceValues, targetType, transformation) {
    const detectedType = this.detectType(sourceValues);
    const compatibility = this.checkTypeConversion(detectedType, targetType);
    
    let compatible = compatibility.compatible;
    let message = compatibility.message;
    let suggestions = [];

    // Check if transformation can resolve incompatibility
    if (!compatible && transformation) {
      const transformationResult = await this.checkTransformationCompatibility(
        detectedType,
        targetType,
        transformation
      );
      
      if (transformationResult.resolves) {
        compatible = true;
        message = `Transformation resolves type compatibility`;
        suggestions = transformationResult.suggestions;
      }
    }

    const warnings = [];
    
    // Check for potential data loss
    if (compatible && this.hasPotentialDataLoss(detectedType, targetType)) {
      warnings.push(`Potential data loss when converting from ${detectedType} to ${targetType}`);
    }

    // Check for null values
    const nullCount = sourceValues.filter(v => v == null || v === '').length;
    if (nullCount > sourceValues.length * 0.5) {
      warnings.push(`${nullCount} of ${sourceValues.length} values are null or empty`);
    }

    return {
      compatible,
      detectedType,
      targetType,
      message,
      warnings,
      suggestions
    };
  }

  detectType(values) {
    const nonNullValues = values.filter(v => v != null && v !== '');
    
    if (nonNullValues.length === 0) {
      return 'null';
    }

    const types = nonNullValues.map(value => this.getValueType(value));
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});

    // Return the most common type
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }

  getValueType(value) {
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'float';
    }
    if (value instanceof Date) return 'date';
    if (typeof value === 'string') {
      if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return 'email';
      if (/^https?:\/\//.test(value)) return 'url';
      if (!isNaN(Date.parse(value))) return 'date';
      if (!isNaN(value) && !isNaN(parseFloat(value))) {
        return value.includes('.') ? 'float' : 'integer';
      }
    }
    return 'string';
  }

  checkTypeConversion(sourceType, targetType) {
    const compatibilityMatrix = {
      'string': { 'string': true, 'integer': false, 'float': false, 'boolean': false, 'date': false, 'email': false, 'url': false },
      'integer': { 'string': true, 'integer': true, 'float': true, 'boolean': true, 'date': false, 'email': false, 'url': false },
      'float': { 'string': true, 'integer': true, 'float': true, 'boolean': true, 'date': false, 'email': false, 'url': false },
      'boolean': { 'string': true, 'integer': true, 'float': true, 'boolean': true, 'date': false, 'email': false, 'url': false },
      'date': { 'string': true, 'integer': false, 'float': false, 'boolean': false, 'date': true, 'email': false, 'url': false },
      'email': { 'string': true, 'integer': false, 'float': false, 'boolean': false, 'date': false, 'email': true, 'url': false },
      'url': { 'string': true, 'integer': false, 'float': false, 'boolean': false, 'date': false, 'email': false, 'url': true }
    };

    const compatible = compatibilityMatrix[sourceType]?.[targetType] || false;
    
    return {
      compatible,
      message: compatible 
        ? `Type conversion from ${sourceType} to ${targetType} is supported`
        : `Type conversion from ${sourceType} to ${targetType} is not supported`
    };
  }

  async checkTransformationCompatibility(sourceType, targetType, transformation) {
    // Check if transformation can resolve type incompatibility
    const resolvingTransformations = {
      'string_to_integer': ['calculate', 'type_convert'],
      'string_to_float': ['calculate', 'type_convert'],
      'string_to_boolean': ['conditional', 'type_convert'],
      'string_to_date': ['format', 'type_convert'],
      'integer_to_string': ['format', 'type_convert'],
      'float_to_string': ['format', 'type_convert'],
      'boolean_to_string': ['format', 'type_convert']
    };

    const key = `${sourceType}_to_${targetType}`;
    const resolvingTypes = resolvingTransformations[key] || [];

    const resolves = resolvingTypes.includes(transformation.type);
    
    return {
      resolves,
      suggestions: resolves ? [] : [
        `Consider using transformation type: ${resolvingTypes.join(' or ')}`
      ]
    };
  }

  hasPotentialDataLoss(sourceType, targetType) {
    const lossConversions = [
      ['float', 'integer'],
      ['integer', 'boolean'],
      ['float', 'boolean'],
      ['date', 'string'],
      ['email', 'string'],
      ['url', 'string']
    ];

    return lossConversions.some(([source, target]) => 
      sourceType === source && targetType === target
    );
  }
}
```

**Validation Interface:**
```javascript
const MappingValidation = ({ mappings, transformations, sampleData, targetSchema }) => {
  const [validationResults, setValidationResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [selectedError, setSelectedError] = useState(null);

  const runValidation = async () => {
    setLoading(true);
    try {
      const validator = new MappingValidator();
      const results = await validator.validateMappings(
        mappings,
        transformations,
        sampleData,
        targetSchema
      );
      setValidationResults(results);
    } catch (error) {
      showError('Validation failed: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, [mappings, transformations]);

  return (
    <div className="mapping-validation">
      <div className="validation-header">
        <h3>Mapping Validation</h3>
        <button onClick={runValidation} disabled={loading}>
          {loading ? 'Validating...' : 'Re-run Validation'}
        </button>
      </div>

      {validationResults && (
        <div className="validation-results">
          <ValidationSummary results={validationResults} />
          
          <div className="validation-tabs">
            <TabButton active={true}>Errors</TabButton>
            <TabButton>Warnings</TabButton>
            <TabButton>Sample Data</TabButton>
            <TabButton>Report</TabButton>
          </div>

          <div className="validation-content">
            <ErrorList 
              errors={validationResults.errors}
              onSelectError={setSelectedError}
            />
            <WarningList warnings={validationResults.warnings} />
            <SampleDataPreview 
              data={validationResults.sampleData}
              errors={validationResults.sampleErrors}
            />
            <ValidationReport results={validationResults} />
          </div>
        </div>
      )}

      {selectedError && (
        <ErrorDetailModal 
          error={selectedError}
          onClose={() => setSelectedError(null)}
        />
      )}
    </div>
  );
};
```

**Validation Summary Component:**
```javascript
const ValidationSummary = ({ results }) => {
  const getStatusColor = () => {
    if (results.errors.length > 0) return '#dc3545'; // red
    if (results.warnings.length > 0) return '#ffc107'; // yellow
    return '#28a745'; // green
  };

  const getStatusText = () => {
    if (results.errors.length > 0) return 'Validation Failed';
    if (results.warnings.length > 0) return 'Validation Passed with Warnings';
    return 'Validation Passed';
  };

  return (
    <div className="validation-summary">
      <div className="summary-status" style={{ color: getStatusColor() }}>
        <h4>{getStatusText()}</h4>
      </div>
      
      <div className="summary-metrics">
        <div className="metric">
          <span className="metric-label">Total Fields:</span>
          <span className="metric-value">{results.summary.totalFields}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Mapped Fields:</span>
          <span className="metric-value">{results.summary.mappedFields}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Required Fields:</span>
          <span className="metric-value">{results.summary.requiredFields}</span>
        </div>
        <div className="metric">
          <span className="metric-label">Sample Size:</span>
          <span className="metric-value">{results.summary.sampleSize}</span>
        </div>
      </div>

      <div className="summary-issues">
        <div className="issue-count">
          <span className="count errors">{results.errors.length}</span>
          <span className="label">Errors</span>
        </div>
        <div className="issue-count">
          <span className="count warnings">{results.warnings.length}</span>
          <span className="label">Warnings</span>
        </div>
      </div>
    </div>
  );
};
```

**Error List Component:**
```javascript
const ErrorList = ({ errors, onSelectError }) => {
  return (
    <div className="error-list">
      <h4>Validation Errors</h4>
      {errors.length === 0 ? (
        <p>No validation errors found.</p>
      ) : (
        <div className="errors">
          {errors.map((error, index) => (
            <div 
              key={index} 
              className="error-item"
              onClick={() => onSelectError(error)}
            >
              <div className="error-header">
                <span className="error-type">{error.type}</span>
                <span className="error-field">{error.field}</span>
              </div>
              <div className="error-message">{error.message}</div>
              {error.suggestions && (
                <div className="error-suggestions">
                  <strong>Suggestions:</strong>
                  <ul>
                    {error.suggestions.map((suggestion, i) => (
                      <li key={i}>{suggestion}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
```

**Validation Report Generator:**
```javascript
class ValidationReportGenerator {
  generateReport(validationResults) {
    const report = {
      timestamp: new Date().toISOString(),
      status: validationResults.valid ? 'PASSED' : 'FAILED',
      summary: validationResults.summary,
      errors: validationResults.errors,
      warnings: validationResults.warnings,
      recommendations: this.generateRecommendations(validationResults)
    };

    return report;
  }

  generateRecommendations(results) {
    const recommendations = [];

    // Analyze error patterns
    const errorTypes = results.errors.reduce((acc, error) => {
      acc[error.type] = (acc[error.type] || 0) + 1;
      return acc;
    }, {});

    if (errorTypes.missing_required_field > 0) {
      recommendations.push({
        priority: 'HIGH',
        category: 'Mapping',
        message: `Map ${errorTypes.missing_required_field} required fields to ensure data completeness`
      });
    }

    if (errorTypes.type_incompatibility > 0) {
      recommendations.push({
        priority: 'MEDIUM',
        category: 'Data Types',
        message: `Add transformations for ${errorTypes.type_incompatibility} fields with type mismatches`
      });
    }

    if (results.warnings.length > results.errors.length) {
      recommendations.push({
        priority: 'LOW',
        category: 'Data Quality',
        message: 'Review warnings to improve data quality and prevent potential issues'
      });
    }

    return recommendations;
  }

  exportToMarkdown(report) {
    let markdown = `# Mapping Validation Report\n\n`;
    markdown += `**Status:** ${report.status}\n`;
    markdown += `**Generated:** ${new Date(report.timestamp).toLocaleString()}\n\n`;

    markdown += `## Summary\n\n`;
    markdown += `- Total Fields: ${report.summary.totalFields}\n`;
    markdown += `- Mapped Fields: ${report.summary.mappedFields}\n`;
    markdown += `- Required Fields: ${report.summary.requiredFields}\n`;
    markdown += `- Sample Size: ${report.summary.sampleSize}\n\n`;

    if (report.errors.length > 0) {
      markdown += `## Errors (${report.errors.length})\n\n`;
      report.errors.forEach((error, index) => {
        markdown += `### ${index + 1}. ${error.type}\n`;
        markdown += `**Field:** ${error.field}\n`;
        markdown += `**Message:** ${error.message}\n\n`;
      });
    }

    if (report.warnings.length > 0) {
      markdown += `## Warnings (${report.warnings.length})\n\n`;
      report.warnings.forEach((warning, index) => {
        markdown += `### ${index + 1}. ${warning.type}\n`;
        markdown += `**Field:** ${warning.field}\n`;
        markdown += `**Message:** ${warning.message}\n\n`;
      });
    }

    if (report.recommendations.length > 0) {
      markdown += `## Recommendations\n\n`;
      report.recommendations.forEach((rec, index) => {
        markdown += `### ${index + 1}. ${rec.priority} Priority - ${rec.category}\n`;
        markdown += `${rec.message}\n\n`;
      });
    }

    return markdown;
  }
}
```

**Error Handling:**
- Validation failures: Clear error categorization with suggestions
- Sample data issues: Detailed error reporting with row context
- Performance issues: Automatic validation depth adjustment
- Transformation errors: Specific error messages with correction guidance

## Success Criteria

- Validation completes within 5 seconds for 100-row sample dataset
- Type compatibility checking accuracy >99% for common data types
- Error messages are clear and actionable with specific field context
- Validation interface responds within 200ms to user interactions
- Validation reports provide comprehensive analysis and recommendations

## Monitoring and Observability

**Metrics to Track:**
- Validation completion times
- Error detection rates by category
- Type compatibility accuracy
- User interaction response times

**Alerts:**
- Validation completion time >10 seconds
- Error detection failure rate >5%
- Type compatibility false positives >2%
- Interface response time >500ms

## Integration Points

**Upstream:**
- Field mapping interface (mapping configuration)
- Transformation engine (transformation testing)

**Downstream:**
- Error reporting system (validation errors)
- Preview system (sample data display)
- Report generation (validation reports)

## Validation Features

**Type Compatibility:**
- Automatic type detection
- Conversion compatibility checking
- Transformation compatibility analysis
- Data loss potential assessment

**Validation Rules:**
- Required field verification
- Type compatibility checking
- Custom business logic validation
- Data quality assessment

**Testing Features:**
- Sample data processing
- Transformation testing
- Error simulation
- Performance benchmarking