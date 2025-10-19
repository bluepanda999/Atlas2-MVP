import { User } from '../types/auth';
import { DatabaseService } from '../services/database.service';

export class UserRepository {
  constructor(private db: DatabaseService) {}

  async create(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const query = `
      INSERT INTO users (email, password, name, role, is_active, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
      RETURNING *
    `;
    
    const values = [
      userData.email,
      userData.password,
      userData.name,
      userData.role,
      userData.isActive,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToUser(result.rows[0]);
  }

  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.db.query(query, [email]);
    
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async update(id: string, updates: Partial<User>): Promise<User | null> {
    const fields = Object.keys(updates).filter(key => key !== 'id');
    const values = fields.map(field => updates[field as keyof User]);
    
    if (fields.length === 0) {
      return this.findById(id);
    }

    const setClause = fields.map((field, index) => `${this.camelToSnake(field)} = $${index + 2}`).join(', ');
    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [id, ...values]);
    return result.rows.length > 0 ? this.mapRowToUser(result.rows[0]) : null;
  }

  async updatePassword(id: string, hashedPassword: string): Promise<void> {
    const query = `
      UPDATE users 
      SET password = $1, updated_at = NOW()
      WHERE id = $2
    `;
    
    await this.db.query(query, [hashedPassword, id]);
  }

  async updateLastLogin(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_login_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
  }

  async updateLastLogout(id: string): Promise<void> {
    const query = `
      UPDATE users 
      SET last_logout_at = NOW()
      WHERE id = $1
    `;
    
    await this.db.query(query, [id]);
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM users WHERE id = $1';
    await this.db.query(query, [id]);
  }

  async findAll(options: {
    page?: number;
    limit?: number;
    role?: string;
    isActive?: boolean;
  } = {}): Promise<{ users: User[]; total: number }> {
    const { page = 1, limit = 10, role, isActive } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = '';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (role) {
      whereClause += `WHERE role = $${paramIndex++} `;
      queryParams.push(role);
    }

    if (isActive !== undefined) {
      whereClause += whereClause ? `AND is_active = $${paramIndex++} ` : `WHERE is_active = $${paramIndex++} `;
      queryParams.push(isActive);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get users
    const usersQuery = `
      SELECT * FROM users 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(limit, offset);

    const usersResult = await this.db.query(usersQuery, queryParams);
    const users = usersResult.rows.map(row => this.mapRowToUser(row));

    return { users, total };
  }

  private mapRowToUser(row: any): User {
    return {
      id: row.id,
      email: row.email,
      password: row.password,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastLoginAt: row.last_login_at,
      lastLogoutAt: row.last_logout_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}