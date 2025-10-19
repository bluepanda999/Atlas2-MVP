import { Request, Response, NextFunction } from 'express';
import { jest } from '@jest/globals';

// Mock Express request/response
export const mockRequest = (overrides: Partial<Request> = {}): Request => {
  return {
    body: {},
    params: {},
    query: {},
    headers: {},
    method: 'GET',
    url: '/',
    ...overrides,
  } as Request;
};

export const mockResponse = (): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

export const mockNext = (): NextFunction => {
  return jest.fn();
};

// Database test utilities
export const createTestDatabase = () => {
  const mockClient = {
    query: jest.fn(),
    connect: jest.fn(),
    end: jest.fn(),
    release: jest.fn(),
  };

  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    query: jest.fn(),
    end: jest.fn(),
  };

  return { mockClient, mockPool };
};

// Redis test utilities
export const createTestRedis = () => {
  const mockRedis = {
    get: jest.fn(),
    set: jest.fn(),
    del: jest.fn(),
    exists: jest.fn(),
    expire: jest.fn(),
    flushall: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    isReady: true,
  };

  return mockRedis;
};

// File system test utilities
export const createTestFile = (content: string = 'test content'): Buffer => {
  return Buffer.from(content);
};

export const createTestCsv = (rows: Record<string, any>[]): string => {
  if (rows.length === 0) return '';
  
  const headers = Object.keys(rows[0]);
  const csvRows = [
    headers.join(','),
    ...rows.map(row => 
      headers.map(header => {
        const value = row[header];
        return typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value;
      }).join(',')
    )
  ];
  
  return csvRows.join('\n');
};

// JWT test utilities
export const createTestToken = (payload: any = {}): string => {
  return 'test.jwt.token';
};

export const createTestUser = (overrides: Partial<any> = {}) => {
  return {
    id: 'test-user-id',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

// CSV processing test utilities
export const createTestJob = (overrides: Partial<any> = {}) => {
  return {
    id: 'test-job-id',
    type: 'csv-processing',
    status: 'pending',
    data: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
};

// Wait utilities
export const sleep = (ms: number): Promise<void> => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

// Async test utilities
export const waitFor = async (
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> => {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await sleep(interval);
  }
  
  throw new Error(`Condition not met within ${timeout}ms`);
};

// Error test utilities
export const createTestError = (message: string = 'Test error'): Error => {
  return new Error(message);
};

export const expectError = async (fn: () => Promise<any>, expectedMessage?: string): Promise<void> => {
  try {
    await fn();
    fail('Expected function to throw an error');
  } catch (error) {
    if (expectedMessage) {
      expect(error.message).toContain(expectedMessage);
    }
  }
};

// Environment test utilities
export const setTestEnv = (env: Record<string, string>): void => {
  Object.entries(env).forEach(([key, value]) => {
    process.env[key] = value;
  });
};

export const clearTestEnv = (keys: string[]): void => {
  keys.forEach(key => {
    delete process.env[key];
  });
};

// Mock data generators
export const generateRandomString = (length: number = 10): string => {
  return Math.random().toString(36).substring(2, length + 2);
};

export const generateRandomEmail = (): string => {
  return `${generateRandomString()}@example.com`;
};

export const generateRandomNumber = (min: number = 0, max: number = 100): number => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};