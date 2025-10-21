# Story 10.3: Machine Learning-Based Suggestions - Brownfield Addition

## User Story

As a data transformation specialist,
I want AI-powered suggestions for transformation rules and data mappings,
So that I can accelerate the transformation setup process and improve data quality through intelligent recommendations.

## Story Context

**Existing System Integration:**

- Integrates with: Transformation engine (Story 3.2), field mapping interface (Story 3.1), data validation system
- Technology: Node.js backend with ML models, pattern recognition, statistical analysis, recommendation engine
- Follows pattern: AI/ML integration patterns, recommendation systems, data analysis workflows
- Touch points: Transformation pipeline, mapping interface, validation system, analytics service

## Acceptance Criteria

**Functional Requirements:**

1. ML-powered transformation rule suggestions based on data patterns and historical transformations
2. Intelligent field mapping recommendations using semantic analysis and data type detection
3. Data quality improvement suggestions with anomaly detection and correction recommendations
4. Learning system that improves suggestions based on user feedback and successful transformations
5. Confidence scoring for all suggestions with explanation of reasoning
6. Batch suggestion generation for large datasets with progress tracking

**Integration Requirements:** 4. Existing transformation and mapping interfaces continue to work unchanged (ML adds suggestions) 5. New functionality follows existing AI/ML integration and data analysis patterns 6. Integration with transformation engine maintains current processing and validation patterns

**Quality Requirements:** 7. Suggestion generation time <2 seconds for typical datasets 8. Suggestion accuracy >85% based on user acceptance metrics 9. ML model inference latency <500ms per suggestion 10. Learning system improves accuracy by >10% over time

## Technical Notes

