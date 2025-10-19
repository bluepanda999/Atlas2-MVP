# Application Monitoring and Metrics Integration Handoff
**Comprehensive Monitoring Implementation for Atlas2**

**Document Version:** 1.0  
**Created:** 2025-10-19  
**Status:** Ready for Development  
**Priority:** HIGH  
**Implementation Timeline:** 3-4 weeks

---

## 🎯 Executive Summary

### Current State Analysis
The Atlas2 project has **monitoring infrastructure in place** but **lacks application instrumentation**. While Prometheus, Grafana, and basic monitoring tools are configured, the applications themselves are not emitting metrics, traces, or structured logs. This creates significant blind spots in:

- **Application Performance**: No visibility into API response times, error rates, or throughput
- **Business Metrics**: No tracking of upload processing, user engagement, or conversion rates
- **User Experience**: No monitoring of frontend performance or user journey completion
- **System Health**: Limited visibility into service dependencies and failure modes

### Implementation Goals
Implement comprehensive monitoring that provides:
1. **Technical Observability**: Full application performance monitoring
2. **Business Intelligence**: KPI tracking for user behavior and business outcomes
3. **Proactive Alerting**: Early detection of issues before they impact users
4. **Operational Excellence**: Data-driven decision making and capacity planning

---

## 🏗️ Monitoring Architecture

### Technology Stack
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │    │  OpenTelemetry  │    │   Prometheus    │
│                 │    │   Collector     │    │                 │
│ • API Service   │───▶│                 │───▶│                 │
│ • Worker Service│    │ • Metrics       │    │ • Storage       │
│ • Frontend      │    │ • Traces        │    │ • Querying      │
│ • Background    │    │ • Logs          │    │ • Alerting      │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     Loki        │    │    Grafana      │    │  AlertManager   │
│                 │    │                 │    │                 │
│ • Log Storage   │    │ • Dashboards    │    │ • Routing       │
│ • Querying      │    │ • Visualization │    │ • Silencing     │
│ • Retention     │    │ • Alerting      │    │ • Notifications │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Service Instrumentation Matrix
| Service | Metrics | Traces | Logs | Business KPIs |
|---------|---------|--------|------|---------------|
| API Service | ✅ HTTP, Database, Auth | ✅ Request Flow | ✅ Structured | ✅ API Usage |
| Worker Service | ✅ Job Processing, Queue | ✅ Job Lifecycle | ✅ Structured | ✅ Upload Processing |
| Frontend | ✅ Performance, User Actions | ✅ User Journey | ✅ Browser Events | ✅ User Engagement |
| Database | ✅ Query Performance | ❌ N/A | ✅ Query Logs | ✅ Data Volume |
| Redis | ✅ Cache Performance | ❌ N/A | ✅ Access Logs | ✅ Cache Hit Rate |

---

## 📋 Phase 1: Core Metrics Implementation (Week 1)

### 1.1 API Service Metrics
```typescript
// api/src/middleware/metrics.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { register, Counter, Histogram, Gauge } from 'prom-client';

// Create metrics
const httpRequestsTotal = new Counter({
  name: 'atlas2_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'user_id']
});

const httpRequestDuration = new Histogram({
  name: 'atlas2_http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

const activeConnections = new Gauge({
  name: 'atlas2_active_connections',
  help: 'Number of active connections'
});

const uploadQueueSize = new Gauge({
  name: 'atlas2_upload_queue_size',
  help: 'Number of items in upload queue'
});

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  
  // Increment active connections
  activeConnections.inc();
  
  // Track request completion
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    const userId = (req as any).user?.id || 'anonymous';
    
    httpRequestsTotal
      .labels(req.method, route, res.statusCode.toString(), userId)
      .inc();
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(duration);
    
    // Decrement active connections
    activeConnections.dec();
  });
  
  next();
};

// Business metrics
const uploadsCompleted = new Counter({
  name: 'atlas2_uploads_completed_total',
  help: 'Total number of completed uploads',
  labelNames: ['user_id', 'file_size_range']
});

const uploadProcessingTime = new Histogram({
  name: 'atlas2_upload_processing_time_seconds',
  help: 'Time taken to process uploads',
  labelNames: ['file_size_range'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800]
});

const authenticationEvents = new Counter({
  name: 'atlas2_authentication_events_total',
  help: 'Total authentication events',
  labelNames: ['method', 'status', 'user_id']
});

export const businessMetrics = {
  uploadsCompleted,
  uploadProcessingTime,
  authenticationEvents
};
```

