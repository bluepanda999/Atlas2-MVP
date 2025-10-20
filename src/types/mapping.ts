import { BaseEntity } from './common';

export interface FieldMapping extends BaseEntity {
  userId: string;
  fileUploadId: string;
  apiConfigurationId: string;
  mappingName: string;
  mappingConfig: MappingConfiguration;
  isActive: boolean;
  lastUsedAt?: Date;
  // Additional properties for compatibility
  csvHeader?: string;
  required?: boolean;
  apiFieldId?: string;
  apiFieldName?: string;
}

export type CsvRow = Record<string, any>;

export interface MappingConfiguration {
  sourceFields: SourceField[];
  targetFields: TargetField[];
  fieldMappings: FieldMappingDefinition[];
  transformations: TransformationRule[];
  settings: MappingSettings;
}

export interface SourceField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  sampleValues: string[];
  index: number;
}

export interface TargetField {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  description?: string;
  validation?: ValidationRule[];
}

export interface FieldMappingDefinition {
  id: string;
  sourceFieldId: string;
  targetFieldId: string;
  transformations: string[];
  defaultValue?: any;
  condition?: MappingCondition;
}

export interface TransformationRule {
  id: string;
  name: string;
  type: TransformationType;
  config: TransformationConfig;
  description?: string;
  sourceField?: string;
  targetField?: string;
  enabled?: boolean;
}

export enum TransformationType {
  DIRECT = 'direct',
  CONCATENATE = 'concatenate',
  SPLIT = 'split',
  FORMAT_DATE = 'format_date',
  FORMAT_NUMBER = 'format_number',
  LOOKUP = 'lookup',
  CONDITIONAL = 'conditional',
  CUSTOM = 'custom',
  FORMAT = 'format',
  VALIDATION = 'validation',
  TRANSFORMATION = 'transformation'
}

export interface TransformationConfig {
  [key: string]: any;
}

export interface MappingCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  STARTS_WITH = 'starts_with',
  ENDS_WITH = 'ends_with',
  IS_NULL = 'is_null',
  IS_NOT_NULL = 'is_not_null'
}

export enum FieldType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  DATE = 'date',
  EMAIL = 'email',
  URL = 'url',
  PHONE = 'phone',
  CURRENCY = 'currency',
  PERCENTAGE = 'percentage',
  CUSTOM = 'custom'
}

export interface ValidationRule {
  type: ValidationType;
  config: ValidationConfig;
  message?: string;
}

export enum ValidationType {
  REQUIRED = 'required',
  MIN_LENGTH = 'min_length',
  MAX_LENGTH = 'max_length',
  PATTERN = 'pattern',
  RANGE = 'range',
  EMAIL = 'email',
  URL = 'url',
  CUSTOM = 'custom'
}

export interface ValidationConfig {
  [key: string]: any;
}

export interface MappingSettings {
  skipEmptyRows: boolean;
  skipHeaderRow: boolean;
  errorHandling: ErrorHandlingStrategy;
  batchSize: number;
  maxErrors: number;
}

export enum ErrorHandlingStrategy {
  STOP_ON_ERROR = 'stop_on_error',
  SKIP_ROW = 'skip_row',
  LOG_AND_CONTINUE = 'log_and_continue'
}

export interface MappingTemplate extends BaseEntity {
  userId: string;
  name: string;
  description?: string;
  mappingConfig: MappingConfiguration;
  isPublic: boolean;
  usageCount: number;
}

export interface MappingPreview {
  originalData: Record<string, any>[];
  transformedData: Record<string, any>[];
  errors: MappingError[];
  warnings: MappingWarning[];
}

export interface MappingError {
  row: number;
  field: string;
  message: string;
  type: 'validation' | 'transformation' | 'mapping';
}

export interface MappingWarning {
  row: number;
  field: string;
  message: string;
  type: 'data_loss' | 'type_conversion' | 'empty_value';
}