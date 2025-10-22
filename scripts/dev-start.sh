#!/bin/bash

# Atlas2 Development Environment Startup Script
# Uses Podman Compose to spin up the complete development stack

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev-simple.yml"
ENV_FILE="$PROJECT_ROOT/.env"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${PURPLE}=====================================${NC}"
    echo -e "${PURPLE}$1${NC}"
    echo -e "${PURPLE}=====================================${NC}"
}

# Function to check if Podman is available
check_podman() {
    if ! command -v podman &> /dev/null; then
        print_error "Podman is not installed or not in PATH"
        echo "Please install Podman: https://podman.io/getting-started/"
        exit 1
    fi
    
    if ! command -v podman-compose &> /dev/null; then
        print_error "Podman Compose is not installed or not in PATH"
        echo "Please install Podman Compose: pip install podman-compose"
        exit 1
    fi
    
    print_success "Podman and Podman Compose are available"
}

# Function to check if Node.js is available
check_nodejs() {
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed or not in PATH"
        echo "Please install Node.js: https://nodejs.org/"
        exit 1
    fi
    
    NODE_VERSION=$(node --version | cut -d'v' -f2)
    print_success "Node.js $NODE_VERSION is available"
}

# Function to create environment file if it doesn't exist
setup_environment() {
    if [ ! -f "$ENV_FILE" ]; then
        print_warning "Environment file not found, creating from template..."
        cp "$PROJECT_ROOT/.env.example" "$ENV_FILE" 2>/dev/null || {
            print_status "Creating default environment file..."
            cat > "$ENV_FILE" << 'EOF'
# Application Environment
NODE_ENV=development

# Database Configuration
POSTGRES_PASSWORD=atlas2_password
DATABASE_URL=postgresql://atlas2:atlas2_password@localhost:5432/atlas2_dev

# Redis Configuration
REDIS_URL=redis://localhost:6379

# JWT Configuration
JWT_SECRET=your-super-secret-jwt-key-for-development-only-32-chars
JWT_REFRESH_SECRET=your-super-secret-refresh-key-for-development-32-chars
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# API Configuration
API_RATE_LIMIT=100
API_TIMEOUT=30000

# File Processing Configuration
MAX_FILE_SIZE=3221225472  # 3GB in bytes
CHUNK_SIZE=1048576        # 1MB chunks
MAX_MEMORY_USAGE=524288000 # 500MB

# Worker Configuration
WORKER_CONCURRENCY=4

# Monitoring Configuration
GRAFANA_PASSWORD=admin123

# Authentication Configuration
BASIC_AUTH_ENABLED=true
BEARER_AUTH_ENABLED=true
REQUIRE_SECURE_AUTH=false

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true

# Server Configuration
PORT=3001
WEB_PORT=3000

# Encryption
ENCRYPTION_KEY=your-32-character-encryption-key-here
EOF
        }
        print_success "Environment file created at $ENV_FILE"
    else
        print_success "Environment file found at $ENV_FILE"
    fi
}

# Function to install dependencies
install_dependencies() {
    print_header "Installing Dependencies"
    
    print_status "Installing root dependencies..."
    cd "$PROJECT_ROOT"
    npm install
    
    print_status "Installing API dependencies..."
    cd "$PROJECT_ROOT/api"
    npm install
    
    print_status "Installing worker dependencies..."
    cd "$PROJECT_ROOT/worker"
    npm install
    
    print_success "All dependencies installed"
}

# Function to start all containerized services
start_all_services() {
    print_header "Starting All Containerized Services"
    
    cd "$PROJECT_ROOT"
    
    # Remove any existing containers to ensure clean start
    print_status "Cleaning up any existing containers..."
    podman-compose -f "$COMPOSE_FILE" down -v 2>/dev/null || true
    
    print_status "Building and starting all services..."
    podman-compose -f "$COMPOSE_FILE" up -d --build
    
    print_status "Waiting for services to be ready..."
    sleep 15
    
    # Check if database is ready
    local db_ready=false
    for i in {1..60}; do
        if podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev >/dev/null 2>&1; then
            print_success "Database is ready"
            db_ready=true
            break
        fi
        
        if [ $((i % 10)) -eq 0 ]; then
            print_status "Still waiting for database... (${i}/60 seconds)"
        fi
        
        sleep 1
    done
    
    if [ "$db_ready" = false ]; then
        print_error "Database failed to start within 60 seconds"
        print_status "Checking PostgreSQL logs..."
        podman logs atlas2-postgres | tail -20
        exit 1
    fi
    
    # Check if Redis is ready
    local redis_ready=false
    for i in {1..30}; do
        if podman exec atlas2-redis redis-cli ping >/dev/null 2>&1; then
            print_success "Redis is ready"
            redis_ready=true
            break
        fi
        sleep 1
    done
    
    if [ "$redis_ready" = false ]; then
        print_error "Redis failed to start within 30 seconds"
        exit 1
    fi
    
    print_success "All services are starting up"
}

