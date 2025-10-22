const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const compression = require("compression");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = process.env.API_PORT || 3001;

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3003"],
    credentials: true,
  }),
);
app.use(compression());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: "Too many requests from this IP, please try again later.",
});
app.use("/api", limiter);

// Request logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get("User-Agent"),
  });
  next();
});

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    version: "1.0.0",
  });
});

// API routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    version: "1.0.0",
  });
});

// Auth routes
app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  // Simple authentication for testing
  if (username === "admin" && password === "admin123") {
    res.json({
      success: true,
      token: "mock-jwt-token-" + Date.now(),
      user: {
        id: 1,
        username: "admin",
        email: "admin@atlas2.com",
        role: "admin",
      },
      expiresIn: "24h",
    });
  } else {
    res.status(401).json({
      success: false,
      message: "Invalid credentials",
    });
  }
});

app.post("/api/auth/register", (req, res) => {
  const { username, email, password } = req.body;

  // Simple registration for testing
  res.json({
    success: true,
    message: "User registered successfully",
    user: {
      id: Date.now(),
      username,
      email,
      role: "user",
    },
  });
});

app.get("/api/auth/me", (req, res) => {
  // Mock authenticated user
  res.json({
    success: true,
    user: {
      id: 1,
      username: "admin",
      email: "admin@atlas2.com",
      role: "admin",
    },
  });
});

app.get("/auth/test", (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    res.set("WWW-Authenticate", 'Basic realm="Atlas2 API"');
    return res.status(401).send("Authentication required");
  }

  if (authHeader.startsWith("Basic ")) {
    return res.send("Basic authentication successful");
  }

  if (authHeader.startsWith("Bearer ")) {
    return res.send("Bearer authentication successful");
  }

  res.status(401).send("Invalid authentication method");
});

app.post("/api/auth/logout", (req, res) => {
  res.json({
    success: true,
    message: "Logged out successfully",
  });
});

// Upload routes
app.post("/api/upload/upload", (req, res) => {
  // Mock file upload response for development
  const mockJob = {
    id: `job-${Date.now()}`,
    fileName: req.body.fileName || "uploaded-file.csv",
    fileSize: req.body.fileSize || 1024000,
    status: "completed",
    progress: 100,
    totalRecords: 100,
    recordsProcessed: 100,
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  };

  res.json({
    success: true,
    data: mockJob,
  });
});

app.post("/api/upload/initialize", (req, res) => {
  const { fileName, fileSize, mimeType } = req.body;

  res.json({
    success: true,
    uploadId: "upload-" + Date.now(),
    chunkSize: 1048576, // 1MB
    totalChunks: Math.ceil(fileSize / 1048576),
    uploadUrl: `/api/upload/chunk/${Date.now()}`,
  });
});

app.post("/api/upload/chunk/:uploadId", (req, res) => {
  const { uploadId } = req.params;
  const { chunkIndex, chunkData } = req.body;

  res.json({
    success: true,
    uploadId,
    chunkIndex,
    received: true,
  });
});

app.post("/api/upload/complete/:uploadId", (req, res) => {
  const { uploadId } = req.params;

  res.json({
    success: true,
    uploadId,
    message: "Upload completed successfully",
    fileId: "file-" + Date.now(),
  });
});

app.get("/api/upload/jobs", (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: "job-1",
        fileName: "sample.csv",
        fileSize: 1024000,
        status: "completed",
        progress: 100,
        totalRecords: 100,
        recordsProcessed: 100,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      },
    ],
  });
});

app.get("/api/upload/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.json({
    success: true,
    data: {
      id: jobId,
      fileName: "sample.csv",
      fileSize: 1024000,
      status: "completed",
      progress: 100,
      totalRecords: 100,
      recordsProcessed: 100,
      createdAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    },
  });
});

app.delete("/api/upload/jobs/:jobId", (req, res) => {
  const { jobId } = req.params;

  res.json({
    success: true,
    message: `Job ${jobId} deleted successfully`,
  });
});

app.post("/api/upload/jobs/:jobId/cancel", (req, res) => {
  const { jobId } = req.params;

  res.json({
    success: true,
    message: `Job ${jobId} cancelled successfully`,
  });
});

