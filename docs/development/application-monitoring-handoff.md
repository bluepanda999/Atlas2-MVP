# Application Monitoring and Metrics Integration Handoff

**Document Version:** 1.0  
**Date:** October 19, 2025  
**Author:** BMad Master Task Executor  
**Target Audience:** Development Team, DevOps Engineers, SREs  

---

## Executive Summary

### Current State
Atlas2 has a foundational monitoring infrastructure with Prometheus and Grafana deployed, but application-level instrumentation is incomplete. The existing setup includes:

- ✅ Prometheus server configured with basic scrape targets
- ✅ Grafana dashboards for system metrics
- ✅ Basic alerting rules for infrastructure
- ✅ Metrics collection utilities in the API service
- ❌ Limited application instrumentation
- ❌ Missing business metrics tracking
- ❌ No distributed tracing
- ❌ Incomplete log correlation

### Monitoring Gaps
1. **Application Performance**: No comprehensive APM integration
2. **Business Metrics**: Missing KPI tracking for upload flows, authentication, API usage
3. **User Experience**: No client-side performance monitoring
4. **Distributed Tracing**: No request tracing across microservices
5. **Log Correlation**: Logs not linked to metrics and traces
6. **Proactive Alerting**: Limited business-impact alerting

### Implementation Goals
- Complete application instrumentation across all services
- Implement comprehensive business metrics and KPI tracking
- Establish distributed tracing for end-to-end visibility
- Create proactive alerting based on business impact
- Enable log-metrics-trace correlation
- Establish monitoring as code practices

---

## 1. Monitoring Architecture Overview

### 1.1 Components Stack

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Applications  │    │   Frontend      │    │   External      │
│   (API/Worker)  │    │   (React)       │    │   APIs          │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          ▼                      ▼                      ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Prometheus    │    │   OpenTelemetry │    │   Log Aggregation│
│   Metrics       │    │   Collector     │    │   (Loki)        │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────┬───────────┴──────────────────────┘
                     ▼
          ┌─────────────────┐
          │   Grafana       │
          │   Visualization │
          └─────────────────┘
```

### 1.2 Data Flow Architecture

1. **Metrics Flow**: Applications → Prometheus → Grafana
2. **Traces Flow**: Applications → OpenTelemetry Collector → Jaeger → Grafana
3. **Logs Flow**: Applications → Loki → Grafana
4. **Alerting Flow**: Prometheus → Alertmanager → Notification Channels

### 1.3 Service Instrumentation Points

| Service | Metrics | Traces | Logs | Business Events |
|---------|---------|--------|------|-----------------|
| API Service | ✅ | ✅ | ✅ | ✅ |
| Worker Service | ✅ | ✅ | ✅ | ✅ |
| Frontend | ✅ | ✅ | ✅ | ✅ |
| Database | ✅ | ❌ | ❌ | ❌ |
| Redis | ✅ | ❌ | ❌ | ❌ |

---

## 2. Prometheus Metrics Implementation

### 2.1 API Service Metrics Enhancement

The current metrics implementation in `api/utils/metrics.ts` needs enhancement with the following additions:

#### 2.1.1 Enhanced Business Metrics

```typescript
// Upload flow metrics
export const uploadFlowMetrics = {
  initiated: new Counter({
    name: 'atlas2_upload_flow_initiated_total',
    help: 'Total number of upload flows initiated',
    labelNames: ['user_id', 'file_type', 'source'],
  }),
  
  completed: new Counter({
    name: 'atlas2_upload_flow_completed_total',
    help: 'Total number of upload flows completed',
    labelNames: ['user_id', 'file_type', 'processing_time_bucket'],
  }),
  
  failed: new Counter({
    name: 'atlas2_upload_flow_failed_total',
    help: 'Total number of upload flows failed',
    labelNames: ['user_id', 'file_type', 'failure_reason'],
  }),
  
  duration: new Histogram({
    name: 'atlas2_upload_flow_duration_seconds',
    help: 'Duration of upload flows from start to completion',
    labelNames: ['user_id', 'file_type'],
    buckets: [1, 5, 10, 30, 60, 300, 900, 1800],
  }),
};

// Authentication metrics
export const authMetrics = {
  loginAttempts: new Counter({
    name: 'atlas2_auth_login_attempts_total',
    help: 'Total number of login attempts',
    labelNames: ['method', 'result', 'user_type'],
  }),
  
  sessionDuration: new Histogram({
    name: 'atlas2_auth_session_duration_seconds',
    help: 'Duration of user sessions',
    labelNames: ['user_type', 'termination_reason'],
    buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800],
  }),
  
  tokenRefreshes: new Counter({
    name: 'atlas2_auth_token_refreshes_total',
    help: 'Total number of token refreshes',
    labelNames: ['result', 'user_type'],
  }),
};

