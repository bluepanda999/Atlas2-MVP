/**
 * Integration Marketplace Types
 * Based on Epic 9: Integration Marketplace Stories 9.1-9.4
 */

// Base Types
export interface Integration {
  id: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  tags: string[];
  authenticationTypes: AuthType[];
  features: string[];
  popularity: number;
  rating: number;
  downloadCount: number;
  lastUpdated: Date;
  isCommunity?: boolean;
  contributorId?: string;
}

export interface IntegrationDetail extends Integration {
  apiSpec: any; // OpenAPI Spec
  configurationSchema: any; // JSON Schema
  documentation: string;
  examples: IntegrationExample[];
  version: string;
  changelog: string;
  installationCount?: number;
  reviews?: Review[];
}

export interface IntegrationExample {
  name: string;
  description: string;
  configuration: Record<string, any>;
  code?: string;
}

export interface IntegrationInstallation {
  id: string;
  integrationId: string;
  userId: string;
  configuration: Record<string, any>;
  name: string;
  clientId: string;
  installedAt: Date;
  status: "active" | "inactive" | "error";
}

// Categories
export enum IntegrationCategory {
  CRM = "crm",
  COMMUNICATION = "communication",
  PRODUCTIVITY = "productivity",
  ECOMMERCE = "ecommerce",
  SOCIAL_MEDIA = "social_media",
  ANALYTICS = "analytics",
  STORAGE = "storage",
  DEVELOPMENT = "development",
  PAYMENTS = "payments",
  MARKETING = "marketing",
}

export enum AuthType {
  API_KEY = "api_key",
  OAUTH2 = "oauth2",
  BASIC_AUTH = "basic_auth",
  BEARER_TOKEN = "bearer_token",
  CUSTOM = "custom",
}

// Template System (Story 9.2)
export interface Template {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  version: string;
  schema: any; // JSON Schema
  authenticationTypes: AuthType[];
  features: string[];
  isBuiltIn: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface TemplateDetail extends Template {
  configuration: TemplateConfiguration;
  examples: TemplateExample[];
  documentation: string;
  dependencies: string[];
  inheritance: TemplateInheritance;
}

export interface TemplateConfiguration {
  parameters: TemplateParameter[];
  authentication: AuthenticationConfig;
  endpoints: EndpointTemplate[];
  transformations: TransformationTemplate[];
  errorHandling: ErrorHandlingConfig;
}

export interface TemplateParameter {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required: boolean;
  default?: any;
  description: string;
  validation?: ValidationRule[];
}

export interface TemplateExample {
  name: string;
  description: string;
  configuration: Record<string, any>;
  result?: any;
}

export enum TemplateCategory {
  CRUD = "crud",
  AUTHENTICATION = "authentication",
  TRANSFORMATION = "transformation",
  WEBHOOK = "webhook",
  BATCH = "batch",
  REALTIME = "realtime",
}

export interface TemplateInheritance {
  parent?: string;
  overrides?: Record<string, any>;
  mixins?: string[];
}

// Community Connectors (Story 9.3)
export interface ConnectorSubmission {
  id: string;
  contributorId: string;
  name: string;
  description: string;
  category: IntegrationCategory;
  tags: string[];
  openApiSpec: any;
  configurationSchema: any;
  documentation: string;
  examples: IntegrationExample[];
  version: string;
  changelog: string;
  license: string;
  repositoryUrl?: string;
  status: SubmissionStatus;
  submittedAt: Date;
  securityScanResults?: SecurityScanResult;
  validationResults?: ValidationResult;
  reviews?: Review[];
}

export enum SubmissionStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  SCANNING = "scanning",
  REVIEW_PENDING = "review_pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  PUBLISHED = "published",
}

export interface SecurityScanResult {
  status: "passed" | "warning" | "failed";
  vulnerabilities: Vulnerability[];
  securityIssues: SecurityIssue[];
  recommendations: string[];
  scannedAt: Date;
  scanVersion: string;
}

export interface Vulnerability {
  type: string;
  severity: "low" | "medium" | "high" | "critical";
  description: string;
  location?: string;
}

export interface SecurityIssue {
  type: string;
  severity: "low" | "medium" | "high";
  description: string;
  recommendation: string;
}

export interface Review {
  id: string;
  reviewerId: string;
  submissionId: string;
  status: "pending" | "approved" | "rejected" | "needs_changes";
  comments: string;
  rating: number;
  reviewedAt: Date;
}

export interface ContributorReputation {
  userId: string;
  points: number;
  level: ReputationLevel;
  badges: Badge[];
  contributionsCount: number;
  approvedContributions: number;
  averageRating: number;
}

export enum ReputationLevel {
  BEGINNER = "beginner",
  CONTRIBUTOR = "contributor",
  TRUSTED = "trusted",
  EXPERT = "expert",
  MASTER = "master",
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: Date;
}

// Testing Tools (Story 9.4)
export interface TestResult {
  id: string;
  integrationId: string;
  testType: TestType;
  status: TestStatus;
  startedAt: Date;
  completedAt?: Date;
  duration?: number;
  result: TestResultData;
  errors: TestError[];
  warnings: TestWarning[];
  metadata: Record<string, any>;
}

