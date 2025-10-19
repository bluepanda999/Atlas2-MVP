# Story 5.2: Comprehensive Error Reporting - Brownfield Addition

## User Story

As a data analyst,
I want detailed error reporting with categorization, context, and recovery suggestions,
So that I can quickly understand and resolve issues in my data processing workflows.

## Story Context

**Existing System Integration:**
- Integrates with: Progress monitoring (Story 5.1), CSV processing pipeline (Epic 1), field mapping interface (Epic 3)
- Technology: Node.js backend with error aggregation, React frontend for error visualization, error classification system
- Follows pattern: Error handling frameworks, reporting standards, recovery guidance patterns
- Touch points: Error reporting API, error classification engine, recovery suggestion system, error dashboard

## Acceptance Criteria

**Functional Requirements:**
1. Comprehensive error categorization with severity levels (critical, warning, info) and error types
2. Detailed error context including row numbers, field names, data samples, and stack traces
3. Automated error analysis with pattern detection and root cause identification
4. Recovery suggestions with step-by-step guidance and automated fix options where possible
5. Error reporting dashboard with filtering, searching, and export capabilities

**Integration Requirements:**
4. Existing error handling patterns remain unchanged (new reporting system aggregates existing errors)
5. New functionality follows existing logging and error classification patterns
6. Integration with all processing pipelines maintains current error flow patterns

**Quality Requirements:**
7. Error classification accuracy >90% for common error types
8. Error context collection adds <50ms overhead to processing
9. Recovery suggestions are actionable for >80% of common errors
10. Error dashboard loads within 2 seconds with 1000+ error records

## Technical Notes

