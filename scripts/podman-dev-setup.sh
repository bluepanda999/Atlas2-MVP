#!/bin/bash

# Atlas2 Development Environment Setup (Podman)
# This script sets up the complete development environment using Podman

set -e

echo "🚀 Setting up Atlas2 development environment with Podman..."

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Podman
if ! command -v podman &> /dev/null; then
    echo "❌ Podman is not installed. Please install Podman first."
    echo "   Ubuntu/Debian: sudo apt-get install podman"
    echo "   Fedora: sudo dnf install podman"
    echo "   macOS: brew install podman"
    exit 1
fi

# Check Podman Compose (optional, we'll use podman-compose if available)
if ! command -v podman-compose &> /dev/null; then
    echo "⚠️  podman-compose not found. Will use podman kube play or manual setup."
    PODMAN_COMPOSE_AVAILABLE=false
else
    echo "✅ podman-compose found"
    PODMAN_COMPOSE_AVAILABLE=true
fi

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ Node.js version 18+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Create necessary directories
echo "📁 Creating directories..."
mkdir -p logs/api
mkdir -p logs/worker
mkdir -p logs/nginx
mkdir -p uploads
mkdir -p temp
mkdir -p scripts
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p tests/e2e

# Copy environment files
echo "📝 Setting up environment..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "📄 Created .env file from template"
    echo "⚠️  Please review and update .env file with your configuration"
fi

# Install dependencies
echo "📦 Installing dependencies..."

# Install root dependencies
if [ -f package.json ]; then
    npm install
    echo "✅ Root dependencies installed"
fi

# Create API package.json if it doesn't exist
if [ ! -f api/package.json ]; then
    echo "📝 Creating API package.json..."
    cat > api/package.json << 'EOF'
{
  "name": "atlas2-api",
  "version": "1.0.0",
  "description": "Atlas2 API Service",
  "main": "index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "compression": "^1.7.4",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "multer": "^1.4.5-lts.1",
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "prom-client": "^15.0.0",
    "winston": "^3.11.0",
    "joi": "^17.11.0",
    "dotenv": "^16.3.1",
    "@nestjs/common": "^10.3.0",
    "@nestjs/core": "^10.3.0",
    "@nestjs/platform-express": "^10.3.0",
    "@nestjs/config": "^3.1.1",
    "@nestjs/swagger": "^7.1.17",
    "reflect-metadata": "^0.1.13",
    "rxjs": "^7.8.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/compression": "^1.7.5",
    "@types/bcryptjs": "^2.4.6",
    "@types/jsonwebtoken": "^9.0.5",
    "@types/multer": "^1.4.11",
    "@types/pg": "^8.10.7",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  }
}
EOF
fi

# Create Worker package.json if it doesn't exist
if [ ! -f worker/package.json ]; then
    echo "📝 Creating Worker package.json..."
    cat > worker/package.json << 'EOF'
{
  "name": "atlas2-worker",
  "version": "1.0.0",
  "description": "Atlas2 Worker Service",
  "main": "index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn --transpile-only index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "jest",
    "test:watch": "jest --watch",
    "lint": "eslint . --ext .ts",
    "lint:fix": "eslint . --ext .ts --fix"
  },
  "dependencies": {
    "pg": "^8.11.3",
    "redis": "^4.6.10",
    "csv-parser": "^3.0.0",
    "winston": "^3.11.0",
    "dotenv": "^16.3.1",
    "bull": "^4.12.2"
  },
  "devDependencies": {
    "@types/pg": "^8.10.7",
    "@types/node": "^20.10.0",
    "typescript": "^5.3.3",
    "ts-node-dev": "^2.0.0",
    "jest": "^29.7.0",
    "@types/jest": "^29.5.8",
    "ts-jest": "^29.1.1",
    "eslint": "^8.56.0",
    "@typescript-eslint/eslint-plugin": "^6.15.0",
    "@typescript-eslint/parser": "^6.15.0"
  }
}
EOF
fi

# Install API dependencies
echo "📦 Installing API dependencies..."
cd api && npm install && cd ..
echo "✅ API dependencies installed"

# Install Worker dependencies
echo "📦 Installing Worker dependencies..."
cd worker && npm install && cd ..
echo "✅ Worker dependencies installed"

