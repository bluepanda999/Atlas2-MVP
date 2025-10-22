#!/bin/bash

# Atlas2 Development Environment Stop Script
# Gracefully stops all development services

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.dev.yml"
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

# Function to stop application services
stop_applications() {
    print_header "Stopping Application Services"
    
    # Stop API server
    if [ -f "$LOGS_DIR/api.pid" ]; then
        API_PID=$(cat "$LOGS_DIR/api.pid")
        if ps -p $API_PID > /dev/null 2>&1; then
            print_status "Stopping API server (PID: $API_PID)..."
            kill $API_PID
            sleep 2
            if ps -p $API_PID > /dev/null 2>&1; then
                print_warning "Force killing API server..."
                kill -9 $API_PID
            fi
            print_success "API server stopped"
        else
            print_warning "API server process not found"
        fi
        rm -f "$LOGS_DIR/api.pid"
    else
        print_warning "API server PID file not found"
    fi
    
    # Stop Worker service
    if [ -f "$LOGS_DIR/worker.pid" ]; then
        WORKER_PID=$(cat "$LOGS_DIR/worker.pid")
        if ps -p $WORKER_PID > /dev/null 2>&1; then
            print_status "Stopping Worker service (PID: $WORKER_PID)..."
            kill $WORKER_PID
            sleep 2
            if ps -p $WORKER_PID > /dev/null 2>&1; then
                print_warning "Force killing Worker service..."
                kill -9 $WORKER_PID
            fi
            print_success "Worker service stopped"
        else
            print_warning "Worker service process not found"
        fi
        rm -f "$LOGS_DIR/worker.pid"
    else
        print_warning "Worker service PID file not found"
    fi
    
    # Stop Web application
    if [ -f "$LOGS_DIR/web.pid" ]; then
        WEB_PID=$(cat "$LOGS_DIR/web.pid")
        if ps -p $WEB_PID > /dev/null 2>&1; then
            print_status "Stopping Web application (PID: $WEB_PID)..."
            kill $WEB_PID
            sleep 2
            if ps -p $WEB_PID > /dev/null 2>&1; then
                print_warning "Force killing Web application..."
                kill -9 $WEB_PID
            fi
            print_success "Web application stopped"
        else
            print_warning "Web application process not found"
        fi
        rm -f "$LOGS_DIR/web.pid"
    else
        print_warning "Web application PID file not found"
    fi
}

# Function to stop infrastructure services
stop_infrastructure() {
    print_header "Stopping Infrastructure Services"
    
    cd "$PROJECT_ROOT"
    
    if [ -f "$COMPOSE_FILE" ]; then
        print_status "Stopping Podman Compose services..."
        podman-compose -f "$COMPOSE_FILE" down
        print_success "Infrastructure services stopped"
    else
        print_warning "Compose file not found: $COMPOSE_FILE"
    fi
}

# Function to clean up remaining processes
cleanup_processes() {
    print_header "Cleaning Up Remaining Processes"
    
    # Kill any remaining Node.js processes related to Atlas2
    print_status "Checking for remaining Node.js processes..."
    
    # Find and kill processes that might be related to Atlas2
    pkill -f "node.*api" 2>/dev/null || true
    pkill -f "node.*worker" 2>/dev/null || true
    pkill -f "vite.*atlas2" 2>/dev/null || true
    pkill -f "npm.*dev.*atlas2" 2>/dev/null || true
    
    print_success "Process cleanup completed"
}

# Function to show final status
show_status() {
    print_header "Final Status"
    
    # Check if any containers are still running
    RUNNING_CONTAINERS=$(podman ps --format "table {{.Names}}" | grep atlas2 2>/dev/null || true)
    if [ -n "$RUNNING_CONTAINERS" ]; then
        print_warning "Some Atlas2 containers are still running:"
        echo "$RUNNING_CONTAINERS"
        echo -e "\n${YELLOW}To stop them manually: podman stop \$(podman ps -q --filter name=atlas2)${NC}"
    else
        print_success "All Atlas2 containers stopped"
    fi
    
    # Check if any processes are still running
    REMAINING_PROCESSES=$(ps aux | grep -E "(node|npm)" | grep -v grep | grep -E "(atlas2|api|worker|vite)" || true)
    if [ -n "$REMAINING_PROCESSES" ]; then
        print_warning "Some Atlas2 processes are still running:"
        echo "$REMAINING_PROCESSES"
    else
        print_success "All Atlas2 processes stopped"
    fi
}

# Function to show logs location
show_logs_info() {
    echo -e "\n${BLUE}Logs are available at:${NC}"
    echo -e "  📝 API:     $LOGS_DIR/api.log"
    echo -e "  👷 Worker:  $LOGS_DIR/worker.log"
    echo -e "  🌐 Web:     $LOGS_DIR/web.log"
    echo -e "\n${YELLOW}To restart: ./scripts/dev-start.sh${NC}"
}

# Main execution
main() {
    print_header "Atlas2 Development Environment Shutdown"
    
    # Change to project root
    cd "$PROJECT_ROOT"
    
    # Run shutdown steps
    stop_applications
    stop_infrastructure
    cleanup_processes
    show_status
    show_logs_info
    
    print_header "Shutdown Complete!"
    print_success "Atlas2 development environment has been stopped"
}

# Handle script interruption
trap 'print_warning "Script interrupted. Some services may still be running..."; exit 1' INT

# Run main function
main "$@"