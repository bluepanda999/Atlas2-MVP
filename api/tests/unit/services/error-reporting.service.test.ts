import { ErrorReportingService } from "../../../services/error-reporting.service";
import { DatabaseService } from "../../../services/database.service";

jest.mock("../../../services/database.service");

describe("ErrorReportingService", () => {
  let service: ErrorReportingService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    service = new ErrorReportingService(mockDatabaseService);
  });

  const createMockError = (overrides: any = {}) => ({
    id: "error_123",
    error_id: "error_123",
    type: "validation_error",
    severity: "error",
    message: "Test error message",
    details: { field: "test_field" },
    context: {
      user_id: "user_123",
      session_id: "session_123",
      action: "test_action",
      component: "test_component",
      timestamp: new Date(),
    },
    stack_trace: "Error: Test error\n    at test.js:1:1",
    recovery_suggestions: [
      {
        type: "fix",
        description: "Fix the test field",
        action: "update_field",
        target: "test_field",
      },
    ],
    status: "active",
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  describe("reportError", () => {
    it("should report error successfully", async () => {
      const errorData = {
        type: "validation_error",
        severity: "error",
        message: "Invalid email format detected",
        details: { field: "email", value: "invalid-email" },
        context: { user_id: "user_123", action: "validation" },
      };

      const reportedError = createMockError(errorData);
      mockDatabaseService.query.mockResolvedValue({ rows: [reportedError] });

      const result = await service.reportError(errorData);

      expect(result).toEqual(reportedError);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO error_reports"),
        expect.arrayContaining([
          errorData.type,
          errorData.severity,
          errorData.message,
          expect.any(String), // JSON serialized details
          expect.any(String), // JSON serialized context
          expect.any(String), // stack trace
          expect.arrayContaining([expect.any(Object)]), // recovery suggestions
          "active",
        ]),
      );
    });

    it("should handle missing required fields", async () => {
      const invalidErrorData = {
        type: "validation_error",
        // missing severity and message
      };

      await expect(
        service.reportError(invalidErrorData as any),
      ).rejects.toThrow("Missing required fields: type, severity, message");
    });

    it("should handle database errors", async () => {
      const errorData = {
        type: "validation_error",
        severity: "error",
        message: "Test error",
      };

      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.reportError(errorData)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getErrors", () => {
    it("should return errors with filters", async () => {
      const mockErrors = [createMockError()];
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: mockErrors })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const filters = {
        type: "validation_error",
        severity: "error",
        status: "active",
        user_id: "user_123",
        start_date: new Date("2023-01-01"),
        end_date: new Date("2023-12-31"),
      };

      const result = await service.getErrors(filters);

      expect(result.errors).toEqual(mockErrors);
      expect(result.total).toBe(1);
    });

    it("should handle pagination", async () => {
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getErrors({}, 1, 10);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $ OFFSET $"),
        expect.arrayContaining([10, 0]),
      );
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getErrors()).rejects.toThrow("Database error");
    });
  });

  describe("getErrorById", () => {
    it("should return error when found", async () => {
      const mockError = createMockError();
      mockDatabaseService.query.mockResolvedValue({ rows: [mockError] });

      const result = await service.getErrorById("error_123");

      expect(result).toEqual(mockError);
    });

    it("should return null when error not found", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getErrorById("nonexistent");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getErrorById("error_123")).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("updateErrorStatus", () => {
    it("should update error status successfully", async () => {
      const updatedError = createMockError({ status: "resolved" });
      mockDatabaseService.query.mockResolvedValue({ rows: [updatedError] });

      const result = await service.updateErrorStatus("error_123", "resolved");

      expect(result).toEqual(updatedError);
      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE error_reports SET status = $"),
        expect.arrayContaining(["resolved", "error_123"]),
      );
    });

    it("should handle invalid status", async () => {
      await expect(
        service.updateErrorStatus("error_123", "invalid_status" as any),
      ).rejects.toThrow("Invalid status: invalid_status");
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(
        service.updateErrorStatus("error_123", "resolved"),
      ).rejects.toThrow("Database error");
    });
  });

  describe("addErrorNote", () => {
    it("should add note to error successfully", async () => {
      const note = {
        content: "Investigating this issue",
        user_id: "user_123",
        type: "investigation",
      };

      const noteWithId = { ...note, id: "note_123", created_at: new Date() };
      mockDatabaseService.query.mockResolvedValue({ rows: [noteWithId] });

      const result = await service.addErrorNote("error_123", note);

      expect(result).toEqual(noteWithId);
    });

    it("should handle missing required fields", async () => {
      const invalidNote = {
        content: "Test note",
        // missing user_id
      };

      await expect(
        service.addErrorNote("error_123", invalidNote as any),
      ).rejects.toThrow("Missing required fields: content, user_id");
    });

    it("should handle database errors", async () => {
      const note = {
        content: "Test note",
        user_id: "user_123",
        type: "comment",
      };
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.addErrorNote("error_123", note)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getErrorAnalytics", () => {
    it("should return error analytics", async () => {
      const mockAnalytics = [
        { type: "validation_error", count: 10, percentage: 50 },
        { type: "system_error", count: 5, percentage: 25 },
        { type: "user_error", count: 5, percentage: 25 },
      ];

      mockDatabaseService.query.mockResolvedValue({ rows: mockAnalytics });

      const result = await service.getErrorAnalytics();

      expect(result.by_type).toEqual(mockAnalytics);
      expect(result.total_errors).toBe(20);
    });

    it("should handle date range filtering", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const startDate = new Date("2023-01-01");
      const endDate = new Date("2023-12-31");

      await service.getErrorAnalytics(startDate, endDate);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("created_at >= $ AND created_at <="),
        expect.arrayContaining([startDate, endDate]),
      );
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getErrorAnalytics()).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getRecoverySuggestions", () => {
    it("should return recovery suggestions for error type", async () => {
      const mockSuggestions = [
        {
          type: "fix",
          description: "Check email format",
          action: "validate_format",
          target: "email",
          success_rate: 0.8,
        },
      ];

      mockDatabaseService.query.mockResolvedValue({ rows: mockSuggestions });

      const result = await service.getRecoverySuggestions("validation_error");

      expect(result).toEqual(mockSuggestions);
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(
        service.getRecoverySuggestions("validation_error"),
      ).rejects.toThrow("Database error");
    });
  });

  describe("generateRecoverySuggestions", () => {
    it("should generate suggestions for validation errors", async () => {
      const error = createMockError({
        type: "validation_error",
        details: { field: "email", value: "invalid-email" },
      });

      const suggestions = await service.generateRecoverySuggestions(error);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "fix",
            description: expect.stringContaining("email format"),
            action: "validate_format",
            target: "email",
          }),
        ]),
      );
    });

    it("should generate suggestions for system errors", async () => {
      const error = createMockError({
        type: "system_error",
        details: { component: "database", error: "connection_failed" },
      });

      const suggestions = await service.generateRecoverySuggestions(error);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "retry",
            description: expect.stringContaining("retry"),
            action: "retry_operation",
          }),
        ]),
      );
    });

    it("should return generic suggestions for unknown error types", async () => {
      const error = createMockError({ type: "unknown_error" });

      const suggestions = await service.generateRecoverySuggestions(error);

      expect(suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "investigate",
            description: expect.stringContaining("investigate"),
          }),
        ]),
      );
    });
  });

  describe("Helper Methods", () => {
    describe("classifyError", () => {
      it("should classify validation errors", () => {
        const error = {
          message: "Invalid email format",
          details: { field: "email" },
        };
        const classification = (service as any).classifyError(error);

        expect(classification.type).toBe("validation_error");
        expect(classification.severity).toBe("error");
      });

      it("should classify system errors", () => {
        const error = {
          message: "Database connection failed",
          stack_trace: "Error: ECONNREFUSED",
        };
        const classification = (service as any).classifyError(error);

        expect(classification.type).toBe("system_error");
        expect(classification.severity).toBe("critical");
      });

      it("should classify user errors", () => {
        const error = {
          message: "User not found",
          context: { user_id: "user_123" },
        };
        const classification = (service as any).classifyError(error);

        expect(classification.type).toBe("user_error");
        expect(classification.severity).toBe("warning");
      });
    });

    describe("extractContext", () => {
      it("should extract context from request", () => {
        const req = {
          user: { id: "user_123" },
          session: { id: "session_123" },
          url: "/api/test",
          method: "POST",
        };

        const context = (service as any).extractContext(req);

        expect(context.user_id).toBe("user_123");
        expect(context.session_id).toBe("session_123");
        expect(context.action).toBe("POST /api/test");
      });
    });

    describe("sanitizeError", () => {
      it("should sanitize sensitive information", () => {
        const error = {
          message: "Database error: password=secret123",
          details: { api_key: "sk-1234567890" },
          stack_trace: "Error: password=secret123\n    at test.js",
        };

        const sanitized = (service as any).sanitizeError(error);

        expect(sanitized.message).not.toContain("secret123");
        expect(sanitized.details.api_key).toBe("[REDACTED]");
        expect(sanitized.stack_trace).not.toContain("secret123");
      });
    });
  });

  describe("Performance Tests", () => {
    it("should handle large error sets efficiently", async () => {
      const largeErrorSet = Array.from({ length: 1000 }, (_, i) =>
        createMockError({ id: `error_${i}` }),
      );
      mockDatabaseService.query.mockResolvedValue({ rows: largeErrorSet });

      const startTime = Date.now();
      const result = await service.getErrors();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.errors).toHaveLength(1000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle null/undefined inputs gracefully", async () => {
      await expect(service.getErrorById(null as any)).resolves.not.toThrow();
      await expect(
        service.getErrorById(undefined as any),
      ).resolves.not.toThrow();
    });

    it("should handle empty error data", async () => {
      const emptyError = {};

      await expect(service.reportError(emptyError as any)).rejects.toThrow();
    });

    it("should handle malformed JSON in details/context", async () => {
      const errorWithCircularRef = { a: 1 };
      errorWithCircularRef.self = errorWithCircularRef;

      const errorData = {
        type: "test_error",
        severity: "error",
        message: "Test",
        details: errorWithCircularRef,
      };

      // Should not throw when serializing circular references
      await expect(service.reportError(errorData)).rejects.toThrow();
    });
  });
});
