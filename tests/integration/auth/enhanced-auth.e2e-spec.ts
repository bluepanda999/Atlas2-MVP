import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../../src/app.module';

describe('Enhanced Authentication (e2e)', () => {
  let app: INestApplication;
  let accessToken: string;
  let refreshToken: string;
  let userId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('User Registration and Login', () => {
    it('should register a new user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
          role: 'user',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.user.email).toBe('test@example.com');
          expect(res.body.user).not.toHaveProperty('password');
          accessToken = res.body.token;
          refreshToken = res.body.refreshToken;
          userId = res.body.user.id;
        });
    });

    it('should not register duplicate user', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        })
        .expect(409);
    });

    it('should login with valid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'password123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('user');
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('refreshToken');
          accessToken = res.body.token;
          refreshToken = res.body.refreshToken;
        });
    });

    it('should not login with invalid credentials', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
        .expect(401);
    });
  });

  describe('Bearer Token Authentication', () => {
    it('should access protected route with valid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('email', 'test@example.com');
          expect(res.body).not.toHaveProperty('password');
        });
    });

    it('should not access protected route without token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .expect(401);
    });

    it('should not access protected route with invalid token', () => {
      return request(app.getHttpServer())
        .get('/auth/profile')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should test bearer authentication endpoint', () => {
      return request(app.getHttpServer())
        .get('/auth/bearer/test')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Bearer authentication successful');
          expect(res.body.auth.method).toBe('bearer');
        });
    });

    it('should refresh access token', () => {
      return request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
          expect(res.body).toHaveProperty('refreshToken');
          expect(res.body.token).not.toBe(accessToken);
          accessToken = res.body.token;
          refreshToken = res.body.refreshToken;
        });
    });

    it('should get active sessions', () => {
      return request(app.getHttpServer())
        .get('/auth/bearer/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBeGreaterThan(0);
        });
    });
  });

  describe('Basic Authentication', () => {
    it('should authenticate with valid basic credentials', () => {
      const credentials = Buffer.from('test@example.com:password123').toString('base64');
      
      return request(app.getHttpServer())
        .get('/auth/basic/test')
        .set('Authorization', `Basic ${credentials}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Basic authentication successful');
          expect(res.body.auth.method).toBe('basic');
          expect(res.body.user.email).toBe('test@example.com');
        });
    });

    it('should not authenticate with invalid basic credentials', () => {
      const credentials = Buffer.from('test@example.com:wrongpassword').toString('base64');
      
      return request(app.getHttpServer())
        .get('/auth/basic/test')
        .set('Authorization', `Basic ${credentials}`)
        .expect(401);
    });

    it('should not authenticate with malformed basic header', () => {
      return request(app.getHttpServer())
        .get('/auth/basic/test')
        .set('Authorization', 'Basic invalid-base64')
        .expect(401);
    });

    it('should get basic auth attempts', () => {
      return request(app.getHttpServer())
        .get('/auth/basic/attempts')
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Token Management', () => {
    it('should logout successfully', () => {
      return request(app.getHttpServer())
        .post('/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logout successful');
        });
    });

    it('should logout from all sessions', () => {
      return request(app.getHttpServer())
        .post('/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Logout from all sessions successful');
        });
    });

    it('should get blacklisted tokens', () => {
      return request(app.getHttpServer())
        .get('/auth/bearer/blacklist')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
        });
    });
  });

  describe('Profile Management', () => {
    it('should update user profile', () => {
      return request(app.getHttpServer())
        .post('/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Updated Name' })
        .expect(200)
        .expect((res) => {
          expect(res.body.name).toBe('Updated Name');
        });
    });

    it('should change password', () => {
      return request(app.getHttpServer())
        .post('/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'password123',
          newPassword: 'newpassword123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body.message).toBe('Password changed successfully');
        });
    });

    it('should login with new password', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({
          email: 'test@example.com',
          password: 'newpassword123',
        })
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('token');
          accessToken = res.body.token;
          refreshToken = res.body.refreshToken;
        });
    });
  });

  describe('Authentication Configuration', () => {
    it('should get auth configuration', () => {
      return request(app.getHttpServer())
        .get('/auth/config')
        .expect(200)
        .expect((res) => {
          expect(res.body).toHaveProperty('basic');
          expect(res.body).toHaveProperty('bearer');
          expect(res.body.basic).toHaveProperty('enabled');
          expect(res.body.bearer).toHaveProperty('accessTokenExpiry');
        });
    });

    it('should check authentication health', () => {
      return request(app.getHttpServer())
        .get('/auth/health')
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe('healthy');
          expect(res.body).toHaveProperty('services');
        });
    });
  });

  describe('Rate Limiting and Security', () => {
    it('should enforce rate limiting on basic auth', async () => {
      const credentials = Buffer.from('test@example.com:wrongpassword').toString('base64');
      
      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        await request(app.getHttpServer())
          .get('/auth/basic/test')
          .set('Authorization', `Basic ${credentials}`)
          .expect(i < 5 ? 401 : 429);
      }
    });

    it('should handle concurrent authentication requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        request(app.getHttpServer())
          .get('/auth/profile')
          .set('Authorization', `Bearer ${accessToken}`)
      );

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed JSON', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);
    });

    it('should handle missing required fields', () => {
      return request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
    });

    it('should handle invalid email format', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'invalid-email',
          password: 'password123',
          name: 'Test User',
        })
        .expect(400);
    });

    it('should handle password too short', () => {
      return request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: 'test2@example.com',
          password: '123',
          name: 'Test User',
        })
        .expect(400);
    });
  });
});