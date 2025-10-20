import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import app from '../../api/src/index';

describe('Atlas2 POC Integration Tests', () => {
  let server: any;
  let uploadedFileId: string;
  let importedSpecId: string;
  let authProfileId: string;

  beforeAll(async () => {
    // Start the test server
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    // Clean up test server
    if (server) {
      await new Promise<void>((resolve) => {
        server.close(() => {
          resolve();
        });
      });
    }
  });

  describe('POC Workflow: CSV Upload → API Import → Auth → Client Generation', () => {
    
    it('Step 1: Should handle CSV file upload', async () => {
      // Create a sample CSV content
      const csvContent = `name,email,age
John Doe,john@example.com,30
Jane Smith,jane@example.com,25
Bob Johnson,bob@example.com,35`;

      const response = await request(app)
        .post('/api/upload')
        .attach('csvFile', Buffer.from(csvContent), 'test.csv')
        .expect(202);

      expect(response.body).toHaveProperty('message', 'File uploaded successfully');
      expect(response.body).toHaveProperty('jobId');
      expect(response.body).toHaveProperty('filename', 'test.csv');
      
      uploadedFileId = response.body.jobId;
    });

    it('Step 2: Should check CSV processing status', async () => {
      // Wait a moment for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      const response = await request(app)
        .get(`/api/upload/status/${uploadedFileId}`)
        .expect(200);

      expect(response.body).toHaveProperty('jobId', uploadedFileId);
      expect(response.body).toHaveProperty('status');
      expect(['pending', 'processing', 'completed', 'failed']).toContain(response.body.status);
    });

    it('Step 3: Should import OpenAPI specification', async () => {
      const openApiSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Test API',
          version: '1.0.0',
          description: 'A test API for POC'
        },
        paths: {
          '/users': {
            get: {
              operationId: 'getUsers',
              summary: 'Get all users',
              responses: {
                '200': {
                  description: 'Successful response'
                }
              }
            },
            post: {
              operationId: 'createUser',
              summary: 'Create a user',
              responses: {
                '201': {
                  description: 'User created'
                }
              }
            }
          },
          '/users/{id}': {
            get: {
              operationId: 'getUserById',
              summary: 'Get user by ID',
              parameters: [
                {
                  name: 'id',
                  in: 'path',
                  required: true,
                  schema: { type: 'string' }
                }
              ],
              responses: {
                '200': {
                  description: 'Successful response'
                }
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/v1/openapi/import')
        .send({
          source: 'text',
          content: JSON.stringify(openApiSpec)
        })
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('endpointCount', 3);
      expect(response.body.data.summary).toHaveProperty('title', 'Test API');
      
      importedSpecId = response.body.data.id;
    });

    it('Step 4: Should create API Key authentication profile', async () => {
      const authProfile = {
        name: 'Test API Key Auth',
        type: 'api_key',
        config: {
          key: 'X-API-Key',
          value: 'test-api-key-12345',
          addTo: 'header',
          headerName: 'X-API-Key'
        }
      };

      const response = await request(app)
        .post('/auth/api-key/profiles')
        .send(authProfile)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', 'Test API Key Auth');
      expect(response.body.data).toHaveProperty('type', 'api_key');
      
      authProfileId = response.body.data.id;
    });

    it('Step 5: Should test authentication profile', async () => {
      const response = await request(app)
        .post(`/auth/api-key/profiles/${authProfileId}/test`)
        .send({})
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('success', true); // Test should pass for valid config
      expect(response.body.data).toHaveProperty('responseTime');
    });

    it('Step 6: Should generate API client', async () => {
      const clientRequest = {
        specId: importedSpecId,
        language: 'typescript',
        includeAuth: true,
        baseUrl: 'https://api.example.com',
        clientName: 'TestApiClient'
      };

      const response = await request(app)
        .post('/api/v1/openapi/generate-client')
        .send(clientRequest)
        .expect(201);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data).toHaveProperty('name', 'TestApiClient');
      expect(response.body.data).toHaveProperty('language', 'typescript');
      expect(response.body.data).toHaveProperty('code');
      expect(response.body.data).toHaveProperty('usage');
      expect(response.body.data).toHaveProperty('dependencies');

      // Verify generated code contains expected methods
      const generatedCode = response.body.data.code;
      expect(generatedCode).toContain('class TestApiClient');
      expect(generatedCode).toContain('getUsers');
      expect(generatedCode).toContain('createUser');
      expect(generatedCode).toContain('getUserById');
      expect(generatedCode).toContain('private baseUrl');
      expect(generatedCode).toContain('private async request');
    });

    it('Step 7: Should get authentication headers', async () => {
      const response = await request(app)
        .get(`/auth/api-key/profiles/${authProfileId}/headers`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('headers');
      expect(response.body.data).toHaveProperty('queryParams');
      expect(response.body.data.headers).toHaveProperty('X-API-Key', 'test-api-key-12345');
    });

    it('Step 8: Should validate OpenAPI specification', async () => {
      const validSpec = {
        openapi: '3.0.0',
        info: {
          title: 'Validation Test API',
          version: '1.0.0'
        },
        paths: {
          '/test': {
            get: {
              responses: {
                '200': { description: 'OK' }
              }
            }
          }
        }
      };

      const response = await request(app)
        .post('/api/v1/openapi/validate')
        .send({
          content: JSON.stringify(validSpec)
        })
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary).toHaveProperty('endpointCount', 1);
    });
  });

  describe('Error Handling', () => {
    it('Should handle invalid CSV upload', async () => {
      const response = await request(app)
        .post('/api/upload')
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('Should handle invalid OpenAPI spec', async () => {
      const response = await request(app)
        .post('/api/v1/openapi/import')
        .send({
          source: 'text',
          content: 'invalid json'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('Should handle invalid auth profile', async () => {
      const response = await request(app)
        .post('/auth/api-key/profiles')
        .send({
          name: 'Invalid Auth',
          type: 'invalid_type'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('API Documentation', () => {
    it('Should provide API documentation', async () => {
      const response = await request(app)
        .get('/api/docs')
        .expect(200);

      expect(response.body).toHaveProperty('title', 'Atlas2 API');
      expect(response.body).toHaveProperty('endpoints');
    });
  });
});