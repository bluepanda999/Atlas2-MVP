import { Request, Response } from "express";
import { AnalyticsService } from "../services/analytics.service";
import { DatabaseService } from "../services/database.service";
import { logger } from "../utils/logger";

export class AnalyticsController {
  private analyticsService: AnalyticsService;

  constructor(databaseService: DatabaseService) {
    this.analyticsService = new AnalyticsService(databaseService);
  }

  /**
   * Get analytics dashboard data
   */
  async getDashboardData(req: Request, res: Response) {
    try {
      const { timeRange = "24h", userId, jobType, errorCategory } = req.query;

      const filters = {
        userId: userId as string,
        jobType: jobType as string,
        errorCategory: errorCategory as string,
      };

      logger.info(`Fetching dashboard data for time range: ${timeRange}`, {
        filters,
      });

      const dashboardData = await this.analyticsService.getDashboardData(
        timeRange as string,
        filters,
      );

      res.json({
        success: true,
        data: dashboardData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get dashboard data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch dashboard data",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Export analytics data
   */
  async exportData(req: Request, res: Response) {
    try {
      const {
        format = "json",
        timeRange = "24h",
        userId,
        jobType,
        errorCategory,
      } = req.query;

      const filters = {
        userId: userId as string,
        jobType: jobType as string,
        errorCategory: errorCategory as string,
      };

      logger.info(`Exporting analytics data in format: ${format}`, { filters });

      // Get dashboard data first
      const dashboardData = await this.analyticsService.getDashboardData(
        timeRange as string,
        filters,
      );

      // Export the data
      const exportBuffer = await this.analyticsService.exportData(
        dashboardData,
        format as string,
        filters,
      );

      // Set appropriate headers
      const filename = `analytics-${new Date().toISOString().split("T")[0]}.${format}`;

      let contentType: string;
      switch ((format as string).toLowerCase()) {
        case "csv":
          contentType = "text/csv";
          break;
        case "json":
          contentType = "application/json";
          break;
        case "pdf":
          contentType = "application/pdf";
          break;
        default:
          contentType = "application/octet-stream";
      }

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${filename}"`,
      );
      res.send(exportBuffer);
    } catch (error) {
      logger.error("Failed to export analytics data:", error);
      res.status(500).json({
        success: false,
        error: "Failed to export analytics data",
        message: error.message,
      });
    }
  }

  /**
   * Get real-time metrics
   */
  async getRealTimeMetrics(req: Request, res: Response) {
    try {
      const { metrics = "all" } = req.query;

      logger.info(`Fetching real-time metrics: ${metrics}`);

      // Get recent data for real-time view
      const dashboardData = await this.analyticsService.getDashboardData("1h");

      // Filter based on requested metrics
      let responseData: any = {};

      if (metrics === "all") {
        responseData = dashboardData;
      } else {
        const requestedMetrics = (metrics as string).split(",");
        requestedMetrics.forEach((metric) => {
          if (dashboardData[metric]) {
            responseData[metric] = dashboardData[metric];
          }
        });
      }

      res.json({
        success: true,
        data: responseData,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get real-time metrics:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch real-time metrics",
        message: error.message,
      });
    }
  }

  /**
   * Get insights and recommendations
   */
  async getInsights(req: Request, res: Response) {
    try {
      const { timeRange = "24h", severity = "all" } = req.query;

      logger.info(
        `Fetching insights for time range: ${timeRange}, severity: ${severity}`,
      );

      const dashboardData = await this.analyticsService.getDashboardData(
        timeRange as string,
      );

      let insights = dashboardData.insights;

      // Filter by severity if specified
      if (severity !== "all") {
        insights = insights.filter((insight) => insight.severity === severity);
      }

      res.json({
        success: true,
        data: {
          insights,
          total: insights.length,
          critical: insights.filter((i) => i.severity === "critical").length,
          warning: insights.filter((i) => i.severity === "warning").length,
          info: insights.filter((i) => i.severity === "info").length,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get insights:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch insights",
        message: error.message,
      });
    }
  }

  /**
   * Get performance trends
   */
  async getPerformanceTrends(req: Request, res: Response) {
    try {
      const { timeRange = "7d", metric = "all" } = req.query;

      logger.info(
        `Fetching performance trends for time range: ${timeRange}, metric: ${metric}`,
      );

      const dashboardData = await this.analyticsService.getDashboardData(
        timeRange as string,
      );

      let trends: any = {};

      switch (metric) {
        case "system":
          trends = {
            cpu: dashboardData.systemMetrics.cpu,
            memory: dashboardData.systemMetrics.memory,
            disk: dashboardData.systemMetrics.disk,
            network: dashboardData.systemMetrics.network,
          };
          break;
        case "jobs":
          trends = {
            throughput: dashboardData.jobMetrics.throughput,
            successRate: dashboardData.jobMetrics.successRate,
            averageDuration: dashboardData.jobMetrics.averageDuration,
            jobTypes: dashboardData.jobMetrics.jobTypes,
            trends: dashboardData.jobMetrics.trends,
          };
          break;
        case "errors":
          trends = {
            errorRate: dashboardData.errorMetrics.errorRate,
            errorCategories: dashboardData.errorMetrics.errorCategories,
            topErrors: dashboardData.errorMetrics.topErrors,
            trends: dashboardData.errorMetrics.trends,
          };
          break;
        case "queues":
          trends = {
            queueDepth: dashboardData.queueMetrics.queueDepth,
            waitTime: dashboardData.queueMetrics.waitTime,
            processingTime: dashboardData.queueMetrics.processingTime,
            queueUtilization: dashboardData.queueMetrics.queueUtilization,
            bottlenecks: dashboardData.queueMetrics.bottlenecks,
          };
          break;
        case "users":
          trends = {
            activeUsers: dashboardData.userMetrics.activeUsers,
            userActivity: dashboardData.userMetrics.userActivity,
            featureUsage: dashboardData.userMetrics.featureUsage,
            userSatisfaction: dashboardData.userMetrics.userSatisfaction,
          };
          break;
        default:
          trends = dashboardData;
      }

      res.json({
        success: true,
        data: {
          timeRange: dashboardData.timeRange,
          trends,
          lastUpdated: dashboardData.lastUpdated,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get performance trends:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch performance trends",
        message: error.message,
      });
    }
  }

  /**
   * Get system health status
   */
  async getSystemHealth(req: Request, res: Response) {
    try {
      logger.info("Fetching system health status");

      const dashboardData = await this.analyticsService.getDashboardData("1h");

      // Calculate health score based on various metrics
      let healthScore = 100;
      const issues: string[] = [];

      // CPU health
      if (dashboardData.systemMetrics.cpu.current > 90) {
        healthScore -= 20;
        issues.push("Critical CPU usage");
      } else if (dashboardData.systemMetrics.cpu.current > 80) {
        healthScore -= 10;
        issues.push("High CPU usage");
      }

      // Memory health
      if (dashboardData.systemMetrics.memory.current > 90) {
        healthScore -= 20;
        issues.push("Critical memory usage");
      } else if (dashboardData.systemMetrics.memory.current > 85) {
        healthScore -= 10;
        issues.push("High memory usage");
      }

      // Job success rate
      if (dashboardData.jobMetrics.successRate.percentage < 90) {
        healthScore -= 15;
        issues.push("Low job success rate");
      } else if (dashboardData.jobMetrics.successRate.percentage < 95) {
        healthScore -= 5;
        issues.push("Moderate job success rate");
      }

      // Error rate
      if (dashboardData.errorMetrics.errorRate.percentage > 10) {
        healthScore -= 20;
        issues.push("High error rate");
      } else if (dashboardData.errorMetrics.errorRate.percentage > 5) {
        healthScore -= 10;
        issues.push("Moderate error rate");
      }

      // Queue utilization
      if (dashboardData.queueMetrics.queueUtilization > 95) {
        healthScore -= 15;
        issues.push("Critical queue utilization");
      } else if (dashboardData.queueMetrics.queueUtilization > 90) {
        healthScore -= 5;
        issues.push("High queue utilization");
      }

      // Determine health status
      let status: "healthy" | "warning" | "critical";
      if (healthScore >= 90) {
        status = "healthy";
      } else if (healthScore >= 70) {
        status = "warning";
      } else {
        status = "critical";
      }

      res.json({
        success: true,
        data: {
          status,
          healthScore: Math.max(0, healthScore),
          issues,
          metrics: {
            cpu: dashboardData.systemMetrics.cpu.current,
            memory: dashboardData.systemMetrics.memory.current,
            jobSuccessRate: dashboardData.jobMetrics.successRate.percentage,
            errorRate: dashboardData.errorMetrics.errorRate.percentage,
            queueUtilization: dashboardData.queueMetrics.queueUtilization,
          },
          lastUpdated: dashboardData.lastUpdated,
        },
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get system health:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch system health",
        message: error.message,
      });
    }
  }

  /**
   * Get analytics configuration
   */
  async getConfiguration(req: Request, res: Response) {
    try {
      logger.info("Fetching analytics configuration");

      const config = {
        timeRanges: [
          { value: "1h", label: "Last Hour" },
          { value: "6h", label: "Last 6 Hours" },
          { value: "24h", label: "Last 24 Hours" },
          { value: "7d", label: "Last 7 Days" },
          { value: "30d", label: "Last 30 Days" },
        ],
        exportFormats: [
          { value: "csv", label: "CSV" },
          { value: "json", label: "JSON" },
          { value: "pdf", label: "PDF" },
        ],
        metrics: [
          { value: "system", label: "System Metrics" },
          { value: "jobs", label: "Job Metrics" },
          { value: "errors", label: "Error Metrics" },
          { value: "queues", label: "Queue Metrics" },
          { value: "users", label: "User Metrics" },
        ],
        severityLevels: [
          { value: "all", label: "All" },
          { value: "critical", label: "Critical" },
          { value: "warning", label: "Warning" },
          { value: "info", label: "Info" },
        ],
        refreshIntervals: [
          { value: 5000, label: "5 seconds" },
          { value: 10000, label: "10 seconds" },
          { value: 30000, label: "30 seconds" },
          { value: 60000, label: "1 minute" },
        ],
      };

      res.json({
        success: true,
        data: config,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error("Failed to get analytics configuration:", error);
      res.status(500).json({
        success: false,
        error: "Failed to fetch analytics configuration",
        message: error.message,
      });
    }
  }
}
