/**
 * Validation Types for Atlas2 CSV Processing
 * 
 * These types define the structure for data validation, preview,
 * and real-time validation updates.
 */

export interface ValidationRule {
  id: string;
  name: string;
  description: string;
  type: 'required' | 'format' | 'range' | 'pattern' | 'custom';
  field?: string;
  config: ValidationRuleConfig;
  enabled: boolean;
}

export interface ValidationRuleConfig {
  // Required field validation
  allowEmpty?: boolean;
  
  // Format validation
  format?: 'email' | 'phone' | 'date' | 'number' | 'url' | 'custom';
  customPattern?: string;
  
  // Range validation
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  
  // Pattern validation
  pattern?: string;
  flags?: string;
  
  // Custom validation
  customFunction?: string;
  errorMessage?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
  summary: ValidationSummary;
}

export interface ValidationError {
  row: number;
  column: string;
  field: string;
  value: any;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
  type: string;
}

export interface ValidationWarning {
  row: number;
  column: string;
  field: string;
  value: any;
  message: string;
  type: string;
}

export interface ValidationSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  errorCount: number;
  warningCount: number;
  completionPercentage: number;
}

export interface ValidationProgress {
  currentRow: number;
  totalRows: number;
  percentage: number;
  errorsFound: number;
  warningsFound: number;
  processingRate: number; // rows per second
  estimatedTimeRemaining: number; // seconds
}

export interface ColumnInfo {
  name: string;
  index: number;
  type: 'string' | 'number' | 'date' | 'boolean';
  nullable: boolean;
  unique: boolean;
  sampleValues: any[];
  nullCount: number;
  uniqueCount: number;
}

export interface DataPreview {
  columns: ColumnInfo[];
  rows: any[][];
  totalRows: number;
  sampleSize: number;
  hasHeaders: boolean;
  delimiter: string;
  encoding: string;
}

export interface ValidationRequest {
  fileId: string;
  rules: ValidationRule[];
  sampleSize?: number;
  fullValidation?: boolean;
}

export interface ValidationSession {
  id: string;
  fileId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: ValidationProgress;
  result?: ValidationResult;
  preview?: DataPreview;
  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;
  error?: string;
}

export interface WebSocketValidationMessage {
  type: 'validation_started' | 'validation_progress' | 'validation_completed' | 'validation_error' | 'validation_cancelled';
  sessionId: string;
  data?: any;
  timestamp: Date;
}

// Validation rule templates
export interface ValidationRuleTemplate {
  id: string;
  name: string;
  description: string;
  category: 'common' | 'business' | 'technical' | 'custom';
  type: ValidationRule['type'];
  defaultConfig: ValidationRuleConfig;
  applicableFieldTypes?: string[];
}

// Validation statistics
export interface ValidationStatistics {
  totalSessions: number;
  completedSessions: number;
  failedSessions: number;
  averageProcessingTime: number; // seconds
  averageRowsPerSecond: number;
  mostCommonErrors: Array<{
    rule: string;
    count: number;
    percentage: number;
  }>;
}

// Export/Import types
export interface ValidationExport {
  rules: ValidationRule[];
  sessions: ValidationSession[];
  statistics: ValidationStatistics;
  exportedAt: Date;
  version: string;
}

// React component props
export interface DataValidationProps {
  fileId: string;
  fileName: string;
  onValidationComplete?: (result: ValidationResult) => void;
  onValidationError?: (error: string) => void;
  className?: string;
}

export interface ValidationRuleEditorProps {
  rule: ValidationRule;
  onSave: (rule: ValidationRule) => void;
  onCancel: () => void;
  onDelete?: (ruleId: string) => void;
  availableFields: string[];
}

// API Response types
export interface ValidationApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface CreateValidationSessionResponse {
  sessionId: string;
  status: string;
}

export interface GetValidationSessionResponse extends ValidationSession {}

export interface GetValidationProgressResponse extends ValidationProgress {}

export interface CancelValidationSessionResponse {
  success: boolean;
  message: string;
}