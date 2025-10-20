import { BaseEntity } from './common';

export interface ApiConfiguration extends BaseEntity {
  userId: string;
  name: string;
  description?: string;
  type: IntegrationType;
  baseUrl: string;
  authType: AuthType;
  authConfig: AuthConfig;
  headers: Record<string, string>;
  isActive: boolean;
}

export enum IntegrationType {
  REST_API = 'rest_api',
  WEBHOOK = 'webhook',
  DATABASE = 'database'
}

export enum AuthType {
  API_KEY = 'api_key',
  BEARER_TOKEN = 'bearer_token',
  BASIC_AUTH = 'basic_auth',
  OAUTH2 = 'oauth2'
}

export interface AuthConfig {
  apiKey?: string;
  apiKeyHeader?: string;
  bearerToken?: string;
  username?: string;
  password?: string;
  clientId?: string;
  clientSecret?: string;
  oauthUrl?: string;
  scopes?: string[];
  [key: string]: any;
}

export interface ApiField extends BaseEntity {
  apiConfigId: string;
  name: string;
  type: string;
  description?: string;
  required: boolean;
  format?: string;
  validationRules: ApiValidationRule[];
}

export interface ApiValidationRule {
  type: string;
  config: Record<string, any>;
  message?: string;
}

export interface Integration extends BaseEntity {
  userId: string;
  name: string;
  description?: string;
  apiConfigurationId: string;
  status: IntegrationStatus;
  lastSyncAt?: Date;
  syncFrequency?: number; // in minutes
  config: IntegrationConfig;
}

export enum IntegrationStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error',
  SYNCING = 'syncing'
}

export interface IntegrationConfig {
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  params?: Record<string, any>;
  retryConfig?: RetryConfig;
  webhookConfig?: WebhookConfig;
}

export interface RetryConfig {
  maxRetries: number;
  retryDelay: number; // in milliseconds
  backoffMultiplier: number;
  maxRetryDelay: number; // in milliseconds
}

export interface WebhookConfig {
  url: string;
  events: string[];
  secret?: string;
  active: boolean;
}

export interface IntegrationTest {
  id: string;
  apiConfigurationId: string;
  testType: TestType;
  request: TestRequest;
  expectedResponse?: TestResponse;
  actualResponse?: TestResponse;
  status: TestStatus;
  error?: string;
  executedAt?: Date;
}

export enum TestType {
  CONNECTION = 'connection',
  AUTHENTICATION = 'authentication',
  ENDPOINT = 'endpoint',
  WEBHOOK = 'webhook'
}

export enum TestStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PASSED = 'passed',
  FAILED = 'failed'
}

export interface TestRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, any>;
}

export interface TestResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  responseTime: number; // in milliseconds
}

export interface IntegrationLog extends BaseEntity {
  integrationId: string;
  level: LogLevel;
  message: string;
  details?: Record<string, any>;
  requestId?: string;
  userId?: string;
}

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

export interface IntegrationMetrics {
  integrationId: string;
  date: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  errorRate: number;
  lastRequestAt?: Date;
  lastErrorAt?: Date;
}

export interface IntegrationTemplate extends BaseEntity {
  name: string;
  description?: string;
  category: string;
  type: IntegrationType;
  config: ApiConfiguration;
  isPublic: boolean;
  usageCount: number;
  tags: string[];
}

export interface WebhookEvent {
  id: string;
  integrationId: string;
  eventType: string;
  payload: Record<string, any>;
  headers: Record<string, string>;
  receivedAt: Date;
  processedAt?: Date;
  status: WebhookStatus;
  error?: string;
}

export enum WebhookStatus {
  RECEIVED = 'received',
  PROCESSING = 'processing',
  PROCESSED = 'processed',
  FAILED = 'failed'
}

export interface ApiConfigurationRequest {
  name: string;
  description?: string;
  type: IntegrationType;
  baseUrl: string;
  authType: AuthType;
  authConfig: AuthConfig;
  headers?: Record<string, string>;
}

export interface ApiConfigurationResponse {
  apiConfiguration: ApiConfiguration;
  fields: ApiField[];
  testResults?: IntegrationTest[];
}

export interface IntegrationRequest {
  name: string;
  description?: string;
  apiConfigurationId: string;
  config: IntegrationConfig;
  syncFrequency?: number;
}

export interface IntegrationResponse {
  integration: Integration;
  apiConfiguration: ApiConfiguration;
  lastTest?: IntegrationTest;
  metrics?: IntegrationMetrics;
}