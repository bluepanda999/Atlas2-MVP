# Monitoring and Observability Setup Guide

This guide covers the complete setup and configuration of the Atlas2 monitoring and observability system.

## Overview

The Atlas2 monitoring system provides comprehensive observability through:

- **Metrics Collection**: Prometheus-based metrics for API performance, system health, and business metrics
- **Health Monitoring**: Multi-level health checks for services and dependencies
- **Alerting**: Intelligent alerting with multiple notification channels
- **Structured Logging**: Centralized logging with search and filtering capabilities
- **Performance Monitoring**: Request tracking and performance analysis
- **Error Tracking**: Comprehensive error aggregation and analysis
- **Dashboarding**: Grafana dashboards for visualization

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Atlas2 API    │    │   Atlas2 Worker  │    │   Web Frontend  │
│                 │    │                  │    │                 │
│ • Metrics       │    │ • Metrics        │    │ • Browser       │
│ • Health        │    │ • Health         │    │   Metrics       │
│ • Logs          │    │ • Logs           │    │ • Performance   │
│ • Errors        │    │ • Errors         │    │   Monitoring    │
└─────────┬───────┘    └─────────┬────────┘    └─────────┬───────┘
          │                      │                       │
          └──────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      Prometheus          │
                    │                           │
                    │ • Metrics Collection     │
                    │ • Alert Evaluation       │
                    │ • Data Storage           │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │        Grafana           │
                    │                           │
                    │ • Dashboards             │
                    │ • Visualization         │
                    │ • Alerting              │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │   Alert Manager          │
                    │                           │
                    │ • Email Notifications    │
                    │ • Slack Integration      │
                    │ • PagerDuty              │
                    └───────────────────────────┘
```

## Installation and Setup

### 1. Environment Configuration

Create a `.env.monitoring` file with the following configuration:

```bash
# General Monitoring
MONITORING_ENABLED=true
SERVICE_NAME=atlas2-api
NODE_ENV=production

# Metrics Configuration
METRICS_ENABLED=true
METRICS_PORT=9090
METRICS_PATH=/monitoring/metrics
METRICS_COLLECT_DEFAULT=true
METRICS_COLLECT_INTERVAL=30000

# Health Check Configuration
HEALTH_ENABLED=true
HEALTH_PATH=/monitoring/health
HEALTH_DETAILED_PATH=/monitoring/health/detailed
HEALTH_LIVENESS_PATH=/monitoring/health/live
HEALTH_READINESS_PATH=/monitoring/health/ready

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_STRUCTURED=true
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/app.log
LOG_FILE_MAX_SIZE=10MB
LOG_FILE_MAX_FILES=5
LOG_FILE_ROTATION=daily
LOG_CONSOLE_ENABLED=true
LOG_CONSOLE_COLORIZE=false

# Alerting Configuration
ALERTING_ENABLED=true
ALERTING_EVALUATION_INTERVAL=30000
ALERTING_DEFAULT_RULES=true

# Email Notifications
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_RECIPIENTS=admin@example.com,devops@example.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=alerts@company.com
SMTP_PASS=your-app-password

# Slack Notifications
SLACK_ENABLED=true
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/SLACK/WEBHOOK
SLACK_CHANNEL=#alerts

# PagerDuty Notifications
PAGERDUTY_ENABLED=true
PAGERDUTY_INTEGRATION_KEY=your-integration-key

# Performance Monitoring
PERFORMANCE_MONITORING_ENABLED=true
SLOW_REQUEST_THRESHOLD=1000
PERFORMANCE_MEMORY_TRACKING=true
PERFORMANCE_DETAILED_LOGGING=false
PERFORMANCE_SAMPLE_RATE=1.0
PERFORMANCE_EXCLUDE_PATHS=/health,/favicon.ico

# Error Tracking
ERROR_TRACKING_ENABLED=true
ERROR_TRACKING_MAX_ERRORS=10000
ERROR_TRACKING_IGNORED=ECONNRESET,ETIMEDOUT
ERROR_TRACKING_NOTIFY_CRITICAL=true

# Distributed Tracing (Optional)
TRACING_ENABLED=false
JAEGER_ENDPOINT=http://jaeger:14268/api/traces
JAEGER_SERVICE_NAME=atlas2-api
ZIPKIN_URL=http://zipkin:9411/api/v2/spans
ZIPKIN_SERVICE_NAME=atlas2-api
```

### 2. Docker Compose Setup

Update your `docker-compose.yml` to include monitoring services:

```yaml
version: '3.8'