# Function to verify database initialization
verify_database() {
    print_header "Verifying Database Setup"
    
    cd "$PROJECT_ROOT"
    
    # Wait a bit for the init script to complete
    sleep 10
    
    # Verify database schema
    local table_count=$(podman exec atlas2-postgres psql -U atlas2 -d atlas2_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
    print_status "Database contains $table_count tables"
    
    if [ "$table_count" -gt 0 ]; then
        print_success "Database initialization completed successfully"
    else
        print_warning "Database might still be initializing, but services should start shortly"
    fi
}



# Function to wait for containerized services to be ready
wait_for_services() {
    print_header "Waiting for Services to be Ready"
    
    # Wait for API server
    print_status "Waiting for API server..."
    for i in {1..60}; do
        if curl -s http://localhost:3001/health >/dev/null 2>&1; then
            print_success "API server is ready"
            break
        fi
        if [ $((i % 10)) -eq 0 ]; then
            print_status "Still waiting for API server... (${i}/60 seconds)"
        fi
        if [ $i -eq 60 ]; then
            print_warning "API server might still be starting up"
            break
        fi
        sleep 2
    done
    
    # Wait for Web application
    print_status "Waiting for Web application..."
    for i in {1..60}; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "200\|404"; then
            print_success "Web application is ready"
            break
        fi
        if [ $((i % 10)) -eq 0 ]; then
            print_status "Still waiting for Web application... (${i}/60 seconds)"
        fi
        if [ $i -eq 60 ]; then
            print_warning "Web application might still be starting up"
            break
        fi
        sleep 2
    done
    
    # Wait for Grafana
    print_status "Waiting for Grafana..."
    for i in {1..30}; do
        if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/ | grep -q "302\|200"; then
            print_success "Grafana is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Grafana might still be starting up"
            break
        fi
        sleep 2
    done
    
    # Wait for Prometheus
    print_status "Waiting for Prometheus..."
    for i in {1..30}; do
        if curl -s http://localhost:9090/-/healthy >/dev/null 2>&1; then
            print_success "Prometheus is ready"
            break
        fi
        if [ $i -eq 30 ]; then
            print_warning "Prometheus might still be starting up"
            break
        fi
        sleep 2
    done
    
    print_success "All services are ready"
}

# Function to display service URLs
display_service_urls() {
    print_header "Service URLs (Containerized)"
    
    echo -e "${CYAN}Application Services:${NC}"
    echo -e "  🌐 Web Application: ${GREEN}http://localhost:3000${NC} (atlas2-web container)"
    echo -e "  🔧 API Server:      ${GREEN}http://localhost:3001${NC} (atlas2-api container)"
    echo -e "  📊 API Health:      ${GREEN}http://localhost:3001/health${NC}"
    echo -e "  👷 Worker Service:  ${GREEN}atlas2-worker container${NC} (background processing)"
    
    echo -e "\n${CYAN}Monitoring Services:${NC}"
    echo -e "  📈 Prometheus:      ${GREEN}http://localhost:9090${NC}"
    echo -e "  📊 Grafana:         ${GREEN}http://localhost:3002${NC}"
    echo -e "     Admin: ${YELLOW}admin${NC} / ${YELLOW}admin${NC}"
    echo -e "  🪵 Loki:            ${GREEN}http://localhost:3100${NC} (log aggregation)"
    echo -e "  🔍 Node Exporter:   ${GREEN}http://localhost:9100${NC} (metrics)"
    
    echo -e "\n${CYAN}Database Services:${NC}"
    echo -e "  🗄️  PostgreSQL:      ${GREEN}localhost:5432${NC} (atlas2-postgres container)"
    echo -e "  🔴 Redis:           ${GREEN}localhost:6379${NC} (atlas2-redis container)"
    
    echo -e "\n${CYAN}Container Management:${NC}"
    echo -e "  🐳 View Containers: ${GREEN}podman ps${NC}"
    echo -e "  📝 View Logs:       ${GREEN}podman logs <container-name>${NC}"
    echo -e "  🛑 Stop Services:   ${GREEN}./scripts/dev-stop.sh${NC}"
    echo -e "  🧪 Run Tests:       ${GREEN}./test-system.sh${NC}"
}

# Function to create logs directory
create_logs_directory() {
    mkdir -p "$PROJECT_ROOT/logs"
}

# Main execution
main() {
    print_header "Atlas2 Development Environment Startup (Containerized)"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run setup steps
    check_podman
    check_nodejs
    setup_environment
    create_logs_directory
    install_dependencies
    print_status "Dependencies installed, starting all containerized services..."
    start_all_services
    print_status "Services started, verifying database..."
    verify_database
    print_status "Database verified, waiting for services to be ready..."
    wait_for_services
    display_service_urls
    
    print_header "Development Environment Ready!"
    print_success "Atlas2 is now running in fully containerized development mode"
    print_status "All services are running in containers"
    print_status "Use 'podman logs <container-name>' to view individual service logs"
    
    echo -e "\n${YELLOW}Tip: Use './scripts/dev-stop.sh' to stop all services${NC}"
}

# Handle script interruption
trap 'print_warning "Script interrupted. Some services may still be starting..."; exit 1' INT

# Run main function
main "$@"