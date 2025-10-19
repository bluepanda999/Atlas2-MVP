import winston from 'winston';
import { config } from '../config/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = config.nodeEnv || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'info';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `[WORKER] ${info.timestamp} ${info.level}: ${info.message}`,
  ),
);

// Define transports
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/worker-error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/worker-all.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Add production-specific transports
if (config.nodeEnv === 'production') {
  // Add external logging service
  if (config.logging.externalService) {
    transports.push(
      new winston.transports.Http({
        host: config.logging.externalService.host,
        port: config.logging.externalService.port,
        path: config.logging.externalService.path,
        level: 'info',
        format: winston.format.json()
      })
    );
  }
}

// Create the logger
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false,
});

// Worker-specific logging helpers
logger.jobStart = (jobId: string, jobData: any) => {
  logger.info(`Job started: ${jobId}`, {
    jobId,
    jobData,
    timestamp: new Date().toISOString(),
  });
};

logger.jobProgress = (jobId: string, progress: number, details?: any) => {
  logger.info(`Job progress: ${jobId} - ${progress}%`, {
    jobId,
    progress,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

logger.jobComplete = (jobId: string, result?: any) => {
  logger.info(`Job completed: ${jobId}`, {
    jobId,
    result,
    timestamp: new Date().toISOString(),
  });
};

logger.jobFailed = (jobId: string, error: Error, retryCount?: number) => {
  logger.error(`Job failed: ${jobId}`, {
    jobId,
    error: error.message,
    stack: error.stack,
    retryCount,
    timestamp: new Date().toISOString(),
  });
};

logger.jobRetry = (jobId: string, retryCount: number, nextRetry: Date) => {
  logger.warn(`Job retry scheduled: ${jobId} (attempt ${retryCount + 1})`, {
    jobId,
    retryCount,
    nextRetry: nextRetry.toISOString(),
    timestamp: new Date().toISOString(),
  });
};

logger.queueStats = (stats: any) => {
  logger.info('Queue statistics', {
    ...stats,
    timestamp: new Date().toISOString(),
  });
};

logger.csvProcessing = (jobId: string, stage: string, details?: any) => {
  logger.info(`CSV Processing: ${jobId} - ${stage}`, {
    jobId,
    stage,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

logger.batchProcessing = (jobId: string, batchNumber: number, totalBatches: number, recordCount: number) => {
  logger.info(`Batch processing: ${jobId} - batch ${batchNumber}/${totalBatches} (${recordCount} records)`, {
    jobId,
    batchNumber,
    totalBatches,
    recordCount,
    timestamp: new Date().toISOString(),
  });
};

logger.transformationApplied = (jobId: string, ruleName: string, recordCount: number) => {
  logger.debug(`Transformation applied: ${jobId} - ${ruleName} (${recordCount} records)`, {
    jobId,
    ruleName,
    recordCount,
    timestamp: new Date().toISOString(),
  });
};

logger.apiCall = (jobId: string, endpoint: string, method: string, success: boolean, duration?: number) => {
  const level = success ? 'info' : 'error';
  logger[level](`API call: ${jobId} - ${method} ${endpoint}`, {
    jobId,
    endpoint,
    method,
    success,
    duration,
    timestamp: new Date().toISOString(),
  });
};

logger.memoryUsage = (jobId?: string) => {
  const usage = process.memoryUsage();
  logger.debug('Memory usage', {
    jobId,
    rss: usage.rss,
    heapTotal: usage.heapTotal,
    heapUsed: usage.heapUsed,
    external: usage.external,
    timestamp: new Date().toISOString(),
  });
};

logger.performance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, {
    operation,
    duration,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Health check for worker logger
logger.healthCheck = () => {
  try {
    logger.info('Worker logger health check - OK');
    return true;
  } catch (error) {
    console.error('Worker logger health check failed:', error);
    return false;
  }
};

// Graceful shutdown
logger.shutdown = () => {
  logger.info('Worker logger shutting down...');
  logger.close();
};

export { logger };