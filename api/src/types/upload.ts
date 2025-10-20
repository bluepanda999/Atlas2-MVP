export interface ProcessingJob {
  id: string;
  userId: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  errorMessage?: string;
  processedRecords?: number;
  totalRecords?: number;
}

export interface UploadHistoryOptions {
  page: number;
  limit: number;
  status?: ProcessingJob['status'];
}

export interface UploadHistoryResult {
  jobs: ProcessingJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}