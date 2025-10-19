import { register, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';

// Enable collection of default metrics
collectDefaultMetrics({
  prefix: 'atlas2_worker_',
  timeout: 5000,
  gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
});

// Job processing metrics
export const jobsProcessedTotal = new Counter({
  name: 'atlas2_worker_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['status', 'job_type'],
});

export const jobProcessingDuration = new Histogram({
  name: 'atlas2_worker_job_processing_duration_seconds',
  help: 'Duration of job processing in seconds',
  labelNames: ['job_type', 'status'],
  buckets: [1, 5, 10, 30, 60, 300, 900, 1800], // 1s to 30min
});

export const jobQueueSize = new Gauge({
  name: 'atlas2_worker_job_queue_size',
  help: 'Number of jobs in queue',
  labelNames: ['queue_name', 'status'],
});

export const activeJobs = new Gauge({
  name: 'atlas2_worker_active_jobs',
  help: 'Number of currently active jobs',
});

// CSV processing metrics
export const csvRecordsProcessedTotal = new Counter({
  name: 'atlas2_worker_csv_records_processed_total',
  help: 'Total number of CSV records processed',
  labelNames: ['status'],
});

export const csvProcessingDuration = new Histogram({
  name: 'atlas2_worker_csv_processing_duration_seconds',
  help: 'Duration of CSV processing in seconds',
  labelNames: ['file_size_range'],
  buckets: [0.1, 1, 5, 10, 30, 60, 300, 900],
});

export const csvBatchesProcessedTotal = new Counter({
  name: 'atlas2_worker_csv_batches_processed_total',
  help: 'Total number of CSV batches processed',
  labelNames: ['status'],
});

export const csvBatchSize = new Histogram({
  name: 'atlas2_worker_csv_batch_size_records',
  help: 'Size of CSV batches in records',
  buckets: [10, 50, 100, 500, 1000, 2000, 5000],
});

// Transformation metrics
export const transformationsAppliedTotal = new Counter({
  name: 'atlas2_worker_transformations_applied_total',
  help: 'Total number of transformations applied',
  labelNames: ['rule_type', 'status'],
});

export const transformationDuration = new Histogram({
  name: 'atlas2_worker_transformation_duration_seconds',
  help: 'Duration of transformations in seconds',
  labelNames: ['rule_type'],
  buckets: [0.001, 0.01, 0.1, 1, 5],
});

// API integration metrics
export const apiCallsTotal = new Counter({
  name: 'atlas2_worker_api_calls_total',
  help: 'Total number of external API calls',
  labelNames: ['integration_id', 'method', 'status_code'],
});

export const apiCallDuration = new Histogram({
  name: 'atlas2_worker_api_call_duration_seconds',
  help: 'Duration of external API calls in seconds',
  labelNames: ['integration_id', 'method'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
});

export const apiCallRetriesTotal = new Counter({
  name: 'atlas2_worker_api_call_retries_total',
  help: 'Total number of API call retries',
  labelNames: ['integration_id', 'reason'],
});

// Error metrics
export const errorsTotal = new Counter({
  name: 'atlas2_worker_errors_total',
  help: 'Total number of errors',
  labelNames: ['error_type', 'component', 'job_id'],
});

export const jobRetriesTotal = new Counter({
  name: 'atlas2_worker_job_retries_total',
  help: 'Total number of job retries',
  labelNames: ['job_type', 'reason'],
});

// Performance metrics
export const memoryUsage = new Gauge({
  name: 'atlas2_worker_memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'],
});

export const cpuUsage = new Gauge({
  name: 'atlas2_worker_cpu_usage_percent',
  help: 'CPU usage percentage',
});

export const eventLoopLag = new Histogram({
  name: 'atlas2_worker_event_loop_lag_seconds',
  help: 'Event loop lag in seconds',
  buckets: [0.001, 0.01, 0.1, 1, 5],
});

// Queue metrics
export const queueThroughput = new Gauge({
  name: 'atlas2_worker_queue_throughput_per_second',
  help: 'Queue throughput in jobs per second',
  labelNames: ['queue_name'],
});

export const queueLatency = new Histogram({
  name: 'atlas2_worker_queue_latency_seconds',
  help: 'Time jobs spend in queue before processing',
  labelNames: ['queue_name'],
  buckets: [1, 5, 10, 30, 60, 300, 900],
});

// File system metrics
export const fileOperationsTotal = new Counter({
  name: 'atlas2_worker_file_operations_total',
  help: 'Total number of file operations',
  labelNames: ['operation', 'status'],
});

export const fileOperationDuration = new Histogram({
  name: 'atlas2_worker_file_operation_duration_seconds',
  help: 'Duration of file operations in seconds',
  labelNames: ['operation'],
  buckets: [0.001, 0.01, 0.1, 1, 5],
});

// Database metrics
export const dbConnectionsActive = new Gauge({
  name: 'atlas2_worker_db_connections_active',
  help: 'Number of active database connections',
});

export const dbQueryDuration = new Histogram({
  name: 'atlas2_worker_db_query_duration_seconds',
  help: 'Duration of database queries in seconds',
  labelNames: ['query_type', 'table'],
  buckets: [0.001, 0.01, 0.1, 1, 5],
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

export const collectEventLoopLag = () => {
  const start = process.hrtime.bigint();
  setImmediate(() => {
    const lag = Number(process.hrtime.bigint() - start) / 1000000000; // Convert to seconds
    eventLoopLag.observe(lag);
  });
};

// Job-specific metrics helpers
export const recordJobStart = (jobId: string, jobType: string) => {
  activeJobs.inc();
  return Date.now();
};

export const recordJobComplete = (startTime: number, jobType: string, status: string) => {
  const duration = (Date.now() - startTime) / 1000;
  
  jobsProcessedTotal.labels(status, jobType).inc();
  jobProcessingDuration.labels(jobType, status).observe(duration);
  
  activeJobs.dec();
};

export const recordJobRetry = (jobType: string, reason: string) => {
  jobRetriesTotal.labels(jobType, reason).inc();
};

export const recordCsvBatchProcessed = (recordCount: number, status: string) => {
  csvBatchesProcessedTotal.labels(status).inc();
  csvBatchSize.observe(recordCount);
  csvRecordsProcessedTotal.labels(status).inc(recordCount);
};

export const recordTransformationApplied = (ruleType: string, status: string, duration: number) => {
  transformationsAppliedTotal.labels(ruleType, status).inc();
  transformationDuration.labels(ruleType).observe(duration / 1000); // Convert ms to seconds
};

export const recordApiCall = (integrationId: string, method: string, statusCode: number, duration: number) => {
  const status = statusCode >= 200 && statusCode < 300 ? 'success' : 'error';
  
  apiCallsTotal.labels(integrationId, method, statusCode.toString()).inc();
  apiCallDuration.labels(integrationId, method).observe(duration / 1000);
};

export const recordApiCallRetry = (integrationId: string, reason: string) => {
  apiCallRetriesTotal.labels(integrationId, reason).inc();
};

export const recordFileOperation = (operation: string, status: string, duration: number) => {
  fileOperationsTotal.labels(operation, status).inc();
  fileOperationDuration.labels(operation).observe(duration / 1000);
};

export const recordError = (errorType: string, component: string, jobId?: string) => {
  errorsTotal.labels(errorType, component, jobId || 'unknown').inc();
};

// Queue metrics helpers
export const updateQueueMetrics = async (queue: any) => {
  try {
    const waiting = await queue.getWaiting();
    const active = await queue.getActive();
    const completed = await queue.getCompleted();
    const failed = await queue.getFailed();
    const delayed = await queue.getDelayed();
    
    jobQueueSize.labels('csv-processing', 'waiting').set(waiting.length);
    jobQueueSize.labels('csv-processing', 'active').set(active.length);
    jobQueueSize.labels('csv-processing', 'completed').set(completed.length);
    jobQueueSize.labels('csv-processing', 'failed').set(failed.length);
    jobQueueSize.labels('csv-processing', 'delayed').set(delayed.length);
  } catch (error) {
    console.error('Failed to update queue metrics:', error);
  }
};

// Metrics endpoint handler
export const getMetrics = async (req: any, res: any) => {
  try {
    // Update system metrics before returning
    collectSystemMetrics();
    collectCpuMetrics();
    collectEventLoopLag();
    
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
    prefix: 'atlas2_worker_',
    timeout: 5000,
    gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
  });
};

export { register };