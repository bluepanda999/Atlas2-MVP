import { BaseEntity } from './common';

export interface FileUpload extends BaseEntity {
  userId: string;
  originalFilename: string;
  storedFilename: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: UploadStatus;
  processingStatus?: ProcessingStatus;
  progress?: number;
  totalRows?: number;
  processedRows?: number;
  errors?: string[];
  metadata?: FileMetadata;
}

export enum UploadStatus {
  UPLOADING = 'uploading',
  UPLOADED = 'uploaded',
  VALIDATING = 'validating',
  VALIDATED = 'validated',
  FAILED = 'failed'
}

export enum ProcessingStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

// For backward compatibility
export const ProcessingStatusCompat = {
  pending: 'pending' as const,
  processing: 'processing' as const,
  completed: 'completed' as const,
  failed: 'failed' as const,
  cancelled: 'cancelled' as const
};

export interface FileMetadata {
  delimiter?: string;
  encoding?: string;
  hasHeader?: boolean;
  columns?: string[];
  sampleData?: string[][];
  detectedDelimiter?: string;
  detectedEncoding?: string;
}

export interface UploadProgress {
  loaded: number;
  total: number;
  percentage: number;
  speed?: number;
  timeRemaining?: number;
}

export interface ProcessingJob extends BaseEntity {
  fileUploadId: string;
  fileName: string;
  fileSize: number;
  status: ProcessingStatus;
  progress: number;
  totalRows?: number;
  totalRecords?: number;
  processedRows?: number;
  recordsProcessed?: number;
  errorCount?: number;
  errorMessage?: string;
  startedAt?: Date;
  completedAt?: Date;
  workerId?: string;
  processingTime?: number; // in seconds
  estimatedTimeRemaining?: number; // in seconds
}

export interface UploadRequest {
  file: File;
  metadata?: Partial<FileMetadata>;
}

export interface UploadResponse {
  fileUpload: FileUpload;
  job: ProcessingJob;
}

export interface ChunkInfo {
  chunkIndex: number;
  totalChunks: number;
  chunkSize: number;
  startByte: number;
  endByte: number;
}