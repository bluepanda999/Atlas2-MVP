import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/layout';
import { FileUpload } from '../components/forms';
import { UploadProgress, UploadHistory } from '../components/features/upload';
import { Button, Modal } from '../components/common';
import { useUploadStore } from '../store/upload';
import { ProcessingJob } from '../types';

const Upload: React.FC = () => {
  const navigate = useNavigate();
  const [showHistory, setShowHistory] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const {
    currentJob,
    uploadHistory,
    uploadFile,
    cancelJob,
    retryJob,
    deleteJob,
  } = useUploadStore();

  const handleFileSelect = async (files: File[]) => {
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      const job = await uploadFile(file);
      
      // If upload is successful, navigate to validation
      if (job && job.status === 'completed') {
        navigate(`/validation/${job.id}/${encodeURIComponent(file.name)}`);
      }
    }
  };

  const handleRetry = async (jobId: string) => {
    await retryJob(jobId);
  };

  const handleDelete = async (jobId: string) => {
    await deleteJob(jobId);
  };

  const handleViewDetails = (jobId: string) => {
    const job = uploadHistory.find(j => j.id === jobId);
    if (job) {
      navigate(`/validation/${jobId}/${encodeURIComponent(job.fileName || 'unknown.csv')}`);
    }
  };

  return (
    <Layout title="Upload CSV" subtitle="Upload and process your CSV files">
      <div className="space-y-6">
        {/* File Upload Area */}
        {!currentJob && (
          <div className="bg-white shadow rounded-lg p-6">
            <h2 className="text-lg font-medium text-gray-900 mb-4">Upload File</h2>
            <FileUpload
              onFileSelect={handleFileSelect}
              accept=".csv"
              maxFiles={1}
              maxSize={50 * 1024 * 1024} // 50MB
            />
          </div>
        )}

        {/* Current Upload Progress */}
        {currentJob && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Upload Progress</h2>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowHistory(true)}
                >
                  View History
                </Button>
                {(currentJob.status === 'pending' || currentJob.status === 'processing') && (
                  <Button
                    variant="outline"
                    onClick={() => cancelJob(currentJob.id)}
                  >
                    Cancel
                  </Button>
                )}
              </div>
            </div>
            <UploadProgress
              job={currentJob}
              onCancel={cancelJob}
            />
            
            {currentJob.status === 'completed' && (
              <div className="mt-4 flex justify-center">
                <Button
                  variant="primary"
                  onClick={() => navigate(`/validation/${currentJob.id}/${encodeURIComponent(currentJob.fileName || 'unknown.csv')}`)}
                >
                  Validate Data
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Uploads</p>
                <p className="text-2xl font-semibold text-gray-900">{uploadHistory.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {uploadHistory.filter(job => job.status === 'completed').length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-red-500 rounded-md flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-semibold text-gray-900">
                  {uploadHistory.filter(job => job.status === 'failed').length}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Upload History Modal */}
        <Modal
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
          title="Upload History"
          size="xl"
        >
          <UploadHistory
            jobs={uploadHistory}
            onRetry={handleRetry}
            onDelete={handleDelete}
            onViewDetails={handleViewDetails}
          />
        </Modal>
      </div>
    </Layout>
  );
};

export default Upload;