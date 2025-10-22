import { logger } from "../utils/logger";
import { DatabaseService } from "./database.service";

export interface ErrorReport {
  id: string;
  job_id?: string;
  user_id: string;
  error_type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  details: ErrorDetails;
  context: ErrorContext;
  recovery_suggestions: RecoverySuggestion[];
  status: ErrorStatus;
  created_at: Date;
  updated_at: Date;
  resolved_at?: Date;
  resolved_by?: string;
}

export enum ErrorType {
  VALIDATION = "validation",
  TRANSFORMATION = "transformation",
  API_CONNECTION = "api_connection",
  DATA_FORMAT = "data_format",
  SYSTEM = "system",
  NETWORK = "network",
  AUTHENTICATION = "authentication",
  PERMISSION = "permission",
  TIMEOUT = "timeout",
  RESOURCE = "resource",
}

export enum ErrorSeverity {
  CRITICAL = "critical",
  HIGH = "high",
  MEDIUM = "medium",
  LOW = "low",
  INFO = "info",
}

export enum ErrorStatus {
  OPEN = "open",
  INVESTIGATING = "investigating",
  RESOLVED = "resolved",
  IGNORED = "ignored",
  FALSE_POSITIVE = "false_positive",
}

export interface ErrorDetails {
  stack_trace?: string;
  row_number?: number;
  field_name?: string;
  data_sample?: any;
  api_endpoint?: string;
  http_status?: number;
  response_body?: string;
  component?: string;
  function_name?: string;
  parameters?: Record<string, any>;
}

export interface ErrorContext {
  job_type?: string;
  processing_stage?: string;
  file_name?: string;
  mapping_id?: string;
  api_config_id?: string;
  user_agent?: string;
  ip_address?: string;
  session_id?: string;
  correlation_id?: string;
  system_info?: SystemInfo;
}

export interface SystemInfo {
  cpu_usage?: number;
  memory_usage?: number;
  disk_usage?: number;
  active_connections?: number;
  queue_size?: number;
}

export interface RecoverySuggestion {
  type: SuggestionType;
  title: string;
  description: string;
  steps: string[];
  automated_fix?: boolean;
  confidence: number; // 0-100
  estimated_time?: number; // in minutes
}

export enum SuggestionType {
  DATA_CORRECTION = "data_correction",
  CONFIGURATION_CHANGE = "configuration_change",
  RETRY = "retry",
  ALTERNATIVE_METHOD = "alternative_method",
  CONTACT_SUPPORT = "contact_support",
  SYSTEM_ADJUSTMENT = "system_adjustment",
  DOCUMENTATION = "documentation",
}

export interface ErrorPattern {
  pattern: string;
  frequency: number;
  last_seen: Date;
  affected_users: number;
  common_causes: string[];
  suggested_fixes: RecoverySuggestion[];
}

export interface ErrorAnalytics {
  total_errors: number;
  errors_by_type: Record<ErrorType, number>;
  errors_by_severity: Record<ErrorSeverity, number>;
  error_trends: Array<{
    date: string;
    count: number;
  }>;
  top_errors: Array<{
    error_type: ErrorType;
    count: number;
    percentage: number;
  }>;
  resolution_rate: number;
  average_resolution_time: number;
}

export class ErrorReportingService {
  constructor(private databaseService: DatabaseService) {}

  /**
   * Report a new error
   */
  async reportError(
    errorData: Omit<ErrorReport, "id" | "created_at" | "updated_at" | "status">,
  ): Promise<{ success: boolean; errorId?: string; error?: string }> {
    try {
      // Analyze error and generate suggestions
      const suggestions = await this.generateRecoverySuggestions(errorData);

      // Detect patterns
      await this.detectErrorPatterns(errorData);

      const query = `
        INSERT INTO error_reports (
          job_id, user_id, error_type, severity, message, details, 
          context, recovery_suggestions, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `;

      const values = [
        errorData.job_id,
        errorData.user_id,
        errorData.error_type,
        errorData.severity,
        errorData.message,
        JSON.stringify(errorData.details),
        JSON.stringify(errorData.context),
        JSON.stringify(suggestions),
        ErrorStatus.OPEN,
      ];

      const result = await this.databaseService.query(query, values);
      const errorId = result.rows[0].id;

      // Send notifications for critical errors
      if (errorData.severity === ErrorSeverity.CRITICAL) {
        await this.sendCriticalErrorNotification(errorId, errorData);
      }

      logger.error(`Error reported: ${errorId} - ${errorData.message}`);
      return { success: true, errorId };
    } catch (error) {
      logger.error("Error reporting failed:", error);
      return { success: false, error: "Failed to report error" };
    }
  }

