# Atlas2 Development Environment

## 🚀 Complete Development Setup

Atlas2 provides a comprehensive development environment with automated setup scripts that manage the entire technology stack using Podman containers.

### Quick Start

```bash
# Clone and navigate to the project
git clone <repository-url>
cd Atlas2

# Start the complete development environment
./scripts/dev-start.sh

# Check status of all services
./scripts/dev-status.sh

# Stop all services when done
./scripts/dev-stop.sh
```

## 📋 What Gets Installed

### 🏗️ Infrastructure Services
- **PostgreSQL 15** - Primary database with enterprise schema
- **Redis 7** - Caching and session storage
- **Prometheus** - Metrics collection and monitoring
- **Grafana** - Visualization dashboards

### 🌐 Application Services
- **Web Application** (port 3000) - React + Vite + TypeScript
- **API Server** (port 3001) - Express + TypeScript + Multi-auth
- **Worker Service** - Background job processing

### 🔐 Security Features
- Basic Authentication (username/password)
- Bearer Token Authentication (JWT)
- API Key Authentication
- Comprehensive audit logging
- Role-based access control

## 🎯 Service URLs

After starting the development environment, access services at:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Web Application** | http://localhost:3000 | - |
| **API Server** | http://localhost:3001 | - |
| **API Health** | http://localhost:3001/health | - |
| **API Auth Test** | http://localhost:3001/auth/test | - |
| **Prometheus** | http://localhost:9090 | - |
| **Grafana** | http://localhost:3002 | admin/admin123 |
| **PostgreSQL** | localhost:5432 | atlas2/atlas2_password |
| **Redis** | localhost:6379 | - |

## 🛠️ Development Workflow

### 1. Environment Setup
```bash
# Start everything (first time setup takes 2-3 minutes)
./scripts/dev-start.sh

# Watch the startup process - it will:
# ✅ Install all npm dependencies
# ✅ Start PostgreSQL and Redis containers
# ✅ Run database migrations (14 tables)
# ✅ Start monitoring services
# ✅ Launch application services
# ✅ Verify all services are healthy
```

### 2. Daily Development
```bash
# Check current status
./scripts/dev-status.sh

# View logs in real-time
tail -f logs/api.log    # API server logs
tail -f logs/web.log    # Web app logs
tail -f logs/worker.log # Worker service logs

# Run comprehensive tests
./test-system.sh
```

### 3. Making Changes

**Code Changes:**
- Web app: Hot reload enabled automatically
- API server: Auto-restart with ts-node-dev
- Worker service: Auto-restart with ts-node-dev

**Database Changes:**
```bash
# Create new migration
echo "ALTER TABLE users ADD COLUMN phone VARCHAR(20);" > database/migrations/005_add_phone.sql

# Restart to apply migration
./scripts/dev-stop.sh && ./scripts/dev-start.sh
```

**Configuration Changes:**
```bash
# Edit .env file
vim .env

# Restart services
./scripts/dev-stop.sh && ./scripts/dev-start.sh
```

### 4. Testing
```bash
# Run comprehensive system tests
./test-system.sh

# Test specific endpoints
curl http://localhost:3001/health
curl -u admin:password http://localhost:3001/auth/test
curl -H "Authorization: Bearer test-token" http://localhost:3001/auth/test
```

## 📊 Database Schema

The development environment includes a comprehensive database schema with 14 tables:

### Core Tables
- **users** - User management and authentication
- **api_configurations** - External API endpoint definitions
- **mapping_configurations** - CSV to API field mappings
- **processing_jobs** - Asynchronous job tracking
- **processing_results** - Individual record processing results

### Enterprise Features
- **audit_logs** - Comprehensive activity tracking
- **auth_audit_log** - Authentication-specific auditing
- **api_key_configs** - API key management with rate limiting
- **upload_sessions** - Streaming upload session management
- **system_settings** - Configurable application parameters

### Access Database
```bash
# Connect to PostgreSQL
podman exec -it atlas2-postgres psql -U atlas2 -d atlas2_dev

# View all tables
\dt

# View table structure
\d users

# Run queries
SELECT COUNT(*) FROM users;
```

## 🔍 Monitoring & Debugging