// API usage metrics
export const apiUsageMetrics = {
  endpointCalls: new Counter({
    name: 'atlas2_api_endpoint_calls_total',
    help: 'Total number of API endpoint calls',
    labelNames: ['endpoint', 'method', 'user_tier', 'result'],
  }),
  
  dataVolume: new Counter({
    name: 'atlas2_api_data_volume_bytes_total',
    help: 'Total data volume processed by API',
    labelNames: ['endpoint', 'direction'],
  }),
  
  rateLimitHits: new Counter({
    name: 'atlas2_api_rate_limit_hits_total',
    help: 'Total number of rate limit hits',
    labelNames: ['user_id', 'endpoint', 'limit_type'],
  }),
};
```

#### 2.1.2 Integration Points

**Upload Controller Enhancement:**
```typescript
// In upload.controller.ts
import { uploadFlowMetrics } from '../utils/metrics';

export const uploadFile = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const userId = req.user?.id;
  const fileType = req.file?.mimetype;
  
  try {
    uploadFlowMetrics.initiated.labels(userId, fileType, 'web').inc();
    
    // ... existing upload logic ...
    
    const duration = (Date.now() - startTime) / 1000;
    const timeBucket = getTimeBucket(duration);
    
    uploadFlowMetrics.completed.labels(userId, fileType, timeBucket).inc();
    uploadFlowMetrics.duration.labels(userId, fileType).observe(duration);
    
  } catch (error) {
    uploadFlowMetrics.failed.labels(userId, fileType, error.code).inc();
    throw error;
  }
};
```

**Authentication Controller Enhancement:**
```typescript
// In auth.controller.ts
import { authMetrics } from '../utils/metrics';

