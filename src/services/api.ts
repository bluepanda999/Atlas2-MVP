import { ApiResponse, PaginatedResponse } from "../types/common";
import { API_CONFIG, STORAGE_KEYS } from "../utils/constants";
import { storage } from "../utils/helpers";

// API client configuration
interface ApiClientConfig {
  baseUrl: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

class ApiClient {
  private config: ApiClientConfig;
  private baseURL: string;

  constructor(config: Partial<ApiClientConfig> = {}) {
    // Check for dynamically stored base URL first
    const storedBaseUrl =
      typeof window !== "undefined"
        ? window.localStorage.getItem("atlas2-api-base-url")
        : null;

    this.config = {
      ...API_CONFIG,
      ...config,
      baseUrl: storedBaseUrl || config.baseUrl || API_CONFIG.baseUrl,
    };
    this.baseURL = this.config.baseUrl;
  }

  // Method to update base URL dynamically
  setBaseUrl(baseUrl: string) {
    this.baseURL = baseUrl;
    this.config.baseUrl = baseUrl;
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlas2-api-base-url", baseUrl);
    }
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    // DEVELOPMENT BYPASS: Return mock responses for development (can be disabled with env var)
    if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_MOCK !== "true") {
      return this.mockResponse<T>(endpoint, options);
    }

    const url = `${this.baseURL}${endpoint}`;
    const token = storage.get<string>(STORAGE_KEYS.authToken);

    const defaultHeaders: HeadersInit = {
      "Content-Type": "application/json",
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
      signal: AbortSignal.timeout(this.config.timeout),
    };

    let lastError: Error;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const response = await fetch(url, config);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(
            errorData.message ||
              `HTTP ${response.status}: ${response.statusText}`,
          );
          (error as any).status = response.status;
          (error as any).data = errorData;
          throw error;
        }

        // Handle empty responses
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await response.json();
        } else {
          return {} as T;
        }
      } catch (error) {
        lastError = error as Error;

        // Don't retry on authentication errors or client errors (4xx)
        if ((error as any).status >= 400 && (error as any).status < 500) {
          break;
        }

        // Don't retry on the last attempt
        if (attempt === this.config.retryAttempts) {
          break;
        }

        // Wait before retrying
        await new Promise((resolve) =>
          setTimeout(resolve, this.config.retryDelay * attempt),
        );
      }
    }

    throw lastError!;
  }

  // Mock response handler for development
  private async mockResponse<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<T> {
    // Simulate network delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Mock upload endpoint
    if (endpoint.includes("/upload/upload") && options.method === "POST") {
      const mockJob = {
        id: `job-${Date.now()}`,
        fileName: "test.csv",
        fileSize: 1024,
        status: "completed",
        progress: 100,
        totalRecords: 100,
        recordsProcessed: 100,
        createdAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
      };
      return mockJob as T;
    }

    // Mock upload history
    if (endpoint.includes("/upload/jobs") && options.method === "GET") {
      const mockHistory = [
        {
          id: "job-1",
          fileName: "test.csv",
          fileSize: 1024,
          status: "completed",
          progress: 100,
          totalRecords: 100,
          recordsProcessed: 100,
          createdAt: new Date().toISOString(),
        },
      ];
      return { data: mockHistory } as T;
    }

    // Mock job status
    if (endpoint.includes("/upload/jobs/") && options.method === "GET") {
      const mockJob = {
        id: "job-1",
        fileName: "test.csv",
        fileSize: 1024,
        status: "completed",
        progress: 100,
        totalRecords: 100,
        recordsProcessed: 100,
        createdAt: new Date().toISOString(),
      };
      return mockJob as T;
    }

    // Default mock response
    return { success: true, data: null } as T;
  }

  // HTTP methods
  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    const url = new URL(endpoint, this.baseURL);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return this.request<T>(url.pathname + url.search);
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: "PATCH",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, {
      method: "DELETE",
    });
  }

  // File upload
  async upload<T>(
    endpoint: string,
    file: File,
    additionalData?: Record<string, any>,
  ): Promise<T> {
    // DEVELOPMENT BYPASS: Return mock responses for development (can be disabled with env var)
    if (import.meta.env.DEV && import.meta.env.VITE_DISABLE_MOCK !== "true") {
      // Mock upload response
      if (endpoint.includes("/upload/upload")) {
        const mockJob = {
          id: `job-${Date.now()}`,
          fileName: file.name,
          fileSize: file.size,
          status: "completed",
          progress: 100,
          totalRecords: 100,
          recordsProcessed: 100,
          createdAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
        };
        return mockJob as T;
      }
    }

    const formData = new FormData();
    formData.append("file", file);

    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value));
      });
    }

    const token = storage.get<string>(STORAGE_KEYS.authToken);
    const headers: HeadersInit = {
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      body: formData,
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
      (error as any).status = response.status;
      (error as any).data = errorData;
      throw error;
    }

    return response.json();
  }

  // Download file
  async download(endpoint: string, filename?: string): Promise<void> {
    const token = storage.get<string>(STORAGE_KEYS.authToken);
    const headers: HeadersInit = {
      ...(token && { Authorization: `Bearer ${token}` }),
    };

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      headers,
      signal: AbortSignal.timeout(this.config.timeout),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(
        errorData.message || `HTTP ${response.status}: ${response.statusText}`,
      );
      (error as any).status = response.status;
      throw error;
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = filename || "download";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(downloadUrl);
  }
}

