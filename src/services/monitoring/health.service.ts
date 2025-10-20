import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyConfig } from '../../entities/api-key-config.entity';
import { UploadSession } from '../../entities/upload-session.entity';

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: Date;
  uptime: number;
  version: string;
  checks: {
    database: HealthCheck;
    memory: HealthCheck;
    disk: HealthCheck;
    uploads: HealthCheck;
    authentication: HealthCheck;
  };
  metrics: {
    activeUploads: number;
    totalApiKeys: number;
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
  };
}

export interface HealthCheck {
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration?: number;
  details?: any;
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  private readonly startTime = Date.now();

  constructor(
    @InjectRepository(ApiKeyConfig)
    private readonly apiKeyConfigRepository: Repository<ApiKeyConfig>,
    @InjectRepository(UploadSession)
    private readonly uploadSessionRepository: Repository<UploadSession>,
  ) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const [
        databaseCheck,
        memoryCheck,
        diskCheck,
        uploadsCheck,
        authenticationCheck,
        metrics,
      ] = await Promise.all([
        this.checkDatabase(),
        this.checkMemory(),
        this.checkDisk(),
        this.checkUploads(),
        this.checkAuthentication(),
        this.getMetrics(),
      ]);

      const overallStatus = this.determineOverallStatus([
        databaseCheck,
        memoryCheck,
        diskCheck,
        uploadsCheck,
        authenticationCheck,
      ]);

