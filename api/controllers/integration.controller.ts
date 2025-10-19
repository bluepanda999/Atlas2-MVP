import { Request, Response, NextFunction } from 'express';
import { IntegrationService } from '../services/integration.service';
import { ApiResponse } from '../types/api';
import { ApiConfiguration, ApiField, TestConnectionResult } from '../types/integration';

export class IntegrationController {
  constructor(private integrationService: IntegrationService) {}

  createApiConfiguration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const configData: Omit<ApiConfiguration, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = req.body;
      const config = await this.integrationService.createApiConfiguration(configData, userId);

      const response: ApiResponse<typeof config> = {
        success: true,
        data: config,
        message: 'API configuration created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getApiConfigurations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const type = req.query.type as string;

      const result = await this.integrationService.getApiConfigurations(userId, {
        page,
        limit,
        type,
      });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'API configurations retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getApiConfiguration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;

      const config = await this.integrationService.getApiConfiguration(configId, userId);

      const response: ApiResponse<typeof config> = {
        success: true,
        data: config,
        message: 'API configuration retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateApiConfiguration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      const config = await this.integrationService.updateApiConfiguration(configId, updates, userId);

      const response: ApiResponse<typeof config> = {
        success: true,
        data: config,
        message: 'API configuration updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteApiConfiguration = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;

      await this.integrationService.deleteApiConfiguration(configId, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'API configuration deleted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  testConnection = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;

      const result: TestConnectionResult = await this.integrationService.testConnection(configId, userId);

      const response: ApiResponse<TestConnectionResult> = {
        success: true,
        data: result,
        message: 'Connection test completed',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getApiFields = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;

      const fields: ApiField[] = await this.integrationService.getApiFields(configId, userId);

      const response: ApiResponse<ApiField[]> = {
        success: true,
        data: fields,
        message: 'API fields retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  importOpenApiSpec = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { specUrl, specContent } = req.body;

      const result = await this.integrationService.importOpenApiSpec(
        { specUrl, specContent },
        userId
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'OpenAPI spec imported successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  generateApiDocumentation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;

      const documentation = await this.integrationService.generateApiDocumentation(configId, userId);

      const response: ApiResponse<typeof documentation> = {
        success: true,
        data: documentation,
        message: 'API documentation generated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  executeApiCall = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { configId } = req.params;
      const userId = req.user?.id;
      const { endpoint, method, data, headers } = req.body;

      const result = await this.integrationService.executeApiCall(
        configId,
        { endpoint, method, data, headers },
        userId
      );

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'API call executed successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}