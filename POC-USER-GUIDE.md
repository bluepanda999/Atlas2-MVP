# Atlas2 POC Setup and User Guide

## Overview

This guide covers the setup and usage of the Atlas2 CSV upload and endpoint configuration POC. The system demonstrates:

- **Endpoint Configuration UI**: Configure external API endpoints with authentication
- **CSV Upload Interface**: Upload and process CSV files with field mapping
- **Real-time Connection Testing**: Validate endpoint connectivity
- **Mock Mode Support**: Full functionality without external dependencies

## Quick Start

### 1. Start the Development Environment

```bash
# Start frontend (port 3002)
npm run dev

# Start API server (port 3001)
npm run dev:api

# Both servers should be running for full functionality
```

### 2. Access the Application

- **Frontend**: http://localhost:3002
- **API Health Check**: http://localhost:3001/health
- **Settings Page**: http://localhost:3002/settings

## Core Features

### ✅ Endpoint Configuration (Fully Functional)

The Settings page provides complete endpoint management:

1. **Add New Endpoints**
   - Navigate to `/settings`
   - Click "Add New Endpoint"
   - Configure:
     - Name and description
     - Base URL
     - Authentication type (API Key, Basic Auth, Bearer Token)
     - Authentication credentials

2. **Test Connections**
   - Use the "Test Connection" button
   - Real-time validation with response time and status
   - Detailed error feedback

3. **Manage Configurations**
   - Edit existing endpoints
   - Delete unused configurations
   - Set active configuration for uploads

### ✅ CSV Upload Interface (Mock Mode)

The upload interface provides complete user experience:

1. **File Upload**
   - Navigate to `/upload`
   - Select CSV files (drag & drop supported)
   - File validation and preview

2. **Field Mapping**
   - Automatic field detection
   - Manual field mapping configuration
   - Mapping templates support

3. **Processing Simulation**
   - Progress tracking
   - Real-time status updates
   - Result preview

## Configuration Options

### Mock Mode (Recommended for POC)

Mock mode provides full functionality without external dependencies:

```javascript
// In frontend .env file
VITE_DISABLE_MOCK = false; // Default: enabled
```

**Benefits:**

- No authentication required
- Instant response times
- Predictable test data
- Full feature demonstration

### Real API Mode

For testing with actual endpoints:

```javascript
// Disable mock mode
VITE_DISABLE_MOCK = true;
```

**Requirements:**

- API server running
- User authentication (currently has database issues)
- Valid endpoint configurations

## Test Data

### Sample CSV File

Create `test-upload.csv` with the following content:

```csv
name,email,age,city
John Doe,john.doe@example.com,30,New York
Jane Smith,jane.smith@example.com,25,Los Angeles
Bob Johnson,bob.johnson@example.com,35,Chicago
Alice Brown,alice.brown@example.com,28,Houston
Charlie Wilson,charlie.wilson@example.com,32,Phoenix
```

### Test Endpoints

#### JSONPlaceholder (Recommended for testing)

- **URL**: https://jsonplaceholder.typicode.com
- **Auth**: None required
- **Usage**: Perfect for connection testing

#### HTTPBin

- **URL**: https://httpbin.org
- **Auth**: None required
- **Usage**: Advanced request testing

## Demo Script

### 1. Endpoint Configuration Demo

```
1. Open http://localhost:3002/settings
2. Click "Add New Endpoint"
3. Fill in:
   - Name: "JSONPlaceholder Test"
   - Base URL: "https://jsonplaceholder.typicode.com"
   - Auth Type: "None"
4. Click "Test Connection"
5. Verify success (200 status, ~200ms response)
6. Click "Save Configuration"
7. Set as "Active Configuration"
```

### 2. CSV Upload Demo (Mock Mode)

```
1. Open http://localhost:3002/upload
2. Upload the test CSV file
3. Review field mapping suggestions
4. Adjust mappings if needed
5. Start upload process
6. Monitor progress and results
```

## Architecture Overview

### Frontend Components

- **Settings Page** (`/src/pages/Settings.tsx`)
  - Endpoint configuration CRUD
  - Connection testing
  - Authentication management

- **Upload Page** (`/src/pages/Upload.tsx`)
  - File upload interface
  - Field mapping UI
  - Progress tracking

- **API Service** (`/src/services/api.ts`)
  - Dynamic base URL configuration
  - Mock mode support
  - Authentication handling

### Backend Components

- **Upload Controller** (`/api/controllers/upload.controller.ts`)
  - File upload processing
  - Job management
  - Progress tracking

- **Auth Service** (`/api/services/auth.service.ts`)
  - User authentication
  - Token management
  - Password hashing

- **Validation Service** (`/api/services/validation.service.ts`)
  - CSV data validation
  - Field mapping validation
  - Error reporting

## Troubleshooting

### Common Issues

1. **Frontend not loading**
   - Check port conflicts (3002, 3001)
   - Verify `npm install` completed
   - Check browser console for errors

2. **API server not responding**
   - Run `npm run dev:api` in separate terminal
   - Check database connection
   - Verify port 3001 availability

3. **Authentication failures**
   - Use mock mode for POC demo
   - Check database schema
   - Verify user creation

4. **Connection testing fails**
   - Test with JSONPlaceholder first
   - Check network connectivity
   - Verify URL format (include https://)

### Debug Mode

Enable detailed logging:

```bash
# Frontend debug
DEBUG=* npm run dev

# API debug
DEBUG=* npm run dev:api
```

## Development Notes

### Current Limitations

1. **Authentication System**
   - Database connection issues
   - User registration/login not fully functional
   - **Workaround**: Use mock mode

2. **Real CSV Processing**
   - Backend implementation complete
   - Frontend integration working
   - **Workaround**: Mock mode provides full simulation

3. **Error Handling**
   - Basic error messages
   - Could use more detailed feedback
   - **Status**: Functional but improvable

### Technical Debt

1. Missing TypeScript types in some API modules
2. Database schema inconsistencies
3. Limited error recovery mechanisms
4. Mock data could be more realistic

## Future Enhancements

### Short Term

1. Fix authentication database issues
2. Improve error messages and recovery
3. Add more authentication types (OAuth, etc.)
4. Enhanced field mapping suggestions

### Long Term

1. Real-time collaboration features
2. Advanced data transformation rules
3. Bulk endpoint management
4. Analytics and reporting dashboard

## Support

For issues or questions:

1. Check this documentation first
2. Review browser console errors
3. Verify server logs
4. Test with mock mode as fallback

## Conclusion

The Atlas2 POC successfully demonstrates:

- ✅ Complete endpoint configuration UI
- ✅ Full CSV upload user experience
- ✅ Real-time connection testing
- ✅ Mock mode for reliable demos
- ✅ Responsive design and error handling

The system is ready for POC demonstrations with mock mode enabled, providing a complete user experience without external dependencies.
