#!/bin/bash

# Atlas2 Simple Development Environment Setup (No Docker)
# This script sets up the development environment without Docker dependencies

set -e

echo "🚀 Setting up Atlas2 development environment (No Docker)..."

# Check Node.js
echo "🔍 Checking prerequisites..."

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

echo "✅ Node.js $(node -v) check passed"

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

# Install root dependencies
echo "📦 Installing root dependencies..."
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
    "dotenv": "^16.3.1"
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

# Create simple database setup script
echo "🗄️  Setting up database configuration..."
cat > scripts/setup-local-db.sh << 'EOF'
#!/bin/bash

# Setup local database (PostgreSQL)
echo "🗄️  Setting up local database..."

# Check if PostgreSQL is running
if command -v psql &> /dev/null; then
    echo "✅ PostgreSQL found"
    
    # Create database if it doesn't exist
    createdb atlas2_dev 2>/dev/null || echo "Database atlas2_dev already exists"
    
    # Run migrations
    if [ -f database/init.sql ]; then
        psql -d atlas2_dev -f database/init.sql
        echo "✅ Database migrations completed"
    fi
else
    echo "⚠️  PostgreSQL not found. Please install PostgreSQL or use Docker:"
    echo "   macOS: brew install postgresql"
    echo "   Ubuntu: sudo apt-get install postgresql postgresql-contrib"
    echo "   Windows: Download from https://postgresql.org/download/"
fi
EOF

chmod +x scripts/setup-local-db.sh

# Create development scripts
echo "📜 Creating development scripts..."

# Start development script
cat > scripts/start-local-dev.sh << 'EOF'
#!/bin/bash

# Start Atlas2 local development environment
echo "🚀 Starting Atlas2 local development environment..."

# Start API in background
echo "🔧 Starting API service..."
cd api && npm run dev &
API_PID=$!
cd ..

# Start Worker in background
echo "⚙️  Starting Worker service..."
cd worker && npm run dev &
WORKER_PID=$!
cd ..

# Start Web app in background
echo "🌐 Starting Web app..."
npm run dev &
WEB_PID=$!

echo ""
echo "🎯 Development URLs:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo ""
echo "🔧 Useful commands:"
echo "  Stop all: kill $API_PID $WORKER_PID $WEB_PID"
echo "  View logs: Check individual terminal windows"
echo ""
echo "⚠️  Press Ctrl+C to stop all services"

# Wait for interrupt
trap "echo '🛑 Stopping all services...'; kill $API_PID $WORKER_PID $WEB_PID; exit" INT
wait
EOF

chmod +x scripts/start-local-dev.sh

# Create simple test script
cat > scripts/test-local.sh << 'EOF'
#!/bin/bash

# Run tests for local development
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

chmod +x scripts/test-local.sh

# Create Makefile for local development
cat > Makefile << 'EOF'
# Atlas2 Local Development Makefile

.PHONY: help install dev test build clean logs

help: ## Show this help message
	@echo "Atlas2 Local Development Commands"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install dependencies and setup development environment
	./scripts/simple-dev-setup.sh

dev: ## Start local development environment
	./scripts/start-local-dev.sh

test: ## Run all tests
	./scripts/test-local.sh all

test-unit: ## Run unit tests
	./scripts/test-local.sh unit

test-integration: ## Run integration tests
	./scripts/test-local.sh integration

test-e2e: ## Run E2E tests
	./scripts/test-local.sh e2e

build: ## Build for production
	npm run build

clean: ## Clean build artifacts and node_modules
	rm -rf dist/ build/ node_modules/ api/node_modules/ worker/node_modules/

setup-db: ## Setup local database
	./scripts/setup-local-db.sh

lint: ## Run linting
	npm run lint

lint-fix: ## Fix linting issues
	npm run lint:fix

type-check: ## Run TypeScript type checking
	npm run type-check
EOF

# Setup Git hooks (simplified)
echo "🪝 Setting up Git hooks..."
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
# Atlas2 pre-commit hook (simplified)

echo "🔍 Running pre-commit checks..."

# Run linting
echo "📝 Running linter..."
npm run lint || exit 1

# Run type checking
echo "🔧 Running type check..."
npm run type-check || exit 1

echo "✅ Pre-commit checks passed"
EOF

chmod +x .git/hooks/pre-commit

echo ""
echo "✅ Local development environment setup complete!"
echo ""
echo "🎯 Quick start:"
echo "  make dev           # Start development environment"
echo "  make test          # Run tests"
echo "  make setup-db      # Setup local database"
echo "  make lint          # Run linting"
echo ""
echo "📚 Documentation:"
echo "  Development guide: docs/development.md"
echo "  API documentation: http://localhost:3001/docs (when running)"
echo ""
echo "🔧 Environment:"
echo "  Web App: http://localhost:3000"
echo "  API: http://localhost:3001"
echo ""
echo "⚠️  Next steps:"
echo "  1. Review and update .env file"
echo "  2. Setup local database: make setup-db"
echo "  3. Start development: make dev"
echo "  4. Run tests: make test"
EOF

chmod +x scripts/simple-dev-setup.sh