services:
  # Existing services...
  atlas2-api:
    build: .
    ports:
      - "3001:3001"
    environment:
      - NODE_ENV=production
    env_file:
      - .env.monitoring
    volumes:
      - ./logs:/app/logs
    depends_on:
      - prometheus
      - grafana

  # Prometheus
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
      - '--storage.tsdb.retention.time=30d'
      - '--web.enable-lifecycle'
    restart: unless-stopped

  # Grafana
  grafana:
    image: grafana/grafana:latest
    ports:
      - "3000:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
      - ./monitoring/grafana/datasources:/etc/grafana/provisioning/datasources
    restart: unless-stopped

  # Alert Manager
  alertmanager:
    image: prom/alertmanager:latest
    ports:
      - "9093:9093"
    volumes:
      - ./monitoring/alertmanager.yml:/etc/alertmanager/alertmanager.yml
      - alertmanager_data:/alertmanager
    restart: unless-stopped

  # Node Exporter (System Metrics)
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
    restart: unless-stopped

  # Loki (Log Aggregation)
  loki:
    image: grafana/loki:latest
    ports:
      - "3100:3100"
    volumes:
      - ./monitoring/loki.yml:/etc/loki/local-config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/local-config.yaml
    restart: unless-stopped

  # Promtail (Log Collection)
  promtail:
    image: grafana/promtail:latest
    volumes:
      - ./monitoring/promtail.yml:/etc/promtail/config.yml
      - ./logs:/var/log/app
      - /var/log:/var/log/host:ro
    command: -config.file=/etc/promtail/config.yml
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
  alertmanager_data:
  loki_data:
```

### 3. Application Integration

Add the monitoring module to your application:

```typescript
// app.module.ts
import { Module, MiddlewareConsumer, NestModule } from '@nestjs/common';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { PerformanceMiddleware } from './api/middleware/performance.middleware';
import { ErrorTrackingMiddleware } from './api/middleware/error-tracking.middleware';
import { GlobalErrorFilter } from './api/middleware/error-tracking.middleware';

@Module({
  imports: [
    // ... other modules
    MonitoringModule,
  ],
  // ...
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(PerformanceMiddleware)
      .forRoutes('*');
      
    consumer
      .apply(ErrorTrackingMiddleware)
      .forRoutes('*');
  }
}

