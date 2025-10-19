import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Enable collection of default metrics
collectDefaultMetrics({
  prefix: 'atlas2_api_',
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// HTTP request metrics
export const httpRequestsTotal = new Counter({
  name: 'atlas2_api_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_id'],
});

export const httpRequestDuration = new Histogram({
  name: 'atlas2_api_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Authentication metrics
export const authAttemptsTotal = new Counter({
  name: 'atlas2_api_auth_attempts_total',
  help: 'Total number of authentication attempts',
  labelNames: ['type', 'result'],
});

export const activeSessions = new Gauge({
  name: 'atlas2_api_active_sessions',
  help: 'Number of active user sessions',
});

// File upload metrics
export const fileUploadsTotal = new Counter({
  name: 'atlas2_api_file_uploads_total',
  help: 'Total number of file uploads',
  labelNames: ['status', 'file_type', 'user_id'],
});

export const fileUploadSize = new Histogram({
  name: 'atlas2_api_file_upload_size_bytes',
  help: 'Size of uploaded files in bytes',
  labelNames: ['file_type'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 52428800], // 1KB to 50MB
});

export const fileProcessingDuration = new Histogram({
  name: 'atlas2_api_file_processing_duration_seconds',
  help: 'Duration of file processing in seconds',
  labelNames: ['file_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 300, 900, 1800], // 1s to 30min
});

// Job processing metrics
export const jobsTotal = new Counter({
  name: 'atlas2_api_jobs_total',
  help: 'Total number of processing jobs',
  labelNames: ['status', 'job_type', 'user_id'],
});

export const jobQueueSize = new Gauge({
  name: 'atlas2_api_job_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name'],
});

export const jobProcessingDuration = new Histogram({
  name: 'atlas2_api_job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['job_type'],
  buckets: [1, 5, 10, 30, 60, 300, 900, 1800],
});

// Database metrics
export const dbConnectionsActive = new Gauge({
  name: 'atlas2_api_db_connections_active',
  help: 'Number of active database connections',
});

export const dbQueryDuration = new Histogram({
  name: 'atlas2_api_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.01, 0.1, 1, 5, 10],
});

export const dbQueriesTotal = new Counter({
  name: 'atlas2_api_db_queries_total',
  help: 'Total number of database queries',
  labelNames: ['query_type', 'table', 'result'],
});

// API integration metrics
export const apiCallsTotal = new Counter({
  name: 'atlas2_api_external_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['integration_id', 'method', 'status_code'],
});

export const apiCallDuration = new Histogram({
  name: 'atlas2_api_external_api_call_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['integration_id', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'atlas2_api_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'component', 'user_id'],
});

export const validationErrorsTotal = new Counter({
  name: 'atlas2_api_validation_errors_total',
  help: 'Total number of validation errors',
  labelNames: ['field', 'validation_rule'],
});

// Business metrics
export const usersTotal = new Gauge({
  name: 'atlas2_api_users_total',
  help: 'Total number of users',
  labelNames: ['status', 'role'],
});

export const integrationsTotal = new Gauge({
  name: 'atlas2_api_integrations_total',
  help: 'Total number of integrations',
  labelNames: ['type', 'status'],
});

export const mappingsTotal = new Gauge({
  name: 'atlas2_api_mappings_total',
  help: 'Total number of mappings',
  labelNames: ['user_id'],
});

// System metrics
export const memoryUsage = new Gauge({
  name: 'atlas2_api_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'atlas2_api_cpu_usage_percent',
  help: 'CPU usage percentage',
});

// Cache metrics
export const cacheHitsTotal = new Counter({
  name: 'atlas2_api_cache_hits_total',
  help: 'Total number of cache hits',
  labelNames: ['cache_type'],
});

export const cacheMissesTotal = new Counter({
  name: 'atlas2_api_cache_misses_total',
  help: 'Total number of cache misses',
  labelNames: ['cache_type'],
});

// Rate limiting metrics
export const rateLimitHitsTotal = new Counter({
  name: 'atlas2_api_rate_limit_hits_total',
  help: 'Total number of rate limit hits',
  labelNames: ['user_id', 'endpoint'],
});

// Custom metrics collection functions
export const collectSystemMetrics = () => {
  const memUsage = process.memoryUsage();
  
  memoryUsage.set({ type: 'rss' }, memUsage.rss);
  memoryUsage.set({ type: 'heap_total' }, memUsage.heapTotal);
  memoryUsage.set({ type: 'heap_used' }, memUsage.heapUsed);
  memoryUsage.set({ type: 'external' }, memUsage.external);
};

export const collectCpuMetrics = () => {
  const cpuUsage = process.cpuUsage();
  // Convert to percentage (simplified)
  const totalCpu = (cpuUsage.user + cpuUsage.system) / 1000000; // Convert to seconds
  cpuUsage.set(totalCpu);
};

// Metrics middleware factory
export const createMetricsMiddleware = () => {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    // Record response
    res.on('finish', () => {
      const duration = (Date.now() - start) / 1000;
      const route = req.route ? req.route.path : req.path;
      const userId = req.user?.id || 'anonymous';
      
      httpRequestsTotal
        .labels(req.method, route, res.statusCode.toString(), userId)
        .inc();
      
      httpRequestDuration
        .labels(req.method, route, res.statusCode.toString())
        .observe(duration);
    });
    
    next();
  };
};

// Metrics endpoint handler
export const getMetrics = async (req: any, res: any) => {
  try {
    // Update system metrics before returning
    collectSystemMetrics();
    collectCpuMetrics();
    
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end(error.message);
  }
};

// Health check for metrics
export const metricsHealthCheck = () => {
  try {
    const metrics = register.getMetricsAsJSON();
    return {
      healthy: true,
      metricsCount: Object.keys(metrics).length,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    return {
      healthy: false,
      error: error.message,
      timestamp: new Date().toISOString(),
    };
  }
};

// Reset all metrics (useful for testing)
export const resetMetrics = () => {
  register.clear();
  collectDefaultMetrics({
    prefix: 'atlas2_api_',
    timeout: 5000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
};

export { register };