### Grafana Dashboards
- **URL:** http://localhost:3002
- **Login:** admin / admin123
- **Features:** Pre-configured dashboards for all services

### Prometheus Metrics
- **URL:** http://localhost:9090
- **Targets:** http://localhost:9090/targets
- **Custom Metrics:** Application-specific metrics available

### Log Management
```bash
# View all logs
ls -la logs/

# Follow specific logs
tail -f logs/api.log &    # API server
tail -f logs/web.log &    # Web application
tail -f logs/worker.log & # Worker service

# Search logs
grep "ERROR" logs/*.log
grep "health" logs/api.log
```

### Health Checks
```bash
# API Health
curl http://localhost:3001/health

# Database Health
podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev

# Redis Health
podman exec atlas2-redis redis-cli ping

# Container Status
podman ps | grep atlas2
```

## 🚨 Troubleshooting

### Common Issues

**Services won't start:**
```bash
# Check status
./scripts/dev-status.sh

# Check for port conflicts
netstat -tulpn | grep -E ":(3000|3001|5432|6379|9090|3002)"

# Clean restart
./scripts/dev-stop.sh
sleep 5
./scripts/dev-start.sh
```

**Database issues:**
```bash
# Check database logs
podman logs atlas2-postgres

# Restart database
podman restart atlas2-postgres

# Manual database connection
podman exec -it atlas2-postgres psql -U atlas2 -d atlas2_dev
```

**Permission issues:**
```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix log directory
mkdir -p logs
chmod 755 logs
```

**Memory issues:**
```bash
# Check system resources
free -h
df -h

# Stop services to free resources
./scripts/dev-stop.sh
```

### Manual Recovery

If automated scripts fail, you can manage services manually:

```bash
# Start containers manually
podman-compose -f docker-compose.podman.yml up -d

# Start applications manually
npm run dev &                    # Web app (port 3000)
cd api && npm run dev &          # API server (port 3001)
cd worker && npm run dev &       # Worker service

# Stop everything manually
pkill -f "node.*dev"
podman-compose -f docker-compose.podman.yml down
```

## 📁 Project Structure

```
Atlas2/
├── scripts/                    # Development automation
│   ├── dev-start.sh           # Start all services
│   ├── dev-stop.sh            # Stop all services
│   ├── dev-status.sh          # Check service status
│   └── README.md              # Script documentation
├── logs/                      # Application logs (generated)
├── api/                       # API server source
├── worker/                    # Worker service source
├── src/                       # Web application source
├── database/                  # Database schema and migrations
├── monitoring/                # Monitoring configuration
├── docker-compose.podman.yml  # Infrastructure definition
├── .env                       # Environment configuration
└── test-system.sh             # Comprehensive tests
```

## 🔧 Configuration

### Environment Variables (.env)
```bash
# Application
NODE_ENV=development
PORT=3001
WEB_PORT=3000

# Database
DATABASE_URL=postgresql://atlas2:atlas2_password@localhost:5432/atlas2_dev
REDIS_URL=redis://localhost:6379

# Security
JWT_SECRET=your-super-secret-jwt-key-for-development-only-32-chars
BASIC_AUTH_ENABLED=true
BEARER_AUTH_ENABLED=true

# File Processing
MAX_FILE_SIZE=3221225472  # 3GB
CHUNK_SIZE=1048576        # 1MB chunks

# Monitoring
GRAFANA_PASSWORD=admin123
```

### Port Configuration
All ports are configurable via environment variables. Default ports are chosen to avoid conflicts with common development tools.

## 🚀 Production Deployment

The development environment is designed to mirror production. For deployment:

1. **Environment Variables:** Use production-specific values
2. **Security:** Change all default passwords and secrets
3. **Networking:** Configure proper DNS and SSL certificates
4. **Monitoring:** Set up alerting and backup strategies
5. **Scaling:** Configure load balancers and multiple instances

## 📞 Getting Help

1. **Check status:** `./scripts/dev-status.sh`
2. **Read logs:** `tail -f logs/*.log`
3. **Run tests:** `./test-system.sh`
4. **Review documentation:** Check individual script READMEs
5. **Verify requirements:** Ensure Podman, Node.js, and npm are installed

The development environment is designed to be self-healing and provide clear error messages for any issues that arise.