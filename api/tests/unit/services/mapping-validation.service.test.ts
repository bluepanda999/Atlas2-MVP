import { MappingValidationService } from "../../../services/mapping-validation.service";
import { MappingRepository } from "../../../repositories/mapping.repository";
import { DatabaseService } from "../../../services/database.service";

// Mock the DatabaseService
jest.mock("../../../services/database.service");
jest.mock("../../../repositories/mapping.repository");

describe("MappingValidationService", () => {
  let service: MappingValidationService;
  let mockMappingRepository: jest.Mocked<MappingRepository>;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    mockMappingRepository = new MappingRepository(
      mockDatabaseService,
    ) as jest.Mocked<MappingRepository>;
    service = new MappingValidationService(mockMappingRepository);
  });

  // Test fixture matching the expected interface
  const createValidMapping = (overrides: any = {}) => ({
    id: "mapping_123",
    user_id: "user_123",
    name: "User Import Mapping",
    description: "Mapping for user data import",
    api_config_id: "api_123",
    mappings: [
      {
        sourceField: "first_name",
        targetField: "firstName",
        transformation: { type: "none" },
      },
    ],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  describe("validateMapping", () => {
    it("should validate a correct mapping successfully", async () => {
      const validMapping = createValidMapping();
      const result = await service.validateMapping(validMapping);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing mapping name", async () => {
      const invalidMapping = createValidMapping({ name: "" });
      const result = await service.validateMapping(invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "required_field",
            field: "name",
            message: "Mapping name is required",
          }),
        ]),
      );
    });

    it("should detect empty mappings array", async () => {
      const invalidMapping = createValidMapping({ mappings: [] });
      const result = await service.validateMapping(invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "required_field",
            field: "mappings",
            message: "At least one mapping is required",
          }),
        ]),
      );
    });

    it("should detect duplicate source fields", async () => {
      const invalidMapping = createValidMapping({
        mappings: [
          {
            sourceField: "name",
            targetField: "firstName",
            transformation: { type: "none" },
          },
          {
            sourceField: "name",
            targetField: "lastName",
            transformation: { type: "none" },
          },
        ],
      });
      const result = await service.validateMapping(invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "required_field",
            field: "mappings",
            message: "Duplicate source field detected: name",
          }),
        ]),
      );
    });

    it("should validate CSV headers when provided", async () => {
      const validMapping = createValidMapping();
      const csvHeaders = ["first_name", "last_name", "email"];
      const result = await service.validateMapping(validMapping, csvHeaders);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing CSV headers", async () => {
      const validMapping = createValidMapping();
      const csvHeaders = ["last_name", "email"]; // missing first_name
      const result = await service.validateMapping(validMapping, csvHeaders);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "unused_field",
            field: "first_name",
            message: "Source field 'first_name' not found in CSV headers",
          }),
        ]),
      );
    });

    it("should suggest mappings for unmapped CSV headers", async () => {
      const validMapping = createValidMapping();
      const csvHeaders = ["first_name", "last_name", "email"];
      const result = await service.validateMapping(validMapping, csvHeaders);

      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "field_mapping",
            field: "last_name",
            message: "Consider mapping 'last_name' to 'lastName'",
          }),
        ]),
      );
    });

    it("should validate API schema when provided", async () => {
      const validMapping = createValidMapping();
      const apiSchema = {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
        },
        required: ["firstName"],
      };
      const result = await service.validateMapping(
        validMapping,
        undefined,
        apiSchema,
      );

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect missing required API fields", async () => {
      const validMapping = createValidMapping({
        mappings: [
          {
            sourceField: "first_name",
            targetField: "lastName",
            transformation: { type: "none" },
          },
        ],
      });
      const apiSchema = {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
        },
        required: ["firstName"],
      };
      const result = await service.validateMapping(
        validMapping,
        undefined,
        apiSchema,
      );

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "unused_field",
            field: "firstName",
            message: "Required API field 'firstName' is not mapped",
          }),
        ]),
      );
    });

    it("should detect circular references in transformations", async () => {
      const invalidMapping = createValidMapping({
        mappings: [
          {
            sourceField: "field_a",
            targetField: "field_b",
            transformation: { type: "reference", field: "field_c" },
          },
          {
            sourceField: "field_b",
            targetField: "field_c",
            transformation: { type: "reference", field: "field_a" },
          },
          {
            sourceField: "field_c",
            targetField: "field_a",
            transformation: { type: "reference", field: "field_b" },
          },
        ],
      });
      const result = await service.validateMapping(invalidMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "circular_reference",
            field: "field_a",
            message: "Circular reference detected in transformation chain",
          }),
        ]),
      );
    });

    it("should warn about data loss risks in transformations", async () => {
      const validMapping = createValidMapping({
        mappings: [
          {
            sourceField: "description",
            targetField: "title",
            transformation: { type: "truncate", length: 50 },
          },
        ],
      });
      const result = await service.validateMapping(validMapping);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "data_loss_risk",
            field: "description",
            message: "Truncation may cause data loss",
          }),
        ]),
      );
    });

    it("should calculate completeness correctly", async () => {
      const validMapping = createValidMapping();
      const csvHeaders = ["first_name", "last_name", "email"];
      const apiSchema = {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
        },
        required: ["firstName", "lastName"],
      };
      const result = await service.validateMapping(
        validMapping,
        csvHeaders,
        apiSchema,
      );

      expect(result.completeness).toBeGreaterThan(0);
      expect(result.completeness).toBeLessThanOrEqual(100);
    });
  });

  describe("saveMapping", () => {
    it("should save a valid mapping successfully", async () => {
      const mappingToSave = createValidMapping();
      delete mappingToSave.id;
      delete mappingToSave.created_at;
      delete mappingToSave.updated_at;

      const savedMapping = createValidMapping();
      mockMappingRepository.create.mockResolvedValue(savedMapping);

      const result = await service.saveMapping(mappingToSave as any);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(savedMapping);
      expect(mockMappingRepository.create).toHaveBeenCalledWith(mappingToSave);
    });

    it("should update an existing mapping", async () => {
      const existingMapping = createValidMapping();
      const updatedMapping = { ...existingMapping, name: "Updated Mapping" };

      mockMappingRepository.update.mockResolvedValue(updatedMapping);

      const result = await service.saveMapping(updatedMapping);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(updatedMapping);
      expect(mockMappingRepository.update).toHaveBeenCalledWith(
        existingMapping.id,
        updatedMapping,
      );
    });

    it("should reject invalid mapping", async () => {
      const invalidMapping = createValidMapping({ name: "" });
      const result = await service.saveMapping(invalidMapping);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid mapping");
    });

    it("should handle database errors", async () => {
      const validMapping = createValidMapping();
      delete validMapping.id;
      delete validMapping.created_at;
      delete validMapping.updated_at;

      mockMappingRepository.create.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.saveMapping(validMapping as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to save mapping");
    });
  });

  describe("exportMapping", () => {
    it("should export mapping successfully", async () => {
      const validMapping = createValidMapping();
      mockMappingRepository.findById.mockResolvedValue(validMapping);

      const result = await service.exportMapping("mapping_123");

      expect(result.success).toBe(true);
      expect(result.result).toEqual(validMapping);
    });

    it("should handle mapping not found", async () => {
      mockMappingRepository.findById.mockResolvedValue(null);

      const result = await service.exportMapping("nonexistent");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Mapping not found");
    });

    it("should handle database errors during export", async () => {
      mockMappingRepository.findById.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.exportMapping("mapping_123");

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to export mapping");
    });
  });

  describe("importMapping", () => {
    it("should import mapping successfully", async () => {
      const mappingToImport = createValidMapping();
      delete mappingToImport.id;
      delete mappingToImport.created_at;
      delete mappingToImport.updated_at;

      const importedMapping = createValidMapping({ id: "new_mapping_id" });
      mockMappingRepository.create.mockResolvedValue(importedMapping);

      const result = await service.importMapping(mappingToImport as any);

      expect(result.success).toBe(true);
      expect(result.result).toEqual(importedMapping);
    });

    it("should reject invalid import data format", async () => {
      const invalidData = { invalid: "data" };

      const result = await service.importMapping(invalidData as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid import data format");
    });

    it("should reject invalid mapping during import", async () => {
      const invalidMapping = createValidMapping({ name: "" });
      delete invalidMapping.id;
      delete invalidMapping.created_at;
      delete invalidMapping.updated_at;

      const result = await service.importMapping(invalidMapping as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid mapping configuration");
    });

    it("should handle database errors during import", async () => {
      const validMapping = createValidMapping();
      delete validMapping.id;
      delete validMapping.created_at;
      delete validMapping.updated_at;

      mockMappingRepository.create.mockRejectedValue(
        new Error("Database error"),
      );

      const result = await service.importMapping(validMapping as any);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to import mapping");
    });
  });

  describe("Helper Methods", () => {
    it("should calculate mapping confidence for common field patterns", async () => {
      const sourceField = "first_name";
      const targetField = "firstName";

      // Access private method through type assertion for testing
      const confidence = (service as any).calculateMappingConfidence(
        sourceField,
        targetField,
      );

      expect(confidence).toBeGreaterThan(0);
      expect(confidence).toBeLessThanOrEqual(100);
    });

    it("should extract required fields from API schema", async () => {
      const apiSchema = {
        type: "object",
        properties: {
          firstName: { type: "string" },
          lastName: { type: "string" },
          email: { type: "string" },
        },
        required: ["firstName", "email"],
      };

      const requiredFields = (service as any).extractRequiredFields(apiSchema);

      expect(requiredFields).toEqual(["firstName", "email"]);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty mapping gracefully", async () => {
      const emptyMapping = createValidMapping({ mappings: [] });
      const result = await service.validateMapping(emptyMapping);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should handle null/undefined inputs", async () => {
      const result1 = await service.validateMapping(null as any);
      const result2 = await service.validateMapping(undefined as any);

      expect(result1.isValid).toBe(false);
      expect(result2.isValid).toBe(false);
    });

    it("should handle transformation type validation", async () => {
      const mappingWithInvalidTransform = createValidMapping({
        mappings: [
          {
            sourceField: "field1",
            targetField: "field2",
            transformation: { type: "invalid_type" },
          },
        ],
      });

      const result = await service.validateMapping(mappingWithInvalidTransform);

      expect(result.warnings).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: "transformation_error",
            field: "field1",
          }),
        ]),
      );
    });
  });

  describe("Performance Tests", () => {
    it("should handle large mapping sets efficiently", async () => {
      const largeMapping = createValidMapping({
        mappings: Array.from({ length: 1000 }, (_, i) => ({
          sourceField: `field_${i}`,
          targetField: `target_${i}`,
          transformation: { type: "none" },
        })),
      });

      const startTime = Date.now();
      const result = await service.validateMapping(largeMapping);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000); // Should complete within 1 second
      expect(result.isValid).toBe(true);
    });
  });
});
