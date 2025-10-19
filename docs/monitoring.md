# Atlas2 Monitoring Guide

## Overview

Atlas2 includes a comprehensive monitoring stack built on industry-standard tools:

- **Prometheus**: Metrics collection and storage
- **Grafana**: Visualization and dashboards
- **Loki**: Log aggregation
- **Promtail**: Log collection agent
- **Node Exporter**: System metrics

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Atlas2 API    │    │  Atlas2 Worker  │    │     Nginx       │
│                 │    │                 │    │                 │
│  Winston Logs   │    │  Winston Logs   │    │  Access Logs    │
│  Prometheus     │    │  Prometheus     │    │                 │
│  Metrics        │    │  Metrics        │    │                 │
└─────────┬───────┘    └─────────┬───────┘    └─────────┬───────┘
          │                      │                      │
          └──────────────────────┼──────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │         Promtail          │
                    │   (Log Collection Agent)  │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │           Loki            │
                    │     (Log Aggregation)     │
                    └─────────────┬─────────────┘
                                 │
┌─────────────────┐    ┌─────────▼──────────┐    ┌─────────────────┐
│   Prometheus    │    │      Grafana       │    │  Node Exporter  │
│                 │    │                   │    │                 │
│  Metrics Store  │◄───┤  Visualization    │───►│  System Metrics │
│  Alert Rules    │    │  Dashboards       │    │                 │
└─────────────────┘    └───────────────────┘    └─────────────────┘
```

## Quick Start

### 1. Start Monitoring Stack

```bash
# Run the setup script first
./scripts/setup-monitoring.sh

# Start all monitoring services
./scripts/start-monitoring.sh
```

### 2. Access Services

- **Grafana**: http://localhost:3002 (admin/admin123)
- **Prometheus**: http://localhost:9090
- **Loki**: http://localhost:3100

### 3. Check Health

```bash
./scripts/monitoring-health.sh
```

## Components

### Prometheus

**Configuration**: `monitoring/prometheus.yml`

**Metrics Collected**:
- HTTP request rates and latency
- Worker job queue metrics
- Database connection pools
- System resources (via Node Exporter)
- Custom application metrics

**Key Endpoints**:
- Metrics: http://localhost:9090/metrics
- Targets: http://localhost:9090/targets
- Alerts: http://localhost:9090/alerts

### Grafana

**Configuration**: `monitoring/grafana/`

**Available Dashboards**:
- **Atlas2 Overview**: System-wide metrics and health
- **API Performance**: Request rates, latency, errors
- **Worker Metrics**: Job processing, queue status
- **Database**: Connection pools, query performance
- **System**: CPU, memory, disk, network

**Custom Dashboards**:
- Import dashboards from `monitoring/grafana/dashboards/`
- Use Prometheus data source
- Template variables for filtering

### Loki

**Configuration**: `monitoring/loki.yml`

**Log Sources**:
- Application logs (API, Worker)
- Nginx access/error logs
- System logs

**Log Levels**:
- ERROR: Critical errors requiring immediate attention
- WARN: Warning conditions that should be investigated
- INFO: General information about application state
- DEBUG: Detailed debugging information

### Promtail

**Configuration**: `monitoring/promtail.yml`

**Pipeline Stages**:
- JSON parsing for structured logs
- Timestamp extraction
- Label enrichment
- Field extraction

## Metrics Reference

### Application Metrics

#### HTTP Metrics
```promql
# Request rate by endpoint
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status=~"5.."}[5m])

# Response time percentiles
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

#### Worker Metrics
```promql
# Active jobs in queue
bullmq_active_jobs

# Job processing rate
rate(bullmq_completed_jobs_total[5m])

# Job failure rate
rate(bullmq_failed_jobs_total[5m])
```

#### Database Metrics
```promql
# Connection usage
pg_stat_database_numbackends / pg_settings_max_connections

# Query performance
rate(pg_stat_statements_mean_time_seconds[5m])
```

### System Metrics

#### CPU and Memory
```promql
# CPU usage
100 - (avg by(instance) (rate(node_cpu_seconds_total{mode="idle"}[5m])) * 100)

# Memory usage
(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100

# Disk usage
(1 - (node_filesystem_avail_bytes / node_filesystem_size_bytes)) * 100
```