export const login = async (req: Request, res: Response) => {
  const startTime = Date.now();
  const method = req.body.method || 'password';
  
  try {
    // ... existing auth logic ...
    
    authMetrics.loginAttempts.labels(method, 'success', user.type).inc();
    
  } catch (error) {
    authMetrics.loginAttempts.labels(method, 'failure', 'unknown').inc();
    throw error;
  }
};
```

### 2.2 Worker Service Metrics

#### 2.2.1 Job Processing Metrics

```typescript
// In worker/utils/metrics.ts
export const workerMetrics = {
  jobsProcessed: new Counter({
    name: 'atlas2_worker_jobs_processed_total',
    help: 'Total number of jobs processed',
    labelNames: ['job_type', 'result', 'user_id'],
  }),
  
  jobProcessingTime: new Histogram({
    name: 'atlas2_worker_job_processing_seconds',
    help: 'Time taken to process jobs',
    labelNames: ['job_type'],
    buckets: [1, 5, 10, 30, 60, 300, 900, 1800],
  }),
  
  queueDepth: new Gauge({
    name: 'atlas2_worker_queue_depth',
    help: 'Current queue depth',
    labelNames: ['queue_name', 'priority'],
  }),
  
  throughput: new Gauge({
    name: 'atlas2_worker_throughput_jobs_per_second',
    help: 'Current processing throughput',
    labelNames: ['job_type'],
  }),
};
```

#### 2.2.2 CSV Processing Specific Metrics

```typescript
export const csvProcessingMetrics = {
  recordsProcessed: new Counter({
    name: 'atlas2_csv_records_processed_total',
    help: 'Total number of CSV records processed',
    labelNames: ['job_id', 'result'],
  }),
  
  processingRate: new Gauge({
    name: 'atlas2_csv_processing_rate_records_per_second',
    help: 'Current CSV processing rate',
    labelNames: ['job_id'],
  }),
  
  validationErrors: new Counter({
    name: 'atlas2_csv_validation_errors_total',
    help: 'Total number of CSV validation errors',
    labelNames: ['job_id', 'error_type'],
  }),
  
  transformationErrors: new Counter({
    name: 'atlas2_csv_transformation_errors_total',
    help: 'Total number of CSV transformation errors',
    labelNames: ['job_id', 'transformation_type'],
  }),
};
```

### 2.3 Frontend Metrics

#### 2.3.1 Performance Metrics

```typescript
// In src/utils/metrics.ts
export const frontendMetrics = {
  pageLoadTime: new Histogram({
    name: 'atlas2_frontend_page_load_seconds',
    help: 'Page load time',
    labelNames: ['page', 'browser'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
  
  apiCallLatency: new Histogram({
    name: 'atlas2_frontend_api_call_seconds',
    help: 'Frontend API call latency',
    labelNames: ['endpoint', 'method'],
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
  
  userInteractions: new Counter({
    name: 'atlas2_frontend_user_interactions_total',
    help: 'Total user interactions',
    labelNames: ['action', 'component'],
  }),
  
  errors: new Counter({
    name: 'atlas2_frontend_errors_total',
    help: 'Total frontend errors',
    labelNames: ['error_type', 'component'],
  }),
};
```

---

## 3. Application Performance Monitoring (APM) Integration

### 3.1 OpenTelemetry Setup

#### 3.1.1 API Service Configuration

```typescript
// api/src/tracing.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';

const sdk = new NodeSDK({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'atlas2-api',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.APP_VERSION || '1.0.0',
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  }),
  traceExporter: new OTLPTraceExporter({
    url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://jaeger:4317',
  }),
  instrumentations: [getNodeAutoInstrumentations()],
});

sdk.start();
```

#### 3.1.2 Custom Instrumentation

```typescript
// api/src/instrumentation.ts
import { trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';

export const instrumentUploadFlow = async (jobId: string, operation: () => Promise<any>) => {
  const tracer = trace.getTracer('atlas2-upload');
  
  return tracer.startActiveSpan(
    `upload-flow-${jobId}`,
    { kind: SpanKind.SERVER },
    async (span) => {
      try {
        span.setAttributes({
          'job.id': jobId,
          'service.name': 'atlas2-api',
          'operation.type': 'csv-processing',
        });
        
        const result = await operation();
        
        span.setStatus({ code: SpanStatusCode.OK });
        span.setAttributes({
          'job.result': 'success',
          'job.records_processed': result.recordsProcessed,
        });
        
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        span.setAttributes({
          'job.result': 'error',
          'error.type': error.constructor.name,
        });
        throw error;
      }
    }
  );
};
```

### 3.2 Frontend Tracing

#### 3.2.1 Browser Instrumentation

```typescript
// src/tracing.ts
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { getWebAutoInstrumentations } from '@opentelemetry/auto-instrumentations-web';

const provider = new WebTracerProvider({
  resource: new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: 'atlas2-frontend',
    [SemanticResourceAttributes.SERVICE_VERSION]: process.env.REACT_APP_VERSION || '1.0.0',
  }),
});

provider.addSpanProcessor(
  new BatchSpanProcessor(
    new OTLPTraceExporter({
      url: process.env.REACT_APP_OTEL_EXPORTER_URL || 'http://localhost:4318/v1/traces',
    })
  )
);

provider.register({
  instrumentations: [getWebAutoInstrumentations()],
});
```

---

## 4. Business Metrics and KPI Tracking

### 4.1 Core Business KPIs

#### 4.1.1 User Engagement Metrics

```typescript
export const userEngagementMetrics = {
  dailyActiveUsers: new Gauge({
    name: 'atlas2_business_daily_active_users',
    help: 'Number of daily active users',
    labelNames: ['user_type', 'cohort'],
  }),
  
  userRetentionRate: new Gauge({
    name: 'atlas2_business_user_retention_rate',
    help: 'User retention rate by period',
    labelNames: ['period', 'cohort'],
  }),
  
  featureAdoption: new Gauge({
    name: 'atlas2_business_feature_adoption_rate',
    help: 'Feature adoption rate',
    labelNames: ['feature', 'user_type'],
  }),
};
```

#### 4.1.2 Upload Processing KPIs

```typescript
export const uploadKpiMetrics = {
  processingSuccessRate: new Gauge({
    name: 'atlas2_kpi_upload_success_rate',
    help: 'Upload processing success rate',
    labelNames: ['file_type', 'time_window'],
  }),
  
  averageProcessingTime: new Gauge({
    name: 'atlas2_kpi_avg_processing_time_seconds',
    help: 'Average processing time',
    labelNames: ['file_type', 'size_bucket'],
  }),
  
  throughputPerHour: new Gauge({
    name: 'atlas2_kpi_throughput_per_hour',
    help: 'Files processed per hour',
    labelNames: ['file_type'],
  }),
};
```

### 4.2 Revenue and Usage Metrics

```typescript
export const revenueMetrics = {
  apiUsageByTier: new Counter({
    name: 'atlas2_revenue_api_usage_total',
    help: 'API usage by pricing tier',
    labelNames: ['tier', 'endpoint', 'period'],
  }),
  
  storageUsage: new Gauge({
    name: 'atlas2_revenue_storage_usage_bytes',
    help: 'Storage usage by user',
    labelNames: ['user_id', 'tier'],
  }),
  
  bandwidthUsage: new Counter({
    name: 'atlas2_revenue_bandwidth_bytes_total',
    help: 'Bandwidth usage',
    labelNames: ['user_id', 'direction', 'period'],
  }),
};
```

---

## 5. Alerting Rules and Notification Setup

### 5.1 Enhanced Alerting Rules

Update `monitoring/alert_rules.yml` with comprehensive business-aware alerting:

```yaml
groups:
  - name: atlas2_business_alerts
    rules:
      # Business KPI Alerts
      - alert: LowUploadSuccessRate
        expr: atlas2_kpi_upload_success_rate{time_window="1h"} < 0.95
        for: 10m
        labels:
          severity: warning
          team: product
        annotations:
          summary: "Low upload success rate detected"
          description: "Upload success rate is {{ $value | humanizePercentage }} for {{ $labels.file_type }} files"
          runbook_url: "https://docs.atlas2.com/runbooks/upload-success-rate"
          
      - alert: HighProcessingLatency
        expr: atlas2_kpi_avg_processing_time_seconds{size_bucket="large"} > 300
        for: 5m
        labels:
          severity: warning
          team: engineering
        annotations:
          summary: "High processing latency for large files"
          description: "Average processing time is {{ $value }} seconds for large files"
          
      - alert: UserEngagementDrop
        expr: rate(atlas2_business_daily_active_users[1h]) < 0.8
        for: 15m
        labels:
          severity: critical
          team: product
        annotations:
          summary: "Significant drop in user engagement"
          description: "Daily active users have dropped by 20% in the last hour"

  - name: atlas2_performance_alerts
    rules:
      # Performance Alerts
      - alert: APIResponseTimeDegradation
        expr: histogram_quantile(0.95, rate(atlas2_api_http_request_duration_seconds_bucket[5m])) > 2
        for: 3m
        labels:
          severity: warning
          team: sre
        annotations:
          summary: "API response time degradation"
          description: "95th percentile response time is {{ $value }} seconds"
          
      - alert: DatabaseConnectionPoolExhaustion
        expr: atlas2_api_db_connections_active / atlas2_api_db_connections_max > 0.9
        for: 2m
        labels:
          severity: critical
          team: database
        annotations:
          summary: "Database connection pool nearly exhausted"
          description: "Connection pool usage is {{ $value | humanizePercentage }}"

  - name: atlas2_security_alerts
    rules:
      # Security Alerts
      - alert: SuspiciousAuthenticationPattern
        expr: rate(atlas2_auth_login_attempts_total{result="failure"}[5m]) > 10
        for: 2m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "High authentication failure rate"
          description: "Authentication failure rate is {{ $value }} per second"
          
      - alert: PotentialAbusePattern
        expr: rate(atlas2_api_rate_limit_hits_total[5m]) > 5
        for: 1m
        labels:
          severity: warning
          team: security
        annotations:
          summary: "Potential abuse pattern detected"
          description: "Rate limit hits are {{ $value }} per second"
```

### 5.2 Notification Channels Configuration

```yaml
# alertmanager.yml
global:
  smtp_smarthost: 'smtp.gmail.com:587'
  smtp_from: 'alerts@atlas2.com'

route:
  group_by: ['alertname', 'team']
  group_wait: 10s
  group_interval: 10s
  repeat_interval: 1h
  receiver: 'default'
  routes:
    - match:
        team: sre
      receiver: 'sre-team'
    - match:
        team: product
      receiver: 'product-team'
    - match:
        team: security
      receiver: 'security-team'
    - match:
        severity: critical
      receiver: 'critical-alerts'

receivers:
  - name: 'default'
    email_configs:
      - to: 'devops@atlas2.com'
        
  - name: 'sre-team'
    email_configs:
      - to: 'sre@atlas2.com'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#sre-alerts'
        
  - name: 'product-team'
    email_configs:
      - to: 'product@atlas2.com'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#product-alerts'
        
  - name: 'security-team'
    email_configs:
      - to: 'security@atlas2.com'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#security-alerts'
        
  - name: 'critical-alerts'
    email_configs:
      - to: 'oncall@atlas2.com'
    slack_configs:
      - api_url: 'https://hooks.slack.com/services/...'
        channel: '#critical-alerts'
    webhook_configs:
      - url: 'https://api.pagerduty.com/integration/...'
```

---

## 6. Grafana Dashboard Configurations

### 6.1 Business Overview Dashboard

Create `monitoring/grafana/dashboards/business-overview.json`:

```json
{
  "dashboard": {
    "title": "Atlas2 Business Overview",
    "tags": ["atlas2", "business"],
    "timezone": "browser",
    "panels": [
      {
        "title": "Daily Active Users",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_business_daily_active_users",
            "legendFormat": "{{user_type}}"
          }
        ],
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0}
      },
      {
        "title": "Upload Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_kpi_upload_success_rate{time_window=\"24h\"}",
            "legendFormat": "{{file_type}}"
          }
        ],
        "gridPos": {"h": 8, "w": 6, "x": 6, "y": 0}
      },
      {
        "title": "Processing Throughput",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(atlas2_worker_jobs_processed_total{result=\"success\"}[5m])",
            "legendFormat": "Jobs/sec"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "title": "User Engagement Trends",
        "type": "graph",
        "targets": [
          {
            "expr": "atlas2_business_user_retention_rate",
            "legendFormat": "{{period}} retention"
          }
        ],
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8}
      }
    ]
  }
}
```

### 6.2 Application Performance Dashboard

Create `monitoring/grafana/dashboards/application-performance.json`:

```json
{
  "dashboard": {
    "title": "Atlas2 Application Performance",
    "tags": ["atlas2", "performance"],
    "panels": [
      {
        "title": "API Response Time",
        "type": "graph",
        "targets": [
          {
            "expr": "histogram_quantile(0.95, rate(atlas2_api_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "95th percentile"
          },
          {
            "expr": "histogram_quantile(0.50, rate(atlas2_api_http_request_duration_seconds_bucket[5m]))",
            "legendFormat": "50th percentile"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(atlas2_api_http_requests_total{status_code=~\"5..\"}[5m]) / rate(atlas2_api_http_requests_total[5m])",
            "legendFormat": "5xx Error Rate"
          }
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "title": "Database Performance",
        "type": "graph",
        "targets": [
          {
            "expr": "atlas2_api_db_connections_active",
            "legendFormat": "Active Connections"
          },
          {
            "expr": "rate(atlas2_api_db_query_duration_seconds_sum[5m]) / rate(atlas2_api_db_query_duration_seconds_count[5m])",
            "legendFormat": "Avg Query Time"
          }
        ],
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 8}
      }
    ]
  }
}
```

### 6.3 Upload Processing Dashboard

Create `monitoring/grafana/dashboards/upload-processing.json`:

```json
{
  "dashboard": {
    "title": "Atlas2 Upload Processing",
    "tags": ["atlas2", "uploads"],
    "panels": [
      {
        "title": "Upload Flow Status",
        "type": "piechart",
        "targets": [
          {
            "expr": "sum by (status) (atlas2_upload_flow_initiated_total)",
            "legendFormat": "{{status}}"
          }
        ],
        "gridPos": {"h": 8, "w": 8, "x": 0, "y": 0}
      },
      {
        "title": "Processing Time Distribution",
        "type": "heatmap",
        "targets": [
          {
            "expr": "rate(atlas2_upload_flow_duration_seconds_bucket[5m])",
            "legendFormat": "{{le}}"
          }
        ],
        "gridPos": {"h": 8, "w": 8, "x": 8, "y": 0}
      },
      {
        "title": "Queue Depth",
        "type": "stat",
        "targets": [
          {
            "expr": "atlas2_worker_queue_depth",
            "legendFormat": "{{queue_name}}"
          }
        ],
        "gridPos": {"h": 8, "w": 8, "x": 16, "y": 0}
      }
    ]
  }
}
```

---

## 7. Log Aggregation and Correlation

### 7.1 Structured Logging Implementation

#### 7.1.1 API Service Logging

```typescript
// api/src/logger.ts
import winston from 'winston';
import { trace } from '@opentelemetry/api';

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: {
    service: 'atlas2-api',
    version: process.env.APP_VERSION,
  },
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
  ],
});

