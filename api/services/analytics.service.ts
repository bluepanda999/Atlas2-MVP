import { logger } from "../utils/logger";
import { DatabaseService } from "./database.service";

export interface DashboardData {
  timeRange: {
    startTime: Date;
    endTime: Date;
  };
  systemMetrics: SystemMetrics;
  jobMetrics: JobMetrics;
  errorMetrics: ErrorMetrics;
  queueMetrics: QueueMetrics;
  userMetrics: UserMetrics;
  insights: Insight[];
  lastUpdated: Date;
}

export interface SystemMetrics {
  cpu: MetricData;
  memory: MetricData;
  disk: MetricData;
  network: MetricData;
  uptime: number;
}

export interface JobMetrics {
  throughput: ThroughputData;
  successRate: SuccessRateData;
  averageDuration: DurationData;
  jobTypes: JobTypeBreakdown[];
  trends: Record<string, JobTrendData>;
}

export interface ErrorMetrics {
  errorRate: ErrorRateData;
  errorCategories: ErrorCategoryBreakdown[];
  topErrors: TopError[];
  resolutionTime: DurationData;
  trends: ErrorTrendData;
}

export interface QueueMetrics {
  queueDepth: number[];
  waitTime: number[];
  processingTime: number[];
  queueUtilization: number;
  bottlenecks: Bottleneck[];
}

export interface UserMetrics {
  activeUsers: number;
  userActivity: UserActivityData;
  featureUsage: FeatureUsageData;
  userSatisfaction: SatisfactionData;
}

export interface MetricData {
  current: number;
  average: number;
  min: number;
  max: number;
  trend: "increasing" | "decreasing" | "stable";
}

export interface ThroughputData {
  jobsPerMinute: number;
  jobsPerHour: number;
  daily: number;
}

export interface SuccessRateData {
  percentage: number;
  successful: number;
  failed: number;
  total: number;
}

export interface DurationData {
  average: number;
  median: number;
  min: number;
  max: number;
}

export interface JobTypeBreakdown {
  type: string;
  count: number;
  percentage: number;
}

export interface JobTrendData {
  completed: number;
  failed: number;
  total: number;
  successRate: number;
}

export interface ErrorRateData {
  percentage: number;
  errors: number;
  total: number;
  trend: string;
}

export interface ErrorCategoryBreakdown {
  category: string;
  count: number;
  percentage: number;
}

export interface TopError {
  errorType: string;
  count: number;
}

export interface ErrorTrendData {
  hourly: number[];
  daily: number[];
  categories: Record<string, number[]>;
}

export interface Bottleneck {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  recommendation: string;
}

export interface UserActivityData {
  dailyActiveUsers: number;
  weeklyActiveUsers: number;
  monthlyActiveUsers: number;
  averageSessionDuration: number;
}

export interface FeatureUsageData {
  features: Record<
    string,
    {
      usage: number;
      users: number;
      growth: number;
    }
  >;
}

export interface SatisfactionData {
  averageRating: number;
  totalRatings: number;
  distribution: Record<string, number>;
}

export interface Insight {
  type: "performance" | "error" | "optimization" | "trend";
  severity: "info" | "warning" | "critical";
  title: string;
  description: string;
  recommendations?: string[];
  impact?: string;
  timestamp: Date;
}

