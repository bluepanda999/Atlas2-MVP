import { Injectable, Logger } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { LoggingService } from './logging.service';

export interface Alert {
  id: string;
  name: string;
  severity: 'critical' | 'warning' | 'info';
  status: 'active' | 'resolved' | 'suppressed';
  message: string;
  description?: string;
  timestamp: Date;
  resolvedAt?: Date;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  ruleId: string;
  fingerprint: string;
}

export interface AlertRule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  severity: 'critical' | 'warning' | 'info';
  condition: AlertCondition;
  threshold: number;
  duration: number; // seconds
  labels: Record<string, string>;
  annotations: Record<string, string>;
  notificationChannels: string[];
  cooldown: number; // seconds
  lastTriggered?: Date;
}

export interface AlertCondition {
  metric: string;
  operator: '>' | '<' | '>=' | '<=' | '==' | '!=';
  aggregation?: 'avg' | 'sum' | 'max' | 'min' | 'count';
  timeRange?: number; // seconds
  filters?: Record<string, string>;
}

export interface NotificationChannel {
  id: string;
  name: string;
  type: 'email' | 'slack' | 'webhook' | 'pagerduty';
  enabled: boolean;
  config: Record<string, any>;
  rateLimit?: {
    limit: number;
    window: number; // seconds
  };
}

export interface AlertFilters {
  severity?: string;
  status?: string;
  ruleId?: string;
  startTime?: Date;
  endTime?: Date;
}