// Create singleton instance
export const apiClient = new ApiClient();

// API service classes
export class AuthService {
  async login(credentials: { username: string; password: string }) {
    return apiClient.post("/auth/login", credentials);
  }

  async register(userData: {
    username: string;
    email: string;
    password: string;
  }) {
    return apiClient.post("/auth/register", userData);
  }

  async logout() {
    return apiClient.post("/auth/logout");
  }

  async refreshToken(refreshToken: string) {
    return apiClient.post("/auth/refresh", { refreshToken });
  }

  async forgotPassword(email: string) {
    return apiClient.post("/auth/forgot-password", { email });
  }

  async resetPassword(token: string, password: string) {
    return apiClient.post("/auth/reset-password", { token, password });
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return apiClient.post("/auth/change-password", {
      currentPassword,
      newPassword,
    });
  }

  async getProfile() {
    return apiClient.get("/auth/profile");
  }

  async updateProfile(userData: Partial<{ username: string; email: string }>) {
    return apiClient.put("/auth/profile", userData);
  }
}

export class UploadService {
  async uploadFile(file: File, metadata?: any) {
    return apiClient.upload("/upload/upload", file, metadata);
  }

  async getUploads(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    return apiClient.get<PaginatedResponse>("/upload/jobs", params);
  }

  async getUpload(id: string) {
    return apiClient.get(`/upload/jobs/${id}`);
  }

  async deleteUpload(id: string) {
    return apiClient.delete(`/upload/jobs/${id}`);
  }

  async getUploadProgress(jobId: string) {
    return apiClient.get(`/upload/jobs/${jobId}`);
  }

  async cancelUpload(jobId: string) {
    return apiClient.post(`/upload/jobs/${jobId}/cancel`);
  }

  async downloadProcessedFile(id: string) {
    return apiClient.download(`/upload/download/${id}`);
  }
}

export class MappingService {
  async createMapping(mappingData: any) {
    return apiClient.post("/api/mappings", mappingData);
  }

  async getMappings(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    return apiClient.get<PaginatedResponse>("/api/mappings", params);
  }

  async getMapping(id: string) {
    return apiClient.get(`/api/mappings/${id}`);
  }

  async updateMapping(id: string, mappingData: any) {
    return apiClient.put(`/api/mappings/${id}`, mappingData);
  }

  async deleteMapping(id: string) {
    return apiClient.delete(`/api/mappings/${id}`);
  }

  async previewMapping(mappingData: any, sampleData?: any[]) {
    return apiClient.post("/api/mappings/preview", {
      mapping: mappingData,
      sampleData,
    });
  }

