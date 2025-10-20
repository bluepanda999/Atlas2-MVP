#!/bin/bash

# Atlas2 Development Environment Diagnostic Script
# Comprehensive troubleshooting and health analysis

set -e

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
LOGS_DIR="$PROJECT_ROOT/logs"

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

# Issue counter
ISSUES_FOUND=0

# Function to report an issue
report_issue() {
    local severity="$1"
    local component="$2"
    local issue="$3"
    local solution="$4"
    
    ((ISSUES_FOUND++))
    
    case $severity in
        "critical")
            echo -e "  ${RED}🔴 CRITICAL${NC} $component: $issue"
            ;;
        "warning")
            echo -e "  ${YELLOW}🟡 WARNING${NC} $component: $issue"
            ;;
        "info")
            echo -e "  ${BLUE}🔵 INFO${NC} $component: $issue"
            ;;
    esac
    
    if [ -n "$solution" ]; then
        echo -e "    ${CYAN}Solution:${NC} $solution"
    fi
    echo ""
}

# Function to check system requirements
check_system_requirements() {
    print_header "System Requirements Check"
    
    # Check Podman
    if command -v podman >/dev/null 2>&1; then
        local podman_version=$(podman --version | cut -d' ' -f3)
        print_success "Podman $podman_version installed"
    else
        report_issue "critical" "Podman" "Not installed or not in PATH" "Install Podman: https://podman.io/getting-started/"
    fi
    
    # Check Podman Compose
    if command -v podman-compose >/dev/null 2>&1; then
        local compose_version=$(podman-compose --version 2>/dev/null | grep -o '[0-9]\+\.[0-9]\+\.[0-9]\+' || echo "unknown")
        print_success "Podman Compose $compose_version installed"
    else
        report_issue "critical" "Podman Compose" "Not installed or not in PATH" "Install: pip install podman-compose"
    fi
    
    # Check Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version)
        print_success "Node.js $node_version installed"
        
        # Check if version is adequate
        local node_major=$(echo $node_version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_major" -lt 18 ]; then
            report_issue "warning" "Node.js" "Version $node_version may be too old" "Upgrade to Node.js 18 or later"
        fi
    else
        report_issue "critical" "Node.js" "Not installed or not in PATH" "Install Node.js: https://nodejs.org/"
    fi
    
    # Check npm
    if command -v npm >/dev/null 2>&1; then
        local npm_version=$(npm --version)
        print_success "npm $npm_version installed"
    else
        report_issue "critical" "npm" "Not installed or not in PATH" "Install npm with Node.js"
    fi
    
    # Check available memory
    if command -v free >/dev/null 2>&1; then
        local available_mem=$(free -m | awk 'NR==2{printf "%.0f", $7}')
        if [ "$available_mem" -lt 2048 ]; then
            report_issue "warning" "System Memory" "Only ${available_mem}MB available" "Recommend at least 4GB RAM for development"
        else
            print_success "System Memory: ${available_mem}MB available"
        fi
    fi
    
    # Check disk space
    if command -v df >/dev/null 2>&1; then
        local available_disk=$(df -BG . | awk 'NR==2{print $4}' | sed 's/G//')
        if [ "$available_disk" -lt 5 ]; then
            report_issue "warning" "Disk Space" "Only ${available_disk}GB available" "Recommend at least 10GB free space"
        else
            print_success "Disk Space: ${available_disk}GB available"
        fi
    fi
}

# Function to check port conflicts
check_port_conflicts() {
    print_header "Port Conflict Analysis"
    
    local ports=(3000 3001 5432 6379 9090 3002)
    local services=("Web App" "API Server" "PostgreSQL" "Redis" "Prometheus" "Grafana")
    
    for i in "${!ports[@]}"; do
        local port=${ports[$i]}
        local service=${services[$i]}
        
        if command -v netstat >/dev/null 2>&1; then
            local port_in_use=$(netstat -tulpn 2>/dev/null | grep ":$port ")
            if [ -n "$port_in_use" ]; then
                local process=$(echo "$port_in_use" | awk '{print $7}' | cut -d'/' -f2)
                report_issue "warning" "Port $port" "Already in use by $process" "Stop conflicting process or change port in .env"
            else
                print_success "Port $port ($service) is available"
            fi
        elif command -v ss >/dev/null 2>&1; then
            local port_in_use=$(ss -tulpn 2>/dev/null | grep ":$port ")
            if [ -n "$port_in_use" ]; then
                local process=$(echo "$port_in_use" | awk '{print $7}' | cut -d'/' -f2)
                report_issue "warning" "Port $port" "Already in use by $process" "Stop conflicting process or change port in .env"
            else
                print_success "Port $port ($service) is available"
            fi
        else
            print_warning "Cannot check port conflicts (netstat/ss not available)"
        fi
    done
}

# Function to check container health
check_container_health() {
    print_header "Container Health Analysis"
    
    local containers=("atlas2-postgres" "atlas2-redis" "atlas2-prometheus" "atlas2-grafana")
    local services=("PostgreSQL" "Redis" "Prometheus" "Grafana")
    
    for i in "${!containers[@]}"; do
        local container=${containers[$i]}
        local service=${services[$i]}
        
        # Check if container exists
        if podman ps -a --format "{{.Names}}" | grep -q "^${container}$"; then
            # Check if container is running
            if podman ps --format "{{.Names}}" | grep -q "^${container}$"; then
                # Check container health
                local health_status=$(podman inspect "$container" --format "{{.State.Health.Status}}" 2>/dev/null || echo "unknown")
                local status=$(podman inspect "$container" --format "{{.State.Status}}")
                
                if [ "$status" = "running" ]; then
                    if [ "$health_status" = "healthy" ] || [ "$health_status" = "unknown" ]; then
                        print_success "$service container is healthy"
                    else
                        report_issue "warning" "$service" "Container health: $health_status" "Check container logs: podman logs $container"
                    fi
                else
                    report_issue "critical" "$service" "Container status: $status" "Restart container: podman start $container"
                fi
            else
                report_issue "critical" "$service" "Container is stopped" "Start container: podman start $container"
            fi
        else
            report_issue "warning" "$service" "Container not found" "Run: ./scripts/dev-start.sh"
        fi
    done
}

# Function to check application processes
check_application_processes() {
    print_header "Application Process Analysis"
    
    local processes=("Web App" "API Server" "Worker Service")
    local pid_files=("web.pid" "api.pid" "worker.pid")
    local log_files=("web.log" "api.log" "worker.log")
    
    for i in "${!processes[@]}"; do
        local process=${processes[$i]}
        local pid_file="${LOGS_DIR}/${pid_files[$i]}"
        local log_file="${LOGS_DIR}/${log_files[$i]}"
        
        if [ -f "$pid_file" ]; then
            local pid=$(cat "$pid_file")
            if ps -p "$pid" > /dev/null 2>&1; then
                # Check if process is responsive
                case $process in
                    "Web App")
                        if curl -s --max-time 2 http://localhost:3000/ >/dev/null 2>&1; then
                            print_success "$process is running and responsive (PID: $pid)"
                        else
                            report_issue "warning" "$process" "Running but not responding" "Check logs: tail -f $log_file"
                        fi
                        ;;
                    "API Server")
                        if curl -s --max-time 2 http://localhost:3001/health >/dev/null 2>&1; then
                            print_success "$process is running and responsive (PID: $pid)"
                        else
                            report_issue "warning" "$process" "Running but not responding" "Check logs: tail -f $log_file"
                        fi
                        ;;
                    "Worker Service")
                        print_success "$process is running (PID: $pid)"
                        ;;
                esac
            else
                report_issue "critical" "$process" "PID file exists but process not running" "Remove stale PID: rm $pid_file"
            fi
        else
            report_issue "warning" "$process" "Not running (no PID file)" "Start with: ./scripts/dev-start.sh"
        fi
    done
}

