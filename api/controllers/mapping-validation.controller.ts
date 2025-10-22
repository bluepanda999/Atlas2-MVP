import { Request, Response, NextFunction } from "express";
import { MappingValidationService } from "../services/mapping-validation.service";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  details?: string[];
}

export class MappingValidationController {
  constructor(private mappingValidationService: MappingValidationService) {}

  /**
   * Validate mapping configuration
   */
  validateMapping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mapping } = req.body;
      const { csvHeaders, apiSchema } = req.query;

      if (!mapping) {
        res.status(400).json({
          success: false,
          error: "Mapping configuration is required",
        } as ApiResponse);
        return;
      }

      const validationResult =
        await this.mappingValidationService.validateMapping(
          mapping,
          csvHeaders ? (csvHeaders as string).split(",") : undefined,
          apiSchema ? JSON.parse(apiSchema as string) : undefined,
        );

      res.json({
        success: true,
        data: validationResult,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Save mapping configuration with validation
   */
  saveMapping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mapping } = req.body;
      if (!mapping) {
        res.status(400).json({
          success: false,
          error: "Mapping configuration is required",
        } as ApiResponse);
        return;
      }

      // Add user ID to mapping
      if (req.user?.id) {
        mapping.user_id = req.user.id;
      }

      const result = await this.mappingValidationService.saveMapping(mapping);

      if (result.success) {
        res.json({
          success: true,
          data: result.result,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: "Validation failed",
          details: result.errors,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Export mapping configuration
   */
  exportMapping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mappingId } = req.params;
      if (!mappingId) {
        res.status(400).json({
          success: false,
          error: "Mapping ID is required",
        } as ApiResponse);
        return;
      }

      const result =
        await this.mappingValidationService.exportMapping(mappingId);

      if (result.success) {
        res.setHeader("Content-Type", "application/json");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="mapping-${mappingId}.json"`,
        );
        res.json(result.data);
      } else {
        res.status(404).json({
          success: false,
          error: result.error,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Import mapping configuration
   */
  importMapping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const importData = req.body;
      if (!importData) {
        res.status(400).json({
          success: false,
          error: "Import data is required",
        } as ApiResponse);
        return;
      }

      const result = await this.mappingValidationService.importMapping(
        importData,
        req.user?.id || "",
      );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.mapping,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: "Import failed",
          details: result.errors,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Validate mapping against actual CSV data
   */
  validateMappingWithData = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mapping, csvData } = req.body;

      if (!mapping || !csvData) {
        res.status(400).json({
          success: false,
          error: "Mapping configuration and CSV data are required",
        } as ApiResponse);
        return;
      }

      // Extract headers from CSV data
      const csvHeaders = Object.keys(csvData[0] || {});

      const validationResult =
        await this.mappingValidationService.validateMapping(
          mapping,
          csvHeaders,
        );

      // Add sample validation results
      const sampleValidation = this.validateSampleData(
        mapping,
        csvData.slice(0, 10),
      );

      res.json({
        success: true,
        data: {
          ...validationResult,
          sampleValidation,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get mapping completeness report
   */
  getCompletenessReport = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mappingId } = req.params;

      // This would typically fetch the mapping from database
      // For now, we'll return a placeholder response
      res.json({
        success: true,
        data: {
          mappingId,
          completeness: 85,
          issues: [],
          recommendations: [
            "Consider mapping unmapped CSV fields",
            "Add validation rules for critical fields",
          ],
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Private helper method for sample data validation
   */
  private validateSampleData(mapping: any, sampleData: any[]): any {
    const issues: any[] = [];
    const warnings: any[] = [];

    sampleData.forEach((row, index) => {
      mapping.mappings?.forEach((mappingItem: any) => {
        const sourceValue = row[mappingItem.sourceField];

        // Check for empty values
        if (!sourceValue || sourceValue.toString().trim() === "") {
          warnings.push({
            row: index + 1,
            field: mappingItem.sourceField,
            message: "Empty value detected",
          });
        }

        // Check transformation validity
        if (mappingItem.transformation) {
          try {
            // This would apply the actual transformation
            // For now, just check if transformation is properly structured
            if (!mappingItem.transformation.type) {
              issues.push({
                row: index + 1,
                field: mappingItem.sourceField,
                message: "Invalid transformation configuration",
              });
            }
          } catch (error) {
            issues.push({
              row: index + 1,
              field: mappingItem.sourceField,
              message: "Transformation failed",
            });
          }
        }
      });
    });

    return {
      totalRows: sampleData.length,
      issues,
      warnings,
      validRows: sampleData.length - issues.length,
    };
  }
}
