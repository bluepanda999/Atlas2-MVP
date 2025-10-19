# Story 3.4: Mapping Templates & Automation - Brownfield Addition

## User Story

As a data analyst,
I want to save and reuse field mapping configurations as templates,
So that I can quickly process similar CSV files without recreating mappings manually.

## Story Context

**Existing System Integration:**
- Integrates with: Field mapping interface (Story 3.1), validation system (Story 3.3), transformation engine (Story 3.2)
- Technology: React frontend for template management, Node.js backend for template storage, pattern matching algorithms
- Follows pattern: Template management patterns, configuration storage, automation frameworks
- Touch points: Template API, template library interface, auto-mapping engine, template sharing

## Acceptance Criteria

**Functional Requirements:**
1. Template creation and management with naming, description, and tagging capabilities
2. Auto-mapping suggestions based on column name patterns, data types, and historical usage
3. Template library with search, filtering, and categorization functionality
4. Template sharing and import/export capabilities for team collaboration
5. Template versioning with change tracking and rollback functionality

**Integration Requirements:**
4. Existing mapping patterns remain unchanged (templates provide preset configurations)
5. New functionality follows existing configuration storage and management patterns
6. Integration with validation system maintains current template validation patterns

**Quality Requirements:**
7. Template auto-matching accuracy >80% for common field name patterns
8. Template library loads within 2 seconds with 100+ templates
9. Template application completes within 1 second for any mapping configuration
10. Template search and filtering respond within 100ms

## Technical Notes

