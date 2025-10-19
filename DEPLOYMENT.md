# Atlas2 Deployment Guide

This guide covers deploying Atlas2 in various environments using Docker containers.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Configuration](#environment-configuration)
- [Development Deployment](#development-deployment)
- [Production Deployment](#production-deployment)
- [Monitoring and Maintenance](#monitoring-and-maintenance)
- [Troubleshooting](#troubleshooting)
- [Scaling](#scaling)

## Prerequisites

### System Requirements
- **CPU**: 2 cores minimum (4 cores recommended)
- **Memory**: 4GB RAM minimum (8GB recommended)
- **Storage**: 20GB available space
- **OS**: Linux (Ubuntu 20.04+, CentOS 8+) or macOS 10.15+
- **Docker**: Version 20.10+
- **Docker Compose**: Version 2.0+

### Network Requirements
- Port 80 (HTTP) or 443 (HTTPS) for web access
- Port 3001 for API access (if not behind reverse proxy)
- Port 5432 for PostgreSQL (internal only)
- Port 6379 for Redis (internal only)
- Port 9090 for Prometheus (monitoring)
- Port 3001 for Grafana (monitoring)

## Environment Configuration

### 1. Clone the Repository
```bash
git clone https://github.com/your-username/atlas2.git
cd atlas2
```

### 2. Configure Environment Variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit the configuration
nano .env
```

### 3. Required Environment Variables
```env
# Application
NODE_ENV=production

# Database Security
POSTGRES_PASSWORD=your-secure-database-password
DATABASE_URL=postgresql://atlas2:your-secure-database-password@postgres:5432/atlas2

# Redis Security
REDIS_PASSWORD=your-secure-redis-password
REDIS_URL=redis://:your-secure-redis-password@redis:6379

# JWT Security
JWT_SECRET=your-jwt-secret-key-minimum-32-characters

# API Configuration
API_RATE_LIMIT=100
API_TIMEOUT=30000

# File Processing
MAX_FILE_SIZE=3221225472  # 3GB
CHUNK_SIZE=65536          # 64KB
WORKER_CONCURRENCY=4

# Monitoring
GRAFANA_PASSWORD=your-grafana-password
```

### 4. SSL Configuration (Optional but Recommended)
```bash
# Create SSL directory
mkdir -p ssl

# Place your SSL certificates
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# Update .env with SSL paths
SSL_CERT_PATH=/etc/nginx/ssl/cert.pem
SSL_KEY_PATH=/etc/nginx/ssl/key.pem
```

## Development Deployment

### Quick Start
```bash
# Start all services
docker-compose -f docker-compose.dev.yml up

# Run in background
docker-compose -f docker-compose.dev.yml up -d

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop services
docker-compose -f docker-compose.dev.yml down
```

### Development Features
- Hot reload for frontend changes
- Volume mounts for live code editing
- Debug logging enabled
- Development database with seed data

### Access Points
- **Web Application**: http://localhost:3000
- **API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api/docs

## Production Deployment

### 1. Initial Deployment
```bash
# Build and start production services
docker-compose -f docker-compose.prod.yml up -d --build

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f
```

### 2. SSL/HTTPS Setup
```bash
# Using Let's Encrypt (recommended)
certbot certonly --webroot -w /var/www/html -d your-domain.com

# Or use your own certificates
mkdir -p ssl
cp your-cert.pem ssl/cert.pem
cp your-key.pem ssl/key.pem

# Restart with SSL
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d
```

### 3. Behind Reverse Proxy
If you're using Nginx, Apache, or another reverse proxy:

```nginx
# Nginx configuration example
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    location /api {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4. Production Features
- Optimized Docker images
- Multi-replica scaling
- Health checks and monitoring
- Log aggregation
- Automatic restarts
- Security hardening

## Monitoring and Maintenance

### 1. Health Checks
```bash
# Check application health
curl http://localhost/health

# Check API health
curl http://localhost:3001/health

# Check container status
docker-compose -f docker-compose.prod.yml ps
```

### 2. Monitoring Stack
- **Grafana**: http://localhost:3001 (admin/your-grafana-password)
- **Prometheus**: http://localhost:9090
- **Application Logs**: `docker-compose logs -f atlas2-web`
- **API Logs**: `docker-compose logs -f atlas2-api`

### 3. Database Maintenance
```bash
# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U atlas2 atlas2 > backup.sql

# Restore database
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U atlas2 atlas2 < backup.sql

# Connect to database
docker-compose -f docker-compose.prod.yml exec postgres psql -U atlas2 atlas2
```

### 4. Log Management
```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f atlas2-web

# View API logs
docker-compose -f docker-compose.prod.yml logs -f atlas2-api

# View worker logs
docker-compose -f docker-compose.prod.yml logs -f atlas2-worker

# Rotate logs (add to cron)
0 2 * * * docker-compose -f /path/to/atlas2/docker-compose.prod.yml exec atlas2-web logrotate /etc/logrotate.d/atlas2
```

## Troubleshooting

### Common Issues

#### 1. Container Won't Start
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs service-name

# Check resource usage
docker stats

# Check disk space
df -h
```

#### 2. Database Connection Issues
```bash
# Check database container
docker-compose -f docker-compose.prod.yml ps postgres

# Test database connection
docker-compose -f docker-compose.prod.yml exec postgres pg_isready

# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres
```

#### 3. High Memory Usage
```bash
# Check memory usage
docker stats

# Adjust worker concurrency
# Edit .env: WORKER_CONCURRENCY=2

# Restart services
docker-compose -f docker-compose.prod.yml restart atlas2-worker
```

#### 4. Slow Performance
```bash
# Check resource limits
docker-compose -f docker-compose.prod.yml config

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale atlas2-worker=3

# Monitor performance
curl http://localhost:9090/targets
```

### Error Codes
- **404**: Service not running or incorrect port
- **500**: Application error (check logs)
- **502**: Bad gateway (API service down)
- **503**: Service unavailable (resource limits)

## Scaling

### Horizontal Scaling
```bash
# Scale API services
docker-compose -f docker-compose.prod.yml up -d --scale atlas2-api=3

# Scale worker services
docker-compose -f docker-compose.prod.yml up -d --scale atlas2-worker=5

# Check scaled services
docker-compose -f docker-compose.prod.yml ps
```

### Vertical Scaling
```bash
# Edit docker-compose.prod.yml
services:
  atlas2-api:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '0.5'
```

### Load Balancing
The production configuration includes Nginx load balancing. For external load balancers:

```yaml
# Add to docker-compose.prod.yml
services:
  atlas2-web:
    deploy:
      replicas: 3
```

## Security Considerations

### 1. Network Security
- Use internal networks for database and Redis
- Implement firewall rules
- Use VPN for admin access

### 2. Application Security
- Regular security updates
- Strong passwords
- SSL/TLS encryption
- Rate limiting

### 3. Data Security
- Regular backups
- Encryption at rest
- Access controls
- Audit logging

## Backup and Recovery

### Automated Backups
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/atlas2"
mkdir -p $BACKUP_DIR

# Database backup
docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U atlas2 atlas2 > $BACKUP_DIR/db_$DATE.sql

# File uploads backup
tar -czf $BACKUP_DIR/uploads_$DATE.tar.gz uploads/

# Clean old backups (keep 7 days)
find $BACKUP_DIR -name "*.sql" -mtime +7 -delete
find $BACKUP_DIR -name "*.tar.gz" -mtime +7 -delete
EOF

# Make executable
chmod +x backup.sh

# Add to cron (daily at 2 AM)
0 2 * * * /path/to/atlas2/backup.sh
```

### Recovery Process
```bash
# Stop services
docker-compose -f docker-compose.prod.yml down

# Restore database
docker-compose -f docker-compose.prod.yml up -d postgres
docker-compose -f docker-compose.prod.yml exec -T postgres psql -U atlas2 atlas2 < backup.sql

# Restore file uploads
tar -xzf uploads_backup.tar.gz

# Start all services
docker-compose -f docker-compose.prod.yml up -d
```

## Performance Optimization

### 1. Database Optimization
```sql
-- Add indexes for better performance
CREATE INDEX CONCURRENTLY idx_processing_jobs_status ON processing_jobs(job_status);
CREATE INDEX CONCURRENTLY idx_file_uploads_user_id ON file_uploads(user_id);

-- Analyze table statistics
ANALYZE processing_jobs;
ANALYZE file_uploads;
```

### 2. Redis Optimization
```bash
# Configure Redis memory limits
# Add to redis.conf in production
maxmemory 256mb
maxmemory-policy allkeys-lru
```

### 3. Application Optimization
- Enable gzip compression
- Use CDN for static assets
- Implement caching strategies
- Monitor and optimize queries

## Support

For additional support:
- Check the [GitHub Issues](https://github.com/your-username/atlas2/issues)
- Review the [documentation](docs/)
- Contact the support team