  /**
   * Get errors with filtering and pagination
   */
  async getErrors(
    userId?: string,
    filters: {
      error_type?: ErrorType;
      severity?: ErrorSeverity;
      status?: ErrorStatus;
      date_from?: Date;
      date_to?: Date;
      search?: string;
    } = {},
    pagination: {
      limit: number;
      offset: number;
    } = { limit: 50, offset: 0 },
  ): Promise<{ errors: ErrorReport[]; total: number }> {
    try {
      let query = `
        SELECT e.*, u.username as user_name
        FROM error_reports e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];
      let paramIndex = 1;

      // Add filters
      if (userId) {
        query += ` AND e.user_id = $${paramIndex}`;
        params.push(userId);
        paramIndex++;
      }

      if (filters.error_type) {
        query += ` AND e.error_type = $${paramIndex}`;
        params.push(filters.error_type);
        paramIndex++;
      }

      if (filters.severity) {
        query += ` AND e.severity = $${paramIndex}`;
        params.push(filters.severity);
        paramIndex++;
      }

      if (filters.status) {
        query += ` AND e.status = $${paramIndex}`;
        params.push(filters.status);
        paramIndex++;
      }

      if (filters.date_from) {
        query += ` AND e.created_at >= $${paramIndex}`;
        params.push(filters.date_from);
        paramIndex++;
      }

      if (filters.date_to) {
        query += ` AND e.created_at <= $${paramIndex}`;
        params.push(filters.date_to);
        paramIndex++;
      }

      if (filters.search) {
        query += ` AND (e.message ILIKE $${paramIndex} OR e.details::text ILIKE $${paramIndex})`;
        params.push(`%${filters.search}%`);
        paramIndex++;
      }

      // Count query
      const countQuery = query
        .replace(/SELECT.*?FROM/, "SELECT COUNT(*) FROM")
        .replace(/ORDER BY.*$/, "");
      const countResult = await this.databaseService.query(countQuery, params);
      const total = parseInt(countResult.rows[0].count);

      // Add ordering and pagination
      query += ` ORDER BY e.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(pagination.limit, pagination.offset);

      const result = await this.databaseService.query(query, params);

      return {
        errors: result.rows.map(this.mapRowToErrorReport),
        total,
      };
    } catch (error) {
      logger.error("Error fetching errors:", error);
      return { errors: [], total: 0 };
    }
  }

  /**
   * Get error by ID
   */
  async getErrorById(errorId: string): Promise<ErrorReport | null> {
    try {
      const query = `
        SELECT e.*, u.username as user_name
        FROM error_reports e
        LEFT JOIN users u ON e.user_id = u.id
        WHERE e.id = $1
      `;

      const result = await this.databaseService.query(query, [errorId]);
      return result.rows[0] ? this.mapRowToErrorReport(result.rows[0]) : null;
    } catch (error) {
      logger.error("Error fetching error by ID:", error);
      return null;
    }
  }

