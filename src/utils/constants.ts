// Application constants

export const APP_CONFIG = {
  name: 'Atlas2',
  version: '1.0.0',
  description: 'CSV to API Mapping Tool',
  author: 'Ed Chan',
  repository: 'https://github.com/your-username/atlas2',
} as const;

export const API_CONFIG = {
  baseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001',
  timeout: parseInt(import.meta.env.VITE_API_TIMEOUT || '30000'),
  retryAttempts: 3,
  retryDelay: 1000,
} as const;

export const UPLOAD_CONFIG = {
  maxFileSize: parseInt(import.meta.env.VITE_MAX_FILE_SIZE || '3221225472'), // 3GB
  chunkSize: parseInt(import.meta.env.VITE_CHUNK_SIZE || '65536'), // 64KB
  supportedFormats: ['text/csv', 'application/csv', '.csv'],
  maxRetries: 3,
  retryDelay: 2000,
} as const;

export const PAGINATION_CONFIG = {
  defaultPageSize: 20,
  pageSizeOptions: [10, 20, 50, 100],
  maxPageSize: 100,
} as const;

export const NOTIFICATION_CONFIG = {
  defaultDuration: 5000,
  maxNotifications: 5,
  positions: ['topRight', 'topLeft', 'bottomRight', 'bottomLeft'] as const,
} as const;

export const THEME_CONFIG = {
  defaultTheme: 'light',
  storageKey: 'atlas2-theme',
  breakpoints: {
    xs: 480,
    sm: 576,
    md: 768,
    lg: 992,
    xl: 1200,
    xxl: 1600,
  },
} as const;

export const ROUTES = {
  home: '/',
  dashboard: '/dashboard',
  upload: '/upload',
  mapping: '/mapping',
  integration: '/integration',
  monitoring: '/monitoring',
  settings: '/settings',
  auth: {
    login: '/auth/login',
    register: '/auth/register',
    forgot: '/auth/forgot-password',
    reset: '/auth/reset-password',
  },
  api: {
    docs: '/api/docs',
    health: '/api/health',
  },
} as const;

export const STORAGE_KEYS = {
  authToken: 'atlas2-auth-token',
  refreshToken: 'atlas2-refresh-token',
  user: 'atlas2-user',
  theme: 'atlas2-theme',
  preferences: 'atlas2-preferences',
  recentFiles: 'atlas2-recent-files',
} as const;

export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Network error. Please check your connection.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  FORBIDDEN: 'You do not have permission to access this resource.',
  NOT_FOUND: 'The requested resource was not found.',
  SERVER_ERROR: 'Server error. Please try again later.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  FILE_TOO_LARGE: 'File size exceeds the maximum allowed limit.',
  INVALID_FILE_FORMAT: 'Invalid file format. Please upload a CSV file.',
  UPLOAD_FAILED: 'File upload failed. Please try again.',
  PROCESSING_FAILED: 'File processing failed. Please check the file format.',
  MAPPING_FAILED: 'Field mapping failed. Please check your configuration.',
  API_CONNECTION_FAILED: 'Failed to connect to the API. Please check the configuration.',
} as const;

export const SUCCESS_MESSAGES = {
  FILE_UPLOADED: 'File uploaded successfully.',
  FILE_PROCESSED: 'File processed successfully.',
  MAPPING_SAVED: 'Field mapping saved successfully.',
  API_CONFIG_SAVED: 'API configuration saved successfully.',
  API_TEST_SUCCESS: 'API connection test successful.',
  USER_UPDATED: 'Profile updated successfully.',
  PASSWORD_CHANGED: 'Password changed successfully.',
} as const;

export const VALIDATION_RULES = {
  username: {
    required: true,
    minLength: 3,
    maxLength: 50,
    pattern: /^[a-zA-Z0-9_-]+$/,
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  },
  password: {
    required: true,
    minLength: 8,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/,
  },
  apiUrl: {
    required: true,
    pattern: /^https?:\/\/.+/,
  },
} as const;

export const FIELD_TYPES = {
  STRING: 'string',
  NUMBER: 'number',
  BOOLEAN: 'boolean',
  DATE: 'date',
  EMAIL: 'email',
  URL: 'url',
  PHONE: 'phone',
  CURRENCY: 'currency',
  PERCENTAGE: 'percentage',
  CUSTOM: 'custom',
} as const;

export const TRANSFORMATION_TYPES = {
  DIRECT: 'direct',
  CONCATENATE: 'concatenate',
  SPLIT: 'split',
  FORMAT_DATE: 'format_date',
  FORMAT_NUMBER: 'format_number',
  LOOKUP: 'lookup',
  CONDITIONAL: 'conditional',
  CUSTOM: 'custom',
} as const;

export const AUTH_TYPES = {
  NONE: 'none',
  API_KEY: 'api_key',
  BASIC_AUTH: 'basic_auth',
  BEARER_TOKEN: 'bearer_token',
  OAUTH2: 'oauth2',
} as const;

export const USER_ROLES = {
  ADMIN: 'admin',
  USER: 'user',
  VIEWER: 'viewer',
} as const;

export const UPLOAD_STATUSES = {
  UPLOADING: 'uploading',
  UPLOADED: 'uploaded',
  VALIDATING: 'validating',
  VALIDATED: 'validated',
  FAILED: 'failed',
} as const;

export const PROCESSING_STATUSES = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
} as const;

export const DATE_FORMATS = {
  DISPLAY: 'MMM DD, YYYY HH:mm:ss',
  SHORT: 'MM/DD/YYYY',
  LONG: 'dddd, MMMM DD, YYYY',
  ISO: 'YYYY-MM-DDTHH:mm:ss.SSSZ',
  FILE_NAME: 'YYYY-MM-DD_HH-mm-ss',
} as const;

export const EXPORT_FORMATS = {
  CSV: 'csv',
  JSON: 'json',
  XML: 'xml',
  EXCEL: 'xlsx',
} as const;

export const CHART_COLORS = {
  primary: '#1890ff',
  success: '#52c41a',
  warning: '#faad14',
  error: '#ff4d4f',
  info: '#13c2c2',
  purple: '#722ed1',
  cyan: '#13c2c2',
  gray: '#8c8c8c',
} as const;