// Add trace correlation
export const logWithContext = (message: string, meta: any = {}) => {
  const span = trace.getActiveSpan();
  const traceId = span?.spanContext().traceId;
  const spanId = span?.spanContext().spanId;
  
  logger.info(message, {
    ...meta,
    trace_id: traceId,
    span_id: spanId,
  });
};
```

#### 7.1.2 Request Logging Middleware

```typescript
// api/src/middleware/request-logging.ts
import { Request, Response, NextFunction } from 'express';
import { logWithContext } from '../logger';

export const requestLogger = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    
    logWithContext('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      user_agent: req.get('User-Agent'),
      ip: req.ip,
      user_id: req.user?.id,
    });
  });
  
  next();
};
```

### 7.2 Loki Configuration

Update `monitoring/loki.yml`:

```yaml
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

### 7.3 Promtail Configuration

Update `monitoring/promtail.yml`:

```yaml
server:
  http_listen_port: 9080
  grpc_listen_port: 0

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: atlas2-api
    static_configs:
      - targets:
          - localhost
        labels:
          job: atlas2-api
          __path__: /var/log/atlas2/api/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            service: service
            trace_id: trace_id
            span_id: span_id
            message: message
      - labels:
          level:
          service:
          trace_id:
          span_id:
      - output:
          source: message

  - job_name: atlas2-worker
    static_configs:
      - targets:
          - localhost
        labels:
          job: atlas2-worker
          __path__: /var/log/atlas2/worker/*.log
    pipeline_stages:
      - json:
          expressions:
            level: level
            service: service
            trace_id: trace_id
            span_id: span_id
            message: message
      - labels:
          level:
          service:
          trace_id:
          span_id:
      - output:
          source: message
```