export interface AnalyticsFilters {
  userId?: string;
  jobType?: string;
  errorCategory?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export class AnalyticsService {
  constructor(private databaseService: DatabaseService) {}

  async getDashboardData(
    timeRange: string,
    filters: AnalyticsFilters = {},
  ): Promise<DashboardData> {
    try {
      const endTime = new Date();
      const startTime = new Date(
        endTime.getTime() - this.parseTimeRange(timeRange),
      );

      logger.info(`Fetching dashboard data for range: ${timeRange}`, {
        startTime,
        endTime,
        filters,
      });

      const [
        systemMetrics,
        jobMetrics,
        errorMetrics,
        queueMetrics,
        userMetrics,
      ] = await Promise.all([
        this.getSystemMetrics(startTime, endTime, filters),
        this.getJobMetrics(startTime, endTime, filters),
        this.getErrorMetrics(startTime, endTime, filters),
        this.getQueueMetrics(startTime, endTime, filters),
        this.getUserMetrics(startTime, endTime, filters),
      ]);

      const insights = await this.generateInsights({
        systemMetrics,
        jobMetrics,
        errorMetrics,
        queueMetrics,
        userMetrics,
      });

      return {
        timeRange: { startTime, endTime },
        systemMetrics,
        jobMetrics,
        errorMetrics,
        queueMetrics,
        userMetrics,
        insights,
        lastUpdated: new Date(),
      };
    } catch (error) {
      logger.error("Failed to get dashboard data:", error);
      throw new Error(
        `Analytics dashboard data fetch failed: ${error.message}`,
      );
    }
  }

  async getSystemMetrics(
    startTime: Date,
    endTime: Date,
    filters: AnalyticsFilters,
  ): Promise<SystemMetrics> {
    try {
      // Query system metrics from time-series data or monitoring tables
      const metricsQuery = `
        SELECT 
          AVG(cpu_usage) as avg_cpu,
          MAX(cpu_usage) as max_cpu,
          MIN(cpu_usage) as min_cpu,
          AVG(memory_usage) as avg_memory,
          MAX(memory_usage) as max_memory,
          MIN(memory_usage) as min_memory,
          AVG(disk_usage) as avg_disk,
          MAX(disk_usage) as max_disk,
          MIN(disk_usage) as min_disk,
          AVG(network_io) as avg_network,
          MAX(network_io) as max_network,
          MIN(network_io) as min_network
        FROM system_metrics 
        WHERE timestamp >= $1 AND timestamp <= $2
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const result = await this.databaseService.query(metricsQuery, [
        startTime,
        endTime,
      ]);
      const metrics = result.rows[0] || {};

      // Get current values
      const currentQuery = `
        SELECT cpu_usage, memory_usage, disk_usage, network_io, uptime
        FROM system_metrics 
        ORDER BY timestamp DESC 
        LIMIT 1
      `;

      const currentResult = await this.databaseService.query(currentQuery);
      const current = currentResult.rows[0] || {};

      return {
        cpu: this.aggregateMetric(
          metrics.avg_cpu,
          metrics.max_cpu,
          metrics.min_cpu,
          current.cpu_usage,
        ),
        memory: this.aggregateMetric(
          metrics.avg_memory,
          metrics.max_memory,
          metrics.min_memory,
          current.memory_usage,
        ),
        disk: this.aggregateMetric(
          metrics.avg_disk,
          metrics.max_disk,
          metrics.min_disk,
          current.disk_usage,
        ),
        network: this.aggregateMetric(
          metrics.avg_network,
          metrics.max_network,
          metrics.min_network,
          current.network_usage,
        ),
        uptime: current.uptime || 0,
      };
    } catch (error) {
      logger.error("Failed to get system metrics:", error);
      return this.getDefaultSystemMetrics();
    }
  }

  async getJobMetrics(
    startTime: Date,
    endTime: Date,
    filters: AnalyticsFilters,
  ): Promise<JobMetrics> {
    try {
      const baseQuery = `
        SELECT 
          status,
          job_type,
          duration,
          created_at,
          completed_at
        FROM processing_jobs 
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const queryParams = [startTime.toISOString(), endTime.toISOString()];
      let queryIndex = 3;

      if (filters.jobType) {
        queryIndex++;
        queryParams.push(filters.jobType);
      }

      const result = await this.databaseService.query(baseQuery, queryParams);
      const jobs = result.rows;

      const completedJobs = jobs.filter((job) => job.status === "completed");
      const failedJobs = jobs.filter((job) => job.status === "failed");

      return {
        throughput: this.calculateThroughput(jobs, startTime, endTime),
        successRate: this.calculateSuccessRate(jobs),
        averageDuration: this.calculateAverageDuration(completedJobs),
        jobTypes: this.getJobTypeBreakdown(jobs),
        trends: this.calculateJobTrends(jobs),
      };
    } catch (error) {
      logger.error("Failed to get job metrics:", error);
      return this.getDefaultJobMetrics();
    }
  }

  async getErrorMetrics(
    startTime: Date,
    endTime: Date,
    filters: AnalyticsFilters,
  ): Promise<ErrorMetrics> {
    try {
      const errorQuery = `
        SELECT 
          error_type,
          error_category,
          error_message,
          created_at,
          resolved_at,
          severity
        FROM error_reports 
        WHERE created_at >= $1 AND created_at <= $2
      `;

      const queryParams = [startTime.toISOString(), endTime.toISOString()];
      let queryIndex = 3;

      if (filters.errorCategory) {
        queryIndex++;
        queryParams.push(filters.errorCategory);
      }

      const result = await this.databaseService.query(errorQuery, queryParams);
      const errors = result.rows;

      return {
        errorRate: this.calculateErrorRate(errors),
        errorCategories: this.getErrorCategoryBreakdown(errors),
        topErrors: this.getTopErrors(errors),
        resolutionTime: this.calculateAverageResolutionTime(errors),
        trends: this.calculateErrorTrends(errors),
      };
    } catch (error) {
      logger.error("Failed to get error metrics:", error);
      return this.getDefaultErrorMetrics();
    }
  }

  async getQueueMetrics(
    startTime: Date,
    endTime: Date,
    filters: AnalyticsFilters,
  ): Promise<QueueMetrics> {
    try {
      const queueQuery = `
        SELECT 
          queue_depth,
          average_wait_time,
          average_processing_time,
          queue_utilization,
          timestamp
        FROM queue_metrics 
        WHERE timestamp >= $1 AND timestamp <= $2
        ORDER BY timestamp DESC
        LIMIT 100
      `;

      const result = await this.databaseService.query(queueQuery, [
        startTime,
        endTime,
      ]);
      const metrics = result.rows;

      return {
        queueDepth: metrics.map((m) => m.queue_depth || 0),
        waitTime: metrics.map((m) => m.average_wait_time || 0),
        processingTime: metrics.map((m) => m.average_processing_time || 0),
        queueUtilization:
          metrics.length > 0
            ? metrics[metrics.length - 1].queue_utilization || 0
            : 0,
        bottlenecks: this.identifyBottlenecks(metrics),
      };
    } catch (error) {
      logger.error("Failed to get queue metrics:", error);
      return this.getDefaultQueueMetrics();
    }
  }

  async getUserMetrics(
    startTime: Date,
    endTime: Date,
    filters: AnalyticsFilters,
  ): Promise<UserMetrics> {
    try {
      const userQuery = `
        SELECT 
          user_id,
          last_active,
          session_duration,
          feature_usage,
          rating
        FROM user_activity 
        WHERE last_active >= $1 AND last_active <= $2
      `;

      const queryParams = [startTime.toISOString(), endTime.toISOString()];
      let queryIndex = 3;

      if (filters.userId) {
        queryIndex++;
        queryParams.push(filters.userId);
      }

      const result = await this.databaseService.query(userQuery, queryParams);
      const activities = result.rows;

      return {
        activeUsers: this.getActiveUsers(activities),
        userActivity: this.getUserActivity(activities),
        featureUsage: this.getFeatureUsage(activities),
        userSatisfaction: this.getUserSatisfaction(activities),
      };
    } catch (error) {
      logger.error("Failed to get user metrics:", error);
      return this.getDefaultUserMetrics();
    }
  }

  async generateInsights(metrics: {
    systemMetrics: SystemMetrics;
    jobMetrics: JobMetrics;
    errorMetrics: ErrorMetrics;
    queueMetrics: QueueMetrics;
    userMetrics: UserMetrics;
  }): Promise<Insight[]> {
    const insights: Insight[] = [];

    try {
      // Performance insights
      if (metrics.systemMetrics.cpu.current > 80) {
        insights.push({
          type: "performance",
          severity: "warning",
          title: "High CPU Usage Detected",
          description: `CPU usage is currently at ${metrics.systemMetrics.cpu.current.toFixed(1)}%`,
          recommendations: [
            "Check for resource-intensive processes",
            "Consider scaling up resources",
            "Review recent job processing patterns",
          ],
          impact: "May affect job processing performance",
          timestamp: new Date(),
        });
      }

      if (metrics.systemMetrics.memory.current > 85) {
        insights.push({
          type: "performance",
          severity: "critical",
          title: "Critical Memory Usage",
          description: `Memory usage is at ${metrics.systemMetrics.memory.current.toFixed(1)}%`,
          recommendations: [
            "Immediate investigation required",
            "Check for memory leaks",
            "Consider restarting services",
          ],
          impact: "System stability at risk",
          timestamp: new Date(),
        });
      }

      // Job processing insights
      if (metrics.jobMetrics.successRate.percentage < 95) {
        insights.push({
          type: "error",
          severity: "warning",
          title: "Low Job Success Rate",
          description: `Job success rate is ${metrics.jobMetrics.successRate.percentage.toFixed(1)}%`,
          recommendations: [
            "Review failed job patterns",
            "Check error logs for common issues",
            "Validate input data quality",
          ],
          impact: "Reduced processing efficiency",
          timestamp: new Date(),
        });
      }

      if (metrics.jobMetrics.averageDuration.average > 300) {
        // 5 minutes
        insights.push({
          type: "optimization",
          severity: "info",
          title: "Slow Job Processing",
          description: `Average job duration is ${metrics.jobMetrics.averageDuration.average.toFixed(1)} seconds`,
          recommendations: [
            "Optimize job processing logic",
            "Consider parallel processing",
            "Review resource allocation",
          ],
          impact: "Opportunity for performance improvement",
          timestamp: new Date(),
        });
      }

      // Error insights
      if (metrics.errorMetrics.errorRate.percentage > 5) {
        insights.push({
          type: "error",
          severity: "critical",
          title: "High Error Rate",
          description: `Error rate is ${metrics.errorMetrics.errorRate.percentage.toFixed(1)}%`,
          recommendations: [
            "Immediate investigation required",
            "Review recent system changes",
            "Check external service dependencies",
          ],
          impact: "System reliability compromised",
          timestamp: new Date(),
        });
      }

      // Queue insights
      if (metrics.queueMetrics.queueUtilization > 90) {
        insights.push({
          type: "performance",
          severity: "warning",
          title: "Queue Near Capacity",
          description: `Queue utilization is ${metrics.queueMetrics.queueUtilization.toFixed(1)}%`,
          recommendations: [
            "Monitor queue depth closely",
            "Consider scaling workers",
            "Review job prioritization",
          ],
          impact: "Risk of job delays",
          timestamp: new Date(),
        });
      }

      // User insights
      if (metrics.userMetrics.userSatisfaction.averageRating < 3.5) {
        insights.push({
          type: "trend",
          severity: "warning",
          title: "Low User Satisfaction",
          description: `Average user rating is ${metrics.userMetrics.userSatisfaction.averageRating.toFixed(1)}/5`,
          recommendations: [
            "Review user feedback",
            "Identify pain points",
            "Consider user experience improvements",
          ],
          impact: "User retention at risk",
          timestamp: new Date(),
        });
      }

      return insights;
    } catch (error) {
      logger.error("Failed to generate insights:", error);
      return [];
    }
  }

  async exportData(
    data: DashboardData,
    format: string,
    filters: AnalyticsFilters = {},
  ): Promise<Buffer> {
    try {
      switch (format.toLowerCase()) {
        case "csv":
          return this.generateCSV(data, filters);
        case "json":
          return this.generateJSON(data, filters);
        case "pdf":
          return this.generatePDF(data, filters);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      logger.error("Failed to export data:", error);
      throw new Error(`Export failed: ${error.message}`);
    }
  }

  private aggregateMetric(
    avg: any,
    max: any,
    min: any,
    current: number,
  ): MetricData {
    return {
      current: current || 0,
      average: parseFloat(avg) || 0,
      min: parseFloat(min) || 0,
      max: parseFloat(max) || 0,
      trend: this.calculateTrend([current, parseFloat(avg) || 0]),
    };
  }

  private calculateThroughput(
    jobs: any[],
    startTime: Date,
    endTime: Date,
  ): ThroughputData {
    const completedJobs = jobs.filter((job) => job.status === "completed");
    const timeSpanHours =
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);

    return {
      jobsPerMinute:
        timeSpanHours > 0 ? completedJobs.length / (timeSpanHours * 60) : 0,
      jobsPerHour: timeSpanHours > 0 ? completedJobs.length / timeSpanHours : 0,
      daily:
        timeSpanHours > 0 ? (completedJobs.length / timeSpanHours) * 24 : 0,
    };
  }

  private calculateSuccessRate(jobs: any[]): SuccessRateData {
    const totalJobs = jobs.length;
    const successfulJobs = jobs.filter(
      (job) => job.status === "completed",
    ).length;

    return {
      percentage: totalJobs > 0 ? (successfulJobs / totalJobs) * 100 : 100,
      successful: successfulJobs,
      failed: totalJobs - successfulJobs,
      total: totalJobs,
    };
  }

  private calculateAverageDuration(completedJobs: any[]): DurationData {
    const durations = completedJobs
      .filter((job) => job.duration)
      .map((job) => job.duration);

    if (durations.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];

    return {
      average: durations.reduce((sum, d) => sum + d, 0) / durations.length,
      median,
      min: Math.min(...durations),
      max: Math.max(...durations),
    };
  }

  private getJobTypeBreakdown(jobs: any[]): JobTypeBreakdown[] {
    const typeCounts: Record<string, number> = {};

    jobs.forEach((job) => {
      if (job.job_type) {
        typeCounts[job.job_type] = (typeCounts[job.job_type] || 0) + 1;
      }
    });

    const total = Object.values(typeCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Object.entries(typeCounts)
      .map(([type, count]) => ({
        type,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private calculateJobTrends(jobs: any[]): Record<string, JobTrendData> {
    const timeWindows = this.groupByTimeWindow(jobs, "1h");
    const trends: Record<string, JobTrendData> = {};

    Object.entries(timeWindows).forEach(([timeWindow, windowJobs]) => {
      const completed = windowJobs.filter(
        (job) => job.status === "completed",
      ).length;
      const failed = windowJobs.filter((job) => job.status === "failed").length;

      trends[timeWindow] = {
        completed,
        failed,
        total: windowJobs.length,
        successRate:
          windowJobs.length > 0 ? (completed / windowJobs.length) * 100 : 100,
      };
    });

    return trends;
  }

  private calculateErrorRate(errors: any[]): ErrorRateData {
    const totalOperations = 1000; // This would come from actual operation count
    const errorCount = errors.length;

    return {
      percentage:
        totalOperations > 0 ? (errorCount / totalOperations) * 100 : 0,
      errors: errorCount,
      total: totalOperations,
      trend:
        this.calculateErrorTrends(errors).hourly.length > 0
          ? "increasing"
          : "stable",
    };
  }

  private getErrorCategoryBreakdown(errors: any[]): ErrorCategoryBreakdown[] {
    const categoryCounts: Record<string, number> = {};

    errors.forEach((error) => {
      if (error.error_category) {
        categoryCounts[error.error_category] =
          (categoryCounts[error.error_category] || 0) + 1;
      }
    });

    const total = Object.values(categoryCounts).reduce(
      (sum, count) => sum + count,
      0,
    );

    return Object.entries(categoryCounts)
      .map(([category, count]) => ({
        category,
        count,
        percentage: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);
  }

  private getTopErrors(errors: any[]): TopError[] {
    const errorCounts: Record<string, number> = {};

    errors.forEach((error) => {
      const key = `${error.error_category}:${error.error_type}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([errorType, count]) => ({
        errorType,
        count,
      }));
  }

  private calculateAverageResolutionTime(errors: any[]): DurationData {
    const resolvedErrors = errors.filter((error) => error.resolved_at);
    const resolutionTimes = resolvedErrors.map((error) => {
      const created = new Date(error.created_at);
      const resolved = new Date(error.resolved_at);
      return (resolved.getTime() - created.getTime()) / 1000; // seconds
    });

    if (resolutionTimes.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    resolutionTimes.sort((a, b) => a - b);
    const median = resolutionTimes[Math.floor(resolutionTimes.length / 2)];

    return {
      average:
        resolutionTimes.reduce((sum, time) => sum + time, 0) /
        resolutionTimes.length,
      median,
      min: Math.min(...resolutionTimes),
      max: Math.max(...resolutionTimes),
    };
  }

  private calculateErrorTrends(errors: any[]): ErrorTrendData {
    const hourly = this.groupErrorsByHour(errors);
    const daily = this.groupErrorsByDay(errors);
    const categories = this.groupErrorsByCategory(errors);

    return {
      hourly,
      daily,
      categories,
    };
  }

  private identifyBottlenecks(metrics: any[]): Bottleneck[] {
    const bottlenecks: Bottleneck[] = [];

    if (metrics.length > 0) {
      const avgQueueDepth =
        metrics.reduce((sum, m) => sum + (m.queue_depth || 0), 0) /
        metrics.length;
      const avgWaitTime =
        metrics.reduce((sum, m) => sum + (m.average_wait_time || 0), 0) /
        metrics.length;

      if (avgQueueDepth > 100) {
        bottlenecks.push({
          type: "queue_depth",
          severity: "high",
          description: `Average queue depth is ${avgQueueDepth.toFixed(1)}`,
          recommendation:
            "Consider adding more workers or optimizing job processing",
        });
      }

      if (avgWaitTime > 60) {
        bottlenecks.push({
          type: "wait_time",
          severity: "medium",
          description: `Average wait time is ${avgWaitTime.toFixed(1)} seconds`,
          recommendation: "Review job prioritization and resource allocation",
        });
      }
    }

    return bottlenecks;
  }

  private getActiveUsers(activities: any[]): number {
    const uniqueUsers = new Set(activities.map((activity) => activity.user_id));
    return uniqueUsers.size;
  }

  private getUserActivity(activities: any[]): UserActivityData {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const dailyUsers = new Set(
      activities
        .filter((a) => new Date(a.last_active) >= oneDayAgo)
        .map((a) => a.user_id),
    );
    const weeklyUsers = new Set(
      activities
        .filter((a) => new Date(a.last_active) >= oneWeekAgo)
        .map((a) => a.user_id),
    );
    const monthlyUsers = new Set(
      activities
        .filter((a) => new Date(a.last_active) >= oneMonthAgo)
        .map((a) => a.user_id),
    );

    const avgSessionDuration =
      activities.length > 0
        ? activities.reduce((sum, a) => sum + (a.session_duration || 0), 0) /
          activities.length
        : 0;

    return {
      dailyActiveUsers: dailyUsers.size,
      weeklyActiveUsers: weeklyUsers.size,
      monthlyActiveUsers: monthlyUsers.size,
      averageSessionDuration: avgSessionDuration,
    };
  }

  private getFeatureUsage(activities: any[]): FeatureUsageData {
    const features: Record<string, { usage: number; users: Set<string> }> = {};

    activities.forEach((activity) => {
      if (activity.feature_usage) {
        Object.entries(activity.feature_usage).forEach(([feature, count]) => {
          if (!features[feature]) {
            features[feature] = { usage: 0, users: new Set() };
          }
          features[feature].usage += count as number;
          features[feature].users.add(activity.user_id);
        });
      }
    });

    const result: Record<
      string,
      { usage: number; users: number; growth: number }
    > = {};
    Object.entries(features).forEach(([feature, data]) => {
      result[feature] = {
        usage: data.usage,
        users: data.users.size,
        growth: Math.random() * 20 - 10, // Placeholder growth calculation
      };
    });

    return { features: result };
  }

  private getUserSatisfaction(activities: any[]): SatisfactionData {
    const ratings = activities
      .filter((activity) => activity.rating)
      .map((activity) => activity.rating);

    if (ratings.length === 0) {
      return { averageRating: 0, totalRatings: 0, distribution: {} };
    }

    const averageRating =
      ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
    const distribution: Record<string, number> = {};

    ratings.forEach((rating) => {
      const key = rating.toString();
      distribution[key] = (distribution[key] || 0) + 1;
    });

    return {
      averageRating,
      totalRatings: ratings.length,
      distribution,
    };
  }

  private calculateTrend(
    values: number[],
  ): "increasing" | "decreasing" | "stable" {
    if (values.length < 2) return "stable";

    const recent = values.slice(-Math.min(10, values.length));
    const older = values.slice(
      -Math.min(20, values.length),
      -Math.min(10, values.length),
    );

    if (older.length === 0) return "stable";

    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (change > 5) return "increasing";
    if (change < -5) return "decreasing";
    return "stable";
  }

  private groupByTimeWindow(
    items: any[],
    windowSize: string,
  ): Record<string, any[]> {
    const windows: Record<string, any[]> = {};

    items.forEach((item) => {
      const dateValue = item.created_at || item.timestamp;
      if (!dateValue) return; // Skip items with invalid dates

      const windowStart = this.getTimeWindow(new Date(dateValue), windowSize);
      const key = windowStart.toISOString();

      if (!windows[key]) {
        windows[key] = [];
      }

      windows[key].push(item);
    });

    return windows;
  }

  private getTimeWindow(timestamp: Date, windowSize: string): Date {
    const date = new Date(timestamp);

    switch (windowSize) {
      case "1h":
        date.setMinutes(0, 0, 0);
        break;
      case "1d":
        date.setHours(0, 0, 0, 0);
        break;
      default:
        return date;
    }

    return date;
  }

  private groupErrorsByHour(errors: any[]): number[] {
    const hourlyCounts: Record<string, number> = {};

    errors.forEach((error) => {
      const hour = new Date(error.created_at).getHours();
      hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
    });

    return Array.from({ length: 24 }, (_, i) => hourlyCounts[i] || 0);
  }

  private groupErrorsByDay(errors: any[]): number[] {
    const dailyCounts: Record<string, number> = {};

    errors.forEach((error) => {
      const day = new Date(error.created_at).toISOString().split("T")[0];
      dailyCounts[day] = (dailyCounts[day] || 0) + 1;
    });

    return Object.values(dailyCounts);
  }

  private groupErrorsByCategory(errors: any[]): Record<string, number[]> {
    const categories: Record<string, number[]> = {};

    errors.forEach((error) => {
      if (!categories[error.error_category]) {
        categories[error.error_category] = [];
      }
      categories[error.error_category].push(1);
    });

    return categories;
  }

  private parseTimeRange(timeRange: string): number {
    const ranges: Record<string, number> = {
      "1h": 60 * 60 * 1000,
      "6h": 6 * 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    return ranges[timeRange] || ranges["24h"];
  }

  private generateCSV(data: DashboardData, filters: AnalyticsFilters): Buffer {
    const csvRows = [];

    // Header
    csvRows.push("Metric,Current Value,Average,Min,Max,Trend");

    // System metrics
    csvRows.push(
      `CPU Usage,${data.systemMetrics.cpu.current},${data.systemMetrics.cpu.average},${data.systemMetrics.cpu.min},${data.systemMetrics.cpu.max},${data.systemMetrics.cpu.trend}`,
    );
    csvRows.push(
      `Memory Usage,${data.systemMetrics.memory.current},${data.systemMetrics.memory.average},${data.systemMetrics.memory.min},${data.systemMetrics.memory.max},${data.systemMetrics.memory.trend}`,
    );

    // Job metrics
    csvRows.push(
      `Job Success Rate,${data.jobMetrics.successRate.percentage}%,${data.jobMetrics.successRate.successful},${data.jobMetrics.successRate.failed},${data.jobMetrics.successRate.total},N/A`,
    );
    csvRows.push(
      `Average Job Duration,${data.jobMetrics.averageDuration.average}s,${data.jobMetrics.averageDuration.median}s,${data.jobMetrics.averageDuration.min}s,${data.jobMetrics.averageDuration.max}s,N/A`,
    );

    // Error metrics
    csvRows.push(
      `Error Rate,${data.errorMetrics.errorRate.percentage}%,${data.errorMetrics.errorRate.errors},${data.errorMetrics.errorRate.total},N/A,${data.errorMetrics.errorRate.trend}`,
    );

    return Buffer.from(csvRows.join("\n"), "utf-8");
  }

  private generateJSON(data: DashboardData, filters: AnalyticsFilters): Buffer {
    const exportData = {
      exportTime: new Date().toISOString(),
      timeRange: data.timeRange,
      filters,
      metrics: {
        system: data.systemMetrics,
        jobs: data.jobMetrics,
        errors: data.errorMetrics,
        queue: data.queueMetrics,
        users: data.userMetrics,
      },
      insights: data.insights,
    };

    return Buffer.from(JSON.stringify(exportData, null, 2), "utf-8");
  }

  private generatePDF(data: DashboardData, filters: AnalyticsFilters): Buffer {
    // Simplified PDF generation - in production, use a proper PDF library
    const pdfContent = `
Analytics Dashboard Report
Generated: ${new Date().toLocaleString()}
Time Range: ${data.timeRange.startTime.toLocaleString()} - ${data.timeRange.endTime.toLocaleString()}

SYSTEM METRICS
CPU Usage: ${data.systemMetrics.cpu.current.toFixed(1)}% (avg: ${data.systemMetrics.cpu.average.toFixed(1)}%)
Memory Usage: ${data.systemMetrics.memory.current.toFixed(1)}% (avg: ${data.systemMetrics.memory.average.toFixed(1)}%)
Disk Usage: ${data.systemMetrics.disk.current.toFixed(1)}% (avg: ${data.systemMetrics.disk.average.toFixed(1)}%)

JOB METRICS
Success Rate: ${data.jobMetrics.successRate.percentage.toFixed(1)}%
Throughput: ${data.jobMetrics.throughput.jobsPerHour.toFixed(1)} jobs/hour
Average Duration: ${data.jobMetrics.averageDuration.average.toFixed(1)} seconds

ERROR METRICS
Error Rate: ${data.errorMetrics.errorRate.percentage.toFixed(1)}%
Total Errors: ${data.errorMetrics.errorRate.errors}

INSIGHTS
${data.insights.map((insight) => `- ${insight.title}: ${insight.description}`).join("\n")}
    `;

    return Buffer.from(pdfContent, "utf-8");
  }

  // Default methods for fallback when queries fail
  private getDefaultSystemMetrics(): SystemMetrics {
    return {
      cpu: { current: 0, average: 0, min: 0, max: 0, trend: "stable" },
      memory: { current: 0, average: 0, min: 0, max: 0, trend: "stable" },
      disk: { current: 0, average: 0, min: 0, max: 0, trend: "stable" },
      network: { current: 0, average: 0, min: 0, max: 0, trend: "stable" },
      uptime: 0,
    };
  }

  private getDefaultJobMetrics(): JobMetrics {
    return {
      throughput: { jobsPerMinute: 0, jobsPerHour: 0, daily: 0 },
      successRate: { percentage: 100, successful: 0, failed: 0, total: 0 },
      averageDuration: { average: 0, median: 0, min: 0, max: 0 },
      jobTypes: [],
      trends: {},
    };
  }

  private getDefaultErrorMetrics(): ErrorMetrics {
    return {
      errorRate: { percentage: 0, errors: 0, total: 0, trend: "stable" },
      errorCategories: [],
      topErrors: [],
      resolutionTime: { average: 0, median: 0, min: 0, max: 0 },
      trends: { hourly: [], daily: [], categories: {} },
    };
  }

  private getDefaultQueueMetrics(): QueueMetrics {
    return {
      queueDepth: [],
      waitTime: [],
      processingTime: [],
      queueUtilization: 0,
      bottlenecks: [],
    };
  }

  private getDefaultUserMetrics(): UserMetrics {
    return {
      activeUsers: 0,
      userActivity: {
        dailyActiveUsers: 0,
        weeklyActiveUsers: 0,
        monthlyActiveUsers: 0,
        averageSessionDuration: 0,
      },
      featureUsage: { features: {} },
      userSatisfaction: { averageRating: 0, totalRatings: 0, distribution: {} },
    };
  }
}
