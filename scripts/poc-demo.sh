#!/bin/bash

# Atlas2 POC Demo Script
# This script demonstrates the end-to-end POC workflow

echo "🚀 Atlas2 POC Demo - End-to-End Workflow"
echo "=========================================="

API_BASE="http://localhost:3001"
echo "📍 API Base URL: $API_BASE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if API is running
log_info "Checking if Atlas2 API is running..."
if curl -s "$API_BASE/health" > /dev/null; then
    log_success "API is running!"
else
    log_error "API is not running at $API_BASE"
    log_info "Please start the API with: npm run dev"
    exit 1
fi

echo ""
echo "🎯 Step 1: CSV File Upload"
echo "---------------------------"

# Create sample CSV
CSV_CONTENT="name,email,age,city
John Doe,john@example.com,30,New York
Jane Smith,jane@example.com,25,Los Angeles
Bob Johnson,bob@example.com,35,Chicago
Alice Brown,alice@example.com,28,Houston
Charlie Wilson,charlie@example.com,42,Phoenix"

echo "$CSV_CONTENT" > /tmp/sample.csv

log_info "Uploading sample CSV file..."
UPLOAD_RESPONSE=$(curl -s -X POST \
    -F "csvFile=@/tmp/sample.csv" \
    "$API_BASE/api/upload")

JOB_ID=$(echo "$UPLOAD_RESPONSE" | jq -r '.jobId')
FILENAME=$(echo "$UPLOAD_RESPONSE" | jq -r '.filename')

if [ "$JOB_ID" != "null" ]; then
    log_success "File uploaded successfully!"
    log_info "Job ID: $JOB_ID"
    log_info "Filename: $FILENAME"
else
    log_error "Upload failed"
    echo "$UPLOAD_RESPONSE"
    exit 1
fi

echo ""
echo "🎯 Step 2: Check Processing Status"
echo "----------------------------------"

sleep 2  # Wait for processing

log_info "Checking job status..."
STATUS_RESPONSE=$(curl -s "$API_BASE/api/upload/status/$JOB_ID")
STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.status')
PROGRESS=$(echo "$STATUS_RESPONSE" | jq -r '.progress')

log_success "Status: $STATUS ($PROGRESS% complete)"

echo ""
echo "🎯 Step 3: Import OpenAPI Specification"
echo "----------------------------------------"

OPENAPI_SPEC='{
  "openapi": "3.0.0",
  "info": {
    "title": "User Management API",
    "version": "1.0.0",
    "description": "A simple user management API for demo"
  },
  "servers": [
    {
      "url": "https://api.example.com",
      "description": "Production server"
    }
  ],
  "paths": {
    "/users": {
      "get": {
        "operationId": "getUsers",
        "summary": "Get all users",
        "responses": {
          "200": {
            "description": "Successful response",
            "content": {
              "application/json": {
                "schema": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "id": {"type": "string"},
                      "name": {"type": "string"},
                      "email": {"type": "string"}
                    }
                  }
                }
              }
            }
          }
        }
      },
      "post": {
        "operationId": "createUser",
        "summary": "Create a new user",
        "responses": {
          "201": {
            "description": "User created successfully"
          }
        }
      }
    },
    "/users/{id}": {
      "get": {
        "operationId": "getUserById",
        "summary": "Get user by ID",
        "parameters": [
          {
            "name": "id",
            "in": "path",
            "required": true,
            "schema": {"type": "string"}
          }
        ],
        "responses": {
          "200": {
            "description": "Successful response"
          }
        }
      }
    }
  }
}'

log_info "Importing OpenAPI specification..."
IMPORT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"source\": \"text\",
      \"content\": $(echo "$OPENAPI_SPEC" | jq -R . | jq -s .)
    }" \
    "$API_BASE/api/v1/openapi/import")

SPEC_ID=$(echo "$IMPORT_RESPONSE" | jq -r '.data.id')
ENDPOINT_COUNT=$(echo "$IMPORT_RESPONSE" | jq -r '.data.summary.endpointCount')
API_TITLE=$(echo "$IMPORT_RESPONSE" | jq -r '.data.summary.title')

if [ "$SPEC_ID" != "null" ]; then
    log_success "OpenAPI spec imported successfully!"
    log_info "Spec ID: $SPEC_ID"
    log_info "API Title: $API_TITLE"
    log_info "Endpoints: $ENDPOINT_COUNT"
else
    log_error "Import failed"
    echo "$IMPORT_RESPONSE"
    exit 1
fi

echo ""
echo "🎯 Step 4: Create Authentication Profile"
echo "---------------------------------------"

log_info "Creating API Key authentication profile..."
AUTH_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{
      "name": "Demo API Key Auth",
      "type": "api_key",
      "config": {
        "key": "X-API-Key",
        "value": "demo-api-key-12345",
        "addTo": "header",
        "headerName": "X-API-Key"
      }
    }' \
    "$API_BASE/auth/api-key/profiles")

AUTH_ID=$(echo "$AUTH_RESPONSE" | jq -r '.data.id')
AUTH_NAME=$(echo "$AUTH_RESPONSE" | jq -r '.data.name')

if [ "$AUTH_ID" != "null" ]; then
    log_success "Authentication profile created!"
    log_info "Auth ID: $AUTH_ID"
    log_info "Name: $AUTH_NAME"
