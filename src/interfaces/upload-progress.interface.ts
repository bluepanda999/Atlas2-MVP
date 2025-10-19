export interface UploadProgress {
  uploadId: string;
  fileName: string;
  uploadedBytes: number;
  totalBytes: number;
  progress: number;
  status: 'initialized' | 'uploading' | 'paused' | 'completed' | 'failed' | 'cancelled';
  chunkIndex?: number;
  isLastChunk?: boolean;
  speed?: number; // bytes per second
  estimatedTimeRemaining?: number; // seconds
  error?: string;
  createdAt?: Date;
  completedAt?: Date;
}