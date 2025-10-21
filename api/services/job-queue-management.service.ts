import { logger } from "../utils/logger";
import { DatabaseService } from "./database.service";

export interface Job {
  id: string;
  type: JobType;
  status: JobStatus;
  priority: JobPriority;
  user_id: string;
  payload: JobPayload;
  dependencies?: string[];
  max_retries: number;
  retry_count: number;
  created_at: Date;
  scheduled_at: Date;
  started_at?: Date;
  completed_at?: Date;
  failed_at?: Date;
  error_message?: string;
  progress: number; // 0-100
  result?: any;
  metadata: JobMetadata;
}

export enum JobType {
  CSV_PROCESSING = "csv_processing",
  API_UPLOAD = "api_upload",
  DATA_TRANSFORMATION = "data_transformation",
  VALIDATION = "validation",
  CLIENT_GENERATION = "client_generation",
  TEMPLATE_PROCESSING = "template_processing",
  REPORT_GENERATION = "report_generation",
  CLEANUP = "cleanup",
}

export enum JobStatus {
  PENDING = "pending",
  SCHEDULED = "scheduled",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  RETRYING = "retrying",
}

export enum JobPriority {
  CRITICAL = "critical",
  HIGH = "high",
  NORMAL = "normal",
  LOW = "low",
}

export interface JobPayload {
  [key: string]: any;
  // Common payload fields
  file_path?: string;
  mapping_id?: string;
  api_config_id?: string;
  target_url?: string;
  data?: any;
  options?: Record<string, any>;
}

export interface JobMetadata {
  resource_requirements: ResourceRequirements;
  estimated_duration?: number; // in minutes
  timeout?: number; // in minutes
  retry_delay?: number; // in minutes
  tags?: string[];
  category?: string;
  description?: string;
}

export interface ResourceRequirements {
  cpu_cores?: number;
  memory_mb?: number;
  disk_space_mb?: number;
  network_bandwidth?: number;
}

export interface QueueStats {
  total_jobs: number;
  jobs_by_status: Record<JobStatus, number>;
  jobs_by_priority: Record<JobPriority, number>;
  jobs_by_type: Record<JobType, number>;
  average_wait_time: number;
  average_processing_time: number;
  throughput_per_hour: number;
  success_rate: number;
  queue_depth: number;
  resource_utilization: ResourceUtilization;
}

export interface ResourceUtilization {
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  active_workers: number;
  queued_jobs: number;
}

export interface QueueConfiguration {
  max_concurrent_jobs: number;
  max_queue_size: number;
  default_timeout: number;
  default_retries: number;
  retry_delay: number;
  resource_limits: ResourceLimits;
  scheduling_policy: SchedulingPolicy;
}

export interface ResourceLimits {
  max_cpu_cores: number;
  max_memory_mb: number;
  max_disk_space_mb: number;
  max_network_bandwidth: number;
}

export enum SchedulingPolicy {
  FIFO = "fifo",
  PRIORITY = "priority",
  SHORTEST_JOB_FIRST = "shortest_job_first",
  FAIR_SHARE = "fair_share",
  RESOURCE_AWARE = "resource_aware",
}

export interface JobDependency {
  job_id: string;
  depends_on: string[];
  dependency_type: DependencyType;
}

export enum DependencyType {
  SUCCESS = "success",
  COMPLETION = "completion",
  FAILURE = "failure",
}

export class JobQueueManagementService {
  private queueConfiguration: QueueConfiguration;
  private activeJobs: Map<string, Job> = new Map();
  private processingInterval?: NodeJS.Timeout;

  constructor(private databaseService: DatabaseService) {
    this.queueConfiguration = {
      max_concurrent_jobs: 10,
      max_queue_size: 1000,
      default_timeout: 60, // minutes
      default_retries: 3,
      retry_delay: 5, // minutes
      resource_limits: {
        max_cpu_cores: 8,
        max_memory_mb: 4096,
        max_disk_space_mb: 10240,
        max_network_bandwidth: 100,
      },
      scheduling_policy: SchedulingPolicy.PRIORITY,
    };

    this.startQueueProcessor();
  }

