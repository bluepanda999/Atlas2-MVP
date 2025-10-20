import { createClient, RedisClientType } from 'redis';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export interface Job {
  id: string;
  type: string;
  data: any;
  priority?: number;
  attempts?: number;
  maxAttempts?: number;
  delay?: number;
  createdAt: Date;
}

export class JobQueueService {
  private client: RedisClientType;
  private isInitialized = false;

  constructor() {
    this.client = createClient({
      socket: {
        host: config.redis.host,
        port: config.redis.port,
      },
      password: config.redis.password || undefined,
      database: config.redis.db,
    });

    this.client.on('error', (err) => {
      logger.error('Redis client error:', err);
    });

    this.client.on('connect', () => {
      logger.info('Redis client connected');
    });
  }

  async initialize(): Promise<void> {
    try {
      await this.client.connect();
      this.isInitialized = true;
      logger.info('Job queue service initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize job queue service:', error);
      throw error;
    }
  }

  async addJob(queue: string, jobData: Omit<Job, 'id' | 'createdAt'>): Promise<string> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const job: Job = {
        ...jobData,
        id: this.generateJobId(),
        createdAt: new Date(),
        attempts: 0,
        maxAttempts: jobData.maxAttempts || 3,
      };

      const jobKey = `${config.redis.keyPrefix}job:${job.id}`;
      const queueKey = `${config.redis.keyPrefix}queue:${queue}`;

      // Store job data
      await this.client.hSet(jobKey, {
        id: job.id,
        type: job.type,
        data: JSON.stringify(job.data),
        priority: (job.priority || 0).toString(),
        attempts: job.attempts.toString(),
        maxAttempts: job.maxAttempts.toString(),
        createdAt: job.createdAt.toISOString(),
      });

      // Add to queue with priority
      await this.client.zAdd(queueKey, {
        score: -(job.priority || 0), // Negative for descending order
        value: job.id,
      });

      // Set expiration for job data (24 hours)
      await this.client.expire(jobKey, 24 * 60 * 60);

      logger.info('Job added to queue', { jobId: job.id, queue, type: job.type });
      return job.id;
    } catch (error) {
      logger.error('Failed to add job to queue:', { queue, jobData, error });
      throw error;
    }
  }

  async getNextJob(queue: string): Promise<Job | null> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const queueKey = `${config.redis.keyPrefix}queue:${queue}`;
      
      // Get the highest priority job
      const jobs = await this.client.zRange(queueKey, 0, 0, { REV: true });
      
      if (jobs.length === 0) {
        return null;
      }

      const jobId = jobs[0];
      const jobKey = `${config.redis.keyPrefix}job:${jobId}`;

      // Get job data
      const jobData = await this.client.hGetAll(jobKey);
      
      if (!jobData || !jobData.id) {
        // Remove invalid job from queue
        await this.client.zRem(queueKey, jobId);
        return null;
      }

      const job: Job = {
        id: jobData.id,
        type: jobData.type,
        data: JSON.parse(jobData.data),
        priority: parseInt(jobData.priority || '0'),
        attempts: parseInt(jobData.attempts || '0'),
        maxAttempts: parseInt(jobData.maxAttempts || '3'),
        createdAt: new Date(jobData.createdAt),
      };

      // Remove from queue
      await this.client.zRem(queueKey, jobId);

      logger.info('Job retrieved from queue', { jobId: job.id, queue, type: job.type });
      return job;
    } catch (error) {
      logger.error('Failed to get next job from queue:', { queue, error });
      throw error;
    }
  }

  async completeJob(jobId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const jobKey = `${config.redis.keyPrefix}job:${jobId}`;
      await this.client.del(jobKey);
      
      logger.info('Job completed', { jobId });
    } catch (error) {
      logger.error('Failed to complete job:', { jobId, error });
      throw error;
    }
  }

  async failJob(jobId: string, queue: string, error?: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const jobKey = `${config.redis.keyPrefix}job:${jobId}`;
      const queueKey = `${config.redis.keyPrefix}queue:${queue}`;
      
      // Get job data
      const jobData = await this.client.hGetAll(jobKey);
      
      if (!jobData || !jobData.id) {
        return;
      }

      const attempts = parseInt(jobData.attempts || '0') + 1;
      const maxAttempts = parseInt(jobData.maxAttempts || '3');

      if (attempts >= maxAttempts) {
        // Max attempts reached, remove job
        await this.client.del(jobKey);
        logger.error('Job failed after max attempts', { jobId, attempts, maxAttempts, error });
      } else {
        // Retry job with exponential backoff
        const delay = Math.pow(2, attempts) * 1000; // 2^attempts seconds
        
        await this.client.hSet(jobKey, 'attempts', attempts.toString());
        
        // Add back to queue with delay
        setTimeout(async () => {
          await this.client.zAdd(queueKey, {
            score: -parseInt(jobData.priority || '0'),
            value: jobId,
          });
        }, delay);

        logger.warn('Job failed, retrying', { jobId, attempts, maxAttempts, delay, error });
      }
    } catch (error) {
      logger.error('Failed to handle job failure:', { jobId, queue, error });
      throw error;
    }
  }

  async removeJob(jobId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const jobKey = `${config.redis.keyPrefix}job:${jobId}`;
      
      // Remove job from all possible queues
      const queues = ['csv-processing']; // Add more queues as needed
      for (const queue of queues) {
        const queueKey = `${config.redis.keyPrefix}queue:${queue}`;
        await this.client.zRem(queueKey, jobId);
      }
      
      // Remove job data
      await this.client.del(jobKey);
      
      logger.info('Job removed from queue', { jobId });
    } catch (error) {
      logger.error('Failed to remove job:', { jobId, error });
      throw error;
    }
  }

  async getQueueStats(queue: string): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    if (!this.isInitialized) {
      throw new Error('Job queue service not initialized');
    }

    try {
      const queueKey = `${config.redis.keyPrefix}queue:${queue}`;
      const processingKey = `${config.redis.keyPrefix}processing:${queue}`;
      
      const pending = await this.client.zCard(queueKey);
      const processing = await this.client.sCard(processingKey);
      
      // For completed and failed, we would need to track these separately
      // For now, return basic stats
      return {
        pending,
        processing,
        completed: 0,
        failed: 0,
      };
    } catch (error) {
      logger.error('Failed to get queue stats:', { queue, error });
      throw error;
    }
  }

  async shutdown(): Promise<void> {
    if (this.isInitialized) {
      await this.client.disconnect();
      this.isInitialized = false;
      logger.info('Job queue service shut down');
    }
  }

  private generateJobId(): string {
    return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}