### 1.2 Upload Service Metrics
```typescript
// api/src/services/upload.service.ts (Enhanced with metrics)
import { businessMetrics } from '../middleware/metrics.middleware';

export class UploadService {
  async uploadFile(buffer: Buffer, originalName: string, size: number, userId: string): Promise<ProcessingJob> {
    const startTime = Date.now();
    
    try {
      // ... existing upload logic ...
      
      const job = await this.uploadRepository.create(jobData);
      
      // Track business metrics
      const sizeRange = this.getFileSizeRange(size);
      businessMetrics.uploadsCompleted.labels(userId, sizeRange).inc();
      
      return job;
    } catch (error) {
      throw error;
    } finally {
      // Track processing time
      const processingTime = (Date.now() - startTime) / 1000;
      const sizeRange = this.getFileSizeRange(size);
      businessMetrics.uploadProcessingTime.labels(sizeRange).observe(processingTime);
    }
  }
  
  private getFileSizeRange(size: number): string {
    if (size < 1024 * 1024) return '<1MB';
    if (size < 10 * 1024 * 1024) return '1-10MB';
    if (size < 100 * 1024 * 1024) return '10-100MB';
    if (size < 1024 * 1024 * 1024) return '100MB-1GB';
    return '>1GB';
  }
}
```

### 1.3 Authentication Metrics
```typescript
// api/src/services/auth.service.ts (Enhanced with metrics)
import { businessMetrics } from '../middleware/metrics.middleware';

export class AuthService {
  async authenticateUser(email: string, password: string): Promise<AuthResult> {
    try {
      // ... existing authentication logic ...
      
      // Track successful authentication
      businessMetrics.authenticationEvents
        .labels('jwt', 'success', user.id)
        .inc();
      
      return result;
    } catch (error) {
      // Track failed authentication
      businessMetrics.authenticationEvents
        .labels('jwt', 'failed', 'anonymous')
        .inc();
      
      throw error;
    }
  }
  
  async authenticateApiKey(configId: string, testEndpoint: string): Promise<ValidationResult> {
    try {
      // ... existing API key validation logic ...
      
      businessMetrics.authenticationEvents
        .labels('api_key', 'success', userId)
        .inc();
      
      return result;
    } catch (error) {
      businessMetrics.authenticationEvents
        .labels('api_key', 'failed', userId)
        .inc();
      
      throw error;
    }
  }
}
```

### 1.4 Worker Service Metrics
```typescript
// worker/src/metrics/worker-metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

const jobsProcessed = new Counter({
  name: 'atlas2_jobs_processed_total',
  help: 'Total number of jobs processed',
  labelNames: ['job_type', 'status']
});

const jobProcessingTime = new Histogram({
  name: 'atlas2_job_processing_time_seconds',
  help: 'Time taken to process jobs',
  labelNames: ['job_type'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800]
});

const queueDepth = new Gauge({
  name: 'atlas2_queue_depth',
  help: 'Current queue depth',
  labelNames: ['queue_name']
});

const workerActiveJobs = new Gauge({
  name: 'atlas2_worker_active_jobs',
  help: 'Number of active jobs per worker'
});

export const workerMetrics = {
  jobsProcessed,
  jobProcessingTime,
  queueDepth,
  workerActiveJobs
};

// Enhanced CSV processor with metrics
export class CSVProcessor {
  async processJob(job: ProcessingJob): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Update active jobs gauge
      workerMetrics.workerActiveJobs.inc();
      
      // ... existing processing logic ...
      
      // Track successful job completion
      workerMetrics.jobsProcessed
        .labels('csv_processing', 'completed')
        .inc();
      
    } catch (error) {
      // Track failed job
      workerMetrics.jobsProcessed
        .labels('csv_processing', 'failed')
        .inc();
      
      throw error;
    } finally {
      // Track processing time
      const processingTime = (Date.now() - startTime) / 1000;
      workerMetrics.jobProcessingTime
        .labels('csv_processing')
        .observe(processingTime);
      
      // Update active jobs gauge
      workerMetrics.workerActiveJobs.dec();
    }
  }
}
```

