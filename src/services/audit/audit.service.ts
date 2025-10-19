import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuthAuditLog } from '../../entities/auth-audit-log.entity';

export interface AuthAuditEvent {
  configId: string;
  configType: 'api_key' | 'basic_auth' | 'bearer_token';
  action: string;
  userId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectRepository(AuthAuditLog)
    private readonly auditLogRepository: Repository<AuthAuditLog>,
  ) {}

  async logAuthEvent(event: AuthAuditEvent): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        configId: event.configId,
        configType: event.configType,
        action: event.action,
        userId: event.userId || 'system',
        ipAddress: event.ipAddress || '127.0.0.1',
        userAgent: event.userAgent || 'System',
        details: event.details || {},
        createdAt: new Date(),
      });

      await this.auditLogRepository.save(auditLog);

      this.logger.log(`Audit event logged: ${event.configType}:${event.action} for config ${event.configId}`);
    } catch (error) {
      this.logger.error('Failed to log audit event', error.stack);
      // Don't throw here - audit logging failures shouldn't break the main flow
    }
  }

  async getAuditLogs(configId?: string, configType?: string, limit: number = 100): Promise<AuthAuditLog[]> {
    const queryBuilder = this.auditLogRepository.createQueryBuilder('audit_log')
      .orderBy('audit_log.createdAt', 'DESC')
      .limit(limit);

    if (configId) {
      queryBuilder.andWhere('audit_log.configId = :configId', { configId });
    }

    if (configType) {
      queryBuilder.andWhere('audit_log.configType = :configType', { configType });
    }

    return await queryBuilder.getMany();
  }

  async getAuditStats(configId: string, days: number = 30): Promise<any> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const stats = await this.auditLogRepository.createQueryBuilder('audit_log')
      .select('audit_log.action', 'action')
      .addSelect('COUNT(*)', 'count')
      .where('audit_log.configId = :configId', { configId })
      .andWhere('audit_log.createdAt >= :startDate', { startDate })
      .groupBy('audit_log.action')
      .getRawMany();

    return stats;
  }
}