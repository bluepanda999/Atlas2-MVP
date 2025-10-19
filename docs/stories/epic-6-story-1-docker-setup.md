# Story 6.1: Docker Environment Setup - Brownfield Addition

## User Story

As a DevOps engineer,
I want to containerize the Atlas2 application with proper Docker configuration,
So that I can ensure consistent deployment environments and simplify operations.

## Story Context

**Existing System Integration:**
- Integrates with: All previous epics (CSV processing, API client generation, field mapping, authentication, monitoring)
- Technology: Docker containers, Docker Compose, multi-stage builds, container orchestration
- Follows pattern: Containerization best practices, microservices architecture, DevOps standards
- Touch points: Dockerfile configuration, docker-compose setup, container networking, volume management

## Acceptance Criteria

**Functional Requirements:**
1. Multi-container Docker setup with separate containers for frontend, backend, database, and monitoring
2. Optimized Docker images using multi-stage builds and minimal base images
3. Environment-specific configurations (development, staging, production) with proper secret management
4. Container networking with service discovery and secure inter-container communication
5. Volume management for persistent data storage and backup capabilities

**Integration Requirements:**
4. Existing application architecture remains unchanged (containerization wraps existing services)
5. New functionality follows existing configuration and environment management patterns
6. Integration with all application components maintains current communication patterns

**Quality Requirements:**
7. Container images build within 5 minutes for production deployment
8. Container startup time <30 seconds for full application stack
9. Image size optimization reduces storage footprint by 60%+ compared to monolithic approach
10. All containers follow security best practices with non-root users and read-only filesystems where possible

## Technical Notes

