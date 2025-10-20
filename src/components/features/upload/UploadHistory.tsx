import React from 'react';
import { ProcessingJob } from '../../../types';
import { Button } from '../../common';
import { cn } from '../../../utils/helpers';

export interface UploadHistoryProps {
  jobs: ProcessingJob[];
  onRetry?: (jobId: string) => void;
  onDelete?: (jobId: string) => void;
  onViewDetails?: (jobId: string) => void;
  className?: string;
}

const UploadHistory: React.FC<UploadHistoryProps> = ({
  jobs,
  onRetry,
  onDelete,
  onViewDetails,
  className,
}) => {
  const getStatusBadge = (status: ProcessingJob['status']) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-800',
      processing: 'bg-blue-100 text-blue-800',
      completed: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      cancelled: 'bg-gray-100 text-gray-800',
    };

    return (
      <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', styles[status] || 'bg-gray-100 text-gray-800')}>
        {status}
      </span>
    );
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString();
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (jobs.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="mx-auto w-12 h-12 text-gray-400 mb-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No upload history</h3>
        <p className="text-gray-500">Your uploaded files will appear here.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Upload History</h3>
        <span className="text-sm text-gray-500">{jobs.length} items</span>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {jobs.map((job) => (
            <li key={job.id}>
              <div className="px-4 py-4 sm:px-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3">
                      <h4 className="text-sm font-medium text-gray-900 truncate">
                        {job.fileName}
                      </h4>
                      {getStatusBadge(job.status)}
                    </div>
                    <div className="mt-2 flex items-center space-x-4 text-sm text-gray-500">
                      <span>{formatFileSize(job.fileSize)}</span>
                      <span>{formatDate(job.createdAt)}</span>
                      {job.recordsProcessed && job.recordsProcessed > 0 && (
                        <span>{job.recordsProcessed.toLocaleString()} records</span>
                      )}
                    </div>
                    {job.errorMessage && (
                      <p className="mt-1 text-sm text-red-600">{job.errorMessage}</p>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    {onViewDetails && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetails(job.id)}
                      >
                        Details
                      </Button>
                    )}
                    {onRetry && job.status === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onRetry(job.id)}
                      >
                        Retry
                      </Button>
                    )}
                    {onDelete && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onDelete(job.id)}
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UploadHistory;