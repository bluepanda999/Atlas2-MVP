import React, { useState } from 'react';
import { FieldMapping, CsvRow } from '../../../types';
import { Button } from '../../common';
import { cn } from '../../../utils/helpers';

export interface MappingPreviewProps {
  csvData: CsvRow[];
  mappings: FieldMapping[];
  onConfirm?: () => void;
  onBack?: () => void;
  className?: string;
}

const MappingPreview: React.FC<MappingPreviewProps> = ({
  csvData,
  mappings,
  onConfirm,
  onBack,
  className,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const totalPages = Math.ceil(csvData.length / rowsPerPage);
  const startIndex = (currentPage - 1) * rowsPerPage;
  const endIndex = startIndex + rowsPerPage;
  const currentRows = csvData.slice(startIndex, endIndex);

  const getMappedValue = (row: CsvRow, mapping: FieldMapping) => {
    return row[mapping.csvHeader] || '';
  };

  const getRequiredMappings = () => mappings.filter(m => m.required);
  const getOptionalMappings = () => mappings.filter(m => !m.required);

  if (csvData.length === 0) {
    return (
      <div className={cn('text-center py-8', className)}>
        <div className="mx-auto w-12 h-12 text-gray-400 mb-4">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">No data to preview</h3>
        <p className="text-gray-500">Upload a CSV file to see the preview.</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Data Preview</h3>
          <p className="text-sm text-gray-500">
            Showing {startIndex + 1}-{Math.min(endIndex, csvData.length)} of {csvData.length} rows
          </p>
        </div>
        <div className="flex space-x-2">
          {onBack && (
            <Button variant="outline" onClick={onBack}>
              Back to Mapping
            </Button>
          )}
          {onConfirm && (
            <Button onClick={onConfirm}>
              Confirm Mapping
            </Button>
          )}
        </div>
      </div>

      {/* Required Fields */}
      {getRequiredMappings().length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Required Fields</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Row
                  </th>
                  {getRequiredMappings().map((mapping) => (
                    <th key={mapping.apiFieldId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {mapping.apiFieldName}
                      <span className="ml-1 text-red-500">*</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {startIndex + index + 1}
                    </td>
                    {getRequiredMappings().map((mapping) => (
                      <td key={mapping.apiFieldId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getMappedValue(row, mapping)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Optional Fields */}
      {getOptionalMappings().length > 0 && (
        <div>
          <h4 className="text-md font-medium text-gray-900 mb-3">Optional Fields</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Row
                  </th>
                  {getOptionalMappings().map((mapping) => (
                    <th key={mapping.apiFieldId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {mapping.apiFieldName}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentRows.map((row, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {startIndex + index + 1}
                    </td>
                    {getOptionalMappings().map((mapping) => (
                      <td key={mapping.apiFieldId} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {getMappedValue(row, mapping)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MappingPreview;