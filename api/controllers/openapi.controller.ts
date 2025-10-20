import { Request, Response, NextFunction } from 'express';
import { OpenApiService, ImportOptions } from '../services/openapi.service';
import { ApiResponse } from '../types/api';

export class OpenApiController {
  constructor(private openApiService: OpenApiService) {}

  importSpecification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { source, content, format } = req.body;

      // Validate request
      if (!source || !content) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: source, content'
        });
        return;
      }

      if (!['url', 'file', 'text'].includes(source)) {
        res.status(400).json({
          success: false,
          error: 'Invalid source. Must be: url, file, or text'
        });
        return;
      }

      const options: ImportOptions = {
        source,
        content,
        format
      };

      const result = await this.openApiService.importSpecification(options);

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'OpenAPI specification imported successfully'
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getSpecification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { specId } = req.params;
      
      // TODO: Implement specification retrieval from storage
      // For POC, return a placeholder response
      res.status(501).json({
        success: false,
        error: 'Specification retrieval not implemented in POC'
      });
    } catch (error) {
      next(error);
    }
  };

  getEndpoints = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { specId } = req.params;
      
      // TODO: Implement endpoint extraction from stored specification
      // For POC, return a placeholder response
      res.status(501).json({
        success: false,
        error: 'Endpoint extraction not implemented in POC'
      });
    } catch (error) {
      next(error);
    }
  };

  validateSpecification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { content } = req.body;

      if (!content) {
        res.status(400).json({
          success: false,
          error: 'Missing required field: content'
        });
        return;
      }

      // Use the import service with validation only
      const options: ImportOptions = {
        source: 'text',
        content
      };

      const result = await this.openApiService.importSpecification(options);

      // Return only validation results
      const response: ApiResponse<Pick<typeof result, 'summary'>> = {
        success: true,
        data: {
          summary: result.summary
        },
        message: 'Specification validation completed'
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}