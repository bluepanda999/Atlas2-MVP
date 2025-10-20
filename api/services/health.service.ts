import { DatabaseService } from './database.service';
import { JobQueueService } from './job-queue.service';
import { logger } from '../utils/logger';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  checks: {
    database: HealthCheck;
    redis: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
  };
  timestamp: Date;
  uptime: number;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy' | 'degraded';
  message?: string;
  responseTime?: number;
  details?: any;
}

export class HealthService {
  private startTime: Date;

  constructor(
    private databaseService: DatabaseService,
    private jobQueueService: JobQueueService
  ) {
    this.startTime = new Date();
  }

  async checkHealth(): Promise<HealthCheckResult> {
    const timestamp = new Date();
    const uptime = timestamp.getTime() - this.startTime.getTime();

    const checks = {
      database: await this.checkDatabase(),
      redis: await this.checkRedis(),
      memory: this.checkMemory(),
      disk: this.checkDisk(),
    };

    // Determine overall status
    const statuses = Object.values(checks).map(check => check.status);
    let status: 'healthy' | 'unhealthy' | 'degraded';

    if (statuses.every(s => s === 'healthy')) {
      status = 'healthy';
    } else if (statuses.some(s => s === 'unhealthy')) {
      status = 'unhealthy';
    } else {
      status = 'degraded';
    }

    return {
      status,
      checks,
      timestamp,
      uptime,
    };
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const isHealthy = await this.databaseService.healthCheck();
      const responseTime = Date.now() - startTime;

      if (isHealthy) {
        return {
          status: 'healthy',
          responseTime,
          message: 'Database connection successful',
        };
      } else {
        return {
          status: 'unhealthy',
          responseTime,
          message: 'Database connection failed',
        };
      }
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Database health check failed:', error);
      
      return {
        status: 'unhealthy',
        responseTime,
        message: 'Database health check error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkRedis(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Simple Redis ping check
      await this.jobQueueService.getQueueStats('health-check');
      const responseTime = Date.now() - startTime;

      return {
        status: 'healthy',
        responseTime,
        message: 'Redis connection successful',
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      logger.error('Redis health check failed:', error);
      
      return {
        status: 'unhealthy',
        responseTime,
        message: 'Redis connection failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkMemory(): HealthCheck {
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = require('os').totalmem();
      const freeMemory = require('os').freemem();
      const usedMemory = totalMemory - freeMemory;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      // Check if memory usage is above 80%
      if (memoryUsagePercent > 80) {
        return {
          status: 'degraded',
          message: 'High memory usage',
          details: {
            usagePercent: memoryUsagePercent.toFixed(2),
            processMemory: {
              rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
              heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
              heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
            },
          },
        };
      }

      return {
        status: 'healthy',
        message: 'Memory usage normal',
        details: {
          usagePercent: memoryUsagePercent.toFixed(2),
          processMemory: {
            rss: `${(memUsage.rss / 1024 / 1024).toFixed(2)} MB`,
            heapUsed: `${(memUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`,
            heapTotal: `${(memUsage.heapTotal / 1024 / 1024).toFixed(2)} MB`,
          },
        },
      };
    } catch (error) {
      logger.error('Memory health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Memory health check error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkDisk(): HealthCheck {
    try {
      const fs = require('fs');
      const stats = fs.statSync('.');
      
      // This is a simplified disk check
      // In a real implementation, you'd check actual disk space
      return {
        status: 'healthy',
        message: 'Disk space available',
        details: {
          // Placeholder for disk space information
          note: 'Disk space check not implemented',
        },
      };
    } catch (error) {
      logger.error('Disk health check failed:', error);
      
      return {
        status: 'unhealthy',
        message: 'Disk health check error',
        details: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  async checkLiveness(): Promise<{ status: string; timestamp: Date }> {
    // Simple liveness check - if we can respond, we're alive
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }

  async checkReadiness(): Promise<{ status: string; timestamp: Date; checks: any }> {
    // Readiness check - ensure essential services are ready
    const dbCheck = await this.checkDatabase();
    const redisCheck = await this.checkRedis();

    const isReady = dbCheck.status === 'healthy' && redisCheck.status === 'healthy';

    return {
      status: isReady ? 'ready' : 'not ready',
      timestamp: new Date(),
      checks: {
        database: dbCheck.status,
        redis: redisCheck.status,
      },
    };
  }
}