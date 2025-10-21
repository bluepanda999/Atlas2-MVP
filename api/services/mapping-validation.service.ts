import { logger } from "../utils/logger";
import {
  MappingRepository,
  MappingConfiguration,
} from "../repositories/mapping.repository";

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  suggestions: ValidationSuggestion[];
  completeness: number; // 0-100 percentage
}

export interface ValidationError {
  type:
    | "required_field"
    | "type_mismatch"
    | "transformation_error"
    | "circular_reference";
  field: string;
  message: string;
  severity: "error" | "warning";
  suggestion?: string;
}

export interface ValidationWarning {
  type: "unused_field" | "data_loss_risk" | "performance_warning";
  field: string;
  message: string;
  recommendation: string;
}

export interface ValidationSuggestion {
  type: "auto_mapping" | "transformation" | "data_type";
  field: string;
  suggestion: string;
  confidence: number; // 0-100
}

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  mappings: any[];
  created_by: string;
  is_public: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export class MappingValidationService {
  constructor(private mappingRepository: MappingRepository) {}

  /**
   * Validate mapping configuration comprehensively
   */
  async validateMapping(
    mapping: MappingConfiguration,
    csvHeaders?: string[],
    apiSchema?: any,
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];
    const suggestions: ValidationSuggestion[] = [];

    // 1. Basic structure validation
    this.validateBasicStructure(mapping, errors);

    // 2. CSV header validation (if provided)
    if (csvHeaders) {
      this.validateCsvHeaders(
        mapping,
        csvHeaders,
        errors,
        warnings,
        suggestions,
      );
    }

    // 3. API schema validation (if provided)
    if (apiSchema) {
      this.validateApiSchema(mapping, apiSchema, errors, warnings);
    }

    // 4. Transformation validation
    this.validateTransformations(mapping, errors, warnings);

    // 5. Completeness calculation
    const completeness = this.calculateCompleteness(
      mapping,
      csvHeaders,
      apiSchema,
    );

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      suggestions,
      completeness,
    };
  }

  /**
   * Validate basic mapping structure
   */
  private validateBasicStructure(
    mapping: MappingConfiguration,
    errors: ValidationError[],
  ): void {
    if (!mapping.name || mapping.name.trim().length === 0) {
      errors.push({
        type: "required_field",
        field: "name",
        message: "Mapping name is required",
        severity: "error",
        suggestion: "Provide a descriptive name for this mapping configuration",
      });
    }

    if (!mapping.mappings || mapping.mappings.length === 0) {
      errors.push({
        type: "required_field",
        field: "mappings",
        message: "At least one field mapping is required",
        severity: "error",
        suggestion: "Add field mappings to configure data transformation",
      });
    }

    // Check for duplicate source fields
    const sourceFields = mapping.mappings.map((m) => m.sourceField);
    const duplicates = sourceFields.filter(
      (field, index) => sourceFields.indexOf(field) !== index,
    );
    if (duplicates.length > 0) {
      errors.push({
        type: "required_field",
        field: "mappings",
        message: `Duplicate source fields detected: ${duplicates.join(", ")}`,
        severity: "error",
        suggestion: "Remove duplicate mappings or use different source fields",
      });
    }
  }

  /**
   * Validate CSV headers against mapping
   */
  private validateCsvHeaders(
    mapping: MappingConfiguration,
    csvHeaders: string[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    suggestions: ValidationSuggestion[],
  ): void {
    const mappedSourceFields = mapping.mappings.map((m) => m.sourceField);
    const missingHeaders = mappedSourceFields.filter(
      (field) => !csvHeaders.includes(field),
    );

    if (missingHeaders.length > 0) {
      errors.push({
        type: "required_field",
        field: "sourceFields",
        message: `CSV headers missing: ${missingHeaders.join(", ")}`,
        severity: "error",
        suggestion: "Ensure CSV file contains all required source fields",
      });
    }

    // Suggest mappings for unmapped CSV headers
    const unmappedHeaders = csvHeaders.filter(
      (header) => !mappedSourceFields.includes(header),
    );
    unmappedHeaders.forEach((header) => {
      suggestions.push({
        type: "auto_mapping",
        field: header,
        suggestion: `Consider mapping CSV field "${header}" to an API field`,
        confidence: this.calculateMappingConfidence(header),
      });
    });

    // Warn about unused CSV headers
    if (unmappedHeaders.length > 0) {
      warnings.push({
        type: "unused_field",
        field: "csvHeaders",
        message: `${unmappedHeaders.length} CSV headers are not mapped`,
        recommendation: "Map these fields or confirm they are not needed",
      });
    }
  }

  /**
   * Validate API schema against mapping
   */
  private validateApiSchema(
    mapping: MappingConfiguration,
    apiSchema: any,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    const mappedTargetFields = mapping.mappings.map((m) => m.targetField);
    const requiredFields = this.getRequiredFieldsFromSchema(apiSchema);
    const missingRequiredFields = requiredFields.filter(
      (field) => !mappedTargetFields.includes(field),
    );

    if (missingRequiredFields.length > 0) {
      errors.push({
        type: "required_field",
        field: "targetFields",
        message: `Required API fields missing: ${missingRequiredFields.join(", ")}`,
        severity: "error",
        suggestion:
          "Map all required API fields to ensure successful API calls",
      });
    }

    // Validate data types
    mapping.mappings.forEach((mappingItem) => {
      const schemaField = this.findFieldInSchema(
        apiSchema,
        mappingItem.targetField,
      );
      if (schemaField && mappingItem.transformation) {
        this.validateTransformationType(mappingItem, schemaField, warnings);
      }
    });
  }

  /**
   * Validate transformations
   */
  private validateTransformations(
    mapping: MappingConfiguration,
    errors: ValidationError[],
    warnings: ValidationWarning[],
  ): void {
    mapping.mappings.forEach((mappingItem) => {
      if (mappingItem.transformation) {
        // Check for circular references
        if (this.hasCircularReference(mappingItem.transformation)) {
          errors.push({
            type: "circular_reference",
            field: mappingItem.sourceField,
            message: "Circular reference detected in transformation",
            severity: "error",
            suggestion: "Remove circular dependencies in transformation logic",
          });
        }

        // Check for data loss risks
        if (this.hasDataLossRisk(mappingItem.transformation)) {
          warnings.push({
            type: "data_loss_risk",
            field: mappingItem.sourceField,
            message: "Transformation may cause data loss",
            recommendation: "Review transformation logic and add validation",
          });
        }
      }
    });
  }

  /**
   * Calculate mapping completeness percentage
   */
  private calculateCompleteness(
    mapping: MappingConfiguration,
    csvHeaders?: string[],
    apiSchema?: any,
  ): number {
    let score = 0;
    let maxScore = 0;

    // Basic structure (20%)
    maxScore += 20;
    if (mapping.name && mapping.mappings && mapping.mappings.length > 0) {
      score += 20;
    }

    // CSV coverage (40%)
    if (csvHeaders) {
      maxScore += 40;
      const mappedSourceFields = mapping.mappings.map((m) => m.sourceField);
      const coverage =
        csvHeaders.filter((header) => mappedSourceFields.includes(header))
          .length / csvHeaders.length;
      score += coverage * 40;
    }

    // API coverage (40%)
    if (apiSchema) {
      maxScore += 40;
      const requiredFields = this.getRequiredFieldsFromSchema(apiSchema);
      const mappedTargetFields = mapping.mappings.map((m) => m.targetField);
      const coverage =
        requiredFields.filter((field) => mappedTargetFields.includes(field))
          .length / requiredFields.length;
      score += coverage * 40;
    }

    return maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  }

  /**
   * Save mapping configuration with validation
   */
  async saveMapping(mapping: MappingConfiguration): Promise<{
    success: boolean;
    result?: MappingConfiguration;
    errors?: string[];
  }> {
    try {
      // Validate before saving
      const validation = await this.validateMapping(mapping);
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Save or update mapping
      let result: MappingConfiguration;
      if (mapping.id) {
        const updatedResult = await this.mappingRepository.update(
          mapping.id,
          mapping,
        );
        if (!updatedResult) {
          throw new Error("Failed to update mapping");
        }
        result = updatedResult;
      } else {
        result = await this.mappingRepository.create(mapping);
      }

      logger.info(`Mapping configuration saved: ${result.id}`);
      return { success: true, result };
    } catch (error) {
      logger.error("Error saving mapping configuration:", error);
      return {
        success: false,
        errors: ["Failed to save mapping configuration"],
      };
    }
  }

  /**
   * Export mapping configuration
   */
  async exportMapping(
    mappingId: string,
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {
      const mapping = await this.mappingRepository.findById(mappingId);
      if (!mapping) {
        return { success: false, error: "Mapping not found" };
      }

      const exportData = {
        version: "1.0",
        exportedAt: new Date().toISOString(),
        mapping: {
          name: mapping.name,
          description: mapping.description,
          mappings: mapping.mappings,
        },
      };

      return { success: true, data: exportData };
    } catch (error) {
      logger.error("Error exporting mapping:", error);
      return { success: false, error: "Failed to export mapping" };
    }
  }

  /**
   * Import mapping configuration
   */
  async importMapping(
    importData: any,
    userId: string,
  ): Promise<{
    success: boolean;
    mapping?: MappingConfiguration;
    errors?: string[];
  }> {
    try {
      // Validate import data structure
      if (!importData.mapping || !importData.mapping.mappings) {
        return { success: false, errors: ["Invalid import data format"] };
      }

      const mappingData = importData.mapping;
      const mapping: Omit<
        MappingConfiguration,
        "id" | "created_at" | "updated_at"
      > = {
        user_id: userId,
        name: mappingData.name || "Imported Mapping",
        description: mappingData.description || "Imported from external source",
        mappings: mappingData.mappings,
      };

      // Validate imported mapping
      const validation = await this.validateMapping(
        mapping as MappingConfiguration,
      );
      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors.map((e) => e.message),
        };
      }

      // Save imported mapping
      const result = await this.mappingRepository.create(mapping);
      logger.info(`Mapping imported: ${result.id}`);

      return { success: true, mapping: result };
    } catch (error) {
      logger.error("Error importing mapping:", error);
      return { success: false, errors: ["Failed to import mapping"] };
    }
  }

  // Helper methods
  private calculateMappingConfidence(fieldName: string): number {
    // Simple confidence calculation based on common field name patterns
    const commonPatterns = [
      /^id$/i,
      /^uuid$/i,
      /^email$/i,
      /^name$/i,
      /^phone$/i,
      /^address$/i,
      /^city$/i,
      /^state$/i,
      /^zip$/i,
      /^country$/i,
      /^created_at$/i,
      /^updated_at$/i,
      /^date$/i,
      /^time$/i,
    ];

    for (const pattern of commonPatterns) {
      if (pattern.test(fieldName)) {
        return 85;
      }
    }

    return 50; // Default confidence
  }

  private getRequiredFieldsFromSchema(schema: any): string[] {
    // Extract required fields from OpenAPI schema
    const requiredFields: string[] = [];

    if (schema.properties) {
      for (const [fieldName] of Object.entries(schema.properties)) {
        if (schema.required && schema.required.includes(fieldName)) {
          requiredFields.push(fieldName);
        }
      }
    }

    return requiredFields;
  }

  private findFieldInSchema(schema: any, fieldName: string): any {
    return schema.properties?.[fieldName] || null;
  }

  private validateTransformationType(
    mappingItem: any,
    schemaField: any,
    warnings: ValidationWarning[],
  ): void {
    // Type validation logic would go here
    // This is a simplified version
    const transformation = mappingItem.transformation;
    const targetType = schemaField.type;

    if (
      transformation?.type === "number" &&
      targetType !== "number" &&
      targetType !== "integer"
    ) {
      warnings.push({
        type: "data_loss_risk",
        field: mappingItem.sourceField,
        message: `Number transformation may not match expected ${targetType} type`,
        recommendation: "Verify target field type compatibility",
      });
    }
  }

  private hasCircularReference(_transformation: any): boolean {
    // Simplified circular reference detection
    // In a real implementation, this would be more sophisticated
    return false;
  }

  private hasDataLossRisk(transformation: any): boolean {
    // Simplified data loss risk detection
    // In a real implementation, this would analyze transformation logic
    return (
      transformation?.type === "truncate" ||
      transformation?.type === "substring"
    );
  }
}
