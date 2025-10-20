import React, { useState, useCallback, useMemo } from "react";
import {
  ArrowUpOutlined,
  PlusOutlined,
  DeleteOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CaretDownOutlined,
  CaretRightOutlined,
  ArrowUpOutlined as ArrowUp,
  ArrowDownOutlined,
} from "@ant-design/icons";
import {
  Transformation,
  TransformationConfig,
  TransformationResult,
} from "../../../lib/transformations/types";
import { transformationEngine } from "../../../lib/transformations/transformationEngine";
import Button from "../../common/Button";
import Input from "../../common/Input";

interface TransformationBuilderProps {
  columnName: string;
  sampleData: string[];
  initialConfig?: TransformationConfig;
  onConfigChange: (config: TransformationConfig) => void;
  onValidationChange: (isValid: boolean, errors: string[]) => void;
}

interface TransformationStep {
  id: string;
  transformation: Transformation;
  config: Record<string, any>;
  enabled: boolean;
  result?: TransformationResult;
  isExpanded: boolean;
}

export const TransformationBuilder: React.FC<TransformationBuilderProps> = ({
  columnName,
  sampleData,
  initialConfig,
  onConfigChange,
  onValidationChange,
}) => {
  const [steps, setSteps] = useState<TransformationStep[]>(() => {
    if (initialConfig?.transformations) {
      return initialConfig.transformations.map((t: any, index: number) => ({
        id: `step-${index}`,
        transformation: t.transformation,
        config: t.config || {},
        enabled: true,
        isExpanded: false,
      }));
    }
    return [];
  });

  const [previewData, setPreviewData] = useState<string[]>(sampleData);
  const [isPreviewing, setIsPreviewing] = useState(false);

  // Group transformations by category
  const transformationsByCategory = useMemo(() => {
    const categories: Record<string, Transformation[]> = {
      formatting: [],
      calculation: [],
      conditional: [],
      lookup: [],
      custom: [],
    };

    transformationEngine
      .getAvailableTransformations()
      .forEach((transform: Transformation) => {
        categories[transform.category].push(transform);
      });

    return categories;
  }, []);

  // Run preview of all transformations
  const runPreview = useCallback(async () => {
    setIsPreviewing(true);

    try {
      let currentData = [...sampleData];
      const results: TransformationResult[] = [];

      for (const step of steps) {
        if (!step.enabled) continue;

        const result = await transformationEngine.executeTransformation(
          step.transformation,
          currentData,
          step.config,
        );

        results.push(result);
        currentData = result.results;
      }

      setPreviewData(currentData);

      // Update steps with results
      setSteps((prevSteps) =>
        prevSteps.map((step, index) => ({
          ...step,
          result: results[index],
        })),
      );
    } catch (error) {
      console.error("Preview failed:", error);
    } finally {
      setIsPreviewing(false);
    }
  }, [steps, sampleData]);

  // Add transformation step
  const addTransformation = useCallback((transformation: Transformation) => {
    const newStep: TransformationStep = {
      id: `step-${Date.now()}`,
      transformation,
      config: {},
      enabled: true,
      isExpanded: true,
    };

    setSteps((prev) => [...prev, newStep]);
  }, []);

  // Remove transformation step
  const removeTransformation = useCallback((stepId: string) => {
    setSteps((prev) => prev.filter((step) => step.id !== stepId));
  }, []);

  // Update transformation config
  const updateStepConfig = useCallback(
    (stepId: string, config: Record<string, any>) => {
      setSteps((prev) =>
        prev.map((step) => (step.id === stepId ? { ...step, config } : step)),
      );
    },
    [],
  );

  // Toggle step enabled
  const toggleStepEnabled = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, enabled: !step.enabled } : step,
      ),
    );
  }, []);

  // Toggle step expanded
  const toggleStepExpanded = useCallback((stepId: string) => {
    setSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, isExpanded: !step.isExpanded } : step,
      ),
    );
  }, []);

  // Reorder steps
  const moveStep = useCallback((fromIndex: number, toIndex: number) => {
    setSteps((prev) => {
      const newSteps = [...prev];
      const [moved] = newSteps.splice(fromIndex, 1);
      newSteps.splice(toIndex, 0, moved);
      return newSteps;
    });
  }, []);

  // Update parent config when steps change
  React.useEffect(() => {
    const config: TransformationConfig = {
      transformations: steps.map((step) => ({
        transformation: step.transformation,
        config: step.config,
      })),
    };

    onConfigChange(config);

    // Validate configuration
    const errors: string[] = [];
    let isValid = true;

    steps.forEach((step, index) => {
      if (!step.enabled) return;

      // Validate required parameters
      step.transformation.parameters.forEach((param: any) => {
        if (param.required && !step.config[param.name]) {
          errors.push(`Step ${index + 1}: ${param.name} is required`);
          isValid = false;
        }
      });

      // Check for errors in step result
      if (step.result && !step.result.success) {
        errors.push(`Step ${index + 1}: ${step.result.error}`);
        isValid = false;
      }
    });

    onValidationChange(isValid, errors);
  }, [steps, onConfigChange, onValidationChange]);

  // Auto-run preview when steps change
  React.useEffect(() => {
    if (steps.length > 0) {
      const timeoutId = setTimeout(runPreview, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setPreviewData(sampleData);
    }
  }, [steps, runPreview, sampleData]);

  const renderParameterInput = (step: TransformationStep, param: any) => {
    const value = step.config[param.name] || "";

    switch (param.type) {
      case "select":
        return (
          <select
            value={value}
            onChange={(e: any) =>
              updateStepConfig(step.id, {
                ...step.config,
                [param.name]: e.target.value,
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select...</option>
            {param.options.map((opt: any) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "number":
        return (
          <Input
            type="number"
            value={value}
            onChange={(e: any) =>
              updateStepConfig(step.id, {
                ...step.config,
                [param.name]: Number(e.target.value),
              })
            }
            placeholder={param.description}
          />
        );

      case "boolean":
        return (
          <select
            value={value.toString()}
            onChange={(e: any) =>
              updateStepConfig(step.id, {
                ...step.config,
                [param.name]: e.target.value === "true",
              })
            }
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="true">True</option>
            <option value="false">False</option>
          </select>
        );

      default:
        return (
          <Input
            value={value}
            onChange={(e: any) =>
              updateStepConfig(step.id, {
                ...step.config,
                [param.name]: e.target.value,
              })
            }
            placeholder={param.description}
          />
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Transform: {columnName}
          </h3>
          <p className="text-sm text-gray-600">
            Apply transformations to modify the data format
          </p>
        </div>

        <Button
          variant="outline"
          onClick={runPreview}
          disabled={isPreviewing || steps.length === 0}
          className="flex items-center gap-2"
        >
          <PlayCircleOutlined className="w-4 h-4" />
          {isPreviewing ? "Running..." : "Preview"}
        </Button>
      </div>

      {/* Transformation Steps */}
      <div className="space-y-3">
        {steps.length === 0 ? (
          <div className="text-center py-8 border-2 border-dashed border-gray-300 rounded-lg">
            <ArrowUpOutlined className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No transformations added</p>
            <p className="text-sm text-gray-500">
              Add transformations below to modify your data
            </p>
          </div>
        ) : (
          <>
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`border rounded-lg ${
                  step.enabled
                    ? "border-gray-200 bg-white"
                    : "border-gray-100 bg-gray-50 opacity-60"
                }`}
              >
                {/* Step Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleStepExpanded(step.id)}
                      className="p-1 hover:bg-gray-100 rounded"
                    >
                      {step.isExpanded ? (
                        <CaretDownOutlined className="w-4 h-4" />
                      ) : (
                        <CaretRightOutlined className="w-4 h-4" />
                      )}
                    </button>

                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {step.transformation.name}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {step.transformation.category}
                      </span>
                    </div>

                    {step.result && (
                      <div className="flex items-center gap-2">
                        {step.result.success ? (
                          <CheckCircleOutlined className="w-4 h-4 text-green-500" />
                        ) : (
                          <ExclamationCircleOutlined className="w-4 h-4 text-red-500" />
                        )}
                        <span className="text-xs text-gray-600">
                          {step.result.transformedCount}/
                          {step.result.totalCount} items
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleStepEnabled(step.id)}
                      className={`px-3 py-1 rounded text-sm font-medium ${
                        step.enabled
                          ? "bg-blue-100 text-blue-600"
                          : "bg-gray-100 text-gray-400"
                      }`}
                    >
                      {step.enabled ? "ON" : "OFF"}
                    </button>

                    <div className="flex items-center gap-1">
                      {index > 0 && (
                        <button
                          onClick={() => moveStep(index, index - 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ArrowUp />
                        </button>
                      )}
                      {index < steps.length - 1 && (
                        <button
                          onClick={() => moveStep(index, index + 1)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <ArrowDownOutlined />
                        </button>
                      )}
                    </div>

                    <button
                      onClick={() => removeTransformation(step.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded"
                    >
                      <DeleteOutlined className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Step Configuration */}
                {step.isExpanded && (
                  <div className="p-4 space-y-4">
                    <p className="text-sm text-gray-600">
                      {step.transformation.description}
                    </p>

                    {step.transformation.parameters.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {step.transformation.parameters.map((param: any) => (
                          <div key={param.name}>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              {param.label}
                              {param.required && (
                                <span className="text-red-500">*</span>
                              )}
                            </label>
                            {renderParameterInput(step, param)}
                            {param.description && (
                              <p className="text-xs text-gray-500 mt-1">
                                {param.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {step.result && !step.result.success && (
                      <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <p className="text-sm text-red-800">
                          {step.result.error}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </>
        )}
      </div>

      {/* Add Transformation */}
      <div className="border-t pt-4">
        <div className="flex items-center gap-2 mb-3">
          <PlusOutlined className="w-4 h-4" />
          <span className="font-medium text-gray-900">Add Transformation</span>
        </div>

        <div className="space-y-3">
          {Object.entries(transformationsByCategory).map(
            ([category, transformations]) => (
              <div key={category}>
                <h4 className="text-sm font-medium text-gray-700 mb-2 capitalize">
                  {category}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                  {transformations.map((transformation: Transformation) => (
                    <Button
                      key={transformation.name}
                      variant="outline"
                      size="sm"
                      onClick={() => addTransformation(transformation)}
                      className="text-left justify-start"
                    >
                      {transformation.name}
                    </Button>
                  ))}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Preview */}
      {steps.length > 0 && (
        <div className="border-t pt-4">
          <h4 className="font-medium text-gray-900 mb-3">Preview</h4>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Original Data */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                Original
              </h5>
              <div className="bg-gray-50 rounded-md p-3 max-h-40 overflow-y-auto">
                {sampleData.slice(0, 10).map((value, index) => (
                  <div key={index} className="text-sm text-gray-600 py-1">
                    {value || "<empty>"}
                  </div>
                ))}
                {sampleData.length > 10 && (
                  <div className="text-xs text-gray-500 italic">
                    ... and {sampleData.length - 10} more
                  </div>
                )}
              </div>
            </div>

            {/* Transformed Data */}
            <div>
              <h5 className="text-sm font-medium text-gray-700 mb-2">
                Transformed
              </h5>
              <div className="bg-blue-50 rounded-md p-3 max-h-40 overflow-y-auto">
                {previewData.slice(0, 10).map((value, index) => (
                  <div key={index} className="text-sm text-gray-600 py-1">
                    {value || "<empty>"}
                  </div>
                ))}
                {previewData.length > 10 && (
                  <div className="text-xs text-gray-500 italic">
                    ... and {previewData.length - 10} more
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
