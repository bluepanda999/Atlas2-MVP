import { ProcessingJob, UploadHistoryResult } from '../types/upload';
import { DatabaseService } from '../services/database.service';

export class UploadRepository {
  constructor(private db: DatabaseService) {}

  async createJob(jobData: ProcessingJob): Promise<ProcessingJob> {
    const query = `
      INSERT INTO processing_jobs (
        id, user_id, original_name, file_path, file_size, status, progress, 
        processed_records, total_records, error_message, 
        started_at, completed_at, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
      RETURNING *
    `;
    
    const values = [
      jobData.id,
      jobData.userId,
      jobData.originalName,
      jobData.filePath,
      jobData.fileSize,
      jobData.status,
      jobData.progress,
      jobData.processedRecords,
      jobData.totalRecords,
      jobData.errorMessage,
      jobData.startedAt,
      jobData.completedAt,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToJob(result.rows[0]);
  }

  async getJobById(id: string): Promise<ProcessingJob | null> {
    const query = 'SELECT * FROM processing_jobs WHERE id = $1';
    const result = await this.db.query(query, [id]);
    
    return result.rows.length > 0 ? this.mapRowToJob(result.rows[0]) : null;
  }

  async getJobsByUserId(
    userId: string,
    options: {
      page?: number;
      limit?: number;
      status?: ProcessingJob['status'];
    } = {}
  ): Promise<UploadHistoryResult> {
    const { page = 1, limit = 10, status } = options;
    const offset = (page - 1) * limit;
    
    let whereClause = 'WHERE user_id = $1';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND status = $${paramIndex++}`;
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM processing_jobs ${whereClause}`;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count);

    // Get jobs
    const jobsQuery = `
      SELECT * FROM processing_jobs 
      ${whereClause}
      ORDER BY created_at DESC 
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;
    queryParams.push(limit, offset);

    const jobsResult = await this.db.query(jobsQuery, queryParams);
    const jobs = jobsResult.rows.map(row => this.mapRowToJob(row));

    return {
      jobs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async updateJobStatus(id: string, status: ProcessingJob['status']): Promise<ProcessingJob> {
    const query = `
      UPDATE processing_jobs 
      SET status = $2, updated_at = NOW()
      WHERE id = $1
      RETURNING *
    `;
    
    const result = await this.db.query(query, [id, status]);
    if (result.rows.length === 0) {
      throw new Error('Job not found');
    }
    
    return this.mapRowToJob(result.rows[0]);
  }

  async deleteJob(id: string): Promise<void> {
    // Also delete associated file data
    await this.db.query('DELETE FROM file_data WHERE job_id = $1', [id]);
    await this.db.query('DELETE FROM processing_jobs WHERE id = $1', [id]);
  }

  async getFileData(jobId: string): Promise<string | null> {
    const query = 'SELECT data FROM file_data WHERE job_id = $1';
    const result = await this.db.query(query, [jobId]);
    
    return result.rows.length > 0 ? result.rows[0].data : null;
  }

  async saveFileData(jobId: string, data: string): Promise<void> {
    const query = `
      INSERT INTO file_data (job_id, data)
      VALUES ($1, $2)
      ON CONFLICT (job_id) DO UPDATE SET data = $2
    `;
    
    await this.db.query(query, [jobId, data]);
  }

  async findJobsByStatus(status: ProcessingJob['status']): Promise<ProcessingJob[]> {
    const query = 'SELECT * FROM processing_jobs WHERE status = $1 ORDER BY created_at ASC';
    const result = await this.db.query(query, [status]);
    
    return result.rows.map(row => this.mapRowToJob(row));
  }

  async getJobStats(userId?: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    let whereClause = userId ? 'WHERE user_id = $1' : '';
    const queryParams = userId ? [userId] : [];

    const query = `
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'processing') as processing,
        COUNT(*) FILTER (WHERE status = 'completed') as completed,
        COUNT(*) FILTER (WHERE status = 'failed') as failed
      FROM processing_jobs 
      ${whereClause}
    `;

    const result = await this.db.query(query, queryParams);
    const row = result.rows[0];

    return {
      total: parseInt(row.total),
      pending: parseInt(row.pending),
      processing: parseInt(row.processing),
      completed: parseInt(row.completed),
      failed: parseInt(row.failed),
    };
  }

  private mapRowToJob(row: any): ProcessingJob {
    return {
      id: row.id,
      userId: row.user_id,
      originalName: row.original_name,
      filePath: row.file_path,
      fileSize: row.file_size,
      status: row.status,
      progress: row.progress,
      processedRecords: row.processed_records,
      totalRecords: row.total_records,
      errorMessage: row.error_message,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}