      return {
        status: overallStatus,
        timestamp: new Date(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: databaseCheck,
          memory: memoryCheck,
          disk: diskCheck,
          uploads: uploadsCheck,
          authentication: authenticationCheck,
        },
        metrics,
      };

    } catch (error) {
      this.logger.error('Health check failed', error.stack);
      
      return {
        status: 'unhealthy',
        timestamp: new Date(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        checks: {
          database: { status: 'fail', message: error.message },
          memory: { status: 'fail', message: error.message },
          disk: { status: 'fail', message: error.message },
          uploads: { status: 'fail', message: error.message },
          authentication: { status: 'fail', message: error.message },
        },
        metrics: {
          activeUploads: 0,
          totalApiKeys: 0,
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
        },
      };
    }
  }

  private async checkDatabase(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Test database connection with a simple query
      await this.apiKeyConfigRepository.query('SELECT 1');
      
      // Check if we can perform basic operations
      const count = await this.apiKeyConfigRepository.count();
      
      const duration = Date.now() - startTime;
      
      return {
        status: 'pass',
        duration,
        details: {
          connected: true,
          recordCount: count,
          responseTime: `${duration}ms`,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        status: 'fail',
        message: error.message,
        duration,
        details: {
          connected: false,
          error: error.message,
        },
      };
    }
  }

  private async checkMemory(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const memUsage = process.memoryUsage();
      const totalMemory = memUsage.heapTotal;
      const usedMemory = memUsage.heapUsed;
      const memoryUsagePercent = (usedMemory / totalMemory) * 100;

      const duration = Date.now() - startTime;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message: string | undefined;

      if (memoryUsagePercent > 90) {
        status = 'fail';
        message = 'Memory usage critically high';
      } else if (memoryUsagePercent > 80) {
        status = 'warn';
        message = 'Memory usage high';
      }

      return {
        status,
        message,
        duration,
        details: {
          heapUsed: `${Math.round(usedMemory / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(totalMemory / 1024 / 1024)}MB`,
          usagePercent: `${Math.round(memoryUsagePercent)}%`,
          rss: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memUsage.external / 1024 / 1024)}MB`,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        status: 'fail',
        message: error.message,
        duration,
      };
    }
  }

  private async checkDisk(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      const fs = require('fs');
      const path = require('path');
      
      // Check upload directory
      const uploadDir = process.env.UPLOAD_DIR || './uploads';
      const stats = fs.statSync(uploadDir);
      
      // Simple disk space check (would need more sophisticated check in production)
      const duration = Date.now() - startTime;
      
      return {
        status: 'pass',
        duration,
        details: {
          uploadDirectory: uploadDir,
          accessible: true,
          lastModified: stats.mtime,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        status: 'fail',
        message: `Upload directory not accessible: ${error.message}`,
        duration,
      };
    }
  }

  private async checkUploads(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check upload session table
      const totalUploads = await this.uploadSessionRepository.count();
      const activeUploads = await this.uploadSessionRepository.count({
        where: { status: 'uploading' },
      });
      const failedUploads = await this.uploadSessionRepository.count({
        where: { status: 'failed' },
      });

      const duration = Date.now() - startTime;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message: string | undefined;

      const failureRate = totalUploads > 0 ? (failedUploads / totalUploads) * 100 : 0;
      
      if (failureRate > 20) {
        status = 'fail';
        message = 'High upload failure rate';
      } else if (failureRate > 10) {
        status = 'warn';
        message = 'Elevated upload failure rate';
      }

      return {
        status,
        message,
        duration,
        details: {
          totalUploads,
          activeUploads,
          failedUploads,
          failureRate: `${Math.round(failureRate)}%`,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        status: 'fail',
        message: error.message,
        duration,
      };
    }
  }

  private async checkAuthentication(): Promise<HealthCheck> {
    const startTime = Date.now();
    
    try {
      // Check API key configurations
      const totalApiKeys = await this.apiKeyConfigRepository.count();
      const activeApiKeys = await this.apiKeyConfigRepository.count({
        where: { isActive: true },
      });
      const expiredApiKeys = await this.apiKeyConfigRepository
        .createQueryBuilder('api_key')
        .where('api_key.expiresAt < :now', { now: new Date() })
        .getCount();

      const duration = Date.now() - startTime;
      
      let status: 'pass' | 'warn' | 'fail' = 'pass';
      let message: string | undefined;

      if (totalApiKeys === 0) {
        status = 'warn';
        message = 'No API keys configured';
      }

      return {
        status,
        message,
        duration,
        details: {
          totalApiKeys,
          activeApiKeys,
          expiredApiKeys,
          responseTime: `${duration}ms`,
        },
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      
      return {
        status: 'fail',
        message: error.message,
        duration,
      };
    }
  }

  private async getMetrics(): Promise<any> {
    try {
      const [activeUploads, totalApiKeys] = await Promise.all([
        this.uploadSessionRepository.count({
          where: { status: 'uploading' },
        }),
        this.apiKeyConfigRepository.count(),
      ]);

      return {
        activeUploads,
        totalApiKeys,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };

    } catch (error) {
      this.logger.error('Failed to get metrics', error.stack);
      
      return {
        activeUploads: 0,
        totalApiKeys: 0,
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
      };
    }
  }

  private determineOverallStatus(checks: HealthCheck[]): 'healthy' | 'unhealthy' | 'degraded' {
    const failedChecks = checks.filter(check => check.status === 'fail');
    const warnChecks = checks.filter(check => check.status === 'warn');

    if (failedChecks.length > 0) {
      return 'unhealthy';
    }

    if (warnChecks.length > 0) {
      return 'degraded';
    }

    return 'healthy';
  }

  // Liveness probe - simple check if the service is running
  async checkLiveness(): Promise<{ status: string; timestamp: Date }> {
    return {
      status: 'ok',
      timestamp: new Date(),
    };
  }

  // Readiness probe - check if the service is ready to handle requests
  async checkReadiness(): Promise<{ status: string; timestamp: Date; checks: any }> {
    const databaseCheck = await this.checkDatabase();
    
    return {
      status: databaseCheck.status === 'pass' ? 'ready' : 'not_ready',
      timestamp: new Date(),
      checks: {
        database: databaseCheck.status,
      },
    };
  }

  // Detailed health information for monitoring
  async getDetailedHealth(): Promise<any> {
    const health = await this.checkHealth();
    
    return {
      ...health,
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        pid: process.pid,
      },
      performance: {
        eventLoopLag: this.getEventLoopLag(),
        activeHandles: process._getActiveHandles().length,
        activeRequests: process._getActiveRequests().length,
      },
    };
  }

  private getEventLoopLag(): number {
    const start = process.hrtime.bigint();
    return new Promise(resolve => {
      setImmediate(() => {
        const lag = Number(process.hrtime.bigint() - start) / 1000000; // Convert to milliseconds
        resolve(lag);
      });
    });
  }
}