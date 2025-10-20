import { DatabaseService } from '../services/database.service';

export interface MappingConfiguration {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  api_config_id?: string;
  mappings: any[];
  created_at: Date;
  updated_at: Date;
}

export class MappingRepository {
  constructor(private databaseService: DatabaseService) {}

  async findById(id: string): Promise<MappingConfiguration | null> {
    const query = 'SELECT * FROM mapping_configurations WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<MappingConfiguration[]> {
    const query = 'SELECT * FROM mapping_configurations WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await this.databaseService.query(query, [userId]);
    return result.rows;
  }

  async create(mapping: Omit<MappingConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<MappingConfiguration> {
    const query = `
      INSERT INTO mapping_configurations (user_id, name, description, api_config_id, mappings)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      mapping.user_id,
      mapping.name,
      mapping.description,
      mapping.api_config_id,
      JSON.stringify(mapping.mappings)
    ];
    const result = await this.databaseService.query(query, values);
    return result.rows[0];
  }

  async update(id: string, mapping: Partial<MappingConfiguration>): Promise<MappingConfiguration | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (mapping.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(mapping.name);
    }
    if (mapping.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(mapping.description);
    }
    if (mapping.api_config_id !== undefined) {
      fields.push(`api_config_id = $${paramIndex++}`);
      values.push(mapping.api_config_id);
    }
    if (mapping.mappings !== undefined) {
      fields.push(`mappings = $${paramIndex++}`);
      values.push(JSON.stringify(mapping.mappings));
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE mapping_configurations 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.databaseService.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM mapping_configurations WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rowCount > 0;
  }
}