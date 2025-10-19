# Story 3.1: Visual Field Mapping Interface - Brownfield Addition

## User Story

As a data analyst,
I want to map CSV columns to API fields through an intuitive drag-and-drop interface,
So that I can transform data without writing complex transformation code.

## Story Context

**Existing System Integration:**
- Integrates with: CSV processing pipeline (Epic 1), API client generation (Epic 2), data validation system
- Technology: React frontend with drag-and-drop library, Node.js backend for transformation logic, real-time preview
- Follows pattern: React component patterns, data transformation frameworks, real-time validation
- Touch points: Field mapping UI, transformation engine, preview API, validation service

## Acceptance Criteria

**Functional Requirements:**
1. Drag-and-drop interface for mapping CSV columns to API request fields
2. Visual field type indicators with automatic type detection and conversion
3. Real-time preview showing transformed data for first 10 rows
4. Field transformation options (formatting, calculations, conditional logic)
5. Mapping validation with error highlighting and suggestions

**Integration Requirements:**
4. Existing data processing patterns remain unchanged (new mapping layer transforms data)
5. New functionality follows existing validation and error handling patterns
6. Integration with CSV processor and API clients maintains current data flow

**Quality Requirements:**
7. Mapping interface responds within 100ms to user interactions
8. Real-time preview updates within 200ms of mapping changes
9. Support for 100+ fields without performance degradation
10. Visual feedback for all mapping states (valid, invalid, warning)

## Technical Notes

- **Integration Approach:** Field mapping interface integrates with CSV processor and API clients through transformation pipeline
- **Existing Pattern Reference:** Follow established React component patterns and data transformation frameworks
- **Key Constraints:** Must handle large datasets, provide real-time feedback, support complex transformations

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (user guide, mapping documentation)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Complex transformations causing performance issues with large datasets
- **Mitigation:** Implement lazy evaluation, caching, and configurable transformation depth
- **Rollback:** Disable complex transformations and provide basic field mapping if performance issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing data processing pipeline
- [ ] Mapping interface follows existing UI component patterns
- [ ] Transformation engine integrates with existing validation framework
- [ ] Real-time preview uses existing data access patterns

## Story Points Estimation

**Estimation:** 8 points
- Drag-and-drop interface: 3 points
- Transformation engine: 2 points
- Real-time preview system: 2 points
- Field type detection: 1 point

## Dependencies

- CSV processing pipeline (Epic 1)
- API client generation (Epic 2)
- React drag-and-drop library integration

## Testing Requirements

**Unit Tests:**
- Drag-and-drop interaction logic
- Field transformation algorithms
- Type detection accuracy
- Preview data generation

**Integration Tests:**
- End-to-end mapping workflow
- Real-time preview updates
- Transformation application to full dataset
- Error handling and validation

**Performance Tests:**
- Interface responsiveness with 100+ fields
- Preview update speed
- Memory usage during mapping
- Transformation processing speed

## Implementation Notes

**Field Mapping Interface:**
```javascript
const FieldMappingInterface = ({ csvData, apiSchema }) => {
  const [mappings, setMappings] = useState({});
  const [transformations, setTransformations] = useState({});
  const [previewData, setPreviewData] = useState([]);
  const [validation, setValidation] = useState({});

  useEffect(() => {
    generatePreview();
  }, [mappings, transformations]);

  const generatePreview = async () => {
    const preview = await transformPreviewData(
      csvData.slice(0, 10),
      mappings,
      transformations
    );
    setPreviewData(preview);
    validateMappings(preview);
  };

  const handleFieldDrop = (sourceField, targetField) => {
    setMappings(prev => ({
      ...prev,
      [targetField]: sourceField
    }));
  };

  return (
    <div className="field-mapping">
      <div className="mapping-header">
        <h3>Field Mapping</h3>
        <MappingSummary mappings={mappings} />
      </div>

      <div className="mapping-workspace">
        <SourceFields 
          fields={csvData.columns}
          onFieldDrop={handleFieldDrop}
        />
        <MappingCanvas 
          mappings={mappings}
          onMappingChange={setMappings}
        />
        <TargetFields 
          fields={apiSchema.requestFields}
          mappings={mappings}
          onFieldDrop={handleFieldDrop}
        />
      </div>

      <TransformationPanel 
        mappings={mappings}
        transformations={transformations}
        onChange={setTransformations}
      />

      <PreviewPanel 
        data={previewData}
        validation={validation}
      />
    </div>
  );
};
```