@Injectable()
export class AlertingService {
  private readonly logger = new Logger(AlertingService.name);
  private readonly alerts = new Map<string, Alert>();
  private readonly alertRules = new Map<string, AlertRule>();
  private readonly notificationChannels = new Map<string, NotificationChannel>();
  private readonly evaluationInterval = 30000; // 30 seconds
  private evaluationTimer: NodeJS.Timeout;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly loggingService: LoggingService,
  ) {
    this.initializeDefaultRules();
    this.initializeDefaultChannels();
    this.startEvaluation();
  }

  private initializeDefaultRules(): void {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        description: 'Alert when error rate exceeds 5%',
        enabled: true,
        severity: 'warning',
        condition: {
          metric: 'http_requests_total',
          operator: '>',
          aggregation: 'sum',
          timeRange: 300,
          filters: { status_code: '5..' },
        },
        threshold: 0.05,
        duration: 300,
        labels: { team: 'platform', service: 'api' },
        annotations: {
          summary: 'High error rate detected',
          description: 'Error rate has exceeded 5% in the last 5 minutes',
        },
        notificationChannels: ['default-email'],
        cooldown: 900,
      },
      {
        id: 'high-memory-usage',
        name: 'High Memory Usage',
        description: 'Alert when memory usage exceeds 90%',
        enabled: true,
        severity: 'critical',
        condition: {
          metric: 'memory_usage_bytes',
          operator: '>',
          aggregation: 'avg',
          filters: { type: 'heap_used' },
        },
        threshold: 0.9,
        duration: 180,
        labels: { team: 'platform', service: 'api' },
        annotations: {
          summary: 'High memory usage detected',
          description: 'Memory usage has exceeded 90%',
        },
        notificationChannels: ['default-email', 'critical-slack'],
        cooldown: 600,
      },
      {
        id: 'high-response-time',
        name: 'High Response Time',
        description: 'Alert when average response time exceeds 2 seconds',
        enabled: true,
        severity: 'warning',
        condition: {
          metric: 'http_request_duration_seconds',
          operator: '>',
          aggregation: 'avg',
          timeRange: 300,
        },
        threshold: 2,
        duration: 300,
        labels: { team: 'platform', service: 'api' },
        annotations: {
          summary: 'High response time detected',
          description: 'Average response time has exceeded 2 seconds',
        },
        notificationChannels: ['default-email'],
        cooldown: 900,
      },
      {
        id: 'database-connection-failure',
        name: 'Database Connection Failure',
        description: 'Alert when database health check fails',
        enabled: true,
        severity: 'critical',
        condition: {
          metric: 'db_connections_active',
          operator: '==',
          aggregation: 'max',
        },
        threshold: 0,
        duration: 60,
        labels: { team: 'platform', service: 'database' },
        annotations: {
          summary: 'Database connection failure',
          description: 'Database health check is failing',
        },
        notificationChannels: ['default-email', 'critical-slack', 'pagerduty'],
        cooldown: 300,
      },
      {
        id: 'upload-failure-rate',
        name: 'High Upload Failure Rate',
        description: 'Alert when upload failure rate exceeds 20%',
        enabled: true,
        severity: 'warning',
        condition: {
          metric: 'upload_failures_total',
          operator: '>',
          aggregation: 'sum',
          timeRange: 600,
        },
        threshold: 0.2,
        duration: 300,
        labels: { team: 'platform', service: 'upload' },
        annotations: {
          summary: 'High upload failure rate',
          description: 'Upload failure rate has exceeded 20% in the last 10 minutes',
        },
        notificationChannels: ['default-email'],
        cooldown: 900,
      },
    ];

    defaultRules.forEach(rule => {
      this.alertRules.set(rule.id, rule);
    });
  }

  private initializeDefaultChannels(): void {
    const defaultChannels: NotificationChannel[] = [
      {
        id: 'default-email',
        name: 'Default Email Notifications',
        type: 'email',
        enabled: true,
        config: {
          recipients: [process.env.ALERT_EMAIL_RECIPIENTS || 'admin@example.com'],
          subjectPrefix: '[Atlas2 Alert]',
        },
        rateLimit: {
          limit: 10,
          window: 3600, // 1 hour
        },
      },
      {
        id: 'critical-slack',
        name: 'Critical Slack Channel',
        type: 'slack',
        enabled: true,
        config: {
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts-critical',
          username: 'Atlas2 Alerts',
        },
        rateLimit: {
          limit: 5,
          window: 3600, // 1 hour
        },
      },
      {
        id: 'pagerduty',
        name: 'PagerDuty Integration',
        type: 'pagerduty',
        enabled: true,
        config: {
          integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
          severity: 'critical',
        },
        rateLimit: {
          limit: 3,
          window: 3600, // 1 hour
        },
      },
    ];

    defaultChannels.forEach(channel => {
      this.notificationChannels.set(channel.id, channel);
    });
  }

  private startEvaluation(): void {
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules();
    }, this.evaluationInterval);
  }

  private async evaluateRules(): Promise<void> {
    try {
      const enabledRules = Array.from(this.alertRules.values()).filter(rule => rule.enabled);
      
      for (const rule of enabledRules) {
        await this.evaluateRule(rule);
      }
    } catch (error) {
      this.logger.error('Failed to evaluate alert rules', error.stack);
    }
  }

  private async evaluateRule(rule: AlertRule): Promise<void> {
    try {
      const value = await this.getMetricValue(rule.condition);
      const isThresholdExceeded = this.compareValues(value, rule.condition.operator, rule.threshold);
      
      if (isThresholdExceeded) {
        await this.handleThresholdExceeded(rule, value);
      } else {
        await this.handleThresholdNormal(rule);
      }
    } catch (error) {
      this.logger.error(`Failed to evaluate rule ${rule.name}`, error.stack);
    }
  }

  private async getMetricValue(condition: AlertCondition): Promise<number> {
    const registry = this.metricsService.getRegistry();
    const metric = registry.getSingleMetric(condition.metric);
    
    if (!metric) {
      throw new Error(`Metric ${condition.metric} not found`);
    }

    const metricValues = await metric.get();
    
    // Apply filters
    let filteredValues = metricValues;
    if (condition.filters) {
      filteredValues = metricValues.filter(value => {
        return Object.entries(condition.filters).every(([key, filterValue]) => {
          const labelValue = value.labels[key];
          if (!labelValue) return false;
          
          // Support regex patterns in filter values
          if (filterValue.includes('..')) {
            const [min, max] = filterValue.split('..');
            const numValue = parseInt(labelValue);
            return numValue >= parseInt(min) && numValue <= parseInt(max);
          }
          
          return labelValue === filterValue;
        });
      });
    }

    // Apply aggregation
    let result: number;
    switch (condition.aggregation) {
      case 'sum':
        result = filteredValues.reduce((sum, val) => sum + val.value, 0);
        break;
      case 'avg':
        result = filteredValues.length > 0 
          ? filteredValues.reduce((sum, val) => sum + val.value, 0) / filteredValues.length 
          : 0;
        break;
      case 'max':
        result = filteredValues.length > 0 
          ? Math.max(...filteredValues.map(val => val.value)) 
          : 0;
        break;
      case 'min':
        result = filteredValues.length > 0 
          ? Math.min(...filteredValues.map(val => val.value)) 
          : 0;
        break;
      case 'count':
        result = filteredValues.length;
        break;
      default:
        result = filteredValues.length > 0 ? filteredValues[0].value : 0;
    }

    return result;
  }

  private compareValues(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case '>': return value > threshold;
      case '<': return value < threshold;
      case '>=': return value >= threshold;
      case '<=': return value <= threshold;
      case '==': return value === threshold;
      case '!=': return value !== threshold;
      default: return false;
    }
  }

  private async handleThresholdExceeded(rule: AlertRule, value: number): Promise<void> {
    const alertId = this.generateAlertId(rule);
    const existingAlert = this.alerts.get(alertId);

    if (existingAlert) {
      if (existingAlert.status === 'resolved') {
        // Re-activate resolved alert
        existingAlert.status = 'active';
        existingAlert.timestamp = new Date();
        delete existingAlert.resolvedAt;
        await this.sendNotifications(existingAlert);
      }
    } else {
      // Check cooldown period
      if (rule.lastTriggered) {
        const timeSinceLastTriggered = Date.now() - rule.lastTriggered.getTime();
        if (timeSinceLastTriggered < rule.cooldown * 1000) {
          return; // Still in cooldown period
        }
      }

      // Create new alert
      const alert: Alert = {
        id: alertId,
        name: rule.name,
        severity: rule.severity,
        status: 'active',
        message: this.generateAlertMessage(rule, value),
        description: rule.description,
        timestamp: new Date(),
        labels: { ...rule.labels, value: value.toString() },
        annotations: rule.annotations,
        ruleId: rule.id,
        fingerprint: this.generateFingerprint(rule, value),
      };

      this.alerts.set(alertId, alert);
      rule.lastTriggered = new Date();

      await this.sendNotifications(alert);
      this.loggingService.warn(`Alert triggered: ${alert.name}`, { alert }, 'AlertingService');
    }
  }

  private async handleThresholdNormal(rule: AlertRule): Promise<void> {
    const alertId = this.generateAlertId(rule);
    const existingAlert = this.alerts.get(alertId);

    if (existingAlert && existingAlert.status === 'active') {
      // Resolve the alert
      existingAlert.status = 'resolved';
      existingAlert.resolvedAt = new Date();
      
      await this.sendResolutionNotifications(existingAlert);
      this.loggingService.info(`Alert resolved: ${existingAlert.name}`, { alert: existingAlert }, 'AlertingService');
    }
  }

  private async sendNotifications(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) return;

    for (const channelId of rule.notificationChannels) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) continue;

      try {
        await this.sendNotification(channel, alert);
      } catch (error) {
        this.logger.error(`Failed to send notification via ${channel.name}`, error.stack);
      }
    }
  }

  private async sendResolutionNotifications(alert: Alert): Promise<void> {
    const rule = this.alertRules.get(alert.ruleId);
    if (!rule) return;

    for (const channelId of rule.notificationChannels) {
      const channel = this.notificationChannels.get(channelId);
      if (!channel || !channel.enabled) continue;

      try {
        await this.sendResolutionNotification(channel, alert);
      } catch (error) {
        this.logger.error(`Failed to send resolution notification via ${channel.name}`, error.stack);
      }
    }
  }

  private async sendNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    switch (channel.type) {
      case 'email':
        await this.sendEmailNotification(channel, alert);
        break;
      case 'slack':
        await this.sendSlackNotification(channel, alert);
        break;
      case 'webhook':
        await this.sendWebhookNotification(channel, alert);
        break;
      case 'pagerduty':
        await this.sendPagerDutyNotification(channel, alert);
        break;
    }
  }

  private async sendResolutionNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Similar to sendNotification but with resolution message
    const resolutionAlert = {
      ...alert,
      message: `RESOLVED: ${alert.message}`,
      status: 'resolved' as const,
    };
    
    await this.sendNotification(channel, resolutionAlert);
  }

  private async sendEmailNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would depend on email service
    this.logger.log(`Email notification sent for alert: ${alert.name}`);
  }

  private async sendSlackNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would use Slack webhook
    this.logger.log(`Slack notification sent for alert: ${alert.name}`);
  }

  private async sendWebhookNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would send HTTP POST to webhook URL
    this.logger.log(`Webhook notification sent for alert: ${alert.name}`);
  }

  private async sendPagerDutyNotification(channel: NotificationChannel, alert: Alert): Promise<void> {
    // Implementation would use PagerDuty API
    this.logger.log(`PagerDuty notification sent for alert: ${alert.name}`);
  }

  private generateAlertId(rule: AlertRule): string {
    return `${rule.id}-${new Date().toISOString().split('T')[0]}`;
  }

  private generateFingerprint(rule: AlertRule, value: number): string {
    return `${rule.id}-${value}-${rule.labels.team || 'default'}`;
  }

  private generateAlertMessage(rule: AlertRule, value: number): string {
    return `${rule.name}: Current value ${value} ${rule.condition.operator} threshold ${rule.threshold}`;
  }

  // Public API methods
  async getAlerts(filters: AlertFilters = {}): Promise<Alert[]> {
    let alerts = Array.from(this.alerts.values());

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.status) {
      alerts = alerts.filter(alert => alert.status === filters.status);
    }

    if (filters.ruleId) {
      alerts = alerts.filter(alert => alert.ruleId === filters.ruleId);
    }

    if (filters.startTime) {
      alerts = alerts.filter(alert => alert.timestamp >= filters.startTime);
    }

    if (filters.endTime) {
      alerts = alerts.filter(alert => alert.timestamp <= filters.endTime);
    }

    return alerts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getActiveAlerts(): Promise<Alert[]> {
    return this.getAlerts({ status: 'active' });
  }

  async getAlertRules(): Promise<AlertRule[]> {
    return Array.from(this.alertRules.values());
  }

  async createAlertRule(rule: Omit<AlertRule, 'id'>): Promise<AlertRule> {
    const newRule: AlertRule = {
      ...rule,
      id: this.generateId(),
    };

    this.alertRules.set(newRule.id, newRule);
    return newRule;
  }

  async updateAlertRule(id: string, updates: Partial<AlertRule>): Promise<AlertRule | null> {
    const rule = this.alertRules.get(id);
    if (!rule) return null;

    const updatedRule = { ...rule, ...updates };
    this.alertRules.set(id, updatedRule);
    return updatedRule;
  }

  async deleteAlertRule(id: string): Promise<boolean> {
    return this.alertRules.delete(id);
  }

  async acknowledgeAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'suppressed';
    return true;
  }

  async resolveAlert(alertId: string): Promise<boolean> {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();
    return true;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  // Cleanup method for graceful shutdown
  onModuleDestroy(): void {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
    }
  }
}