- **Integration Approach:** Template system integrates with mapping interface through configuration preset mechanism
- **Existing Pattern Reference:** Follow established configuration management and pattern matching frameworks
- **Key Constraints:** Must provide intelligent matching, support collaboration, maintain version control

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (template guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Auto-matching suggestions creating incorrect mappings
- **Mitigation:** Implement confidence scoring, user confirmation, and validation checks
- **Rollback:** Disable auto-matching and provide manual template selection if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing mapping interface
- [ ] Template system follows existing configuration patterns
- [ ] Template storage uses existing database patterns
- [ ] Auto-matching integrates with existing validation framework

## Story Points Estimation

**Estimation:** 5 points
- Template management system: 2 points
- Auto-matching engine: 2 points
- Template library interface: 1 point

## Dependencies

- Field mapping interface (Story 3.1)
- Validation system (Story 3.3)
- Configuration storage foundation

## Testing Requirements

**Unit Tests:**
- Template creation and storage
- Pattern matching algorithms
- Auto-matching logic
- Template versioning

**Integration Tests:**
- End-to-end template application
- Auto-matching accuracy
- Template sharing workflows
- Template import/export

**Performance Tests:**
- Template library loading speed
- Auto-matching performance
- Template application speed
- Search and filtering responsiveness

## Implementation Notes

**Template Manager:**
```javascript
class MappingTemplateManager {
  constructor(storage) {
    this.storage = storage;
    this.patternMatcher = new FieldPatternMatcher();
    this.versionManager = new TemplateVersionManager();
  }

  async createTemplate(templateData) {
    const template = {
      id: this.generateId(),
      name: templateData.name,
      description: templateData.description,
      tags: templateData.tags || [],
      mappings: templateData.mappings,
      transformations: templateData.transformations,
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
        author: templateData.author,
        sourceSchema: templateData.sourceSchema,
        targetSchema: templateData.targetSchema
      }
    };

    // Validate template
    await this.validateTemplate(template);

    // Save to storage
    await this.storage.saveTemplate(template);

    return template;
  }

  async updateTemplate(templateId, updates) {
    const existingTemplate = await this.storage.getTemplate(templateId);
    if (!existingTemplate) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Create new version
    const newVersion = await this.versionManager.createVersion(
      existingTemplate,
      updates
    );

    // Save updated template
    await this.storage.saveTemplate(newVersion);

    return newVersion;
  }

  async findMatchingTemplates(csvColumns, targetSchema, options = {}) {
    const allTemplates = await this.storage.getAllTemplates();
    const matches = [];

    for (const template of allTemplates) {
      const matchScore = await this.calculateMatchScore(
        csvColumns,
        targetSchema,
        template,
        options
      );

      if (matchScore.score > options.minScore || 0.3) {
        matches.push({
          template,
          score: matchScore.score,
          details: matchScore.details
        });
      }
    }

    // Sort by score (highest first)
    return matches.sort((a, b) => b.score - a.score);
  }

  async calculateMatchScore(csvColumns, targetSchema, template, options) {
    const weights = {
      nameMatch: options.nameMatchWeight || 0.4,
      typeMatch: options.typeMatchWeight || 0.3,
      patternMatch: options.patternMatchWeight || 0.2,
      usage: options.usageWeight || 0.1
    };

    let totalScore = 0;
    let maxScore = 0;
    const details = {
      nameMatches: [],
      typeMatches: [],
      patternMatches: [],
      usage: template.metadata.usageCount || 0
    };

    // Check column name matches
    for (const csvColumn of csvColumns) {
      for (const [targetField, sourceField] of Object.entries(template.mappings)) {
        if (!sourceField) continue;

        const nameSimilarity = this.patternMatcher.calculateNameSimilarity(
          csvColumn.name,
          sourceField
        );

        if (nameSimilarity > 0.7) {
          details.nameMatches.push({
            csvColumn: csvColumn.name,
            templateField: sourceField,
            similarity: nameSimilarity
          });
          totalScore += nameSimilarity * weights.nameMatch;
        }
        maxScore += weights.nameMatch;
      }
    }

    // Check type compatibility
    for (const csvColumn of csvColumns) {
      for (const [targetField, sourceField] of Object.entries(template.mappings)) {
        if (!sourceField || sourceField !== csvColumn.name) continue;

        const typeCompatibility = this.patternMatcher.calculateTypeCompatibility(
          csvColumn.detectedType,
          template.targetSchema[targetField]?.type
        );

        details.typeMatches.push({
          field: sourceField,
          sourceType: csvColumn.detectedType,
          targetType: template.targetSchema[targetField]?.type,
          compatibility: typeCompatibility
        });
        totalScore += typeCompatibility * weights.typeMatch;
        maxScore += weights.typeMatch;
      }
    }

    // Check pattern matches
    const patternScore = this.patternMatcher.calculatePatternMatch(
      csvColumns,
      template.sourceSchema
    );
    details.patternMatches = patternScore.matches;
    totalScore += patternScore.score * weights.patternMatch;
    maxScore += weights.patternMatch;

    // Add usage score
    const usageScore = Math.min(details.usage / 100, 1); // Normalize to 0-1
    totalScore += usageScore * weights.usage;
    maxScore += weights.usage;

    return {
      score: maxScore > 0 ? totalScore / maxScore : 0,
      details
    };
  }

  async applyTemplate(templateId, csvColumns, options = {}) {
    const template = await this.storage.getTemplate(templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    // Auto-map fields based on template
    const mappings = {};
    const transformations = { ...template.transformations };

    for (const [targetField, templateSourceField] of Object.entries(template.mappings)) {
      if (!templateSourceField) continue;

      // Find best matching CSV column
      const bestMatch = this.findBestColumnMatch(
        csvColumns,
        templateSourceField,
        options
      );

      if (bestMatch && bestMatch.confidence > (options.minConfidence || 0.7)) {
        mappings[targetField] = bestMatch.column.name;
      }
    }

    // Update template usage
    await this.incrementUsage(templateId);

    return {
      mappings,
      transformations,
      template: {
        id: template.id,
        name: template.name,
        version: template.metadata.version
      },
      confidence: this.calculateOverallConfidence(mappings, csvColumns, template)
    };
  }

  findBestColumnMatch(csvColumns, templateField, options = {}) {
    let bestMatch = null;
    let bestScore = 0;

    for (const column of csvColumns) {
      const score = this.patternMatcher.calculateNameSimilarity(
        column.name,
        templateField
      );

      if (score > bestScore && score > (options.minScore || 0.5)) {
        bestScore = score;
        bestMatch = {
          column,
          confidence: score,
          reasons: [`Name similarity: ${(score * 100).toFixed(1)}%`]
        };
      }
    }

    return bestMatch;
  }

  calculateOverallConfidence(mappings, csvColumns, template) {
    if (Object.keys(mappings).length === 0) return 0;

    const totalTemplateFields = Object.keys(template.mappings).filter(
      field => template.mappings[field]
    ).length;

    const mappedFields = Object.keys(mappings).length;
    const coverageScore = mappedFields / totalTemplateFields;

    // Calculate average name similarity
    let totalSimilarity = 0;
    let similarityCount = 0;

    for (const [targetField, sourceField] of Object.entries(mappings)) {
      const templateSourceField = template.mappings[targetField];
      const similarity = this.patternMatcher.calculateNameSimilarity(
        sourceField,
        templateSourceField
      );
      totalSimilarity += similarity;
      similarityCount++;
    }

    const averageSimilarity = similarityCount > 0 ? totalSimilarity / similarityCount : 0;

    return (coverageScore * 0.6) + (averageSimilarity * 0.4);
  }

  async validateTemplate(template) {
    const errors = [];

    if (!template.name || template.name.trim() === '') {
      errors.push('Template name is required');
    }

    if (!template.mappings || Object.keys(template.mappings).length === 0) {
      errors.push('Template must have at least one mapping');
    }

    // Validate mapping structure
    for (const [targetField, sourceField] of Object.entries(template.mappings)) {
      if (typeof targetField !== 'string' || targetField.trim() === '') {
        errors.push(`Invalid target field: ${targetField}`);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Template validation failed: ${errors.join(', ')}`);
    }
  }

  generateId() {
    return 'tpl_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  async incrementUsage(templateId) {
    const template = await this.storage.getTemplate(templateId);
    if (template) {
      template.metadata.usageCount = (template.metadata.usageCount || 0) + 1;
      template.metadata.lastUsed = new Date();
      await this.storage.saveTemplate(template);
    }
  }
}
```

**Field Pattern Matcher:**
```javascript
class FieldPatternMatcher {
  constructor() {
    this.commonPatterns = {
      email: [/email/i, /e-mail/i, /email_address/i],
      name: [/name/i, /full_name/i, /customer_name/i],
      phone: [/phone/i, /telephone/i, /mobile/i],
      address: [/address/i, /street/i, /location/i],
      date: [/date/i, /time/i, /created/i, /updated/i],
      id: [/id/i, /identifier/i, /key/i],
      amount: [/amount/i, /price/i, /cost/i, /total/i],
      status: [/status/i, /state/i, /condition/i]
    };

    this.nameSeparators = /[_\-\s]/g;
    this.commonAbbreviations = {
      'addr': 'address',
      'tel': 'telephone',
      'ph': 'phone',
      'num': 'number',
      'qty': 'quantity',
      'amt': 'amount'
    };
  }

