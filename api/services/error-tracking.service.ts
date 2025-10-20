import { Injectable, Logger } from '@nestjs/common';
import { LoggingService } from './logging.service';

export interface ErrorReport {
  id: string;
  timestamp: Date;
  message: string;
  stack?: string;
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  context: ErrorContext;
  userContext?: UserContext;
  systemContext: SystemContext;
  occurrences: number;
  firstSeen: Date;
  lastSeen: Date;
  resolved: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  tags: string[];
  fingerprint: string;
}

export interface ErrorContext {
  requestId?: string;
  method?: string;
  url?: string;
  headers?: Record<string, string>;
  body?: any;
  query?: any;
  params?: any;
  controller?: string;
  action?: string;
}

export interface UserContext {
  id?: string;
  email?: string;
  role?: string;
  sessionId?: string;
  userAgent?: string;
  ip?: string;
}

export interface SystemContext {
  service: string;
  version: string;
  environment: string;
  nodeVersion: string;
  platform: string;
  arch: string;
  pid: number;
  memoryUsage: NodeJS.MemoryUsage;
  uptime: number;
  loadAverage?: number[];
}

export interface ErrorFilters {
  severity?: string;
  resolved?: boolean;
  type?: string;
  startTime?: Date;
  endTime?: Date;
  userId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface ErrorAggregation {
  total: number;
  bySeverity: Record<string, number>;
  byType: Record<string, number>;
  byHour: Record<string, number>;
  topErrors: Array<{
    fingerprint: string;
    message: string;
    count: number;
    lastSeen: Date;
  }>;
}

@Injectable()
export class ErrorTrackingService {
  private readonly logger = new Logger(ErrorTrackingService.name);
  private readonly errors = new Map<string, ErrorReport>();
  private readonly maxErrors = 10000;
  private readonly ignoredErrors = new Set<string>();

  constructor(private readonly loggingService: LoggingService) {
    this.setupGlobalErrorHandlers();
    this.initializeIgnoredErrors();
  }

  private setupGlobalErrorHandlers(): void {
    // Handle uncaught exceptions
    process.on('uncaughtException', (error: Error) => {
      this.trackError(error, {
        type: 'UncaughtException',
        severity: 'critical',
        context: { controller: 'Process' },
      });
      
      // Don't exit immediately in production, let the error be handled
      if (process.env.NODE_ENV === 'production') {
        this.logger.error('Uncaught exception handled', error.stack);
      } else {
        process.exit(1);
      }
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
      const error = reason instanceof Error ? reason : new Error(String(reason));
      this.trackError(error, {
        type: 'UnhandledRejection',
        severity: 'critical',
        context: { 
          controller: 'Process',
          additionalData: { promise: promise.toString() }
        },
      });
    });
  }

  private initializeIgnoredErrors(): void {
    // Common errors that can be ignored
    const ignoredPatterns = [
      'ECONNRESET',
      'ETIMEDOUT',
      'HPE_INVALID_CONSTANT',
      'ERR_HTTP_HEADERS_SENT',
    ];

    ignoredPatterns.forEach(pattern => {
      this.ignoredErrors.add(pattern);
    });
  }

  trackError(
    error: Error,
    options: {
      type?: string;
      severity?: 'low' | 'medium' | 'high' | 'critical';
      context?: Partial<ErrorContext>;
      userContext?: Partial<UserContext>;
      tags?: string[];
      requestId?: string;
    } = {}
  ): string {
    try {
      // Check if error should be ignored
      if (this.shouldIgnoreError(error)) {
        return '';
      }

      const errorId = this.generateErrorId();
      const fingerprint = this.generateFingerprint(error, options);
      const now = new Date();

      // Check if we've seen this error before
      const existingError = this.errors.get(fingerprint);
      
      if (existingError) {
        // Update existing error
        existingError.occurrences += 1;
        existingError.lastSeen = now;
        
        // Update severity if new one is higher
        const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
        if (options.severity && 
            severityLevels[options.severity] > severityLevels[existingError.severity]) {
          existingError.severity = options.severity;
        }

        // Log the occurrence
        this.loggingService.error(
          `Repeated error: ${error.message}`,
          error.stack,
          'ErrorTrackingService',
          {
            errorId: existingError.id,
            fingerprint,
            occurrences: existingError.occurrences,
            context: options.context,
          }
        );

        return existingError.id;
      }

      // Create new error report
      const errorReport: ErrorReport = {
        id: errorId,
        timestamp: now,
        message: error.message,
        stack: error.stack,
        type: options.type || error.constructor.name,
        severity: options.severity || this.determineSeverity(error),
        context: this.buildErrorContext(options),
        userContext: options.userContext ? this.buildUserContext(options.userContext) : undefined,
        systemContext: this.buildSystemContext(),
        occurrences: 1,
        firstSeen: now,
        lastSeen: now,
        resolved: false,
        tags: options.tags || [],
        fingerprint,
      };

      this.errors.set(fingerprint, errorReport);

      // Log the error
      this.loggingService.error(
        `New error tracked: ${error.message}`,
        error.stack,
        'ErrorTrackingService',
        {
          errorId,
          fingerprint,
          severity: errorReport.severity,
          type: errorReport.type,
          context: errorReport.context,
        }
      );

      // Send notifications for critical errors
      if (errorReport.severity === 'critical') {
        this.sendCriticalErrorNotification(errorReport);
      }

      // Cleanup old errors if we're at the limit
      this.cleanupOldErrors();

      return errorId;

    } catch (trackingError) {
      this.logger.error('Failed to track error', trackingError.stack);
      return '';
    }
  }