  /**
   * Submit a new job to the queue
   */
  async submitJob(
    jobData: Omit<
      Job,
      | "id"
      | "status"
      | "created_at"
      | "scheduled_at"
      | "retry_count"
      | "progress"
    >,
  ): Promise<{ success: boolean; jobId?: string; error?: string }> {
    try {
      // Check queue capacity
      const queueStats = await this.getQueueStats();
      if (queueStats.queue_depth >= this.queueConfiguration.max_queue_size) {
        return { success: false, error: "Queue is full" };
      }

      // Check resource availability
      const resourceCheck = await this.checkResourceAvailability(
        jobData.metadata.resource_requirements,
      );
      if (!resourceCheck.available) {
        return {
          success: false,
          error: `Insufficient resources: ${resourceCheck.reason}`,
        };
      }

      // Validate dependencies
      if (jobData.dependencies && jobData.dependencies.length > 0) {
        const dependencyCheck = await this.validateDependencies(
          jobData.dependencies,
        );
        if (!dependencyCheck.valid) {
          return {
            success: false,
            error: `Invalid dependencies: ${dependencyCheck.reason}`,
          };
        }
      }

      const query = `
        INSERT INTO jobs (
          type, status, priority, user_id, payload, dependencies,
          max_retries, retry_count, scheduled_at, progress, metadata
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id
      `;

      const values = [
        jobData.type,
        JobStatus.PENDING,
        jobData.priority,
        jobData.user_id,
        JSON.stringify(jobData.payload),
        JSON.stringify(jobData.dependencies || []),
        jobData.max_retries || this.queueConfiguration.default_retries,
        0,
        jobData.scheduled_at || new Date(),
        0,
        JSON.stringify(jobData.metadata),
      ];

      const result = await this.databaseService.query(query, values);
      const jobId = result.rows[0].id;

      logger.info(`Job submitted: ${jobId} (${jobData.type})`);
      return { success: true, jobId };
    } catch (error) {
      logger.error("Job submission failed:", error);
      return { success: false, error: "Failed to submit job" };
    }
  }

  /**
   * Get job by ID
   */
  async getJob(jobId: string): Promise<Job | null> {
    try {
      const query = "SELECT * FROM jobs WHERE id = $1";
      const result = await this.databaseService.query(query, [jobId]);
      return result.rows[0] ? this.mapRowToJob(result.rows[0]) : null;
    } catch (error) {
      logger.error("Error fetching job:", error);
      return null;
    }
  }

  /**
   * Get jobs with filtering and pagination
   */
  async getJobs(
    userId?: string,
    filters: {
      status?: JobStatus;
      type?: JobType;
      priority?: JobPriority;
      date_from?: Date;
      date_to?: Date;
    } = {},
    pagination: {
      limit: number;
      offset: number;
    } = { limit: 50, offset: 0 },
  ): Promise<{ jobs: Job[]; total: number }> {
    try {
      let query = "SELECT * FROM jobs WHERE 1=1";
      const params: any[] = [];
      let paramIndex = 1;

      if (userId) {
        query += ` AND user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.type) {
        query += ` AND type = $${paramIndex}`;
        params.push(filters.type);
        paramIndex++;
      }

      if (filters.priority) {
        query += ` AND priority = $${paramIndex}`;
        params.push(filters.priority);
        paramIndex++;
      }

      if (filters.date_from) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(filters.date_from);
        paramIndex++;
      }

      if (filters.date_to) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(filters.date_to);
        paramIndex++;
      }

      // Count query
      const countQuery = query.replace(/SELECT.*?FROM/, "SELECT COUNT(*) FROM");
      const countResult = await this.databaseService.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering and pagination
      query += ` ORDER BY created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(pagination.limit, pagination.offset);

      const result = await this.databaseService.query(query, params);

      return {
        jobs: result.rows.map(this.mapRowToJob),
        total,
      };
    } catch (error) {
      logger.error("Error fetching jobs:", error);
      return { jobs: [], total: 0 };
    }
  }

  /**
   * Update job status
   */
  async updateJobStatus(
    jobId: string,
    status: JobStatus,
    progress?: number,
    errorMessage?: string,
    result?: any,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const updates = ["status = $2", "updated_at = CURRENT_TIMESTAMP"];
      const values = [jobId, status];
      let paramIndex = 3;

      if (progress !== undefined) {
        updates.push(`progress = $${paramIndex}`);
        values.push(progress);
        paramIndex++;
      }

      if (errorMessage) {
        updates.push(`error_message = $${paramIndex}`);
        values.push(errorMessage);
        paramIndex++;
      }

      if (result) {
        updates.push(`result = $${paramIndex}`);
        values.push(JSON.stringify(result));
        paramIndex++;
      }

      // Add timestamps based on status
      if (status === JobStatus.RUNNING) {
        updates.push(`started_at = CURRENT_TIMESTAMP`);
      } else if (status === JobStatus.COMPLETED) {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
      } else if (status === JobStatus.FAILED) {
        updates.push(`failed_at = CURRENT_TIMESTAMP`);
      }

      const query = `UPDATE jobs SET ${updates.join(", ")} WHERE id = $1`;
      await this.databaseService.query(query, values);

      // Update active jobs tracking
      if (status === JobStatus.RUNNING) {
        const job = await this.getJob(jobId);
        if (job) {
          this.activeJobs.set(jobId, job);
        }
      } else if (
        [JobStatus.COMPLETED, JobStatus.FAILED, JobStatus.CANCELLED].includes(
          status,
        )
      ) {
        this.activeJobs.delete(jobId);
      }

      logger.info(`Job status updated: ${jobId} -> ${status}`);
      return { success: true };
    } catch (error) {
      logger.error("Error updating job status:", error);
      return { success: false, error: "Failed to update job status" };
    }
  }

