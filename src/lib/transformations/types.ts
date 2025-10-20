export interface Transformation {
  id: string;
  name: string;
  category: TransformationCategory;
  description: string;
  parameters: TransformationParameter[];
  execute: (value: any, params: any[], context?: TransformationContext) => any;
}

export type TransformationCategory =
  | "formatting"
  | "calculation"
  | "conditional"
  | "lookup"
  | "custom";

export const TransformationCategory = {
  FORMATTING: "formatting" as const,
  CALCULATION: "calculation" as const,
  CONDITIONAL: "conditional" as const,
  LOOKUP: "lookup" as const,
  CUSTOM: "custom" as const,
};

export interface TransformationParameter {
  name: string;
  type: ParameterType;
  required: boolean;
  defaultValue?: any;
  options?: string[]; // for select type
  validation?: ValidationRule[];
  placeholder?: string;
  description?: string;
}

export type ParameterType =
  | "string"
  | "number"
  | "boolean"
  | "select"
  | "date"
  | "expression"
  | "array";

export const ParameterType = {
  STRING: "string" as const,
  NUMBER: "number" as const,
  BOOLEAN: "boolean" as const,
  SELECT: "select" as const,
  DATE: "date" as const,
  EXPRESSION: "expression" as const,
  ARRAY: "array" as const,
};

export interface ValidationRule {
  type: ValidationType;
  config: Record<string, any>;
  message: string;
}

export type ValidationType =
  | "required"
  | "min_length"
  | "max_length"
  | "pattern"
  | "range"
  | "email"
  | "url"
  | "custom";

export const ValidationType = {
  REQUIRED: "required" as const,
  MIN_LENGTH: "min_length" as const,
  MAX_LENGTH: "max_length" as const,
  PATTERN: "pattern" as const,
  RANGE: "range" as const,
  EMAIL: "email" as const,
  URL: "url" as const,
  CUSTOM: "custom" as const,
};

export interface TransformationContext {
  fieldMapping?: any;
  sampleData?: any[];
  rowIndex?: number;
  fieldName?: string;
}

export interface TransformationConfig {
  transformations: {
    transformation: Transformation;
    config: Record<string, any>;
  }[];
}

export interface TransformationStepConfig {
  id: string;
  type: string;
  parameters: Record<string, any>;
  order: number;
  enabled: boolean;
}

export interface PreviewData {
  originalValue: any;
  transformedValue: any;
  transformations: TransformationConfig[];
  isValid: boolean;
  errors: TransformationError[];
  warnings: TransformationWarning[];
}

export interface TransformationError {
  fieldId: string;
  transformationId: string;
  type: "syntax" | "runtime" | "validation" | "performance";
  message: string;
  suggestion?: string;
  severity: "error" | "warning" | "info";
}

export interface TransformationWarning {
  fieldId: string;
  transformationId: string;
  message: string;
  suggestion?: string;
}

export interface TransformationResult {
  success: boolean;
  results: string[];
  totalCount: number;
  transformedCount: number;
  error?: string;
  errors?: TransformationError[];
  warnings?: TransformationWarning[];
}

export interface CustomTransformation {
  expression: string;
  parameters: string[];
  sandbox: {
    allowedLibraries: string[];
    memoryLimit: number;
    timeout: number;
  };
}

export interface TransformationLibrary {
  transformations: Transformation[];
  categories: TransformationCategory[];
  getTransformation(id: string): Transformation | undefined;
  getTransformationsByCategory(
    category: TransformationCategory,
  ): Transformation[];
  executeTransformation(
    id: string,
    value: any,
    params: any[],
    context?: TransformationContext,
  ): TransformationResult;
}
