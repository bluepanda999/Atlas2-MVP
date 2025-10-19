#!/bin/bash

# Atlas2 Development Environment Setup
# This script sets up the complete development environment

set -e

echo "🚀 Setting up Atlas2 development environment..."

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed. Please install Docker Compose first."
    exit 1
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

# Install API dependencies
if [ -f api/package.json ]; then
    cd api && npm install && cd ..
    echo "✅ API dependencies installed"
fi

# Install Worker dependencies
if [ -f worker/package.json ]; then
    cd worker && npm install && cd ..
    echo "✅ Worker dependencies installed"
fi

# Build Docker images
echo "🐳 Building Docker images..."
docker-compose -f docker-compose.dev.yml build
echo "✅ Docker images built"

# Start database and Redis
echo "🗄️  Starting database services..."
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ Waiting for database to be ready..."
sleep 10

# Check database connection
echo "🔍 Checking database connection..."
until docker-compose -f docker-compose.dev.yml exec -T postgres pg_isready -U atlas2 -d atlas2_dev; do
    echo "Waiting for postgres..."
    sleep 2
done

echo "✅ Database is ready"

# Run database migrations
echo "🔄 Running database migrations..."
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U atlas2 -d atlas2_dev -f /docker-entrypoint-initdb.d/init.sql
echo "✅ Database migrations completed"

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

# Create development scripts
echo "📜 Creating development scripts..."

# Start development script
cat > scripts/start-dev.sh << 'EOF'
#!/bin/bash

# Start Atlas2 development environment
echo "🚀 Starting Atlas2 development environment..."

# Start all services
docker-compose -f docker-compose.dev.yml up -d

echo "⏳ Waiting for services to be ready..."
sleep 15

# Check service health
echo "🔍 Checking service health..."

# Check API
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
    echo "✅ API is healthy"
else
    echo "❌ API is not healthy"
fi

# Check Web App
if curl -f http://localhost:3000 > /dev/null 2>&1; then
    echo "✅ Web app is running"
else
    echo "❌ Web app is not accessible"
fi

echo ""
echo "🎯 Development URLs:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  API Docs: http://localhost:3001/docs"
echo "  Database: localhost:5432"
echo "  Redis: localhost:6379"
echo ""
echo "📊 Monitoring:"
echo "  Grafana: http://localhost:3002 (admin/admin123)"
echo "  Prometheus: http://localhost:9090"
echo ""
echo "🔧 Useful commands:"
echo "  View logs: docker-compose -f docker-compose.dev.yml logs -f [service]"
echo "  Stop services: docker-compose -f docker-compose.dev.yml down"
echo "  Restart service: docker-compose -f docker-compose.dev.yml restart [service]"
EOF

chmod +x scripts/start-dev.sh

# Stop development script
cat > scripts/stop-dev.sh << 'EOF'
#!/bin/bash

# Stop Atlas2 development environment
echo "🛑 Stopping Atlas2 development environment..."

docker-compose -f docker-compose.dev.yml down

echo "✅ Development environment stopped"
EOF

chmod +x scripts/stop-dev.sh

# Reset database script
cat > scripts/reset-db.sh << 'EOF'
#!/bin/bash

# Reset development database
echo "🔄 Resetting development database..."

read -p "⚠️  This will delete all data. Are you sure? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Database reset cancelled"
    exit 1
fi

# Stop services
docker-compose -f docker-compose.dev.yml stop postgres

# Remove volume
docker volume rm atlas2_postgres_data

# Start database
docker-compose -f docker-compose.dev.yml up -d postgres

echo "⏳ Waiting for database..."
sleep 10

# Run migrations
docker-compose -f docker-compose.dev.yml exec -T postgres psql -U atlas2 -d atlas2_dev -f /docker-entrypoint-initdb.d/init.sql

echo "✅ Database reset completed"
EOF

chmod +x scripts/reset-db.sh

# Database shell script
cat > scripts/db-shell.sh << 'EOF'
#!/bin/bash

# Connect to database shell
echo "🗄️  Connecting to Atlas2 database..."

docker-compose -f docker-compose.dev.yml exec postgres psql -U atlas2 -d atlas2_dev
EOF

chmod +x scripts/db-shell.sh

# Redis shell script
cat > scripts/redis-shell.sh << 'EOF'
#!/bin/bash

# Connect to Redis shell
echo "🔴 Connecting to Atlas2 Redis..."

