import { ProcessingJob } from '../types/upload';
import { FieldMapping, TransformationRule } from '../types/mapping';
import { UploadRepository } from '../repositories/upload.repository';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';

export interface ValidationRule {
  id: string;
  name: string;
  type: 'required' | 'data_type' | 'format' | 'range' | 'pattern' | 'custom';
  field: string;
  severity: 'error' | 'warning' | 'info';
  config: {
    dataType?: 'string' | 'number' | 'boolean' | 'date' | 'email';
    minLength?: number;
    maxLength?: number;
    min?: number;
    max?: number;
    pattern?: string;
    customFunction?: string;
    allowEmpty?: boolean;
  };
  message: string;
  isActive: boolean;
  order: number;
}

export interface ValidationError {
  row: number;
  field: string;
  value: any;
  rule: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  category: 'validation' | 'transformation' | 'business_rule';
}

export interface ValidationResult {
  isValid: boolean;
  totalRows: number;
  processedRows: number;
  errorRows: number;
  warningRows: number;
  errors: ValidationError[];
  warnings: ValidationError[];
  info: ValidationError[];
  summary: {
    errorsByField: Record<string, number>;
    errorsByRule: Record<string, number>;
    errorRate: number;
    warningRate: number;
  };
  preview: any[]; // First 100 rows with validation status
}

export interface ValidationProgress {
  jobId: string;
  currentRow: number;
  totalRows: number;
  progress: number;
  errorsFound: number;
  warningsFound: number;
  processingSpeed: number; // rows per second
  estimatedTimeRemaining: number | null;
}

export interface ValidationOptions {
  maxPreviewRows?: number;
  batchSize?: number;
  enableRealTimeUpdates?: boolean;
  validationRules?: ValidationRule[];
  stopOnErrorThreshold?: number; // Stop if error rate exceeds this percentage
}

const DEFAULT_OPTIONS: Required<ValidationOptions> = {
  maxPreviewRows: 100,
  batchSize: 1000,
  enableRealTimeUpdates: true,
  validationRules: [],
  stopOnErrorThreshold: 50, // 50% error rate threshold
};

export class ValidationService {
  private validationProgress: Map<string, ValidationProgress> = new Map();
  private validationResults: Map<string, ValidationResult> = new Map();

  constructor(private uploadRepository: UploadRepository) {}

  async validateCsvData(
    jobId: string,
    data: any[],
    headers: string[],
    options: ValidationOptions = {}
  ): Promise<ValidationResult> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    
    logger.info(`Starting CSV validation for job ${jobId}`, {
      totalRows: data.length,
      headers: headers.length,
      options: opts,
    });

    // Initialize validation progress
    const progress: ValidationProgress = {
      jobId,
      currentRow: 0,
      totalRows: data.length,
      progress: 0,
      errorsFound: 0,
      warningsFound: 0,
      processingSpeed: 0,
      estimatedTimeRemaining: null,
    };
    this.validationProgress.set(jobId, progress);

    // Initialize validation result
    const result: ValidationResult = {
      isValid: true,
      totalRows: data.length,
      processedRows: 0,
      errorRows: 0,
      warningRows: 0,
      errors: [],
      warnings: [],
      info: [],
      summary: {
        errorsByField: {},
        errorsByRule: {},
        errorRate: 0,
        warningRate: 0,
      },
      preview: [],
    };

    const startTime = Date.now();
    const validationRules = this.getDefaultValidationRules(headers).concat(opts.validationRules);