  calculateNameSimilarity(name1, name2) {
    // Normalize names
    const normalized1 = this.normalizeName(name1);
    const normalized2 = this.normalizeName(name2);

    if (normalized1 === normalized2) {
      return 1.0;
    }

    // Calculate similarity using multiple methods
    const exactMatch = normalized1 === normalized2 ? 1.0 : 0.0;
    const containsMatch = normalized1.includes(normalized2) || normalized2.includes(normalized1) ? 0.8 : 0.0;
    const levenshteinSimilarity = this.calculateLevenshteinSimilarity(normalized1, normalized2);
    const patternMatch = this.calculatePatternSimilarity(name1, name2);

    // Weight the different similarity measures
    return Math.max(
      exactMatch,
      containsMatch,
      levenshteinSimilarity * 0.7,
      patternMatch * 0.6
    );
  }

  normalizeName(name) {
    return name
      .toLowerCase()
      .replace(this.nameSeparators, '')
      .replace(/\s+/g, '');
  }

  calculateLevenshteinSimilarity(str1, str2) {
    const distance = this.levenshteinDistance(str1, str2);
    const maxLength = Math.max(str1.length, str2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 1;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  calculatePatternSimilarity(name1, name2) {
    let similarity = 0;

    for (const [pattern, regexes] of Object.entries(this.commonPatterns)) {
      const match1 = regexes.some(regex => regex.test(name1));
      const match2 = regexes.some(regex => regex.test(name2));

      if (match1 && match2) {
        similarity = Math.max(similarity, 0.9);
      }
    }

    return similarity;
  }

  calculateTypeCompatibility(sourceType, targetType) {
    const compatibilityMatrix = {
      'string': { 'string': 1.0, 'integer': 0.3, 'float': 0.3, 'boolean': 0.2, 'date': 0.4 },
      'integer': { 'string': 0.9, 'integer': 1.0, 'float': 0.9, 'boolean': 0.7, 'date': 0.1 },
      'float': { 'string': 0.9, 'integer': 0.8, 'float': 1.0, 'boolean': 0.6, 'date': 0.1 },
      'boolean': { 'string': 0.8, 'integer': 0.7, 'float': 0.6, 'boolean': 1.0, 'date': 0.0 },
      'date': { 'string': 0.9, 'integer': 0.1, 'float': 0.1, 'boolean': 0.0, 'date': 1.0 }
    };

    return compatibilityMatrix[sourceType]?.[targetType] || 0;
  }

  calculatePatternMatch(csvColumns, templateSchema) {
    let matches = [];
    let totalScore = 0;
    let maxScore = 0;

    for (const csvColumn of csvColumns) {
      for (const templateField of templateSchema) {
        const patternScore = this.calculatePatternSimilarity(
          csvColumn.name,
          templateField.name
        );

        if (patternScore > 0.5) {
          matches.push({
            csvColumn: csvColumn.name,
            templateField: templateField.name,
            score: patternScore
          });
          totalScore += patternScore;
        }
        maxScore += 1.0;
      }
    }

    return {
      score: maxScore > 0 ? totalScore / maxScore : 0,
      matches
    };
  }
}
```

**Template Library Interface:**
```javascript
const TemplateLibrary = ({ onTemplateSelect, csvColumns, targetSchema }) => {
  const [templates, setTemplates] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState('all');
  const [sortBy, setSortBy] = useState('usage');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    setLoading(true);
    try {
      const templateManager = new MappingTemplateManager();
      const allTemplates = await templateManager.storage.getAllTemplates();
      setTemplates(allTemplates);
    } catch (error) {
      showError('Failed to load templates');
    } finally {
      setLoading(false);
    }
  };

  const filteredTemplates = useMemo(() => {
    let filtered = templates;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by tag
    if (selectedTag !== 'all') {
      filtered = filtered.filter(template =>
        template.tags.includes(selectedTag)
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return (b.metadata.usageCount || 0) - (a.metadata.usageCount || 0);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'created':
          return new Date(b.metadata.createdAt) - new Date(a.metadata.createdAt);
        default:
          return 0;
      }
    });

    return filtered;
  }, [templates, searchTerm, selectedTag, sortBy]);