app.get("/api/upload/history", (req, res) => {
  res.json({
    success: true,
    uploads: [
      {
        id: "upload-1",
        fileName: "sample.csv",
        fileSize: 1024000,
        status: "completed",
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
app.get("/api/mapping/fields", (req, res) => {
  res.json({
    success: true,
    csvFields: [
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: true },
      { name: "phone", type: "string", required: false },
    ],
    apiFields: [
      { name: "fullName", type: "string", required: true },
      { name: "emailAddress", type: "string", required: true },
      { name: "phoneNumber", type: "string", required: false },
    ],
  });
});

app.post("/api/mapping/save", (req, res) => {
  const { name, mappings } = req.body;

  res.json({
    success: true,
    mappingId: "mapping-" + Date.now(),
    name,
    mappings,
    message: "Mapping saved successfully",
  });
});

app.get("/api/mapping/list", (req, res) => {
  res.json({
    success: true,
    mappings: [
      {
        id: "mapping-1",
        name: "User Import Mapping",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
  });
});

// Integration routes
app.get("/api/integrations/list", (req, res) => {
  res.json({
    success: true,
    integrations: [
      {
        id: "integration-1",
        name: "Test API",
        type: "REST",
        status: "active",
        endpoint: "https://api.example.com",
        createdAt: new Date().toISOString(),
      },
    ],
  });
});

app.post("/api/integrations/test", (req, res) => {
  const { integrationId, testData } = req.body;

  // Simulate API test
  setTimeout(() => {
    res.json({
      success: true,
      message: "Integration test successful",
      response: {
        status: 200,
        data: { message: "Test successful" },
      },
    });
  }, 1000);
});

// Analytics endpoints
app.get("/api/analytics/overview", (req, res) => {
  const { timeRange = "24h" } = req.query;

  // Mock analytics data
  const mockData = {
    overview: {
      totalUploads: 156,
      successfulUploads: 142,
      failedUploads: 14,
      successRate: 91.0,
      averageProcessingTime: 2.3,
      totalDataProcessed: "2.4GB",
      activeUsers: 23,
      errorRate: 9.0,
    },
    trends: {
      uploadsOverTime: [
        { timestamp: "2025-10-20T16:00:00Z", count: 12 },
        { timestamp: "2025-10-20T17:00:00Z", count: 18 },
        { timestamp: "2025-10-20T18:00:00Z", count: 15 },
        { timestamp: "2025-10-20T19:00:00Z", count: 22 },
        { timestamp: "2025-10-20T20:00:00Z", count: 19 },
      ],
      successRateOverTime: [
        { timestamp: "2025-10-20T16:00:00Z", rate: 89.5 },
        { timestamp: "2025-10-20T17:00:00Z", rate: 92.1 },
        { timestamp: "2025-10-20T18:00:00Z", rate: 90.3 },
        { timestamp: "2025-10-20T19:00:00Z", rate: 93.7 },
        { timestamp: "2025-10-20T20:00:00Z", rate: 91.0 },
      ],
    },
    topErrors: [
      { error: "Invalid CSV format", count: 8, percentage: 57.1 },
      { error: "Missing required columns", count: 4, percentage: 28.6 },
      { error: "Data validation failed", count: 2, percentage: 14.3 },
    ],
    performanceMetrics: {
      averageProcessingTime: 2.3,
      p95ProcessingTime: 4.8,
      p99ProcessingTime: 7.2,
      throughputPerHour: 156,
    },
  };

  res.json({
    success: true,
    data: mockData,
    timeRange,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/analytics/dashboard", (req, res) => {
  const { timeRange = "24h", userId, jobType, errorCategory } = req.query;

  // Mock comprehensive dashboard data
  const mockDashboardData = {
    summary: {
      totalJobs: 156,
      completedJobs: 142,
      failedJobs: 14,
      successRate: 91.0,
      averageProcessingTime: 2.3,
      totalRecordsProcessed: 45678,
      errorRate: 9.0,
    },
    charts: {
      jobStatusDistribution: {
        completed: 142,
        failed: 14,
        pending: 0,
        running: 0,
      },
      processingTimeTrend: [
        { timestamp: "2025-10-20T16:00:00Z", avgTime: 2.1 },
        { timestamp: "2025-10-20T17:00:00Z", avgTime: 2.5 },
        { timestamp: "2025-10-20T18:00:00Z", avgTime: 2.2 },
        { timestamp: "2025-10-20T19:00:00Z", avgTime: 2.8 },
        { timestamp: "2025-10-20T20:00:00Z", avgTime: 2.3 },
      ],
      errorCategories: [
        { category: "Validation", count: 8 },
        { category: "Format", count: 4 },
        { category: "Network", count: 2 },
      ],
    },
    insights: [
      "Success rate has improved by 3.2% compared to last week",
      "Average processing time is within acceptable limits",
      "Error rate is below the 10% threshold",
    ],
  };

  res.json({
    success: true,
    data: mockDashboardData,
    filters: { timeRange, userId, jobType, errorCategory },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/analytics/errors", (req, res) => {
  const { timeRange = "24h", category, severity } = req.query;

  const mockErrorData = {
    summary: {
      totalErrors: 14,
      criticalErrors: 2,
      warningErrors: 8,
      infoErrors: 4,
      errorRate: 9.0,
    },
    errorsByCategory: [
      { category: "Validation", count: 8, percentage: 57.1 },
      { category: "Format", count: 4, percentage: 28.6 },
      { category: "Network", count: 2, percentage: 14.3 },
    ],
    recentErrors: [
      {
        id: "err_001",
        message: "Invalid CSV format",
        category: "Validation",
        severity: "error",
        timestamp: "2025-10-20T19:45:00Z",
        jobId: "job_123",
        userId: "user_456",
      },
      {
        id: "err_002",
        message: "Missing required columns",
        category: "Format",
        severity: "warning",
        timestamp: "2025-10-20T19:30:00Z",
        jobId: "job_124",
        userId: "user_789",
      },
    ],
    trends: [
      { timestamp: "2025-10-20T16:00:00Z", count: 2 },
      { timestamp: "2025-10-20T17:00:00Z", count: 3 },
      { timestamp: "2025-10-20T18:00:00Z", count: 4 },
      { timestamp: "2025-10-20T19:00:00Z", count: 3 },
      { timestamp: "2025-10-20T20:00:00Z", count: 2 },
    ],
  };

  res.json({
    success: true,
    data: mockErrorData,
    filters: { timeRange, category, severity },
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/analytics/performance", (req, res) => {
  const { timeRange = "24h", metric } = req.query;

  const mockPerformanceData = {
    summary: {
      averageProcessingTime: 2.3,
      p95ProcessingTime: 4.8,
      p99ProcessingTime: 7.2,
      throughputPerHour: 156,
      totalProcessingTime: 358.8,
      peakConcurrentJobs: 5,
    },
    metrics: {
      processingTime: {
        avg: 2.3,
        min: 0.8,
        max: 7.2,
        p50: 2.1,
        p95: 4.8,
        p99: 7.2,
      },
      throughput: {
        jobsPerHour: 156,
        recordsPerHour: 45678,
        avgRecordsPerJob: 293,
      },
      resources: {
        avgCpuUsage: 45.2,
        avgMemoryUsage: 62.8,
        peakCpuUsage: 78.5,
        peakMemoryUsage: 85.3,
      },
    },
    trends: [
      { timestamp: "2025-10-20T16:00:00Z", avgTime: 2.1, throughput: 142 },
      { timestamp: "2025-10-20T17:00:00Z", avgTime: 2.5, throughput: 158 },
      { timestamp: "2025-10-20T18:00:00Z", avgTime: 2.2, throughput: 165 },
      { timestamp: "2025-10-20T19:00:00Z", avgTime: 2.8, throughput: 178 },
      { timestamp: "2025-10-20T20:00:00Z", avgTime: 2.3, throughput: 156 },
    ],
  };

  res.json({
    success: true,
    data: mockPerformanceData,
    filters: { timeRange, metric },
    timestamp: new Date().toISOString(),
  });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    name: "Atlas2 API",
    version: "1.0.0",
    status: "running",
    timestamp: new Date().toISOString(),
    endpoints: {
      health: "/health",
      api: "/api",
      auth: "/api/auth",
      upload: "/api/upload",
      mapping: "/api/mapping",
      integrations: "/api/integrations",
      analytics: "/api/analytics",
    },
  });
});

// Error handling
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    path: req.path,
  });
});

app.use((err, req, res, next) => {
  console.error("Error:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error:
      process.env.NODE_ENV === "development"
        ? err.message
        : "Something went wrong",
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Atlas2 API Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(`API Base URL: http://localhost:${PORT}/api`);
  console.log(`Health Check: http://localhost:${PORT}/health`);
});

module.exports = app;
