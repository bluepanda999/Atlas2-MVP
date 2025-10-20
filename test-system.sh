#!/bin/bash

echo "🧪 Atlas2 Comprehensive System Test"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test
run_test() {
    local test_name="$1"
    local command="$2"
    local expected_pattern="$3"
    
    echo -n "Testing $test_name... "
    
    if result=$(eval "$command" 2>/dev/null); then
        if [[ "$result" =~ $expected_pattern ]]; then
            echo -e "${GREEN}✅ PASS${NC}"
            ((TESTS_PASSED++))
            return 0
        else
            echo -e "${RED}❌ FAIL${NC} - Unexpected response"
            echo "  Expected: $expected_pattern"
            echo "  Got: $result"
            ((TESTS_FAILED++))
            return 1
        fi
    else
        echo -e "${RED}❌ FAIL${NC} - Command failed"
        ((TESTS_FAILED++))
        return 1
    fi
}

echo "📊 Infrastructure Tests"
echo "----------------------"

# Test PostgreSQL
run_test "PostgreSQL Connection" \
    "cd api && node -e \"const { Pool } = require('pg'); const pool = new Pool({user: 'atlas2', host: 'localhost', database: 'atlas2_dev', password: 'atlas2_password', port: 5432}); pool.query('SELECT NOW()').then(res => console.log('OK')).catch(err => console.log('ERROR')).finally(() => pool.end());\"" \
    "OK"

# Test Redis
run_test "Redis Connection" \
    "cd api && node -e \"const redis = require('redis'); const client = redis.createClient({ url: 'redis://localhost:6379' }); client.connect().then(() => client.ping()).then(res => console.log('OK')).catch(err => console.log('ERROR')).finally(() => client.quit());\"" \
    "OK"

echo ""
echo "🌐 API Tests"
echo "------------"

# Test API Health
run_test "API Health Endpoint" \
    "curl -s http://localhost:3001/health" \
    "healthy"

# Test API Info
run_test "API Info Endpoint" \
    "curl -s http://localhost:3001/" \
    "Atlas2 API"

# Test Basic Auth
run_test "Basic Authentication" \
    "curl -s -u admin:password http://localhost:3001/auth/test" \
    "authentication.*Basic"

# Test Bearer Token
run_test "Bearer Token Authentication" \
    "curl -s -H 'Authorization: Bearer test-token' http://localhost:3001/auth/test" \
    "authentication.*Bearer"

echo ""
echo "🖥️  Web Application Tests"
echo "-------------------------"

# Test Web App
run_test "Web Application Serving" \
    "curl -s -I http://localhost:3000/ | head -1" \
    "200 OK"

echo ""
echo "📈 Monitoring Tests"
echo "-------------------"

# Test Prometheus
run_test "Prometheus Health" \
    "curl -s http://localhost:9090/-/healthy" \
    "Prometheus Server is Healthy"

# Test Grafana
run_test "Grafana Accessibility" \
    "curl -s -I http://localhost:3002/ | head -1" \
    "302 Found"

echo ""
echo "🔒 Security Tests"
echo "-----------------"

# Test API without auth (should still work for public endpoints)
run_test "Public Endpoint Access" \
    "curl -s http://localhost:3001/health" \
    "healthy"

# Test with invalid credentials (should work for public endpoints)
run_test "Invalid Auth Handling" \
    "curl -s -u invalid:credentials http://localhost:3001/auth/test" \
    "Atlas2 API is running"

echo ""
echo "📋 Test Results Summary"
echo "======================"
echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
echo -e "Total Tests:  $((TESTS_PASSED + TESTS_FAILED))"

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "\n🎉 ${GREEN}All tests passed! Atlas2 is working correctly.${NC}"
    exit 0
else
    echo -e "\n⚠️  ${YELLOW}Some tests failed. Please check the output above.${NC}"
    exit 1
fi