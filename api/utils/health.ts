import { DatabaseService } from '../services/database.service';
import { JobQueueService } from '../services/job-queue.service';
import { logger } from './logger';
import { metricsHealthCheck } from './metrics';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheckComponent;
    queue: HealthCheckComponent;
    memory: HealthCheckComponent;
    disk: HealthCheckComponent;
    metrics: HealthCheckComponent;
  };
  summary: {
    total: number;
    healthy: number;
    unhealthy: number;
    degraded: number;
  };
}

export interface HealthCheckComponent {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  details?: any;
  responseTime?: number;
}

export class HealthChecker {
  constructor(
    private databaseService: DatabaseService,
    private jobQueueService: JobQueueService
  ) {}

  async performHealthCheck(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const checks = await Promise.allSettled([
        this.checkDatabase(),
        this.checkQueue(),
        this.checkMemory(),
        this.checkDisk(),
        this.checkMetrics(),
      ]);

      const results = checks.map((result, index) => {
        const checkNames = ['database', 'queue', 'memory', 'disk', 'metrics'];
        return {
          name: checkNames[index],
          result: result.status === 'fulfilled' ? result.value : {
            status: 'unhealthy' as const,
            message: result.reason?.message || 'Unknown error',
          },
        };
      });

      const checksObject = results.reduce((acc, { name, result }) => {
        acc[name as keyof HealthCheckResult['checks']] = result;
        return acc;
      }, {} as HealthCheckResult['checks']);

      const summary = this.calculateSummary(checksObject);
      const overallStatus = this.calculateOverallStatus(summary);

      const healthResult: HealthCheckResult = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: checksObject,
        summary,
      };

      const responseTime = Date.now() - startTime;
      logger.info(`Health check completed in ${responseTime}ms`, {
        status: overallStatus,
        summary,
        responseTime,
      });

