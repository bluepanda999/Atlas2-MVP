import React from 'react';
import { ProcessingJob } from '../../../types';
import { Spinner } from '../../common';
import { cn } from '../../../utils/helpers';

export interface UploadProgressProps {
  job: ProcessingJob;
  onCancel?: (jobId: string) => void;
  className?: string;
}

const UploadProgress: React.FC<UploadProgressProps> = ({
  job,
  onCancel,
  className,
}) => {
  const getStatusColor = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-600 bg-yellow-50';
      case 'processing':
        return 'text-blue-600 bg-blue-50';
      case 'completed':
        return 'text-green-600 bg-green-50';
      case 'failed':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getStatusIcon = (status: ProcessingJob['status']) => {
    switch (status) {
      case 'pending':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case 'processing':
        return <Spinner size="sm" color="primary" />;
      case 'completed':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        );
      case 'failed':
        return (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
      default:
        return null;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  return (
    <div className={cn('border rounded-lg p-4', className)}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            <h4 className="font-medium text-gray-900">{job.fileName}</h4>
            <span className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
              getStatusColor(job.status)
            )}>
              {getStatusIcon(job.status)}
              <span className="ml-1">{job.status}</span>
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            {formatFileSize(job.fileSize)} • Uploaded {new Date(job.createdAt).toLocaleString()}
          </p>
        </div>
        
        {onCancel && (job.status === 'pending' || job.status === 'processing') && (
          <button
            onClick={() => onCancel(job.id)}
            className="text-red-600 hover:text-red-800 text-sm font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
          <span>Progress</span>
          <span>{job.progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${job.progress}%` }}
          />
        </div>
      </div>

      {/* Additional Details */}
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div>
          <span className="text-gray-500">Records Processed:</span>
          <span className="ml-2 font-medium">{job.recordsProcessed.toLocaleString()}</span>
        </div>
        <div>
          <span className="text-gray-500">Total Records:</span>
          <span className="ml-2 font-medium">{job.totalRecords?.toLocaleString() || 'Unknown'}</span>
        </div>
        {job.estimatedTimeRemaining && (
          <div>
            <span className="text-gray-500">Est. Time Remaining:</span>
            <span className="ml-2 font-medium">{formatDuration(job.estimatedTimeRemaining)}</span>
          </div>
        )}
        {job.processingTime && (
          <div>
            <span className="text-gray-500">Processing Time:</span>
            <span className="ml-2 font-medium">{formatDuration(job.processingTime)}</span>
          </div>
        )}
      </div>

      {/* Error Message */}
      {job.errorMessage && (
        <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-800">{job.errorMessage}</p>
        </div>
      )}
    </div>
  );
};

export default UploadProgress;