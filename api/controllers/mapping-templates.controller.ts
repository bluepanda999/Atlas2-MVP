import { Request, Response, NextFunction } from "express";
import { MappingTemplatesService } from "../services/mapping-templates.service";

interface ApiResponse {
  success: boolean;
  data?: any;
  error?: string;
  details?: string[];
}

export class MappingTemplatesController {
  constructor(private mappingTemplatesService: MappingTemplatesService) {}

  /**
   * Get all templates with filtering and pagination
   */
  getTemplates = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { category, tags, search, limit = "50", offset = "0" } = req.query;

      const userId = req.user?.id;
      const tagsArray = tags ? (tags as string).split(",") : undefined;

      const result = await this.mappingTemplatesService.getTemplates(
        userId,
        category as string,
        tagsArray,
        search as string,
        parseInt(limit as string),
        parseInt(offset as string),
      );

      res.json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get template by ID
   */
  getTemplateById = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      if (!templateId) {
        res.status(400).json({
          success: false,
          error: "Template ID is required",
        } as ApiResponse);
        return;
      }

      const template = await this.mappingTemplatesService.getTemplateById(
        templateId,
        userId,
      );

      if (!template) {
        res.status(404).json({
          success: false,
          error: "Template not found",
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        data: template,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create new template
   */
  createTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const templateData = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: "User authentication required",
        } as ApiResponse);
        return;
      }

      // Add creator ID
      templateData.created_by = userId;

      const result =
        await this.mappingTemplatesService.createTemplate(templateData);

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.template,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Update template
   */
  updateTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { templateId } = req.params;
      const updates = req.body;
      const userId = req.user?.id;

      if (!templateId || !userId) {
        res.status(400).json({
          success: false,
          error: "Template ID and user authentication are required",
        } as ApiResponse);
        return;
      }

      const result = await this.mappingTemplatesService.updateTemplate(
        templateId,
        updates,
        userId,
      );

      if (result.success) {
        res.json({
          success: true,
          data: result.template,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Delete template
   */
  deleteTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { templateId } = req.params;
      const userId = req.user?.id;

      if (!templateId || !userId) {
        res.status(400).json({
          success: false,
          error: "Template ID and user authentication are required",
        } as ApiResponse);
        return;
      }

      const result = await this.mappingTemplatesService.deleteTemplate(
        templateId,
        userId,
      );

      if (result.success) {
        res.json({
          success: true,
          data: { message: "Template deleted successfully" },
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get template categories
   */
  getCategories = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const categories = await this.mappingTemplatesService.getCategories();

      res.json({
        success: true,
        data: categories,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get popular tags
   */
  getPopularTags = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { limit = "20" } = req.query;

      const tags = await this.mappingTemplatesService.getPopularTags(
        parseInt(limit as string),
      );

      res.json({
        success: true,
        data: tags,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get auto-mapping suggestions
   */
  getAutoMappingSuggestions = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { sourceFields, targetFields, limit = "10" } = req.body;

      if (!sourceFields || !targetFields) {
        res.status(400).json({
          success: false,
          error: "Source fields and target fields are required",
        } as ApiResponse);
        return;
      }

      const result =
        await this.mappingTemplatesService.getAutoMappingSuggestions(
          sourceFields,
          targetFields,
          parseInt(limit as string),
        );

      res.json({
        success: true,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Create template from existing mapping
   */
  createTemplateFromMapping = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { mappingId, templateName, templateDescription, category, tags } =
        req.body;
      const userId = req.user?.id;

      if (!mappingId || !templateName || !category || !userId) {
        res.status(400).json({
          success: false,
          error:
            "Mapping ID, template name, category, and user authentication are required",
        } as ApiResponse);
        return;
      }

      const result =
        await this.mappingTemplatesService.createTemplateFromMapping(
          mappingId,
          templateName,
          templateDescription || "",
          category,
          tags || [],
          userId,
        );

      if (result.success) {
        res.status(201).json({
          success: true,
          data: result.template,
        } as ApiResponse);
      } else {
        res.status(400).json({
          success: false,
          error: result.error,
        } as ApiResponse);
      }
    } catch (error) {
      next(error);
    }
  };

  /**
   * Apply template to mapping
   */
  applyTemplate = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { templateId } = req.params;
      const { sourceFields } = req.body;
      const userId = req.user?.id;

      if (!templateId || !userId) {
        res.status(400).json({
          success: false,
          error: "Template ID and user authentication are required",
        } as ApiResponse);
        return;
      }

      // Get template
      const template = await this.mappingTemplatesService.getTemplateById(
        templateId,
        userId,
      );
      if (!template) {
        res.status(404).json({
          success: false,
          error: "Template not found",
        } as ApiResponse);
        return;
      }

      // Increment usage count
      await this.mappingTemplatesService.incrementUsage(templateId);

      // Apply template mappings to available source fields
      const appliedMappings = template.mappings
        .filter(
          (templateMapping: any) =>
            sourceFields && sourceFields.includes(templateMapping.sourceField),
        )
        .map((templateMapping: any) => ({
          sourceField: templateMapping.sourceField,
          targetField: templateMapping.targetField,
          transformation: templateMapping.transformation,
        }));

      res.json({
        success: true,
        data: {
          template,
          appliedMappings,
          totalMappings: template.mappings.length,
          appliedCount: appliedMappings.length,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get template usage statistics
   */
  getTemplateStats = async (
    req: Request,
    res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      const { templateId } = req.params;

      if (!templateId) {
        res.status(400).json({
          success: false,
          error: "Template ID is required",
        } as ApiResponse);
        return;
      }

      // This would typically query usage logs and analytics
      // For now, return placeholder data
      res.json({
        success: true,
        data: {
          templateId,
          totalUsage: 0,
          recentUsage: [],
          popularTransformations: [],
          averageRating: 0,
          userFeedback: [],
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  };
}