---

## 8. Distributed Tracing Implementation

### 8.1 Jaeger Configuration

Create `monitoring/jaeger.yml`:

```yaml
# docker-compose.jaeger.yml
version: '3.8'

services:
  jaeger:
    image: jaegertracing/all-in-one:latest
    ports:
      - "16686:16686"
      - "14268:14268"
      - "14250:14250"
    environment:
      - COLLECTOR_OTLP_ENABLED=true
    networks:
      - monitoring

  otel-collector:
    image: otel/opentelemetry-collector-contrib:latest
    command: ["--config=/etc/otel-collector-config.yaml"]
    volumes:
      - ./otel-collector-config.yaml:/etc/otel-collector-config.yaml
    ports:
      - "4317:4317"
      - "4318:4318"
    depends_on:
      - jaeger
    networks:
      - monitoring

networks:
  monitoring:
    external: true
```

### 8.2 OpenTelemetry Collector Configuration

Create `monitoring/otel-collector-config.yaml`:

```yaml
receivers:
  otlp:
    protocols:
      grpc:
        endpoint: 0.0.0.0:4317
      http:
        endpoint: 0.0.0.0:4318

processors:
  batch:
  memory_limiter:
    limit_mib: 512

exporters:
  jaeger:
    endpoint: jaeger:14250
    tls:
      insecure: true

service:
  pipelines:
    traces:
      receivers: [otlp]
      processors: [memory_limiter, batch]
      exporters: [jaeger]
```

