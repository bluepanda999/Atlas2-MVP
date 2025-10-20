import { Request, Response, NextFunction } from 'express';
import { ValidationService } from '../services/validation.service';
import { WebSocketService } from '../services/websocket.service';
import { ApiResponse } from '../types/api';
import { ValidationResult, ValidationProgress } from '../services/validation.service';

export class ValidationController {
  constructor(
    private validationService: ValidationService,
    private webSocketService: WebSocketService
  ) {}

  validateJob = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Get job details to retrieve CSV data
      const job = await this.validationService.getJobById(jobId);
      if (!job) {
        res.status(404).json({
          success: false,
          message: 'Job not found',
        } as ApiResponse<null>);
        return;
      }

      if (job.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Access denied',
        } as ApiResponse<null>);
        return;
      }

      // Get CSV data for validation
      const csvData = await this.validationService.getCsvData(jobId);
      if (!csvData || csvData.length === 0) {
        res.status(400).json({
          success: false,
          message: 'No CSV data available for validation',
        } as ApiResponse<null>);
        return;
      }

      // Start validation with real-time updates
      const validationPromise = this.validationService.validateCsvData(
        jobId,
        csvData,
        job.csvHeaders,
        {
          enableRealTimeUpdates: true,
          maxPreviewRows: 100,
          batchSize: 1000,
        }
      );

      // Set up progress monitoring for WebSocket updates
      this.monitorValidationProgress(jobId, userId, validationPromise);

      // Start validation asynchronously
      validationPromise
        .then((result) => {
          // Broadcast completion
          this.webSocketService.broadcastValidationComplete(jobId, userId, result);
        })
        .catch((error) => {
          // Broadcast error
          this.webSocketService.broadcastValidationError(jobId, userId, error.message);
        });

      const response: ApiResponse<{ jobId: string; status: string }> = {
        success: true,
        data: { jobId, status: 'validation_started' },
        message: 'Validation started successfully',
      };

      res.status(202).json(response);
    } catch (error) {
      next(error);
    }
  };

  getValidationProgress = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const progress = this.validationService.getValidationProgress(jobId);
      const result = this.validationService.getValidationResult(jobId);

      const response: ApiResponse<{
        progress: ValidationProgress | null;
        result: ValidationResult | null;
      }> = {
        success: true,
        data: { progress, result },
        message: 'Validation progress retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getValidationResult = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const result = this.validationService.getValidationResult(jobId);
      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Validation result not found',
        } as ApiResponse<null>);
        return;
      }

      const response: ApiResponse<ValidationResult> = {
        success: true,
        data: result,
        message: 'Validation result retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getValidationReport = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const report = await this.validationService.generateValidationReport(jobId);

      // Set headers for file download
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="validation-report-${jobId}.json"`);

      res.json(report);
    } catch (error) {
      next(error);
    }
  };

  getPreviewData = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { rows = 50 } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const result = this.validationService.getValidationResult(jobId);
      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Validation result not found',
        } as ApiResponse<null>);
        return;
      }

      const previewRows = Math.min(parseInt(rows as string), result.preview.length);
      const preview = result.preview.slice(0, previewRows);

      const response: ApiResponse<{
        preview: any[];
        totalRows: number;
        errors: any[];
        warnings: any[];
      }> = {
        success: true,
        data: {
          preview,
          totalRows: result.totalRows,
          errors: result.errors.slice(0, 100), // Limit errors for preview
          warnings: result.warnings.slice(0, 100), // Limit warnings for preview
        },
        message: 'Preview data retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getErrorSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { jobId } = req.params;
      const { severity = 'all' } = req.query;
      const userId = req.user?.id;

      if (!userId) {
        throw new Error('User not authenticated');
      }

      const result = this.validationService.getValidationResult(jobId);
      if (!result) {
        res.status(404).json({
          success: false,
          message: 'Validation result not found',
        } as ApiResponse<null>);
        return;
      }

      let errors = result.errors;
      let warnings = result.warnings;

      if (severity !== 'all') {
        errors = errors.filter(e => e.severity === severity);
        warnings = warnings.filter(w => w.severity === severity);
      }

      const summary = {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        errorsByField: result.summary.errorsByField,
        errorsByRule: result.summary.errorsByRule,
        errorRate: result.summary.errorRate,
        warningRate: result.summary.warningRate,
        topErrors: errors.slice(0, 10),
        topWarnings: warnings.slice(0, 10),
      };

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        message: 'Error summary retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  private async monitorValidationProgress(
    jobId: string,
    userId: string,
    validationPromise: Promise<ValidationResult>
  ): Promise<void> {
    const progressInterval = setInterval(() => {
      const progress = this.validationService.getValidationProgress(jobId);
      
      if (progress) {
        this.webSocketService.broadcastValidationProgress(jobId, userId, progress);
      }
    }, 1000); // Update every second

    try {
      await validationPromise;
    } finally {
      clearInterval(progressInterval);
    }
  }
}