# Create Podman-compatible docker-compose.yml
echo "🐳 Creating Podman-compatible configuration..."
cat > docker-compose.podman.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    container_name: atlas2-postgres
    environment:
      POSTGRES_DB: atlas2_dev
      POSTGRES_USER: atlas2
      POSTGRES_PASSWORD: atlas2_password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init.sql:/docker-entrypoint-initdb.d/init.sql
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U atlas2 -d atlas2_dev"]
      interval: 30s
      timeout: 10s
      retries: 3

  redis:
    image: redis:7-alpine
    container_name: atlas2-redis
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    networks:
      - atlas2-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  prometheus:
    image: prom/prometheus:latest
    container_name: atlas2-prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    networks:
      - atlas2-network
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
      - '--web.console.libraries=/etc/prometheus/console_libraries'
      - '--web.console.templates=/etc/prometheus/consoles'

  grafana:
    image: grafana/grafana:latest
    container_name: atlas2-grafana
    ports:
      - "3002:3000"
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=admin123
    volumes:
      - grafana_data:/var/lib/grafana
      - ./monitoring/grafana/dashboards:/etc/grafana/provisioning/dashboards
    networks:
      - atlas2-network

volumes:
  postgres_data:
  redis_data:
  prometheus_data:
  grafana_data:

networks:
  atlas2-network:
    driver: bridge
EOF

# Create Podman startup script
echo "🐳 Creating Podman startup script..."
cat > scripts/start-podman.sh << 'EOF'
#!/bin/bash

# Start Atlas2 development environment with Podman
echo "🚀 Starting Atlas2 with Podman..."

# Start database services
echo "🗄️  Starting database services..."
podman play kube --replace docker-compose.podman.yml

echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev > /dev/null 2>&1; then
    echo "✅ PostgreSQL is healthy"
else
    echo "❌ PostgreSQL is not healthy"
fi

# Check Redis
if podman exec atlas2-redis redis-cli ping > /dev/null 2>&1; then
    echo "✅ Redis is healthy"
else
    echo "❌ Redis is not healthy"
fi

# Start API service
echo "🔧 Starting API service..."
cd api && npm run dev &
API_PID=$!
cd ..

# Start Worker service
echo "⚙️  Starting Worker service..."
cd worker && npm run dev &
WORKER_PID=$!
cd ..

# Start Web app
echo "🌐 Starting Web app..."
npm run dev &
WEB_PID=$!

echo ""
echo "🎯 Development URLs:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  Database: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "📊 Monitoring:"
echo "  Grafana: http://localhost:3002 (admin/admin123)"
echo "  Prometheus: http://localhost:9090"
echo ""
echo "🔧 Useful commands:"
echo "  View Podman containers: podman ps"
echo "  View logs: podman logs <container_name>"
echo "  Stop services: ./scripts/stop-podman.sh"
echo "  Stop all: kill $API_PID $WORKER_PID $WEB_PID"
echo ""
echo "⚠️  Press Ctrl+C to stop Node.js services (Podman containers continue running)"

# Wait for interrupt
trap "echo '🛑 Stopping Node.js services...'; kill $API_PID $WORKER_PID $WEB_PID; exit" INT
wait
EOF

chmod +x scripts/start-podman.sh

# Create Podman stop script
cat > scripts/stop-podman.sh << 'EOF'
#!/bin/bash

# Stop Atlas2 Podman environment
echo "🛑 Stopping Atlas2 Podman environment..."

# Stop and remove containers
podman stop $(podman ps -q --filter "name=atlas2") 2>/dev/null || true
podman rm $(podman ps -aq --filter "name=atlas2") 2>/dev/null || true

# Remove volumes (optional - comment out if you want to keep data)
# podman volume rm $(podman volume ls -q --filter "name=atlas2") 2>/dev/null || true

echo "✅ Podman environment stopped"
EOF

chmod +x scripts/stop-podman.sh

# Create Podman logs script
cat > scripts/podman-logs.sh << 'EOF'
#!/bin/bash

# View Podman container logs
SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    echo "📋 Showing all container logs..."
    podman logs -f $(podman ps -q --filter "name=atlas2")
else
    echo "📋 Showing logs for $SERVICE..."
    podman logs -f "atlas2-$SERVICE"
fi
EOF

chmod +x scripts/podman-logs.sh

# Create database shell script
cat > scripts/podman-db-shell.sh << 'EOF'
#!/bin/bash

# Connect to database shell via Podman
echo "🗄️  Connecting to Atlas2 database..."

podman exec -it atlas2-postgres psql -U atlas2 -d atlas2_dev
EOF

chmod +x scripts/podman-db-shell.sh

# Create Redis shell script
cat > scripts/podman-redis-shell.sh << 'EOF'
#!/bin/bash

# Connect to Redis shell via Podman
echo "🔴 Connecting to Atlas2 Redis..."