---

## 📋 Phase 2: OpenTelemetry Integration (Week 2)

### 2.1 OpenTelemetry Setup
```typescript
// api/src/tracing/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'atlas2-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development'
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces'
  }),
  metricExporter: new PrometheusExporter({
    port: 9464
  }),
  instrumentations: [getNodeAutoInstrumentations()]
});

sdk.start();

export { sdk };
```

### 2.2 Request Tracing
```typescript
// api/src/middleware/tracing.middleware.ts
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { Request, Response, NextFunction } from 'express';

export const tracingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const tracer = trace.getTracer('atlas2-api');
  const span = tracer.startSpan(`HTTP ${req.method} ${req.path}`, {
    kind: SpanKind.SERVER,
    attributes: {
      'http.method': req.method,
      'http.url': req.url,
      'http.target': req.path,
      'user.agent': req.get('User-Agent'),
      'user.id': (req as any).user?.id || 'anonymous'
    }
  });

  // Add span to request for later use
  (req as any).span = span;

  // Track response
  res.on('finish', () => {
    span.setAttributes({
      'http.status_code': res.statusCode,
      'response.size': res.get('Content-Length') || 0
    });

    if (res.statusCode >= 400) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: `HTTP ${res.statusCode}`
      });
    } else {
      span.setStatus({ code: SpanStatusCode.OK });
    }

    span.end();
  });

  next();
};
```

### 2.3 Database Tracing
```typescript
// api/src/repositories/base.repository.ts
import { trace, SpanKind } from '@opentelemetry/api';

export class BaseRepository {
  protected async traceQuery<T>(
    operation: string,
    query: string,
    params: any[],
    execute: () => Promise<T>
  ): Promise<T> {
    const tracer = trace.getTracer('database');
    const span = tracer.startSpan(`db.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        'db.system': 'postgresql',
        'db.operation': operation,
        'db.statement': query,
        'db.statement.parameters': JSON.stringify(params)
      }
    });

    try {
      const result = await execute();
      
      span.setAttributes({
        'db.rows_affected': Array.isArray(result) ? result.length : 1
      });
      
      return result;
    } catch (error) {
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }
}

// Usage in upload repository
export class UploadRepository extends BaseRepository {
  async create(job: Omit<ProcessingJob, 'id' | 'createdAt' | 'updatedAt'>): Promise<ProcessingJob> {
    const query = 'INSERT INTO processing_jobs (...) VALUES (...) RETURNING *';
    const params = [job.userId, job.fileName, /* ... */];
    
    return this.traceQuery('insert', query, params, () => {
      return this.db.query(query, params);
    });
  }
}
```

---

## 📋 Phase 3: Business KPI Implementation (Week 2-3)

### 3.1 User Engagement Metrics
```typescript
// api/src/metrics/business-metrics.ts
import { register, Counter, Histogram, Gauge } from 'prom-client';

// User engagement metrics
const dailyActiveUsers = new Gauge({
  name: 'atlas2_daily_active_users',
  help: 'Number of daily active users'
});

const userRegistrations = new Counter({
  name: 'atlas2_user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['source']
});

const userSessions = new Counter({
  name: 'atlas2_user_sessions_total',
  help: 'Total number of user sessions',
  labelNames: ['user_type']
});

const sessionDuration = new Histogram({
  name: 'atlas2_session_duration_seconds',
  help: 'Duration of user sessions',
  buckets: [60, 300, 900, 1800, 3600, 7200] // 1min to 2hours
});

// Upload business metrics
const uploadSuccessRate = new Gauge({
  name: 'atlas2_upload_success_rate',
  help: 'Success rate of uploads (percentage)'
});

const averageProcessingTime = new Histogram({
  name: 'atlas2_average_processing_time_seconds',
  help: 'Average time to process uploads',
  labelNames: ['file_size_range'],
  buckets: [1, 5, 10, 30, 60, 300, 600, 1800]
});

const dataVolumeProcessed = new Counter({
  name: 'atlas2_data_volume_processed_bytes',
  help: 'Total volume of data processed',
  labelNames: ['file_type']
});

