import React, { useState } from 'react';
import { Layout } from '../components/layout';
import { FieldMapping } from '../components/forms';
import { MappingPreview, TransformationRules } from '../components/features/mapping';
import { Button, Modal } from '../components/common';
import { useMappingStore } from '../store/mapping';
import { FieldMapping as FieldMappingType, ApiField, CsvRow } from '../types';

const Mapping: React.FC = () => {
  const [currentStep, setCurrentStep] = useState<'mapping' | 'preview' | 'rules'>('mapping');
  const [showPreview, setShowPreview] = useState(false);
  const [showRules, setShowRules] = useState(false);
  
  const {
    csvHeaders,
    csvData,
    apiFields,
    mappings,
    transformationRules,
    setCsvData,
    setMappings,
    addTransformationRule,
    updateTransformationRule,
    deleteTransformationRule,
    saveMapping,
  } = useMappingStore();

  // Mock data for demonstration
  React.useEffect(() => {
    // Initialize with sample data if empty
    if (csvHeaders.length === 0) {
      const sampleHeaders = ['Name', 'Email', 'Phone', 'Address', 'City', 'State', 'Zip'];
      const sampleData: CsvRow[] = [
        { Name: 'John Doe', Email: 'john@example.com', Phone: '555-1234', Address: '123 Main St', City: 'Anytown', State: 'CA', Zip: '12345' },
        { Name: 'Jane Smith', Email: 'jane@example.com', Phone: '555-5678', Address: '456 Oak Ave', City: 'Somecity', State: 'NY', Zip: '67890' },
      ];
      
      const sampleApiFields: ApiField[] = [
        { id: '1', name: 'fullName', type: 'string', required: true, description: 'Customer full name' },
        { id: '2', name: 'emailAddress', type: 'email', required: true, description: 'Customer email address' },
        { id: '3', name: 'phoneNumber', type: 'phone', required: false, description: 'Customer phone number' },
        { id: '4', name: 'streetAddress', type: 'string', required: false, description: 'Street address' },
        { id: '5', name: 'city', type: 'string', required: false, description: 'City name' },
        { id: '6', name: 'state', type: 'string', required: false, description: 'State abbreviation' },
        { id: '7', name: 'postalCode', type: 'string', required: false, description: 'ZIP/Postal code' },
      ];
      
      setCsvData(sampleHeaders, sampleData);
      // Note: In a real app, you'd also set the API fields
    }
  }, [csvHeaders.length, setCsvData]);

  const handleMappingChange = (newMappings: FieldMappingType[]) => {
    setMappings(newMappings);
  };

  const handlePreviewConfirm = async () => {
    try {
      await saveMapping();
      setCurrentStep('mapping');
      alert('Mapping saved successfully!');
    } catch (error) {
      console.error('Failed to save mapping:', error);
      alert('Failed to save mapping. Please try again.');
    }
  };

  const handleRuleAdd = (rule: Omit<any, 'id'>) => {
    addTransformationRule(rule);
  };

  const handleRuleUpdate = (ruleId: string, updates: Partial<any>) => {
    updateTransformationRule(ruleId, updates);
  };

  const handleRuleDelete = (ruleId: string) => {
    deleteTransformationRule(ruleId);
  };

  const isMappingComplete = mappings.filter(m => m.required).every(m => m.csvHeader);

  return (
    <Layout title="Field Mapping" subtitle="Map your CSV columns to API fields">
      <div className="space-y-6">
        {/* Step Navigation */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">Mapping Configuration</h2>
            <div className="flex space-x-2">
              <Button
                variant={currentStep === 'mapping' ? 'primary' : 'outline'}
                onClick={() => setCurrentStep('mapping')}
              >
                Field Mapping
              </Button>
              <Button
                variant={currentStep === 'preview' ? 'primary' : 'outline'}
                onClick={() => setCurrentStep('preview')}
                disabled={!isMappingComplete}
              >
                Preview Data
              </Button>
              <Button
                variant={currentStep === 'rules' ? 'primary' : 'outline'}
                onClick={() => setCurrentStep('rules')}
              >
                Transformation Rules
              </Button>
            </div>
          </div>

          {/* Progress Indicator */}
          <div className="flex items-center space-x-4">
            <div className={`flex items-center ${currentStep === 'mapping' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'mapping' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                1
              </div>
              <span className="ml-2 text-sm font-medium">Map Fields</span>
            </div>
            <div className={`flex-1 h-1 ${isMappingComplete ? 'bg-blue-600' : 'bg-gray-200'}`} />
            <div className={`flex items-center ${currentStep === 'preview' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'preview' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                2
              </div>
              <span className="ml-2 text-sm font-medium">Preview</span>
            </div>
            <div className={`flex-1 h-1 bg-gray-200`} />
            <div className={`flex items-center ${currentStep === 'rules' ? 'text-blue-600' : 'text-gray-400'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'rules' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}>
                3
              </div>
              <span className="ml-2 text-sm font-medium">Rules</span>
            </div>
          </div>
        </div>

        {/* Step Content */}
        {currentStep === 'mapping' && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-md font-medium text-gray-900">Map CSV Columns to API Fields</h3>
              {isMappingComplete && (
                <Button onClick={() => setCurrentStep('preview')}>
                  Continue to Preview
                </Button>
              )}
            </div>
            <FieldMapping
              csvHeaders={csvHeaders}
              apiFields={apiFields}
              mappings={mappings}
              onMappingChange={handleMappingChange}
            />
          </div>
        )}

        {currentStep === 'preview' && (
          <div className="bg-white shadow rounded-lg p-6">
            <MappingPreview
              csvData={csvData}
              mappings={mappings}
              onConfirm={handlePreviewConfirm}
              onBack={() => setCurrentStep('mapping')}
            />
          </div>
        )}

        {currentStep === 'rules' && (
          <div className="bg-white shadow rounded-lg p-6">
            <TransformationRules
              rules={transformationRules}
              onRuleAdd={handleRuleAdd}
              onRuleUpdate={handleRuleUpdate}
              onRuleDelete={handleRuleDelete}
            />
          </div>
        )}

        {/* Quick Actions */}
        <div className="bg-white shadow rounded-lg p-6">
          <h3 className="text-md font-medium text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Button
              variant="outline"
              onClick={() => setShowPreview(true)}
              disabled={!isMappingComplete}
            >
              Preview Mapping
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowRules(true)}
            >
              Manage Rules
            </Button>
            <Button
              onClick={saveMapping}
              disabled={!isMappingComplete}
            >
              Save Mapping
            </Button>
          </div>
        </div>

        {/* Modals */}
        <Modal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Mapping Preview"
          size="xl"
        >
          <MappingPreview
            csvData={csvData}
            mappings={mappings}
            onConfirm={() => {
              setShowPreview(false);
              handlePreviewConfirm();
            }}
            onBack={() => setShowPreview(false)}
          />
        </Modal>

        <Modal
          isOpen={showRules}
          onClose={() => setShowRules(false)}
          title="Transformation Rules"
          size="lg"
        >
          <TransformationRules
            rules={transformationRules}
            onRuleAdd={handleRuleAdd}
            onRuleUpdate={handleRuleUpdate}
            onRuleDelete={handleRuleDelete}
          />
        </Modal>
      </div>
    </Layout>
  );
};

export default Mapping;