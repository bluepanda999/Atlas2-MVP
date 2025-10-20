import { MappingConfig, FieldMapping, TransformationRule } from '../types/mapping';
import { DatabaseService } from '../services/database.service';

export class MappingRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(config: Omit<MappingConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<MappingConfig> {
    const client = await this.databaseService.getClient();
    
    try {
      await client.query('BEGIN');

      // Create mapping config
      const configQuery = `
        INSERT INTO mapping_configs (
          name, description, is_active, user_id
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;

      const configValues = [
        config.name,
        config.description || null,
        config.isActive,
        config.userId,
      ];

      const configResult = await client.query(configQuery, configValues);
      const configId = configResult.rows[0].id;

      // Create field mappings
      for (const mapping of config.mappings) {
        const mappingQuery = `
          INSERT INTO field_mappings (
            mapping_config_id, csv_header, api_field_name, data_type, 
            required, default_value, description
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        `;

        const mappingValues = [
          configId,
          mapping.csvHeader,
          mapping.apiFieldName,
          mapping.dataType,
          mapping.required,
          mapping.defaultValue || null,
          mapping.description || null,
        ];

        await client.query(mappingQuery, mappingValues);
      }

      // Create transformation rules
      for (const rule of config.transformationRules) {
        const ruleQuery = `
          INSERT INTO transformation_rules (
            mapping_config_id, name, type, source_field, target_field,
            condition, then_value, else_value, format, target_type,
            custom_function, is_active, order_index
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        `;

        const ruleValues = [
          configId,
          rule.name,
          rule.type,
          rule.sourceField,
          rule.targetField || null,
          rule.condition || null,
          rule.thenValue || null,
          rule.elseValue || null,
          rule.format || null,
          rule.targetType || null,
          rule.customFunction || null,
          rule.isActive,
          rule.order,
        ];

        await client.query(ruleQuery, ruleValues);
      }

      await client.query('COMMIT');

      const result = await this.findById(configId);
      if (!result) {
        throw new Error('Failed to retrieve created mapping config');
      }
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to create mapping config: ${error}`);
    }
  }

  async findById(id: string): Promise<MappingConfig | null> {
    const client = await this.databaseService.getClient();
    
    try {
      // Get mapping config
      const configQuery = 'SELECT * FROM mapping_configs WHERE id = $1';
      const configResult = await client.query(configQuery, [id]);
      
      if (configResult.rows.length === 0) {
        return null;
      }

      const configRow = configResult.rows[0];

      // Get field mappings
      const mappingsQuery = 'SELECT * FROM field_mappings WHERE mapping_config_id = $1 ORDER BY id';
      const mappingsResult = await client.query(mappingsQuery, [id]);
      
      const mappings: FieldMapping[] = mappingsResult.rows.map(row => ({
        id: row.id,
        csvHeader: row.csv_header,
        apiFieldName: row.api_field_name,
        dataType: row.data_type,
        required: row.required,
        defaultValue: row.default_value,
        description: row.description,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      // Get transformation rules
      const rulesQuery = 'SELECT * FROM transformation_rules WHERE mapping_config_id = $1 ORDER BY order_index';
      const rulesResult = await client.query(rulesQuery, [id]);
      
      const transformationRules: TransformationRule[] = rulesResult.rows.map(row => ({
        id: row.id,
        name: row.name,
        type: row.type,
        sourceField: row.source_field,
        targetField: row.target_field,
        condition: row.condition,
        thenValue: row.then_value,
        elseValue: row.else_value,
        format: row.format,
        targetType: row.target_type,
        customFunction: row.custom_function,
        isActive: row.is_active,
        order: row.order_index,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      }));

      return {
        id: configRow.id,
        name: configRow.name,
        description: configRow.description,
        mappings,
        transformationRules,
        isActive: configRow.is_active,
        userId: configRow.user_id,
        createdAt: configRow.created_at,
        updatedAt: configRow.updated_at,
      };
    } catch (error) {
      throw new Error(`Failed to find mapping config: ${error}`);
    }
  }

  async findByUserId(userId: string): Promise<MappingConfig[]> {
    const query = 'SELECT * FROM mapping_configs WHERE user_id = $1 ORDER BY created_at DESC';
    
    try {
      const result = await this.databaseService.query(query, [userId]);
      const configs: MappingConfig[] = [];

      for (const row of result.rows) {
        const config = await this.findById(row.id);
        if (config) {
          configs.push(config);
        }
      }

      return configs;
    } catch (error) {
      throw new Error(`Failed to find mapping configs by user: ${error}`);
    }
  }

  async update(id: string, updates: Partial<Omit<MappingConfig, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<MappingConfig> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const columnName = this.camelToSnake(key);
        setClause.push(`${columnName} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE mapping_configs 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);

    try {
      await this.databaseService.query(query, values);
      const result = await this.findById(id);
      if (!result) {
        throw new Error('Failed to retrieve updated mapping config');
      }
      return result;
    } catch (error) {
      throw new Error(`Failed to update mapping config: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    const client = await this.databaseService.getClient();
    
    try {
      await client.query('BEGIN');

      // Delete transformation rules
      await client.query('DELETE FROM transformation_rules WHERE mapping_config_id = $1', [id]);

      // Delete field mappings
      await client.query('DELETE FROM field_mappings WHERE mapping_config_id = $1', [id]);

      // Delete mapping config
      await client.query('DELETE FROM mapping_configs WHERE id = $1', [id]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw new Error(`Failed to delete mapping config: ${error}`);
    }
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}