**Source Fields Component:**
```javascript
const SourceFields = ({ fields, onFieldDrop }) => {
  return (
    <div className="source-fields">
      <h4>CSV Columns</h4>
      <div className="field-list">
        {fields.map(field => (
          <DraggableField
            key={field.name}
            field={field}
            type="source"
            onDrop={onFieldDrop}
          >
            <div className="field-item">
              <span className="field-name">{field.name}</span>
              <span className={`field-type ${field.detectedType}`}>
                {field.detectedType}
              </span>
              <span className="field-sample">
                {field.sampleValue}
              </span>
            </div>
          </DraggableField>
        ))}
      </div>
    </div>
  );
};
```

**Target Fields Component:**
```javascript
const TargetFields = ({ fields, mappings, onFieldDrop }) => {
  return (
    <div className="target-fields">
      <h4>API Fields</h4>
      <div className="field-list">
        {fields.map(field => (
          <DroppableField
            key={field.name}
            field={field}
            type="target"
            onDrop={onFieldDrop}
            mappedField={mappings[field.name]}
          >
            <div className={`field-item ${mappings[field.name] ? 'mapped' : 'unmapped'}`}>
              <span className="field-name">{field.name}</span>
              <span className={`field-type ${field.type}`}>
                {field.type}
              </span>
              {field.required && <span className="required">*</span>}
              {mappings[field.name] && (
                <span className="mapped-source">
                  ← {mappings[field.name]}
                </span>
              )}
            </div>
          </DroppableField>
        ))}
      </div>
    </div>
  );
};
```

**Transformation Panel:**
```javascript
const TransformationPanel = ({ mappings, transformations, onChange }) => {
  const [selectedField, setSelectedField] = useState(null);

  return (
    <div className="transformation-panel">
      <h4>Field Transformations</h4>
      <div className="transformation-list">
        {Object.entries(mappings).map(([targetField, sourceField]) => (
          <TransformationItem
            key={targetField}
            targetField={targetField}
            sourceField={sourceField}
            transformation={transformations[`${sourceField}->${targetField}`]}
            onChange={(transformation) => onChange({
              ...transformations,
              [`${sourceField}->${targetField}`]: transformation
            })}
            onSelect={() => setSelectedField(targetField)}
          />
        ))}
      </div>

      {selectedField && (
        <TransformationEditor
          field={selectedField}
          transformation={transformations[selectedField]}
          onChange={(transformation) => onChange({
            ...transformations,
            [selectedField]: transformation
          })}
        />
      )}
    </div>
  );
};
```

**Transformation Editor:**
```javascript
const TransformationEditor = ({ field, transformation, onChange }) => {
  return (
    <div className="transformation-editor">
      <h5>Transform {field}</h5>
      
      <div className="transformation-type">
        <label>Transformation Type</label>
        <select
          value={transformation.type || 'none'}
          onChange={(e) => onChange({
            ...transformation,
            type: e.target.value
          })}
        >
          <option value="none">No Transformation</option>
          <option value="format">Format String</option>
          <option value="calculate">Calculate</option>
          <option value="conditional">Conditional</option>
          <option value="lookup">Lookup Value</option>
          <option value="custom">Custom Function</option>
        </select>
      </div>

      {transformation.type === 'format' && (
        <div className="format-options">
          <label>Format Pattern</label>
          <input
            type="text"
            value={transformation.pattern || ''}
            onChange={(e) => onChange({
              ...transformation,
              pattern: e.target.value
            })}
            placeholder="e.g., {{value}}@example.com"
          />
        </div>
      )}

      {transformation.type === 'calculate' && (
        <div className="calculate-options">
          <label>Expression</label>
          <input
            type="text"
            value={transformation.expression || ''}
            onChange={(e) => onChange({
              ...transformation,
              expression: e.target.value
            })}
            placeholder="e.g., value * 1.1"
          />
        </div>
      )}

      {transformation.type === 'conditional' && (
        <div className="conditional-options">
          <label>Condition</label>
          <input
            type="text"
            value={transformation.condition || ''}
            onChange={(e) => onChange({
              ...transformation,
              condition: e.target.value
            })}
            placeholder="e.g., value > 100"
          />
          
          <label>True Value</label>
          <input
            type="text"
            value={transformation.trueValue || ''}
            onChange={(e) => onChange({
              ...transformation,
              trueValue: e.target.value
            })}
          />
          
          <label>False Value</label>
          <input
            type="text"
            value={transformation.falseValue || ''}
            onChange={(e) => onChange({
              ...transformation,
              falseValue: e.target.value
            })}
          />
        </div>
      )}
    </div>
  );
};
```

