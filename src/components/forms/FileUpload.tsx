import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '../common';
import { cn } from '../../utils/helpers';

export interface FileUploadProps {
  onFileSelect: (files: File[]) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileSelect,
  accept = '.csv',
  maxFiles = 1,
  maxSize = 50 * 1024 * 1024, // 50MB
  disabled = false,
  className,
}) => {
  const [dragActive, setDragActive] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      // Handle file rejections
      fileRejections.forEach(({ file, errors }) => {
        errors.forEach((error: any) => {
          console.error(`File ${file.name} rejected: ${error.message}`);
        });
      });
      return;
    }

    onFileSelect(acceptedFiles);
  }, [onFileSelect]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: accept ? { 'text/csv': ['.csv'] } : undefined,
    maxFiles,
    maxSize,
    disabled,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false),
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors',
        'hover:border-blue-400 hover:bg-blue-50',
        'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500',
        isDragActive && 'border-blue-500 bg-blue-50',
        disabled && 'opacity-50 cursor-not-allowed',
        className
      )}
    >
      <input {...getInputProps()} />
      
      <div className="space-y-4">
        <div className="mx-auto w-12 h-12 text-gray-400">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
        </div>
        
        <div className="text-sm text-gray-600">
          {isDragActive ? (
            <p>Drop the files here...</p>
          ) : (
            <div>
              <p>Drag and drop your CSV file here, or</p>
              <Button variant="outline" size="sm" className="mt-2" disabled={disabled}>
                Browse Files
              </Button>
            </div>
          )}
        </div>
        
        <div className="text-xs text-gray-500">
          <p>Maximum file size: {Math.round(maxSize / 1024 / 1024)}MB</p>
          {maxFiles > 1 && <p>Maximum files: {maxFiles}</p>}
          <p>Supported formats: CSV</p>
        </div>
      </div>
    </div>
  );
};

export default FileUpload;