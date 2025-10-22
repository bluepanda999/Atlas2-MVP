export interface MappingConfig {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  csvUploadId: string;
  apiSpecId: string;
  fieldMappings: FieldMappingDefinition[];
  transformationRules: TransformationRule[];
  isActive: boolean;
  created_at: Date;
  updated_at: Date;
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
  sourceField: string;
  targetField: string;
  configuration: any;
  enabled: boolean;
}

export enum TransformationType {
  FORMAT = "format",
  VALIDATION = "validation",
  TRANSFORMATION = "transformation",
  LOOKUP = "lookup",
}

export interface MappingCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

export enum ConditionOperator {
  EQUALS = "equals",
  NOT_EQUALS = "not_equals",
  GREATER_THAN = "greater_than",
  LESS_THAN = "less_than",
  CONTAINS = "contains",
  STARTS_WITH = "starts_with",
  ENDS_WITH = "ends_with",
  IS_NULL = "is_null",
  IS_NOT_NULL = "is_not_null",
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Re-use frontend types for compatibility
// Define types locally for API
export interface FieldMapping {
  id: string;
  csvHeader?: string;
  apiFieldId?: string;
  apiFieldName?: string;
  required?: boolean;
  transformations?: string[];
}

export interface SourceField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  sampleValues: string[];
  index: number;
}

export interface TargetField {
  id: string;
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export enum FieldType {
  STRING = "string",
  NUMBER = "number",
  BOOLEAN = "boolean",
  DATE = "date",
  EMAIL = "email",
  URL = "url",
  PHONE = "phone",
  CURRENCY = "currency",
  PERCENTAGE = "percentage",
  CUSTOM = "custom",
}
