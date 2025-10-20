import { Controller, Get, Query, Res, HttpStatus, HttpCode } from '@nestjs/common';
import { Response } from 'express';
import { MetricsService } from '../services/metrics.service';
import { HealthService, HealthCheckResult } from '../services/health.service';
import { AlertingService } from '../services/alerting.service';
import { LoggingService } from '../services/logging.service';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';

@ApiTags('monitoring')
@Controller('monitoring')
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
    private readonly alertingService: AlertingService,
    private readonly loggingService: LoggingService,
  ) {}

  @Get('metrics')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Get Prometheus metrics' })
  @ApiResponse({ status: 200, description: 'Metrics in Prometheus format' })
  async getMetrics(@Res() res: Response): Promise<void> {
    try {
      const metrics = await this.metricsService.getMetrics();
      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      this.loggingService.error('Failed to get metrics', error.stack, 'MonitoringController');
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('Error generating metrics');
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Get health status' })
  @ApiResponse({ status: 200, description: 'Health check results' })
  async getHealth(): Promise<HealthCheckResult> {
    try {
      return await this.healthService.checkHealth();
    } catch (error) {
      this.loggingService.error('Health check failed', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('health/live')
  @ApiOperation({ summary: 'Liveness probe' })
  @ApiResponse({ status: 200, description: 'Service is alive' })
  async getLiveness(): Promise<{ status: string; timestamp: Date }> {
    try {
      return await this.healthService.checkLiveness();
    } catch (error) {
      this.loggingService.error('Liveness check failed', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('health/ready')
  @ApiOperation({ summary: 'Readiness probe' })
  @ApiResponse({ status: 200, description: 'Service is ready' })
  async getReadiness(): Promise<{ status: string; timestamp: Date; checks: any }> {
    try {
      return await this.healthService.checkReadiness();
    } catch (error) {
      this.loggingService.error('Readiness check failed', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('health/detailed')
  @ApiOperation({ summary: 'Get detailed health information' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async getDetailedHealth(): Promise<any> {
    try {
      return await this.healthService.getDetailedHealth();
    } catch (error) {
      this.loggingService.error('Detailed health check failed', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('alerts')
  @ApiOperation({ summary: 'Get active alerts' })
  @ApiResponse({ status: 200, description: 'List of active alerts' })
  @ApiQuery({ name: 'severity', required: false, enum: ['critical', 'warning', 'info'] })
  @ApiQuery({ name: 'status', required: false, enum: ['active', 'resolved', 'all'] })
  async getAlerts(
    @Query('severity') severity?: string,
    @Query('status') status?: string,
  ): Promise<any> {
    try {
      return await this.alertingService.getAlerts({ severity, status });
    } catch (error) {
      this.loggingService.error('Failed to get alerts', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('alerts/rules')
  @ApiOperation({ summary: 'Get alert rules' })
  @ApiResponse({ status: 200, description: 'List of alert rules' })
  async getAlertRules(): Promise<any> {
    try {
      return await this.alertingService.getAlertRules();
    } catch (error) {
      this.loggingService.error('Failed to get alert rules', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('logs')
  @ApiOperation({ summary: 'Get system logs' })
  @ApiResponse({ status: 200, description: 'System logs' })
  @ApiQuery({ name: 'level', required: false, enum: ['error', 'warn', 'info', 'debug'] })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  async getLogs(
    @Query('level') level?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<any> {
    try {
      return await this.loggingService.getLogs({ level, limit, offset });
    } catch (error) {
      this.loggingService.error('Failed to get logs', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('performance')
  @ApiOperation({ summary: 'Get performance metrics' })
  @ApiResponse({ status: 200, description: 'Performance metrics' })
  async getPerformanceMetrics(): Promise<any> {
    try {
      const healthMetrics = this.metricsService.getHealthMetrics();
      const registry = this.metricsService.getRegistry();
      const metrics = await registry.metrics();
      
      return {
        system: healthMetrics,
        prometheusMetrics: metrics,
        timestamp: new Date(),
      };
    } catch (error) {
      this.loggingService.error('Failed to get performance metrics', error.stack, 'MonitoringController');
      throw error;
    }
  }

  @Get('status')
  @ApiOperation({ summary: 'Get overall system status' })
  @ApiResponse({ status: 200, description: 'System status overview' })
  async getSystemStatus(): Promise<any> {
    try {
      const [health, alerts] = await Promise.all([
        this.healthService.checkHealth(),
        this.alertingService.getActiveAlerts(),
      ]);

      return {
        status: health.status,
        timestamp: new Date(),
        uptime: health.uptime,
        version: health.version,
        health: {
          overall: health.status,
          checks: health.checks,
        },
        alerts: {
          active: alerts.length,
          critical: alerts.filter(a => a.severity === 'critical').length,
          warning: alerts.filter(a => a.severity === 'warning').length,
        },
        metrics: health.metrics,
      };
    } catch (error) {
      this.loggingService.error('Failed to get system status', error.stack, 'MonitoringController');
      throw error;
    }
  }
}