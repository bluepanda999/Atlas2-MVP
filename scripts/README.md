# Atlas2 Development Scripts

This directory contains scripts to manage the Atlas2 development environment using Podman Compose.

## 🚀 Quick Start

```bash
# Start the complete development environment
./scripts/dev-start.sh

# Check the status of all services
./scripts/dev-status.sh

# Stop all services
./scripts/dev-stop.sh
```

## 📋 Available Scripts

### `dev-start.sh`
Starts the complete Atlas2 development environment including:

**Infrastructure Services:**
- PostgreSQL 15 (port 5432)
- Redis 7 (port 6379)
- Prometheus (port 9090)
- Grafana (port 3002)

**Application Services:**
- Web Application (port 3000) - React + Vite
- API Server (port 3001) - Express + TypeScript
- Worker Service - Background processing

**Features:**
- ✅ Automatic dependency installation
- ✅ Database migration execution
- ✅ Health checks for all services
- ✅ Process management with PID files
- ✅ Comprehensive logging
- ✅ Error handling and recovery

### `dev-status.sh`
Shows the current status of all development services:

**Status Information:**
- Service health checks
- Container status
- Process status
- Database connectivity
- Recent log entries
- System resource usage
- Quick action shortcuts

### `dev-stop.sh`
Gracefully stops all development services:

**Shutdown Process:**
- Stops application processes (API, Worker, Web)
- Shuts down infrastructure containers
- Cleans up remaining processes
- Removes PID files
- Shows final status

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Atlas2 Development Stack                │
├─────────────────────────────────────────────────────────────┤
│  Web App (3000)    │  API Server (3001)  │  Worker Service │
│  React + Vite      │  Express + TS       │  Background     │
├─────────────────────────────────────────────────────────────┤
│  Prometheus (9090) │  Grafana (3002)     │                 │
│  Metrics           │  Dashboards         │                 │
├─────────────────────────────────────────────────────────────┤
│  PostgreSQL (5432) │  Redis (6379)       │                 │
│  Primary Database  │  Cache & Sessions   │                 │
└─────────────────────────────────────────────────────────────┘
```

## 📁 File Structure

```
scripts/
├── dev-start.sh      # Start all services
├── dev-stop.sh       # Stop all services
├── dev-status.sh     # Check service status
└── README.md         # This file

logs/                  # Generated automatically
├── api.log           # API server logs
├── web.log           # Web application logs
├── worker.log        # Worker service logs
├── api.pid           # API process ID
├── web.pid           # Web process ID
└── worker.pid        # Worker process ID
```

## 🔧 Configuration

### Environment Variables
The scripts use the `.env` file in the project root. Key variables:

```bash
# Database
DATABASE_URL=postgresql://atlas2:atlas2_password@localhost:5432/atlas2_dev
REDIS_URL=redis://localhost:6379

# Services
PORT=3001              # API port
WEB_PORT=3000          # Web port

# Monitoring
GRAFANA_PASSWORD=admin123
```

### Port Mappings
| Service | Port | Description |
|---------|------|-------------|
| Web App | 3000 | React frontend |
| API Server | 3001 | REST API |
| PostgreSQL | 5432 | Primary database |
| Redis | 6379 | Cache/sessions |
| Prometheus | 9090 | Metrics collection |
| Grafana | 3002 | Monitoring dashboards |

## 🚨 Troubleshooting

### Common Issues

**1. Services won't start**
```bash
# Check status
./scripts/dev-status.sh

# Check logs
tail -f logs/api.log
tail -f logs/web.log
```

**2. Database connection issues**
```bash
# Restart database
podman restart atlas2-postgres

# Check database logs
podman logs atlas2-postgres
```

**3. Port conflicts**
```bash
# Check what's using ports
netstat -tulpn | grep -E ":(3000|3001|5432|6379|9090|3002)"

# Stop conflicting services
./scripts/dev-stop.sh
```

**4. Permission issues**
```bash
# Fix script permissions
chmod +x scripts/*.sh

# Fix log directory permissions
mkdir -p logs
chmod 755 logs
```

### Manual Recovery

**If scripts fail, you can manually manage services:**

```bash
# Start containers manually
cd /path/to/atlas2
podman-compose -f docker-compose.podman.yml up -d

# Start applications manually
npm run dev &                    # Web app
cd api && npm run dev &          # API server
cd worker && npm run dev &       # Worker service
```

## 📊 Monitoring

### Grafana Access
- **URL:** http://localhost:3002
- **Username:** admin
- **Password:** admin123

### Prometheus Access
- **URL:** http://localhost:9090
- **Targets:** http://localhost:9090/targets

### Health Endpoints
- **API Health:** http://localhost:3001/health
- **Auth Test:** http://localhost:3001/auth/test

## 🔄 Development Workflow

### Typical Development Session

```bash
# 1. Start development environment
./scripts/dev-start.sh

# 2. Check everything is running
./scripts/dev-status.sh

# 3. Work on your code...
#   - Web app: http://localhost:3000
#   - API: http://localhost:3001
#   - Monitor: http://localhost:3002

# 4. Run tests
./test-system.sh

# 5. Check logs if needed
tail -f logs/api.log

# 6. Stop when done
./scripts/dev-stop.sh
```

### Making Changes

**For configuration changes:**
1. Update `.env` file
2. Restart services: `./scripts/dev-stop.sh && ./scripts/dev-start.sh`

**For database changes:**
1. Create migration in `database/migrations/`
2. Restart services (auto-runs new migrations)

**For monitoring changes:**
1. Update configs in `monitoring/`
2. Restart containers: `podman-compose -f docker-compose.podman.yml restart prometheus grafana`

## 🛠️ Requirements

### System Requirements
- **Podman** (container runtime)
- **Podman Compose** (orchestration)
- **Node.js** 18+ (application runtime)
- **npm** (package manager)

### Installation

```bash
# Install Podman (Ubuntu/Debian)
sudo apt update
sudo apt install podman

# Install Podman Compose
pip install podman-compose

# Install Node.js (using nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

## 📝 Logging

All services log to files in the `logs/` directory:

- `logs/api.log` - API server logs
- `logs/web.log` - Web application logs  
- `logs/worker.log` - Worker service logs

**View logs in real-time:**
```bash
tail -f logs/api.log
tail -f logs/web.log
tail -f logs/worker.log
```

**View all logs at once:**
```bash
tail -f logs/*.log
```

## 🔐 Security Notes

### Development Environment
- Default passwords are used for development
- Services are exposed to localhost only
- No SSL/TLS in development mode

### Production Considerations
- Change all default passwords
- Use environment-specific configurations
- Enable SSL/TLS termination
- Restrict network access
- Enable authentication for monitoring

## 📞 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Run `./scripts/dev-status.sh` for diagnostics
3. Check log files in `logs/`
4. Verify all requirements are installed
5. Check for port conflicts

For additional help, refer to the main project documentation.