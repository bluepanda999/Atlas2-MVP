export interface MonitoringConfig {
  enabled: boolean;
  metrics: {
    enabled: boolean;
    port: number;
    path: string;
    collectDefaultMetrics: boolean;
    collectInterval: number;
  };
  health: {
    enabled: boolean;
    path: string;
    detailedPath: string;
    livenessPath: string;
    readinessPath: string;
  };
  alerting: {
    enabled: boolean;
    evaluationInterval: number;
    defaultRules: boolean;
    notificationChannels: {
      email: {
        enabled: boolean;
        recipients: string[];
        smtp?: {
          host: string;
          port: number;
          secure: boolean;
          auth: {
            user: string;
            pass: string;
          };
        };
      };
      slack: {
        enabled: boolean;
        webhookUrl?: string;
        channel?: string;
      };
      pagerduty: {
        enabled: boolean;
        integrationKey?: string;
      };
    };
  };
  logging: {
    level: 'error' | 'warn' | 'info' | 'debug';
    format: 'json' | 'text';
    structured: boolean;
    file: {
      enabled: boolean;
      path: string;
      maxSize: string;
      maxFiles: number;
      rotation: 'daily' | 'size';
    };
    console: {
      enabled: boolean;
      colorize: boolean;
    };
  };
  performance: {
    enabled: boolean;
    slowRequestThreshold: number;
    memoryTracking: boolean;
    detailedLogging: boolean;
    sampleRate: number;
    excludePaths: string[];
  };
  errorTracking: {
    enabled: boolean;
    maxErrors: number;
    ignoredErrors: string[];
    notifyOnCritical: boolean;
  };
  tracing: {
    enabled: boolean;
    jaeger?: {
      endpoint: string;
      serviceName: string;
    };
    zipkin?: {
      url: string;
      serviceName: string;
    };
  };
}

export const monitoringConfig: MonitoringConfig = {
  enabled: process.env.MONITORING_ENABLED !== 'false',
  
  metrics: {
    enabled: process.env.METRICS_ENABLED !== 'false',
    port: parseInt(process.env.METRICS_PORT || '9090'),
    path: process.env.METRICS_PATH || '/monitoring/metrics',
    collectDefaultMetrics: process.env.METRICS_COLLECT_DEFAULT !== 'false',
    collectInterval: parseInt(process.env.METRICS_COLLECT_INTERVAL || '30000'),
  },

  health: {
    enabled: process.env.HEALTH_ENABLED !== 'false',
    path: process.env.HEALTH_PATH || '/monitoring/health',
    detailedPath: process.env.HEALTH_DETAILED_PATH || '/monitoring/health/detailed',
    livenessPath: process.env.HEALTH_LIVENESS_PATH || '/monitoring/health/live',
    readinessPath: process.env.HEALTH_READINESS_PATH || '/monitoring/health/ready',
  },

  alerting: {
    enabled: process.env.ALERTING_ENABLED !== 'false',
    evaluationInterval: parseInt(process.env.ALERTING_EVALUATION_INTERVAL || '30000'),
    defaultRules: process.env.ALERTING_DEFAULT_RULES !== 'false',
    notificationChannels: {
      email: {
        enabled: process.env.ALERT_EMAIL_ENABLED === 'true',
        recipients: process.env.ALERT_EMAIL_RECIPIENTS?.split(',') || [],
        smtp: process.env.SMTP_HOST ? {
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER || '',
            pass: process.env.SMTP_PASS || '',
          },
        } : undefined,
      },
      slack: {
        enabled: process.env.SLACK_ENABLED === 'true',
        webhookUrl: process.env.SLACK_WEBHOOK_URL,
        channel: process.env.SLACK_CHANNEL || '#alerts',
      },
      pagerduty: {
        enabled: process.env.PAGERDUTY_ENABLED === 'true',
        integrationKey: process.env.PAGERDUTY_INTEGRATION_KEY,
      },
    },
  },

  logging: {
    level: (process.env.LOG_LEVEL as any) || 'info',
    format: process.env.LOG_FORMAT === 'text' ? 'text' : 'json',
    structured: process.env.LOG_STRUCTURED === 'true',
    file: {
      enabled: process.env.LOG_FILE_ENABLED !== 'false',
      path: process.env.LOG_FILE_PATH || './logs/app.log',
      maxSize: process.env.LOG_FILE_MAX_SIZE || '10MB',
      maxFiles: parseInt(process.env.LOG_FILE_MAX_FILES || '5'),
      rotation: (process.env.LOG_FILE_ROTATION as any) || 'daily',
    },
    console: {
      enabled: process.env.LOG_CONSOLE_ENABLED !== 'false',
      colorize: process.env.LOG_CONSOLE_COLORIZE === 'true',
    },
  },

  performance: {
    enabled: process.env.PERFORMANCE_MONITORING_ENABLED !== 'false',
    slowRequestThreshold: parseInt(process.env.SLOW_REQUEST_THRESHOLD || '1000'),
    memoryTracking: process.env.PERFORMANCE_MEMORY_TRACKING === 'true',
    detailedLogging: process.env.PERFORMANCE_DETAILED_LOGGING === 'true',
    sampleRate: parseFloat(process.env.PERFORMANCE_SAMPLE_RATE || '1.0'),
    excludePaths: [
      '/health',
      '/health/live',
      '/health/ready',
      '/monitoring/metrics',
      '/favicon.ico',
      ...(process.env.PERFORMANCE_EXCLUDE_PATHS?.split(',') || []),
    ],
  },

  errorTracking: {
    enabled: process.env.ERROR_TRACKING_ENABLED !== 'false',
    maxErrors: parseInt(process.env.ERROR_TRACKING_MAX_ERRORS || '10000'),
    ignoredErrors: [
      'ECONNRESET',
      'ETIMEDOUT',
      'HPE_INVALID_CONSTANT',
      'ERR_HTTP_HEADERS_SENT',
      ...(process.env.ERROR_TRACKING_IGNORED?.split(',') || []),
    ],
    notifyOnCritical: process.env.ERROR_TRACKING_NOTIFY_CRITICAL !== 'false',
  },

  tracing: {
    enabled: process.env.TRACING_ENABLED === 'true',
    jaeger: process.env.JAEGER_ENDPOINT ? {
      endpoint: process.env.JAEGER_ENDPOINT,
      serviceName: process.env.JAEGER_SERVICE_NAME || 'atlas2-api',
    } : undefined,
    zipkin: process.env.ZIPKIN_URL ? {
      url: process.env.ZIPKIN_URL,
      serviceName: process.env.ZIPKIN_SERVICE_NAME || 'atlas2-api',
    } : undefined,
  },
};