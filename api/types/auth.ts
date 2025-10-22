export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  role?: string;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  lastLogin?: Date;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role?: string;
}

export interface AuthResponse {
  user: Omit<User, "password">;
  token: string;
  refreshToken: string;
}

export interface ApiKeyRequest {
  name: string;
  endpoint?: string;
  permissions?: string[];
}

export interface ApiKeyResponse {
  id: string;
  name: string;
  apiKey: string;
  endpoint?: string;
  permissions: string[];
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}
