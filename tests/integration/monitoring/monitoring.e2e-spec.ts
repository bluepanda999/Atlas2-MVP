import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MonitoringModule } from '../../../src/modules/monitoring/monitoring.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ApiKeyConfig } from '../../../src/entities/api-key-config.entity';
import { UploadSession } from '../../../src/entities/upload-session.entity';

describe('Monitoring Endpoints (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [ApiKeyConfig, UploadSession],
          synchronize: true,
        }),
        MonitoringModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('/monitoring/metrics (GET)', () => {
    it('should return Prometheus metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200)
        .expect('Content-Type', /text\/plain/)
        .expect((res) => {
          expect(res.text).toContain('http_requests_total');
          expect(res.text).toContain('process_uptime_seconds');
        });
    });
  });

  describe('/monitoring/health (GET)', () => {
    it('should return health status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('checks');
          expect(['healthy', 'unhealthy', 'degraded']).toContain(res.body.status);
        });
    });
  });

  describe('/monitoring/health/live (GET)', () => {
    it('should return liveness status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health/live')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status', 'ok');
          expect(res.body).toHaveProperty('timestamp');
        });
    });
  });

  describe('/monitoring/health/ready (GET)', () => {
    it('should return readiness status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health/ready')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('checks');
        });
    });
  });

  describe('/monitoring/health/detailed (GET)', () => {
    it('should return detailed health information', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health/detailed')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('system');
          expect(res.body).toHaveProperty('performance');
          expect(res.body.system).toHaveProperty('platform');
          expect(res.body.system).toHaveProperty('nodeVersion');
        });
    });
  });

  describe('/monitoring/alerts (GET)', () => {
    it('should return alerts list', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should support filtering by severity', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts?severity=critical')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });

    it('should support filtering by status', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts?status=active')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('/monitoring/alerts/rules (GET)', () => {
    it('should return alert rules', () => {
      return request(app.getHttpServer())
        .get('/monitoring/alerts/rules')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          if (res.body.length > 0) {
            expect(res.body[0]).toHaveProperty('id');
            expect(res.body[0]).toHaveProperty('name');
            expect(res.body[0]).toHaveProperty('enabled');
            expect(res.body[0]).toHaveProperty('severity');
          }
        });
    });
  });

  describe('/monitoring/logs (GET)', () => {
    it('should return logs list', () => {
      return request(app.getHttpServer())
        .get('/monitoring/logs')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('logs');
          expect(res.body).toHaveProperty('total');
          expect(Array.isArray(res.body.logs)).toBe(true);
        });
    });

    it('should support filtering by level', () => {
      return request(app.getHttpServer())
        .get('/monitoring/logs?level=error')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('logs');
          expect(res.body).toHaveProperty('total');
        });
    });

    it('should support pagination', () => {
      return request(app.getHttpServer())
        .get('/monitoring/logs?limit=10&offset=0')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('logs');
          expect(res.body).toHaveProperty('total');
          expect(res.body.logs.length).toBeLessThanOrEqual(10);
        });
    });
  });

  describe('/monitoring/performance (GET)', () => {
    it('should return performance metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/performance')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('system');
          expect(res.body).toHaveProperty('prometheusMetrics');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body.system).toHaveProperty('uptime');
          expect(res.body.system).toHaveProperty('memoryUsage');
        });
    });
  });

  describe('/monitoring/status (GET)', () => {
    it('should return system status overview', () => {
      return request(app.getHttpServer())
        .get('/monitoring/status')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('status');
          expect(res.body).toHaveProperty('timestamp');
          expect(res.body).toHaveProperty('uptime');
          expect(res.body).toHaveProperty('version');
          expect(res.body).toHaveProperty('health');
          expect(res.body).toHaveProperty('alerts');
          expect(res.body).toHaveProperty('metrics');
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid query parameters gracefully', () => {
      return request(app.getHttpServer())
        .get('/monitoring/logs?limit=invalid')
        .expect(200);
    });

    it('should handle non-existent endpoints', () => {
      return request(app.getHttpServer())
        .get('/monitoring/nonexistent')
        .expect(404);
    });
  });

  describe('Performance Tests', () => {
    it('should respond to metrics endpoint quickly', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(1000); // Should respond within 1 second
    });

    it('should respond to health endpoint quickly', async () => {
      const start = Date.now();
      await request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200);
      const duration = Date.now() - start;
      expect(duration).toBeLessThan(500); // Should respond within 500ms
    });
  });

  describe('Security Tests', () => {
    it('should not expose sensitive information in health endpoint', () => {
      return request(app.getHttpServer())
        .get('/monitoring/health')
        .expect(200)
        .expect((res) => {
          // Should not contain passwords, tokens, or other sensitive data
          const responseText = JSON.stringify(res.body);
          expect(responseText).not.toMatch(/password/i);
          expect(responseText).not.toMatch(/secret/i);
          expect(responseText).not.toMatch(/token/i);
        });
    });

    it('should not expose sensitive information in metrics', () => {
      return request(app.getHttpServer())
        .get('/monitoring/metrics')
        .expect(200)
        .expect((res) => {
          // Should not contain passwords, tokens, or other sensitive data
          expect(res.text).not.toMatch(/password/i);
          expect(res.text).not.toMatch(/secret/i);
          expect(res.text).not.toMatch(/token/i);
        });
    });
  });
});