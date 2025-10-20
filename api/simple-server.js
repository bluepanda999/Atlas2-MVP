const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003'],
  credentials: true,
}));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
  });
});

// API routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Auth routes
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  
  // Simple authentication for testing
  if (username === 'admin' && password === 'admin123') {
    res.json({
      success: true,
      token: 'mock-jwt-token-' + Date.now(),
      user: {
        id: 1,
        username: 'admin',
        email: 'admin@atlas2.com',
        role: 'admin',
      },
      expiresIn: '24h',
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials',
    });
  }
});

app.post('/api/auth/register', (req, res) => {
  const { username, email, password } = req.body;
  
  // Simple registration for testing
  res.json({
    success: true,
    message: 'User registered successfully',
    user: {
      id: Date.now(),
      username,
      email,
      role: 'user',
    },
  });
});

app.get('/api/auth/me', (req, res) => {
  // Mock authenticated user
  res.json({
    success: true,
    user: {
      id: 1,
      username: 'admin',
      email: 'admin@atlas2.com',
      role: 'admin',
    },
  });
});

app.get('/auth/test', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    res.set('WWW-Authenticate', 'Basic realm="Atlas2 API"');
    return res.status(401).send('Authentication required');
  }
  
  if (authHeader.startsWith('Basic ')) {
    return res.send('Basic authentication successful');
  }
  
  if (authHeader.startsWith('Bearer ')) {
    return res.send('Bearer authentication successful');
  }
  
  res.status(401).send('Invalid authentication method');
});

app.post('/api/auth/logout', (req, res) => {
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
});

// Upload routes
app.post('/api/upload/initialize', (req, res) => {
  const { fileName, fileSize, mimeType } = req.body;
  
  res.json({
    success: true,
    uploadId: 'upload-' + Date.now(),
    chunkSize: 1048576, // 1MB
    totalChunks: Math.ceil(fileSize / 1048576),
    uploadUrl: `/api/upload/chunk/${Date.now()}`,
  });
});

app.post('/api/upload/chunk/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  const { chunkIndex, chunkData } = req.body;
  
  res.json({
    success: true,
    uploadId,
    chunkIndex,
    received: true,
  });
});

app.post('/api/upload/complete/:uploadId', (req, res) => {
  const { uploadId } = req.params;
  
  res.json({
    success: true,
    uploadId,
    message: 'Upload completed successfully',
    fileId: 'file-' + Date.now(),
  });
});

app.get('/api/upload/history', (req, res) => {
  res.json({
    success: true,
    uploads: [
      {
        id: 'upload-1',
        fileName: 'sample.csv',
        fileSize: 1024000,
        status: 'completed',
        uploadedAt: new Date().toISOString(),
        processedAt: new Date().toISOString(),
      },
    ],
    pagination: {
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    },
  });
});

// Mapping routes
app.get('/api/mapping/fields', (req, res) => {
  res.json({
    success: true,
    csvFields: [
      { name: 'name', type: 'string', required: true },
      { name: 'email', type: 'string', required: true },
      { name: 'phone', type: 'string', required: false },
    ],
    apiFields: [
      { name: 'fullName', type: 'string', required: true },
      { name: 'emailAddress', type: 'string', required: true },
      { name: 'phoneNumber', type: 'string', required: false },
    ],
  });
});

app.post('/api/mapping/save', (req, res) => {
  const { name, mappings } = req.body;
  
  res.json({
    success: true,
    mappingId: 'mapping-' + Date.now(),
    name,
    mappings,
    message: 'Mapping saved successfully',
  });
});

app.get('/api/mapping/list', (req, res) => {
  res.json({
    success: true,
    mappings: [
      {
        id: 'mapping-1',
        name: 'User Import Mapping',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
});

// Integration routes
app.get('/api/integrations/list', (req, res) => {
  res.json({
    success: true,
    integrations: [
      {
        id: 'integration-1',
        name: 'Test API',
        type: 'REST',
        status: 'active',
        endpoint: 'https://api.example.com',
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

app.post('/api/integrations/test', (req, res) => {
  const { integrationId, testData } = req.body;
  
  // Simulate API test
  setTimeout(() => {
    res.json({
      success: true,
      message: 'Integration test successful',
      response: {
        status: 200,
        data: { message: 'Test successful' },
      },
    });
  }, 1000);
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'Atlas2 API',
    version: '1.0.0',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      api: '/api',
      auth: '/api/auth',
      upload: '/api/upload',
      mapping: '/api/mapping',
      integrations: '/api/integrations',
    },
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
    path: req.path,
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Atlas2 API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;