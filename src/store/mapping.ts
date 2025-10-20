import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { FieldMapping, TransformationRule, ApiField, CsvRow } from '../types';
import { apiService, mappingService } from '../services/api';

interface MappingStore {
  csvHeaders: string[];
  csvData: CsvRow[];
  apiFields: ApiField[];
  mappings: FieldMapping[];
  transformationRules: TransformationRule[];
  isLoading: boolean;
  
  setCsvData: (headers: string[], data: CsvRow[]) => void;
  setApiFields: (fields: ApiField[]) => void;
  setMappings: (mappings: Partial<FieldMapping>[]) => void;
  addTransformationRule: (rule: Omit<TransformationRule, 'id'>) => void;
  updateTransformationRule: (ruleId: string, updates: Partial<TransformationRule>) => void;
  deleteTransformationRule: (ruleId: string) => void;
  saveMapping: () => Promise<void>;
  loadMapping: (mappingId: string) => Promise<void>;
  fetchApiFields: (apiConfigId: string) => Promise<void>;
  clearMapping: () => void;
}

export const useMappingStore = create<MappingStore>()(
  persist(
    (set, get) => ({
      csvHeaders: [],
      csvData: [],
      apiFields: [],
      mappings: [],
      transformationRules: [],
      isLoading: false,

      setCsvData: (headers: string[], data: CsvRow[]) => {
        set({
          csvHeaders: headers,
          csvData: data,
        });
        
        // Auto-generate mappings based on header names
        const autoMappings: Partial<FieldMapping>[] = headers.map(header => ({
          id: `mapping-${header}`,
          csvHeader: header,
          apiFieldId: '',
          apiFieldName: '',
          required: false,
        }));
        
        set({ mappings: autoMappings });
      },

      setApiFields: (fields: ApiField[]) => {
        set({ apiFields: fields });
        
        // Update existing mappings with API field names
        const { mappings } = get();
        const updatedMappings = mappings.map((mapping: any) => {
          const apiField = fields.find((f: any) => f.id === mapping.apiFieldId);
          return {
            ...mapping,
            apiFieldName: apiField?.name || '',
            required: apiField?.required || false,
          };
        });
        
        set({ mappings: updatedMappings });
      },

      setMappings: (newMappings: Partial<FieldMapping>[]) => {
        const { apiFields } = get();
        const updatedMappings = newMappings.map((mapping: any) => {
          const apiField = apiFields.find((f: any) => f.id === mapping.apiFieldId);
          return {
            ...mapping,
            apiFieldName: apiField?.name || '',
            required: apiField?.required || mapping.required,
          };
        });
        
        set({ mappings: updatedMappings });
      },

      addTransformationRule: (rule: Omit<TransformationRule, 'id'>) => {
        const newRule: TransformationRule = {
          ...rule,
          id: `rule-${Date.now()}`,
        };
        
        set((state: any) => ({
          transformationRules: [...state.transformationRules, newRule],
        }));
      },

      updateTransformationRule: (ruleId: string, updates: Partial<TransformationRule>) => {
        set((state: any) => ({
          transformationRules: state.transformationRules.map((rule: any) =>
            rule.id === ruleId ? { ...rule, ...updates } : rule
          ),
        }));
      },

      deleteTransformationRule: (ruleId: string) => {
        set((state: any) => ({
          transformationRules: state.transformationRules.filter((rule: any) => rule.id !== ruleId),
        }));
      },

      saveMapping: async () => {
        const { mappings, transformationRules } = get();
        set({ isLoading: true });
        
        try {
          await mappingService.createMapping({
            name: 'New Mapping',
            mappings,
            transformationRules,
          });
          set({ isLoading: false });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      loadMapping: async (mappingId: string) => {
        set({ isLoading: true });
        
        try {
          const mapping = await mappingService.getMapping(mappingId) as any;
          set({
            mappings: mapping.mappings || [],
            transformationRules: mapping.transformationRules || [],
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      fetchApiFields: async (apiConfigId: string) => {
        set({ isLoading: true });
        
        try {
          const config = await apiService.getApiConfiguration(apiConfigId);
          set({
            apiFields: (config as any)?.fields || [],
            isLoading: false,
          });
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      clearMapping: () => {
        set({
          csvHeaders: [],
          csvData: [],
          mappings: [],
          transformationRules: [],
        });
      },
    }),
    {
      name: 'mapping-storage',
      partialize: (state: any) => ({
        csvHeaders: state.csvHeaders,
        csvData: state.csvData.slice(0, 10), // Only persist first 10 rows
        mappings: state.mappings,
        transformationRules: state.transformationRules,
      }),
    }
  )
);