# Function to check database connectivity
check_database_connectivity() {
    print_header "Database Connectivity Analysis"
    
    # Check PostgreSQL
    if podman ps --format "{{.Names}}" | grep -q "atlas2-postgres"; then
        # Test basic connectivity
        if podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev >/dev/null 2>&1; then
            print_success "PostgreSQL is ready"
            
            # Check database exists
            local db_exists=$(podman exec atlas2-postgres psql -U atlas2 -d postgres -t -c "SELECT 1 FROM pg_database WHERE datname='atlas2_dev';" 2>/dev/null | tr -d ' ')
            if [ "$db_exists" = "1" ]; then
                print_success "Database 'atlas2_dev' exists"
                
                # Check table count
                local table_count=$(podman exec atlas2-postgres psql -U atlas2 -d atlas2_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
                if [ "$table_count" -ge 10 ]; then
                    print_success "Database schema loaded ($table_count tables)"
                else
                    report_issue "warning" "Database Schema" "Only $table_count tables found" "Run migrations: ./scripts/dev-start.sh"
                fi
            else
                report_issue "critical" "Database" "Database 'atlas2_dev' not found" "Create database: podman exec atlas2-postgres createdb -U atlas2 atlas2_dev"
            fi
        else
            report_issue "critical" "PostgreSQL" "Not ready" "Check container: podman logs atlas2-postgres"
        fi
    else
        report_issue "critical" "PostgreSQL" "Container not running" "Start with: ./scripts/dev-start.sh"
    fi
    
    # Check Redis
    if podman ps --format "{{.Names}}" | grep -q "atlas2-redis"; then
        if podman exec atlas2-redis redis-cli ping >/dev/null 2>&1; then
            print_success "Redis is responsive"
            
            # Check Redis info
            local redis_info=$(podman exec atlas2-redis redis-cli info server 2>/dev/null | head -5)
            print_success "Redis server info available"
        else
            report_issue "critical" "Redis" "Not responding" "Check container: podman logs atlas2-redis"
        fi
    else
        report_issue "critical" "Redis" "Container not running" "Start with: ./scripts/dev-start.sh"
    fi
}

# Function to check recent errors in logs
check_log_errors() {
    print_header "Recent Error Analysis"
    
    local log_files=("api.log" "web.log" "worker.log")
    local services=("API Server" "Web App" "Worker Service")
    
    for i in "${!log_files[@]}"; do
        local log_file="${LOGS_DIR}/${log_files[$i]}"
        local service=${services[$i]}
        
        if [ -f "$log_file" ]; then
            # Count recent errors
            local error_count=$(grep -c -i "error\|exception\|failed" "$log_file" 2>/dev/null || echo "0")
            local recent_errors=$(tail -100 "$log_file" 2>/dev/null | grep -i -c "error\|exception\|failed" || echo "0")
            
            if [ "$recent_errors" -gt 0 ]; then
                report_issue "warning" "$service" "$recent_errors recent errors in last 100 lines" "Check logs: tail -50 $log_file"
                
                # Show last error
                local last_error=$(tail -100 "$log_file" 2>/dev/null | grep -i "error\|exception\|failed" | tail -1)
                if [ -n "$last_error" ]; then
                    echo -e "    ${CYAN}Last error:${NC} ${last_error:0:100}..."
                fi
            elif [ "$error_count" -gt 0 ]; then
                print_success "$service: No recent errors (total: $error_count)"
            else
                print_success "$service: No errors found"
            fi
        else
            report_issue "info" "$service" "No log file found" "Log will be created when service starts"
        fi
    done
}

# Function to check environment configuration
check_environment_config() {
    print_header "Environment Configuration Analysis"
    
    local env_file="$PROJECT_ROOT/.env"
    
    if [ -f "$env_file" ]; then
        print_success "Environment file exists"
        
        # Check critical variables
        local critical_vars=("NODE_ENV" "DATABASE_URL" "REDIS_URL" "JWT_SECRET")
        
        for var in "${critical_vars[@]}"; do
            if grep -q "^${var}=" "$env_file"; then
                local value=$(grep "^${var}=" "$env_file" | cut -d'=' -f2)
                if [ -n "$value" ]; then
                    print_success "$var is set"
                else
                    report_issue "warning" "Environment" "$var is empty" "Set value in .env file"
                fi
            else
                report_issue "warning" "Environment" "$var not found" "Add to .env file"
            fi
        done
        
        # Check for default secrets
        if grep -q "your-super-secret" "$env_file"; then
            report_issue "warning" "Security" "Default secrets detected" "Change JWT_SECRET and other secrets"
        fi
        
    else
        report_issue "critical" "Environment" ".env file not found" "Create from .env.example or run: ./scripts/dev-start.sh"
    fi
}

# Function to provide fix recommendations
provide_fix_recommendations() {
    print_header "Fix Recommendations"
    
    if [ "$ISSUES_FOUND" -eq 0 ]; then
        print_success "No issues found! Everything looks healthy."
        return
    fi
    
    echo -e "${YELLOW}Found $ISSUES_FOUND issue(s). Recommended actions:${NC}"
    echo ""
    
    echo -e "${CYAN}1. Quick Fixes:${NC}"
    echo "   • Restart services: ./scripts/dev-stop.sh && ./scripts/dev-start.sh"
    echo "   • Check logs: tail -f logs/*.log"
    echo "   • Run tests: ./test-system.sh"
    echo ""
    
    echo -e "${CYAN}2. Common Solutions:${NC}"
    echo "   • Port conflicts: Stop conflicting services or change ports in .env"
    echo "   • Memory issues: Free up RAM or close other applications"
    echo "   • Permission issues: chmod +x scripts/*.sh"
    echo "   • Container issues: podman system prune -f"
    echo ""
    
    echo -e "${CYAN}3. Deep Clean:${NC}"
    echo "   • Full reset: ./scripts/dev-stop.sh && podman system prune -af && ./scripts/dev-start.sh"
    echo "   • Database reset: podman volume rm atlas2_postgres_data"
    echo ""
    
    echo -e "${CYAN}4. Get Help:${NC}"
    echo "   • Check documentation: cat scripts/README.md"
    echo "   • Review logs: ls -la logs/"
    echo "   • System status: ./scripts/dev-status.sh"
}

# Main execution
main() {
    print_header "Atlas2 Development Environment Diagnostic"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run diagnostic checks
    check_system_requirements
    check_port_conflicts
    check_container_health
    check_application_processes
    check_database_connectivity
    check_log_errors
    check_environment_config
    provide_fix_recommendations
    
    print_header "Diagnostic Complete"
    
    if [ "$ISSUES_FOUND" -eq 0 ]; then
        print_success "No issues detected! Your Atlas2 environment is healthy."
        exit 0
    else
        print_warning "Found $ISSUES_FOUND issue(s) that may need attention."
        exit 1
    fi
}

# Run main function
main "$@"