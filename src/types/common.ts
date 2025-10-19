// Common types used across the application

export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: string[];
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface ErrorDetails {
  field?: string;
  message: string;
  code?: string;
}

export interface Notification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  duration?: number;
  timestamp: Date;
}

export type SortOrder = 'asc' | 'desc';
export type SortField = string;

export interface SortConfig {
  field: SortField;
  order: SortOrder;
}

export interface FilterConfig {
  [key: string]: any;
}

export interface PaginationConfig {
  page: number;
  limit: number;
}

export interface ListConfig {
  sort?: SortConfig;
  filter?: FilterConfig;
  pagination?: PaginationConfig;
}