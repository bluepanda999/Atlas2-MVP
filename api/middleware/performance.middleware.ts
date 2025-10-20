import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from '../services/metrics.service';
import { LoggingService } from '../services/logging.service';

export interface PerformanceMetrics {
  requestId: string;
  method: string;
  url: string;
  userAgent: string;
  ip: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsageBefore?: NodeJS.MemoryUsage;
  memoryUsageAfter?: NodeJS.MemoryUsage;
  memoryDelta?: number;
  statusCode?: number;
  responseSize?: number;
  error?: Error;
}

export interface PerformanceConfig {
  enabled: boolean;
  slowRequestThreshold: number; // milliseconds
  memoryTracking: boolean;
  detailedLogging: boolean;
  sampleRate: number; // 0.0 to 1.0
  excludePaths: string[];
  includeHeaders: boolean;
}

@Injectable()
export class PerformanceMiddleware implements NestMiddleware {
  private readonly logger = new Logger(PerformanceMiddleware.name);
  private readonly config: PerformanceConfig;
  private readonly activeRequests = new Map<string, PerformanceMetrics>();

  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
  ) {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): PerformanceConfig {
    return {
      enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
      slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000'),
      memoryTracking: process.env.PERFORMANCE_MEMORY_TRACKING === 'true',
      detailedLogging: process.env.PERFORMANCE_DETAILED_LOGGING === 'true',
      sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '1.0'),
      excludePaths: [
        '/health',
        '/health/live',
        '/health/ready',
        '/monitoring/metrics',
        '/favicon.ico',
      ],
      includeHeaders: process.env.PERFORMANCE_INCLUDE_HEADERS === 'true',
    };
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.config.enabled || this.shouldExcludePath(req.path)) {
      return next();
    }

    // Sample requests if sample rate < 1
    if (Math.random() > this.config.sampleRate) {
      return next();
    }

    const requestId = this.generateRequestId();
    const startTime = Date.now();
    const memoryBefore = this.config.memoryTracking ? process.memoryUsage() : undefined;

    // Store performance metrics
    const metrics: PerformanceMetrics = {
      requestId,
      method: req.method,
      url: req.url,
      userAgent: req.headers['user-agent'] || '',
      ip: this.getClientIp(req),
      userId: this.getUserId(req),
      startTime,
      memoryUsageBefore: memoryBefore,
    };

    this.activeRequests.set(requestId, metrics);

    // Add request ID to response headers for tracing
    res.setHeader('X-Request-ID', requestId);

    // Track response size
    let responseSize = 0;
    const originalWrite = res.write;
    const originalEnd = res.end;

    res.write = function (chunk: any, encoding?: any) {
      responseSize += Buffer.byteLength(chunk, encoding);
      return originalWrite.call(this, chunk, encoding);
    };

    res.end = function (chunk?: any, encoding?: any) {
      if (chunk) {
        responseSize += Buffer.byteLength(chunk, encoding);
      }
      return originalEnd.call(this, chunk, encoding);
    };

    // Handle request completion
    res.on('finish', () => {
      this.handleRequestComplete(requestId, res.statusCode, responseSize);
    });

    // Handle request errors
    res.on('error', (error) => {
      this.handleRequestError(requestId, error);
    });

    // Add performance data to request object for access in other middleware/controllers
    (req as any).performance = metrics;

    next();
  }

  private handleRequestComplete(requestId: string, statusCode: number, responseSize: number): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    const endTime = Date.now();
    const duration = endTime - metrics.startTime;
    const memoryAfter = this.config.memoryTracking ? process.memoryUsage() : undefined;

    // Update metrics
    metrics.endTime = endTime;
    metrics.duration = duration;
    metrics.statusCode = statusCode;
    metrics.responseSize = responseSize;
    metrics.memoryUsageAfter = memoryAfter;

    if (memoryAfter && metrics.memoryUsageBefore) {
      metrics.memoryDelta = memoryAfter.heapUsed - metrics.memoryUsageBefore.heapUsed;
    }

    // Record metrics in Prometheus
    this.recordPrometheusMetrics(metrics);

    // Log slow requests
    if (duration > this.config.slowRequestThreshold) {
      this.logSlowRequest(metrics);
    }

    // Detailed logging for debugging
    if (this.config.detailedLogging) {
      this.logDetailedMetrics(metrics);
    }

    // Clean up
    this.activeRequests.delete(requestId);
  }

  private handleRequestError(requestId: string, error: Error): void {
    const metrics = this.activeRequests.get(requestId);
    if (!metrics) return;

    metrics.error = error;
    metrics.endTime = Date.now();
    metrics.duration = metrics.endTime - metrics.startTime;

    // Log error with performance context
    this.loggingService.error(
      `Request failed: ${metrics.method} ${metrics.url}`,
      error.stack,
      'PerformanceMiddleware',
      {
        requestId: metrics.requestId,
        duration: metrics.duration,
        userId: metrics.userId,
      }
    );

    this.activeRequests.delete(requestId);
  }

  private recordPrometheusMetrics(metrics: PerformanceMetrics): void {
    try {
      // Extract route from URL (remove query parameters)
      const route = metrics.url.split('?')[0];
      
      // Record HTTP request metrics
      this.metricsService.incrementHttpRequests(
        metrics.method,
        route,
        metrics.statusCode?.toString() || 'unknown'
      );

      this.metricsService.observeHttpRequestDuration(
        metrics.method,
        route,
        metrics.statusCode?.toString() || 'unknown',
        metrics.duration! / 1000 // Convert to seconds
      );

      if (metrics.responseSize) {
        this.metricsService.observeHttpResponseSize(
          metrics.method,
          route,
          metrics.statusCode?.toString() || 'unknown',
          metrics.responseSize
        );
      }

      // Record request size if available
      const contentLength = parseInt(metrics.userAgent || '0'); // This would need proper implementation
      if (contentLength > 0) {
        this.metricsService.observeHttpRequestSize(metrics.method, route, contentLength);
      }

      // Record custom performance metrics
      if (metrics.memoryDelta) {
        const memoryGauge = this.metricsService.createCustomGauge(
          'request_memory_delta_bytes',
          'Memory delta during request processing',
          ['method', 'route']
        );
        memoryGauge.set({ method: metrics.method, route }, metrics.memoryDelta);
      }

    } catch (error) {
      this.logger.error('Failed to record Prometheus metrics', error.stack);
    }
  }

  private logSlowRequest(metrics: PerformanceMetrics): void {
    const logData = {
      requestId: metrics.requestId,
      method: metrics.method,
      url: metrics.url,
      duration: metrics.duration,
      statusCode: metrics.statusCode,
      userId: metrics.userId,
      memoryDelta: metrics.memoryDelta,
      threshold: this.config.slowRequestThreshold,
    };

    this.loggingService.warn(
      `Slow request detected: ${metrics.method} ${metrics.url} took ${metrics.duration}ms`,
      'PerformanceMiddleware',
      logData
    );
  }

  private logDetailedMetrics(metrics: PerformanceMetrics): void {
    const logData = {
      requestId: metrics.requestId,
      method: metrics.method,
      url: metrics.url,
      duration: metrics.duration,
      statusCode: metrics.statusCode,
      responseSize: metrics.responseSize,
      userId: metrics.userId,
      ip: metrics.ip,
      userAgent: metrics.userAgent,
      memoryBefore: metrics.memoryUsageBefore,
      memoryAfter: metrics.memoryUsageAfter,
      memoryDelta: metrics.memoryDelta,
    };

    this.loggingService.debug(
      `Request completed: ${metrics.method} ${metrics.url}`,
      'PerformanceMiddleware',
      logData
    );
  }

  private shouldExcludePath(path: string): boolean {
    return this.config.excludePaths.some(excludePath => {
      if (excludePath.includes('*')) {
        const regex = new RegExp(excludePath.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path === excludePath;
    });
  }

  private generateRequestId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0] ||
      (req.headers['x-real-ip'] as string) ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }

  private getUserId(req: Request): string | undefined {
    // This would depend on your authentication implementation
    return (req as any).user?.id || (req as any).userId;
  }

  // Public API methods for monitoring
  getActiveRequests(): PerformanceMetrics[] {
    return Array.from(this.activeRequests.values());
  }

  getActiveRequestCount(): number {
    return this.activeRequests.size;
  }

  getRequestById(requestId: string): PerformanceMetrics | undefined {
    return this.activeRequests.get(requestId);
  }

  updateConfig(newConfig: Partial<PerformanceConfig>): void {
    Object.assign(this.config, newConfig);
  }

  getConfig(): PerformanceConfig {
    return { ...this.config };
  }

  // Cleanup method for graceful shutdown
  onModuleDestroy(): void {
    // Log any incomplete requests
    if (this.activeRequests.size > 0) {
      this.logger.warn(
        `Shutting down with ${this.activeRequests.size} active requests`,
        'PerformanceMiddleware'
      );
    }
  }
}

// Factory function for use in module configuration
export function performanceMiddleware(
  metricsService: MetricsService,
  loggingService: LoggingService,
) {
  return new PerformanceMiddleware(metricsService, loggingService);
}