import { logger } from './utils/logger';
import { QueueProcessor } from './services/queueProcessor';
import { CSVProcessor } from './services/csvProcessor';
import { RedisClient } from './services/redisClient';

async function startWorker() {
  try {
    logger.info('Starting Atlas2 Worker...');

    // Initialize Redis connection
    await RedisClient.connect();
    logger.info('Connected to Redis');

    // Initialize services
    const csvProcessor = new CSVProcessor();
    const queueProcessor = new QueueProcessor(csvProcessor);

    // Start processing jobs
    await queueProcessor.start();
    logger.info('Worker started successfully');

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await queueProcessor.stop();
      await RedisClient.disconnect();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await queueProcessor.stop();
      await RedisClient.disconnect();
      process.exit(0);
    });

  } catch (error) {
    logger.error('Failed to start worker:', error);
    process.exit(1);
  }
}

startWorker();