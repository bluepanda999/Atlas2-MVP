import { config } from "./config/config";
import { logger } from "./utils/logger";
import { JobQueueService } from "./services/job-queue.service";
import { DatabaseService } from "./services/database.service";
import { UploadRepository } from "./repositories/upload.repository";
import { MappingRepository } from "./repositories/mapping.repository";
import { CsvProcessorService } from "./services/csv-processor.service";

class WorkerApplication {
  private jobQueueService: JobQueueService;
  private databaseService: DatabaseService;
  private csvProcessorService: CsvProcessorService;

  constructor() {
    this.databaseService = new DatabaseService();
    this.jobQueueService = new JobQueueService();
    this.csvProcessorService = new CsvProcessorService(
      this.databaseService,
      new UploadRepository(this.databaseService),
      new MappingRepository(this.databaseService),
    );
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize database connection
      await this.databaseService.connect();
      logger.info("Database connected successfully");

      // Initialize job queue
      await this.jobQueueService.initialize();
      logger.info("Job queue initialized successfully");

      // Setup graceful shutdown handlers
      this.setupShutdownHandlers();

      logger.info("Worker application initialized successfully");
    } catch (error) {
      logger.error("Failed to initialize worker application:", error);
      throw error;
    }
  }

  public async start(): Promise<void> {
    try {
      logger.info("Starting worker application...");
      logger.info(`Worker concurrency: ${config.worker.concurrency || 2}`);
      logger.info(`Environment: ${config.nodeEnv}`);

      // The worker is already running as part of the job queue initialization
      logger.info("Worker is now processing jobs");

      // Keep the process alive
      this.keepAlive();
    } catch (error) {
      logger.error("Failed to start worker application:", error);
      throw error;
    }
  }

  private keepAlive(): void {
    // Prevent the process from exiting
    setInterval(() => {
      // Heartbeat log
      logger.debug("Worker heartbeat");
    }, 60000); // Log every minute
  }

  private setupShutdownHandlers(): void {
    const shutdown = async (signal: string) => {
      logger.info(`${signal} received, shutting down gracefully...`);

      try {
        await this.jobQueueService.shutdown();
        await this.databaseService.disconnect();
        logger.info("Worker shutdown complete");
        process.exit(0);
      } catch (error) {
        logger.error("Error during shutdown:", error);
        process.exit(1);
      }
    };

    process.on("SIGTERM", () => shutdown("SIGTERM"));
    process.on("SIGINT", () => shutdown("SIGINT"));
  }

  // Health check method
  public async healthCheck(): Promise<{
    status: "healthy" | "unhealthy";
    timestamp: string;
    details: any;
  }> {
    try {
      const queueStats = await this.jobQueueService.getQueueStats();
      const dbConnected = await this.databaseService.isConnected();

      const isHealthy = dbConnected && queueStats.active >= 0;

      return {
        status: isHealthy ? "healthy" : "unhealthy",
        timestamp: new Date().toISOString(),
        details: {
          database: {
            connected: dbConnected,
          },
          queue: queueStats,
          worker: {
            concurrency: config.worker.concurrency || 2,
          },
        },
      };
    } catch (error) {
      logger.error("Health check failed:", error);
      return {
        status: "unhealthy",
        timestamp: new Date().toISOString(),
        details: {
          error: error instanceof Error ? error.message : "Unknown error",
        },
      };
    }
  }
}

// Handle uncaught exceptions
process.on("uncaughtException", (error) => {
  logger.error("Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the worker application
if (require.main === module) {
  const app = new WorkerApplication();

  app
    .initialize()
    .then(() => app.start())
    .catch((error) => {
      logger.error("Failed to start worker application:", error);
      process.exit(1);
    });
}

export default new WorkerApplication();