### 8.3 Trace Propagation

#### 8.3.1 API-to-Worker Trace Propagation

```typescript
// api/src/services/queue.service.ts
import { trace, context, propagation } from '@opentelemetry/api';

export class QueueService {
  async enqueueJob(jobData: any) {
    const span = trace.getActiveSpan();
    const carrier = {};
    
    // Inject trace context for propagation
    propagation.inject(context.active(), carrier);
    
    // Add trace context to job data
    const jobWithTrace = {
      ...jobData,
      traceContext: carrier,
    };
    
    // Enqueue job with trace context
    await this.queue.add('csv-processing', jobWithTrace);
  }
}

// worker/src/job-processor.ts
import { trace, context, propagation } from '@opentelemetry/api';

export const processJob = async (job: any) => {
  const { traceContext, ...jobData } = job.data;
  
  // Extract trace context
  const ctx = propagation.extract(context.active(), traceContext);
  
  return trace.getTracer('atlas2-worker').startActiveSpan(
    'process-csv-job',
    { ctx },
    async (span) => {
      try {
        span.setAttributes({
          'job.id': jobData.id,
          'job.type': 'csv-processing',
        });
        
        // Process the job
        const result = await csvProcessor.process(jobData);
        
        span.setStatus({ code: SpanStatusCode.OK });
        return result;
      } catch (error) {
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error.message,
        });
        throw error;
      }
    }
  );
};
```

---

## 9. Monitoring as Code (IaC) Setup

### 9.1 Terraform Configuration

