import { MappingConfig, FieldMapping, TransformationRule, ValidationResult } from '../types/mapping';
import { MappingRepository } from '../repositories/mapping.repository';
import { AppError } from '../utils/errors';
import { v4 as uuidv4 } from 'uuid';

export class MappingService {
  constructor(private mappingRepository: MappingRepository) {}

  async createMapping(
    mappingData: Omit<MappingConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<MappingConfig> {
    try {
      const mapping: Omit<MappingConfig, 'id'> = {
        ...mappingData,
        userId,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      return await this.mappingRepository.create(mapping);
    } catch (error) {
      throw new AppError('Failed to create mapping', 500, error);
    }
  }

  async getMappings(
    userId: string,
    options: { page?: number; limit?: number }
  ): Promise<{
    mappings: MappingConfig[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const page = options.page || 1;
    const limit = options.limit || 10;
    const offset = (page - 1) * limit;

    const { mappings, total } = await this.mappingRepository.findByUserId(userId, {
      limit,
      offset,
    });

    return {
      mappings,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async getMapping(mappingId: string, userId?: string): Promise<MappingConfig> {
    const mapping = await this.mappingRepository.findById(mappingId);
    if (!mapping) {
      throw new AppError('Mapping not found', 404);
    }

    if (userId && mapping.userId !== userId) {
      throw new AppError('Access denied', 403);
    }

    return mapping;
  }

  async updateMapping(
    mappingId: string,
    updates: Partial<MappingConfig>,
    userId?: string
  ): Promise<MappingConfig> {
    const existingMapping = await this.getMapping(mappingId, userId);
    
    const updatedMapping = await this.mappingRepository.update(mappingId, {
      ...updates,
      updatedAt: new Date(),
    });

    if (!updatedMapping) {
      throw new AppError('Failed to update mapping', 500);
    }

    return updatedMapping;
  }

  async deleteMapping(mappingId: string, userId?: string): Promise<void> {
    const existingMapping = await this.getMapping(mappingId, userId);
    await this.mappingRepository.delete(mappingId);
  }

  async previewMapping(
    mappings: FieldMapping[],
    csvData: any[],
    limit: number = 10
  ): Promise<{
    previewData: any[];
    mappedFields: string[];
    unmappedCsvFields: string[];
    requiredFieldsMissing: string[];
  }> {
    const previewData = csvData.slice(0, limit).map(row => {
      const mappedRow: any = {};
      
      mappings.forEach(mapping => {
        if (mapping.csvHeader) {
          mappedRow[mapping.apiFieldName] = row[mapping.csvHeader] || '';
        }
      });
      
      return mappedRow;
    });

    const mappedFields = mappings
      .filter(m => m.csvHeader)
      .map(m => m.csvHeader!);

    const allCsvFields = Object.keys(csvData[0] || {});
    const unmappedCsvFields = allCsvFields.filter(field => !mappedFields.includes(field));

    const requiredFieldsMissing = mappings
      .filter(m => m.required && !m.csvHeader)
      .map(m => m.apiFieldName);

    return {
      previewData,
      mappedFields,
      unmappedCsvFields,
      requiredFieldsMissing,
    };
  }

  async validateMapping(
    mappings: FieldMapping[],
    apiFields: any[]
  ): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for required fields
    const requiredApiFields = apiFields.filter(field => field.required);
    const mappedRequiredFields = mappings.filter(m => m.required && m.csvHeader);
    
    const missingRequiredFields = requiredApiFields.filter(apiField =>
      !mappedRequiredFields.some(mapping => mapping.apiFieldId === apiField.id)
    );

    if (missingRequiredFields.length > 0) {
      errors.push(
        `Required fields not mapped: ${missingRequiredFields.map(f => f.name).join(', ')}`
      );
    }

    // Check for duplicate CSV mappings
    const csvMappings = mappings.filter(m => m.csvHeader);
    const csvHeaders = csvMappings.map(m => m.csvHeader);
    const duplicateHeaders = csvHeaders.filter((header, index) => csvHeaders.indexOf(header) !== index);

    if (duplicateHeaders.length > 0) {
      errors.push(
        `Duplicate CSV column mappings: ${[...new Set(duplicateHeaders)].join(', ')}`
      );
    }

    // Check for unmapped required fields
    const unmappedRequired = mappings.filter(m => m.required && !m.csvHeader);
    if (unmappedRequired.length > 0) {
      warnings.push(
        `Required fields without CSV mapping: ${unmappedRequired.map(m => m.apiFieldName).join(', ')}`
      );
    }

    // Check for data type compatibility
    for (const mapping of mappings) {
      if (!mapping.csvHeader) continue;

      const apiField = apiFields.find(f => f.id === mapping.apiFieldId);
      if (!apiField) continue;

      // This would require actual CSV data to validate
      // For now, just warn about potential type mismatches
      if (apiField.type === 'email' && !mapping.csvHeader.toLowerCase().includes('email')) {
        warnings.push(
          `Field "${mapping.apiFieldName}" is type email but mapped to "${mapping.csvHeader}"`
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  async addTransformationRule(
    mappingId: string,
    ruleData: Omit<TransformationRule, 'id'>,
    userId?: string
  ): Promise<TransformationRule> {
    const mapping = await this.getMapping(mappingId, userId);

    const rule: TransformationRule = {
      ...ruleData,
      id: uuidv4(),
    };

    const updatedMapping = await this.mappingRepository.addTransformationRule(mappingId, rule);
    return updatedMapping.transformationRules.find(r => r.id === rule.id)!;
  }

  async updateTransformationRule(
    mappingId: string,
    ruleId: string,
    updates: Partial<TransformationRule>,
    userId?: string
  ): Promise<TransformationRule> {
    const mapping = await this.getMapping(mappingId, userId);

    const updatedMapping = await this.mappingRepository.updateTransformationRule(
      mappingId,
      ruleId,
      updates
    );

    const updatedRule = updatedMapping.transformationRules.find(r => r.id === ruleId);
    if (!updatedRule) {
      throw new AppError('Transformation rule not found', 404);
    }

    return updatedRule;
  }

  async deleteTransformationRule(
    mappingId: string,
    ruleId: string,
    userId?: string
  ): Promise<void> {
    const mapping = await this.getMapping(mappingId, userId);
    await this.mappingRepository.deleteTransformationRule(mappingId, ruleId);
  }

  async applyTransformationRules(
    data: any[],
    rules: TransformationRule[]
  ): Promise<any[]> {
    return data.map(row => {
      let transformedRow = { ...row };

      for (const rule of rules.filter(r => r.enabled)) {
        transformedRow = this.applyRule(transformedRow, rule);
      }

      return transformedRow;
    });
  }

  private applyRule(data: any, rule: TransformationRule): any {
    const { sourceField, targetField, type, configuration } = rule;

    if (!sourceField || !(sourceField in data)) {
      return data;
    }

    const value = data[sourceField];
    let transformedValue = value;

    switch (type) {
      case 'format':
        transformedValue = this.applyFormatRule(value, configuration);
        break;
      case 'validation':
        transformedValue = this.applyValidationRule(value, configuration);
        break;
      case 'transformation':
        transformedValue = this.applyTransformationRule(value, configuration);
        break;
      case 'lookup':
        transformedValue = this.applyLookupRule(value, configuration);
        break;
    }

    return {
      ...data,
      [targetField || sourceField]: transformedValue,
    };
  }

  private applyFormatRule(value: any, config: any): any {
    // Implementation for format rules (date, phone, etc.)
    return value;
  }

  private applyValidationRule(value: any, config: any): any {
    // Implementation for validation rules
    return value;
  }

  private applyTransformationRule(value: any, config: any): any {
    const { operation } = config;

    switch (operation) {
      case 'uppercase':
        return typeof value === 'string' ? value.toUpperCase() : value;
      case 'lowercase':
        return typeof value === 'string' ? value.toLowerCase() : value;
      case 'trim':
        return typeof value === 'string' ? value.trim() : value;
      default:
        return value;
    }
  }

  private applyLookupRule(value: any, config: any): any {
    // Implementation for lookup rules
    return value;
  }
}