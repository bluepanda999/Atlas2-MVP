import { TransformationConfig, TransformationContext } from "./types";

/**
 * Create a safe execution context for custom expressions
 */
export const createSafeContext = (
  context?: TransformationContext,
): Record<string, any> => {
  const safeContext: Record<string, any> = {
    // Math functions
    Math: {
      PI: Math.PI,
      E: Math.E,
      abs: Math.abs,
      round: Math.round,
      floor: Math.floor,
      ceil: Math.ceil,
      min: Math.min,
      max: Math.max,
      pow: Math.pow,
      sqrt: Math.sqrt,
      random: Math.random,
    },

    // String functions
    String: {
      prototype: {
        toUpperCase: String.prototype.toUpperCase,
        toLowerCase: String.prototype.toLowerCase,
        trim: String.prototype.trim,
        length: String.prototype.length,
      },
    },

    // Date functions
    Date: {
      now: Date.now,
      parse: Date.parse,
    },

    // Utility functions
    parseInt,
    parseFloat,
    isNaN,
    isFinite,
  };

  // Add context data if provided
  if (context) {
    safeContext.context = context;
    safeContext.fieldName = context.fieldName;
    safeContext.rowIndex = context.rowIndex;
  }

  return safeContext;
};

/**
 * Validate custom expression for security
 */
export const validateExpression = (
  expression: string,
): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for dangerous patterns
  const dangerousPatterns = [
    /eval\s*\(/,
    /Function\s*\(/,
    /constructor\s*\(/,
    /__proto__/,
    /prototype\./,
    /import\s+/,
    /require\s*\(/,
    /process\./,
    /global\./,
    /window\./,
    /document\./,
    /fetch\s*\(/,
    /XMLHttpRequest/,
    /setTimeout/,
    /setInterval/,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(expression)) {
      errors.push(`Potentially dangerous code detected: ${pattern.source}`);
    }
  }

  // Check for infinite loops
  const loopPatterns = [/while\s*\(/, /for\s*\(/, /do\s*\{/];
  for (const pattern of loopPatterns) {
    if (pattern.test(expression)) {
      warnings.push(
        "Loop detected - ensure it has proper termination conditions",
      );
    }
  }

  // Check for very long expressions
  if (expression.length > 1000) {
    warnings.push("Very long expression may impact performance");
  }

  // Basic syntax check
  try {
    new Function("value", `return (${expression})`);
  } catch (error) {
    errors.push(
      `Syntax error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Execute custom expression safely
 */
export const executeCustomExpression = (
  expression: string,
  value: any,
  context?: TransformationContext,
): any => {
  const validation = validateExpression(expression);
  if (!validation.isValid) {
    throw new Error(`Invalid expression: ${validation.errors.join(", ")}`);
  }

  try {
    const safeContext = createSafeContext(context);
    const func = new Function(
      "value",
      "context",
      ...Object.keys(safeContext),
      `return (${expression})`,
    );
    return func(value, context, ...Object.values(safeContext));
  } catch (error) {
    throw new Error(
      `Expression execution failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
};

/**
 * Generate transformation ID
 */
export const generateTransformationId = (): string => {
  return `transformation-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
};

/**
 * Sort transformations by order
 */
export const sortTransformations = (
  transformations: TransformationConfig[],
): TransformationConfig[] => {
  // The new interface doesn't have order, transformations are executed in array order
  return transformations;
};

/**
 * Clone transformation configuration
 */
export const cloneTransformation = (
  transformation: TransformationConfig,
): TransformationConfig => {
  return JSON.parse(JSON.stringify(transformation));
};

/**
 * Check if transformation is enabled and valid
 */
export const isTransformationActive = (
  transformation: TransformationConfig,
): boolean => {
  // New interface doesn't have enabled/type at top level
  return transformation.transformations.length > 0;
};

/**
 * Get transformation display name
 */
export const getTransformationDisplayName = (
  transformation: TransformationConfig,
): string => {
  // For new interface, return a summary of all transformations
  const count = transformation.transformations.length;
  return `${count} transformation${count !== 1 ? "s" : ""}`;
};

/**
 * Estimate transformation execution time (in milliseconds)
 */
export const estimateExecutionTime = (
  transformation: TransformationConfig,
): number => {
  // For new interface, sum up execution times of all transformations
  return transformation.transformations.reduce((total, step) => {
    // Base times for different transformation types
    const baseTimes: Record<string, number> = {
      "format-date": 1,
      "format-text": 0.5,
      "format-number": 0.5,
      "math-operation": 0.5,
      percentage: 0.5,
      "conditional-value": 1,
      "replace-value": 2,
      "lookup-table": 1,
      "custom-expression": 5, // Custom expressions are slower
    };

    const baseTime = baseTimes[step.transformation.id] || 1;
    const complexity = Object.keys(step.config).length * 0.1;
    return total + baseTime + complexity;
  }, 0);
};

/**
 * Calculate total execution time for transformation chain
 */
export const calculateChainExecutionTime = (
  transformations: TransformationConfig[],
): number => {
  return transformations
    .filter(isTransformationActive)
    .reduce(
      (total, transformation) => total + estimateExecutionTime(transformation),
      0,
    );
};