- **Integration Approach:** ML suggestions integrate as advisory layer in existing transformation workflow
- **Existing Pattern Reference:** Follow established AI/ML integration and data analysis patterns
- **Key Constraints:** Must maintain performance, provide explainable suggestions, learn from feedback

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] ML model validation completed
- [ ] Documentation updated (ML suggestions guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** ML suggestions providing incorrect or low-quality recommendations
- **Mitigation:** Implement confidence scoring, user feedback loops, and fallback to manual configuration
- **Rollback:** Disable ML suggestions and rely on manual transformation setup

**Compatibility Verification:**

- [ ] No breaking changes to existing transformation and mapping interfaces
- [ ] ML suggestions follow existing AI/ML integration patterns
- [ ] Learning system integrates with existing analytics and monitoring
- [ ] Suggestion interface maintains existing UX patterns

## Story Points Estimation

**Estimation:** 8 points

- ML suggestion engine: 3 points
- Pattern recognition and analysis: 2 points
- Learning and feedback system: 2 points
- Integration with transformation workflow: 1 point

## Dependencies

- Transformation engine (Story 3.2)
- Field mapping interface (Story 3.1)
- Data validation system
- Analytics service

## Testing Requirements

**Unit Tests:**

- ML model inference and prediction
- Pattern recognition algorithms
- Suggestion scoring and ranking
- Learning system updates

**Integration Tests:**

- End-to-end suggestion workflow
- User feedback processing
- Model retraining and updates
- Performance under load

**ML Validation Tests:**

- Suggestion accuracy metrics
- Model performance benchmarks
- Learning system effectiveness
- A/B testing framework

## Implementation Notes

**ML Suggestion Engine:**

```javascript
class MLSuggestionEngine {
  constructor(options = {}) {
    this.models = {
      transformation: new TransformationSuggestionModel(options.transformation),
      mapping: new FieldMappingSuggestionModel(options.mapping),
      quality: new DataQualitySuggestionModel(options.quality),
    };
    this.patternAnalyzer = new DataPatternAnalyzer();
    this.feedbackProcessor = new FeedbackProcessor();
    this.confidenceCalculator = new ConfidenceCalculator();
    this.metrics = new MLSuggestionMetrics();
  }

  async generateSuggestions(data, context = {}) {
    const suggestions = {
      transformations: [],
      mappings: [],
      quality: [],
      metadata: {
        generatedAt: new Date(),
        dataProfile: await this.analyzeData(data),
        context,
      },
    };

    try {
      // Analyze data patterns
      const dataProfile = await this.patternAnalyzer.analyze(data);

      // Generate transformation suggestions
      suggestions.transformations = await this.suggestTransformations(
        data,
        dataProfile,
        context,
      );

      // Generate mapping suggestions
      suggestions.mappings = await this.suggestMappings(
        data,
        dataProfile,
        context,
      );

      // Generate quality improvement suggestions
      suggestions.quality = await this.suggestQualityImprovements(
        data,
        dataProfile,
        context,
      );

      // Calculate confidence scores
      await this.calculateConfidence(suggestions);

      this.metrics.recordSuggestionGeneration(suggestions);

      return suggestions;
    } catch (error) {
      this.metrics.recordError("suggestion_generation", error);
      throw new MLSuggestionError(
        `Suggestion generation failed: ${error.message}`,
      );
    }
  }

  async suggestTransformations(data, dataProfile, context) {
    const suggestions = [];

    // Analyze each field for transformation opportunities
    for (const [fieldName, fieldProfile] of Object.entries(
      dataProfile.fields,
    )) {
      const fieldData = data
        .map((row) => row[fieldName])
        .filter((val) => val != null);

      if (fieldData.length === 0) continue;

      // Get transformation suggestions from ML model
      const mlSuggestions = await this.models.transformation.predict({
        fieldName,
        fieldData,
        fieldProfile,
        context: {
          ...context,
          targetSchema: context.targetSchema,
          historicalTransformations:
            await this.getHistoricalTransformations(fieldName),
        },
      });

      // Enhance with rule-based suggestions
      const ruleSuggestions = this.generateRuleBasedTransformations(
        fieldData,
        fieldProfile,
      );

      // Combine and rank suggestions
      const combinedSuggestions = this.combineSuggestions(
        mlSuggestions,
        ruleSuggestions,
      );

      suggestions.push({
        fieldName,
        suggestions: combinedSuggestions,
      });
    }

    return suggestions;
  }

  async suggestMappings(data, dataProfile, context) {
    if (!context.targetSchema) {
      return [];
    }

    const suggestions = [];

    // Get mapping suggestions from ML model
    const mlSuggestions = await this.models.mapping.predict({
      sourceFields: Object.keys(dataProfile.fields),
      sourceProfile: dataProfile,
      targetSchema: context.targetSchema,
      context: {
        ...context,
        historicalMappings: await this.getHistoricalMappings(
          context.targetSchema,
        ),
      },
    });

    // Enhance with semantic analysis
    const semanticSuggestions = await this.generateSemanticMappings(
      dataProfile,
      context.targetSchema,
    );

    // Combine and rank suggestions
    const combinedSuggestions = this.combineSuggestions(
      mlSuggestions,
      semanticSuggestions,
    );

    return combinedSuggestions;
  }

  async suggestQualityImprovements(data, dataProfile, context) {
    const suggestions = [];

    // Analyze data quality issues
    const qualityIssues = await this.detectQualityIssues(data, dataProfile);

    for (const issue of qualityIssues) {
      // Get quality improvement suggestions from ML model
      const mlSuggestions = await this.models.quality.predict({
        issue,
        data,
        dataProfile,
        context,
      });

      suggestions.push({
        issue,
        suggestions: mlSuggestions,
      });
    }

    return suggestions;
  }

  generateRuleBasedTransformations(fieldData, fieldProfile) {
    const suggestions = [];

    // Date format detection
    if (fieldProfile.type === "string" && fieldProfile.dateFormat) {
      suggestions.push({
        type: "transformation",
        transformation: "format-date",
        confidence: 0.9,
        reason: "Detected date format pattern",
        config: {
          format: fieldProfile.dateFormat.suggestedFormat,
          customFormat: fieldProfile.dateFormat.customFormat,
        },
      });
    }

    // Number formatting
    if (fieldProfile.type === "number" && fieldProfile.hasFormatting) {
      suggestions.push({
        type: "transformation",
        transformation: "format-number",
        confidence: 0.8,
        reason: "Number formatting detected",
        config: {
          decimals: fieldProfile.decimalPlaces,
          thousandsSeparator: fieldProfile.hasThousandsSeparator,
        },
      });
    }

    // Text case normalization
    if (fieldProfile.type === "string" && fieldProfile.caseDistribution) {
      const dominantCase = Object.entries(fieldProfile.caseDistribution).sort(
        ([, a], [, b]) => b - a,
      )[0][0];

      if (dominantCase !== "mixed") {
        suggestions.push({
          type: "transformation",
          transformation: "format-text",
          confidence: 0.7,
          reason: `Inconsistent case detected, dominant: ${dominantCase}`,
          config: {
            operation:
              dominantCase === "upper"
                ? "uppercase"
                : dominantCase === "lower"
                  ? "lowercase"
                  : "title",
          },
        });
      }
    }

    // Data type conversion
    if (fieldProfile.potentialTypes && fieldProfile.potentialTypes.length > 1) {
      const bestType = fieldProfile.potentialTypes[0];
      if (bestType.type !== fieldProfile.type && bestType.confidence > 0.8) {
        suggestions.push({
          type: "transformation",
          transformation: "type-convert",
          confidence: bestType.confidence,
          reason: `High confidence type conversion: ${fieldProfile.type} → ${bestType.type}`,
          config: {
            targetType: bestType.type,
          },
        });
      }
    }

    return suggestions;
  }

  async generateSemanticMappings(sourceProfile, targetSchema) {
    const suggestions = [];

    for (const targetField of targetSchema.fields) {
      const semanticMatches = [];

      for (const sourceField of Object.keys(sourceProfile.fields)) {
        const similarity = await this.calculateSemanticSimilarity(
          sourceField,
          targetField.name,
          sourceProfile.fields[sourceField],
          targetField,
        );

        if (similarity > 0.5) {
          semanticMatches.push({
            sourceField,
            similarity,
            reason: `Semantic similarity: ${similarity.toFixed(2)}`,
          });
        }
      }

      if (semanticMatches.length > 0) {
        semanticMatches.sort((a, b) => b.similarity - a.similarity);
        suggestions.push({
          targetField: targetField.name,
          matches: semanticMatches,
        });
      }
    }

    return suggestions;
  }

  async calculateSemanticSimilarity(
    sourceName,
    targetName,
    sourceProfile,
    targetField,
  ) {
    // Name similarity
    const nameSimilarity = this.calculateStringSimilarity(
      sourceName,
      targetName,
    );

    // Type compatibility
    const typeCompatibility = this.calculateTypeCompatibility(
      sourceProfile.type,
      targetField.type,
    );

    // Pattern similarity
    const patternSimilarity = this.calculatePatternSimilarity(
      sourceProfile,
      targetField,
    );

    // Weighted combination
    return (
      nameSimilarity * 0.4 + typeCompatibility * 0.3 + patternSimilarity * 0.3
    );
  }

  calculateStringSimilarity(str1, str2) {
    const s1 = str1.toLowerCase().replace(/[^a-z0-9]/g, "");
    const s2 = str2.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Levenshtein distance
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);

    return 1 - distance / maxLength;
  }

  calculateTypeCompatibility(sourceType, targetType) {
    const compatibilityMatrix = {
      string: { string: 1.0, number: 0.3, boolean: 0.2, date: 0.4 },
      number: { string: 0.3, number: 1.0, boolean: 0.5, date: 0.1 },
      boolean: { string: 0.2, number: 0.5, boolean: 1.0, date: 0.0 },
      date: { string: 0.4, number: 0.1, boolean: 0.0, date: 1.0 },
    };

    return compatibilityMatrix[sourceType]?.[targetType] || 0;
  }

  calculatePatternSimilarity(sourceProfile, targetField) {
    let similarity = 0;

    // Length pattern similarity
    if (sourceProfile.length && targetField.length) {
      const lengthDiff = Math.abs(
        sourceProfile.length.avg - targetField.length,
      );
      similarity += Math.max(
        0,
        1 - lengthDiff / Math.max(sourceProfile.length.avg, targetField.length),
      );
    }

    // Format pattern similarity
    if (sourceProfile.pattern && targetField.pattern) {
      similarity += sourceProfile.pattern === targetField.pattern ? 1 : 0;
    }

    return similarity / 2;
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
            matrix[i - 1][j] + 1,
          );
        }
      }
    }

    return matrix[str2.length][str1.length];
  }

  combineSuggestions(mlSuggestions, ruleSuggestions) {
    const allSuggestions = [...mlSuggestions, ...ruleSuggestions];

    // Remove duplicates
    const uniqueSuggestions = this.deduplicateSuggestions(allSuggestions);

    // Sort by confidence
    uniqueSuggestions.sort((a, b) => b.confidence - a.confidence);

    return uniqueSuggestions;
  }

  deduplicateSuggestions(suggestions) {
    const seen = new Set();
    return suggestions.filter((suggestion) => {
      const key = `${suggestion.type}-${suggestion.transformation}-${JSON.stringify(suggestion.config)}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async calculateConfidence(suggestions) {
    for (const category of ["transformations", "mappings", "quality"]) {
      for (const item of suggestions[category]) {
        if (item.suggestions) {
          for (const suggestion of item.suggestions) {
            suggestion.confidence = await this.confidenceCalculator.calculate(
              suggestion,
              suggestions.metadata,
            );
          }
        } else {
          item.confidence = await this.confidenceCalculator.calculate(
            item,
            suggestions.metadata,
          );
        }
      }
    }
  }

  async analyzeData(data) {
    return await this.patternAnalyzer.analyze(data);
  }

  async getHistoricalTransformations(fieldName) {
    // Retrieve historical transformation data for learning
    return [];
  }

  async getHistoricalMappings(targetSchema) {
    // Retrieve historical mapping data for learning
    return [];
  }

  async detectQualityIssues(data, dataProfile) {
    const issues = [];

    // Detect missing values
    for (const [fieldName, fieldProfile] of Object.entries(
      dataProfile.fields,
    )) {
      if (fieldProfile.nullCount > 0) {
        const nullPercentage = (fieldProfile.nullCount / data.length) * 100;

        if (nullPercentage > 50) {
          issues.push({
            type: "high_missing_values",
            field: fieldName,
            severity: "high",
            percentage: nullPercentage,
            description: `${nullPercentage.toFixed(1)}% missing values in ${fieldName}`,
          });
        } else if (nullPercentage > 10) {
          issues.push({
            type: "moderate_missing_values",
            field: fieldName,
            severity: "medium",
            percentage: nullPercentage,
            description: `${nullPercentage.toFixed(1)}% missing values in ${fieldName}`,
          });
        }
      }
    }

    // Detect outliers
    for (const [fieldName, fieldProfile] of Object.entries(
      dataProfile.fields,
    )) {
      if (fieldProfile.type === "number" && fieldProfile.outliers) {
        if (fieldProfile.outliers.length > 0) {
          issues.push({
            type: "outliers",
            field: fieldName,
            severity: "medium",
            count: fieldProfile.outliers.length,
            percentage:
              (fieldProfile.outliers.length / fieldProfile.count) * 100,
            description: `${fieldProfile.outliers.length} outliers detected in ${fieldName}`,
          });
        }
      }
    }

    // Detect inconsistent formats
    for (const [fieldName, fieldProfile] of Object.entries(
      dataProfile.fields,
    )) {
      if (fieldProfile.type === "string" && fieldProfile.formatInconsistency) {
        issues.push({
          type: "format_inconsistency",
          field: fieldName,
          severity: "low",
          inconsistency: fieldProfile.formatInconsistency,
          description: `Inconsistent formats detected in ${fieldName}`,
        });
      }
    }

    return issues;
  }

  async processFeedback(suggestionId, feedback) {
    await this.feedbackProcessor.process(suggestionId, feedback);
    this.metrics.recordFeedback(suggestionId, feedback);
  }

  async retrainModels() {
    // Retrain ML models with new data
    for (const [name, model] of Object.entries(this.models)) {
      try {
        await model.retrain();
        this.metrics.recordModelRetraining(name);
      } catch (error) {
        this.metrics.recordError("model_retraining", { name, error });
      }
    }
  }

  getMetrics() {
    return this.metrics.getMetrics();
  }
}
```

**Data Pattern Analyzer:**

```javascript
class DataPatternAnalyzer {
  constructor() {
    this.typeDetectors = {
      string: new StringTypeDetector(),
      number: new NumberTypeDetector(),
      boolean: new BooleanTypeDetector(),
      date: new DateTypeDetector(),
    };
  }

