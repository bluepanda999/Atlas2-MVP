export interface FieldMapping {
  id: string;
  csvHeader: string;
  apiFieldName: string;
  dataType: 'string' | 'number' | 'boolean' | 'date';
  required: boolean;
  defaultValue?: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransformationRule {
  id: string;
  name: string;
  type: 'data_type' | 'format' | 'conditional' | 'custom';
  sourceField: string;
  targetField?: string;
  condition?: string;
  thenValue?: string;
  elseValue?: string;
  format?: string;
  targetType?: string;
  customFunction?: string;
  isActive: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface MappingConfig {
  id: string;
  name: string;
  description?: string;
  mappings: FieldMapping[];
  transformationRules: TransformationRule[];
  isActive: boolean;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface MappingValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  fieldMappings: FieldMapping[];
  transformationRules: TransformationRule[];
}

export interface DataTransformationResult {
  success: boolean;
  transformedData: any[];
  errors: Array<{
    row: number;
    field: string;
    error: string;
  }>;
  warnings: Array<{
    row: number;
    field: string;
    warning: string;
  }>;
}