    try {
      // Process data in batches
      for (let i = 0; i < data.length; i += opts.batchSize) {
        const batch = data.slice(i, i + opts.batchSize);
        const batchStartRow = i;

        // Validate batch
        await this.validateBatch(batch, batchStartRow, headers, validationRules, result, progress);

        // Update progress
        progress.currentRow = i + batch.length;
        progress.progress = Math.round((progress.currentRow / progress.totalRows) * 100);
        
        // Calculate processing speed
        const elapsedMs = Date.now() - startTime;
        progress.processingSpeed = elapsedMs > 0 ? (progress.currentRow / (elapsedMs / 1000)) : 0;
        
        // Estimate remaining time
        if (progress.processingSpeed > 0) {
          const remainingRows = progress.totalRows - progress.currentRow;
          progress.estimatedTimeRemaining = (remainingRows / progress.processingSpeed) * 1000;
        }

        // Check error threshold
        const currentErrorRate = (result.errors.length / progress.currentRow) * 100;
        if (currentErrorRate > opts.stopOnErrorThreshold) {
          logger.warn(`Validation stopped for job ${jobId}: Error rate (${currentErrorRate.toFixed(2)}%) exceeds threshold (${opts.stopOnErrorThreshold}%)`);
          break;
        }

        // Update job progress in database
        await this.updateJobProgress(jobId, progress);

        // Add to preview (first N rows)
        if (result.preview.length < opts.maxPreviewRows) {
          const previewBatch = batch.slice(0, Math.min(batch.length, opts.maxPreviewRows - result.preview.length));
          result.preview.push(...previewBatch.map((row, index) => ({
            row: batchStartRow + index + 1,
            data: row,
            validation: this.getRowValidationStatus(row, batchStartRow + index, result),
          })));
        }

        // Small delay to prevent blocking
        await new Promise(resolve => setTimeout(resolve, 1));
      }

      // Finalize results
      result.processedRows = progress.currentRow;
      result.errorRows = result.errors.length;
      result.warningRows = result.warnings.length;
      result.isValid = result.errors.length === 0;
      
      // Calculate summary statistics
      result.summary.errorRate = result.totalRows > 0 ? (result.errorRows / result.totalRows) * 100 : 0;
      result.summary.warningRate = result.totalRows > 0 ? (result.warningRows / result.totalRows) * 100 : 0;

      // Store results
      this.validationResults.set(jobId, result);

      logger.info(`Validation completed for job ${jobId}`, {
        totalRows: result.totalRows,
        processedRows: result.processedRows,
        errorRows: result.errorRows,
        warningRows: result.warningRows,
        errorRate: result.summary.errorRate.toFixed(2),
        processingTime: Date.now() - startTime,
      });

      return result;

    } catch (error) {
      logger.error(`Validation failed for job ${jobId}:`, error);
      throw new AppError(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    } finally {
      // Cleanup progress
      this.validationProgress.delete(jobId);
    }
  }

  private async validateBatch(
    batch: any[],
    startRow: number,
    headers: string[],
    validationRules: ValidationRule[],
    result: ValidationResult,
    progress: ValidationProgress
  ): Promise<void> {
    for (let i = 0; i < batch.length; i++) {
      const row = batch[i];
      const rowIndex = startRow + i + 1; // 1-based row index

      // Validate each field in the row
      for (const [field, value] of Object.entries(row)) {
        const fieldErrors = await this.validateField(value, field, rowIndex, validationRules);
        
        // Categorize and add errors
        fieldErrors.forEach(error => {
          if (error.severity === 'error') {
            result.errors.push(error);
            progress.errorsFound++;
          } else if (error.severity === 'warning') {
            result.warnings.push(error);
            progress.warningsFound++;
          } else {
            result.info.push(error);
          }

          // Update summary statistics
          if (error.severity === 'error' || error.severity === 'warning') {
            result.summary.errorsByField[field] = (result.summary.errorsByField[field] || 0) + 1;
            result.summary.errorsByRule[error.rule] = (result.summary.errorsByRule[error.rule] || 0) + 1;
          }
        });
      }
    }
  }

