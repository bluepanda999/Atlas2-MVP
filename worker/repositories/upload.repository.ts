import { ProcessingJob, UploadOptions } from '../types/upload';
import { DatabaseService } from '../services/database.service';

export class UploadRepository {
  constructor(private databaseService: DatabaseService) {}

  async create(job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const query = `
      INSERT INTO processing_jobs (
        user_id, file_name, file_size, status, progress, 
        records_processed, total_records, csv_headers, 
        error_message, processing_time, estimated_time_remaining, mapping_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *
    `;

    const values = [
      job.userId,
      job.fileName,
      job.fileSize,
      job.status,
      job.progress,
      job.recordsProcessed,
      job.totalRecords,
      JSON.stringify(job.csvHeaders),
      job.errorMessage,
      job.processingTime,
      job.estimatedTimeRemaining,
      job.mappingId || null,
    ];

    try {
      const result = await this.databaseService.query(query, values);
      return this.mapRowToJob(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to create processing job: ${error}`);
    }
  }

  async findById(id: string): Promise<ProcessingJob | null> {
    const query = 'SELECT * FROM processing_jobs WHERE id = $1';
    
    try {
      const result = await this.databaseService.query(query, [id]);
      return result.rows.length > 0 ? this.mapRowToJob(result.rows[0]) : null;
    } catch (error) {
      throw new Error(`Failed to find processing job: ${error}`);
    }
  }

  async findByUserId(
    userId: string, 
    options: UploadOptions & { limit?: number; offset?: number } = {}
  ): Promise<{ jobs: ProcessingJob[]; total: number }> {
    let query = 'SELECT * FROM processing_jobs WHERE user_id = $1';
    const values: any[] = [userId];
    let paramIndex = 2;

    // Add filters
    if (options.status) {
      query += ` AND status = $${paramIndex}`;
      values.push(options.status);
      paramIndex++;
    }

    if (options.startDate) {
      query += ` AND created_at >= $${paramIndex}`;
      values.push(options.startDate);
      paramIndex++;
    }

    if (options.endDate) {
      query += ` AND created_at <= $${paramIndex}`;
      values.push(options.endDate);
      paramIndex++;
    }

    // Add ordering
    query += ' ORDER BY created_at DESC';

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.databaseService.query(countQuery, values);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    if (options.limit) {
      query += ` LIMIT $${paramIndex}`;
      values.push(options.limit);
      paramIndex++;

      if (options.offset) {
        query += ` OFFSET $${paramIndex}`;
        values.push(options.offset);
      }
    }

    try {
      const result = await this.databaseService.query(query, values);
      const jobs = result.rows.map(row => this.mapRowToJob(row));
      return { jobs, total };
    } catch (error) {
      throw new Error(`Failed to find processing jobs by user: ${error}`);
    }
  }

  async update(id: string, updates: Partial<Omit<ProcessingJob, 'id' | 'userId' | 'createdAt' | 'updatedAt'>>): Promise<ProcessingJob> {
    const setClause: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    // Build dynamic SET clause
    Object.entries(updates).forEach(([key, value]) => {
      if (value !== undefined) {
        const columnName = this.camelToSnake(key);
        setClause.push(`${columnName} = $${paramIndex}`);
        
        if (key === 'csvHeaders') {
          values.push(JSON.stringify(value));
        } else {
          values.push(value);
        }
        paramIndex++;
      }
    });

    if (setClause.length === 0) {
      throw new Error('No fields to update');
    }

    const query = `
      UPDATE processing_jobs 
      SET ${setClause.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex}
      RETURNING *
    `;

    values.push(id);

    try {
      const result = await this.databaseService.query(query, values);
      if (result.rows.length === 0) {
        throw new Error('Processing job not found');
      }
      return this.mapRowToJob(result.rows[0]);
    } catch (error) {
      throw new Error(`Failed to update processing job: ${error}`);
    }
  }

  async delete(id: string): Promise<void> {
    const query = 'DELETE FROM processing_jobs WHERE id = $1';
    
    try {
      const result = await this.databaseService.query(query, [id]);
      if (result.rowCount === 0) {
        throw new Error('Processing job not found');
      }
    } catch (error) {
      throw new Error(`Failed to delete processing job: ${error}`);
    }
  }

  async getFileData(jobId: string): Promise<string | null> {
    // In a real implementation, this would retrieve file data from storage
    // For now, return null as file storage is handled separately
    return null;
  }

  private mapRowToJob(row: any): ProcessingJob {
    return {
      id: row.id,
      userId: row.user_id,
      fileName: row.file_name,
      fileSize: row.file_size,
      status: row.status,
      progress: row.progress,
      recordsProcessed: row.records_processed,
      totalRecords: row.total_records,
      csvHeaders: row.csv_headers ? JSON.parse(row.csv_headers) : [],
      errorMessage: row.error_message,
      processingTime: row.processing_time,
      estimatedTimeRemaining: row.estimated_time_remaining,
      mappingId: row.mapping_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}