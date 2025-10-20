import { logger } from '../utils/logger';

export interface MetricData {
  name: string;
  value: number;
  labels?: Record<string, string>;
  timestamp?: Date;
}

export interface CounterData extends MetricData {
  type: 'counter';
}

export interface GaugeData extends MetricData {
  type: 'gauge';
}

export interface HistogramData extends MetricData {
  type: 'histogram';
  buckets?: number[];
}

export class MetricsService {
  private metrics: Map<string, MetricData> = new Map();
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, { count: number; sum: number; buckets: Map<number, number> }> = new Map();

  constructor() {
    // Initialize default metrics
    this.initializeDefaultMetrics();
  }

  private initializeDefaultMetrics(): void {
    // HTTP request counter
    this.createCounter('http_requests_total', 'Total number of HTTP requests');
    
    // HTTP request duration histogram
    this.createHistogram('http_request_duration_seconds', 'HTTP request duration in seconds', [0.1, 0.5, 1, 2, 5]);
    
    // Database connection gauge
    this.createGauge('database_connections_active', 'Active database connections');
    
    // Job queue metrics
    this.createGauge('job_queue_size', 'Number of jobs in queue');
    this.createCounter('jobs_processed_total', 'Total number of jobs processed');
    this.createCounter('jobs_failed_total', 'Total number of jobs failed');
  }

  createCounter(name: string, help: string): void {
    this.counters.set(name, 0);
    this.metrics.set(name, { name, value: 0, type: 'counter' as any });
    logger.debug('Counter created', { name, help });
  }

  createGauge(name: string, help: string): void {
    this.gauges.set(name, 0);
    this.metrics.set(name, { name, value: 0, type: 'gauge' as any });
    logger.debug('Gauge created', { name, help });
  }

  createHistogram(name: string, help: string, buckets: number[] = [0.1, 0.5, 1, 2, 5]): void {
    this.histograms.set(name, {
      count: 0,
      sum: 0,
      buckets: new Map(buckets.map(bucket => [bucket, 0])),
    });
    this.metrics.set(name, { name, value: 0, type: 'histogram' as any, buckets });
    logger.debug('Histogram created', { name, help, buckets });
  }

  incrementCounter(name: string, value: number = 1, labels?: Record<string, string>): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + value);
    
    const metric = this.metrics.get(name);
    if (metric) {
      metric.value = current + value;
      metric.labels = labels;
      metric.timestamp = new Date();
    }
    
    logger.debug('Counter incremented', { name, value, total: current + value });
  }

  setGauge(name: string, value: number, labels?: Record<string, string>): void {
    this.gauges.set(name, value);
    
    const metric = this.metrics.get(name);
    if (metric) {
      metric.value = value;
      metric.labels = labels;
      metric.timestamp = new Date();
    }
    
    logger.debug('Gauge set', { name, value });
  }

  observeHistogram(name: string, value: number, labels?: Record<string, string>): void {
    const histogram = this.histograms.get(name);
    if (!histogram) {
      logger.warn('Histogram not found', { name });
      return;
    }

    histogram.count++;
    histogram.sum += value;

    // Update buckets
    for (const [bucket, count] of histogram.buckets) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, count + 1);
      }
    }

    const metric = this.metrics.get(name);
    if (metric) {
      metric.value = value;
      metric.labels = labels;
      metric.timestamp = new Date();
    }

    logger.debug('Histogram observed', { name, value, count: histogram.count });
  }

  getMetric(name: string): MetricData | undefined {
    return this.metrics.get(name);
  }

  getAllMetrics(): Map<string, MetricData> {
    return new Map(this.metrics);
  }

  getPrometheusFormat(): string {
    const lines: string[] = [];
    
    for (const [name, metric] of this.metrics) {
      const metricType = this.metrics.get(name)?.type || 'unknown';
      
      // Add metric type and help (in a real implementation, you'd store help text)
      lines.push(`# TYPE ${name} ${metricType}`);
      lines.push(`# HELP ${name} ${metricType} metric`);
      
      // Add metric value
      if (metric.labels) {
        const labelStr = Object.entries(metric.labels)
          .map(([key, value]) => `${key}="${value}"`)
          .join(',');
        lines.push(`${name}{${labelStr}} ${metric.value}`);
      } else {
        lines.push(`${name} ${metric.value}`);
      }
      
      // Add histogram buckets if applicable
      if (metricType === 'histogram' && metric.buckets) {
        const histogram = this.histograms.get(name);
        if (histogram) {
          for (const [bucket, count] of histogram.buckets) {
            lines.push(`${name}_bucket{le="${bucket}"} ${count}`);
          }
          lines.push(`${name}_bucket{le="+Inf"} ${histogram.count}`);
          lines.push(`${name}_count ${histogram.count}`);
          lines.push(`${name}_sum ${histogram.sum}`);
        }
      }
      
      lines.push(''); // Empty line for readability
    }
    
    return lines.join('\n');
  }

  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.metrics.clear();
    this.initializeDefaultMetrics();
    logger.info('Metrics reset');
  }

  // Convenience methods for common metrics
  recordHttpRequest(method: string, route: string, statusCode: number, duration: number): void {
    this.incrementCounter('http_requests_total', 1, { method, route, status: statusCode.toString() });
    this.observeHistogram('http_request_duration_seconds', duration / 1000, { method, route });
  }

  recordJobProcessed(jobType: string, success: boolean): void {
    if (success) {
      this.incrementCounter('jobs_processed_total', 1, { type: jobType });
    } else {
      this.incrementCounter('jobs_failed_total', 1, { type: jobType });
    }
  }

  setDatabaseConnections(count: number): void {
    this.setGauge('database_connections_active', count);
  }

  setJobQueueSize(size: number): void {
    this.setGauge('job_queue_size', size);
  }
}