// API usage metrics
const apiUsageByEndpoint = new Counter({
  name: 'atlas2_api_usage_by_endpoint_total',
  help: 'API usage by endpoint',
  labelNames: ['endpoint', 'method', 'user_tier']
});

const apiKeyUsage = new Counter({
  name: 'atlas2_api_key_usage_total',
  help: 'API key usage',
  labelNames: ['key_id', 'client_id']
});

export const businessKPIs = {
  dailyActiveUsers,
  userRegistrations,
  userSessions,
  sessionDuration,
  uploadSuccessRate,
  averageProcessingTime,
  dataVolumeProcessed,
  apiUsageByEndpoint,
  apiKeyUsage
};
```

### 3.2 Business Metrics Collector
```typescript
// api/src/services/business-metrics.service.ts
import { businessKPIs } from '../metrics/business-metrics';
import { UserRepository } from '../repositories/user.repository';
import { UploadRepository } from '../repositories/upload.repository';

export class BusinessMetricsService {
  constructor(
    private userRepo: UserRepository,
    private uploadRepo: UploadRepository
  ) {}

  async updateDailyActiveUsers(): Promise<void> {
    const activeUsers = await this.userRepo.countActiveUsersToday();
    businessKPIs.dailyActiveUsers.set(activeUsers);
  }

  async updateUploadSuccessRate(): Promise<void> {
    const stats = await this.uploadRepo.getSuccessRateStats();
    businessKPIs.uploadSuccessRate.set(stats.successRate);
  }

  async trackUserRegistration(userId: string, source: string): Promise<void> {
    businessKPIs.userRegistrations.labels(source).inc();
  }

  async trackUserSession(userId: string, userType: string): Promise<void> {
    businessKPIs.userSessions.labels(userType).inc();
  }

  async trackSessionEnd(duration: number): Promise<void> {
    businessKPIs.sessionDuration.observe(duration);
  }

  async trackDataVolume(fileSize: number, fileType: string): Promise<void> {
    businessKPIs.dataVolumeProcessed.labels(fileType).inc(fileSize);
  }

  async trackApiUsage(endpoint: string, method: string, userTier: string): Promise<void> {
    businessKPIs.apiUsageByEndpoint.labels(endpoint, method, userTier).inc();
  }
}
```

### 3.3 Scheduled Metrics Updates
```typescript
// api/src/jobs/metrics-collector.job.ts
import cron from 'node-cron';
import { BusinessMetricsService } from '../services/business-metrics.service';

export class MetricsCollectorJob {
  constructor(private businessMetricsService: BusinessMetricsService) {}

  start(): void {
    // Update daily active users every hour
    cron.schedule('0 * * * *', async () => {
      try {
        await this.businessMetricsService.updateDailyActiveUsers();
        console.log('Updated daily active users metric');
      } catch (error) {
        console.error('Failed to update daily active users:', error);
      }
    });

    // Update upload success rate every 5 minutes
    cron.schedule('*/5 * * * *', async () => {
      try {
        await this.businessMetricsService.updateUploadSuccessRate();
        console.log('Updated upload success rate metric');
      } catch (error) {
        console.error('Failed to update upload success rate:', error);
      }
    });
  }
}
```

---

## 📋 Phase 4: Frontend Monitoring (Week 3)

### 4.1 Frontend Performance Metrics
```typescript
// src/services/monitoring.service.ts
import { performance } from 'web-vitals';

class FrontendMonitoringService {
  private metricsEndpoint = '/api/metrics/frontend';

  constructor() {
    this.initializeWebVitals();
    this.initializeUserInteractionTracking();
    this.initializeErrorTracking();
  }