- **Integration Approach:** Error reporting integrates with existing processing pipelines through error listeners
- **Existing Pattern Reference:** Follow established error handling and logging frameworks
- **Key Constraints:** Must provide accurate classification, detailed context, actionable recovery guidance

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (error handling guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Error collection overhead impacting processing performance
- **Mitigation:** Implement asynchronous error collection, batching, and configurable detail levels
- **Rollback:** Disable detailed error collection and maintain basic error logging if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing error handling
- [ ] Error reporting follows existing logging patterns
- [ ] Classification system integrates with existing error types
- [ ] Recovery suggestions use existing resolution patterns

## Story Points Estimation

**Estimation:** 8 points
- Error classification engine: 3 points
- Recovery suggestion system: 2 points
- Error reporting dashboard: 2 points
- Error context collection: 1 point

## Dependencies

- Progress monitoring (Story 5.1)
- CSV processing pipeline (Epic 1)
- Field mapping interface (Epic 3)
- Error logging foundation

## Testing Requirements

**Unit Tests:**
- Error classification algorithms
- Recovery suggestion logic
- Error context collection
- Pattern detection accuracy

**Integration Tests:**
- End-to-end error reporting
- Error dashboard functionality
- Recovery suggestion effectiveness
- Error export capabilities

**Performance Tests:**
- Error collection overhead
- Classification processing speed
- Dashboard loading performance
- Error search responsiveness

## Implementation Notes

**Error Reporter:**
```javascript
class ErrorReporter {
  constructor(options = {}) {
    this.classifier = new ErrorClassifier(options);
    this.contextCollector = new ErrorContextCollector(options);
    this.recoveryEngine = new RecoverySuggestionEngine(options);
    this.errorStorage = new ErrorStorage(options);
    this.patternDetector = new ErrorPatternDetector(options);
  }

  async reportError(error, context = {}) {
    try {
      // Collect detailed error context
      const errorContext = await this.contextCollector.collect(error, context);
      
      // Classify the error
      const classification = await this.classifier.classify(error, errorContext);
      
      // Detect patterns
      const patterns = await this.patternDetector.detectPatterns(error, errorContext);
      
      // Generate recovery suggestions
      const suggestions = await this.recoveryEngine.generateSuggestions(
        error, 
        errorContext, 
        classification,
        patterns
      );

      // Create comprehensive error report
      const errorReport = {
        id: this.generateErrorId(),
        timestamp: new Date(),
        severity: classification.severity,
        category: classification.category,
        type: classification.type,
        message: error.message,
        stackTrace: error.stack,
        context: errorContext,
        classification,
        patterns,
        suggestions,
        jobId: context.jobId,
        userId: context.userId,
        resolved: false
      };

      // Store error report
      await this.errorStorage.store(errorReport);

      // Trigger real-time notifications for critical errors
      if (classification.severity === 'critical') {
        await this.triggerCriticalErrorAlert(errorReport);
      }

      return errorReport;
    } catch (reportingError) {
      // Fallback error logging
      console.error('Failed to report error:', reportingError);
      console.error('Original error:', error);
    }
  }

  async getErrorReports(filters = {}) {
    try {
      return await this.errorStorage.query(filters);
    } catch (error) {
      console.error('Failed to get error reports:', error);
      return [];
    }
  }

  async resolveError(errorId, resolution) {
    try {
      const errorReport = await this.errorStorage.getById(errorId);
      if (!errorReport) {
        throw new Error(`Error report not found: ${errorId}`);
      }

      errorReport.resolved = true;
      errorReport.resolution = {
        type: resolution.type, // manual, automated, ignored
        description: resolution.description,
        timestamp: new Date(),
        userId: resolution.userId
      };

      await this.errorStorage.update(errorId, errorReport);

      // Learn from the resolution for future suggestions
      await this.recoveryEngine.learnFromResolution(errorReport, resolution);

      return errorReport;
    } catch (error) {
      console.error('Failed to resolve error:', error);
      throw error;
    }
  }

  async getErrorStatistics(timeRange = 24) { // Default: last 24 hours
    try {
      const reports = await this.errorStorage.query({
        timestamp: {
          gte: new Date(Date.now() - timeRange * 60 * 60 * 1000)
        }
      });

      const stats = {
        total: reports.length,
        bySeverity: {},
        byCategory: {},
        byType: {},
        resolved: reports.filter(r => r.resolved).length,
        patterns: {},
        topErrors: this.getTopErrors(reports)
      };

      reports.forEach(report => {
        // Count by severity
        stats.bySeverity[report.severity] = (stats.bySeverity[report.severity] || 0) + 1;
        
        // Count by category
        stats.byCategory[report.category] = (stats.byCategory[report.category] || 0) + 1;
        
        // Count by type
        stats.byType[report.type] = (stats.byType[report.type] || 0) + 1;
        
        // Count patterns
        report.patterns.forEach(pattern => {
          stats.patterns[pattern.type] = (stats.patterns[pattern.type] || 0) + 1;
        });
      });

      return stats;
    } catch (error) {
      console.error('Failed to get error statistics:', error);
      return {};
    }
  }

  getTopErrors(reports, limit = 10) {
    const errorCounts = {};
    
    reports.forEach(report => {
      const key = `${report.category}:${report.type}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, limit)
      .map(([errorType, count]) => ({ errorType, count }));
  }

  async triggerCriticalErrorAlert(errorReport) {
    // In production, integrate with alerting system
    console.error('CRITICAL ERROR:', {
      id: errorReport.id,
      message: errorReport.message,
      category: errorReport.category,
      jobId: errorReport.jobId
    });

    // Send notification to monitoring system
    await this.sendAlert({
      type: 'critical_error',
      errorId: errorReport.id,
      message: errorReport.message,
      category: errorReport.category,
      jobId: errorReport.jobId,
      userId: errorReport.userId,
      timestamp: errorReport.timestamp
    });
  }

  async sendAlert(alert) {
    // Integration with external alerting system
    // For now, just log the alert
    console.log('ALERT:', alert);
  }

  generateErrorId() {
    return 'err_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
```

**Error Classifier:**
```javascript
class ErrorClassifier {
  constructor(options = {}) {
    this.classificationRules = this.loadClassificationRules();
    this.severityRules = this.loadSeverityRules();
  }

  async classify(error, context) {
    const classification = {
      category: 'unknown',
      type: 'general',
      severity: 'warning',
      confidence: 0.5
    };

    // Classify by error message patterns
    const messageClassification = this.classifyByMessage(error.message);
    if (messageClassification.confidence > classification.confidence) {
      Object.assign(classification, messageClassification);
    }

    // Classify by error type
    const typeClassification = this.classifyByErrorType(error);
    if (typeClassification.confidence > classification.confidence) {
      Object.assign(classification, typeClassification);
    }

    // Classify by context
    const contextClassification = this.classifyByContext(context);
    if (contextClassification.confidence > classification.confidence) {
      Object.assign(classification, contextClassification);
    }

    // Determine severity
    classification.severity = this.determineSeverity(error, context, classification);

    return classification;
  }

  classifyByMessage(message) {
    const lowerMessage = message.toLowerCase();

    for (const rule of this.classificationRules.message) {
      if (rule.pattern.test(lowerMessage)) {
        return {
          category: rule.category,
          type: rule.type,
          confidence: rule.confidence
        };
      }
    }

    return { confidence: 0 };
  }

  classifyByErrorType(error) {
    const errorName = error.constructor.name;

    for (const rule of this.classificationRules.errorType) {
      if (rule.types.includes(errorName)) {
        return {
          category: rule.category,
          type: rule.type,
          confidence: rule.confidence
        };
      }
    }

    return { confidence: 0 };
  }

  classifyByContext(context) {
    let classification = { confidence: 0 };

    // Classify based on job type
    if (context.jobType) {
      const jobTypeRule = this.classificationRules.jobType[context.jobType];
      if (jobTypeRule) {
        classification = {
          category: jobTypeRule.category,
          type: jobTypeRule.type,
          confidence: jobTypeRule.confidence
        };
      }
    }

    // Classify based on processing step
    if (context.step && classification.confidence < 0.8) {
      const stepRule = this.classificationRules.step[context.step];
      if (stepRule) {
        classification = {
          category: stepRule.category,
          type: stepRule.type,
          confidence: Math.max(classification.confidence, stepRule.confidence)
        };
      }
    }

    return classification;
  }

  determineSeverity(error, context, classification) {
    // Critical errors
    if (classification.category === 'security' || 
        classification.category === 'data_loss' ||
        error.message.toLowerCase().includes('out of memory')) {
      return 'critical';
    }

    // Error conditions
    if (context.step === 'validation' && classification.category === 'data_quality') {
      return 'error';
    }

    // Warning conditions
    if (classification.category === 'performance' ||
        classification.category === 'data_quality') {
      return 'warning';
    }

    // Info conditions
    if (classification.category === 'configuration' ||
        classification.type === 'retry') {
      return 'info';
    }

    return 'warning'; // Default severity
  }

  loadClassificationRules() {
    return {
      message: [
        {
          pattern: /permission denied|unauthorized|forbidden/i,
          category: 'security',
          type: 'access_denied',
          confidence: 0.9
        },
        {
          pattern: /invalid.*format|malformed|syntax error/i,
          category: 'data_quality',
          type: 'format_error',
          confidence: 0.8
        },
        {
          pattern: /timeout|timed out/i,
          category: 'performance',
          type: 'timeout',
          confidence: 0.9
        },
        {
          pattern: /connection.*refused|network.*error/i,
          category: 'infrastructure',
          type: 'connectivity',
          confidence: 0.8
        },
        {
          pattern: /file not found|no such file/i,
          category: 'infrastructure',
          type: 'file_missing',
          confidence: 0.9
        },
        {
          pattern: /memory|heap/i,
          category: 'performance',
          type: 'memory',
          confidence: 0.8
        }
      ],
      errorType: [
        {
          types: ['ValidationError', 'SchemaError'],
          category: 'data_quality',
          type: 'validation_error',
          confidence: 0.9
        },
        {
          types: ['NetworkError', 'ConnectionError'],
          category: 'infrastructure',
          type: 'network_error',
          confidence: 0.9
        },
        {
          types: ['TimeoutError'],
          category: 'performance',
          type: 'timeout_error',
          confidence: 0.9
        }
      ],
      jobType: {
        csv_processing: {
          category: 'data_processing',
          type: 'csv_error',
          confidence: 0.7
        },
        field_mapping: {
          category: 'data_transformation',
          type: 'mapping_error',
          confidence: 0.7
        },
        api_upload: {
          category: 'api_integration',
          type: 'upload_error',
          confidence: 0.7
        }
      },
      step: {
        validation: {
          category: 'data_quality',
          type: 'validation_error',
          confidence: 0.8
        },
        transformation: {
          category: 'data_transformation',
          type: 'transformation_error',
          confidence: 0.8
        },
        upload: {
          category: 'api_integration',
          type: 'upload_error',
          confidence: 0.8
        }
      }
    };
  }

  loadSeverityRules() {
    return {
      critical: [
        'security',
        'data_loss',
        'system_failure'
      ],
      error: [
        'validation_error',
        'transformation_error',
        'upload_error'
      ],
      warning: [
        'performance',
        'data_quality',
        'format_error'
      ],
      info: [
        'configuration',
        'retry'
      ]
    };
  }
}
```

**Recovery Suggestion Engine:**
```javascript
class RecoverySuggestionEngine {
  constructor(options = {}) {
    this.suggestionRules = this.loadSuggestionRules();
    this.resolutionHistory = new Map();
  }

  async generateSuggestions(error, context, classification, patterns) {
    const suggestions = [];

    // Generate suggestions based on classification
    const classificationSuggestions = this.generateClassificationSuggestions(classification, context);
    suggestions.push(...classificationSuggestions);

    // Generate suggestions based on patterns
    const patternSuggestions = this.generatePatternSuggestions(patterns, context);
    suggestions.push(...patternSuggestions);

    // Generate suggestions based on historical resolutions
    const historicalSuggestions = this.generateHistoricalSuggestions(classification, context);
    suggestions.push(...historicalSuggestions);

    // Rank suggestions by relevance and confidence
    const rankedSuggestions = this.rankSuggestions(suggestions, error, context, classification);

    return rankedSuggestions.slice(0, 5); // Return top 5 suggestions
  }

  generateClassificationSuggestions(classification, context) {
    const suggestions = [];
    const key = `${classification.category}:${classification.type}`;

    if (this.suggestionRules[key]) {
      this.suggestionRules[key].forEach(rule => {
        if (this.matchesConditions(rule.conditions, context)) {
          suggestions.push({
            type: rule.type,
            title: rule.title,
            description: rule.description,
            steps: rule.steps,
            automated: rule.automated || false,
            confidence: rule.confidence || 0.7
          });
        }
      });
    }

    return suggestions;
  }

  generatePatternSuggestions(patterns, context) {
    const suggestions = [];

    patterns.forEach(pattern => {
      if (this.suggestionRules.patterns[pattern.type]) {
        const rule = this.suggestionRules.patterns[pattern.type];
        suggestions.push({
          type: 'pattern_based',
          title: rule.title,
          description: rule.description,
          steps: rule.steps,
          automated: rule.automated || false,
          confidence: pattern.confidence * (rule.confidence || 0.7)
        });
      }
    });

    return suggestions;
  }

  generateHistoricalSuggestions(classification, context) {
    const suggestions = [];
    const key = `${classification.category}:${classification.type}`;
    const history = this.resolutionHistory.get(key);

    if (history && history.resolutions.length > 0) {
      // Get most successful resolutions
      const successfulResolutions = history.resolutions
        .filter(r => r.success)
        .sort((a, b) => b.successRate - a.successRate)
        .slice(0, 2);

      successfulResolutions.forEach(resolution => {
        suggestions.push({
          type: 'historical',
          title: `Previously Applied: ${resolution.title}`,
          description: resolution.description,
          steps: resolution.steps,
          automated: false,
          confidence: resolution.successRate * 0.8,
          historical: true,
          appliedCount: resolution.appliedCount
        });
      });
    }

    return suggestions;
  }

  rankSuggestions(suggestions, error, context, classification) {
    return suggestions.sort((a, b) => {
      // Sort by confidence first
      if (a.confidence !== b.confidence) {
        return b.confidence - a.confidence;
      }

      // Then by automated suggestions (prefer automated)
      if (a.automated !== b.automated) {
        return b.automated ? 1 : -1;
      }

      // Then by historical success
      if (a.historical !== b.historical) {
        return a.historical ? 1 : -1;
      }

      return 0;
    });
  }

  matchesConditions(conditions, context) {
    if (!conditions) return true;

    for (const [key, value] of Object.entries(conditions)) {
      if (context[key] !== value) {
        return false;
      }
    }

    return true;
  }

  async learnFromResolution(errorReport, resolution) {
    const key = `${errorReport.classification.category}:${errorReport.classification.type}`;
    
    if (!this.resolutionHistory.has(key)) {
      this.resolutionHistory.set(key, {
        resolutions: []
      });
    }

    const history = this.resolutionHistory.get(key);
    
    // Find existing resolution or create new one
    let existingResolution = history.resolutions.find(r => r.type === resolution.type);
    
    if (!existingResolution) {
      existingResolution = {
        type: resolution.type,
        title: resolution.description,
        description: resolution.description,
        steps: [],
        appliedCount: 0,
        successCount: 0,
        successRate: 0
      };
      history.resolutions.push(existingResolution);
    }

    // Update resolution statistics
    existingResolution.appliedCount++;
    
    if (resolution.type === 'automated' || resolution.success) {
      existingResolution.successCount++;
    }
    
    existingResolution.successRate = existingResolution.successCount / existingResolution.appliedCount;
  }

  loadSuggestionRules() {
    return {
      'security:access_denied': [
        {
          type: 'authentication',
          title: 'Check Authentication Credentials',
          description: 'Verify that your API credentials are correct and have the necessary permissions.',
          steps: [
            'Check API key or token validity',
            'Verify required permissions',
            'Ensure credentials are not expired',
            'Test with a simple API call'
          ],
          automated: false,
          confidence: 0.9
        }
      ],
      'data_quality:format_error': [
        {
          type: 'data_validation',
          title: 'Fix Data Format Issues',
          description: 'Correct the format of your data to match the expected schema.',
          steps: [
            'Review error details for specific format issues',
            'Check CSV file encoding and delimiters',
            'Validate data types in each column',
            'Use data preview to identify problematic rows'
          ],
          automated: false,
          confidence: 0.8
        }
      ],
      'performance:timeout': [
        {
          type: 'performance_optimization',
          title: 'Optimize Processing Performance',
          description: 'Improve processing speed to avoid timeouts.',
          steps: [
            'Reduce file size or process in smaller batches',
            'Check available system memory',
            'Optimize transformation rules',
            'Consider increasing timeout settings'
          ],
          automated: false,
          confidence: 0.7
        }
      ],
      'infrastructure:connectivity': [
        {
          type: 'network_troubleshooting',
          title: 'Resolve Network Connectivity Issues',
          description: 'Fix network problems preventing API communication.',
          steps: [
            'Check internet connection',
            'Verify API endpoint accessibility',
            'Test with different network',
            'Check firewall and proxy settings'
          ],
          automated: false,
          confidence: 0.8
        }
      ],
      patterns: {
        repeated_validation_errors: {
          title: 'Systematic Data Quality Issues',
          description: 'Multiple validation errors suggest systematic data problems.',
          steps: [
            'Review data source quality',
            'Update validation rules if too strict',
            'Consider data preprocessing',
            'Check for encoding issues'
          ],
          automated: false,
          confidence: 0.8
        },
        memory_pressure: {
          title: 'Memory Optimization Required',
          description: 'System is running low on memory during processing.',
          steps: [
            'Reduce batch processing size',
            'Close other applications',
            'Increase available memory',
            'Use streaming processing options'
          ],
          automated: false,
          confidence: 0.9
        }
      }
    };
  }
}
```

**Error Reporting Dashboard:**
```javascript
const ErrorReportingDashboard = ({ userId }) => {
  const [errors, setErrors] = useState([]);
  const [statistics, setStatistics] = useState(null);
  const [selectedError, setSelectedError] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    category: 'all',
    resolved: 'all',
    timeRange: 24
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadErrors();
    loadStatistics();
  }, [filters]);

  const loadErrors = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/errors?${new URLSearchParams({
        userId,
        ...filters
      })}`);
      const data = await response.json();
      setErrors(data.errors);
    } catch (error) {
      showError('Failed to load error reports');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const response = await fetch(`/api/errors/statistics?userId=${userId}&timeRange=${filters.timeRange}`);
      const data = await response.json();
      setStatistics(data);
    } catch (error) {
      console.error('Failed to load error statistics:', error);
    }
  };

  const handleResolveError = async (errorId, resolution) => {
    try {
      const response = await fetch(`/api/errors/${errorId}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(resolution)
      });

      if (!response.ok) {
        throw new Error('Failed to resolve error');
      }

      showSuccess('Error resolved successfully');
      loadErrors();
      loadStatistics();
    } catch (error) {
      showError('Failed to resolve error: ' + error.message);
    }
  };

  const handleExportErrors = async () => {
    try {
      const response = await fetch(`/api/errors/export?userId=${userId}&${new URLSearchParams(filters)}`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `error-report-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showError('Failed to export errors');
    }
  };

  return (
    <div className="error-reporting-dashboard">
      <div className="dashboard-header">
        <h3>Error Reporting</h3>
        <div className="header-actions">
          <button onClick={handleExportErrors}>Export</button>
          <button onClick={() => { loadErrors(); loadStatistics(); }}>Refresh</button>
        </div>
      </div>

      {/* Statistics Overview */}
      {statistics && (
        <div className="statistics-overview">
          <div className="stat-card">
            <h4>Total Errors</h4>
            <span className="stat-value">{statistics.total}</span>
          </div>
          <div className="stat-card">
            <h4>Resolved</h4>
            <span className="stat-value">{statistics.resolved}</span>
          </div>
          <div className="stat-card">
            <h4>Resolution Rate</h4>
            <span className="stat-value">
              {statistics.total > 0 ? ((statistics.resolved / statistics.total) * 100).toFixed(1) : 0}%
            </span>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="error-filters">
        <select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
        </select>

        <select
          value={filters.category}
          onChange={(e) => setFilters({ ...filters, category: e.target.value })}
        >
          <option value="all">All Categories</option>
          <option value="security">Security</option>
          <option value="data_quality">Data Quality</option>
          <option value="performance">Performance</option>
          <option value="infrastructure">Infrastructure</option>
        </select>

        <select
          value={filters.resolved}
          onChange={(e) => setFilters({ ...filters, resolved: e.target.value })}
        >
          <option value="all">All Status</option>
          <option value="unresolved">Unresolved</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          value={filters.timeRange}
          onChange={(e) => setFilters({ ...filters, timeRange: parseInt(e.target.value) })}
        >
          <option value="1">Last Hour</option>
          <option value="24">Last 24 Hours</option>
          <option value="168">Last Week</option>
          <option value="720">Last Month</option>
        </select>
      </div>

      {/* Error List */}
      <div className="error-list">
        {loading ? (
          <div className="loading">Loading errors...</div>
        ) : errors.length === 0 ? (
          <div className="empty-state">No errors found</div>
        ) : (
          errors.map(error => (
            <ErrorCard
              key={error.id}
              error={error}
              onSelect={setSelectedError}
              onResolve={handleResolveError}
            />
          ))
        )}
      </div>

      {/* Error Details Modal */}
      {selectedError && (
        <ErrorDetailsModal
          error={selectedError}
          onClose={() => setSelectedError(null)}
          onResolve={handleResolveError}
        />
      )}
    </div>
  );
};
```

**Error Card Component:**
```javascript
const ErrorCard = ({ error, onSelect, onResolve }) => {
  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'error': return '#fd7e14';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  const handleQuickResolve = (type) => {
    onResolve(error.id, {
      type,
      description: `Quick resolved as ${type}`,
      userId: 'current-user'
    });
  };

  return (
    <div className={`error-card ${error.resolved ? 'resolved' : ''}`}>
      <div className="error-header">
        <div className="error-info">
          <h4>{error.type.replace('_', ' ').toUpperCase()}</h4>
          <span className="error-id">{error.id}</span>
        </div>
        <div className="error-severity">
          <div 
            className="severity-indicator"
            style={{ backgroundColor: getSeverityColor(error.severity) }}
          />
          <span className="severity-text">{error.severity}</span>
        </div>
      </div>

      <div className="error-message">
        {error.message}
      </div>

      <div className="error-context">
        <div className="context-item">
          <span className="label">Category:</span>
          <span>{error.category.replace('_', ' ')}</span>
        </div>
        
        <div className="context-item">
          <span className="label">Time:</span>
          <span>{new Date(error.timestamp).toLocaleString()}</span>
        </div>

        {error.context.jobId && (
          <div className="context-item">
            <span className="label">Job:</span>
            <span>{error.context.jobId}</span>
          </div>
        )}

        {error.context.row && (
          <div className="context-item">
            <span className="label">Row:</span>
            <span>{error.context.row}</span>
          </div>
        )}

        {error.context.field && (
          <div className="context-item">
            <span className="label">Field:</span>
            <span>{error.context.field}</span>
          </div>
        )}
      </div>

      {error.suggestions && error.suggestions.length > 0 && (
        <div className="error-suggestions">
          <strong>Suggestions:</strong>
          <ul>
            {error.suggestions.slice(0, 2).map((suggestion, index) => (
              <li key={index}>{suggestion.title}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="error-actions">
        <button onClick={() => onSelect(error)}>
          View Details
        </button>
        
        {!error.resolved && (
          <>
            <button onClick={() => handleQuickResolve('ignored')}>
              Ignore
            </button>
            <button onClick={() => handleQuickResolve('manual')}>
              Mark Resolved
            </button>
          </>
        )}
      </div>
    </div>
  );
};
```

**Error Handling:**
- Classification failures: Fallback to general error categorization
- Suggestion generation errors: Basic troubleshooting suggestions
- Context collection failures: Minimal error context with warning
- Storage errors: In-memory fallback with retry mechanism

## Success Criteria

- Error classification accuracy >90% for common error types
- Error context collection adds <50ms overhead to processing
- Recovery suggestions are actionable for >80% of common errors
- Error dashboard loads within 2 seconds with 1000+ error records
- Real-time error notifications work for critical errors

## Monitoring and Observability

**Metrics to Track:**
- Error classification accuracy
- Recovery suggestion effectiveness
- Error resolution rates
- Dashboard performance metrics

**Alerts:**
- Critical error detection
- Classification failure rates
- Suggestion generation failures
- Dashboard performance issues

## Integration Points

**Upstream:**
- All processing pipelines (error collection)
- Progress monitoring (error aggregation)

**Downstream:**
- Error storage (persistence)
- Alert system (notifications)
- Analytics engine (pattern detection)

## Error Reporting Features

**Classification:**
- Automatic error categorization
- Severity level assignment
- Pattern detection
- Context-aware classification

**Recovery Guidance:**
- Step-by-step instructions
- Automated fix options
- Historical resolution suggestions
- Confidence-based ranking

**Dashboard Features:**
- Real-time error updates
- Advanced filtering and search
- Error statistics and analytics
- Export and reporting capabilities