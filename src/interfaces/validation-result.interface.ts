export interface ValidationResult {
  valid: boolean;
  responseTime?: number;
  statusCode?: number;
  error?: string;
  expired?: boolean;
  analysis?: any;
  recommendations?: string[];
}