  /**
   * Cancel a job
   */
  async cancelJob(
    jobId: string,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        return { success: false, error: "Job not found" };
      }

      if (userId && job.user_id !== userId) {
        return { success: false, error: "Access denied" };
      }

      if (![JobStatus.PENDING, JobStatus.SCHEDULED].includes(job.status)) {
        return {
          success: false,
          error: "Job cannot be cancelled in current status",
        };
      }

      return await this.updateJobStatus(jobId, JobStatus.CANCELLED);
    } catch (error) {
      logger.error("Error cancelling job:", error);
      return { success: false, error: "Failed to cancel job" };
    }
  }

  /**
   * Retry a failed job
   */
  async retryJob(
    jobId: string,
    userId?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const job = await this.getJob(jobId);
      if (!job) {
        return { success: false, error: "Job not found" };
      }

      if (userId && job.user_id !== userId) {
        return { success: false, error: "Access denied" };
      }

      if (job.status !== JobStatus.FAILED) {
        return { success: false, error: "Only failed jobs can be retried" };
      }

      if (job.retry_count >= job.max_retries) {
        return { success: false, error: "Maximum retry attempts exceeded" };
      }

      // Update job for retry
      const retryDelay =
        job.metadata.retry_delay || this.queueConfiguration.retry_delay;
      const scheduledAt = new Date(Date.now() + retryDelay * 60 * 1000);

      const query = `
        UPDATE jobs 
        SET status = $2, retry_count = retry_count + 1, scheduled_at = $3, 
            error_message = NULL, started_at = NULL, failed_at = NULL
        WHERE id = $1
      `;

      await this.databaseService.query(query, [
        jobId,
        JobStatus.RETRYING,
        scheduledAt,
      ]);

      logger.info(
        `Job queued for retry: ${jobId} (attempt ${job.retry_count + 1})`,
      );
      return { success: true };
    } catch (error) {
      logger.error("Error retrying job:", error);
      return { success: false, error: "Failed to retry job" };
    }
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<QueueStats> {
    try {
      // Get job counts by status
      const statusQuery = `
        SELECT status, COUNT(*) as count 
        FROM jobs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
        GROUP BY status
      `;
      const statusResult = await this.databaseService.query(statusQuery);
      const jobsByStatus = statusResult.rows.reduce(
        (acc: Record<JobStatus, number>, row: any) => {
          acc[row.status] = parseInt(row.count);
          return acc;
        },
        {} as Record<JobStatus, number>,
      );

      // Get job counts by priority
      const priorityQuery = `
        SELECT priority, COUNT(*) as count 
        FROM jobs 
        WHERE status IN ('pending', 'scheduled', 'running')
        GROUP BY priority
      `;
      const priorityResult = await this.databaseService.query(priorityQuery);
      const jobsByPriority = priorityResult.rows.reduce(
        (acc: Record<JobPriority, number>, row: any) => {
          acc[row.priority] = parseInt(row.count);
          return acc;
        },
        {} as Record<JobPriority, number>,
      );

      // Get job counts by type
      const typeQuery = `
        SELECT type, COUNT(*) as count 
        FROM jobs 
        WHERE created_at >= CURRENT_DATE - INTERVAL '24 hours'
        GROUP BY type
      `;
      const typeResult = await this.databaseService.query(typeQuery);
      const jobsByType = typeResult.rows.reduce(
        (acc: Record<JobType, number>, row: any) => {
          acc[row.type] = parseInt(row.count);
          return acc;
        },
        {} as Record<JobType, number>,
      );

      // Calculate metrics
      const totalJobs = Object.values(jobsByStatus).reduce(
        (sum, count) => sum + count,
        0,
      );
      const completedJobs = jobsByStatus[JobStatus.COMPLETED] || 0;
      const failedJobs = jobsByStatus[JobStatus.FAILED] || 0;
      const successRate =
        totalJobs > 0
          ? (completedJobs / (completedJobs + failedJobs)) * 100
          : 0;

      // Get timing metrics
      const timingQuery = `
        SELECT 
          AVG(EXTRACT(EPOCH FROM (started_at - created_at)) / 60) as avg_wait_time,
          AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 60) as avg_processing_time
        FROM jobs 
        WHERE status = 'completed' 
        AND created_at >= CURRENT_DATE - INTERVAL '24 hours'
      `;
      const timingResult = await this.databaseService.query(timingQuery);
      const avgWaitTime = parseFloat(timingResult.rows[0]?.avg_wait_time) || 0;
      const avgProcessingTime =
        parseFloat(timingResult.rows[0]?.avg_processing_time) || 0;

      // Get resource utilization
      const resourceUtilization = await this.getResourceUtilization();

      return {
        total_jobs: totalJobs,
        jobs_by_status: jobsByStatus,
        jobs_by_priority: jobsByPriority,
        jobs_by_type: jobsByType,
        average_wait_time: avgWaitTime,
        average_processing_time: avgProcessingTime,
        throughput_per_hour: completedJobs / 24, // jobs per hour in last 24h
        success_rate: successRate,
        queue_depth:
          (jobsByStatus[JobStatus.PENDING] || 0) +
          (jobsByStatus[JobStatus.SCHEDULED] || 0),
        resource_utilization: resourceUtilization,
      };
    } catch (error) {
      logger.error("Error getting queue stats:", error);
      return {
        total_jobs: 0,
        jobs_by_status: {} as Record<JobStatus, number>,
        jobs_by_priority: {} as Record<JobPriority, number>,
        jobs_by_type: {} as Record<JobType, number>,
        average_wait_time: 0,
        average_processing_time: 0,
        throughput_per_hour: 0,
        success_rate: 0,
        queue_depth: 0,
        resource_utilization: {
          cpu_usage: 0,
          memory_usage: 0,
          disk_usage: 0,
          active_workers: 0,
          queued_jobs: 0,
        },
      };
    }
  }

  /**
   * Update queue configuration
   */
  async updateConfiguration(
    config: Partial<QueueConfiguration>,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      this.queueConfiguration = { ...this.queueConfiguration, ...config };
      logger.info("Queue configuration updated:", config);
      return { success: true };
    } catch (error) {
      logger.error("Error updating configuration:", error);
      return { success: false, error: "Failed to update configuration" };
    }
  }

  /**
   * Start the queue processor
   */
  private startQueueProcessor(): void {
    this.processingInterval = setInterval(async () => {
      await this.processQueue();
    }, 5000); // Process every 5 seconds
  }

  /**
   * Process the job queue
   */
  private async processQueue(): Promise<void> {
    try {
      const stats = await this.getQueueStats();

      // Check if we can process more jobs
      if (
        stats.resource_utilization.active_workers >=
        this.queueConfiguration.max_concurrent_jobs
      ) {
        return;
      }

      // Get next jobs to process based on scheduling policy
      const jobs = await this.getNextJobs();

      for (const job of jobs) {
        if (
          stats.resource_utilization.active_workers >=
          this.queueConfiguration.max_concurrent_jobs
        ) {
          break;
        }

        // Check dependencies
        if (job.dependencies && job.dependencies.length > 0) {
          const dependenciesMet = await this.checkDependenciesMet(
            job.dependencies,
          );
          if (!dependenciesMet) {
            continue;
          }
        }

        // Start the job
        await this.updateJobStatus(job.id, JobStatus.RUNNING);
        await this.executeJob(job);
      }
    } catch (error) {
      logger.error("Error processing queue:", error);
    }
  }

  /**
   * Get next jobs to process based on scheduling policy
   */
  private async getNextJobs(): Promise<Job[]> {
    let query = "SELECT * FROM jobs WHERE status IN ($1, $2)";
    const params = [JobStatus.PENDING, JobStatus.SCHEDULED];

    switch (this.queueConfiguration.scheduling_policy) {
      case SchedulingPolicy.PRIORITY:
        query += " ORDER BY priority DESC, created_at ASC";
        break;
      case SchedulingPolicy.SHORTEST_JOB_FIRST:
        query +=
          " ORDER BY metadata->>'estimated_duration' ASC NULLS LAST, created_at ASC";
        break;
      case SchedulingPolicy.FIFO:
      default:
        query += " ORDER BY created_at ASC";
        break;
    }

    query += ` LIMIT ${this.queueConfiguration.max_concurrent_jobs}`;

    const result = await this.databaseService.query(query, params);
    return result.rows.map(this.mapRowToJob);
  }

  /**
   * Execute a job
   */
  private async executeJob(job: Job): Promise<void> {
    try {
      logger.info(`Executing job: ${job.id} (${job.type})`);

      // This would integrate with actual job execution logic
      // For now, simulate job execution
      setTimeout(
        async () => {
          const success = Math.random() > 0.1; // 90% success rate

          if (success) {
            await this.updateJobStatus(
              job.id,
              JobStatus.COMPLETED,
              100,
              undefined,
              { success: true },
            );
          } else {
            await this.updateJobStatus(
              job.id,
              JobStatus.FAILED,
              0,
              "Simulated job failure",
            );
          }
        },
        (job.metadata.estimated_duration || 5) * 1000,
      );
    } catch (error) {
      logger.error(`Job execution failed: ${job.id}`, error);
      await this.updateJobStatus(
        job.id,
        JobStatus.FAILED,
        0,
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  }

  /**
   * Check resource availability
   */
  private async checkResourceAvailability(
    requirements: ResourceRequirements,
  ): Promise<{ available: boolean; reason?: string }> {
    try {
      const utilization = await this.getResourceUtilization();

      if (
        requirements.cpu_cores &&
        utilization.cpu_usage + requirements.cpu_cores >
          this.queueConfiguration.resource_limits.max_cpu_cores
      ) {
        return { available: false, reason: "Insufficient CPU cores" };
      }

      if (
        requirements.memory_mb &&
        utilization.memory_usage + requirements.memory_mb >
          this.queueConfiguration.resource_limits.max_memory_mb
      ) {
        return { available: false, reason: "Insufficient memory" };
      }

      return { available: true };
    } catch (error) {
      logger.error("Error checking resource availability:", error);
      return { available: false, reason: "Failed to check resources" };
    }
  }

  /**
   * Get current resource utilization
   */
  private async getResourceUtilization(): Promise<ResourceUtilization> {
    // This would integrate with actual system monitoring
    // For now, return simulated data
    return {
      cpu_usage: this.activeJobs.size * 0.5,
      memory_usage: this.activeJobs.size * 256,
      disk_usage: 1024,
      active_workers: this.activeJobs.size,
      queued_jobs: 0, // Would be calculated from database
    };
  }

  /**
   * Validate job dependencies
   */
  private async validateDependencies(
    dependencies: string[],
  ): Promise<{ valid: boolean; reason?: string }> {
    try {
      const query = "SELECT id, status FROM jobs WHERE id = ANY($1)";
      const result = await this.databaseService.query(query, [dependencies]);

      const foundJobs = result.rows;
      if (foundJobs.length !== dependencies.length) {
        return {
          valid: false,
          reason: "One or more dependency jobs not found",
        };
      }

      return { valid: true };
    } catch (error) {
      logger.error("Error validating dependencies:", error);
      return { valid: false, reason: "Failed to validate dependencies" };
    }
  }

  /**
   * Check if dependencies are met
   */
  private async checkDependenciesMet(dependencies: string[]): Promise<boolean> {
    try {
      const query = "SELECT status FROM jobs WHERE id = ANY($1)";
      const result = await this.databaseService.query(query, [dependencies]);

      return result.rows.every((job) => job.status === JobStatus.COMPLETED);
    } catch (error) {
      logger.error("Error checking dependencies met:", error);
      return false;
    }
  }

  /**
   * Map database row to Job object
   */
  private mapRowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type,
      status: row.status,
      priority: row.priority,
      user_id: row.user_id,
      payload: row.payload,
      dependencies: row.dependencies,
      max_retries: row.max_retries,
      retry_count: row.retry_count,
      created_at: row.created_at,
      scheduled_at: row.scheduled_at,
      started_at: row.started_at,
      completed_at: row.completed_at,
      failed_at: row.failed_at,
      error_message: row.error_message,
      progress: row.progress,
      result: row.result,
      metadata: row.metadata,
    };
  }
}