  async validateMapping(mappingData: any) {
    return apiClient.post("/api/mappings/validate", mappingData);
  }

  async duplicateMapping(id: string, name?: string) {
    return apiClient.post(`/api/mappings/${id}/duplicate`, { name });
  }

  async getMappingTemplates() {
    return apiClient.get("/api/mappings/templates");
  }

  async createTemplate(
    mappingData: any,
    templateData: { name: string; description?: string },
  ) {
    return apiClient.post("/api/mappings/templates", {
      mapping: mappingData,
      ...templateData,
    });
  }
}

export class ApiService {
  setAuthToken(token: string) {
    if (typeof window !== "undefined") {
      storage.set(STORAGE_KEYS.authToken, token);
    }
  }

  clearAuthToken() {
    if (typeof window !== "undefined") {
      storage.remove(STORAGE_KEYS.authToken);
    }
  }

  async createApiConfiguration(configData: any) {
    return apiClient.post("/api/apis", configData);
  }

  async getApiConfigurations(params?: {
    page?: number;
    limit?: number;
    search?: string;
  }) {
    return apiClient.get<PaginatedResponse>("/api/apis", params);
  }

  async getApiConfiguration(id: string) {
    return apiClient.get(`/api/apis/${id}`);
  }

  async updateApiConfiguration(id: string, configData: any) {
    return apiClient.put(`/api/apis/${id}`, configData);
  }

  async deleteApiConfiguration(id: string) {
    return apiClient.delete(`/api/apis/${id}`);
  }

  async testApiConnection(configData: any) {
    return apiClient.post("/api/apis/test", configData);
  }

  async importOpenApiSpec(specData: any) {
    return apiClient.post("/api/apis/import", specData);
  }

  async getApiEndpoints(apiId: string) {
    return apiClient.get(`/api/apis/${apiId}/endpoints`);
  }

  async testEndpoint(apiId: string, endpointData: any) {
    return apiClient.post(`/api/apis/${apiId}/test`, endpointData);
  }
}

export class TransformationService {
  async createTransformation(transformationData: any) {
    return apiClient.post("/api/transformations", transformationData);
  }

  async getTransformations(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }) {
    return apiClient.get<PaginatedResponse>("/api/transformations", params);
  }

  async getTransformation(id: string) {
    return apiClient.get(`/api/transformations/${id}`);
  }

  async executeTransformation(mappingId: string, options?: any) {
    return apiClient.post("/api/transformations/execute", {
      mappingId,
      ...options,
    });
  }

  async getTransformationProgress(jobId: string) {
    return apiClient.get(`/api/transformations/status/${jobId}`);
  }

  async cancelTransformation(jobId: string) {
    return apiClient.post(`/api/transformations/cancel/${jobId}`);
  }

  async downloadResults(id: string, format: string = "csv") {
    return apiClient.download(
      `/api/transformations/${id}/download?format=${format}`,
    );
  }

  async getTransformationHistory(mappingId: string) {
    return apiClient.get(`/api/transformations/history/${mappingId}`);
  }
}

export class MonitoringService {
  async getSystemHealth() {
    return apiClient.get("/api/monitoring/health");
  }

  async getSystemMetrics() {
    return apiClient.get("/api/monitoring/metrics");
  }

  async getJobStatistics() {
    return apiClient.get("/api/monitoring/jobs");
  }

  async getUserActivity(params?: { startDate?: string; endDate?: string }) {
    return apiClient.get("/api/monitoring/activity", params);
  }

  async getPerformanceMetrics() {
    return apiClient.get("/api/monitoring/performance");
  }

  async getErrorLogs(params?: {
    page?: number;
    limit?: number;
    level?: string;
  }) {
    return apiClient.get<PaginatedResponse>("/api/monitoring/logs", params);
  }
}

// Export service instances
export const authService = new AuthService();
export const uploadService = new UploadService();
export const mappingService = new MappingService();
export const apiService = new ApiService();
export const transformationService = new TransformationService();
export const monitoringService = new MonitoringService();

// API client is already exported above (line 195)

// Export types
export type { ApiClientConfig };
