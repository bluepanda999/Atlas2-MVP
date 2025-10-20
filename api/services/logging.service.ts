import { Injectable, Logger } from '@nestjs/common';
import { writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export interface LogEntry {
  timestamp: Date;
  level: 'error' | 'warn' | 'info' | 'debug';
  message: string;
  context?: string;
  traceId?: string;
  userId?: string;
  requestId?: string;
  metadata?: Record<string, any>;
  stack?: string;
  service: string;
  version: string;
  environment: string;
}

export interface LogFilters {
  level?: string;
  context?: string;
  startTime?: Date;
  endTime?: Date;
  traceId?: string;
  userId?: string;
  limit?: number;
  offset?: number;
}

export interface LogConfig {
  level: 'error' | 'warn' | 'info' | 'debug';
  format: 'json' | 'text';
  file?: {
    enabled: boolean;
    path: string;
    maxSize: string; // e.g., '10MB'
    maxFiles: number;
    rotation: 'daily' | 'size';
  };
  console: {
    enabled: boolean;
    colorize: boolean;
  };
  structured: boolean;
  includeMetadata: boolean;
}

@Injectable()
export class LoggingService {
  private readonly logger = new Logger(LoggingService.name);
  private readonly logs: LogEntry[] = [];
  private readonly maxMemoryLogs = 10000;
  private config: LogConfig;
  private readonly logDirectory: string;

  constructor() {
    this.logDirectory = process.env.LOG_DIR || './logs';
    this.config = this.initializeConfig();
    this.ensureLogDirectory();
  }

  private initializeConfig(): LogConfig {
    return {
      level: (process.env.LOG_LEVEL as any) || 'info',
      format: process.env.LOG_FORMAT === 'text' ? 'text' : 'json',
      file: {
        enabled: process.env.LOG_FILE_ENABLED !== 'false',
        path: process.env.LOG_FILE_PATH || join(this.logDirectory, 'app.log'),
        maxSize: process.env.LOG_FILE_MAX_SIZE || '10MB',
        maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
        rotation: (process.env.LOG_FILE_ROTATION as any) || 'daily',
      },
      console: {
        enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
        colorize: process.env.LOG_CONSOLE_COLORIZE === 'true',
      },
      structured: process.env.LOG_STRUCTURED === 'true',
      includeMetadata: process.env.LOG_INCLUDE_METADATA !== 'false',
    };
  }

  private ensureLogDirectory(): void {
    if (this.config.file?.enabled && !existsSync(this.logDirectory)) {
      mkdirSync(this.logDirectory, { recursive: true });
    }
  }

  error(message: string, stack?: string, context?: string, metadata?: Record<string, any>): void {
    this.log('error', message, context, { stack, ...metadata });
  }

  warn(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('warn', message, context, metadata);
  }

  info(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('info', message, context, metadata);
  }

  debug(message: string, context?: string, metadata?: Record<string, any>): void {
    this.log('debug', message, context, metadata);
  }

  private log(
    level: 'error' | 'warn' | 'info' | 'debug',
    message: string,
    context?: string,
    metadata?: Record<string, any>,
  ): void {
    // Skip if level is below configured threshold
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date(),
      level,
      message,
      context,
      traceId: this.getCurrentTraceId(),
      userId: this.getCurrentUserId(),
      requestId: this.getCurrentRequestId(),
      metadata: this.config.includeMetadata ? metadata : undefined,
      stack: metadata?.stack,
      service: process.env.SERVICE_NAME || 'atlas2-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    };

    // Add to memory buffer
    this.addToMemoryBuffer(logEntry);

    // Output to console
    if (this.config.console.enabled) {
      this.outputToConsole(logEntry);
    }

    // Output to file
    if (this.config.file?.enabled) {
      this.outputToFile(logEntry);
    }
  }

  private shouldLog(level: string): boolean {
    const levels = { error: 0, warn: 1, info: 2, debug: 3 };
    const currentLevel = levels[this.config.level] || 2;
    const messageLevel = levels[level] || 2;
    return messageLevel <= currentLevel;
  }

  private addToMemoryBuffer(logEntry: LogEntry): void {
    this.logs.push(logEntry);
    
    // Keep only the most recent logs in memory
    if (this.logs.length > this.maxMemoryLogs) {
      this.logs.splice(0, this.logs.length - this.maxMemoryLogs);
    }
  }

  private outputToConsole(logEntry: LogEntry): void {
    const formattedMessage = this.formatLogEntry(logEntry);
    
    if (this.config.console.colorize) {
      const colorCode = this.getColorCode(logEntry.level);
      const resetCode = '\x1b[0m';
      console.log(`${colorCode}${formattedMessage}${resetCode}`);
    } else {
      console.log(formattedMessage);
    }
  }

  private outputToFile(logEntry: LogEntry): void {
    try {
      const formattedMessage = this.formatLogEntry(logEntry);
      const logFilePath = this.getLogFilePath();
      
      appendFileSync(logFilePath, formattedMessage + '\n');
      
      // Check if rotation is needed
      if (this.shouldRotateFile()) {
        this.rotateLogFile();
      }
    } catch (error) {
      this.logger.error('Failed to write log to file', error.stack);
    }
  }

  private formatLogEntry(logEntry: LogEntry): string {
    if (this.config.format === 'json') {
      return JSON.stringify(logEntry);
    } else {
      // Text format
      const timestamp = logEntry.timestamp.toISOString();
      const level = logEntry.level.toUpperCase().padEnd(5);
      const context = logEntry.context ? `[${logEntry.context}]` : '';
      const traceId = logEntry.traceId ? `(${logEntry.traceId})` : '';
      
      let message = `${timestamp} ${level} ${context} ${traceId} ${logEntry.message}`;
      
      if (logEntry.metadata && Object.keys(logEntry.metadata).length > 0) {
        message += ` | ${JSON.stringify(logEntry.metadata)}`;
      }
      
      if (logEntry.stack) {
        message += `\n${logEntry.stack}`;
      }
      
      return message;
    }
  }

  private getColorCode(level: string): string {
    switch (level) {
      case 'error': return '\x1b[31m'; // Red
      case 'warn': return '\x1b[33m';  // Yellow
      case 'info': return '\x1b[36m';  // Cyan
      case 'debug': return '\x1b[37m'; // White
      default: return '\x1b[0m';       // Reset
    }
  }

  private getLogFilePath(): string {
    if (this.config.file?.rotation === 'daily') {
      const date = new Date().toISOString().split('T')[0];
      const ext = this.config.file.path.split('.').pop();
      const baseName = this.config.file.path.replace(`.${ext}`, '');
      return `${baseName}-${date}.${ext}`;
    }
    
    return this.config.file?.path || join(this.logDirectory, 'app.log');
  }

  private shouldRotateFile(): boolean {
    if (!this.config.file?.path) return false;
    
    try {
      const stats = require('fs').statSync(this.config.file.path);
      const maxSizeBytes = this.parseSize(this.config.file.maxSize);
      return stats.size >= maxSizeBytes;
    } catch {
      return false;
    }
  }

  private rotateLogFile(): void {
    if (!this.config.file?.path) return;
    
    try {
      const ext = this.config.file.path.split('.').pop();
      const baseName = this.config.file.path.replace(`.${ext}`, '');
      
      // Remove oldest file if we have too many
      for (let i = this.config.file.maxFiles - 1; i > 0; i--) {
        const oldFile = `${baseName}.${i}.${ext}`;
        const newFile = `${baseName}.${i + 1}.${ext}`;
        
        if (existsSync(oldFile)) {
          if (i === this.config.file.maxFiles - 1) {
            require('fs').unlinkSync(oldFile);
          } else {
            require('fs').renameSync(oldFile, newFile);
          }
        }
      }
      
      // Move current file to .1
      if (existsSync(this.config.file.path)) {
        require('fs').renameSync(this.config.file.path, `${baseName}.1.${ext}`);
      }
    } catch (error) {
      this.logger.error('Failed to rotate log file', error.stack);
    }
  }

  private parseSize(size: string): number {
    const units = { B: 1, KB: 1024, MB: 1024 * 1024, GB: 1024 * 1024 * 1024 };
    const match = size.match(/^(\d+)(B|KB|MB|GB)$/i);
    
    if (!match) {
      return 10 * 1024 * 1024; // Default 10MB
    }
    
    const [, value, unit] = match;
    return parseInt(value) * (units[unit.toUpperCase()] || 1);
  }

  private getCurrentTraceId(): string | undefined {
    // In a real implementation, this would come from async context or request headers
    return undefined;
  }

  private getCurrentUserId(): string | undefined {
    // In a real implementation, this would come from authentication context
    return undefined;
  }

  private getCurrentRequestId(): string | undefined {
    // In a real implementation, this would come from request context
    return undefined;
  }

  // Public API methods
  async getLogs(filters: LogFilters = {}): Promise<{
    logs: LogEntry[];
    total: number;
    filters: LogFilters;
  }> {
    let filteredLogs = [...this.logs];

    // Apply filters
    if (filters.level) {
      filteredLogs = filteredLogs.filter(log => log.level === filters.level);
    }

    if (filters.context) {
      filteredLogs = filteredLogs.filter(log => log.context === filters.context);
    }

    if (filters.traceId) {
      filteredLogs = filteredLogs.filter(log => log.traceId === filters.traceId);
    }

    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }

    if (filters.startTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      filteredLogs = filteredLogs.filter(log => log.timestamp <= filters.endTime);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    const total = filteredLogs.length;

    // Apply pagination
    if (filters.offset) {
      filteredLogs = filteredLogs.slice(filters.offset);
    }

    if (filters.limit) {
      filteredLogs = filteredLogs.slice(0, filters.limit);
    }

    return {
      logs: filteredLogs,
      total,
      filters,
    };
  }

  async getLogStats(): Promise<{
    total: number;
    byLevel: Record<string, number>;
    byContext: Record<string, number>;
    timeRange: { earliest: Date | null; latest: Date | null };
  }> {
    const byLevel: Record<string, number> = {};
    const byContext: Record<string, number> = {};
    let earliest: Date | null = null;
    let latest: Date | null = null;

    this.logs.forEach(log => {
      // Count by level
      byLevel[log.level] = (byLevel[log.level] || 0) + 1;

      // Count by context
      if (log.context) {
        byContext[log.context] = (byContext[log.context] || 0) + 1;
      }

      // Track time range
      if (!earliest || log.timestamp < earliest) {
        earliest = log.timestamp;
      }
      if (!latest || log.timestamp > latest) {
        latest = log.timestamp;
      }
    });

    return {
      total: this.logs.length,
      byLevel,
      byContext,
      timeRange: { earliest, latest },
    };
  }

  updateConfig(newConfig: Partial<LogConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  getConfig(): LogConfig {
    return { ...this.config };
  }

  // Structured logging helpers
  logHttpRequest(req: any, res: any, duration: number): void {
    this.info('HTTP Request', 'HTTP', {
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip,
      userId: req.user?.id,
    });
  }

  logDatabaseQuery(query: string, duration: number, error?: Error): void {
    const level = error ? 'error' : 'debug';
    const metadata: any = { query, duration: `${duration}ms` };
    
    if (error) {
      metadata.error = error.message;
      metadata.stack = error.stack;
    }

    this.log(level, `Database Query: ${query.substring(0, 100)}...`, 'Database', metadata);
  }

  logAuthenticationAttempt(userId: string, authType: string, success: boolean, reason?: string): void {
    const level = success ? 'info' : 'warn';
    const metadata = { userId, authType, success, reason };
    
    this.log(level, `Authentication ${success ? 'success' : 'failure'}`, 'Auth', metadata);
  }

  logUploadOperation(fileId: string, operation: string, success: boolean, metadata?: any): void {
    const level = success ? 'info' : 'error';
    this.log(level, `Upload ${operation}: ${fileId}`, 'Upload', { fileId, operation, success, ...metadata });
  }

  logBusinessEvent(event: string, data: any): void {
    this.info(`Business Event: ${event}`, 'Business', { event, data });
  }

  logPerformanceMetric(metric: string, value: number, unit: string, tags?: Record<string, string>): void {
    this.debug(`Performance: ${metric} = ${value}${unit}`, 'Performance', { metric, value, unit, tags });
  }

  logSecurityEvent(event: string, severity: 'low' | 'medium' | 'high', details: any): void {
    const level = severity === 'high' ? 'error' : severity === 'medium' ? 'warn' : 'info';
    this.log(level, `Security Event: ${event}`, 'Security', { severity, details });
  }
}