export enum TestType {
  CONNECTIVITY = "connectivity",
  PERFORMANCE = "performance",
  SCHEMA_VALIDATION = "schema_validation",
  SECURITY = "security",
  REGRESSION = "regression",
}

export enum TestStatus {
  PENDING = "pending",
  RUNNING = "running",
  PASSED = "passed",
  FAILED = "failed",
  WARNING = "warning",
  CANCELLED = "cancelled",
}

export interface TestResultData {
  [key: string]: any;
}

export interface TestError {
  type: string;
  message: string;
  details?: any;
}

export interface TestWarning {
  type: string;
  message: string;
  details?: any;
}

export interface ConnectivityTestResult {
  endpoints: EndpointTestResult[];
  authentication: AuthenticationTestResult;
  overall: {
    successRate: number;
    totalEndpoints: number;
    successfulEndpoints: number;
    failedEndpoints: number;
  };
}

export interface EndpointTestResult {
  endpoint: string;
  status: TestStatus;
  responseTime: number;
  statusCode: number;
  validation: ValidationResult;
  errors: TestError[];
}

export interface AuthenticationTestResult {
  status: TestStatus;
  responseTime: number;
  errors: TestError[];
}

export interface PerformanceTestResult {
  responseTime: {
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
    duration: number;
  };
  errorRate: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
}

// Common Types
export interface ValidationResult {
  valid: boolean;
  errors?: ValidationError[];
  warnings?: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationWarning {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationRule {
  type: string;
  params?: Record<string, any>;
}

export interface AuthenticationConfig {
  type: AuthType;
  [key: string]: any;
}

export interface EndpointTemplate {
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters?: any[];
  requestBody?: any;
  responses?: any;
  security?: any[];
}

export interface TransformationTemplate {
  type: string;
  source: string;
  target: string;
  rules: TransformationRule[];
}

export interface TransformationRule {
  source: string;
  target: string;
  transformation: string;
}

export interface ErrorHandlingConfig {
  retryAttempts: number;
  retryDelay: number;
  fallbackStrategy: string;
  errorMapping: Record<string, string>;
}

// API Request/Response Types
export interface IntegrationFilters {
  category?: IntegrationCategory;
  authType?: AuthType;
  search?: string;
  sort?: "popularity" | "rating" | "updated" | "name";
  isCommunity?: boolean;
}

export interface TemplateConfig {
  name?: string;
  description?: string;
  version?: string;
  [key: string]: any;
}

export interface PerformanceTestConfig {
  duration?: number;
  concurrentRequests?: number;
  requestsPerBatch?: number;
  delayBetweenRequests?: number;
  endpoints?: string[];
  rampUpTime?: number;
}

export interface TestSuiteConfig {
  includeConnectivity: boolean;
  includePerformance: boolean;
  includeSchemaValidation: boolean;
  includeSecurity: boolean;
  performanceConfig?: PerformanceTestConfig;
}

export interface InstallationResult {
  clientId: string;
  integrationId: string;
  status: "success" | "error";
  message: string;
  errors?: string[];
}

export interface TemplateResult {
  openApiSpec: any;
  clientConfig: any;
  authConfig: any;
  endpoints: any[];
  transformations: any[];
}

// UI State Types
export interface IntegrationsState {
  // Catalog
  integrations: Integration[];
  loading: boolean;
  filters: IntegrationFilters;
  selectedIntegration?: IntegrationDetail;

  // Templates
  templates: Template[];
  selectedTemplate?: TemplateDetail;
  templateConfiguration: Record<string, any>;

  // Community
  submissions: ConnectorSubmission[];
  contributorReputation?: ContributorReputation;

  // Testing
  testResults: TestResult[];
  activeTests: TestResult[];

  // User's installations
  installations: IntegrationInstallation[];
}

export interface IntegrationsActions {
  // Catalog actions
  loadIntegrations: (filters?: IntegrationFilters) => Promise<void>;
  selectIntegration: (integration: Integration) => Promise<void>;
  installIntegration: (
    integrationId: string,
    config: any,
  ) => Promise<InstallationResult>;

  // Template actions
  loadTemplates: (category?: TemplateCategory) => Promise<void>;
  selectTemplate: (template: Template) => Promise<void>;
  applyTemplate: (
    templateId: string,
    config: TemplateConfig,
  ) => Promise<TemplateResult>;
  validateTemplate: (
    templateId: string,
    config: TemplateConfig,
  ) => Promise<ValidationResult>;

  // Community actions
  submitConnector: (
    submission: Partial<ConnectorSubmission>,
  ) => Promise<ConnectorSubmission>;
  loadSubmissions: (status?: SubmissionStatus) => Promise<void>;

  // Testing actions
  runConnectivityTest: (integrationId: string) => Promise<string>;
  runPerformanceTest: (
    integrationId: string,
    config: PerformanceTestConfig,
  ) => Promise<string>;
  runTestSuite: (
    integrationId: string,
    config: TestSuiteConfig,
  ) => Promise<string>;
  loadTestResults: (integrationId: string) => Promise<void>;

  // Installation management
  loadInstallations: () => Promise<void>;
  uninstallIntegration: (installationId: string) => Promise<void>;
}
