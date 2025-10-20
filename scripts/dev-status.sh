#!/bin/bash

# Atlas2 Development Environment Status Script
# Shows the current status of all development services

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

# Function to check service status
check_service() {
    local service_name="$1"
    local url="$2"
    local expected_pattern="${3:-.*}"
    
    echo -n "  $service_name: "
    
    if curl -s --max-time 5 "$url" 2>/dev/null | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ DOWN${NC}"
        return 1
    fi
}

# Function to check container status
check_container() {
    local container_name="$1"
    local display_name="$2"
    
    echo -n "  $display_name: "
    
    if podman ps --format "{{.Names}}" | grep -q "^${container_name}$"; then
        echo -e "${GREEN}✅ RUNNING${NC}"
        return 0
    else
        echo -e "${RED}❌ STOPPED${NC}"
        return 1
    fi
}

# Function to check process status
check_process() {
    local pid_file="$1"
    local process_name="$2"
    
    echo -n "  $process_name: "
    
    if [ -f "$pid_file" ]; then
        local pid=$(cat "$pid_file")
        if ps -p "$pid" > /dev/null 2>&1; then
            echo -e "${GREEN}✅ RUNNING${NC} (PID: $pid)"
            return 0
        else
            echo -e "${RED}❌ STOPPED${NC} (stale PID file)"
            return 1
        fi
    else
        echo -e "${RED}❌ STOPPED${NC} (no PID file)"
        return 1
    fi
}

# Function to show application services status
show_application_status() {
    print_header "Application Services Status"
    
    # Check Web Application
    check_service "Web App" "http://localhost:3000/" "html\|DOCTYPE"
    
    # Check API Server
    check_service "API Server" "http://localhost:3001/health" "healthy"
    
    # Check API Auth
    check_service "API Auth" "http://localhost:3001/auth/test" "Atlas2 API"
    
    # Check process status
    echo -e "\n${CYAN}Process Status:${NC}"
    check_process "$LOGS_DIR/web.pid" "Web Process"
    check_process "$LOGS_DIR/api.pid" "API Process"
    check_process "$LOGS_DIR/worker.pid" "Worker Process"
}

# Function to show infrastructure status
show_infrastructure_status() {
    print_header "Infrastructure Status"
    
    echo -e "${CYAN}Container Status:${NC}"
    check_container "atlas2-postgres" "PostgreSQL"
    check_container "atlas2-redis" "Redis"
    check_container "atlas2-prometheus" "Prometheus"
    check_container "atlas2-grafana" "Grafana"
    
    echo -e "\n${CYAN}Service Health:${NC}"
    check_service "PostgreSQL" "http://localhost:5432" "" || echo -e "  PostgreSQL: ${YELLOW}⚠️  No HTTP endpoint (use container check)${NC}"
    check_service "Redis" "http://localhost:6379" "" || echo -e "  Redis: ${YELLOW}⚠️  No HTTP endpoint (use container check)${NC}"
    check_service "Prometheus" "http://localhost:9090/-/healthy" "Prometheus Server is Healthy"
    check_service "Grafana" "http://localhost:3002/login" "Grafana"
}

# Function to show database connectivity
show_database_status() {
    print_header "Database Connectivity"
    
    # Check PostgreSQL
    echo -n "  PostgreSQL Connection: "
    if podman exec atlas2-postgres pg_isready -U atlas2 -d atlas2_dev >/dev/null 2>&1; then
        echo -e "${GREEN}✅ CONNECTED${NC}"
        
        # Get table count
        local table_count=$(podman exec atlas2-postgres psql -U atlas2 -d atlas2_dev -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ' || echo "0")
        echo -e "  Tables in database: ${GREEN}$table_count${NC}"
    else
        echo -e "${RED}❌ DISCONNECTED${NC}"
    fi
    
    # Check Redis
    echo -n "  Redis Connection: "
    if podman exec atlas2-redis redis-cli ping >/dev/null 2>&1; then
        echo -e "${GREEN}✅ CONNECTED${NC}"
        
        # Get Redis info
        local redis_info=$(podman exec atlas2-redis redis-cli info server 2>/dev/null | grep "redis_version" | cut -d: -f2 | tr -d '\r' || echo "unknown")
        echo -e "  Redis Version: ${GREEN}$redis_info${NC}"
    else
        echo -e "${RED}❌ DISCONNECTED${NC}"
    fi
}

# Function to show recent logs
show_recent_logs() {
    print_header "Recent Log Activity"
    
    echo -e "${CYAN}API Logs (last 5 lines):${NC}"
    if [ -f "$LOGS_DIR/api.log" ]; then
        tail -5 "$LOGS_DIR/api.log" | sed 's/^/  /'
    else
        echo -e "  ${YELLOW}No API log file found${NC}"
    fi
    
    echo -e "\n${CYAN}Web Logs (last 5 lines):${NC}"
    if [ -f "$LOGS_DIR/web.log" ]; then
        tail -5 "$LOGS_DIR/web.log" | sed 's/^/  /'
    else
        echo -e "  ${YELLOW}No Web log file found${NC}"
    fi
    
    echo -e "\n${CYAN}Worker Logs (last 5 lines):${NC}"
    if [ -f "$LOGS_DIR/worker.log" ]; then
        tail -5 "$LOGS_DIR/worker.log" | sed 's/^/  /'
    else
        echo -e "  ${YELLOW}No Worker log file found${NC}"
    fi
}

# Function to show system resources
show_system_resources() {
    print_header "System Resources"
    
    echo -e "${CYAN}Podman Containers:${NC}"
    podman ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep atlas2 || echo -e "  ${YELLOW}No Atlas2 containers running${NC}"
    
    echo -e "\n${CYAN}Memory Usage:${NC}"
    if command -v free >/dev/null 2>&1; then
        free -h | head -2
    else
        echo -e "  ${YELLOW}free command not available${NC}"
    fi
    
    echo -e "\n${CYAN}Disk Usage:${NC}"
    if command -v df >/dev/null 2>&1; then
        df -h | head -1
        df -h | grep -E "/$|/home"
    else
        echo -e "  ${YELLOW}df command not available${NC}"
    fi
}

# Function to show quick actions
show_quick_actions() {
    print_header "Quick Actions"
    
    echo -e "${CYAN}Available Commands:${NC}"
    echo -e "  🚀 Start services:  ${GREEN}./scripts/dev-start.sh${NC}"
    echo -e "  🛑 Stop services:   ${GREEN}./scripts/dev-stop.sh${NC}"
    echo -e "  📊 Check status:    ${GREEN}./scripts/dev-status.sh${NC}"
    echo -e "  🧪 Run tests:       ${GREEN}./test-system.sh${NC}"
    echo -e "  📝 View logs:       ${GREEN}tail -f logs/api.log${NC}"
    
    echo -e "\n${CYAN}Service URLs:${NC}"
    echo -e "  🌐 Web Application: ${BLUE}http://localhost:3000${NC}"
    echo -e "  🔧 API Server:      ${BLUE}http://localhost:3001${NC}"
    echo -e "  📈 Prometheus:      ${BLUE}http://localhost:9090${NC}"
    echo -e "  📊 Grafana:         ${BLUE}http://localhost:3002${NC} (admin/admin123)"
}

# Main execution
main() {
    print_header "Atlas2 Development Environment Status"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Show status sections
    show_application_status
    show_infrastructure_status
    show_database_status
    show_system_resources
    show_recent_logs
    show_quick_actions
    
    print_header "Status Check Complete!"
}

# Run main function
main "$@"