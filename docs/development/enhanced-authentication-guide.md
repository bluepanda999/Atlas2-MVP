# Enhanced Authentication System Guide

## Overview

Atlas2 now features a comprehensive authentication system supporting both Basic Authentication and Bearer Token (JWT) authentication. This enterprise-grade solution provides secure, flexible, and scalable authentication with advanced features like rate limiting, session management, and comprehensive audit logging.

## Features

### 🔐 **Multiple Authentication Methods**
- **Basic Authentication**: Traditional username/password with Base64 encoding
- **Bearer Token Authentication**: JWT-based stateless authentication
- **Flexible Configuration**: Enable/disable methods per security requirements

### 🛡️ **Security Features**
- **Rate Limiting**: Configurable attempt limits with lockout protection
- **Session Management**: Active session tracking and control
- **Token Blacklisting**: Revocation support for compromised tokens
- **Secure Connection Requirements**: HTTPS enforcement options
- **Role-Based Access Control**: Granular permission management

### 📊 **Monitoring & Observability**
- **Comprehensive Audit Logging**: All authentication attempts logged
- **Health Check Endpoints**: System status monitoring
- **Metrics Integration**: Prometheus-compatible metrics
- **Attempt Tracking**: Detailed authentication attempt history

### ⚙️ **Configuration & Management**
- **Environment-Based Configuration**: 12-factor app compliance
- **Runtime Configuration Updates**: Dynamic config changes
- **Multi-Environment Support**: Dev/staging/production configurations
- **Graceful Shutdown**: Clean resource management

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Enhanced Auth System                     │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   Basic Auth    │  │  Bearer Token   │  │   Auth       │ │
│  │    Service      │  │    Service      │  │ Middleware   │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
│           │                     │                    │      │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │              Shared Services                           │ │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐    │ │
│  │  │ User Repo   │  │ Logging     │  │ Monitoring  │    │ │
│  │  │             │  │ Service     │  │ Service     │    │ │
│  │  └─────────────┘  └─────────────┘  └─────────────┘    │ │
│  └─────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

#### Basic Authentication
```bash
# Enable/Disable Basic Auth
BASIC_AUTH_ENABLED=true

# Basic Auth Settings
BASIC_AUTH_REALM="Atlas2 API"
BASIC_AUTH_MAX_ATTEMPTS=5
BASIC_AUTH_LOCKOUT_DURATION=900
BASIC_AUTH_REQUIRE_SECURE=true
BASIC_AUTH_ALLOWED_ROLES=admin,user
```

#### Bearer Token Authentication
```bash
# JWT Settings
JWT_SECRET=your-super-secret-key
JWT_REFRESH_SECRET=your-refresh-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# JWT Configuration
JWT_ISSUER=atlas2-api
JWT_AUDIENCE=atlas2-client
JWT_ALGORITHM=HS256
JWT_REQUIRE_SECURE=true
JWT_ALLOWED_ROLES=admin,user,service
JWT_ENABLE_BLACKLIST=true
JWT_MAX_ACTIVE_SESSIONS=10
```

#### Enhanced Auth Middleware
```bash
# Middleware Configuration
ENABLE_BASIC_AUTH=true
ENABLE_BEARER_AUTH=true
REQUIRE_SECURE_AUTH=true
ALLOWED_AUTH_METHODS=basic,bearer
DEFAULT_AUTH_METHOD=any
AUTH_SKIP_PATHS=/health,/health/live,/health/ready,/metrics
AUTH_RATE_LIMIT_BY_IP=true
LOG_AUTH_ATTEMPTS=true
```

#### Logging & Monitoring
```bash
# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json
LOG_FILE_ENABLED=true
LOG_FILE_PATH=./logs/auth.log
LOG_STRUCTURED=true
LOG_INCLUDE_METADATA=true
```

## API Endpoints

### Authentication Endpoints

#### User Registration
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "name": "John Doe",
  "role": "user"
}
```

#### User Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

#### Token Refresh
```http
POST /auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Logout
```http
POST /auth/logout
Authorization: Bearer <access_token>
```

#### Logout All Sessions
```http
POST /auth/logout-all
Authorization: Bearer <access_token>
```

### Profile Management

#### Get Profile
```http
GET /auth/profile
Authorization: Bearer <access_token>
```

#### Update Profile
```http
POST /auth/profile
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Updated Name"
}
```