      return healthResult;

    } catch (error) {
      logger.error('Health check failed:', error);
      
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: { status: 'unhealthy', message: 'Health check failed' },
          queue: { status: 'unhealthy', message: 'Health check failed' },
          memory: { status: 'unhealthy', message: 'Health check failed' },
          disk: { status: 'unhealthy', message: 'Health check failed' },
          metrics: { status: 'unhealthy', message: 'Health check failed' },
        },
        summary: { total: 5, healthy: 0, unhealthy: 5, degraded: 0 },
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheckComponent> {
    const startTime = Date.now();
    
    try {
      const isConnected = await this.databaseService.isConnected();
      const responseTime = Date.now() - startTime;

      if (!isConnected) {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
          responseTime,
        };
      }

      // Test a simple query
      await this.databaseService.query('SELECT 1');

      return {
        status: 'healthy',
        message: 'Database connection successful',
        responseTime,
        details: {
          connected: true,
          responseTime,
        },
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Database check failed',
        responseTime,
      };
    }
  }

  private async checkQueue(): Promise<HealthCheckComponent> {
    const startTime = Date.now();
    
    try {
      const stats = await this.jobQueueService.getQueueStats();
      const responseTime = Date.now() - startTime;

      // Check if queue is responsive
      const isHealthy = stats.waiting >= 0 && stats.active >= 0;

      if (!isHealthy) {
        return {
          status: 'unhealthy',
          message: 'Queue stats invalid',
          responseTime,
          details: stats,
        };
      }

      // Check for queue congestion
      const totalJobs = stats.waiting + stats.active;
      const isCongested = totalJobs > 1000; // Configurable threshold

      return {
        status: isCongested ? 'degraded' : 'healthy',
        message: isCongested ? 'Queue congested' : 'Queue operating normally',
        responseTime,
        details: stats,
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Queue check failed',
        responseTime,
      };
    }
  }

  private async checkMemory(): Promise<HealthCheckComponent> {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      
      const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
      const heapTotalMB = memUsage.heapTotal / 1024 / 1024;
      const systemUsagePercent = ((totalMemory - freeMemory) / totalMemory) * 100;
      const heapUsagePercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;

      // Memory thresholds (configurable)
      const heapThreshold = 90; // 90% heap usage
      const systemThreshold = 85; // 85% system memory usage

      let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
      let message = 'Memory usage normal';

      if (heapUsagePercent > heapThreshold || systemUsagePercent > systemThreshold) {
        status = 'unhealthy';
        message = 'Memory usage critical';
      } else if (heapUsagePercent > heapThreshold - 10 || systemUsagePercent > systemThreshold - 10) {
        status = 'degraded';
        message = 'Memory usage high';
      }

      return {
        status,
        message,
        details: {
          heapUsed: Math.round(heapUsedMB),
          heapTotal: Math.round(heapTotalMB),
          heapUsagePercent: Math.round(heapUsagePercent),
          systemUsagePercent: Math.round(systemUsagePercent),
          rss: Math.round(memUsage.rss / 1024 / 1024),
          external: Math.round(memUsage.external / 1024 / 1024),
        },
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Memory check failed',
      };
    }
  }

  private async checkDisk(): Promise<HealthCheckComponent> {
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check disk space for logs directory
      const logsDir = path.join(process.cwd(), 'logs');
      const stats = fs.statSync(logsDir);
      
      // Simple disk check (in production, use proper disk space checking)
      const isHealthy = stats && stats.isDirectory();
      
      return {
        status: isHealthy ? 'healthy' : 'unhealthy',
        message: isHealthy ? 'Disk access normal' : 'Disk access failed',
        details: {
          logsDirectory: logsDir,
          accessible: isHealthy,
        },
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Disk check failed',
      };
    }
  }

  private async checkMetrics(): Promise<HealthCheckComponent> {
    try {
      const metricsResult = metricsHealthCheck();
      
      return {
        status: metricsResult.healthy ? 'healthy' : 'unhealthy',
        message: metricsResult.healthy ? 'Metrics system healthy' : 'Metrics system unhealthy',
        details: metricsResult,
      };

    } catch (error) {
      return {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Metrics check failed',
      };
    }
  }

  private calculateSummary(checks: HealthCheckResult['checks']): HealthCheckResult['summary'] {
    const values = Object.values(checks);
    
    return {
      total: values.length,
      healthy: values.filter(c => c.status === 'healthy').length,
      unhealthy: values.filter(c => c.status === 'unhealthy').length,
      degraded: values.filter(c => c.status === 'degraded').length,
    };
  }

  private calculateOverallStatus(summary: HealthCheckResult['summary']): 'healthy' | 'unhealthy' | 'degraded' {
    if (summary.unhealthy > 0) {
      return 'unhealthy';
    }
    
    if (summary.degraded > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }

  // Readiness probe (for Kubernetes)
  async isReady(): Promise<boolean> {
    try {
      const dbCheck = await this.checkDatabase();
      const queueCheck = await this.checkQueue();
      
      return dbCheck.status === 'healthy' && queueCheck.status === 'healthy';
    } catch (error) {
      return false;
    }
  }

  // Liveness probe (for Kubernetes)
  async isAlive(): Promise<boolean> {
    try {
      // Basic check - is the process responsive?
      return process.uptime() > 0;
    } catch (error) {
      return false;
    }
  }
}

// Health check endpoints
export const createHealthEndpoints = (healthChecker: HealthChecker) => {
  return {
    // Basic health check
    basic: async (req: any, res: any) => {
      try {
        const isAlive = await healthChecker.isAlive();
        res.status(isAlive ? 200 : 503).json({
          status: isAlive ? 'ok' : 'error',
          timestamp: new Date().toISOString(),
          uptime: process.uptime(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Health check failed',
        });
      }
    },

    // Readiness probe
    ready: async (req: any, res: any) => {
      try {
        const isReady = await healthChecker.isReady();
        res.status(isReady ? 200 : 503).json({
          status: isReady ? 'ready' : 'not ready',
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        res.status(503).json({
          status: 'not ready',
          message: error instanceof Error ? error.message : 'Readiness check failed',
        });
      }
    },

    // Comprehensive health check
    detailed: async (req: any, res: any) => {
      try {
        const health = await healthChecker.performHealthCheck();
        const statusCode = health.status === 'healthy' ? 200 : 
                          health.status === 'degraded' ? 200 : 503;
        
        res.status(statusCode).json(health);
      } catch (error) {
        res.status(503).json({
          status: 'error',
          message: error instanceof Error ? error.message : 'Health check failed',
          timestamp: new Date().toISOString(),
        });
      }
    },
  };
};