  async analyze(data) {
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Invalid data for analysis");
    }

    const profile = {
      rowCount: data.length,
      fields: {},
      summary: {
        totalFields: Object.keys(data[0] || {}).length,
        completeness: 0,
        qualityScore: 0,
      },
    };

    // Analyze each field
    const fieldNames = Object.keys(data[0] || {});
    for (const fieldName of fieldNames) {
      const fieldData = data.map((row) => row[fieldName]);
      profile.fields[fieldName] = await this.analyzeField(fieldName, fieldData);
    }

    // Calculate summary metrics
    profile.summary.completeness = this.calculateCompleteness(profile.fields);
    profile.summary.qualityScore = this.calculateQualityScore(profile.fields);

    return profile;
  }

  async analyzeField(fieldName, fieldData) {
    const nonNullData = fieldData.filter((val) => val != null);
    const nullCount = fieldData.length - nonNullData.length;

    const profile = {
      name: fieldName,
      count: fieldData.length,
      nullCount,
      nullPercentage: (nullCount / fieldData.length) * 100,
      type: null,
      potentialTypes: [],
      length: null,
      uniqueValues: new Set(nonNullData).size,
      patterns: [],
      statistics: {},
    };

    if (nonNullData.length === 0) {
      return profile;
    }

    // Detect data type
    const typeDetection = await this.detectDataType(nonNullData);
    profile.type = typeDetection.primaryType;
    profile.potentialTypes = typeDetection.allTypes;

    // Analyze based on type
    const typeAnalyzer = this.typeDetectors[profile.type];
    if (typeAnalyzer) {
      Object.assign(profile, await typeAnalyzer.analyze(nonNullData));
    }

    // Detect patterns
    profile.patterns = await this.detectPatterns(nonNullData);

    return profile;
  }

  async detectDataType(data) {
    const typeScores = {};

    for (const [typeName, detector] of Object.entries(this.typeDetectors)) {
      const score = await detector.confidence(data);
      typeScores[typeName] = score;
    }

    // Sort by confidence
    const sortedTypes = Object.entries(typeScores)
      .sort(([, a], [, b]) => b - a)
      .map(([type, confidence]) => ({
        type,
        confidence,
      }));

    return {
      primaryType: sortedTypes[0].type,
      allTypes: sortedTypes,
    };
  }

  async detectPatterns(data) {
    const patterns = [];

    // Date format patterns
    const datePatterns = this.detectDatePatterns(data);
    if (datePatterns.length > 0) {
      patterns.push(...datePatterns);
    }

    // Number format patterns
    const numberPatterns = this.detectNumberPatterns(data);
    if (numberPatterns.length > 0) {
      patterns.push(...numberPatterns);
    }

    // Text patterns
    const textPatterns = this.detectTextPatterns(data);
    if (textPatterns.length > 0) {
      patterns.push(...textPatterns);
    }

    return patterns;
  }

  detectDatePatterns(data) {
    const patterns = [];
    const dateRegex = [
      /^\d{4}-\d{2}-\d{2}$/, // ISO
      /^\d{2}\/\d{2}\/\d{4}$/, // US
      /^\d{2}-\d{2}-\d{4}$/, // EU
      /^\d{2}\/\d{2}\/\d{2}$/, // Short year
    ];

    for (const [index, regex] of dateRegex.entries()) {
      const matches = data.filter(
        (val) => typeof val === "string" && regex.test(val),
      ).length;
      const percentage = (matches / data.length) * 100;

      if (percentage > 50) {
        patterns.push({
          type: "date_format",
          pattern: regex.source,
          confidence: percentage / 100,
          format: ["ISO", "US", "EU", "Short"][index],
        });
      }
    }

    return patterns;
  }

  detectNumberPatterns(data) {
    const patterns = [];
    const numericData = data.filter(
      (val) => !isNaN(val) && val !== null && val !== "",
    );

    if (numericData.length === 0) return patterns;

    // Decimal detection
    const hasDecimals = numericData.some((val) => {
      const str = String(val);
      return str.includes(".");
    });

    if (hasDecimals) {
      const decimalCount = numericData.filter((val) =>
        String(val).includes("."),
      ).length;
      patterns.push({
        type: "decimal_numbers",
        confidence: decimalCount / numericData.length,
        percentage: (decimalCount / numericData.length) * 100,
      });
    }

    // Thousands separator detection
    const withSeparators = numericData.filter((val) => {
      const str = String(val);
      return str.includes(",");
    });

    if (withSeparators.length > 0) {
      patterns.push({
        type: "thousands_separator",
        confidence: withSeparators.length / numericData.length,
        percentage: (withSeparators.length / numericData.length) * 100,
      });
    }

    return patterns;
  }

  detectTextPatterns(data) {
    const patterns = [];
    const stringData = data.filter((val) => typeof val === "string");

    if (stringData.length === 0) return patterns;

    // Case distribution
    const caseDistribution = {
      upper: 0,
      lower: 0,
      title: 0,
      mixed: 0,
    };

    for (const str of stringData) {
      if (str === str.toUpperCase() && str !== str.toLowerCase()) {
        caseDistribution.upper++;
      } else if (str === str.toLowerCase() && str !== str.toUpperCase()) {
        caseDistribution.lower++;
      } else if (this.isTitleCase(str)) {
        caseDistribution.title++;
      } else {
        caseDistribution.mixed++;
      }
    }

    const total = stringData.length;
    if (caseDistribution.mixed < total * 0.8) {
      patterns.push({
        type: "case_distribution",
        distribution: caseDistribution,
        dominant: Object.entries(caseDistribution).sort(
          ([, a], [, b]) => b - a,
        )[0][0],
      });
    }

    // Email pattern
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const emailMatches = stringData.filter((str) =>
      emailRegex.test(str),
    ).length;
    if (emailMatches / stringData.length > 0.8) {
      patterns.push({
        type: "email_format",
        confidence: emailMatches / stringData.length,
      });
    }

    // URL pattern
    const urlRegex = /^https?:\/\/.+/;
    const urlMatches = stringData.filter((str) => urlRegex.test(str)).length;
    if (urlMatches / stringData.length > 0.8) {
      patterns.push({
        type: "url_format",
        confidence: urlMatches / stringData.length,
      });
    }

    return patterns;
  }

  isTitleCase(str) {
    return str
      .split(" ")
      .every(
        (word) =>
          word.length === 0 ||
          (word[0] === word[0].toUpperCase() &&
            word.slice(1) === word.slice(1).toLowerCase()),
      );
  }

  calculateCompleteness(fields) {
    const totalValues = Object.values(fields).reduce(
      (sum, field) => sum + field.count,
      0,
    );
    const totalNulls = Object.values(fields).reduce(
      (sum, field) => sum + field.nullCount,
      0,
    );

    return ((totalValues - totalNulls) / totalValues) * 100;
  }

  calculateQualityScore(fields) {
    let totalScore = 0;
    let fieldCount = 0;

    for (const field of Object.values(fields)) {
      let fieldScore = 100;

      // Deduct for missing values
      fieldScore -= field.nullPercentage;

      // Deduct for low uniqueness (potential duplicates)
      if (field.uniqueValues < field.count * 0.5) {
        fieldScore -= 20;
      }

      // Deduct for type uncertainty
      if (field.potentialTypes.length > 1) {
        const topConfidence = field.potentialTypes[0].confidence;
        fieldScore -= (1 - topConfidence) * 30;
      }

      totalScore += Math.max(0, fieldScore);
      fieldCount++;
    }

    return fieldCount > 0 ? totalScore / fieldCount : 0;
  }
}
```

**Feedback Processor:**

```javascript
class FeedbackProcessor {
  constructor(options = {}) {
    this.storage = new Map();
    this.aggregator = new FeedbackAggregator();
    this.modelUpdater = new ModelUpdater();
  }