  private async validateField(
    value: any,
    field: string,
    rowIndex: number,
    validationRules: ValidationRule[]
  ): Promise<ValidationError[]> {
    const errors: ValidationError[] = [];

    for (const rule of validationRules.filter(r => r.isActive && r.field === field)) {
      try {
        const isValid = await this.applyValidationRule(value, rule);
        
        if (!isValid) {
          errors.push({
            row: rowIndex,
            field,
            value,
            rule: rule.name,
            severity: rule.severity,
            message: this.formatErrorMessage(rule.message, value, rule.config),
            category: 'validation',
          });
        }
      } catch (error) {
        logger.warn(`Validation rule '${rule.name}' failed for field '${field}' at row ${rowIndex}:`, error);
        errors.push({
          row: rowIndex,
          field,
          value,
          rule: rule.name,
          severity: 'error',
          message: `Validation rule failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          category: 'validation',
        });
      }
    }

    return errors;
  }

  private async applyValidationRule(value: any, rule: ValidationRule): Promise<boolean> {
    const { config } = rule;

    // Skip validation if value is empty and empty values are allowed
    if ((value === null || value === undefined || value === '') && config.allowEmpty !== false) {
      return true;
    }

    switch (rule.type) {
      case 'required':
        return value !== null && value !== undefined && value !== '';

      case 'data_type':
        return this.validateDataType(value, config.dataType);

      case 'format':
        return this.validateFormat(value, config);

      case 'range':
        return this.validateRange(value, config);

      case 'pattern':
        return this.validatePattern(value, config.pattern);

      case 'custom':
        return this.validateCustom(value, config.customFunction);

      default:
        return true;
    }
  }

  private validateDataType(value: any, dataType?: string): boolean {
    if (value === null || value === undefined || value === '') {
      return true; // Empty values are handled by required rule
    }

    switch (dataType) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return !isNaN(Number(value)) && isFinite(Number(value));
      case 'boolean':
        return typeof value === 'boolean' || ['true', 'false', '1', '0', 'yes', 'no'].includes(String(value).toLowerCase());
      case 'date':
        return !isNaN(Date.parse(value));
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      default:
        return true;
    }
  }

  private validateFormat(value: any, config: ValidationRule['config']): boolean {
    if (typeof value !== 'string') {
      return false;
    }

    // Length validation
    if (config.minLength !== undefined && value.length < config.minLength) {
      return false;
    }
    if (config.maxLength !== undefined && value.length > config.maxLength) {
      return false;
    }

    return true;
  }

  private validateRange(value: any, config: ValidationRule['config']): boolean {
    const numValue = Number(value);
    if (isNaN(numValue)) {
      return false;
    }

    if (config.min !== undefined && numValue < config.min) {
      return false;
    }
    if (config.max !== undefined && numValue > config.max) {
      return false;
    }

    return true;
  }

  private validatePattern(value: any, pattern?: string): boolean {
    if (!pattern || typeof value !== 'string') {
      return true;
    }

    try {
      const regex = new RegExp(pattern);
      return regex.test(value);
    } catch (error) {
      logger.warn(`Invalid regex pattern: ${pattern}`, error);
      return true; // Don't fail validation for invalid patterns
    }
  }

  private validateCustom(value: any, customFunction?: string): boolean {
    if (!customFunction) {
      return true;
    }

    try {
      // In a real implementation, you'd use a safe evaluation environment
      // For now, return true as custom functions would need proper sandboxing
      return true;
    } catch (error) {
      logger.warn(`Custom validation function failed:`, error);
      return false;
    }
  }

  private getDefaultValidationRules(headers: string[]): ValidationRule[] {
    const rules: ValidationRule[] = [];

    headers.forEach((header, index) => {
      // Required field rule for common field names
      if (header.toLowerCase().includes('email') || 
          header.toLowerCase().includes('id') || 
          header.toLowerCase().includes('name')) {
        rules.push({
          id: `required-${index}`,
          name: 'Required Field',
          type: 'required',
          field: header,
          severity: 'error',
          config: {},
          message: `${header} is required`,
          isActive: true,
          order: 1,
        });
      }

      // Email validation for email fields
      if (header.toLowerCase().includes('email')) {
        rules.push({
          id: `email-${index}`,
          name: 'Email Format',
          type: 'data_type',
          field: header,
          severity: 'error',
          config: { dataType: 'email' },
          message: `${header} must be a valid email address`,
          isActive: true,
          order: 2,
        });
      }

      // Numeric validation for ID fields
      if (header.toLowerCase().includes('id') && !header.toLowerCase().includes('name')) {
        rules.push({
          id: `numeric-${index}`,
          name: 'Numeric Field',
          type: 'data_type',
          field: header,
          severity: 'error',
          config: { dataType: 'number' },
          message: `${header} must be a number`,
          isActive: true,
          order: 2,
        });
      }
    });

    return rules;
  }

  private formatErrorMessage(template: string, value: any, config: ValidationRule['config']): string {
    return template
      .replace('{value}', String(value))
      .replace('{min}', String(config.min || ''))
      .replace('{max}', String(config.max || ''))
      .replace('{minLength}', String(config.minLength || ''))
      .replace('{maxLength}', String(config.maxLength || ''));
  }

  private getRowValidationStatus(row: any, rowIndex: number, result: ValidationResult): {
    hasErrors: boolean;
    hasWarnings: boolean;
    errorCount: number;
    warningCount: number;
  } {
    const rowErrors = result.errors.filter(e => e.row === rowIndex);
    const rowWarnings = result.warnings.filter(e => e.row === rowIndex);

    return {
      hasErrors: rowErrors.length > 0,
      hasWarnings: rowWarnings.length > 0,
      errorCount: rowErrors.length,
      warningCount: rowWarnings.length,
    };
  }

  private async updateJobProgress(jobId: string, progress: ValidationProgress): Promise<void> {
    try {
      await this.uploadRepository.update(jobId, {
        progress: progress.progress,
        recordsProcessed: progress.currentRow,
        estimatedTimeRemaining: progress.estimatedTimeRemaining,
      });
    } catch (error) {
      logger.warn(`Failed to update job progress for ${jobId}:`, error);
    }
  }

  // Public methods for real-time updates
  getValidationProgress(jobId: string): ValidationProgress | null {
    return this.validationProgress.get(jobId) || null;
  }

  getValidationResult(jobId: string): ValidationResult | null {
    return this.validationResults.get(jobId) || null;
  }

  async generateValidationReport(jobId: string): Promise<{
    jobId: string;
    generatedAt: Date;
    summary: ValidationResult['summary'];
    errors: ValidationError[];
    warnings: ValidationError[];
    recommendations: string[];
  }> {
    const result = this.validationResults.get(jobId);
    if (!result) {
      throw new AppError('Validation result not found', 404);
    }

    const recommendations = this.generateRecommendations(result);

    return {
      jobId,
      generatedAt: new Date(),
      summary: result.summary,
      errors: result.errors,
      warnings: result.warnings,
      recommendations,
    };
  }

  private generateRecommendations(result: ValidationResult): string[] {
    const recommendations: string[] = [];

    // High error rate recommendations
    if (result.summary.errorRate > 20) {
      recommendations.push('High error rate detected. Consider reviewing data source and validation rules.');
    }

    // Field-specific recommendations
    Object.entries(result.summary.errorsByField)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([field, count]) => {
        recommendations.push(`Field '${field}' has ${count} errors. Consider data cleaning or rule adjustment.`);
      });

    // Rule-specific recommendations
    Object.entries(result.summary.errorsByRule)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .forEach(([rule, count]) => {
        recommendations.push(`Validation rule '${rule}' triggered ${count} times. Review rule configuration.`);
      });

    if (recommendations.length === 0) {
      recommendations.push('Data validation completed successfully with minimal issues.');
    }

    return recommendations;
  }

  // Cleanup method
  clearValidationData(jobId: string): void {
    this.validationProgress.delete(jobId);
    this.validationResults.delete(jobId);
  }
}