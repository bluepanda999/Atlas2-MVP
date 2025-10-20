import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MonitoringController } from '../../api/controllers/monitoring.controller';
import { MetricsService } from '../../api/services/metrics.service';
import { HealthService } from '../../api/services/health.service';
import { AlertingService } from '../../api/services/alerting.service';
import { LoggingService } from '../../api/services/logging.service';
import { ErrorTrackingService } from '../../api/services/error-tracking.service';
import { PerformanceMiddleware } from '../../api/middleware/performance.middleware';
import { ApiKeyConfig } from '../../entities/api-key-config.entity';
import { UploadSession } from '../../entities/upload-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ApiKeyConfig,
      UploadSession,
    ]),
  ],
  controllers: [
    MonitoringController,
  ],
  providers: [
    MetricsService,
    HealthService,
    AlertingService,
    LoggingService,
    ErrorTrackingService,
    {
      provide: 'PERFORMANCE_MIDDLEWARE',
      useFactory: (
        metricsService: MetricsService,
        loggingService: LoggingService,
      ) => new PerformanceMiddleware(metricsService, loggingService),
      inject: [MetricsService, LoggingService],
    },
  ],
  exports: [
    MetricsService,
    HealthService,
    AlertingService,
    LoggingService,
    ErrorTrackingService,
    'PERFORMANCE_MIDDLEWARE',
  ],
})
export class MonitoringModule {}