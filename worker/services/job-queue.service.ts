import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { config } from "../config/config";
import { logger } from "../utils/logger";
import { CsvProcessorService } from "./csv-processor.service";

export interface JobData {
  jobId: string;
  userId: string;
  fileName: string;
  csvData: string;
  mappingId?: string;
}

export class JobQueueService {
  private redis: Redis;
  private csvQueue: Queue;
  private worker: Worker;
  private csvProcessor: CsvProcessorService;

  constructor() {
    const connectionOptions = {
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password || undefined,
      maxRetriesPerRequest: null,
    };

    this.redis = new Redis(connectionOptions);

    this.csvQueue = new Queue("csv-processing", {
      connection: connectionOptions,
      defaultJobOptions: {
        removeOnComplete: 100, // Keep last 100 completed jobs
        removeOnFail: 50, // Keep last 50 failed jobs
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    });

    // Initialize CSV processor (will be injected in real implementation)
    this.csvProcessor = new CsvProcessorService(
      {} as any, // DatabaseService
      {} as any, // UploadRepository
      {} as any, // MappingRepository
    );
  }

  async initialize(): Promise<void> {
    try {
      // Test Redis connection
      await this.redis.ping();
      logger.info("Redis connection established");

      // Initialize worker
      this.worker = new Worker("csv-processing", this.processJob.bind(this), {
        connection: this.redis,
        concurrency: config.worker.concurrency || 2,
        limiter: {
          max: 10,
          duration: 60000, // 1 minute
        },
      });

      // Setup worker event listeners
      this.setupWorkerEvents();

      logger.info("Job queue initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize job queue:", error);
      throw error;
    }
  }

  async addJob(queueName: string, jobData: JobData): Promise<Job> {
    try {
      const job = await this.csvQueue.add(queueName, jobData, {
        priority: this.getJobPriority(jobData),
        delay: this.getJobDelay(jobData),
      });

      logger.info(`Job added to queue: ${job.id}`, {
        jobId: job.id,
        queueName,
        userId: jobData.userId,
        fileName: jobData.fileName,
      });

      return job;
    } catch (error) {
      logger.error("Failed to add job to queue:", error);
      throw error;
    }
  }

  async getJob(jobId: string): Promise<Job | null> {
    try {
      return await this.csvQueue.getJob(jobId);
    } catch (error) {
      logger.error(`Failed to get job ${jobId}:`, error);
      return null;
    }
  }

  async cancelJob(jobId: string): Promise<void> {
    try {
      const job = await this.getJob(jobId);
      if (job) {
        await job.remove();
        logger.info(`Job ${jobId} cancelled and removed from queue`);
      }
    } catch (error) {
      logger.error(`Failed to cancel job ${jobId}:`, error);
      throw error;
    }
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
  }> {
    try {
      const [waiting, active, completed, failed, delayed] = await Promise.all([
        this.csvQueue.getWaiting(),
        this.csvQueue.getActive(),
        this.csvQueue.getCompleted(),
        this.csvQueue.getFailed(),
        this.csvQueue.getDelayed(),
      ]);

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        delayed: delayed.length,
      };
    } catch (error) {
      logger.error("Failed to get queue stats:", error);
      throw error;
    }
  }

  async pauseQueue(): Promise<void> {
    try {
      await this.csvQueue.pause();
      logger.info("Queue paused");
    } catch (error) {
      logger.error("Failed to pause queue:", error);
      throw error;
    }
  }

  async resumeQueue(): Promise<void> {
    try {
      await this.csvQueue.resume();
      logger.info("Queue resumed");
    } catch (error) {
      logger.error("Failed to resume queue:", error);
      throw error;
    }
  }

  async clearQueue(): Promise<void> {
    try {
      await this.csvQueue.drain();
      logger.info("Queue cleared");
    } catch (error) {
      logger.error("Failed to clear queue:", error);
      throw error;
    }
  }

  private async processJob(job: Job<JobData>): Promise<void> {
    const { jobId, userId, fileName, csvData, mappingId } = job.data;

    logger.info(`Processing job ${jobId}`, {
      jobId,
      userId,
      fileName,
      mappingId,
    });

    try {
      // Update job progress to 10%
      await job.updateProgress(10);

      // Process CSV file
      await this.csvProcessor.processCsvFile(jobId, {
        batchSize: 1000,
        maxRetries: 3,
        timeout: 300000,
      });

      // Update job progress to 100%
      await job.updateProgress(100);

      logger.info(`Job ${jobId} completed successfully`);
    } catch (error) {
      logger.error(`Job ${jobId} failed:`, error);
      throw error;
    }
  }

  private setupWorkerEvents(): void {
    this.worker.on("completed", (job) => {
      logger.info(`Job completed: ${job.id}`, {
        jobId: job.id,
        data: job.data,
      });
    });

    this.worker.on("failed", (job, err) => {
      logger.error(`Job failed: ${job?.id}`, {
        jobId: job?.id || "unknown",
        error: err.message,
        stack: err.stack,
      });
    });

    this.worker.on("error", (err) => {
      logger.error("Worker error:", err);
    });

    this.worker.on("stalled", (job) => {
      logger.warn(`Job stalled: ${job?.id}`, {
        jobId: job?.id || "unknown",
      });
    });

    this.csvQueue.on("error", (err) => {
      logger.error("Queue error:", err);
    });
  }

  private getJobPriority(jobData: JobData): number {
    // Implement priority logic based on user tier, file size, etc.
    // For now, return default priority
    return 1;
  }

  private getJobDelay(jobData: JobData): number {
    // Implement delay logic if needed
    // For now, return 0 (no delay)
    return 0;
  }

  async shutdown(): Promise<void> {
    try {
      logger.info("Shutting down job queue...");

      // Close worker
      if (this.worker) {
        await this.worker.close();
      }

      // Close queue
      if (this.csvQueue) {
        await this.csvQueue.close();
      }

      // Close Redis connection
      if (this.redis) {
        await this.redis.quit();
      }

      logger.info("Job queue shutdown complete");
    } catch (error) {
      logger.error("Error during job queue shutdown:", error);
      throw error;
    }
  }
}