  const handleTemplateSelect = async (template) => {
    try {
      const templateManager = new MappingTemplateManager();
      const result = await templateManager.applyTemplate(template.id, csvColumns);
      onTemplateSelect(result);
    } catch (error) {
      showError('Failed to apply template: ' + error.message);
    }
  };

  return (
    <div className="template-library">
      <div className="library-header">
        <h3>Template Library</h3>
        <button onClick={() => setShowCreateDialog(true)}>
          Create Template
        </button>
      </div>

      <div className="library-controls">
        <SearchBar value={searchTerm} onChange={setSearchTerm} />
        <TagFilter 
          selected={selectedTag} 
          onChange={setSelectedTag}
          tags={getAllTags(templates)} 
        />
        <SortSelector value={sortBy} onChange={setSortBy} />
      </div>

      <div className="template-grid">
        {filteredTemplates.map(template => (
          <TemplateCard
            key={template.id}
            template={template}
            onSelect={() => handleTemplateSelect(template)}
            csvColumns={csvColumns}
            targetSchema={targetSchema}
          />
        ))}
      </div>

      {loading && <div className="loading">Loading templates...</div>}
    </div>
  );
};
```

**Template Card Component:**
```javascript
const TemplateCard = ({ template, onSelect, csvColumns, targetSchema }) => {
  const [matchScore, setMatchScore] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    calculateMatchScore();
  }, [template, csvColumns, targetSchema]);

  const calculateMatchScore = async () => {
    if (!csvColumns || !targetSchema) return;

    setLoading(true);
    try {
      const templateManager = new MappingTemplateManager();
      const matches = await templateManager.findMatchingTemplates(
        csvColumns,
        targetSchema,
        { minScore: 0 }
      );

      const match = matches.find(m => m.template.id === template.id);
      setMatchScore(match ? match.score : 0);
    } catch (error) {
      console.error('Failed to calculate match score:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="template-card">
      <div className="card-header">
        <h4>{template.name}</h4>
        {matchScore !== null && (
          <div className="match-score">
            <span className="score-label">Match:</span>
            <span className={`score-value ${matchScore > 0.7 ? 'high' : matchScore > 0.4 ? 'medium' : 'low'}`}>
              {(matchScore * 100).toFixed(0)}%
            </span>
          </div>
        )}
      </div>

      <div className="card-description">
        {template.description}
      </div>

      <div className="card-metadata">
        <div className="metadata-item">
          <span className="label">Fields:</span>
          <span className="value">
            {Object.keys(template.mappings).filter(k => template.mappings[k]).length}
          </span>
        </div>
        <div className="metadata-item">
          <span className="label">Usage:</span>
          <span className="value">{template.metadata.usageCount || 0}</span>
        </div>
        <div className="metadata-item">
          <span className="label">Version:</span>
          <span className="value">{template.metadata.version}</span>
        </div>
      </div>

      <div className="card-tags">
        {template.tags.map(tag => (
          <span key={tag} className="tag">{tag}</span>
        ))}
      </div>

      <div className="card-actions">
        <button 
          onClick={onSelect}
          disabled={loading || matchScore === 0}
          className={matchScore > 0.7 ? 'primary' : 'secondary'}
        >
          {loading ? 'Loading...' : 'Apply Template'}
        </button>
        <button onClick={() => viewTemplateDetails(template.id)}>
          Details
        </button>
      </div>
    </div>
  );
};
```

**Template Version Manager:**
```javascript
class TemplateVersionManager {
  async createVersion(existingTemplate, updates) {
    const newVersion = {
      ...existingTemplate,
      ...updates,
      metadata: {
        ...existingTemplate.metadata,
        ...updates.metadata,
        version: existingTemplate.metadata.version + 1,
        updatedAt: new Date(),
        previousVersion: existingTemplate.metadata.version
      }
    };

    // Store version history
    await this.storeVersionHistory(existingTemplate, newVersion);

    return newVersion;
  }

  async storeVersionHistory(oldTemplate, newTemplate) {
    const historyEntry = {
      templateId: oldTemplate.id,
      fromVersion: oldTemplate.metadata.version,
      toVersion: newTemplate.metadata.version,
      changes: this.calculateChanges(oldTemplate, newTemplate),
      timestamp: new Date(),
      author: newTemplate.metadata.author
    };

    // Save to version history storage
    await this.storage.saveVersionHistory(historyEntry);
  }

  calculateChanges(oldTemplate, newTemplate) {
    const changes = [];

    // Check mapping changes
    const oldMappings = oldTemplate.mappings;
    const newMappings = newTemplate.mappings;

    for (const [field, newValue] of Object.entries(newMappings)) {
      const oldValue = oldMappings[field];
      if (oldValue !== newValue) {
        changes.push({
          type: 'mapping_change',
          field,
          oldValue,
          newValue
        });
      }
    }

    // Check transformation changes
    const oldTransformations = oldTemplate.transformations || {};
    const newTransformations = newTemplate.transformations || {};

    for (const [key, newValue] of Object.entries(newTransformations)) {
      const oldValue = oldTransformations[key];
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          type: 'transformation_change',
          key,
          oldValue,
          newValue
        });
      }
    }

    return changes;
  }
}
```

**Error Handling:**
- Template validation failures: Detailed error messages with field-specific guidance
- Auto-matching errors: Fallback to manual template selection
- Template application failures: Partial application with error reporting
- Version conflicts: Clear conflict resolution options

## Success Criteria

- Template auto-matching accuracy >80% for common field name patterns
- Template library loads within 2 seconds with 100+ templates
- Template application completes within 1 second
- Template search and filtering respond within 100ms
- Template versioning maintains complete change history

## Monitoring and Observability

**Metrics to Track:**
- Template usage statistics
- Auto-matching accuracy rates
- Template application success rates
- User interaction patterns

**Alerts:**
- Auto-matching accuracy <70%
- Template library loading time >5 seconds
- Template application failure rate >5%
- Template storage errors

## Integration Points

**Upstream:**
- Field mapping interface (template application)
- Validation system (template validation)

**Downstream:**
- Template storage (persistence)
- Version control system (history tracking)
- Sharing system (collaboration)

## Template Features

**Auto-Matching:**
- Name similarity algorithms
- Pattern recognition
- Type compatibility checking
- Usage-based ranking

**Template Management:**
- Creation and editing
- Version control
- Tagging and categorization
- Search and filtering

**Collaboration:**
- Template sharing
- Import/export functionality
- Team libraries
- Usage analytics

**Automation:**
- Automatic template suggestions
- Batch template application
- Template optimization
- Performance monitoring