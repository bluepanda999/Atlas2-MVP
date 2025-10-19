import { Request, Response, NextFunction } from 'express';
import { MappingService } from '../services/mapping.service';
import { ApiResponse } from '../types/api';
import { FieldMapping, TransformationRule, MappingConfig } from '../types/mapping';

export class MappingController {
  constructor(private mappingService: MappingService) {}

  createMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const mappingData: Omit<MappingConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'> = req.body;
      const mapping = await this.mappingService.createMapping(mappingData, userId);

      const response: ApiResponse<typeof mapping> = {
        success: true,
        data: mapping,
        message: 'Mapping created successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getMappings = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      const result = await this.mappingService.getMappings(userId, { page, limit });

      const response: ApiResponse<typeof result> = {
        success: true,
        data: result,
        message: 'Mappings retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId } = req.params;
      const userId = req.user?.id;

      const mapping = await this.mappingService.getMapping(mappingId, userId);

      const response: ApiResponse<typeof mapping> = {
        success: true,
        data: mapping,
        message: 'Mapping retrieved successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      const mapping = await this.mappingService.updateMapping(mappingId, updates, userId);

      const response: ApiResponse<typeof mapping> = {
        success: true,
        data: mapping,
        message: 'Mapping updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId } = req.params;
      const userId = req.user?.id;

      await this.mappingService.deleteMapping(mappingId, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Mapping deleted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  previewMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }

      const { mappings, csvData, limit = 10 } = req.body;

      const preview = await this.mappingService.previewMapping(mappings, csvData, limit);

      const response: ApiResponse<typeof preview> = {
        success: true,
        data: preview,
        message: 'Mapping preview generated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  validateMapping = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappings, apiFields } = req.body;

      const validation = await this.mappingService.validateMapping(mappings, apiFields);

      const response: ApiResponse<typeof validation> = {
        success: true,
        data: validation,
        message: 'Mapping validation completed',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  addTransformationRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId } = req.params;
      const userId = req.user?.id;
      const ruleData: Omit<TransformationRule, 'id'> = req.body;

      const rule = await this.mappingService.addTransformationRule(mappingId, ruleData, userId);

      const response: ApiResponse<typeof rule> = {
        success: true,
        data: rule,
        message: 'Transformation rule added successfully',
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  updateTransformationRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId, ruleId } = req.params;
      const userId = req.user?.id;
      const updates = req.body;

      const rule = await this.mappingService.updateTransformationRule(
        mappingId,
        ruleId,
        updates,
        userId
      );

      const response: ApiResponse<typeof rule> = {
        success: true,
        data: rule,
        message: 'Transformation rule updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  deleteTransformationRule = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { mappingId, ruleId } = req.params;
      const userId = req.user?.id;

      await this.mappingService.deleteTransformationRule(mappingId, ruleId, userId);

      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Transformation rule deleted successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}