  private shouldIgnoreError(error: Error): boolean {
    return this.ignoredErrors.has(error.name) || 
           this.ignoredErrors.has(error.message) ||
           Array.from(this.ignoredErrors).some(pattern => 
             error.message.includes(pattern) || error.stack?.includes(pattern)
           );
  }

  private determineSeverity(error: Error): 'low' | 'medium' | 'high' | 'critical' {
    const message = error.message.toLowerCase();
    const stack = error.stack?.toLowerCase() || '';

    // Critical errors
    if (message.includes('database') || 
        message.includes('connection') ||
        message.includes('out of memory') ||
        stack.includes('uncaughtexception') ||
        stack.includes('unhandledrejection')) {
      return 'critical';
    }

    // High severity errors
    if (message.includes('authentication') ||
        message.includes('authorization') ||
        message.includes('security') ||
        message.includes('permission denied')) {
      return 'high';
    }

    // Medium severity errors
    if (message.includes('validation') ||
        message.includes('not found') ||
        message.includes('timeout')) {
      return 'medium';
    }

    // Default to low severity
    return 'low';
  }

  private buildErrorContext(options: any): ErrorContext {
    return {
      requestId: options.requestId,
      method: options.context?.method,
      url: options.context?.url,
      headers: options.context?.headers,
      body: options.context?.body,
      query: options.context?.query,
      params: options.context?.params,
      controller: options.context?.controller,
      action: options.context?.action,
    };
  }

  private buildUserContext(userContext: Partial<UserContext>): UserContext {
    return {
      id: userContext.id,
      email: userContext.email,
      role: userContext.role,
      sessionId: userContext.sessionId,
      userAgent: userContext.userAgent,
      ip: userContext.ip,
    };
  }

  private buildSystemContext(): SystemContext {
    return {
      service: process.env.SERVICE_NAME || 'atlas2-api',
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      pid: process.pid,
      memoryUsage: process.memoryUsage(),
      uptime: process.uptime(),
      loadAverage: process.platform !== 'win32' ? process.loadavg() : undefined,
    };
  }

  private generateErrorId(): string {
    return 'error_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateFingerprint(error: Error, options: any): string {
    // Create a fingerprint based on error message, stack trace, and context
    const stackLines = error.stack?.split('\n').slice(0, 5).join('|') || '';
    const contextKey = options.context?.controller || options.context?.url || 'unknown';
    
    const fingerprintData = `${error.constructor.name}:${error.message}:${stackLines}:${contextKey}`;
    
    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprintData.length; i++) {
      const char = fingerprintData.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    return Math.abs(hash).toString(36);
  }

  private async sendCriticalErrorNotification(errorReport: ErrorReport): Promise<void> {
    // In a real implementation, this would send notifications to various channels
    this.loggingService.error(
      `CRITICAL ERROR ALERT: ${errorReport.message}`,
      errorReport.stack,
      'ErrorTrackingService',
      {
        errorId: errorReport.id,
        fingerprint: errorReport.fingerprint,
        severity: errorReport.severity,
        occurrences: errorReport.occurrences,
        context: errorReport.context,
        systemContext: errorReport.systemContext,
      }
    );
  }

  private cleanupOldErrors(): void {
    if (this.errors.size <= this.maxErrors) {
      return;
    }

    // Sort errors by last seen time and remove the oldest
    const sortedErrors = Array.from(this.errors.entries())
      .sort(([, a], [, b]) => a.lastSeen.getTime() - b.lastSeen.getTime());

    const toRemove = sortedErrors.slice(0, this.errors.size - this.maxErrors);
    
    toRemove.forEach(([fingerprint]) => {
      this.errors.delete(fingerprint);
    });

    this.logger.info(`Cleaned up ${toRemove.length} old error reports`);
  }