// main.ts
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ErrorTrackingService } from './api/services/error-tracking.service';
import { GlobalErrorFilter } from './api/middleware/error-tracking.middleware';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global error filter
  const errorTrackingService = app.get(ErrorTrackingService);
  app.useGlobalFilters(new GlobalErrorFilter(errorTrackingService));

  // Validation pipe
  app.useGlobalPipes(new ValidationPipe());

  await app.listen(3001);
}
bootstrap();
```

## Configuration Details

### Metrics Configuration

The system collects the following metrics:

#### API Metrics
- `http_requests_total`: Total HTTP requests by method, route, and status
- `http_request_duration_seconds`: Request duration histogram
- `http_request_size_bytes`: Request size histogram
- `http_response_size_bytes`: Response size histogram

#### Authentication Metrics
- `auth_attempts_total`: Authentication attempts
- `auth_successes_total`: Successful authentications
- `auth_failures_total`: Failed authentications
- `auth_duration_seconds`: Authentication duration

#### Upload Metrics
- `upload_attempts_total`: Upload attempts
- `upload_successes_total`: Successful uploads
- `upload_failures_total`: Failed uploads
- `upload_duration_seconds`: Upload duration
- `upload_size_bytes`: Upload file sizes
- `active_uploads`: Currently active uploads

#### Database Metrics
- `db_connections_active`: Active database connections
- `db_query_duration_seconds`: Database query duration
- `db_query_errors_total`: Database query errors

#### System Metrics
- `memory_usage_bytes`: Memory usage by type
- `cpu_usage_percent`: CPU usage percentage
- `disk_usage_bytes`: Disk usage by mount point

### Health Checks

The system provides multiple health check endpoints:

#### Basic Health Check
```
GET /monitoring/health
```

Returns overall system status with individual component checks.

#### Liveness Probe
```
GET /monitoring/health/live
```

Simple check if the service is running (for Kubernetes liveness).

#### Readiness Probe
```
GET /monitoring/health/ready
```

Check if the service is ready to handle requests (for Kubernetes readiness).

#### Detailed Health
```
GET /monitoring/health/detailed
```

Comprehensive health information including system metrics.

### Alerting Rules

Default alerting rules include:

#### High Error Rate
- **Condition**: Error rate > 5% over 5 minutes
- **Severity**: Warning
- **Notification**: Email

#### High Memory Usage
- **Condition**: Memory usage > 90%
- **Severity**: Critical
- **Notification**: Email, Slack, PagerDuty

#### High Response Time
- **Condition**: 95th percentile response time > 2 seconds
- **Severity**: Warning
- **Notification**: Email

#### Database Connection Failure
- **Condition**: Database health check fails
- **Severity**: Critical
- **Notification**: Email, Slack, PagerDuty

#### High Upload Failure Rate
- **Condition**: Upload failure rate > 20% over 10 minutes
- **Severity**: Warning
- **Notification**: Email

### Logging Configuration

#### Structured Logging Format
```json
{
  "timestamp": "2023-12-07T10:30:00.000Z",
  "level": "info",
  "message": "HTTP request completed",
  "context": "PerformanceMiddleware",
  "traceId": "abc123",
  "userId": "user456",
  "requestId": "req789",
  "metadata": {
    "method": "POST",
    "url": "/api/upload",
    "statusCode": 200,
    "duration": "150ms"
  },
  "service": "atlas2-api",
  "version": "1.0.0",
  "environment": "production"
}
```

#### Log Levels
- **error**: Error conditions that may cause the application to fail
- **warn**: Warning conditions that should be investigated
- **info**: Informational messages about normal operation
- **debug**: Detailed debugging information

## Monitoring Endpoints

### Metrics Endpoint
```
GET /monitoring/metrics
```
Returns Prometheus-formatted metrics.

### Health Endpoints
```
GET /monitoring/health          # Basic health
GET /monitoring/health/live     # Liveness probe
GET /monitoring/health/ready    # Readiness probe
GET /monitoring/health/detailed # Detailed health
```

### Alerting Endpoints
```
GET /monitoring/alerts          # Get active alerts
GET /monitoring/alerts/rules    # Get alert rules
```

### Logging Endpoints
```
GET /monitoring/logs            # Get system logs
```

### Performance Endpoints
```
GET /monitoring/performance     # Get performance metrics
GET /monitoring/status          # Get system status overview
```

## Grafana Dashboards

### Overview Dashboard
- Service status indicators
- Request rate and response time
- Error rates
- Resource usage
- Active uploads

### Detailed Dashboards
- **API Performance**: Request metrics, response times, error rates
- **System Metrics**: CPU, memory, disk usage
- **Database Performance**: Connection pool, query performance
- **Upload Metrics**: Upload rates, success/failure rates, file sizes
- **Authentication Metrics**: Auth attempts, success/failure rates

## Best Practices

### 1. Performance Monitoring
- Monitor response time percentiles (50th, 95th, 99th)
- Track error rates by endpoint
- Monitor resource utilization trends
- Set up alerts for performance degradation

### 2. Error Tracking
- Track error patterns and frequencies
- Monitor error rates by user and endpoint
- Set up alerts for critical errors
- Regular error review and resolution

### 3. Log Management
- Use structured logging for better searchability
- Include correlation IDs for request tracing
- Monitor log volumes and patterns
- Set up log retention policies

### 4. Alert Management
- Use meaningful alert names and descriptions
- Set appropriate severity levels
- Configure notification channels based on severity
- Regular alert rule review and tuning

### 5. Dashboard Maintenance
- Keep dashboards focused and relevant
- Use consistent naming conventions
- Include important annotations
- Regular dashboard review and updates

## Troubleshooting

### Common Issues

#### Metrics Not Appearing
1. Check if metrics endpoint is accessible
2. Verify Prometheus configuration
3. Check service discovery settings
4. Review metric collection logs

#### Health Checks Failing
1. Check database connectivity
2. Verify external service dependencies
3. Review health check configuration
4. Check resource constraints

#### Alert Not Firing
1. Verify alert rule configuration
2. Check evaluation interval
3. Review threshold settings
4. Test notification channels

#### High Memory Usage
1. Check for memory leaks
2. Review garbage collection settings
3. Monitor connection pools
4. Analyze heap dumps

### Performance Tuning

#### Metrics Collection
- Adjust scrape intervals based on requirements
- Use metric relabeling to reduce cardinality
- Implement metric retention policies
- Monitor Prometheus performance

#### Logging Performance
- Use appropriate log levels
- Implement log sampling for high-volume scenarios
- Optimize log rotation settings
- Monitor disk usage

#### Alert Performance
- Optimize alert rule evaluation
- Use appropriate evaluation intervals
- Implement alert grouping
- Monitor alert manager performance

## Security Considerations

### 1. Endpoint Security
- Protect monitoring endpoints with authentication
- Use HTTPS for all monitoring communications
- Implement rate limiting for metrics endpoints
- Restrict access to sensitive metrics

### 2. Data Protection
- Sanitize logs to remove sensitive information
- Use secure storage for monitoring data
- Implement data retention policies
- Encrypt monitoring data in transit and at rest

### 3. Access Control
- Implement role-based access control for dashboards
- Use separate credentials for monitoring systems
- Regularly review access permissions
- Audit monitoring system access

## Scaling Considerations

### 1. High Availability
- Deploy monitoring components in HA mode
- Use load balancers for monitoring endpoints
- Implement failover mechanisms
- Monitor monitoring system health

### 2. Performance Scaling
- Horizontal scaling of Prometheus
- Implement federation for large deployments
- Use remote storage for long-term retention
- Optimize query performance

### 3. Storage Management
- Implement data retention policies
- Use appropriate storage tiers
- Monitor storage usage
- Plan for capacity growth

This comprehensive monitoring setup provides complete observability for the Atlas2 application, enabling proactive issue detection, performance optimization, and reliable operation in production environments.