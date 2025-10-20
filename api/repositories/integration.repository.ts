import { DatabaseService } from '../services/database.service';

export interface ApiConfiguration {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  type: 'rest_api' | 'webhook' | 'database';
  base_url: string;
  auth_type: 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth2';
  auth_config: any;
  headers: any;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class IntegrationRepository {
  constructor(private databaseService: DatabaseService) {}

  async findById(id: string): Promise<ApiConfiguration | null> {
    const query = 'SELECT * FROM api_configurations WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByUserId(userId: string): Promise<ApiConfiguration[]> {
    const query = 'SELECT * FROM api_configurations WHERE user_id = $1 ORDER BY created_at DESC';
    const result = await this.databaseService.query(query, [userId]);
    return result.rows;
  }

  async findActiveByUserId(userId: string): Promise<ApiConfiguration[]> {
    const query = 'SELECT * FROM api_configurations WHERE user_id = $1 AND is_active = true ORDER BY created_at DESC';
    const result = await this.databaseService.query(query, [userId]);
    return result.rows;
  }

  async create(integration: Omit<ApiConfiguration, 'id' | 'created_at' | 'updated_at'>): Promise<ApiConfiguration> {
    const query = `
      INSERT INTO api_configurations (user_id, name, description, type, base_url, auth_type, auth_config, headers, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [
      integration.user_id,
      integration.name,
      integration.description,
      integration.type,
      integration.base_url,
      integration.auth_type,
      JSON.stringify(integration.auth_config),
      JSON.stringify(integration.headers),
      integration.is_active
    ];
    const result = await this.databaseService.query(query, values);
    return result.rows[0];
  }

  async update(id: string, integration: Partial<ApiConfiguration>): Promise<ApiConfiguration | null> {
    const fields = [];
    const values = [];
    let paramIndex = 1;

    if (integration.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(integration.name);
    }
    if (integration.description !== undefined) {
      fields.push(`description = $${paramIndex++}`);
      values.push(integration.description);
    }
    if (integration.type !== undefined) {
      fields.push(`type = $${paramIndex++}`);
      values.push(integration.type);
    }
    if (integration.base_url !== undefined) {
      fields.push(`base_url = $${paramIndex++}`);
      values.push(integration.base_url);
    }
    if (integration.auth_type !== undefined) {
      fields.push(`auth_type = $${paramIndex++}`);
      values.push(integration.auth_type);
    }
    if (integration.auth_config !== undefined) {
      fields.push(`auth_config = $${paramIndex++}`);
      values.push(JSON.stringify(integration.auth_config));
    }
    if (integration.headers !== undefined) {
      fields.push(`headers = $${paramIndex++}`);
      values.push(JSON.stringify(integration.headers));
    }
    if (integration.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(integration.is_active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const query = `
      UPDATE api_configurations 
      SET ${fields.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    const result = await this.databaseService.query(query, values);
    return result.rows[0] || null;
  }

  async delete(id: string): Promise<boolean> {
    const query = 'DELETE FROM api_configurations WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rowCount > 0;
  }

  async activate(id: string): Promise<boolean> {
    const query = 'UPDATE api_configurations SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rowCount > 0;
  }

  async deactivate(id: string): Promise<boolean> {
    const query = 'UPDATE api_configurations SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1';
    const result = await this.databaseService.query(query, [id]);
    return result.rowCount > 0;
  }
}