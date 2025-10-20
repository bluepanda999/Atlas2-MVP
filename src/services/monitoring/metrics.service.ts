import { Injectable, Logger } from '@nestjs/common';
import { register, Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly logger = new Logger(MetricsService.name);
  private readonly registry: Registry;

  // API Metrics
  private readonly httpRequestsTotal: Counter<string>;
  private readonly httpRequestDuration: Histogram<string>;
  private readonly httpRequestSize: Histogram<string>;
  private readonly httpResponseSize: Histogram<string>;

  // Authentication Metrics
  private readonly authAttempts: Counter<string>;
  private readonly authFailures: Counter<string>;
  private readonly authSuccesses: Counter<string>;
  private readonly authDuration: Histogram<string>;

  // Upload Metrics
  private readonly uploadAttempts: Counter<string>;
  private readonly uploadSuccesses: Counter<string>;
  private readonly uploadFailures: Counter<string>;
  private readonly uploadDuration: Histogram<string>;
  private readonly uploadSize: Histogram<string>;
  private readonly activeUploads: Gauge<string>;

  // Database Metrics
  private readonly dbConnectionsActive: Gauge<string>;
  private readonly dbQueryDuration: Histogram<string>;
  private readonly dbQueryErrors: Counter<string>;

  // System Metrics
  private readonly memoryUsage: Gauge<string>;
  private readonly cpuUsage: Gauge<string>;
  private readonly diskUsage: Gauge<string>;

  constructor() {
    this.registry = new Registry();
    
    // Add default metrics
    register.collectDefaultMetrics({ register: this.registry });

    // Initialize API metrics
    this.httpRequestsTotal = new Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code'],
      registers: [this.registry],
    });

    this.httpRequestDuration = new Histogram({
      name: 'http_request_duration_seconds',
      help: 'Duration of HTTP requests in seconds',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [0.1, 0.5, 1, 2, 5, 10],
      registers: [this.registry],
    });

    this.httpRequestSize = new Histogram({
      name: 'http_request_size_bytes',
      help: 'Size of HTTP requests in bytes',
      labelNames: ['method', 'route'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    this.httpResponseSize = new Histogram({
      name: 'http_response_size_bytes',
      help: 'Size of HTTP responses in bytes',
      labelNames: ['method', 'route', 'status_code'],
      buckets: [100, 1000, 10000, 100000, 1000000],
      registers: [this.registry],
    });

    // Initialize Authentication metrics
    this.authAttempts = new Counter({
      name: 'auth_attempts_total',
      help: 'Total number of authentication attempts',
      labelNames: ['auth_type', 'client_id'],
      registers: [this.registry],
    });

    this.authFailures = new Counter({
      name: 'auth_failures_total',
      help: 'Total number of authentication failures',
      labelNames: ['auth_type', 'reason', 'client_id'],
      registers: [this.registry],
    });

    this.authSuccesses = new Counter({
      name: 'auth_successes_total',
      help: 'Total number of successful authentications',
      labelNames: ['auth_type', 'client_id'],
      registers: [this.registry],
    });

    this.authDuration = new Histogram({
      name: 'auth_duration_seconds',
      help: 'Duration of authentication attempts in seconds',
      labelNames: ['auth_type'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2],
      registers: [this.registry],
    });

    // Initialize Upload metrics
    this.uploadAttempts = new Counter({
      name: 'upload_attempts_total',
      help: 'Total number of upload attempts',
      labelNames: ['file_type', 'client_id'],
      registers: [this.registry],
    });

    this.uploadSuccesses = new Counter({
      name: 'upload_successes_total',
      help: 'Total number of successful uploads',
      labelNames: ['file_type', 'client_id'],
      registers: [this.registry],
    });

    this.uploadFailures = new Counter({
      name: 'upload_failures_total',
      help: 'Total number of failed uploads',
      labelNames: ['file_type', 'reason', 'client_id'],
      registers: [this.registry],
    });

    this.uploadDuration = new Histogram({
      name: 'upload_duration_seconds',
      help: 'Duration of uploads in seconds',
      labelNames: ['file_type'],
      buckets: [1, 5, 10, 30, 60, 300, 600, 1800],
      registers: [this.registry],
    });

    this.uploadSize = new Histogram({
      name: 'upload_size_bytes',
      help: 'Size of uploaded files in bytes',
      labelNames: ['file_type'],
      buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824, 3221225472],
      registers: [this.registry],
    });

    this.activeUploads = new Gauge({
      name: 'active_uploads',
      help: 'Number of currently active uploads',
      registers: [this.registry],
    });

    // Initialize Database metrics
    this.dbConnectionsActive = new Gauge({
      name: 'db_connections_active',
      help: 'Number of active database connections',
      registers: [this.registry],
    });

    this.dbQueryDuration = new Histogram({
      name: 'db_query_duration_seconds',
      help: 'Duration of database queries in seconds',
      labelNames: ['query_type', 'table'],
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [this.registry],
    });

    this.dbQueryErrors = new Counter({
      name: 'db_query_errors_total',
      help: 'Total number of database query errors',
      labelNames: ['query_type', 'table', 'error_type'],
      registers: [this.registry],
    });

    // Initialize System metrics
    this.memoryUsage = new Gauge({
      name: 'memory_usage_bytes',
      help: 'Memory usage in bytes',
      labelNames: ['type'],
      registers: [this.registry],
    });

    this.cpuUsage = new Gauge({
      name: 'cpu_usage_percent',
      help: 'CPU usage percentage',
      registers: [this.registry],
    });

    this.diskUsage = new Gauge({
      name: 'disk_usage_bytes',
      help: 'Disk usage in bytes',
      labelNames: ['mount_point'],
      registers: [this.registry],
    });

    // Start system metrics collection
    this.startSystemMetricsCollection();
  }

  // API Metrics Methods
  incrementHttpRequests(method: string, route: string, statusCode: string): void {
    this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
  }

  observeHttpRequestDuration(method: string, route: string, statusCode: string, duration: number): void {
    this.httpRequestDuration.observe({ method, route, status_code: statusCode }, duration);
  }

  observeHttpRequestSize(method: string, route: string, size: number): void {
    this.httpRequestSize.observe({ method, route }, size);
  }

  observeHttpResponseSize(method: string, route: string, statusCode: string, size: number): void {
    this.httpResponseSize.observe({ method, route, status_code: statusCode }, size);
  }

  // Authentication Metrics Methods
  incrementAuthAttempts(authType: string, clientId?: string): void {
    this.authAttempts.inc({ auth_type: authType, client_id: clientId || 'unknown' });
  }

  incrementAuthFailures(authType: string, reason: string, clientId?: string): void {
    this.authFailures.inc({ auth_type: authType, reason, client_id: clientId || 'unknown' });
  }

  incrementAuthSuccesses(authType: string, clientId?: string): void {
    this.authSuccesses.inc({ auth_type: authType, client_id: clientId || 'unknown' });
  }

  observeAuthDuration(authType: string, duration: number): void {
    this.authDuration.observe({ auth_type: authType }, duration);
  }

  // Upload Metrics Methods
  incrementUploadAttempts(fileType: string, clientId?: string): void {
    this.uploadAttempts.inc({ file_type: fileType, client_id: clientId || 'unknown' });
  }

  incrementUploadSuccesses(fileType: string, clientId?: string): void {
    this.uploadSuccesses.inc({ file_type: fileType, client_id: clientId || 'unknown' });
  }

  incrementUploadFailures(fileType: string, reason: string, clientId?: string): void {
    this.uploadFailures.inc({ file_type: fileType, reason, client_id: clientId || 'unknown' });
  }

  observeUploadDuration(fileType: string, duration: number): void {
    this.uploadDuration.observe({ file_type: fileType }, duration);
  }

  observeUploadSize(fileType: string, size: number): void {
    this.uploadSize.observe({ file_type: fileType }, size);
  }

  setActiveUploads(count: number): void {
    this.activeUploads.set(count);
  }

  // Database Metrics Methods
  setDbConnectionsActive(count: number): void {
    this.dbConnectionsActive.set(count);
  }

  observeDbQueryDuration(queryType: string, table: string, duration: number): void {
    this.dbQueryDuration.observe({ query_type: queryType, table }, duration);
  }

  incrementDbQueryErrors(queryType: string, table: string, errorType: string): void {
    this.dbQueryErrors.inc({ query_type: queryType, table, error_type });
  }

  // System Metrics Methods
  setMemoryUsage(type: string, bytes: number): void {
    this.memoryUsage.set({ type }, bytes);
  }

  setCpuUsage(percent: number): void {
    this.cpuUsage.set(percent);
  }

  setDiskUsage(mountPoint: string, bytes: number): void {
    this.diskUsage.set({ mount_point: mountPoint }, bytes);
  }

  // Get metrics for Prometheus
  getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  // Get registry for custom metrics
  getRegistry(): Registry {
    return this.registry;
  }

  // Create custom metric
  createCustomCounter(name: string, help: string, labelNames?: string[]): Counter<string> {
    return new Counter({
      name,
      help,
      labelNames,
      registers: [this.registry],
    });
  }

  createCustomHistogram(name: string, help: string, labelNames?: string[], buckets?: number[]): Histogram<string> {
    return new Histogram({
      name,
      help,
      labelNames,
      buckets,
      registers: [this.registry],
    });
  }

  createCustomGauge(name: string, help: string, labelNames?: string[]): Gauge<string> {
    return new Gauge({
      name,
      help,
      labelNames,
      registers: [this.registry],
    });
  }

  private startSystemMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Initial collection
    this.collectSystemMetrics();
  }

  private collectSystemMetrics(): void {
    try {
      // Memory usage
      const memUsage = process.memoryUsage();
      this.setMemoryUsage('rss', memUsage.rss);
      this.setMemoryUsage('heap_total', memUsage.heapTotal);
      this.setMemoryUsage('heap_used', memUsage.heapUsed);
      this.setMemoryUsage('external', memUsage.external);

      // CPU usage (simplified)
      const cpuUsage = process.cpuUsage();
      this.setCpuUsage(cpuUsage.user / 1000000); // Convert to seconds

      // Disk usage (simplified - would need fs.statfs in production)
      const fs = require('fs');
      const path = require('path');
      
      try {
        const stats = fs.statSync(process.cwd());
        this.setDiskUsage('/', stats.size || 0);
      } catch (error) {
        this.logger.warn('Failed to collect disk usage metrics', error.message);
      }

    } catch (error) {
      this.logger.error('Failed to collect system metrics', error.stack);
    }
  }

  // Health check metrics
  getHealthMetrics(): any {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
    };
  }
}