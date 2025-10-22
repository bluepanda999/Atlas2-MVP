import React, { useState, useEffect, useCallback } from "react";
import {
  DndContext,
  DragEndEvent,
  DragStartEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  SearchOutlined,
  ClearOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { Input, Button, Card, Typography, Space, Badge } from "antd";
import { debounce } from "lodash";

import {
  FieldMapping,
  SourceField,
  TargetField,
  FieldType,
} from "../../../types";
import { Button as CustomButton } from "../../common";
import { cn } from "../../../utils/helpers";

// Temporary inline components until we create separate files
const DraggableColumn: React.FC<{
  field: SourceField;
  isDragged: boolean;
  isMapped: boolean;
}> = ({ field, isDragged, isMapped }) => {
  return (
    <div
      className={cn(
        "p-3 bg-white border rounded-lg cursor-move transition-all",
        "hover:shadow-md hover:border-blue-300",
        isDragged && "opacity-50 scale-95",
        isMapped && "bg-blue-50 border-blue-200",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate">{field.name}</div>
          <div className="text-xs text-gray-500">{field.type}</div>
          {field.sampleValues.length > 0 && (
            <div className="text-xs text-gray-400 mt-1 truncate">
              {field.sampleValues[0] || "(empty)"}
            </div>
          )}
        </div>
        {field.required && (
          <div className="ml-2">
            <Badge status="error" />
          </div>
        )}
      </div>
    </div>
  );
};

const DroppableParameter: React.FC<{
  field: TargetField;
  mapping?: FieldMapping;
  validationStatus: string;
  isDraggedOver: boolean;
}> = ({ field, mapping, validationStatus, isDraggedOver }) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "error":
        return "border-red-300 bg-red-50";
      case "warning":
        return "border-yellow-300 bg-yellow-50";
      case "info":
        return "border-blue-300 bg-blue-50";
      case "success":
        return "border-green-300 bg-green-50";
      default:
        return "border-gray-200 bg-white";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "error":
        return <CloseCircleOutlined className="text-red-500" />;
      case "warning":
        return <ExclamationCircleOutlined className="text-yellow-500" />;
      case "info":
        return <InfoCircleOutlined className="text-blue-500" />;
      case "success":
        return <CheckCircleOutlined className="text-green-500" />;
      default:
        return null;
    }
  };

  return (
    <div
      className={cn(
        "p-3 border rounded-lg transition-all",
        getStatusColor(validationStatus),
        isDraggedOver && "border-blue-400 bg-blue-100 scale-105",
        !mapping && "border-dashed",
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="font-medium text-gray-900 truncate flex items-center">
            {field.name}
            {field.required && <span className="ml-1 text-red-500">*</span>}
          </div>
          <div className="text-xs text-gray-500">{field.type}</div>
          {mapping && (
            <div className="text-xs text-blue-600 mt-1 truncate">
              ← {mapping.csvHeader}
            </div>
          )}
        </div>
        <div className="ml-2">{getStatusIcon(validationStatus)}</div>
      </div>
    </div>
  );
};

const MappingCanvas: React.FC<{
  mappings: FieldMapping[];
  sourceFields: SourceField[];
  targetFields: TargetField[];
  onRemoveMapping: (mappingId: string) => void;
}> = ({ mappings, sourceFields, targetFields, onRemoveMapping }) => {
  if (mappings.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <div className="text-4xl mb-2">🔄</div>
        <div>Drag columns here to create mappings</div>
      </div>
    );
  }

  return (
    <div className="space-y-2 max-h-96 overflow-y-auto">
      {mappings.map((mapping) => {
        const sourceField = sourceFields.find(
          (f) => f.id === (mapping as any).sourceFieldId,
        );
        const targetField = targetFields.find(
          (f) => f.id === mapping.apiFieldId,
        );

        return (
          <div
            key={mapping.id}
            className="p-3 bg-blue-50 border border-blue-200 rounded-lg"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm text-gray-900">
                  {sourceField?.name || "Unknown"} →{" "}
                  {targetField?.name || "Unknown"}
                </div>
                <div className="text-xs text-gray-500">
                  {sourceField?.type} → {targetField?.type}
                </div>
              </div>
              <Button
                type="text"
                size="small"
                icon={<CloseCircleOutlined />}
                onClick={() => onRemoveMapping(mapping.id)}
                className="text-red-500 hover:text-red-700"
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

const ValidationPanel: React.FC<{
  errors: any[];
}> = ({ errors }) => {
  return (
    <Card title="Validation Results" size="small">
      <div className="space-y-4">
        {errors.map((error, index) => (
          <div
            key={index}
            className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
          >
            <div className="mt-1">
              {error.type === "error" && (
                <CloseCircleOutlined className="text-red-500" />
              )}
              {error.type === "warning" && (
                <ExclamationCircleOutlined className="text-yellow-500" />
              )}
              {error.type === "info" && (
                <InfoCircleOutlined className="text-blue-500" />
              )}
            </div>
            <div className="flex-1">
              <div className="font-medium text-sm">{error.message}</div>
              {error.suggestion && (
                <div className="text-xs text-gray-600 mt-1">
                  💡 {error.suggestion}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};

const { Title, Text } = Typography;

export interface DragDropMappingInterfaceProps {
  csvUploadId: string;
  apiSpecId: string;
  onMappingComplete: (mappings: FieldMapping[]) => void;
  onBack?: () => void;
  className?: string;
}

interface MappingState {
  sourceFields: SourceField[];
  targetFields: TargetField[];
  mappings: FieldMapping[];
  validationErrors: ValidationError[];
  searchTerm: string;
  selectedMapping?: string;
}

interface ValidationError {
  fieldId: string;
  type: "error" | "warning" | "info";
  message: string;
  suggestion?: string;
}

const DragDropMappingInterface: React.FC<DragDropMappingInterfaceProps> = ({
  csvUploadId,
  apiSpecId,
  onMappingComplete,
  onBack,
  className,
}) => {
  const [state, setState] = useState<MappingState>({
    sourceFields: [],
    targetFields: [],
    mappings: [],
    validationErrors: [],
    searchTerm: "",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  // DnD sensors configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  // Load CSV data and API schema
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);

        // Load CSV preview data
        const csvResponse = await fetch(`/api/csv/preview/${csvUploadId}`);
        const csvData = await csvResponse.json();

        // Load API schema
        const apiResponse = await fetch(`/api/specs/${apiSpecId}/schema`);
        const apiData = await apiResponse.json();

        setState((prev) => ({
          ...prev,
          sourceFields: csvData.columns || [],
          targetFields: apiData.parameters || [],
        }));
      } catch (error) {
        console.error("Failed to load mapping data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [csvUploadId, apiSpecId]);

  // Debounced search
  const debouncedSearch = useCallback(
    debounce((term: string) => {
      setState((prev) => ({ ...prev, searchTerm: term }));
    }, 300),
    [],
  );

  // Handle drag start
  const handleDragStart = (event: DragStartEvent) => {
    setDraggedItem(event.active.id as string);
  };

  // Handle drag end - main mapping logic
  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setDraggedItem(null);

    if (!over) return;

    const sourceFieldId = active.id as string;
    const targetFieldId = over.id as string;

    // Check if this is a valid mapping (source -> target)
    const sourceField = state.sourceFields.find((f) => f.id === sourceFieldId);
    const targetField = state.targetFields.find((f) => f.id === targetFieldId);

    if (!sourceField || !targetField) return;

    // Create or update mapping
    const existingMappingIndex = state.mappings.findIndex(
      (m) => m.apiFieldId === targetFieldId,
    );

    let newMappings: FieldMapping[];

    if (existingMappingIndex >= 0) {
      // Update existing mapping
      newMappings = [...state.mappings];
      newMappings[existingMappingIndex] = {
        ...newMappings[existingMappingIndex],
        csvHeader: sourceField.name,
      };
      // Store source field ID for our internal use
      (newMappings[existingMappingIndex] as any).sourceFieldId = sourceFieldId;
    } else {
      // Create new mapping
      const now = new Date();
      const newMapping: FieldMapping = {
        id: `mapping-${Date.now()}`,
        userId: "", // Will be set by backend
        fileUploadId: csvUploadId,
        apiConfigurationId: apiSpecId,
        mappingName: `${sourceField.name} → ${targetField.name}`,
        mappingConfig: {
          sourceFields: [sourceField],
          targetFields: [targetField],
          fieldMappings: [
            {
              id: `def-${Date.now()}`,
              sourceFieldId: sourceFieldId,
              targetFieldId: targetFieldId,
              transformations: [],
            },
          ],
          transformations: [],
          settings: {
            skipEmptyRows: true,
            skipHeaderRow: true,
            errorHandling: "log_and_continue" as any,
            batchSize: 100,
            maxErrors: 10,
          },
        },
        isActive: true,
        csvHeader: sourceField.name,
        required: targetField.required,
        apiFieldId: targetFieldId,
        apiFieldName: targetField.name,
        createdAt: now,
        updatedAt: now,
      };
      // Store source field ID for our internal use
      (newMapping as any).sourceFieldId = sourceFieldId;
      newMappings = [...state.mappings, newMapping];
    }

    setState((prev) => ({ ...prev, mappings: newMappings }));

    // Validate mappings
    validateMappings(newMappings);
  };

  // Validate mappings and generate errors/warnings
  const validateMappings = (mappings: FieldMapping[]) => {
    const errors: ValidationError[] = [];

    mappings.forEach((mapping) => {
      const targetField = state.targetFields.find(
        (f) => f.id === mapping.apiFieldId,
      );
      const sourceField = state.sourceFields.find(
        (f) => f.id === (mapping as any).sourceFieldId,
      );

      if (!targetField || !sourceField) return;

      // Type compatibility check
      if (!isTypeCompatible(sourceField.type, targetField.type)) {
        errors.push({
          fieldId: mapping.id,
          type: "warning",
          message: `Type mismatch: ${sourceField.type} → ${targetField.type}`,
          suggestion:
            "Consider adding a transformation to convert the data type",
        });
      }

      // Required field check
      if (targetField.required && !sourceField.sampleValues.some((v) => v)) {
        errors.push({
          fieldId: mapping.id,
          type: "error",
          message: "Required field may have empty values",
          suggestion:
            "Ensure all rows have values for this field or add a default value",
        });
      }

      // Data quality check
      const emptyPercentage =
        sourceField.sampleValues.filter((v) => !v).length /
        sourceField.sampleValues.length;
      if (emptyPercentage > 0.5) {
        errors.push({
          fieldId: mapping.id,
          type: "info",
          message: `${Math.round(emptyPercentage * 100)}% of values are empty`,
          suggestion:
            "Consider adding a conditional transformation or default value",
        });
      }
    });

    setState((prev) => ({ ...prev, validationErrors: errors }));
  };

  // Check type compatibility
  const isTypeCompatible = (
    sourceType: FieldType,
    targetType: FieldType,
  ): boolean => {
    if (sourceType === targetType) return true;

    // String is compatible with most types
    if (sourceType === FieldType.STRING) return true;

    // Number is compatible with string, currency, percentage
    if (sourceType === FieldType.NUMBER) {
      return [
        FieldType.STRING,
        FieldType.CURRENCY,
        FieldType.PERCENTAGE,
      ].includes(targetType);
    }

    // Date is compatible with string
    if (sourceType === FieldType.DATE) {
      return targetType === FieldType.STRING;
    }

    return false;
  };

  // Remove mapping
  const removeMapping = (mappingId: string) => {
    setState((prev) => ({
      ...prev,
      mappings: prev.mappings.filter((m) => m.id !== mappingId),
    }));
  };

  // Clear all mappings
  const clearAllMappings = () => {
    setState((prev) => ({
      ...prev,
      mappings: [],
      validationErrors: [],
    }));
  };

  // Filter fields based on search
  const filteredSourceFields = state.sourceFields.filter((field) =>
    field.name.toLowerCase().includes(state.searchTerm.toLowerCase()),
  );

  const filteredTargetFields = state.targetFields.filter((field) =>
    field.name.toLowerCase().includes(state.searchTerm.toLowerCase()),
  );

  // Get validation status for a field
  const getValidationStatus = (fieldId: string) => {
    const error = state.validationErrors.find((e) => e.fieldId === fieldId);
    if (!error) return "success";
    return error.type;
  };

  if (isLoading) {
    return (
      <div className={cn("flex items-center justify-center py-12", className)}>
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <Text>Loading mapping interface...</Text>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Title level={3}>Field Mapping</Title>
          <Text type="secondary">
            Drag CSV columns to API parameters to create mappings
          </Text>
        </div>
        <Space>
          {onBack && (
            <CustomButton variant="outline" onClick={onBack}>
              Back
            </CustomButton>
          )}
          <Button
            type="primary"
            onClick={() => onMappingComplete(state.mappings)}
            disabled={state.mappings.length === 0}
          >
            Continue ({state.mappings.length} mappings)
          </Button>
        </Space>
      </div>

      {/* Search and Controls */}
      <Card size="small">
        <div className="flex items-center justify-between">
          <Input
            placeholder="Search fields..."
            prefix={<SearchOutlined />}
            onChange={(e) => debouncedSearch(e.target.value)}
            style={{ width: 300 }}
            allowClear
          />
          <Space>
            <Badge
              count={
                state.validationErrors.filter((e) => e.type === "error").length
              }
              showZero
            >
              <Button icon={<ExclamationCircleOutlined />} size="small">
                Errors
              </Button>
            </Badge>
            <Badge
              count={
                state.validationErrors.filter((e) => e.type === "warning")
                  .length
              }
              showZero
            >
              <Button icon={<InfoCircleOutlined />} size="small">
                Warnings
              </Button>
            </Badge>
            <Button
              icon={<ClearOutlined />}
              size="small"
              onClick={clearAllMappings}
              disabled={state.mappings.length === 0}
            >
              Clear All
            </Button>
          </Space>
        </div>
      </Card>

      {/* Main Mapping Interface */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* CSV Columns (Source) */}
          <Card title="CSV Columns" size="small" className="h-fit">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              <SortableContext
                items={filteredSourceFields.map((f) => f.id)}
                strategy={verticalListSortingStrategy}
              >
                {filteredSourceFields.map((field) => (
                  <DraggableColumn
                    key={field.id}
                    field={field}
                    isDragged={draggedItem === field.id}
                    isMapped={state.mappings.some(
                      (m) => (m as any).sourceFieldId === field.id,
                    )}
                  />
                ))}
              </SortableContext>
            </div>
          </Card>

          {/* Mapping Canvas */}
          <Card title="Mapping Canvas" size="small" className="h-fit">
            <MappingCanvas
              mappings={state.mappings}
              sourceFields={state.sourceFields}
              targetFields={state.targetFields}
              onRemoveMapping={removeMapping}
            />
          </Card>

          {/* API Parameters (Target) */}
          <Card title="API Parameters" size="small" className="h-fit">
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {filteredTargetFields.map((field) => {
                const mapping = state.mappings.find(
                  (m) => m.apiFieldId === field.id,
                );
                const validationStatus = mapping
                  ? getValidationStatus(mapping.id)
                  : "default";

                return (
                  <DroppableParameter
                    key={field.id}
                    field={field}
                    mapping={mapping}
                    validationStatus={validationStatus}
                    isDraggedOver={!!draggedItem && !mapping}
                  />
                );
              })}
            </div>
          </Card>
        </div>
      </DndContext>

      {/* Validation Panel */}
      {state.validationErrors.length > 0 && (
        <ValidationPanel errors={state.validationErrors} />
      )}
    </div>
  );
};

export default DragDropMappingInterface;