## Alerting

### Alert Rules

**Configuration**: `monitoring/alert_rules.yml`

**Critical Alerts**:
- Service down (API, Worker, Database, Redis)
- High error rates (>10%)
- Disk space low (>90%)

**Warning Alerts**:
- High latency (>1s)
- High resource usage (>80%)
- Job queue backlog

### Alert Channels

Configure in Grafana:
1. Go to Alerting → Notification Channels
2. Add channels (Email, Slack, PagerDuty, etc.)
3. Link alert rules to channels

## Log Management

### Log Formats

#### Application Logs (JSON)
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Request processed successfully",
  "service": "atlas2-api",
  "request_id": "req_123456",
  "user_id": "user_789",
  "method": "POST",
  "path": "/api/upload",
  "status": 200,
  "duration": 150
}
```

#### Worker Logs
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "level": "info",
  "message": "CSV processing job completed",
  "service": "atlas2-worker",
  "job_id": "job_456789",
  "job_type": "csv-processing",
  "file_id": "file_123",
  "records_processed": 1000,
  "duration": 5000
}
```

### Log Queries in Grafana

**Basic Queries**:
```
{job="atlas2-api"} |= "error"
{job="atlas2-worker"} |= "csv-processing"
{job="atlas2-nginx"} |~ "5[0-9][0-9]"
```

**Advanced Queries**:
```
{job="atlas2-api"} 
  | level != "debug"
  | line_format "{{.message}}"
  | label_format service="{{.service}}"
```

## Troubleshooting

### Common Issues

#### Prometheus Not Scraping
```bash
# Check targets
curl http://localhost:9090/api/v1/targets

# Check configuration
docker exec prometheus promtool check config /etc/prometheus/prometheus.yml
```

#### Grafana Not Connecting to Prometheus
1. Verify datasource configuration
2. Check network connectivity
3. Validate Prometheus URL

#### Missing Logs
1. Check Promtail configuration
2. Verify log file paths
3. Check log file permissions

#### High Memory Usage
1. Check retention periods
2. Review log rotation settings
3. Monitor compaction

### Performance Tuning

#### Prometheus
```yaml
# Adjust retention
--storage.tsdb.retention.time=200h

# Increase memory
--storage.remote.write-concurrency=30
--storage.remote.read-concurrency=30
```

#### Loki
```yaml
# Adjust chunk settings
chunk_target_size: 1048576
chunk_idle_period: 1h
max_chunk_age: 1h
```

## Maintenance

### Daily Tasks
- Check alert status
- Review dashboards for anomalies
- Verify log collection

### Weekly Tasks
- Review and tune alert thresholds
- Check disk usage for logs/metrics
- Update dashboard configurations

### Monthly Tasks
- Archive old metrics/logs
- Review and update monitoring documentation
- Performance tuning

## Security

### Access Control
- Change default Grafana password
- Configure authentication (LDAP, OAuth)
- Use HTTPS in production

### Network Security
- Restrict access to monitoring endpoints
- Use firewall rules
- Monitor access logs

## Scaling

### High Availability
- Multiple Prometheus instances with federation
- Grafana HA with shared database
- Loki cluster for log aggregation

### Performance
- Remote storage for long-term metrics
- Log sampling for high-volume systems
- Caching for frequently accessed data

## Integration

### External Tools
- **PagerDuty**: Alert routing and escalation
- **Slack**: Notification and collaboration
- **Datadog**: Enhanced monitoring
- **New Relic**: APM integration

### APIs
- Prometheus API for custom metrics
- Grafana API for dashboard management
- Loki API for log queries

## Best Practices

1. **Label Consistency**: Use consistent labeling across metrics
2. **Alert Fatigue**: Tune alerts to reduce false positives
3. **Documentation**: Keep dashboards and alerts documented
4. **Testing**: Regularly test alerting and monitoring
5. **Backup**: Backup dashboard configurations and alert rules

## Further Reading

- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)
- [Loki Documentation](https://grafana.com/docs/loki/latest/)
- [Best Practices](https://grafana.com/docs/grafana/latest/best-practices/)