**Transformation Engine:**
```javascript
class TransformationEngine {
  async transformRow(row, mappings, transformations) {
    const transformed = {};
    
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
      case 'format':
        return this.formatString(value, transformation.pattern);
      case 'calculate':
        return this.calculate(value, transformation.expression);
      case 'conditional':
        return this.conditional(value, transformation);
      case 'lookup':
        return this.lookup(value, transformation.lookupTable);
      case 'custom':
        return this.customFunction(value, transformation.function);
      default:
        return value;
    }
  }
  
  formatString(value, pattern) {
    return pattern.replace(/\{\{value\}\}/g, value);
  }
  
  calculate(value, expression) {
    // Safe evaluation of mathematical expressions
    try {
      return eval(expression.replace(/value/g, value));
    } catch (error) {
      return value;
    }
  }
  
  conditional(value, config) {
    try {
      const condition = eval(config.condition.replace(/value/g, value));
      return condition ? config.trueValue : config.falseValue;
    } catch (error) {
      return value;
    }
  }
}
```

**Field Type Detection:**
```javascript
class FieldTypeDetector {
  detectType(values) {
    const types = values.map(value => this.getValueType(value));
    const typeCounts = types.reduce((acc, type) => {
      acc[type] = (acc[type] || 0) + 1;
      return acc;
    }, {});
    
    // Return the most common type
    return Object.entries(typeCounts)
      .sort(([,a], [,b]) => b - a)[0][0];
  }
  
  getValueType(value) {
    if (value === '' || value === null || value === undefined) {
      return 'null';
    }
    
    // Check for numbers
    if (!isNaN(value) && !isNaN(parseFloat(value))) {
      return value.includes('.') ? 'float' : 'integer';
    }
    
    // Check for dates
    if (!isNaN(Date.parse(value))) {
      return 'date';
    }
    
    // Check for booleans
    if (['true', 'false', 'yes', 'no', '1', '0'].includes(value.toLowerCase())) {
      return 'boolean';
    }
    
    // Check for emails
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'email';
    }
    
    // Default to string
    return 'string';
  }
}
```

**Error Handling:**
- Invalid transformations: Clear error messages with correction suggestions
- Type conversion failures: Automatic type coercion with warnings
- Missing required fields: Visual highlighting and mapping suggestions
- Preview generation failures: Fallback to basic mapping display

## Success Criteria

- Drag-and-drop mapping responds within 100ms
- Real-time preview updates within 200ms
- Field type detection works with 95%+ accuracy
- Transformation engine handles all common data types
- Interface supports 100+ fields without performance issues

## Monitoring and Observability

**Metrics to Track:**
- Mapping interaction response times
- Preview generation performance
- Transformation success rates
- Field type detection accuracy

**Alerts:**
- Interface response time >500ms
- Preview update time >1 second
- Transformation failure rate >5%
- Memory usage during mapping >200MB

## Integration Points

**Upstream:**
- CSV processing pipeline (source data)
- API client generation (target schema)

**Downstream:**
- Data transformation engine (processing)
- Validation service (mapping validation)
- Preview API (real-time updates)

## User Experience Features

**Visual Feedback:**
- Color-coded field types
- Connection lines between mapped fields
- Validation status indicators
- Transformation preview tooltips

**Mapping Assistance:**
- Automatic field name matching
- Type compatibility suggestions
- Required field highlighting
- Mapping templates for common patterns

**Advanced Features:**
- Bulk field operations
- Mapping templates
- Import/export mappings
- Mapping validation and suggestions