  /**
   * Update error status
   */
  async updateErrorStatus(
    errorId: string,
    status: ErrorStatus,
    resolvedBy?: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const query = `
        UPDATE error_reports 
        SET status = $1, resolved_at = CASE WHEN $1 = 'resolved' THEN CURRENT_TIMESTAMP ELSE resolved_at END,
            resolved_by = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
      `;

      await this.databaseService.query(query, [status, resolvedBy, errorId]);

      logger.info(`Error status updated: ${errorId} -> ${status}`);
      return { success: true };
    } catch (error) {
      logger.error("Error updating status:", error);
      return { success: false, error: "Failed to update error status" };
    }
  }

  /**
   * Get error analytics
   */
  async getErrorAnalytics(
    userId: string | undefined,
    dateRange: { from: Date; to: Date },
  ): Promise<ErrorAnalytics> {
    try {
      const baseQuery = userId
        ? `WHERE user_id = $1 AND created_at BETWEEN $2 AND $3`
        : `WHERE created_at BETWEEN $1 AND $2`;

      const params = userId
        ? [userId, dateRange.from, dateRange.to]
        : [dateRange.from, dateRange.to];

      // Total errors
      const totalQuery = `SELECT COUNT(*) as count FROM error_reports ${baseQuery}`;
      const totalResult = await this.databaseService.query(totalQuery, params);
      const totalErrors = parseInt(totalResult.rows[0].count);

      // Errors by type
      const typeQuery = `
        SELECT error_type, COUNT(*) as count 
        FROM error_reports ${baseQuery}
        GROUP BY error_type
      `;
      const typeResult = await this.databaseService.query(typeQuery, params);
      const errorsByType = typeResult.rows.reduce(
        (acc: Record<ErrorType, number>, row: any) => {
          acc[row.error_type as ErrorType] = parseInt(row.count);
          return acc;
        },
        {} as Record<ErrorType, number>,
      );

      // Errors by severity
      const severityQuery = `
        SELECT severity, COUNT(*) as count 
        FROM error_reports ${baseQuery}
        GROUP BY severity
      `;
      const severityResult = await this.databaseService.query(
        severityQuery,
        params,
      );
      const errorsBySeverity = severityResult.rows.reduce(
        (acc: Record<ErrorSeverity, number>, row: any) => {
          acc[row.severity as ErrorSeverity] = parseInt(row.count);
          return acc;
        },
        {} as Record<ErrorSeverity, number>,
      );

      // Error trends (daily)
      const trendsQuery = `
        SELECT DATE(created_at) as date, COUNT(*) as count
        FROM error_reports ${baseQuery}
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      const trendsResult = await this.databaseService.query(
        trendsQuery,
        params,
      );
      const errorTrends = trendsResult.rows.map((row: any) => ({
        date: row.date,
        count: parseInt(row.count),
      }));

      // Top errors
      const topErrorsQuery = `
        SELECT error_type, COUNT(*) as count,
               ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM error_reports ${baseQuery}), 2) as percentage
        FROM error_reports ${baseQuery}
        GROUP BY error_type
        ORDER BY count DESC
        LIMIT 10
      `;
      const topErrorsResult = await this.databaseService.query(
        topErrorsQuery,
        params,
      );
      const topErrors = topErrorsResult.rows.map((row: any) => ({
        error_type: row.error_type,
        count: parseInt(row.count),
        percentage: parseFloat(row.percentage),
      }));

      // Resolution metrics
      const resolutionQuery = `
        SELECT 
          COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
          AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60) as avg_resolution_time
        FROM error_reports ${baseQuery}
      `;
      const resolutionResult = await this.databaseService.query(
        resolutionQuery,
        params,
      );
      const resolvedCount = parseInt(resolutionResult.rows[0].resolved);
      const resolutionRate =
        totalErrors > 0 ? (resolvedCount / totalErrors) * 100 : 0;
      const averageResolutionTime =
        parseFloat(resolutionResult.rows[0].avg_resolution_time) || 0;

      return {
        total_errors: totalErrors,
        errors_by_type: errorsByType,
        errors_by_severity: errorsBySeverity,
        error_trends: errorTrends,
        top_errors: topErrors,
        resolution_rate: resolutionRate,
        average_resolution_time: averageResolutionTime,
      };
    } catch (error) {
      logger.error("Error generating analytics:", error);
      return {
        total_errors: 0,
        errors_by_type: {} as Record<ErrorType, number>,
        errors_by_severity: {} as Record<ErrorSeverity, number>,
        error_trends: [],
        top_errors: [],
        resolution_rate: 0,
        average_resolution_time: 0,
      };
    }
  }

  /**
   * Generate recovery suggestions based on error type and context
   */
  private async generateRecoverySuggestions(
    errorData: Omit<ErrorReport, "id" | "created_at" | "updated_at" | "status">,
  ): Promise<RecoverySuggestion[]> {
    const suggestions: RecoverySuggestion[] = [];

    switch (errorData.error_type) {
      case ErrorType.VALIDATION:
        suggestions.push({
          type: SuggestionType.DATA_CORRECTION,
          title: "Fix Data Validation Issues",
          description:
            "The data failed validation checks. Review and correct the data format.",
          steps: [
            "Check the data format matches expected schema",
            "Ensure required fields are not empty",
            "Validate data types and ranges",
            "Remove or correct invalid characters",
          ],
          automated_fix: false,
          confidence: 85,
          estimated_time: 5,
        });
        break;

      case ErrorType.TRANSFORMATION:
        suggestions.push({
          type: SuggestionType.CONFIGURATION_CHANGE,
          title: "Adjust Transformation Rules",
          description:
            "The data transformation failed. Review and update transformation rules.",
          steps: [
            "Check transformation logic for edge cases",
            "Add error handling for null/empty values",
            "Verify data type conversions",
            "Test transformation with sample data",
          ],
          automated_fix: false,
          confidence: 75,
          estimated_time: 10,
        });
        break;

      case ErrorType.API_CONNECTION:
        suggestions.push({
          type: SuggestionType.RETRY,
          title: "Retry API Connection",
          description:
            "The API connection failed. This may be a temporary issue.",
          steps: [
            "Wait a few minutes and retry",
            "Check API service status",
            "Verify network connectivity",
            "Review API authentication",
          ],
          automated_fix: true,
          confidence: 60,
          estimated_time: 2,
        });
        break;

      case ErrorType.DATA_FORMAT:
        suggestions.push({
          type: SuggestionType.DATA_CORRECTION,
          title: "Fix Data Format Issues",
          description:
            "The data format is not compatible. Convert to the expected format.",
          steps: [
            "Ensure CSV files use proper delimiters",
            "Check for special characters in headers",
            "Validate encoding format (UTF-8)",
            "Remove BOM markers if present",
          ],
          automated_fix: false,
          confidence: 90,
          estimated_time: 3,
        });
        break;

      case ErrorType.TIMEOUT:
        suggestions.push({
          type: SuggestionType.SYSTEM_ADJUSTMENT,
          title: "Adjust Timeout Settings",
          description:
            "The operation timed out. Increase timeout or optimize processing.",
          steps: [
            "Increase timeout duration",
            "Process data in smaller chunks",
            "Optimize transformation logic",
            "Check system resources",
          ],
          automated_fix: true,
          confidence: 70,
          estimated_time: 5,
        });
        break;

      default:
        suggestions.push({
          type: SuggestionType.CONTACT_SUPPORT,
          title: "Contact Support",
          description: "This error requires assistance from the support team.",
          steps: [
            "Document the error details",
            "Collect relevant logs and data",
            "Contact support with error ID",
            "Monitor for resolution updates",
          ],
          automated_fix: false,
          confidence: 95,
          estimated_time: 30,
        });
    }

    return suggestions;
  }

  /**
   * Detect error patterns for proactive monitoring
   */
  private async detectErrorPatterns(
    errorData: Omit<ErrorReport, "id" | "created_at" | "updated_at" | "status">,
  ): Promise<void> {
    try {
      // This would implement pattern detection logic
      // For now, just log the pattern detection
      logger.info(`Pattern detection for error type: ${errorData.error_type}`);
    } catch (error) {
      logger.error("Error pattern detection failed:", error);
    }
  }

  /**
   * Send notification for critical errors
   */
  private async sendCriticalErrorNotification(
    errorId: string,
    errorData: Omit<ErrorReport, "id" | "created_at" | "updated_at" | "status">,
  ): Promise<void> {
    try {
      // This would implement notification logic (email, Slack, etc.)
      logger.warn(
        `Critical error notification sent: ${errorId} - ${errorData.message}`,
      );
    } catch (error) {
      logger.error("Critical error notification failed:", error);
    }
  }

  /**
   * Map database row to ErrorReport object
   */
  private mapRowToErrorReport(row: any): ErrorReport {
    return {
      id: row.id,
      job_id: row.job_id,
      user_id: row.user_id,
      error_type: row.error_type,
      severity: row.severity,
      message: row.message,
      details: row.details,
      context: row.context,
      recovery_suggestions: row.recovery_suggestions,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      resolved_at: row.resolved_at,
      resolved_by: row.resolved_by,
    };
  }
}
