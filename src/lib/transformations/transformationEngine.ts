import {
  TransformationConfig,
  TransformationResult,
  TransformationContext,
  TransformationError,
  TransformationWarning,
} from "./types";
import { transformationLibrary } from "./transformationLibrary";
import { debounce } from "lodash";

export class TransformationEngine {
  private previewCache = new Map<string, any>();

  /**
   * Get all available transformations
   */
  getAvailableTransformations() {
    return transformationLibrary;
  }

  /**
   * Execute a single transformation on data
   */
  async executeTransformation(
    transformation: any,
    data: string[],
    config: Record<string, any>,
  ): Promise<TransformationResult> {
    try {
      const results = data.map((value) => {
        try {
          // Convert parameters array to config object format
          const params = transformation.parameters.map((param: any) => {
            if (param.name in config) {
              return config[param.name];
            }
            return param.defaultValue;
          });

          const transformedValue = transformation.execute(value, params);
          return transformedValue;
        } catch (error) {
          return value; // Return original value if transformation fails
        }
      });

      return {
        success: true,
        results,
        totalCount: data.length,
        transformedCount: results.filter((r, i) => r !== data[i]).length,
      };
    } catch (error) {
      return {
        success: false,
        results: data,
        totalCount: data.length,
        transformedCount: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  /**
   * Execute a chain of transformations on a value
   */
  executeChain(
    value: any,
    transformations: TransformationConfig,
    context?: TransformationContext,
  ): TransformationResult {
    let currentData = Array.isArray(value) ? value : [value];
    const allErrors: TransformationError[] = [];
    const allWarnings: TransformationWarning[] = [];

    for (const step of transformations.transformations) {
      try {
        const params = step.transformation.parameters.map((param: any) => {
          if (param.name in step.config) {
            return step.config[param.name];
          }
          return param.defaultValue;
        });

        const results = currentData.map((dataValue) => {
          try {
            return step.transformation.execute(dataValue, params, context);
          } catch (error) {
            return dataValue; // Return original value if transformation fails
          }
        });

        currentData = results;
      } catch (error) {
        allErrors.push({
          fieldId: context?.fieldName || "unknown",
          transformationId: step.transformation.id,
          type: "runtime",
          message: error instanceof Error ? error.message : "Unknown error",
          severity: "error",
        });
      }
    }

    return {
      success: allErrors.length === 0,
      results: currentData,
      totalCount: currentData.length,
      transformedCount: currentData.length,
      errors: allErrors,
      warnings: allWarnings,
    };
  }

  /**
   * Generate preview of transformation results
   */
  generatePreview(
    originalValue: any,
    transformations: TransformationConfig,
    context?: TransformationContext,
  ): any {
    const cacheKey = this.getCacheKey(originalValue, transformations);

    if (this.previewCache.has(cacheKey)) {
      return this.previewCache.get(cacheKey);
    }

    const result = this.executeChain(originalValue, transformations, context);

    const preview = {
      originalValue,
      transformedValue: result.results,
      transformations,
      isValid: result.success,
      errors: result.errors || [],
      warnings: result.warnings || [],
    };

    this.previewCache.set(cacheKey, preview);
    return preview;
  }

  /**
   * Generate batch preview for multiple values
   */
  generateBatchPreview(
    sampleValues: any[],
    transformations: TransformationConfig,
    context?: TransformationContext,
  ): any[] {
    return sampleValues.map((value) =>
      this.generatePreview(value, transformations, context),
    );
  }

  /**
   * Validate transformation configuration
   */
  validateConfiguration(transformations: TransformationConfig): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for empty transformations
    if (
      !transformations.transformations ||
      transformations.transformations.length === 0
    ) {
      warnings.push("No transformations configured");
    }

    // Check each transformation
    transformations.transformations.forEach((step, index) => {
      // Validate required parameters
      step.transformation.parameters.forEach((param: any) => {
        if (param.required && !(param.name in step.config)) {
          errors.push(`Step ${index + 1}: ${param.name} is required`);
        }
      });
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Optimize transformation chain
   */
  optimizeChain(transformations: TransformationConfig): TransformationConfig {
    // For now, return as-is. Optimization can be added later
    return transformations;
  }

  /**
   * Clear preview cache
   */
  clearCache(): void {
    this.previewCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.previewCache.size,
      keys: Array.from(this.previewCache.keys()),
    };
  }

  /**
   * Generate cache key for transformation preview
   */
  private getCacheKey(
    value: any,
    transformations: TransformationConfig,
  ): string {
    const valueHash = JSON.stringify(value);
    const transformationsHash = JSON.stringify(
      transformations.transformations.map((t) => ({
        id: t.transformation.id,
        config: t.config,
      })),
    );
    return `${valueHash}-${transformationsHash}`;
  }
}

// Debounced preview generation for performance
export const debouncedPreview = debounce(
  (
    engine: TransformationEngine,
    value: any,
    transformations: TransformationConfig,
    context?: TransformationContext,
  ) => {
    return engine.generatePreview(value, transformations, context);
  },
  300,
);

// Singleton instance
export const transformationEngine = new TransformationEngine();