Create `infrastructure/monitoring/main.tf`:

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    prometheus = {
      source  = "prometheus/prometheus"
      version = "~> 0.7"
    }
    grafana = {
      source  = "grafana/grafana"
      version = "~> 1.40"
    }
  }
}

provider "prometheus" {
  alias = "cloud"
}

provider "grafana" {
  alias = "cloud"
}

# Prometheus Configuration
resource "prometheus_rule_group" "atlas2_alerts" {
  name = "atlas2_alerts"
  rules = [
    {
      alert = "HighErrorRate"
      expr  = "rate(atlas2_api_http_requests_total{status_code=~\"5..\"}[5m]) > 0.1"
      for   = "2m"
      labels = {
        severity = "warning"
        team     = "sre"
      }
      annotations = {
        summary     = "High error rate detected"
        description = "Error rate is {{ $value }} errors per second"
      }
    }
  ]
}

# Grafana Dashboards
resource "grafana_dashboard" "business_overview" {
  config_json = file("${path.module}/dashboards/business-overview.json")
}

resource "grafana_dashboard" "application_performance" {
  config_json = file("${path.module}/dashboards/application-performance.json")
}

resource "grafana_dashboard" "upload_processing" {
  config_json = file("${path.module}/dashboards/upload-processing.json")
}

# Notification Channels
resource "grafana_notification_channel" "slack" {
  name     = "Slack"
  type     = "slack"
  settings = {
    url     = var.slack_webhook_url
    channel = "#alerts"
  }
}
```

### 9.2 Docker Compose Monitoring Stack

Update `docker-compose.monitoring.yml`:

```yaml
version: '3.8'

services:
  prometheus:
    image: prom/prometheus:latest
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - ./monitoring/alert_rules.yml:/etc/prometheus/alert_rules.yml
      - prometheus_data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    networks:
      - monitoring

  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    networks:
      - monitoring

  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    networks:
      - monitoring

  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    networks:
      - monitoring

  promtail:
    image: grafana/promtail:latest
    ports:
      - "9080:9080"
    volumes:
      - ./monitoring/promtail.yml:/etc/promtail/config.yml
      - /var/log:/var/log:ro
    command: -config.file=/etc/promtail/config.yml
    networks:
      - monitoring

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - "9100:9100"
    volumes:
      - /proc:/host/proc:ro
      - /sys:/host/sys:ro
      - /:/rootfs:ro
    command:
      - '--path.procfs=/host/proc'
      - '--path.rootfs=/rootfs'
      - '--path.sysfs=/host/sys'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    networks:
      - monitoring

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:

networks:
  monitoring:
    driver: bridge
```

---

## 10. Implementation Roadmap

### 10.1 Phase 1: Foundation (Week 1-2)

**Priority: Critical**

- [ ] Enhance API service metrics with business KPIs
- [ ] Implement structured logging with trace correlation
- [ ] Set up OpenTelemetry instrumentation for API service
- [ ] Configure basic Grafana dashboards
- [ ] Implement enhanced alerting rules

**Deliverables:**
- Enhanced metrics collection
- Structured logging implementation
- Basic tracing setup
- Initial dashboards

### 10.2 Phase 2: Worker Service (Week 3)

**Priority: High**

- [ ] Implement worker service metrics
- [ ] Add OpenTelemetry instrumentation to worker
- [ ] Implement trace propagation between API and worker
- [ ] Create upload processing specific dashboards
- [ ] Set up job queue monitoring

**Deliverables:**
- Worker service instrumentation
- End-to-end tracing
- Upload processing dashboards

### 10.3 Phase 3: Frontend Monitoring (Week 4)

**Priority: Medium**

- [ ] Implement frontend performance metrics
- [ ] Add browser tracing
- [ ] Create user experience dashboards
- [ ] Implement error tracking
- [ ] Set up real user monitoring (RUM)

**Deliverables:**
- Frontend instrumentation
- User experience dashboards
- Error tracking system

### 10.4 Phase 4: Advanced Features (Week 5-6)

**Priority: Medium**

- [ ] Implement distributed tracing across all services
- [ ] Set up log aggregation with Loki
- [ ] Create correlation between logs, metrics, and traces
- [ ] Implement monitoring as code
- [ ] Set up automated testing for monitoring

**Deliverables:**
- Complete observability stack
- Infrastructure as code
- Automated monitoring validation

---

## 11. Testing and Validation

### 11.1 Metrics Validation

```bash
# Test metrics endpoint
curl http://localhost:3001/metrics

# Verify specific metrics
curl -s http://localhost:3001/metrics | grep atlas2_api_http_requests_total

