import { VALIDATION_RULES } from './constants';

// Validation rule interfaces
export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  min?: number;
  max?: number;
  email?: boolean;
  url?: boolean;
  custom?: (value: any) => boolean | string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// Base validation function
export const validateField = (value: any, rules: ValidationRule): ValidationResult => {
  const errors: string[] = [];

  // Required validation
  if (rules.required && (value === null || value === undefined || value === '')) {
    errors.push('This field is required');
    return { isValid: false, errors };
  }

  // Skip other validations if field is empty and not required
  if (!rules.required && (value === null || value === undefined || value === '')) {
    return { isValid: true, errors: [] };
  }

  // String validations
  if (typeof value === 'string') {
    if (rules.minLength && value.length < rules.minLength) {
      errors.push(`Minimum length is ${rules.minLength} characters`);
    }

    if (rules.maxLength && value.length > rules.maxLength) {
      errors.push(`Maximum length is ${rules.maxLength} characters`);
    }

    if (rules.pattern && !rules.pattern.test(value)) {
      errors.push('Invalid format');
    }

    if (rules.email && !isValidEmail(value)) {
      errors.push('Invalid email address');
    }

    if (rules.url && !isValidUrl(value)) {
      errors.push('Invalid URL');
    }
  }

  // Number validations
  if (typeof value === 'number') {
    if (rules.min !== undefined && value < rules.min) {
      errors.push(`Minimum value is ${rules.min}`);
    }

    if (rules.max !== undefined && value > rules.max) {
      errors.push(`Maximum value is ${rules.max}`);
    }
  }

  // Custom validation
  if (rules.custom) {
    const customResult = rules.custom(value);
    if (customResult !== true) {
      errors.push(typeof customResult === 'string' ? customResult : 'Validation failed');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Specific validation functions
export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const isValidUrl = (url: string): boolean => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const isValidPassword = (password: string): boolean => {
  // At least 8 characters, one uppercase, one lowercase, one number, one special character
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
  return passwordRegex.test(password);
};

export const isValidUsername = (username: string): boolean => {
  const usernameRegex = VALIDATION_RULES.username.pattern;
  return usernameRegex.test(username) && 
         username.length >= VALIDATION_RULES.username.minLength &&
         username.length <= VALIDATION_RULES.username.maxLength;
};

// Form validation
export const validateForm = <T extends Record<string, any>>(
  data: T,
  validationRules: Record<keyof T, ValidationRule>
): { isValid: boolean; errors: Partial<Record<keyof T, string[]>> } => {
  const errors: Partial<Record<keyof T, string[]>> = {};
  let isValid = true;

  Object.entries(validationRules).forEach(([field, rules]) => {
    const result = validateField(data[field as keyof T], rules);
    if (!result.isValid) {
      errors[field as keyof T] = result.errors;
      isValid = false;
    }
  });

  return { isValid, errors };
};

// Predefined validation rules
export const validationRules = {
  username: VALIDATION_RULES.username,
  email: {
    required: true,
    pattern: VALIDATION_RULES.email.pattern,
  },
  password: {
    required: true,
    minLength: VALIDATION_RULES.password.minLength,
    pattern: VALIDATION_RULES.password.pattern,
  },
  confirmPassword: {
    required: true,
    custom: (value: any, formData: any) => {
      return value === formData.password || 'Passwords do not match';
    },
  },
  apiUrl: {
    required: true,
    pattern: VALIDATION_RULES.apiUrl.pattern,
  },
  apiKey: {
    required: true,
    minLength: 1,
  },
  mappingName: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  apiConfigurationName: {
    required: true,
    minLength: 1,
    maxLength: 100,
  },
  fileName: {
    required: true,
    custom: (value: any) => {
      if (typeof value !== 'string') return 'Invalid file';
      const extension = value.split('.').pop()?.toLowerCase();
      return extension === 'csv' || 'Only CSV files are allowed';
    },
  },
  chunkSize: {
    required: true,
    min: 1024,
    max: 1048576, // 1MB
  },
  maxFileSize: {
    required: true,
    min: 1048576, // 1MB
    max: 10737418240, // 10GB
  },
  batchSize: {
    required: true,
    min: 1,
    max: 10000,
  },
  rateLimit: {
    required: true,
    min: 1,
    max: 1000,
  },
  timeout: {
    required: true,
    min: 1000,
    max: 300000, // 5 minutes
  },
};

// Async validation functions
export const validateUniqueEmail = async (email: string, excludeUserId?: string): Promise<boolean> => {
  try {
    // This would make an API call to check if email is unique
    const response = await fetch(`/api/auth/check-email?email=${encodeURIComponent(email)}${excludeUserId ? `&exclude=${excludeUserId}` : ''}`);
    const data = await response.json();
    return data.isUnique;
  } catch {
    return false;
  }
};

export const validateUniqueUsername = async (username: string, excludeUserId?: string): Promise<boolean> => {
  try {
    // This would make an API call to check if username is unique
    const response = await fetch(`/api/auth/check-username?username=${encodeURIComponent(username)}${excludeUserId ? `&exclude=${excludeUserId}` : ''}`);
    const data = await response.json();
    return data.isUnique;
  } catch {
    return false;
  }
};

export const validateApiConnection = async (config: {
  baseUrl: string;
  authType: string;
  authConfig: any;
}): Promise<boolean> => {
  try {
    const response = await fetch('/api/api/test-connection', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(config),
    });
    const data = await response.json();
    return data.success;
  } catch {
    return false;
  }
};

// File validation
export const validateFile = (file: File, maxSize: number, allowedTypes: string[]): ValidationResult => {
  const errors: string[] = [];

  if (!file) {
    errors.push('No file selected');
    return { isValid: false, errors };
  }

  if (file.size > maxSize) {
    errors.push(`File size exceeds maximum allowed size of ${formatFileSize(maxSize)}`);
  }

  if (!allowedTypes.includes(file.type) && !allowedTypes.some(type => file.name.toLowerCase().endsWith(type))) {
    errors.push(`File type not allowed. Allowed types: ${allowedTypes.join(', ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// CSV validation
export const validateCsvStructure = (content: string): ValidationResult => {
  const errors: string[] = [];

  if (!content || content.trim().length === 0) {
    errors.push('CSV file is empty');
    return { isValid: false, errors };
  }

  const lines = content.split('\n').filter(line => line.trim().length > 0);
  
  if (lines.length < 2) {
    errors.push('CSV must have at least a header row and one data row');
  }

  // Check for consistent column count
  const headerColumns = lines[0].split(',').length;
  for (let i = 1; i < lines.length; i++) {
    const columns = lines[i].split(',').length;
    if (columns !== headerColumns) {
      errors.push(`Row ${i + 1} has ${columns} columns, expected ${headerColumns}`);
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Helper function to format file size
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Validation error formatter
export const formatValidationErrors = (errors: Record<string, string[]>): string[] => {
  const formattedErrors: string[] = [];
  
  Object.entries(errors).forEach(([field, fieldErrors]) => {
    fieldErrors.forEach(error => {
      formattedErrors.push(`${capitalize(field)}: ${error}`);
    });
  });
  
  return formattedErrors;
};

// Helper function to capitalize first letter
const capitalize = (str: string): string => {
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/([A-Z])/g, ' $1').trim();
};