#### Change Password
```http
POST /auth/change-password
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "currentPassword": "oldPassword123",
  "newPassword": "newPassword123"
}
```

### Basic Authentication Endpoints

#### Test Basic Auth
```http
GET /auth/basic/test
Authorization: Basic <base64_credentials>
```

#### Get Auth Attempts
```http
GET /auth/basic/attempts?identifier=user@example.com&ipAddress=192.168.1.1
```

#### Clear Auth Attempts
```http
DELETE /auth/basic/attempts?identifier=user@example.com&ipAddress=192.168.1.1
```

### Bearer Token Endpoints

#### Test Bearer Auth
```http
GET /auth/bearer/test
Authorization: Bearer <access_token>
```

#### Get Active Sessions
```http
GET /auth/bearer/sessions
Authorization: Bearer <access_token>
```

#### Revoke Session
```http
DELETE /auth/bearer/sessions/<session_id>
Authorization: Bearer <access_token>
```

#### Get Blacklisted Tokens
```http
GET /auth/bearer/blacklist
Authorization: Bearer <access_token>
```

### Configuration & Health

#### Get Auth Configuration
```http
GET /auth/config
```

#### Health Check
```http
GET /auth/health
```

## Usage Examples

### Basic Authentication

#### Using curl
```bash
# Encode credentials
CREDENTIALS=$(echo -n "user@example.com:password123" | base64)

# Make authenticated request
curl -X GET \
  -H "Authorization: Basic $CREDENTIALS" \
  http://localhost:3000/auth/basic/test
```

#### Using JavaScript (fetch)
```javascript
const credentials = btoa('user@example.com:password123');

fetch('/auth/basic/test', {
  headers: {
    'Authorization': `Basic ${credentials}`
  }
})
.then(response => response.json())
.then(data => console.log(data));
```

### Bearer Token Authentication

#### Using curl
```bash
# Login to get token
TOKEN=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  http://localhost:3000/auth/login | jq -r '.token')

# Make authenticated request
curl -X GET \
  -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/auth/profile
```

#### Using JavaScript (fetch)
```javascript
// Login
const loginResponse = await fetch('/auth/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { token } = await loginResponse.json();

// Make authenticated request
const profileResponse = await fetch('/auth/profile', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const profile = await profileResponse.json();
```

### Middleware Usage

#### In NestJS Controllers
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';
import { EnhancedAuthMiddleware } from '../middleware/enhanced-auth.middleware';

@Controller('protected')
export class ProtectedController {
  
  @Get()
  @UseGuards(EnhancedAuthMiddleware)
  async protectedRoute() {
    return { message: 'This is a protected route' };
  }

  @Get('admin')
  @UseGuards(EnhancedAuthMiddleware, 
    EnhancedAuthMiddleware.authorize(['admin']))
  async adminRoute() {
    return { message: 'Admin only route' };
  }

  @Get('scoped')
  @UseGuards(EnhancedAuthMiddleware,
    EnhancedAuthMiddleware.requireScopes(['read:protected']))
  async scopedRoute() {
    return { message: 'Scope protected route' };
  }
}
```

#### Method-Specific Authentication
```typescript
import { Controller, Get, UseGuards } from '@nestjs/common';

@Controller('api')
export class ApiController {
  
  @Get('public')
  async publicRoute() {
    return { message: 'Public endpoint' };
  }

  @Get('basic-only')
  @UseGuards(EnhancedAuthMiddleware.basicOnly)
  async basicOnlyRoute() {
    return { message: 'Basic auth only' };
  }

  @Get('bearer-only')
  @UseGuards(EnhancedAuthMiddleware.bearerOnly)
  async bearerOnlyRoute() {
    return { message: 'Bearer token only' };
  }

  @Get('optional')
  @UseGuards(EnhancedAuthMiddleware.optional)
  async optionalAuthRoute(req) {
    return { 
      message: 'Optional auth',
      user: req.user || null 
    };
  }
}
```

## Security Best Practices

### 1. Environment Configuration
```bash
# Use strong, unique secrets
JWT_SECRET=$(openssl rand -base64 64)
JWT_REFRESH_SECRET=$(openssl rand -base64 64)

# Enable secure connection in production
REQUIRE_SECURE_AUTH=true
BASIC_AUTH_REQUIRE_SECURE=true
JWT_REQUIRE_SECURE=true