- **Integration Approach:** Containerization wraps existing application components with proper isolation
- **Existing Pattern Reference:** Follow established microservices and containerization patterns
- **Key Constraints:** Must maintain application functionality, optimize for production, ensure security

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Security audit completed
- [ ] Documentation updated (deployment guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Container networking issues causing service communication failures
- **Mitigation:** Implement proper service discovery, health checks, and fallback mechanisms
- **Rollback:** Maintain existing deployment capability alongside containerized version

**Compatibility Verification:**
- [ ] No breaking changes to existing application architecture
- [ ] Container configuration follows existing environment patterns
- [ ] Networking maintains current service communication
- [ ] Volume management preserves data integrity

## Story Points Estimation

**Estimation:** 8 points
- Dockerfile configuration: 3 points
- Docker Compose setup: 3 points
- Container networking: 2 points

## Dependencies

- All previous epics (application components)
- Docker infrastructure foundation
- Environment configuration management

## Testing Requirements

**Unit Tests:**
- Dockerfile build validation
- Container startup scripts
- Environment configuration loading
- Health check implementations

**Integration Tests:**
- End-to-end container deployment
- Inter-container communication
- Volume mounting and persistence
- Environment-specific configurations

**Security Tests:**
- Container image vulnerability scanning
- Non-root user verification
- Secret management validation
- Network security assessment

## Implementation Notes

**Backend Dockerfile:**
```dockerfile
# Multi-stage build for backend
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy application code
COPY . .

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Copy user from builder stage
COPY --from=builder /etc/passwd /etc/passwd
COPY --from=builder /etc/group /etc/group

# Copy application
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app .

# Switch to non-root user
USER nodejs

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node healthcheck.js

# Use dumb-init as PID 1
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
```

**Frontend Dockerfile:**
```dockerfile
# Multi-stage build for frontend
FROM node:18-alpine AS builder

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Build application
RUN npm run build

# Production stage with nginx
FROM nginx:alpine AS production

# Install security updates
RUN apk update && apk upgrade && \
    addgroup -g 1001 -S nginx && \
    adduser -S nginx -u 1001

# Copy custom nginx config
COPY nginx.conf /etc/nginx/nginx.conf

# Copy built application
COPY --from=builder /app/dist /usr/share/nginx/html

# Create non-root user and set permissions
RUN chown -R nginx:nginx /usr/share/nginx/html && \
    chown -R nginx:nginx /var/cache/nginx && \
    chown -R nginx:nginx /var/log/nginx && \
    chown -R nginx:nginx /etc/nginx/conf.d

# Switch to non-root user
USER nginx

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
```

**Docker Compose - Development:**
```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  # Backend service
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: atlas2-backend-dev
    restart: unless-stopped
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgresql://atlas2:password@postgres:5432/atlas2_dev
      - REDIS_URL=redis://redis:6379
      - JWT_SECRET=dev-jwt-secret
      - ENCRYPTION_SECRET=dev-encryption-secret
    ports:
      - "3000:3000"
    volumes:
      - ./backend:/app
      - /app/node_modules
      - uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # Frontend service
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    container_name: atlas2-frontend-dev
    restart: unless-stopped
    environment:
      - REACT_APP_API_URL=http://localhost:3000
      - REACT_APP_WS_URL=ws://localhost:3000
    ports:
      - "80:80"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    depends_on:
      - backend
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    container_name: atlas2-postgres-dev
    restart: unless-stopped
    environment:
      - POSTGRES_DB=atlas2_dev
      - POSTGRES_USER=atlas2
      - POSTGRES_PASSWORD=password
      - POSTGRES_INITDB_ARGS=--encoding=UTF-8 --lc-collate=C --lc-ctype=C
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U atlas2 -d atlas2_dev"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Redis cache
  redis:
    image: redis:7-alpine
    container_name: atlas2-redis-dev
    restart: unless-stopped
    command: redis-server --appendonly yes --requirepass redis-password
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 30s

  # Monitoring with Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: atlas2-prometheus-dev
    restart: unless-stopped
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'
      - '--storage.tsdb.retention.time=200h'
      - '--web.enable-lifecycle'
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - atlas2-network

  # Grafana for visualization
  grafana:
    image: grafana/grafana:latest
    container_name: atlas2-grafana-dev
    restart: unless-stopped
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin
      - GF_USERS_ALLOW_SIGN_UP=false
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/provisioning:/etc/grafana/provisioning
    networks:
      - atlas2-network

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  prometheus_data:
    driver: local
  grafana_data:
    driver: local
  uploads:
    driver: local

networks:
  atlas2-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.20.0.0/16
```

**Docker Compose - Production:**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  # Backend service
  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    image: atlas2/backend:${VERSION}
    container_name: atlas2-backend-prod
    restart: always
    environment:
      - NODE_ENV=production
      - PORT=3000
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - ENCRYPTION_SECRET=${ENCRYPTION_SECRET}
    expose:
      - "3000"
    volumes:
      - uploads:/app/uploads:ro
      - logs:/app/logs
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    networks:
      - atlas2-network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 2G
        reservations:
          cpus: '1.0'
          memory: 1G
    healthcheck:
      test: ["CMD", "node", "healthcheck.js"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Frontend service
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile
      target: production
    image: atlas2/frontend:${VERSION}
    container_name: atlas2-frontend-prod
    restart: always
    environment:
      - REACT_APP_API_URL=${API_URL}
      - REACT_APP_WS_URL=${WS_URL}
    expose:
      - "80"
    networks:
      - atlas2-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"

  # Nginx reverse proxy
  nginx:
    image: nginx:alpine
    container_name: atlas2-nginx-prod
    restart: always
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf:ro
      - ./nginx/ssl:/etc/nginx/ssl:ro
      - logs:/var/log/nginx
    depends_on:
      - backend
      - frontend
    networks:
      - atlas2-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
    healthcheck:
      test: ["CMD", "wget", "--no-verbose", "--tries=1", "--spider", "http://localhost/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  # PostgreSQL database
  postgres:
    image: postgres:15-alpine
    container_name: atlas2-postgres-prod
    restart: always
    environment:
      - POSTGRES_DB=${POSTGRES_DB}
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init:/docker-entrypoint-initdb.d:ro
      - backups:/backups
    networks:
      - atlas2-network
    deploy:
      resources:
        limits:
          cpus: '2.0'
          memory: 4G
        reservations:
          cpus: '1.0'
          memory: 2G
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 30s

  # Redis cache
  redis:
    image: redis:7-alpine
    container_name: atlas2-redis-prod
    restart: always
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    networks:
      - atlas2-network
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 512M
        reservations:
          cpus: '0.25'
          memory: 256M
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5
      start_period: 30s

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  uploads:
    driver: local
  logs:
    driver: local
  backups:
    driver: local

networks:
  atlas2-network:
    driver: bridge
    ipam:
      config:
        - subnet: 172.21.0.0/16
```

**Nginx Configuration:**
```nginx
# nginx/nginx.conf
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;

    # Logging format
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';

    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;

    # Basic settings
    sendfile on;
    tcp_nopush on;
    tcp_nodelay on;
    keepalive_timeout 65;
    types_hash_max_size 2048;
    client_max_body_size 100M;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types
        text/plain
        text/css
        text/xml
        text/javascript
        application/javascript
        application/xml+rss
        application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=upload:10m rate=2r/s;

    # Upstream backend
    upstream backend {
        server backend:3000;
        keepalive 32;
    }

    # HTTP server (redirect to HTTPS)
    server {
        listen 80;
        server_name _;
        return 301 https://$server_name$request_uri;
    }

    # HTTPS server
    server {
        listen 443 ssl http2;
        server_name _;

        # SSL configuration
        ssl_certificate /etc/nginx/ssl/cert.pem;
        ssl_certificate_key /etc/nginx/ssl/key.pem;
        ssl_protocols TLSv1.2 TLSv1.3;
        ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
        ssl_prefer_server_ciphers off;
        ssl_session_cache shared:SSL:10m;
        ssl_session_timeout 10m;

        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;

        # Frontend
        location / {
            proxy_pass http://frontend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

        # API endpoints
        location /api/ {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # WebSocket support
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
        }

        # File upload endpoints
        location /api/upload {
            limit_req zone=upload burst=5 nodelay;
            
            proxy_pass http://backend;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Increase timeout for large uploads
            proxy_read_timeout 300s;
            proxy_send_timeout 300s;
        }

        # Health check endpoint
        location /health {
            access_log off;
            return 200 "healthy\n";
            add_header Content-Type text/plain;
        }
    }
}
```

**Health Check Script:**
```javascript
// backend/healthcheck.js
const http = require('http');

const options = {
  host: 'localhost',
  port: process.env.PORT || 3000,
  path: '/health',
  timeout: 2000
};

const request = http.request(options, (res) => {
  console.log(`Health check status: ${res.statusCode}`);
  if (res.statusCode === 200) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

request.on('error', (err) => {
  console.log('Health check failed:', err.message);
  process.exit(1);
});

request.on('timeout', () => {
  console.log('Health check timeout');
  request.destroy();
  process.exit(1);
});

request.end();
```

**Build and Deployment Scripts:**
```bash
#!/bin/bash
# scripts/build.sh

set -e

# Configuration
VERSION=${1:-latest}
ENVIRONMENT=${2:-development}

echo "Building Atlas2 containers..."
echo "Version: $VERSION"
echo "Environment: $ENVIRONMENT"

# Build backend
echo "Building backend..."
docker build -t atlas2/backend:$VERSION ./backend

# Build frontend
echo "Building frontend..."
docker build -t atlas2/frontend:$VERSION ./frontend

# Tag images for environment
if [ "$ENVIRONMENT" != "development" ]; then
    docker tag atlas2/backend:$VERSION atlas2/backend:$ENVIRONMENT
    docker tag atlas2/frontend:$VERSION atlas2/frontend:$ENVIRONMENT
fi

echo "Build completed successfully!"

# Push to registry (if configured)
if [ "$PUSH_TO_REGISTRY" = "true" ]; then
    echo "Pushing images to registry..."
    docker push atlas2/backend:$VERSION
    docker push atlas2/frontend:$VERSION
    
    if [ "$ENVIRONMENT" != "development" ]; then
        docker push atlas2/backend:$ENVIRONMENT
        docker push atlas2/frontend:$ENVIRONMENT
    fi
fi

echo "Deployment ready!"
```

```bash
#!/bin/bash
# scripts/deploy.sh

set -e

# Configuration
ENVIRONMENT=${1:-production}
VERSION=${2:-latest}

echo "Deploying Atlas2..."
echo "Environment: $ENVIRONMENT"
echo "Version: $VERSION"

# Set environment file
ENV_FILE=".env.$ENVIRONMENT"
if [ ! -f "$ENV_FILE" ]; then
    echo "Environment file $ENV_FILE not found!"
    exit 1
fi

# Load environment variables
export $(cat $ENV_FILE | xargs)
export VERSION=$VERSION

# Deploy using docker-compose
echo "Starting deployment..."
docker-compose -f docker-compose.$ENVIRONMENT.yml down
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for services to be healthy
echo "Waiting for services to be healthy..."
./scripts/wait-for-health.sh

echo "Deployment completed successfully!"
```

**Error Handling:**
- Build failures: Detailed error logs with step-by-step troubleshooting
- Container startup issues: Health check failures with diagnostic information
- Networking problems: Service discovery fallback and manual configuration options
- Volume mounting errors: Permission fixes and alternative storage configurations

## Success Criteria

- Container images build within 5 minutes
- Container startup time <30 seconds for full stack
- Image size optimization reduces footprint by 60%+
- All containers follow security best practices
- Multi-environment deployment works seamlessly

## Monitoring and Observability

**Metrics to Track:**
- Container resource usage
- Image build times
- Startup performance
- Health check status

**Alerts:**
- Container startup failures
- Health check failures
- Resource exhaustion
- Image vulnerability detection

## Integration Points

**Upstream:**
- All application components (containerization)
- Build pipeline (image creation)
- Configuration management (environment variables)

**Downstream:**
- Container registry (image storage)
- Orchestration platform (deployment)
- Monitoring system (container metrics)

## Containerization Features

**Multi-stage Builds:**
- Optimized image sizes
- Separate build and runtime environments
- Dependency caching
- Security scanning integration

**Environment Management:**
- Development, staging, production configurations
- Secret management
- Environment variable injection
- Configuration validation

**Security Features:**
- Non-root user execution
- Read-only filesystems
- Minimal base images
- Vulnerability scanning

**Networking:**
- Service discovery
- Load balancing
- SSL termination
- Rate limiting