  // Public API methods
  async getErrors(filters: ErrorFilters = {}): Promise<{
    errors: ErrorReport[];
    total: number;
    filters: ErrorFilters;
  }> {
    let errors = Array.from(this.errors.values());

    // Apply filters
    if (filters.severity) {
      errors = errors.filter(error => error.severity === filters.severity);
    }

    if (filters.resolved !== undefined) {
      errors = errors.filter(error => error.resolved === filters.resolved);
    }

    if (filters.type) {
      errors = errors.filter(error => error.type === filters.type);
    }

    if (filters.userId) {
      errors = errors.filter(error => error.userContext?.id === filters.userId);
    }

    if (filters.tags && filters.tags.length > 0) {
      errors = errors.filter(error => 
        filters.tags!.some(tag => error.tags.includes(tag))
      );
    }

    if (filters.startTime) {
      errors = errors.filter(error => error.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      errors = errors.filter(error => error.timestamp <= filters.endTime);
    }

    // Sort by last seen (newest first)
    errors.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime());

    const total = errors.length;

    // Apply pagination
    if (filters.offset) {
      errors = errors.slice(filters.offset);
    }

    if (filters.limit) {
      errors = errors.slice(0, filters.limit);
    }

    return {
      errors,
      total,
      filters,
    };
  }

  async getErrorByFingerprint(fingerprint: string): Promise<ErrorReport | null> {
    return this.errors.get(fingerprint) || null;
  }

  async getErrorAggregation(timeRange?: { start: Date; end: Date }): Promise<ErrorAggregation> {
    let errors = Array.from(this.errors.values());

    if (timeRange) {
      errors = errors.filter(error => 
        error.timestamp >= timeRange.start && error.timestamp <= timeRange.end
      );
    }

    const bySeverity: Record<string, number> = {};
    const byType: Record<string, number> = {};
    const byHour: Record<string, number> = {};

    errors.forEach(error => {
      // Count by severity
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;

      // Count by type
      byType[error.type] = (byType[error.type] || 0) + 1;

      // Count by hour
      const hour = error.timestamp.toISOString().substring(0, 13); // YYYY-MM-DDTHH
      byHour[hour] = (byHour[hour] || 0) + 1;
    });

    // Top errors by occurrences
    const errorCounts = new Map<string, { message: string; count: number; lastSeen: Date }>();
    
    errors.forEach(error => {
      const existing = errorCounts.get(error.fingerprint);
      if (existing) {
        existing.count += error.occurrences;
        if (error.lastSeen > existing.lastSeen) {
          existing.lastSeen = error.lastSeen;
        }
      } else {
        errorCounts.set(error.fingerprint, {
          message: error.message,
          count: error.occurrences,
          lastSeen: error.lastSeen,
        });
      }
    });

    const topErrors = Array.from(errorCounts.entries())
      .map(([fingerprint, data]) => ({ fingerprint, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      total: errors.length,
      bySeverity,
      byType,
      byHour,
      topErrors,
    };
  }

  async resolveError(fingerprint: string, resolvedBy: string): Promise<boolean> {
    const error = this.errors.get(fingerprint);
    if (!error) return false;

    error.resolved = true;
    error.resolvedAt = new Date();
    error.resolvedBy = resolvedBy;

    this.loggingService.info(
      `Error resolved: ${error.message}`,
      'ErrorTrackingService',
      {
        errorId: error.id,
        fingerprint,
        resolvedBy,
        totalOccurrences: error.occurrences,
      }
    );

    return true;
  }

  async addTag(fingerprint: string, tag: string): Promise<boolean> {
    const error = this.errors.get(fingerprint);
    if (!error) return false;

    if (!error.tags.includes(tag)) {
      error.tags.push(tag);
    }

    return true;
  }

  async removeTag(fingerprint: string, tag: string): Promise<boolean> {
    const error = this.errors.get(fingerprint);
    if (!error) return false;

    const index = error.tags.indexOf(tag);
    if (index > -1) {
      error.tags.splice(index, 1);
    }

    return true;
  }

  getErrorStats(): {
    total: number;
    resolved: number;
    unresolved: number;
    bySeverity: Record<string, number>;
    recent: number; // Last 24 hours
  } {
    const errors = Array.from(this.errors.values());
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const bySeverity: Record<string, number> = {};
    let resolved = 0;
    let recent = 0;

    errors.forEach(error => {
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;
      
      if (error.resolved) resolved++;
      if (error.lastSeen >= yesterday) recent++;
    });

    return {
      total: errors.length,
      resolved,
      unresolved: errors.length - resolved,
      bySeverity,
      recent,
    };
  }
}