# Limit allowed roles
BASIC_AUTH_ALLOWED_ROLES=admin,user
JWT_ALLOWED_ROLES=admin,user,service
```

### 2. Rate Limiting
```bash
# Configure conservative limits
BASIC_AUTH_MAX_ATTEMPTS=5
BASIC_AUTH_LOCKOUT_DURATION=900
JWT_MAX_ACTIVE_SESSIONS=10
```

### 3. Token Management
```bash
# Use short-lived access tokens
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Enable token blacklisting
JWT_ENABLE_BLACKLIST=true
```

### 4. Logging & Monitoring
```bash
# Enable comprehensive logging
LOG_AUTH_ATTEMPTS=true
LOG_LEVEL=info
LOG_STRUCTURED=true
```

## Monitoring & Troubleshooting

### Health Monitoring
```bash
# Check auth system health
curl http://localhost:3000/auth/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": {
    "basicAuth": true,
    "bearerAuth": true
  }
}
```

### Authentication Attempts
```bash
# Get recent auth attempts
curl http://localhost:3000/auth/basic/attempts

# Clear failed attempts (admin only)
curl -X DELETE \
  "http://localhost:3000/auth/basic/attempts?identifier=user@example.com&ipAddress=192.168.1.1"
```

### Session Management
```bash
# Get active sessions
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/auth/bearer/sessions

# Revoke specific session
curl -X DELETE \
  -H "Authorization: Bearer <token>" \
  http://localhost:3000/auth/bearer/sessions/session-id
```

### Common Issues & Solutions

#### Issue: "Too many failed attempts"
```bash
# Solution: Clear attempts or wait for lockout expiration
curl -X DELETE \
  "http://localhost:3000/auth/basic/attempts?identifier=user@example.com&ipAddress=192.168.1.1"
```

#### Issue: "Token has been revoked"
```bash
# Solution: Generate new token pair
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"<refresh_token>"}' \
  http://localhost:3000/auth/refresh
```

#### Issue: "Secure connection required"
```bash
# Solution: Use HTTPS or disable for development
REQUIRE_SECURE_AUTH=false  # Development only
```

## Performance Considerations

### 1. Token Storage
- In-memory storage for active sessions and blacklist
- Automatic cleanup of expired entries
- Configurable session limits

### 2. Rate Limiting
- Per-identifier and per-IP tracking
- Memory-efficient attempt storage
- Automatic cleanup of old attempts

### 3. Logging
- Structured logging for better performance
- Configurable log levels
- Async logging to prevent blocking

## Testing

### Unit Tests
```bash
# Run authentication unit tests
npm run test -- auth/basic-auth.service.spec.ts
npm run test -- auth/bearer-token.service.spec.ts
```

### Integration Tests
```bash
# Run authentication integration tests
npm run test:e2e -- auth/enhanced-auth.e2e-spec.ts
```

### Manual Testing
```bash
# Test basic authentication
curl -v -H "Authorization: Basic $(echo -n 'test@example.com:password123' | base64)" \
  http://localhost:3000/auth/basic/test

# Test bearer authentication
TOKEN=$(curl -s -X POST -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  http://localhost:3000/auth/login | jq -r '.token')

curl -v -H "Authorization: Bearer $TOKEN" \
  http://localhost:3000/auth/bearer/test
```

## Migration Guide

### From Simple JWT to Enhanced Auth

1. **Update Dependencies**
```bash
npm install @nestjs/common @nestjs/core
```

2. **Update Environment Variables**
```bash
# Add new auth configuration
ENABLE_BASIC_AUTH=true
ENABLE_BEARER_AUTH=true
BASIC_AUTH_ENABLED=true
JWT_ENABLE_BLACKLIST=true
```

3. **Update Controllers**
```typescript
// Before
@UseGuards(JwtAuthGuard)

// After
@UseGuards(EnhancedAuthMiddleware)
```

4. **Update Client Code**
```typescript
// Before - only Bearer tokens
headers: { 'Authorization': `Bearer ${token}` }

// After - support both methods
const headers = {};
if (useBasicAuth) {
  headers['Authorization'] = `Basic ${btoa(credentials)}`;
} else {
  headers['Authorization'] = `Bearer ${token}`;
}
```

## Conclusion

The Enhanced Authentication System provides enterprise-grade security with flexible configuration options. It supports multiple authentication methods, comprehensive monitoring, and robust security features while maintaining high performance and ease of use.

For additional support or questions, refer to the monitoring endpoints or consult the development team.