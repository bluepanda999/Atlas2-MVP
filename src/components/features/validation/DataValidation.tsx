import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../common';
import { cn } from '../../../utils/helpers';
import { DataValidationProps, ValidationResult, ValidationProgress } from '../../../types/validation';

interface ValidationState {
  progress: ValidationProgress | null;
  result: ValidationResult | null;
  isConnected: boolean;
  error: string | null;
}

export const DataValidation: React.FC<DataValidationProps> = ({
  fileId,
  fileName,
  onValidationComplete,
  onValidationError,
  className,
}) => {
  const navigate = useNavigate();
  const [validationState, setValidationState] = useState<ValidationState>({
    progress: null,
    result: null,
    isConnected: false,
    error: null,
  });
  
  const [activeTab, setActiveTab] = useState<string>('progress');


   // Initialize validation state
   useEffect(() => {
     if (!fileId) return;

     // For now, simulate connection
     setValidationState(prev => ({ ...prev, isConnected: true }));
   }, [fileId]);

   const startValidation = useCallback(async () => {
     try {
       setValidationState(prev => ({ ...prev, error: null }));
       
       // Simulate validation progress
       const mockProgress: ValidationProgress = {
         currentRow: 0,
         totalRows: 1000,
         percentage: 0,
         errorsFound: 0,
         warningsFound: 0,
         processingRate: 100,
         estimatedTimeRemaining: 10,
       };

       setValidationState(prev => ({ ...prev, progress: mockProgress }));
       setActiveTab('progress');

       // Simulate validation progress
       let progress = 0;
       const interval = setInterval(() => {
         progress += 10;
         if (progress <= 100) {
           setValidationState(prev => ({
             ...prev,
             progress: {
               ...prev.progress!,
               currentRow: Math.floor((progress / 100) * 1000),
               percentage: progress,
               estimatedTimeRemaining: Math.max(0, 10 - (progress / 10)),
             }
           }));
         } else {
           clearInterval(interval);
           // Mock completion
           const mockResult: ValidationResult = {
             isValid: true,
             errors: [],
             warnings: [],
             summary: {
               totalRows: 1000,
               validRows: 1000,
               errorRows: 0,
               warningRows: 0,
               errorCount: 0,
               warningCount: 0,
               completionPercentage: 100,
             }
           };
           setValidationState(prev => ({
             ...prev,
             result: mockResult,
             progress: null,
           }));
           setActiveTab('results');
           onValidationComplete?.(mockResult);
         }
       }, 500);
     } catch (error) {
       const errorMessage = error instanceof Error ? error.message : 'Failed to start validation';
       setValidationState(prev => ({ ...prev, error: errorMessage }));
       onValidationError?.(errorMessage);
     }
   }, [fileId, onValidationError]);

   const downloadReport = useCallback(async () => {
     try {
       // Mock download
       const data = {
         fileId,
         fileName,
         result: validationState.result,
         exportedAt: new Date().toISOString(),
       };
       
       const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
       const url = window.URL.createObjectURL(blob);
       const link = document.createElement('a');
       link.href = url;
       link.download = `validation-report-${fileId}.json`;
       document.body.appendChild(link);
       link.click();
       document.body.removeChild(link);
       window.URL.revokeObjectURL(url);
       
       alert('Validation report downloaded successfully!');
     } catch (error) {
       alert('Failed to download validation report');
     }
   }, [fileId, validationState.result]);

  const renderProgressTab = () => {
    const { progress, isConnected } = validationState;
    
    if (!progress) {
      return (
        <div className="text-center py-10">
          <div className="space-y-6">
            <div>
              {isConnected ? (
                <svg className="w-16 h-16 text-green-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              ) : (
                <svg className="w-16 h-16 text-red-500 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              )}
            </div>
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {isConnected ? 'Connected to validation service' : 'Connecting to validation service...'}
              </h3>
              <p className="text-gray-500">Real-time updates will appear here once validation starts.</p>
            </div>
            <Button 
              onClick={startValidation}
              disabled={!isConnected}
            >
              Start Validation
            </Button>
          </div>
        </div>
      );
    }

    return (
      <div className="p-5">
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">Validation Progress</h3>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div
                className="bg-blue-600 h-4 rounded-full transition-all duration-300"
                style={{ width: `${progress.percentage}%` }}
              />
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {progress.percentage}% ({progress.currentRow.toLocaleString()} / {progress.totalRows.toLocaleString()} rows)
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {progress.processingRate.toFixed(0)}
                </div>
                <div className="text-gray-500 text-sm">Rows/Second</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {progress.errorsFound.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Errors Found</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {progress.warningsFound.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Warnings Found</div>
              </div>
            </div>
            
            {progress.estimatedTimeRemaining && (
              <div className="bg-white p-4 rounded-lg border">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {Math.round(progress.estimatedTimeRemaining)}s
                  </div>
                  <div className="text-gray-500 text-sm">Est. Time Remaining</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderResultsTab = () => {
    const { result } = validationState;
    
    if (!result) {
      return (
        <div className="text-center py-10">
          <p className="text-gray-500 mb-4">No validation results available yet.</p>
          <Button onClick={startValidation}>Start Validation</Button>
        </div>
      );
    }

    return (
      <div className="p-5">
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className={`text-2xl font-bold ${result.isValid ? 'text-green-600' : 'text-red-600'}`}>
                  {result.isValid ? 'Valid' : 'Invalid'}
                </div>
                <div className="text-gray-500 text-sm">Overall Status</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold">
                  {result.summary.totalRows.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Total Rows</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {result.summary.errorRows.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Error Rows ({((result.summary.errorRows / result.summary.totalRows) * 100).toFixed(1)}%)</div>
              </div>
            </div>
            
            <div className="bg-white p-4 rounded-lg border">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {result.summary.warningRows.toLocaleString()}
                </div>
                <div className="text-gray-500 text-sm">Warning Rows ({((result.summary.warningRows / result.summary.totalRows) * 100).toFixed(1)}%)</div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <Button onClick={downloadReport}>
              Download Report
            </Button>
            <Button 
              variant="outline"
              onClick={startValidation}
            >
              Re-validate
            </Button>
          </div>

          {/* Results Lists */}
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Errors ({result.errors.length})</h3>
              {result.errors.length === 0 ? (
                <p className="text-green-600">No errors found!</p>
              ) : (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.errors.slice(0, 10).map((error, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{error.row}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{error.field}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{error.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.errors.length > 10 && (
                    <p className="px-6 py-3 text-sm text-gray-500">... and {result.errors.length - 10} more errors</p>
                  )}
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Warnings ({result.warnings.length})</h3>
              {result.warnings.length === 0 ? (
                <p className="text-green-600">No warnings found!</p>
              ) : (
                <div className="bg-white border rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Row</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Field</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {result.warnings.slice(0, 10).map((warning, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{warning.row}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{warning.field}</td>
                          <td className="px-6 py-4 text-sm text-gray-900">{warning.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {result.warnings.length > 10 && (
                    <p className="px-6 py-3 text-sm text-gray-500">... and {result.warnings.length - 10} more warnings</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!fileId) {
    return (
      <div className="bg-white shadow rounded-lg p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">No File Selected</h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>Please upload a file first before proceeding with validation.</p>
              </div>
              <div className="mt-4">
                <div className="flex">
                  <Button 
                    size="sm" 
                    onClick={() => navigate('/upload')}
                  >
                    Upload File
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("bg-white shadow rounded-lg", className)}>
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-medium text-gray-900">Data Validation & Preview - {fileName}</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center">
              <div className={cn(
                "w-2 h-2 rounded-full mr-2",
                validationState.isConnected ? "bg-green-500" : "bg-red-500"
              )} />
              <span className="text-sm text-gray-600">
                {validationState.isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <Button 
              onClick={startValidation}
              disabled={!validationState.isConnected}
            >
              Start Validation
            </Button>
          </div>
        </div>
      </div>

      {validationState.error && (
        <div className="px-6 py-4 bg-red-50 border-b border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Validation Error</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{validationState.error}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="border-b border-gray-200">
        <nav className="flex -mb-px">
          <button
            onClick={() => setActiveTab('progress')}
            className={cn(
              "py-2 px-6 text-sm font-medium border-b-2",
              activeTab === 'progress'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Progress
          </button>
          <button
            onClick={() => setActiveTab('results')}
            className={cn(
              "py-2 px-6 text-sm font-medium border-b-2",
              activeTab === 'results'
                ? "border-blue-500 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
            )}
          >
            Results
          </button>
        </nav>
      </div>

      <div>
        {activeTab === 'progress' && renderProgressTab()}
        {activeTab === 'results' && renderResultsTab()}
      </div>
    </div>
  );
};