#!/bin/bash

# Atlas2 Testing Script
# Runs comprehensive test suite with coverage reporting

set -e

echo "🧪 Starting Atlas2 Test Suite"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if test database exists and create if needed
setup_test_database() {
    print_status "Setting up test database..."
    
    # Check if PostgreSQL is running
    if ! pg_isready -q; then
        print_warning "PostgreSQL is not running. Starting test database..."
        # Start PostgreSQL if needed (adjust based on your setup)
        docker-compose -f docker-compose.test.yml up -d postgres-test || {
            print_error "Failed to start test database"
            exit 1
        }
        
        # Wait for database to be ready
        sleep 5
    fi
    
    # Create test database if it doesn't exist
    psql -h localhost -U test -c "CREATE DATABASE atlas2_test;" 2>/dev/null || true
    
    print_status "Test database ready"
}

# Run unit tests
run_unit_tests() {
    print_status "Running Unit Tests..."
    npm run test:unit
    
    if [ $? -eq 0 ]; then
        print_status "Unit tests passed ✅"
    else
        print_error "Unit tests failed ❌"
        exit 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_status "Running Integration Tests..."
    npm run test:integration
    
    if [ $? -eq 0 ]; then
        print_status "Integration tests passed ✅"
    else
        print_error "Integration tests failed ❌"
        exit 1
    fi
}

# Run E2E tests
run_e2e_tests() {
    print_status "Running E2E Tests..."
    npm run test:e2e
    
    if [ $? -eq 0 ]; then
        print_status "E2E tests passed ✅"
    else
        print_error "E2E tests failed ❌"
        exit 1
    fi
}

# Generate coverage report
generate_coverage() {
    print_status "Generating Coverage Report..."
    npm run test:coverage
    
    if [ $? -eq 0 ]; then
        print_status "Coverage report generated ✅"
        
        # Check coverage thresholds
        COVERAGE_FILE="coverage/coverage-summary.json"
        if [ -f "$COVERAGE_FILE" ]; then
            LINES_COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('$COVERAGE_FILE', 'utf8')).total.lines.pct")
            FUNCTIONS_COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('$COVERAGE_FILE', 'utf8')).total.functions.pct")
            BRANCHES_COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('$COVERAGE_FILE', 'utf8')).total.branches.pct")
            STATEMENTS_COVERAGE=$(node -p "JSON.parse(require('fs').readFileSync('$COVERAGE_FILE', 'utf8')).total.statements.pct")
            
            echo ""
            print_status "Coverage Summary:"
            echo "  Lines: ${LINES_COVERAGE}%"
            echo "  Functions: ${FUNCTIONS_COVERAGE}%"
            echo "  Branches: ${BRANCHES_COVERAGE}%"
            echo "  Statements: ${STATEMENTS_COVERAGE}%"
            
            # Check if coverage meets minimum threshold (80%)
            MIN_COVERAGE=80
            if (( $(echo "$LINES_COVERAGE >= $MIN_COVERAGE" | bc -l) )); then
                print_status "Coverage threshold met (${MIN_COVERAGE}%) ✅"
            else
                print_warning "Coverage below threshold (${MIN_COVERAGE}%) ⚠️"
            fi
        fi
    else
        print_error "Coverage generation failed ❌"
        exit 1
    fi
}

# Run linting
run_linting() {
    print_status "Running ESLint..."
    npm run lint
    
    if [ $? -eq 0 ]; then
        print_status "Linting passed ✅"
    else
        print_error "Linting failed ❌"
        exit 1
    fi
}

# Run type checking
run_type_check() {
    print_status "Running TypeScript Type Check..."
    npm run type-check
    
    if [ $? -eq 0 ]; then
        print_status "Type check passed ✅"
    else
        print_error "Type check failed ❌"
        exit 1
    fi
}

# Main execution
main() {
    local test_type=${1:-"all"}
    
    case $test_type in
        "unit")
            setup_test_database
            run_unit_tests
            ;;
        "integration")
            setup_test_database
            run_integration_tests
            ;;
        "e2e")
            setup_test_database
            run_e2e_tests
            ;;
        "coverage")
            setup_test_database
            generate_coverage
            ;;
        "lint")
            run_linting
            ;;
        "type-check")
            run_type_check
            ;;
        "ci")
            setup_test_database
            run_linting
            run_type_check
            run_unit_tests
            run_integration_tests
            generate_coverage
            ;;
        "all"|*)
            setup_test_database
            run_linting
            run_type_check
            run_unit_tests
            run_integration_tests
            run_e2e_tests
            generate_coverage
            ;;
    esac
    
    echo ""
    print_status "All tests completed successfully! 🎉"
}

# Parse command line arguments
if [ $# -eq 0 ]; then
    main "all"
else
    main "$1"
fi