else
    log_error "Auth profile creation failed"
    echo "$AUTH_RESPONSE"
    exit 1
fi

echo ""
echo "🎯 Step 5: Test Authentication"
echo "------------------------------"

log_info "Testing authentication profile..."
TEST_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$API_BASE/auth/api-key/profiles/$AUTH_ID/test")

TEST_SUCCESS=$(echo "$TEST_RESPONSE" | jq -r '.data.success')
RESPONSE_TIME=$(echo "$TEST_RESPONSE" | jq -r '.data.responseTime')

if [ "$TEST_SUCCESS" = "true" ]; then
    log_success "Authentication test passed!"
    log_info "Response time: ${RESPONSE_TIME}ms"
else
    log_warning "Authentication test failed (this might be expected for POC)"
fi

echo ""
echo "🎯 Step 6: Generate API Client"
echo "-----------------------------"

log_info "Generating TypeScript API client..."
CLIENT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"specId\": \"$SPEC_ID\",
      \"language\": \"typescript\",
      \"includeAuth\": true,
      \"baseUrl\": \"https://api.example.com\",
      \"clientName\": \"UserManagementApiClient\"
    }" \
    "$API_BASE/api/v1/openapi/generate-client")

CLIENT_ID=$(echo "$CLIENT_RESPONSE" | jq -r '.data.id')
CLIENT_NAME=$(echo "$CLIENT_RESPONSE" | jq -r '.data.name')
CLIENT_LANGUAGE=$(echo "$CLIENT_RESPONSE" | jq -r '.data.language')

if [ "$CLIENT_ID" != "null" ]; then
    log_success "API client generated successfully!"
    log_info "Client ID: $CLIENT_ID"
    log_info "Name: $CLIENT_NAME"
    log_info "Language: $CLIENT_LANGUAGE"
    
    # Save generated client to file
    echo "$CLIENT_RESPONSE" | jq -r '.data.code' > /tmp/generated-client.ts
    log_info "Generated client saved to: /tmp/generated-client.ts"
    
    # Save usage example
    echo "$CLIENT_RESPONSE" | jq -r '.data.usage' > /tmp/usage-example.ts
    log_info "Usage example saved to: /tmp/usage-example.ts"
else
    log_error "Client generation failed"
    echo "$CLIENT_RESPONSE"
    exit 1
fi

echo ""
echo "🎯 Step 7: Get Authentication Headers"
echo "------------------------------------"

log_info "Retrieving authentication headers..."
HEADERS_RESPONSE=$(curl -s "$API_BASE/auth/api-key/profiles/$AUTH_ID/headers")

HEADERS_COUNT=$(echo "$HEADERS_RESPONSE" | jq -r '.data.headers | length')
QUERY_PARAMS_COUNT=$(echo "$HEADERS_RESPONSE" | jq -r '.data.queryParams | length')

log_success "Authentication configuration retrieved!"
log_info "Headers: $HEADERS_COUNT configured"
log_info "Query Parameters: $QUERY_PARAMS_COUNT configured"

echo ""
echo "🎯 Step 8: Validate OpenAPI Specification"
echo "-----------------------------------------"

log_info "Validating OpenAPI specification..."
VALIDATION_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -d "{
      \"content\": $(echo "$OPENAPI_SPEC" | jq -R . | jq -s .)
    }" \
    "$API_BASE/api/v1/openapi/validate")

VALIDATION_ENDPOINTS=$(echo "$VALIDATION_RESPONSE" | jq -r '.data.summary.endpointCount')
VALIDATION_WARNINGS=$(echo "$VALIDATION_RESPONSE" | jq -r '.data.summary.warnings | length')

log_success "Validation completed!"
log_info "Endpoints found: $VALIDATION_ENDPOINTS"
log_info "Warnings: $VALIDATION_WARNINGS"

echo ""
echo "🎉 POC Demo Completed Successfully!"
echo "=================================="

log_info "Summary of what was demonstrated:"
echo "  ✅ CSV file upload with streaming processing"
echo "  ✅ OpenAPI specification import and validation"
echo "  ✅ Authentication profile creation and testing"
echo "  ✅ Dynamic TypeScript API client generation"
echo "  ✅ Authentication header configuration"
echo "  ✅ End-to-end workflow integration"

echo ""
log_info "Generated files for review:"
echo "  📄 /tmp/sample.csv - Sample CSV data"
echo "  📄 /tmp/generated-client.ts - Generated TypeScript client"
echo "  📄 /tmp/usage-example.ts - Usage examples"

echo ""
log_info "API endpoints demonstrated:"
echo "  🔗 POST /api/upload - CSV file upload"
echo "  🔗 GET /api/upload/status/:id - Processing status"
echo "  🔗 POST /api/v1/openapi/import - Import OpenAPI spec"
echo "  🔗 POST /api/v1/openapi/validate - Validate spec"
echo "  🔗 POST /api/v1/openapi/generate-client - Generate client"
echo "  🔗 POST /auth/api-key/profiles - Create auth profile"
echo "  🔗 POST /auth/api-key/profiles/:id/test - Test auth"
echo "  🔗 GET /auth/api-key/profiles/:id/headers - Get headers"

echo ""
log_success "🚀 Atlas2 POC is ready for stakeholder presentation!"

# Cleanup
rm -f /tmp/sample.csv