  async process(suggestionId, feedback) {
    const feedbackRecord = {
      suggestionId,
      feedback,
      timestamp: new Date(),
      context: feedback.context || {},
    };

    // Store feedback
    this.storage.set(suggestionId, feedbackRecord);

    // Aggregate feedback for learning
    await this.aggregator.add(feedbackRecord);

    // Trigger model updates if needed
    if (await this.shouldUpdateModels()) {
      await this.modelUpdater.updateModels(
        await this.aggregator.getAggregatedFeedback(),
      );
    }

    return feedbackRecord;
  }

  async shouldUpdateModels() {
    // Update models after certain amount of feedback
    const feedbackCount = this.storage.size;
    return feedbackCount > 0 && feedbackCount % 100 === 0;
  }

  async getFeedbackStats() {
    const stats = {
      total: this.storage.size,
      accepted: 0,
      rejected: 0,
      modified: 0,
      byType: {},
      byConfidence: {},
    };

    for (const feedback of this.storage.values()) {
      // Count by feedback type
      switch (feedback.feedback.action) {
        case "accept":
          stats.accepted++;
          break;
        case "reject":
          stats.rejected++;
          break;
        case "modify":
          stats.modified++;
          break;
      }

      // Count by suggestion type
      const type = feedback.feedback.suggestionType;
      stats.byType[type] = (stats.byType[type] || 0) + 1;

      // Count by confidence range
      const confidence = feedback.feedback.confidence;
      const range = this.getConfidenceRange(confidence);
      stats.byConfidence[range] = (stats.byConfidence[range] || 0) + 1;
    }

    return stats;
  }

  getConfidenceRange(confidence) {
    if (confidence >= 0.9) return "90-100";
    if (confidence >= 0.8) return "80-89";
    if (confidence >= 0.7) return "70-79";
    if (confidence >= 0.6) return "60-69";
    return "0-59";
  }
}
```

## Success Criteria

- ML suggestions provide accurate transformation and mapping recommendations
- Suggestion confidence scores correlate with user acceptance rates
- Learning system improves suggestion accuracy over time
- Performance remains within acceptable limits for real-time suggestions
- User feedback effectively improves model performance

## Monitoring and Observability

**Metrics to Track:**

- Suggestion generation success rate and latency
- User acceptance rates by suggestion type and confidence
- Model accuracy and improvement over time
- Feedback volume and patterns

**Alerts:**

- Suggestion generation latency >5 seconds
- Model accuracy drops below 70%
- User acceptance rate <50%
- Feedback processing failures

## Integration Points

**Upstream:**

- Transformation engine (suggestion triggers)
- Field mapping interface (mapping suggestions)
- Data validation system (quality suggestions)

**Downstream:**

- ML model service (inference)
- Analytics service (feedback tracking)
- Monitoring service (performance metrics)
