import { logger } from "../utils/logger";
import { DatabaseService } from "./database.service";

export interface MappingTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  mappings: TemplateMapping[];
  created_by: string;
  is_public: boolean;
  usage_count: number;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateMapping {
  sourceField: string;
  targetField: string;
  transformation?: any;
  confidence: number;
}

export interface TemplateSuggestion {
  template: MappingTemplate;
  confidence: number;
  matchedFields: string[];
  reason: string;
}

export interface AutoMappingResult {
  suggestions: TemplateSuggestion[];
  autoMappedFields: { [key: string]: string };
  unmappedSourceFields: string[];
  unmappedTargetFields: string[];
}

export class MappingTemplatesService {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Get all available templates
   */
  async getTemplates(
    userId?: string,
    category?: string,
    tags?: string[],
    search?: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<{ templates: MappingTemplate[]; total: number }> {
    try {
      let query = `
        SELECT t.*, u.username as created_by_username
        FROM mapping_templates t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Filter by user or public templates
      if (userId) {
        query += ` AND (t.created_by = $${paramIndex} OR t.is_public = true)`;
        params.push(userId);
        paramIndex++;
      } else {
        query += ` AND t.is_public = true`;
      }

      // Filter by category
      if (category) {
        query += ` AND t.category = $${paramIndex}`;
        params.push(category);
        paramIndex++;
      }

      // Filter by tags
      if (tags && tags.length > 0) {
        query += ` AND t.tags && $${paramIndex}`;
        params.push(tags);
        paramIndex++;
      }

      // Search functionality
      if (search) {
        query += ` AND (t.name ILIKE $${paramIndex} OR t.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      // Count query
      const countQuery = query
        .replace(/SELECT.*?FROM/, "SELECT COUNT(*) FROM")
        .replace(/ORDER BY.*$/, "");
      const countResult = await this.databaseService.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering and pagination
      query += ` ORDER BY t.usage_count DESC, t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      const result = await this.databaseService.query(query, params);

      return {
        templates: result.rows,
        total,
      };
    } catch (error) {
      logger.error("Error fetching mapping templates:", error);
      return { templates: [], total: 0 };
    }
  }

  /**
   * Get template by ID
   */
  async getTemplateById(
    templateId: string,
    userId?: string,
  ): Promise<MappingTemplate | null> {
    try {
      let query = `
        SELECT t.*, u.username as created_by_username
        FROM mapping_templates t
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = $1
      `;
      const params = [templateId];

      if (userId) {
        query += ` AND (t.created_by = $2 OR t.is_public = true)`;
        params.push(userId);
      }

      const result = await this.databaseService.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      logger.error("Error fetching template by ID:", error);
      return null;
    }
  }

  /**
   * Create new template
   */
  async createTemplate(
    template: Omit<
      MappingTemplate,
      "id" | "created_at" | "updated_at" | "usage_count"
    >,
  ): Promise<{ success: boolean; template?: MappingTemplate; error?: string }> {
    try {
      const query = `
        INSERT INTO mapping_templates (
          name, description, category, tags, mappings, 
          created_by, is_public
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      `;

      const values = [
        template.name,
        template.description,
        template.category,
        JSON.stringify(template.tags),
        JSON.stringify(template.mappings),
        template.created_by,
        template.is_public,
      ];

      const result = await this.databaseService.query(query, values);
      const createdTemplate = result.rows[0];

      logger.info(`Template created: ${createdTemplate.id}`);
      return { success: true, template: createdTemplate };
    } catch (error) {
      logger.error("Error creating template:", error);
      return { success: false, error: "Failed to create template" };
    }
  }

  /**
   * Update template
   */
  async updateTemplate(
    templateId: string,
    updates: Partial<MappingTemplate>,
    userId: string,
  ): Promise<{ success: boolean; template?: MappingTemplate; error?: string }> {
    try {
      // Check ownership
      const existingTemplate = await this.getTemplateById(templateId);
      if (!existingTemplate || existingTemplate.created_by !== userId) {
        return { success: false, error: "Template not found or access denied" };
      }

      const fields = [];
      const values = [];
      let paramIndex = 1;

      if (updates.name) {
        fields.push(`name = $${paramIndex}`);
        values.push(updates.name);
        paramIndex++;
      }

      if (updates.description !== undefined) {
        fields.push(`description = $${paramIndex}`);
        values.push(updates.description);
        paramIndex++;
      }

      if (updates.category) {
        fields.push(`category = $${paramIndex}`);
        values.push(updates.category);
        paramIndex++;
      }

      if (updates.tags) {
        fields.push(`tags = $${paramIndex}`);
        values.push(JSON.stringify(updates.tags));
        paramIndex++;
      }

      if (updates.mappings) {
        fields.push(`mappings = $${paramIndex}`);
        values.push(JSON.stringify(updates.mappings));
        paramIndex++;
      }

      if (updates.is_public !== undefined) {
        fields.push(`is_public = $${paramIndex}`);
        values.push(updates.is_public);
        paramIndex++;
      }

      fields.push(`updated_at = CURRENT_TIMESTAMP`);

      const query = `
        UPDATE mapping_templates 
        SET ${fields.join(", ")}
        WHERE id = $${paramIndex}
        RETURNING *
      `;

      values.push(templateId);

      const result = await this.databaseService.query(query, values);
      const updatedTemplate = result.rows[0];

      logger.info(`Template updated: ${templateId}`);
      return { success: true, template: updatedTemplate };
    } catch (error) {
      logger.error("Error updating template:", error);
      return { success: false, error: "Failed to update template" };
    }
  }

  /**
   * Delete template
   */
  async deleteTemplate(
    templateId: string,
    userId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Check ownership
      const existingTemplate = await this.getTemplateById(templateId);
      if (!existingTemplate || existingTemplate.created_by !== userId) {
        return { success: false, error: "Template not found or access denied" };
      }

      const query = "DELETE FROM mapping_templates WHERE id = $1";
      await this.databaseService.query(query, [templateId]);

      logger.info(`Template deleted: ${templateId}`);
      return { success: true };
    } catch (error) {
      logger.error("Error deleting template:", error);
      return { success: false, error: "Failed to delete template" };
    }
  }

  /**
   * Get template categories
   */
  async getCategories(): Promise<string[]> {
    try {
      const query = `
        SELECT DISTINCT category 
        FROM mapping_templates 
        WHERE is_public = true 
        ORDER BY category
      `;

      const result = await this.databaseService.query(query);
      return result.rows.map((row: any) => row.category);
    } catch (error) {
      logger.error("Error fetching categories:", error);
      return [];
    }
  }

  /**
   * Get popular tags
   */
  async getPopularTags(limit: number = 20): Promise<string[]> {
    try {
      const query = `
        SELECT unnest(tags) as tag, COUNT(*) as count
        FROM mapping_templates 
        WHERE is_public = true
        GROUP BY tag
        ORDER BY count DESC
        LIMIT $1
      `;

      const result = await this.databaseService.query(query, [limit]);
      return result.rows.map((row: any) => row.tag);
    } catch (error) {
      logger.error("Error fetching popular tags:", error);
      return [];
    }
  }

  /**
   * Increment template usage count
   */
  async incrementUsage(templateId: string): Promise<void> {
    try {
      const query = `
        UPDATE mapping_templates 
        SET usage_count = usage_count + 1 
        WHERE id = $1
      `;
      await this.databaseService.query(query, [templateId]);
    } catch (error) {
      logger.error("Error incrementing template usage:", error);
    }
  }

  /**
   * Auto-mapping suggestions based on field names
   */
  async getAutoMappingSuggestions(
    sourceFields: string[],
    targetFields: string[],
    limit: number = 10,
  ): Promise<AutoMappingResult> {
    try {
      // Get all templates that could match
      const { templates } = await this.getTemplates(
        undefined,
        undefined,
        undefined,
        undefined,
        100,
      );

      const suggestions: TemplateSuggestion[] = [];
      const autoMappedFields: { [key: string]: string } = {};

      // Analyze each template for compatibility
      templates.forEach((template) => {
        const templateSourceFields = template.mappings.map(
          (m) => m.sourceField,
        );
        const templateTargetFields = template.mappings.map(
          (m) => m.targetField,
        );

        // Calculate field overlap
        const sourceOverlap = this.calculateFieldOverlap(
          sourceFields,
          templateSourceFields,
        );
        const targetOverlap = this.calculateFieldOverlap(
          targetFields,
          templateTargetFields,
        );

        // Calculate confidence based on overlap and template popularity
        const confidence = this.calculateTemplateConfidence(
          sourceOverlap,
          targetOverlap,
          template.usage_count,
        );

        if (confidence > 30) {
          // Only include templates with reasonable confidence
          const matchedFields = [
            ...sourceFields.filter((f) => templateSourceFields.includes(f)),
            ...targetFields.filter((f) => templateTargetFields.includes(f)),
          ];

          suggestions.push({
            template,
            confidence,
            matchedFields,
            reason: this.generateSuggestionReason(
              sourceOverlap,
              targetOverlap,
              template.usage_count,
            ),
          });
        }
      });

      // Sort by confidence
      suggestions.sort((a, b) => b.confidence - a.confidence);

      // Generate auto-mapping from best suggestion
      if (suggestions.length > 0) {
        const bestSuggestion = suggestions[0];
        bestSuggestion.template.mappings.forEach((mapping) => {
          if (
            sourceFields.includes(mapping.sourceField) &&
            targetFields.includes(mapping.targetField)
          ) {
            autoMappedFields[mapping.sourceField] = mapping.targetField;
          }
        });
      }

      // Find unmapped fields
      const unmappedSourceFields = sourceFields.filter(
        (field) => !autoMappedFields[field],
      );
      const unmappedTargetFields = targetFields.filter(
        (field) => !Object.values(autoMappedFields).includes(field),
      );

      return {
        suggestions: suggestions.slice(0, limit),
        autoMappedFields,
        unmappedSourceFields,
        unmappedTargetFields,
      };
    } catch (error) {
      logger.error("Error generating auto-mapping suggestions:", error);
      return {
        suggestions: [],
        autoMappedFields: {},
        unmappedSourceFields: sourceFields,
        unmappedTargetFields: targetFields,
      };
    }
  }

  /**
   * Create template from existing mapping
   */
  async createTemplateFromMapping(
    mappingId: string,
    templateName: string,
    templateDescription: string,
    category: string,
    tags: string[],
    userId: string,
  ): Promise<{ success: boolean; template?: MappingTemplate; error?: string }> {
    try {
      // Get mapping configuration
      const mappingQuery =
        "SELECT * FROM mapping_configurations WHERE id = $1 AND user_id = $2";
      const mappingResult = await this.databaseService.query(mappingQuery, [
        mappingId,
        userId,
      ]);

      if (mappingResult.rows.length === 0) {
        return { success: false, error: "Mapping not found or access denied" };
      }

      const mapping = mappingResult.rows[0];

      // Convert mapping to template format
      const templateMappings: TemplateMapping[] = mapping.mappings.map(
        (m: any) => ({
          sourceField: m.sourceField,
          targetField: m.targetField,
          transformation: m.transformation,
          confidence: 80, // Default confidence for user-created templates
        }),
      );

      const template: Omit<
        MappingTemplate,
        "id" | "created_at" | "updated_at" | "usage_count"
      > = {
        name: templateName,
        description: templateDescription,
        category,
        tags,
        mappings: templateMappings,
        created_by: userId,
        is_public: false,
      };

      return await this.createTemplate(template);
    } catch (error) {
      logger.error("Error creating template from mapping:", error);
      return {
        success: false,
        error: "Failed to create template from mapping",
      };
    }
  }

  // Helper methods
  private calculateFieldOverlap(fields1: string[], fields2: string[]): number {
    const normalizedFields1 = fields1.map((f) => this.normalizeFieldName(f));
    const normalizedFields2 = fields2.map((f) => this.normalizeFieldName(f));

    const intersection = normalizedFields1.filter((f) =>
      normalizedFields2.includes(f),
    );
    return intersection.length;
  }

  private calculateTemplateConfidence(
    sourceOverlap: number,
    targetOverlap: number,
    usageCount: number,
  ): number {
    // Base confidence from field overlap
    let confidence = ((sourceOverlap + targetOverlap) / 2) * 100;

    // Boost based on usage count (popularity)
    const usageBoost = Math.min(usageCount / 10, 20); // Max 20% boost
    confidence += usageBoost;

    return Math.min(Math.round(confidence), 100);
  }

  private generateSuggestionReason(
    sourceOverlap: number,
    targetOverlap: number,
    usageCount: number,
  ): string {
    const reasons = [];

    if (sourceOverlap > 0) {
      reasons.push(`${sourceOverlap} matching source fields`);
    }

    if (targetOverlap > 0) {
      reasons.push(`${targetOverlap} matching target fields`);
    }

    if (usageCount > 5) {
      reasons.push(`used ${usageCount} times`);
    }

    if (reasons.length === 0) {
      return "Template available";
    }

    return reasons.join(", ");
  }

  private normalizeFieldName(fieldName: string): string {
    return fieldName
      .toLowerCase()
      .replace(/[_\-\s]/g, "")
      .replace(/[^a-z0-9]/g, "");
  }
}