  private initializeWebVitals(): void {
    const sendMetric = (name: string, value: number, labels: Record<string, string>) => {
      fetch(this.metricsEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          metric: `atlas2_frontend_${name}`,
          value,
          labels,
          timestamp: Date.now()
        })
      }).catch(console.error);
    };

    // Core Web Vitals
    performance.onCLS((metric) => {
      sendMetric('cumulative_layout_shift', metric.value, { rating: metric.rating });
    });

    performance.onFID((metric) => {
      sendMetric('first_input_delay', metric.value, { rating: metric.rating });
    });

    performance.onLCP((metric) => {
      sendMetric('largest_contentful_paint', metric.value, { rating: metric.rating });
    });

    performance.onTTFB((metric) => {
      sendMetric('time_to_first_byte', metric.value, { rating: metric.rating });
    });
  }

  private initializeUserInteractionTracking(): void {
    // Track button clicks
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const buttonName = target.getAttribute('data-testid') || target.textContent || 'unknown';
      
      this.trackUserAction('button_click', { button_name: buttonName });
    });

    // Track form submissions
    document.addEventListener('submit', (event) => {
      const form = event.target as HTMLFormElement;
      const formName = form.getAttribute('data-testid') || form.id || 'unknown';
      
      this.trackUserAction('form_submit', { form_name: formName });
    });

    // Track file uploads
    document.addEventListener('change', (event) => {
      const target = event.target as HTMLInputElement;
      if (target.type === 'file' && target.files?.length) {
        const file = target.files[0];
        this.trackFileUpload(file);
      }
    });
  }

  private initializeErrorTracking(): void {
    // Track JavaScript errors
    window.addEventListener('error', (event) => {
      this.trackError('javascript_error', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Track unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.trackError('promise_rejection', {
        reason: event.reason?.toString() || 'Unknown reason'
      });
    });
  }

  trackUserAction(action: string, properties: Record<string, any>): void {
    fetch(this.metricsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'atlas2_frontend_user_action',
        value: 1,
        labels: {
          action,
          ...properties,
          page: window.location.pathname
        },
        timestamp: Date.now()
      })
    }).catch(console.error);
  }

  trackFileUpload(file: File): void {
    const sizeRange = this.getFileSizeRange(file.size);
    
    fetch(this.metricsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'atlas2_frontend_file_upload',
        value: file.size,
        labels: {
          file_type: file.type,
          size_range: sizeRange,
          page: window.location.pathname
        },
        timestamp: Date.now()
      })
    }).catch(console.error);
  }

  trackError(errorType: string, properties: Record<string, any>): void {
    fetch(this.metricsEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: 'atlas2_frontend_error',
        value: 1,
        labels: {
          error_type: errorType,
          ...properties,
          page: window.location.pathname,
          user_agent: navigator.userAgent
        },
        timestamp: Date.now()
      })
    }).catch(console.error);
  }

  private getFileSizeRange(size: number): string {
    if (size < 1024 * 1024) return '<1MB';
    if (size < 10 * 1024 * 1024) return '1-10MB';
    if (size < 100 * 1024 * 1024) return '10-100MB';
    return '>100MB';
  }
}

export const monitoringService = new FrontendMonitoringService();
```

### 4.2 Frontend Metrics Endpoint
```typescript
// api/src/routes/metrics.ts (Add frontend metrics handling)
import { Router } from 'express';
import { Counter, Histogram } from 'prom-client';

const router = Router();

// Frontend metrics
const frontendUserActions = new Counter({
  name: 'atlas2_frontend_user_actions_total',
  help: 'Total frontend user actions',
  labelNames: ['action', 'page', 'button_name', 'form_name']
});

const frontendFileUploads = new Histogram({
  name: 'atlas2_frontend_file_upload_size_bytes',
  help: 'Size of files uploaded from frontend',
  labelNames: ['file_type', 'size_range', 'page'],
  buckets: [1024, 10240, 102400, 1048576, 10485760, 104857600, 1073741824]
});

const frontendErrors = new Counter({
  name: 'atlas2_frontend_errors_total',
  help: 'Total frontend errors',
  labelNames: ['error_type', 'page', 'user_agent']
});

const frontendWebVitals = new Histogram({
  name: 'atlas2_frontend_web_vitals',
  help: 'Frontend web vitals',
  labelNames: ['metric', 'rating'],
  buckets: [100, 500, 1000, 2000, 5000, 10000]
});

