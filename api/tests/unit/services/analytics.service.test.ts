import { AnalyticsService } from "../../../services/analytics.service";
import { DatabaseService } from "../../../services/database.service";

jest.mock("../../../services/database.service");

describe("AnalyticsService", () => {
  let service: AnalyticsService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    service = new AnalyticsService(mockDatabaseService);
  });

  const createMockSystemMetrics = () => ({
    avg_cpu: 45.5,
    max_cpu: 78.2,
    min_cpu: 12.1,
    avg_memory: 62.3,
    max_memory: 85.7,
    min_memory: 34.2,
    avg_disk: 55.8,
    max_disk: 67.4,
    min_disk: 41.2,
    avg_network: 23.4,
    max_network: 45.6,
    min_network: 8.9,
  });

  const createMockCurrentMetrics = () => ({
    cpu_usage: 52.3,
    memory_usage: 68.7,
    disk_usage: 58.9,
    network_io: 31.2,
    uptime: 86400,
  });

  const createMockJobs = () => [
    {
      status: "completed",
      job_type: "csv_import",
      duration: 120,
      created_at: new Date(),
    },
    {
      status: "completed",
      job_type: "data_validation",
      duration: 85,
      created_at: new Date(),
    },
    {
      status: "failed",
      job_type: "csv_import",
      duration: 45,
      created_at: new Date(),
    },
    {
      status: "completed",
      job_type: "api_sync",
      duration: 200,
      created_at: new Date(),
    },
  ];

  const createMockErrors = () => [
    {
      error_type: "validation_error",
      error_category: "data_quality",
      error_message: "Invalid email format",
      created_at: new Date(),
      resolved_at: new Date(Date.now() + 300000),
      severity: "error",
    },
    {
      error_type: "system_error",
      error_category: "infrastructure",
      error_message: "Database connection failed",
      created_at: new Date(),
      resolved_at: new Date(Date.now() + 600000),
      severity: "critical",
    },
  ];

  const createMockQueueMetrics = () => [
    {
      queue_depth: 25,
      average_wait_time: 45,
      average_processing_time: 120,
      queue_utilization: 75,
      timestamp: new Date(),
    },
    {
      queue_depth: 30,
      average_wait_time: 52,
      average_processing_time: 135,
      queue_utilization: 82,
      timestamp: new Date(),
    },
    {
      queue_depth: 18,
      average_wait_time: 38,
      average_processing_time: 105,
      queue_utilization: 68,
      timestamp: new Date(),
    },
  ];

  const createMockUserActivities = () => [
    {
      user_id: "user_1",
      last_active: new Date(),
      session_duration: 1800,
      feature_usage: { upload: 5, validate: 3 },
      rating: 4,
    },
    {
      user_id: "user_2",
      last_active: new Date(),
      session_duration: 2400,
      feature_usage: { upload: 8, validate: 6 },
      rating: 5,
    },
    {
      user_id: "user_3",
      last_active: new Date(),
      session_duration: 900,
      feature_usage: { upload: 2, validate: 1 },
      rating: 3,
    },
  ];

  describe("getDashboardData", () => {
    it("should return complete dashboard data", async () => {
      const startTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const endTime = new Date();

      // Mock system metrics query
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [createMockSystemMetrics()] })
        .mockResolvedValueOnce({ rows: [createMockCurrentMetrics()] });

      // Mock jobs query
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: createMockJobs(),
      });

      // Mock errors query
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: createMockErrors(),
      });

      // Mock queue metrics query
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: createMockQueueMetrics(),
      });

      // Mock user activity query
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: createMockUserActivities(),
      });

      const result = await service.getDashboardData("24h");

      expect(result).toHaveProperty("timeRange");
      expect(result).toHaveProperty("systemMetrics");
      expect(result).toHaveProperty("jobMetrics");
      expect(result).toHaveProperty("errorMetrics");
      expect(result).toHaveProperty("queueMetrics");
      expect(result).toHaveProperty("userMetrics");
      expect(result).toHaveProperty("insights");
      expect(result).toHaveProperty("lastUpdated");
      expect(result.insights).toBeInstanceOf(Array);
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.query.mockRejectedValue(
        new Error("Database connection failed"),
      );

      await expect(service.getDashboardData("24h")).rejects.toThrow(
        "Analytics dashboard data fetch failed",
      );
    });

    it("should use default time range when invalid range provided", async () => {
      // Mock all queries to return empty results
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getDashboardData("invalid_range");

      expect(result.timeRange.startTime).toBeInstanceOf(Date);
      expect(result.timeRange.endTime).toBeInstanceOf(Date);
    });
  });

  describe("getSystemMetrics", () => {
    it("should calculate system metrics correctly", async () => {
      const mockMetrics = createMockSystemMetrics();
      const mockCurrent = createMockCurrentMetrics();

      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [mockMetrics] })
        .mockResolvedValueOnce({ rows: [mockCurrent] });

      const result = await service.getSystemMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.cpu.current).toBe(mockCurrent.cpu_usage);
      expect(result.cpu.average).toBe(mockMetrics.avg_cpu);
      expect(result.cpu.min).toBe(mockMetrics.min_cpu);
      expect(result.cpu.max).toBe(mockMetrics.max_cpu);
      expect(result.cpu.trend).toBeDefined();
    });

    it("should return default metrics when query fails", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Query failed"));

      const result = await service.getSystemMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.cpu.current).toBe(0);
      expect(result.memory.current).toBe(0);
      expect(result.disk.current).toBe(0);
      expect(result.network.current).toBe(0);
      expect(result.uptime).toBe(0);
    });
  });

  describe("getJobMetrics", () => {
    it("should calculate job metrics correctly", async () => {
      const mockJobs = createMockJobs();
      mockDatabaseService.query.mockResolvedValue({ rows: mockJobs });

      const result = await service.getJobMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.successRate.percentage).toBe(75); // 3 completed out of 4
      expect(result.successRate.successful).toBe(3);
      expect(result.successRate.failed).toBe(1);
      expect(result.successRate.total).toBe(4);
      expect(result.throughput.jobsPerHour).toBeGreaterThan(0);
      expect(result.averageDuration.average).toBeGreaterThan(0);
    });

    it("should handle empty job data", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getJobMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.successRate.percentage).toBe(100);
      expect(result.successRate.successful).toBe(0);
      expect(result.successRate.failed).toBe(0);
      expect(result.successRate.total).toBe(0);
    });

    it("should apply job type filter", async () => {
      const mockJobs = createMockJobs();
      mockDatabaseService.query.mockResolvedValue({ rows: mockJobs });

      const result = await service.getJobMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
        { jobType: "csv_import" },
      );

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE created_at >= $1 AND created_at <= $2"),
        expect.arrayContaining([
          expect.any(Date),
          expect.any(Date),
          "csv_import",
        ]),
      );
    });
  });

  describe("getErrorMetrics", () => {
    it("should calculate error metrics correctly", async () => {
      const mockErrors = createMockErrors();
      mockDatabaseService.query.mockResolvedValue({ rows: mockErrors });

      const result = await service.getErrorMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.errorCategories).toHaveLength(2);
      expect(result.topErrors).toHaveLength(2);
      expect(result.resolutionTime.average).toBeGreaterThan(0);
      expect(result.trends.hourly).toBeInstanceOf(Array);
    });

    it("should handle empty error data", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getErrorMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.errorRate.percentage).toBe(0);
      expect(result.errorRate.errors).toBe(0);
      expect(result.errorCategories).toHaveLength(0);
      expect(result.topErrors).toHaveLength(0);
    });

    it("should apply error category filter", async () => {
      const mockErrors = createMockErrors();
      mockDatabaseService.query.mockResolvedValue({ rows: mockErrors });

      await service.getErrorMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
        { errorCategory: "data_quality" },
      );

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE created_at >= $1 AND created_at <= $2"),
        expect.arrayContaining([
          expect.any(Date),
          expect.any(Date),
          "data_quality",
        ]),
      );
    });
  });

  describe("getQueueMetrics", () => {
    it("should calculate queue metrics correctly", async () => {
      const mockQueueData = createMockQueueMetrics();
      mockDatabaseService.query.mockResolvedValue({ rows: mockQueueData });

      const result = await service.getQueueMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.queueDepth).toEqual([25, 30, 18]);
      expect(result.waitTime).toEqual([45, 52, 38]);
      expect(result.processingTime).toEqual([120, 135, 105]);
      expect(result.queueUtilization).toBe(68); // Last value
    });

    it("should identify bottlenecks correctly", async () => {
      const mockQueueData = [
        {
          queue_depth: 150,
          average_wait_time: 120,
          average_processing_time: 180,
          queue_utilization: 95,
          timestamp: new Date(),
        },
      ];
      mockDatabaseService.query.mockResolvedValue({ rows: mockQueueData });

      const result = await service.getQueueMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.bottlenecks.length).toBeGreaterThan(0);
      expect(result.bottlenecks[0].type).toBe("queue_depth");
      expect(result.bottlenecks[0].severity).toBe("high");
    });

    it("should return default queue metrics when query fails", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Query failed"));

      const result = await service.getQueueMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.queueDepth).toEqual([]);
      expect(result.waitTime).toEqual([]);
      expect(result.processingTime).toEqual([]);
      expect(result.queueUtilization).toBe(0);
      expect(result.bottlenecks).toEqual([]);
    });
  });

  describe("getUserMetrics", () => {
    it("should calculate user metrics correctly", async () => {
      const mockActivities = createMockUserActivities();
      mockDatabaseService.query.mockResolvedValue({ rows: mockActivities });

      const result = await service.getUserMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.activeUsers).toBe(3); // 3 unique users
      expect(result.userActivity.dailyActiveUsers).toBe(3);
      expect(result.userActivity.averageSessionDuration).toBeGreaterThan(0);
      expect(result.userSatisfaction.averageRating).toBe(4); // (4+5+3)/3
      expect(result.featureUsage.features).toHaveProperty("upload");
      expect(result.featureUsage.features).toHaveProperty("validate");
    });

    it("should handle empty user activity data", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getUserMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );

      expect(result.activeUsers).toBe(0);
      expect(result.userActivity.dailyActiveUsers).toBe(0);
      expect(result.userSatisfaction.averageRating).toBe(0);
      expect(result.featureUsage.features).toEqual({});
    });

    it("should apply user filter", async () => {
      const mockActivities = createMockUserActivities();
      mockDatabaseService.query.mockResolvedValue({ rows: mockActivities });

      await service.getUserMetrics(new Date(Date.now() - 3600000), new Date(), {
        userId: "user_1",
      });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining(
          "WHERE last_active >= $1 AND last_active <= $2",
        ),
        expect.arrayContaining([expect.any(Date), expect.any(Date), "user_1"]),
      );
    });
  });

  describe("generateInsights", () => {
    it("should generate performance insights for high CPU usage", async () => {
      const metrics = {
        systemMetrics: {
          cpu: {
            current: 95,
            average: 80,
            min: 20,
            max: 95,
            trend: "increasing",
          },
          memory: {
            current: 50,
            average: 45,
            min: 30,
            max: 60,
            trend: "stable",
          },
          disk: { current: 40, average: 35, min: 25, max: 50, trend: "stable" },
          network: {
            current: 30,
            average: 25,
            min: 15,
            max: 40,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 2, jobsPerHour: 120, daily: 2880 },
          successRate: {
            percentage: 98,
            successful: 98,
            failed: 2,
            total: 100,
          },
          averageDuration: { average: 60, median: 55, min: 30, max: 120 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 2, errors: 2, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 50,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 10,
          userActivity: {
            dailyActiveUsers: 10,
            weeklyActiveUsers: 25,
            monthlyActiveUsers: 50,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.5,
            totalRatings: 20,
            distribution: {},
          },
        },
      };

      const insights = await service.generateInsights(metrics);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "performance",
            severity: "critical",
            title: "Critical Memory Usage",
            description: expect.stringContaining("95%"),
          }),
        ]),
      );
    });

    it("should generate error insights for low success rate", async () => {
      const metrics = {
        systemMetrics: {
          cpu: { current: 30, average: 25, min: 15, max: 40, trend: "stable" },
          memory: {
            current: 40,
            average: 35,
            min: 25,
            max: 50,
            trend: "stable",
          },
          disk: { current: 30, average: 25, min: 20, max: 40, trend: "stable" },
          network: {
            current: 20,
            average: 15,
            min: 10,
            max: 30,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 1, jobsPerHour: 60, daily: 1440 },
          successRate: {
            percentage: 85,
            successful: 85,
            failed: 15,
            total: 100,
          },
          averageDuration: { average: 120, median: 100, min: 60, max: 240 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: {
            percentage: 15,
            errors: 15,
            total: 100,
            trend: "increasing",
          },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 600, median: 480, min: 120, max: 1200 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 60,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 10,
          userActivity: {
            dailyActiveUsers: 10,
            weeklyActiveUsers: 25,
            monthlyActiveUsers: 50,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.5,
            totalRatings: 20,
            distribution: {},
          },
        },
      };

      const insights = await service.generateInsights(metrics);

      expect(insights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "error",
            severity: "warning",
            title: "Low Job Success Rate",
            description: expect.stringContaining("85%"),
          }),
        ]),
      );
    });

    it("should return empty insights when all metrics are healthy", async () => {
      const metrics = {
        systemMetrics: {
          cpu: { current: 30, average: 25, min: 15, max: 40, trend: "stable" },
          memory: {
            current: 40,
            average: 35,
            min: 25,
            max: 50,
            trend: "stable",
          },
          disk: { current: 30, average: 25, min: 20, max: 40, trend: "stable" },
          network: {
            current: 20,
            average: 15,
            min: 10,
            max: 30,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 2, jobsPerHour: 120, daily: 2880 },
          successRate: {
            percentage: 98,
            successful: 98,
            failed: 2,
            total: 100,
          },
          averageDuration: { average: 60, median: 55, min: 30, max: 120 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 2, errors: 2, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 50,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 10,
          userActivity: {
            dailyActiveUsers: 10,
            weeklyActiveUsers: 25,
            monthlyActiveUsers: 50,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.5,
            totalRatings: 20,
            distribution: {},
          },
        },
      };

      const insights = await service.generateInsights(metrics);

      expect(insights).toEqual([]);
    });
  });

  describe("exportData", () => {
    it("should export data as CSV", async () => {
      const mockData = {
        timeRange: { startTime: new Date(), endTime: new Date() },
        systemMetrics: {
          cpu: { current: 50, average: 45, min: 20, max: 80, trend: "stable" },
          memory: {
            current: 60,
            average: 55,
            min: 30,
            max: 90,
            trend: "increasing",
          },
          disk: { current: 40, average: 35, min: 25, max: 60, trend: "stable" },
          network: {
            current: 30,
            average: 25,
            min: 15,
            max: 50,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 1.5, jobsPerHour: 90, daily: 2160 },
          successRate: {
            percentage: 95,
            successful: 95,
            failed: 5,
            total: 100,
          },
          averageDuration: { average: 120, median: 100, min: 60, max: 240 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 5, errors: 5, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 70,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 15,
          userActivity: {
            dailyActiveUsers: 15,
            weeklyActiveUsers: 30,
            monthlyActiveUsers: 60,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.2,
            totalRatings: 25,
            distribution: {},
          },
        },
        insights: [],
        lastUpdated: new Date(),
      };

      const result = await service.exportData(mockData, "csv");

      expect(result).toBeInstanceOf(Buffer);
      const csvString = result.toString();
      expect(csvString).toContain("Metric,Current Value,Average,Min,Max,Trend");
      expect(csvString).toContain("CPU Usage,50.0,45.0,20.0,80.0,stable");
      expect(csvString).toContain(
        "Memory Usage,60.0,55.0,30.0,90.0,increasing",
      );
    });

    it("should export data as JSON", async () => {
      const mockData = {
        timeRange: { startTime: new Date(), endTime: new Date() },
        systemMetrics: {
          cpu: { current: 50, average: 45, min: 20, max: 80, trend: "stable" },
          memory: {
            current: 60,
            average: 55,
            min: 30,
            max: 90,
            trend: "increasing",
          },
          disk: { current: 40, average: 35, min: 25, max: 60, trend: "stable" },
          network: {
            current: 30,
            average: 25,
            min: 15,
            max: 50,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 1.5, jobsPerHour: 90, daily: 2160 },
          successRate: {
            percentage: 95,
            successful: 95,
            failed: 5,
            total: 100,
          },
          averageDuration: { average: 120, median: 100, min: 60, max: 240 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 5, errors: 5, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 70,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 15,
          userActivity: {
            dailyActiveUsers: 15,
            weeklyActiveUsers: 30,
            monthlyActiveUsers: 60,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.2,
            totalRatings: 25,
            distribution: {},
          },
        },
        insights: [],
        lastUpdated: new Date(),
      };

      const result = await service.exportData(mockData, "json");

      expect(result).toBeInstanceOf(Buffer);
      const jsonString = result.toString();
      const parsed = JSON.parse(jsonString);
      expect(parsed).toHaveProperty("exportTime");
      expect(parsed).toHaveProperty("timeRange");
      expect(parsed).toHaveProperty("metrics");
      expect(parsed.metrics.system).toBeDefined();
      expect(parsed.metrics.jobs).toBeDefined();
    });

    it("should export data as PDF", async () => {
      const mockData = {
        timeRange: { startTime: new Date(), endTime: new Date() },
        systemMetrics: {
          cpu: { current: 50, average: 45, min: 20, max: 80, trend: "stable" },
          memory: {
            current: 60,
            average: 55,
            min: 30,
            max: 90,
            trend: "increasing",
          },
          disk: { current: 40, average: 35, min: 25, max: 60, trend: "stable" },
          network: {
            current: 30,
            average: 25,
            min: 15,
            max: 50,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 1.5, jobsPerHour: 90, daily: 2160 },
          successRate: {
            percentage: 95,
            successful: 95,
            failed: 5,
            total: 100,
          },
          averageDuration: { average: 120, median: 100, min: 60, max: 240 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 5, errors: 5, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 70,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 15,
          userActivity: {
            dailyActiveUsers: 15,
            weeklyActiveUsers: 30,
            monthlyActiveUsers: 60,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.2,
            totalRatings: 25,
            distribution: {},
          },
        },
        insights: [],
        lastUpdated: new Date(),
      };

      const result = await service.exportData(mockData, "pdf");

      expect(result).toBeInstanceOf(Buffer);
      const pdfString = result.toString();
      expect(pdfString).toContain("Analytics Dashboard Report");
      expect(pdfString).toContain("SYSTEM METRICS");
      expect(pdfString).toContain("CPU Usage: 50.0%");
      expect(pdfString).toContain("Memory Usage: 60.0%");
    });

    it("should throw error for unsupported export format", async () => {
      const mockData = {
        timeRange: { startTime: new Date(), endTime: new Date() },
        systemMetrics: {
          cpu: { current: 50, average: 45, min: 20, max: 80, trend: "stable" },
          memory: {
            current: 60,
            average: 55,
            min: 30,
            max: 90,
            trend: "increasing",
          },
          disk: { current: 40, average: 35, min: 25, max: 60, trend: "stable" },
          network: {
            current: 30,
            average: 25,
            min: 15,
            max: 50,
            trend: "stable",
          },
          uptime: 86400,
        },
        jobMetrics: {
          throughput: { jobsPerMinute: 1.5, jobsPerHour: 90, daily: 2160 },
          successRate: {
            percentage: 95,
            successful: 95,
            failed: 5,
            total: 100,
          },
          averageDuration: { average: 120, median: 100, min: 60, max: 240 },
          jobTypes: [],
          trends: {},
        },
        errorMetrics: {
          errorRate: { percentage: 5, errors: 5, total: 100, trend: "stable" },
          errorCategories: [],
          topErrors: [],
          resolutionTime: { average: 300, median: 240, min: 60, max: 600 },
          trends: { hourly: [], daily: [], categories: {} },
        },
        queueMetrics: {
          queueDepth: [],
          waitTime: [],
          processingTime: [],
          queueUtilization: 70,
          bottlenecks: [],
        },
        userMetrics: {
          activeUsers: 15,
          userActivity: {
            dailyActiveUsers: 15,
            weeklyActiveUsers: 30,
            monthlyActiveUsers: 60,
            averageSessionDuration: 1800,
          },
          featureUsage: { features: {} },
          userSatisfaction: {
            averageRating: 4.2,
            totalRatings: 25,
            distribution: {},
          },
        },
        insights: [],
        lastUpdated: new Date(),
      };

      await expect(service.exportData(mockData, "xml")).rejects.toThrow(
        "Export failed: Unsupported export format: xml",
      );
    });
  });

  describe("Helper Methods", () => {
    describe("calculateTrend", () => {
      it("should identify increasing trend", () => {
        const values = [10, 15, 20, 25, 30];
        const trend = (service as any).calculateTrend(values);
        expect(trend).toBe("increasing");
      });

      it("should identify decreasing trend", () => {
        const values = [30, 25, 20, 15, 10];
        const trend = (service as any).calculateTrend(values);
        expect(trend).toBe("decreasing");
      });

      it("should identify stable trend", () => {
        const values = [20, 21, 19, 20, 22];
        const trend = (service as any).calculateTrend(values);
        expect(trend).toBe("stable");
      });

      it("should handle insufficient data", () => {
        const values = [20];
        const trend = (service as any).calculateTrend(values);
        expect(trend).toBe("stable");
      });
    });

    describe("parseTimeRange", () => {
      it("should parse time ranges correctly", () => {
        expect((service as any).parseTimeRange("1h")).toBe(60 * 60 * 1000);
        expect((service as any).parseTimeRange("24h")).toBe(
          24 * 60 * 60 * 1000,
        );
        expect((service as any).parseTimeRange("7d")).toBe(
          7 * 24 * 60 * 60 * 1000,
        );
      });

      it("should default to 24h for invalid range", () => {
        const result = (service as any).parseTimeRange("invalid");
        expect(result).toBe(24 * 60 * 60 * 1000);
      });
    });

    describe("roundToTwo", () => {
      it("should round numbers to two decimal places", () => {
        expect((service as any).roundToTwo(3.14159)).toBe(3.14);
        expect((service as any).roundToTwo(3.145)).toBe(3.15);
        expect((service as any).roundToTwo(3)).toBe(3);
      });
    });
  });

  describe("Performance Tests", () => {
    it("should handle large datasets efficiently", async () => {
      // Mock large dataset
      const largeJobs = Array.from({ length: 10000 }, (_, i) => ({
        status: i % 10 === 0 ? "failed" : "completed",
        job_type: "bulk_import",
        duration: Math.random() * 300,
        created_at: new Date(Date.now() - Math.random() * 3600000),
      }));

      mockDatabaseService.query.mockResolvedValue({ rows: largeJobs });

      const startTime = Date.now();
      const result = await service.getJobMetrics(
        new Date(Date.now() - 3600000),
        new Date(),
      );
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.successRate.total).toBe(10000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined inputs gracefully", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getDashboardData("24h", null as any);

      expect(result).toBeDefined();
      expect(result.systemMetrics).toBeDefined();
      expect(result.jobMetrics).toBeDefined();
      expect(result.errorMetrics).toBeDefined();
      expect(result.queueMetrics).toBeDefined();
      expect(result.userMetrics).toBeDefined();
    });

    it("should handle malformed data gracefully", async () => {
      // Mock malformed data
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [{}] }) // Empty system metrics
        .mockResolvedValueOnce({ rows: [{}] }) // Empty current metrics
        .mockResolvedValueOnce({ rows: [{}] }) // Empty jobs
        .mockResolvedValueOnce({ rows: [{}] }) // Empty errors
        .mockResolvedValueOnce({ rows: [{}] }); // Empty queue metrics

      const result = await service.getDashboardData("24h");

      expect(result.systemMetrics.cpu.current).toBe(0);
      expect(result.jobMetrics.successRate.percentage).toBe(100);
      expect(result.errorMetrics.errorRate.percentage).toBe(0);
    });
  });
});
