import React from 'react';
import { Input } from '../common';
import { FieldMapping as FieldMappingType, ApiField } from '../../types';
import { cn } from '../../utils/helpers';

export interface FieldMappingProps {
  csvHeaders: string[];
  apiFields: ApiField[];
  mappings: FieldMappingType[];
  onMappingChange: (mappings: FieldMappingType[]) => void;
  className?: string;
}

const FieldMapping: React.FC<FieldMappingProps> = ({
  csvHeaders,
  apiFields,
  mappings,
  onMappingChange,
  className,
}) => {
  const handleMappingChange = (apiFieldId: string, csvHeader: string) => {
    const updatedMappings = mappings.map(mapping =>
      mapping.apiFieldId === apiFieldId
        ? { ...mapping, csvHeader }
        : mapping
    );
    onMappingChange(updatedMappings);
  };

  const handleRequiredToggle = (apiFieldId: string, required: boolean) => {
    const updatedMappings = mappings.map(mapping =>
      mapping.apiFieldId === apiFieldId
        ? { ...mapping, required }
        : mapping
    );
    onMappingChange(updatedMappings);
  };

  const getMappedField = (apiFieldId: string) => {
    return mappings.find(m => m.apiFieldId === apiFieldId);
  };

  return (
    <div className={cn('space-y-4', className)}>
      <div className="grid grid-cols-1 gap-4">
        {apiFields.map((apiField) => {
          const mapping = getMappedField(apiField.id);
          const isRequired = mapping?.required ?? apiField.required;
          
          return (
            <div
              key={apiField.id}
              className={cn(
                'p-4 border rounded-lg',
                isRequired && 'border-red-200 bg-red-50',
                !isRequired && 'border-gray-200'
              )}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">{apiField.name}</h4>
                  <p className="text-sm text-gray-500">{apiField.description}</p>
                  <div className="flex items-center space-x-4 mt-1">
                    <span className="text-xs text-gray-400">Type: {apiField.type}</span>
                    {apiField.format && (
                      <span className="text-xs text-gray-400">Format: {apiField.format}</span>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id={`required-${apiField.id}`}
                    checked={isRequired}
                    onChange={(e) => handleRequiredToggle(apiField.id, e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label
                    htmlFor={`required-${apiField.id}`}
                    className="ml-2 text-sm text-gray-700"
                  >
                    Required
                  </label>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Map to CSV Column
                </label>
                <select
                  value={mapping?.csvHeader || ''}
                  onChange={(e) => handleMappingChange(apiField.id, e.target.value)}
                  className="block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
                >
                  <option value="">-- Select CSV Column --</option>
                  {csvHeaders.map((header) => (
                    <option key={header} value={header}>
                      {header}
                    </option>
                  ))}
                </select>
                
                {mapping?.csvHeader && (
                  <div className="flex items-center space-x-2 text-sm text-green-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span>Mapped to "{mapping.csvHeader}"</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 mb-2">Mapping Summary</h4>
        <div className="space-y-1 text-sm text-blue-700">
          <p>Total API Fields: {apiFields.length}</p>
          <p>Mapped Fields: {mappings.filter(m => m.csvHeader).length}</p>
          <p>Required Fields: {mappings.filter(m => m.required).length}</p>
          <p>Required Mapped: {mappings.filter(m => m.required && m.csvHeader).length}</p>
        </div>
      </div>
    </div>
  );
};

export default FieldMapping;