docker-compose -f docker-compose.dev.yml exec redis redis-cli
EOF

chmod +x scripts/redis-shell.sh

# Logs script
cat > scripts/logs.sh << 'EOF'
#!/bin/bash

# View service logs
SERVICE=${1:-"all"}

if [ "$SERVICE" = "all" ]; then
    echo "📋 Showing all logs..."
    docker-compose -f docker-compose.dev.yml logs -f
else
    echo "📋 Showing logs for $SERVICE..."
    docker-compose -f docker-compose.dev.yml logs -f "$SERVICE"
fi
EOF

chmod +x scripts/logs.sh

# Test script
cat > scripts/test.sh << 'EOF'
#!/bin/bash

# Run tests
TYPE=${1:-"all"}

case $TYPE in
    "unit")
        echo "🧪 Running unit tests..."
        npm run test:unit
        ;;
    "integration")
        echo "🔗 Running integration tests..."
        npm run test:integration
        ;;
    "e2e")
        echo "🌐 Running E2E tests..."
        npm run test:e2e
        ;;
    "all")
        echo "🧪 Running all tests..."
        npm test
        ;;
    *)
        echo "❌ Unknown test type: $TYPE"
        echo "Usage: $0 [unit|integration|e2e|all]"
        exit 1
        ;;
esac
EOF

chmod +x scripts/test.sh

# Build script
cat > scripts/build.sh << 'EOF'
#!/bin/bash

# Build Atlas2 for production
echo "🏗️  Building Atlas2 for production..."

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/
rm -rf build/

# Build web app
echo "🌐 Building web app..."
npm run build

# Build API
echo "🔧 Building API..."
cd api && npm run build && cd ..

# Build worker
echo "⚙️  Building worker..."
cd worker && npm run build && cd ..

echo "✅ Build completed"
echo "📦 Build artifacts:"
echo "  Web App: ./dist/"
echo "  API: ./api/dist/"
echo "  Worker: ./worker/dist/"
EOF

chmod +x scripts/build.sh

# Create Makefile for convenience
cat > Makefile << 'EOF'
# Atlas2 Development Makefile

.PHONY: help install dev start stop test build clean logs db-shell redis-shell reset-db

help: ## Show this help message
	@echo "Atlas2 Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and setup development environment
	./scripts/dev-setup.sh

dev: ## Start development environment
	./scripts/start-dev.sh

start: dev ## Alias for dev

stop: ## Stop development environment
	./scripts/stop-dev.sh

test: ## Run all tests
	./scripts/test.sh all

test-unit: ## Run unit tests
	./scripts/test.sh unit

test-integration: ## Run integration tests
	./scripts/test.sh integration

test-e2e: ## Run E2E tests
	./scripts/test.sh e2e

build: ## Build for production
	./scripts/build.sh

clean: ## Clean build artifacts and containers
	docker-compose -f docker-compose.dev.yml down -v
	rm -rf dist/ build/ node_modules/ api/node_modules/ worker/node_modules/

logs: ## Show logs for all services
	./scripts/logs.sh all

logs-api: ## Show API logs
	./scripts/logs.sh atlas2-api

logs-worker: ## Show worker logs
	./scripts/logs.sh atlas2-worker

logs-web: ## Show web app logs
	./scripts/logs.sh atlas2-web

db-shell: ## Connect to database shell
	./scripts/db-shell.sh

redis-shell: ## Connect to Redis shell
	./scripts/redis-shell.sh

reset-db: ## Reset development database
	./scripts/reset-db.sh

monitoring: ## Start monitoring stack
	./scripts/start-monitoring.sh

health: ## Check service health
	./scripts/monitoring-health.sh
EOF

echo ""
echo "✅ Development environment setup complete!"
echo ""
echo "🎯 Quick start:"
echo "  make dev          # Start development environment"
echo "  make logs         # View logs"
echo "  make test         # Run tests"
echo "  make build        # Build for production"
echo "  make db-shell     # Connect to database"
echo ""
echo "📚 Documentation:"
echo "  Development guide: docs/development.md"
echo "  API documentation: http://localhost:3001/docs"
echo "  Monitoring guide: docs/monitoring.md"
echo ""
echo "🔧 Environment:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo "  Grafana: http://localhost:3002"
echo ""
echo "⚠️  Don't forget to:"
echo "  1. Review and update .env file"
echo "  2. Check .env.example for required variables"
echo "  3. Run 'make test' to verify setup"