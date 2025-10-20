export interface ProcessingJob {
  id: string;
  userId: string;
  fileName: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  recordsProcessed: number;
  totalRecords: number;
  csvHeaders: string[];
  errorMessage: string | null;
  processingTime: number | null;
  estimatedTimeRemaining: number | null;
  mappingId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadOptions {
  status?: ProcessingJob['status'];
  startDate?: Date;
  endDate?: Date;
}

export interface FileValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  detectedDelimiter?: string;
  detectedEncoding?: string;
}

export interface ProcessingProgress {
  jobId: string;
  progress: number;
  recordsProcessed: number;
  totalRecords: number;
  processingSpeed: number; // rows per second
  estimatedTimeRemaining: number | null;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    rss: number;
  };
}