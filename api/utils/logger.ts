import winston from 'winston';
import { config } from '../config/config';

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white',
};

// Tell winston that you want to link the colors
winston.addColors(colors);

// Define which level to log based on environment
const level = () => {
  const env = config.nodeEnv || 'development';
  const isDevelopment = env === 'development';
  return isDevelopment ? 'debug' : 'warn';
};

// Define format for logs
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}`,
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
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/all.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }),
];

// Add production-specific transports
if (config.nodeEnv === 'production') {
  // Add external logging service (e.g., Loggly, Papertrail)
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

// Create a stream object for Morgan HTTP logger
const stream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};

// Add request context helper
logger.addContext = (req: any) => {
  return {
    requestId: req.id || 'unknown',
    userId: req.user?.id || 'anonymous',
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent'),
    method: req.method,
    url: req.url,
  };
};

// Add performance logging helper
logger.performance = (operation: string, duration: number, metadata?: any) => {
  logger.info(`Performance: ${operation} completed in ${duration}ms`, {
    operation,
    duration,
    ...metadata,
  });
};

// Add error logging helper with context
logger.logError = (error: Error, context?: any) => {
  logger.error(error.message, {
    stack: error.stack,
    name: error.name,
    ...context,
  });
};

// Add audit logging helper
logger.audit = (action: string, userId: string, resource: string, resourceId?: string, metadata?: any) => {
  logger.info(`AUDIT: ${action}`, {
    action,
    userId,
    resource,
    resourceId,
    timestamp: new Date().toISOString(),
    ...metadata,
  });
};

// Add security logging helper
logger.security = (event: string, severity: 'low' | 'medium' | 'high', details: any) => {
  const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
  logger[level](`SECURITY: ${event}`, {
    event,
    severity,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add business logic logging helper
logger.business = (event: string, userId: string, details: any) => {
  logger.info(`BUSINESS: ${event}`, {
    event,
    userId,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add database query logging helper
logger.query = (query: string, duration: number, params?: any) => {
  if (config.logging.logQueries) {
    logger.debug(`DB Query (${duration}ms): ${query}`, {
      query,
      duration,
      params,
    });
  }
};

// Add API response logging helper
logger.apiResponse = (req: any, res: any, duration: number) => {
  const context = logger.addContext(req);
  logger.http(`API Response: ${req.method} ${req.url} - ${res.statusCode} (${duration}ms)`, {
    ...context,
    statusCode: res.statusCode,
    responseTime: duration,
    contentLength: res.get('Content-Length'),
  });
};

// Add job processing logging helper
logger.job = (jobId: string, status: string, details?: any) => {
  logger.info(`JOB: ${jobId} - ${status}`, {
    jobId,
    status,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Add integration logging helper
logger.integration = (integrationId: string, action: string, success: boolean, details?: any) => {
  const level = success ? 'info' : 'error';
  logger[level](`INTEGRATION: ${integrationId} - ${action}`, {
    integrationId,
    action,
    success,
    timestamp: new Date().toISOString(),
    ...details,
  });
};

// Health check for logger
logger.healthCheck = () => {
  try {
    logger.info('Logger health check - OK');
    return true;
  } catch (error) {
    console.error('Logger health check failed:', error);
    return false;
  }
};

// Graceful shutdown
logger.shutdown = () => {
  logger.info('Logger shutting down...');
  // Close all transports
  logger.close();
};

export { logger, stream };