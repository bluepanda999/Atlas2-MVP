/**
 * Tests for Job Queue Management Service
 */

import {
  JobQueueManagementService,
  Job,
  JobType,
  JobStatus,
  JobPriority,
} from "../../../api/services/job-queue-management.service";
import { DatabaseService } from "../../../api/services/database.service";

// Mock dependencies
jest.mock("../../../api/services/database.service");
jest.mock("../../../api/utils/logger");

describe("JobQueueManagementService", () => {
  let jobQueueService: JobQueueManagementService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    jobQueueService = new JobQueueManagementService(mockDatabaseService);

    // Mock database responses
    mockDatabaseService.query = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("submitJob", () => {
    it("should submit a job successfully", async () => {
      // Arrange
      const jobData = {
        type: JobType.CSV_PROCESSING,
        priority: JobPriority.NORMAL,
        user_id: "user123",
        payload: { file_path: "/tmp/test.csv" },
        max_retries: 3,
        metadata: { source: "test" },
      };

      const mockResult = {
        rows: [{ id: "job123" }],
      };
      mockDatabaseService.query.mockResolvedValue(mockResult);

      // Act
      const result = await jobQueueService.submitJob(jobData);

      // Assert
      expect(result.success).toBe(true);
      expect(result.jobId).toBe("job123");
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO jobs"),
        expect.arrayContaining([
          JobType.CSV_PROCESSING,
          JobStatus.PENDING,
          JobPriority.NORMAL,
          "user123",
          expect.stringContaining("file_path"),
          expect.stringContaining("[]"),
          3,
          0,
          expect.any(String), // created_at
          0,
          expect.stringContaining("source"),
        ]),
      );
    });

    it("should reject job when queue is full", async () => {
      // Arrange
      const jobData = {
        type: JobType.CSV_PROCESSING,
        priority: JobPriority.NORMAL,
        user_id: "user123",
        payload: {},
        max_retries: 3,
        metadata: {},
      };

      // Mock queue stats as full
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ queue_depth: 1000 }], // max_queue_size is 1000
      });

      // Act
      const result = await jobQueueService.submitJob(jobData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Queue is full");
    });

    it("should reject job with insufficient resources", async () => {
      // Arrange
      const jobData = {
        type: JobType.CSV_PROCESSING,
        priority: JobPriority.NORMAL,
        user_id: "user123",
        payload: {},
        max_retries: 3,
        metadata: {},
      };

      // Mock queue stats with space
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [{ queue_depth: 100 }],
      });

      // Mock insufficient resources
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [
          {
            cpu_usage: 0.95,
            memory_usage: 0.95,
            active_jobs: 15,
          },
        ],
      });

      // Act
      const result = await jobQueueService.submitJob(jobData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("Insufficient resources");
    });
  });

  describe("getJob", () => {
    it("should return a job when found", async () => {
      // Arrange
      const jobId = "job123";
      const mockJob = {
        id: jobId,
        type: JobType.CSV_PROCESSING,
        status: JobStatus.PENDING,
        priority: JobPriority.NORMAL,
        user_id: "user123",
        payload: { file_path: "/tmp/test.csv" },
        max_retries: 3,
        retry_count: 0,
        created_at: new Date(),
        scheduled_at: new Date(),
        progress: 0,
        metadata: { source: "test" },
      };

      mockDatabaseService.query.mockResolvedValue({
        rows: [mockJob],
      });

      // Act
      const result = await jobQueueService.getJob(jobId);

      // Assert
      expect(result).toEqual(mockJob);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        "SELECT * FROM jobs WHERE id = $1",
        [jobId],
      );
    });

    it("should return null when job not found", async () => {
      // Arrange
      const jobId = "nonexistent";
      mockDatabaseService.query.mockResolvedValue({
        rows: [],
      });

      // Act
      const result = await jobQueueService.getJob(jobId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updateJobStatus", () => {
    it("should update job status successfully", async () => {
      // Arrange
      const jobId = "job123";
      const status = JobStatus.RUNNING;
      const progress = 50;

      mockDatabaseService.query.mockResolvedValue({
        rows: [{ id: jobId }],
      });

      // Act
      const result = await jobQueueService.updateJobStatus(
        jobId,
        status,
        progress,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs SET"),
        expect.arrayContaining([jobId, status, progress]),
      );
    });

    it("should update job status with error message", async () => {
      // Arrange
      const jobId = "job123";
      const status = JobStatus.FAILED;
      const errorMessage = "Processing failed";

      mockDatabaseService.query.mockResolvedValue({
        rows: [{ id: jobId }],
      });

      // Act
      const result = await jobQueueService.updateJobStatus(
        jobId,
        status,
        undefined,
        errorMessage,
      );

      // Assert
      expect(result.success).toBe(true);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE jobs SET"),
        expect.arrayContaining([jobId, status, errorMessage]),
      );
    });
  });

  describe("getQueueStats", () => {
    it("should return comprehensive queue statistics", async () => {
      // Arrange
      const mockStatusStats = [
        { status: "pending", count: 10 },
        { status: "running", count: 5 },
        { status: "completed", count: 100 },
      ];

      const mockPriorityStats = [
        { priority: "critical", count: 2 },
        { priority: "normal", count: 13 },
      ];

      const mockTypeStats = [
        { type: "csv_processing", count: 8 },
        { type: "api_upload", count: 7 },
      ];

      const mockTimingStats = [
        { avg_wait_time: 30.5 },
        { avg_processing_time: 120.2 },
      ];

      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: mockStatusStats })
        .mockResolvedValueOnce({ rows: mockPriorityStats })
        .mockResolvedValueOnce({ rows: mockTypeStats })
        .mockResolvedValueOnce({ rows: mockTimingStats })
        .mockResolvedValueOnce({
          rows: [{ cpu_usage: 0.3, memory_usage: 0.4 }],
        });

      // Act
      const stats = await jobQueueService.getQueueStats();

      // Assert
      expect(stats).toHaveProperty("total_jobs");
      expect(stats).toHaveProperty("jobs_by_status");
      expect(stats).toHaveProperty("jobs_by_priority");
      expect(stats).toHaveProperty("jobs_by_type");
      expect(stats).toHaveProperty("average_wait_time");
      expect(stats).toHaveProperty("average_processing_time");
      expect(stats).toHaveProperty("resource_utilization");

      expect(stats.total_jobs).toBe(115); // 10 + 5 + 100
      expect(stats.jobs_by_status.pending).toBe(10);
      expect(stats.jobs_by_status.running).toBe(5);
      expect(stats.jobs_by_status.completed).toBe(100);
    });
  });

  describe("validateDependencies", () => {
    it("should return valid when all dependencies are completed", async () => {
      // Arrange
      const dependencies = ["job1", "job2"];
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          { status: JobStatus.COMPLETED },
          { status: JobStatus.COMPLETED },
        ],
      });

      // Act
      const result = await jobQueueService.validateDependencies(dependencies);

      // Assert
      expect(result.valid).toBe(true);
    });

    it("should return invalid when any dependency is not completed", async () => {
      // Arrange
      const dependencies = ["job1", "job2"];
      mockDatabaseService.query.mockResolvedValue({
        rows: [{ status: JobStatus.COMPLETED }, { status: JobStatus.FAILED }],
      });

      // Act
      const result = await jobQueueService.validateDependencies(dependencies);

      // Assert
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not completed");
    });
  });

  describe("checkResourceAvailability", () => {
    it("should return available when resources are sufficient", async () => {
      // Arrange
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          {
            cpu_usage: 0.3,
            memory_usage: 0.4,
            active_jobs: 5,
          },
        ],
      });

      // Act
      const result = await jobQueueService.checkResourceAvailability();

      // Assert
      expect(result.available).toBe(true);
    });

    it("should return unavailable when CPU usage is too high", async () => {
      // Arrange
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          {
            cpu_usage: 0.95,
            memory_usage: 0.4,
            active_jobs: 5,
          },
        ],
      });

      // Act
      const result = await jobQueueService.checkResourceAvailability();

      // Assert
      expect(result.available).toBe(false);
      expect(result.reason).toContain("CPU");
    });

    it("should return unavailable when memory usage is too high", async () => {
      // Arrange
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          {
            cpu_usage: 0.3,
            memory_usage: 0.95,
            active_jobs: 5,
          },
        ],
      });

      // Act
      const result = await jobQueueService.checkResourceAvailability();

      // Assert
      expect(result.available).toBe(false);
      expect(result.reason).toContain("Memory");
    });

    it("should return unavailable when too many active jobs", async () => {
      // Arrange
      mockDatabaseService.query.mockResolvedValue({
        rows: [
          {
            cpu_usage: 0.3,
            memory_usage: 0.4,
            active_jobs: 15,
          },
        ],
      });

      // Act
      const result = await jobQueueService.checkResourceAvailability();

      // Assert
      expect(result.available).toBe(false);
      expect(result.reason).toContain("Active jobs");
    });
  });

  describe("error handling", () => {
    it("should handle database errors gracefully", async () => {
      // Arrange
      const jobData = {
        type: JobType.CSV_PROCESSING,
        priority: JobPriority.NORMAL,
        user_id: "user123",
        payload: {},
        max_retries: 3,
        metadata: {},
      };

      mockDatabaseService.query.mockRejectedValue(
        new Error("Database connection failed"),
      );

      // Act
      const result = await jobQueueService.submitJob(jobData);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Failed to submit job");
    });
  });
});