# Test Prometheus scraping
curl http://localhost:9090/api/v1/query?query=up
```

### 11.2 Tracing Validation

```bash
# Test trace generation
curl -H "traceparent: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01" \
     http://localhost:3001/api/upload

# Verify traces in Jaeger
curl http://localhost:16686/api/traces?service=atlas2-api
```

### 11.3 Alerting Validation

```bash
# Test alert rules
curl -X POST http://localhost:9093/api/v1/alerts \
  -H "Content-Type: application/json" \
  -d '[{
    "labels": {
      "alertname": "TestAlert",
      "severity": "warning"
    },
    "annotations": {
      "description": "This is a test alert"
    }
  }]'
```

---

## 12. Operational Guidelines

### 12.1 Monitoring Best Practices

1. **Metric Naming**: Use consistent naming conventions
2. **Label Cardinality**: Keep label cardinality low to avoid performance issues
3. **Retention Policies**: Set appropriate retention periods for different data types
4. **Alert Fatigue**: Regularly review and tune alert thresholds
5. **Documentation**: Maintain runbooks for common issues

### 12.2 Incident Response

1. **Triage**: Use dashboards to quickly assess impact
2. **Correlation**: Link alerts to traces and logs
3. **Communication**: Use automated notifications for team coordination
4. **Post-mortem**: Document incidents and improve monitoring

### 12.3 Performance Considerations

1. **Sampling**: Use appropriate sampling rates for tracing
2. **Aggregation**: Pre-aggregate metrics where possible
3. **Storage**: Monitor storage usage and implement retention policies
4. **Network**: Optimize data transfer between components

---

## 13. Security Considerations

### 13.1 Data Protection

- **PII Redaction**: Ensure no sensitive data in logs/metrics
- **Access Control**: Implement RBAC for monitoring systems
- **Encryption**: Encrypt data in transit and at rest
- **Audit Logging**: Log access to monitoring systems

### 13.2 Network Security

- **Firewall Rules**: Restrict access to monitoring endpoints
- **Authentication**: Use authentication for monitoring APIs
- **Network Segmentation**: Isolate monitoring infrastructure
- **VPN Access**: Require VPN for external access

---

## 14. Troubleshooting Guide

### 14.1 Common Issues

**Metrics Not Appearing:**
1. Check Prometheus configuration
2. Verify metrics endpoint accessibility
3. Check service discovery
4. Review network connectivity

**High Alert Volume:**
1. Review alert thresholds
2. Check for alerting loops
3. Verify notification channel configuration
4. Analyze alert patterns

**Performance Issues:**
1. Check metric cardinality
2. Review query performance
3. Monitor system resources
4. Optimize dashboard queries

### 14.2 Debug Commands

```bash
# Check Prometheus targets
curl http://localhost:9090/api/v1/targets

# Query specific metrics
curl -G http://localhost:9090/api/v1/query \
  --data-urlencode 'query=atlas2_api_http_requests_total'

# Check alert rules
curl http://localhost:9090/api/v1/rules

# Verify Grafana data sources
curl -u admin:admin http://localhost:3000/api/datasources
```

---

## 15. Success Metrics

### 15.1 Technical KPIs

- **MTTR**: Reduce mean time to resolution by 50%
- **Alert Accuracy**: Achieve 95% alert accuracy
- **Coverage**: Monitor 100% of critical services
- **Performance**: Maintain <100ms dashboard load times

### 15.2 Business KPIs

- **User Experience**: Improve user satisfaction scores
- **System Reliability**: Achieve 99.9% uptime
- **Issue Detection**: Detect 90% of issues before user impact
- **Operational Efficiency**: Reduce manual monitoring effort by 80%

---

## Conclusion

This comprehensive monitoring implementation will provide Atlas2 with complete observability across all layers of the application stack. The combination of metrics, traces, and logs will enable rapid issue detection, improved user experience, and data-driven decision making.

The phased approach ensures minimal disruption while delivering immediate value. The monitoring as code approach ensures consistency and maintainability as the system evolves.

Regular reviews and updates to the monitoring configuration will ensure continued relevance and effectiveness as the application and business requirements evolve.

---

**Next Steps:**
1. Review and approve this implementation plan
2. Assign resources for Phase 1 implementation
3. Set up development environment for testing
4. Begin Phase 1 implementation
5. Schedule regular progress reviews

**Contact:**
- Technical Lead: [Name]
- DevOps Team: [Email]
- SRE Team: [Email]