podman exec -it atlas2-redis redis-cli
EOF

chmod +x scripts/podman-redis-shell.sh

# Setup Git hooks
echo "🪝 Setting up Git hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Atlas2 pre-commit hook

echo "🔍 Running pre-commit checks..."

# Run linting
echo "📝 Running linter..."
npm run lint || exit 1

# Run tests
echo "🧪 Running tests..."
npm test || exit 1

# Check for large files
echo "📏 Checking file sizes..."
if find . -type f -size +10M -not -path "./.git/*" -not -path "./node_modules/*" | grep -q .; then
    echo "❌ Large files detected. Please remove or add to .gitignore"
    exit 1
fi

echo "✅ Pre-commit checks passed"
EOF

chmod +x .git/hooks/pre-commit

# Create Makefile for Podman development
cat > Makefile << 'EOF'
# Atlas2 Podman Development Makefile

.PHONY: help install dev start stop test build clean logs db-shell redis-shell

help: ## Show this help message
	@echo "Atlas2 Podman Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and setup development environment
	./scripts/podman-dev-setup.sh

dev: ## Start development environment with Podman
	./scripts/start-podman.sh

start: dev ## Alias for dev

stop: ## Stop Podman environment
	./scripts/stop-podman.sh

test: ## Run all tests
	npm test

test-unit: ## Run unit tests
	npm run test:unit

test-integration: ## Run integration tests
	npm run test:integration

test-e2e: ## Run E2E tests
	npm run test:e2e

build: ## Build for production
	npm run build

clean: ## Clean build artifacts and containers
	./scripts/stop-podman.sh
	rm -rf dist/ build/ node_modules/ api/node_modules/ worker/node_modules/

logs: ## Show logs for all Podman containers
	./scripts/podman-logs.sh all

logs-postgres: ## Show PostgreSQL logs
	./scripts/podman-logs.sh postgres

logs-redis: ## Show Redis logs
	./scripts/podman-logs.sh redis

logs-prometheus: ## Show Prometheus logs
	./scripts/podman-logs.sh prometheus

logs-grafana: ## Show Grafana logs
	./scripts/podman-logs.sh grafana

db-shell: ## Connect to database shell
	./scripts/podman-db-shell.sh

redis-shell: ## Connect to Redis shell
	./scripts/podman-redis-shell.sh

podman-ps: ## Show Podman containers
	podman ps --filter "name=atlas2"

podman-volumes: ## Show Podman volumes
	podman volume ls | grep atlas2

reset-db: ## Reset database (WARNING: deletes data)
	podman stop atlas2-postgres
	podman rm atlas2-postgres
	podman volume rm postgres_data
	./scripts/start-podman.sh

health: ## Check service health
	@echo "🔍 Checking service health..."
	@echo "PostgreSQL:"
	@podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev || echo "❌ PostgreSQL not ready"
	@echo "Redis:"
	@podman exec atlas2-redis redis-cli ping || echo "❌ Redis not ready"
	@echo "Prometheus:"
	@curl -f http://localhost:9090/-/healthy > /dev/null 2>&1 && echo "✅ Prometheus healthy" || echo "❌ Prometheus not ready"
	@echo "Grafana:"
	@curl -f http://localhost:3002/api/health > /dev/null 2>&1 && echo "✅ Grafana healthy" || echo "❌ Grafana not ready"
EOF

echo ""
echo "✅ Podman development environment setup complete!"
echo ""
echo "🎯 Quick start:"
echo "  make dev           # Start development environment"
echo "  make logs          # View container logs"
echo "  make test          # Run tests"
echo "  make db-shell      # Connect to database"
echo "  make health        # Check service health"
echo ""
echo "📚 Documentation:"
echo "  Development guide: docs/development.md"
echo "  API documentation: http://localhost:3001/docs (when running)"
echo "  Monitoring guide: docs/monitoring.md"
echo ""
echo "🔧 Environment:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  Grafana: http://localhost:3002 (admin/admin123)"
echo "  Prometheus: http://localhost:9090"
echo "  Database: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "🐳 Podman commands:"
echo "  make podman-ps    # Show containers"
echo "  make podman-volumes # Show volumes"
echo "  make reset-db     # Reset database"
echo ""
echo "⚠️  Don't forget to:"
echo "  1. Review and update .env file"
echo "  2. Check .env.example for required variables"
echo "  3. Run 'make test' to verify setup"
echo "  4. Run 'make health' to check services"
EOF

chmod +x scripts/podman-dev-setup.sh