router.post('/frontend', (req, res) => {
  try {
    const { metric, value, labels, timestamp } = req.body;

    switch (metric) {
      case 'atlas2_frontend_user_action':
        frontendUserActions.labels(labels.action, labels.page, labels.button_name, labels.form_name).inc();
        break;
      
      case 'atlas2_frontend_file_upload':
        frontendFileUploads.labels(labels.file_type, labels.size_range, labels.page).observe(value);
        break;
      
      case 'atlas2_frontend_error':
        frontendErrors.labels(labels.error_type, labels.page, labels.user_agent).inc();
        break;
      
      default:
        if (metric.startsWith('atlas2_frontend_')) {
          const webVital = metric.replace('atlas2_frontend_', '');
          frontendWebVitals.labels(webVital, labels.rating).observe(value);
        }
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record metric' });
  }
});

export default router;
```

---

## 📋 Phase 5: Alerting Implementation (Week 3-4)

### 5.1 Alerting Rules Configuration
```yaml
# monitoring/alert_rules.yml
groups:
  - name: atlas2_application_alerts
    rules:
      # High error rate alert
      - alert: HighErrorRate
        expr: rate(atlas2_http_requests_total{status_code=~"5.."}[5m]) / rate(atlas2_http_requests_total[5m]) > 0.05
        for: 2m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }} for the last 5 minutes"
          runbook_url: "https://docs.atlas2.com/runbooks/high-error-rate"

      # High response time alert
      - alert: HighResponseTime
        expr: histogram_quantile(0.95, rate(atlas2_http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "High response time detected"
          description: "95th percentile response time is {{ $value }}s"

      # Upload queue backup
      - alert: UploadQueueBackup
        expr: atlas2_upload_queue_size > 100
        for: 5m
        labels:
          severity: warning
          team: backend
        annotations:
          summary: "Upload queue is backing up"
          description: "Upload queue size is {{ $value }} items"

      # Worker job failures
      - alert: HighJobFailureRate
        expr: rate(atlas2_jobs_processed_total{status="failed"}[5m]) / rate(atlas2_jobs_processed_total[5m]) > 0.1
        for: 3m
        labels:
          severity: critical
          team: backend
        annotations:
          summary: "High job failure rate"
          description: "Job failure rate is {{ $value | humanizePercentage }}"

      # Authentication failures
      - alert: HighAuthenticationFailureRate
        expr: rate(atlas2_authentication_events_total{status="failed"}[5m]) / rate(atlas2_authentication_events_total[5m]) > 0.2
        for: 2m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "High authentication failure rate"
          description: "Authentication failure rate is {{ $value | humanizePercentage }}"

  - name: atlas2_business_alerts
    rules:
      # Low user engagement
      - alert: LowUserEngagement
        expr: atlas2_daily_active_users < 10
        for: 1h
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Low user engagement detected"
          description: "Only {{ $value }} active users today"

      # Upload success rate drop
      - alert: LowUploadSuccessRate
        expr: atlas2_upload_success_rate < 0.9
        for: 10m
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Upload success rate dropped"
          description: "Upload success rate is {{ $value | humanizePercentage }}"

  - name: atlas2_infrastructure_alerts
    rules:
      # High memory usage
      - alert: HighMemoryUsage
        expr: process_resident_memory_bytes / 1024 / 1024 > 1024  # >1GB
        for: 5m
        labels:
          severity: warning
          team: devops
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}MB"

      # Database connection issues
      - alert: DatabaseConnectionIssues
        expr: up{job="postgres"} == 0
        for: 1m
        labels:
          severity: critical
          team: devops
        annotations:
          summary: "Database is down"
          description: "PostgreSQL database is not responding"
```

### 5.2 AlertManager Configuration
```yaml
# monitoring/alertmanager.yml
global:
  smtp_smarthost: 'localhost:587'
  smtp_from: 'alerts@atlas2.com'

route:
  group_by: ['alertname', 'team']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        team: backend
      receiver: 'backend-team'
    - match:
        team: frontend
      receiver: 'frontend-team'
    - match:
        team: security
      receiver: 'security-team'
    - match:
        team: devops
      receiver: 'devops-team'
    - match:
        team: product
      receiver: 'product-team'

receivers:
  - name: 'default'
    email_configs:
      - to: 'alerts@atlas2.com'
        subject: '[Atlas2] {{ .GroupLabels.alertname }}'
        body: |
          {{ range .Alerts }}
          Alert: {{ .Annotations.summary }}
          Description: {{ .Annotations.description }}
          {{ end }}

  - name: 'backend-team'
    email_configs:
      - to: 'backend-team@atlas2.com'
        subject: '[Backend Alert] {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#backend-alerts'
        title: 'Backend Alert: {{ .GroupLabels.alertname }}'

  - name: 'frontend-team'
    email_configs:
      - to: 'frontend-team@atlas2.com'
        subject: '[Frontend Alert] {{ .GroupLabels.alertname }}'

  - name: 'security-team'
    email_configs:
      - to: 'security-team@atlas2.com'
        subject: '[Security Alert] {{ .GroupLabels.alertname }}'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK'
        channel: '#security-alerts'
        title: '🚨 Security Alert: {{ .GroupLabels.alertname }}'

  - name: 'devops-team'
    email_configs:
      - to: 'devops-team@atlas2.com'
        subject: '[DevOps Alert] {{ .GroupLabels.alertname }}'

  - name: 'product-team'
    email_configs:
      - to: 'product-team@atlas2.com'
        subject: '[Product Alert] {{ .GroupLabels.alertname }}'

inhibit_rules:
  - source_match:
      severity: 'critical'
    target_match:
      severity: 'warning'
    equal: ['alertname', 'team']
```

---

## 📋 Phase 6: Grafana Dashboards (Week 4)

### 6.1 Business Overview Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "Atlas2 Business Overview",
    "tags": ["atlas2", "business"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Daily Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_daily_active_users",
            "legendFormat": "Active Users"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "color": {
              "mode": "palette-classic"
            },
            "unit": "short"
          }
        }
      },
      {
        "id": 2,
        "title": "Upload Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_upload_success_rate * 100",
            "legendFormat": "Success Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": 0},
                {"color": "yellow", "value": 90},
                {"color": "green", "value": 95}
              ]
            }
          }
        }
      },
      {
        "id": 3,
        "title": "User Registrations",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(atlas2_user_registrations_total[5m]) * 300",
            "legendFormat": "Registrations per 5min"
          }
        ]
      },
      {
        "id": 4,
        "title": "Data Volume Processed",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(atlas2_data_volume_processed_bytes[1h]) * 3600",
            "legendFormat": "Bytes per hour"
          }
        ],
        "yAxes": [
          {
            "unit": "bytes"
          }
        ]
      },
      {
        "id": 5,
        "title": "API Usage by Endpoint",
        "type": "piechart",
        "targets": [
          {
            "expr": "topk(10, sum by (endpoint) (rate(atlas2_api_usage_by_endpoint_total[1h])))",
            "legendFormat": "{{ endpoint }}"
          }
        ]
      }
    ],
    "time": {
      "from": "now-24h",
      "to": "now"
    },
    "refresh": "5m"
  }
}
```

### 6.2 Application Performance Dashboard
```json
{
  "dashboard": {
    "id": null,
    "title": "Atlas2 Application Performance",
    "tags": ["atlas2", "performance"],
    "panels": [
      {
        "id": 1,
        "title": "Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(atlas2_http_requests_total[5m])) by (method)",
            "legendFormat": "{{ method }}"
          }
        ]
      },
      {
        "id": 2,
        "title": "Response Time (95th percentile)",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, sum(rate(atlas2_http_request_duration_seconds_bucket[5m])) by (le, route))",
            "legendFormat": "{{ route }}"
          }
        ]
      },
      {
        "id": 3,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "sum(rate(atlas2_http_requests_total{status_code=~\"5..\"}[5m])) by (route) / sum(rate(atlas2_http_requests_total[5m])) by (route)",
            "legendFormat": "{{ route }}"
          }
        ]
      },
      {
        "id": 4,
        "title": "Active Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_active_connections"
          }
        ]
      },
      {
        "id": 5,
        "title": "Upload Queue Size",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_upload_queue_size"
          }
        ]
      }
    ]
  }
}
```

---

## 📋 Phase 7: Log Aggregation (Week 4)

### 7.1 Structured Logging Setup
```typescript
// api/src/utils/logger.ts
import winston from 'winston';
import { trace } from '@opentelemetry/api';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'atlas2-api',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' })
  ]
});

// Add trace correlation
export const getLogger = (context: string = 'app') => {
  return {
    info: (message: string, meta: any = {}) => {
      const span = trace.getActiveSpan();
      logger.info(message, {
        context,
        trace_id: span?.spanContext().traceId,
        span_id: span?.spanContext().spanId,
        ...meta
      });
    },
    error: (message: string, error?: Error, meta: any = {}) => {
      const span = trace.getActiveSpan();
      logger.error(message, {
        context,
        trace_id: span?.spanContext().traceId,
        span_id: span?.spanContext().spanId,
        error: error?.stack || error,
        ...meta
      });
    },
    warn: (message: string, meta: any = {}) => {
      const span = trace.getActiveSpan();
      logger.warn(message, {
        context,
        trace_id: span?.spanContext().traceId,
        span_id: span?.spanContext().spanId,
        ...meta
      });
    }
  };
};
```

### 7.2 Loki Configuration
```yaml
# monitoring/loki.yml
auth_enabled: false

server:
  http_listen_port: 3100

ingester:
  lifecycler:
    address: 127.0.0.1
    ring:
      kvstore:
        store: inmemory
      replication_factor: 1
    final_sleep: 0s
  chunk_idle_period: 1h
  max_chunk_age: 1h
  chunk_target_size: 1048576
  chunk_retain_period: 30s

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

storage_config:
  boltdb_shipper:
    active_index_directory: /loki/boltdb-shipper-active
    cache_location: /loki/boltdb-shipper-cache
    shared_store: filesystem
  filesystem:
    directory: /loki/chunks

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
```

---

## ✅ Acceptance Criteria

### Technical Requirements
- [ ] All services emit Prometheus metrics for HTTP requests, database operations, and business logic
- [ ] OpenTelemetry tracing implemented across all services with proper span correlation
- [ ] Frontend performance monitoring with Web Vitals and user interaction tracking
- [ ] Structured logging with trace correlation and centralized aggregation
- [ ] Comprehensive alerting rules for technical and business metrics

### Business Requirements
- [ ] Daily active users tracking and reporting
- [ ] Upload success rate and processing time monitoring
- [ ] API usage analytics by endpoint and user tier
- [ ] User engagement metrics and session tracking
- [ ] Data volume processed and file size distribution

### Operational Requirements
- [ ] Grafana dashboards for business and technical monitoring
- [ ] AlertManager configuration with team-specific routing
- [ ] Log aggregation with Loki and proper retention policies
- [ ] Monitoring as code with version-controlled configurations
- [ ] Performance benchmarks and SLA monitoring

### Quality Requirements
- [ ] All monitoring code tested and documented
- [ ] Proper error handling and fallback mechanisms
- [ ] Security considerations for sensitive data in logs/metrics
- [ ] Performance impact of monitoring <5% overhead
- [ ] Documentation and runbooks for common issues

---

## 📋 Implementation Timeline

### Week 1: Core Metrics
- Day 1-2: API service metrics implementation
- Day 3-4: Worker service metrics
- Day 5: Business KPI metrics setup

### Week 2: Tracing and Frontend
- Day 1-2: OpenTelemetry integration
- Day 3-4: Frontend monitoring setup
- Day 5: Cross-service tracing validation

### Week 3: Business Metrics and Alerting
- Day 1-2: Business metrics collector
- Day 3-4: Alerting rules configuration
- Day 5: AlertManager setup

### Week 4: Dashboards and Logs
- Day 1-2: Grafana dashboard creation
- Day 3-4: Log aggregation setup
- Day 5: Documentation and training

---

## 🎯 Success Metrics

### Technical Metrics
- **Metric Coverage**: 100% of services instrumented
- **Trace Coverage**: 90% of requests traced end-to-end
- **Alert Coverage**: All critical failure modes alerted
- **Dashboard Usage**: Active monitoring by all teams

### Business Metrics
- **User Engagement Visibility**: Real-time DAU tracking
- **Upload Performance**: <5 minute detection of issues
- **API Usage Analytics**: Complete usage visibility
- **Data-Driven Decisions**: Metrics inform product decisions

### Operational Metrics
- **MTTR Reduction**: <15 minutes mean time to resolution
- **Proactive Detection**: >80% of issues detected before user impact
- **Monitoring Overhead**: <5% performance impact
- **Team Adoption**: All teams using monitoring data

---

**This comprehensive monitoring handoff provides everything needed to implement production-ready observability across the Atlas2 platform. The implementation covers both technical and business requirements, ensuring complete visibility into system performance and user behavior.**