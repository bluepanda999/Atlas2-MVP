import { BaseEntity } from './common';

export interface ApiConfiguration extends BaseEntity {
  userId: string;
  name: string;
  description?: string;
  baseUrl: string;
  openApiSpec: OpenApiSpec;
  authType: AuthType;
  authConfig: AuthConfig;
  isActive: boolean;
  lastTestedAt?: Date;
  testStatus?: TestStatus;
}

export interface OpenApiSpec {
  openapi: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: ServerInfo[];
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, Schema>;
    securitySchemes?: Record<string, SecurityScheme>;
  };
  security?: SecurityRequirement[];
}

export interface ServerInfo {
  url: string;
  description?: string;
  variables?: Record<string, ServerVariable>;
}

export interface ServerVariable {
  enum?: string[];
  default: string;
  description?: string;
}

export interface PathItem {
  get?: Operation;
  post?: Operation;
  put?: Operation;
  delete?: Operation;
  patch?: Operation;
  parameters?: Parameter[];
}

export interface Operation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface Parameter {
  name: string;
  in: 'query' | 'header' | 'path' | 'cookie';
  description?: string;
  required?: boolean;
  schema: Schema;
}

export interface RequestBody {
  description?: string;
  content: Record<string, MediaType>;
  required?: boolean;
}

export interface Response {
  description: string;
  content?: Record<string, MediaType>;
  headers?: Record<string, Header>;
}

export interface MediaType {
  schema?: Schema;
  example?: any;
  examples?: Record<string, Example>;
}

export interface Schema {
  type?: string;
  format?: string;
  properties?: Record<string, Schema>;
  items?: Schema;
  required?: string[];
  enum?: any[];
  description?: string;
  example?: any;
}

export interface Header {
  description?: string;
  schema: Schema;
}

export interface Example {
  summary?: string;
  description?: string;
  value: any;
}

export interface SecurityScheme {
  type: 'apiKey' | 'http' | 'oauth2' | 'openIdConnect';
  description?: string;
  name?: string;
  in?: 'query' | 'header' | 'cookie';
  scheme?: string;
  bearerFormat?: string;
  flows?: OAuthFlows;
  openIdConnectUrl?: string;
}

export interface OAuthFlows {
  implicit?: OAuthFlow;
  password?: OAuthFlow;
  clientCredentials?: OAuthFlow;
  authorizationCode?: OAuthFlow;
}

export interface OAuthFlow {
  authorizationUrl?: string;
  tokenUrl?: string;
  refreshUrl?: string;
  scopes: Record<string, string>;
}

export interface SecurityRequirement {
  [key: string]: string[];
}

export enum AuthType {
  NONE = 'none',
  API_KEY = 'api_key',
  BASIC_AUTH = 'basic_auth',
  BEARER_TOKEN = 'bearer_token',
  OAUTH2 = 'oauth2'
}

export interface AuthConfig {
  apiKey?: ApiKeyAuth;
  basicAuth?: BasicAuth;
  bearerToken?: BearerTokenAuth;
  oauth2?: OAuth2Auth;
}

export interface ApiKeyAuth {
  key: string;
  value: string;
  addTo: 'header' | 'query';
  headerName?: string;
}

export interface BasicAuth {
  username: string;
  password: string;
}

export interface BearerTokenAuth {
  token: string;
}

export interface OAuth2Auth {
  clientId: string;
  clientSecret: string;
  scopes: string[];
  tokenUrl?: string;
  authorizationUrl?: string;
  redirectUri?: string;
}

export enum TestStatus {
  NOT_TESTED = 'not_tested',
  TESTING = 'testing',
  SUCCESS = 'success',
  FAILED = 'failed'
}

export interface ApiTest {
  id: string;
  apiConfigurationId: string;
  endpoint: string;
  method: string;
  testStatus: TestStatus;
  responseTime?: number;
  statusCode?: number;
  errorMessage?: string;
  testedAt: Date;
}

export interface EndpointInfo {
  path: string;
  method: string;
  summary?: string;
  operationId?: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  security?: SecurityRequirement[];
}

export interface ApiEndpoint extends BaseEntity {
  apiConfigurationId: string;
  path: string;
  method: string;
  summary?: string;
  description?: string;
  operationId?: string;
  parameters: Parameter[];
  requestBody?: RequestBody;
  responses: Record<string, Response>;
  isActive: boolean;
}