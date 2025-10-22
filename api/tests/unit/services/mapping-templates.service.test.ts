import { MappingTemplatesService } from "../../../services/mapping-templates.service";
import { DatabaseService } from "../../../services/database.service";

jest.mock("../../../services/database.service");

describe("MappingTemplatesService", () => {
  let service: MappingTemplatesService;
  let mockDatabaseService: jest.Mocked<DatabaseService>;

  beforeEach(() => {
    mockDatabaseService = new DatabaseService() as jest.Mocked<DatabaseService>;
    service = new MappingTemplatesService(mockDatabaseService);
  });

  const createMockTemplate = (overrides: any = {}) => ({
    id: "template_123",
    name: "User Import Template",
    description: "Template for importing user data",
    category: "user_management",
    tags: ["user", "import"],
    is_public: true,
    created_by: "user_123",
    usage_count: 10,
    mappings: [
      { sourceField: "first_name", targetField: "firstName" },
      { sourceField: "last_name", targetField: "lastName" },
    ],
    created_at: new Date(),
    updated_at: new Date(),
    ...overrides,
  });

  describe("getTemplates", () => {
    it("should return templates with total count", async () => {
      const mockTemplates = [createMockTemplate()];
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: mockTemplates })
        .mockResolvedValueOnce({ rows: [{ count: 1 }] });

      const result = await service.getTemplates();

      expect(result.templates).toEqual(mockTemplates);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(50);
    });

    it("should filter by user ID", async () => {
      const userId = "user_123";
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getTemplates({ userId });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("t.created_by = $"),
        expect.arrayContaining([userId]),
      );
    });

    it("should filter by category", async () => {
      const category = "user_management";
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getTemplates({ category });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("t.category = $"),
        expect.arrayContaining([category]),
      );
    });

    it("should filter by tags", async () => {
      const tags = ["user", "import"];
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getTemplates({ tags });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("t.tags && $"),
        expect.arrayContaining([tags]),
      );
    });

    it("should search by name and description", async () => {
      const search = "user import";
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getTemplates({ search });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("(t.name ILIKE $ OR t.description ILIKE $)"),
        expect.arrayContaining([`%${search}%`]),
      );
    });

    it("should handle pagination", async () => {
      const page = 2;
      const limit = 10;
      mockDatabaseService.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [{ count: 0 }] });

      await service.getTemplates({ page, limit });

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $ OFFSET $"),
        expect.arrayContaining([limit, (page - 1) * limit]),
      );
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getTemplates()).rejects.toThrow("Database error");
    });
  });

  describe("getTemplateById", () => {
    it("should return template when found", async () => {
      const mockTemplate = createMockTemplate();
      mockDatabaseService.query.mockResolvedValue({ rows: [mockTemplate] });

      const result = await service.getTemplateById("template_123");

      expect(result).toEqual(mockTemplate);
    });

    it("should return null when template not found", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      const result = await service.getTemplateById("nonexistent");

      expect(result).toBeNull();
    });

    it("should check user access for private templates", async () => {
      const privateTemplate = createMockTemplate({
        is_public: false,
        created_by: "user_456",
      });
      mockDatabaseService.query.mockResolvedValue({ rows: [privateTemplate] });

      const result = await service.getTemplateById("template_123", "user_123");

      expect(result).toBeNull();
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getTemplateById("template_123")).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("createTemplate", () => {
    it("should create template successfully", async () => {
      const templateData = {
        name: "New Template",
        description: "Test template",
        category: "test",
        tags: ["test"],
        is_public: true,
        created_by: "user_123",
        mappings: [{ sourceField: "field1", targetField: "field2" }],
      };

      const createdTemplate = createMockTemplate(templateData);
      mockDatabaseService.query.mockResolvedValue({ rows: [createdTemplate] });

      const result = await service.createTemplate(templateData);

      expect(result).toEqual(createdTemplate);
    });

    it("should handle database errors", async () => {
      const templateData = { name: "Test", created_by: "user_123" };
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.createTemplate(templateData)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("updateTemplate", () => {
    it("should update template successfully", async () => {
      const updateData = { name: "Updated Template" };
      const updatedTemplate = createMockTemplate(updateData);
      mockDatabaseService.query.mockResolvedValue({ rows: [updatedTemplate] });

      const result = await service.updateTemplate(
        "template_123",
        updateData,
        "user_123",
      );

      expect(result).toEqual(updatedTemplate);
    });

    it("should reject update for non-owner", async () => {
      const template = createMockTemplate({ created_by: "user_456" });
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [template] });

      await expect(
        service.updateTemplate("template_123", { name: "Updated" }, "user_123"),
      ).rejects.toThrow("Access denied");
    });

    it("should handle template not found", async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.updateTemplate("nonexistent", { name: "Updated" }, "user_123"),
      ).rejects.toThrow("Template not found");
    });
  });

  describe("deleteTemplate", () => {
    it("should delete template successfully", async () => {
      const template = createMockTemplate({ created_by: "user_123" });
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [template] });
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.deleteTemplate("template_123", "user_123"),
      ).resolves.not.toThrow();
    });

    it("should reject delete for non-owner", async () => {
      const template = createMockTemplate({ created_by: "user_456" });
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [template] });

      await expect(
        service.deleteTemplate("template_123", "user_123"),
      ).rejects.toThrow("Access denied");
    });
  });

  describe("getCategories", () => {
    it("should return distinct categories", async () => {
      const categories = [
        { category: "user_management" },
        { category: "import" },
      ];
      mockDatabaseService.query.mockResolvedValue({ rows: categories });

      const result = await service.getCategories();

      expect(result).toEqual(["user_management", "import"]);
    });

    it("should handle database errors", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.getCategories()).rejects.toThrow("Database error");
    });
  });

  describe("getPopularTags", () => {
    it("should return popular tags with counts", async () => {
      const tags = [
        { tag: "user", count: 10 },
        { tag: "import", count: 5 },
      ];
      mockDatabaseService.query.mockResolvedValue({ rows: tags });

      const result = await service.getPopularTags();

      expect(result).toEqual(tags);
    });

    it("should limit results as specified", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await service.getPopularTags(5);

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("LIMIT $"),
        expect.arrayContaining([5]),
      );
    });
  });

  describe("incrementUsage", () => {
    it("should increment usage count successfully", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await expect(
        service.incrementUsage("template_123"),
      ).resolves.not.toThrow();

      expect(mockDatabaseService.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE mapping_templates"),
        expect.arrayContaining(["template_123"]),
      );
    });

    it("should handle database errors gracefully", async () => {
      mockDatabaseService.query.mockRejectedValue(new Error("Database error"));

      await expect(service.incrementUsage("template_123")).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("getAutoMappingSuggestions", () => {
    it("should generate auto-mapping suggestions", async () => {
      const csvHeaders = ["first_name", "last_name", "email"];
      const apiFields = ["firstName", "lastName", "email"];

      const result = await service.getAutoMappingSuggestions(
        csvHeaders,
        apiFields,
      );

      expect(result.suggestions).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            sourceField: "first_name",
            targetField: "firstName",
            confidence: expect.any(Number),
          }),
        ]),
      );
    });

    it("should calculate confidence correctly", async () => {
      const csvHeaders = ["first_name"];
      const apiFields = ["firstName"];

      const result = await service.getAutoMappingSuggestions(
        csvHeaders,
        apiFields,
      );

      expect(result.suggestions[0].confidence).toBeGreaterThan(0);
    });

    it("should handle empty results gracefully", async () => {
      const result = await service.getAutoMappingSuggestions([], []);

      expect(result.suggestions).toEqual([]);
    });

    it("should limit suggestions as specified", async () => {
      const csvHeaders = Array.from({ length: 100 }, (_, i) => `field_${i}`);
      const apiFields = Array.from({ length: 100 }, (_, i) => `target_${i}`);

      const result = await service.getAutoMappingSuggestions(
        csvHeaders,
        apiFields,
        10,
      );

      expect(result.suggestions.length).toBeLessThanOrEqual(10);
    });
  });

  describe("createTemplateFromMapping", () => {
    it("should create template from mapping successfully", async () => {
      const mapping = createMockTemplate();
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [mapping] });

      const templateData = {
        name: "Template from Mapping",
        description: "Generated from mapping",
        category: "generated",
        is_public: false,
        created_by: "user_123",
      };

      const createdTemplate = createMockTemplate(templateData);
      mockDatabaseService.query.mockResolvedValueOnce({
        rows: [createdTemplate],
      });

      const result = await service.createTemplateFromMapping(
        "mapping_123",
        templateData,
      );

      expect(result).toEqual(createdTemplate);
    });

    it("should handle mapping not found", async () => {
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        service.createTemplateFromMapping("nonexistent", {
          name: "Test",
          created_by: "user_123",
        }),
      ).rejects.toThrow("Mapping not found");
    });

    it("should handle access denied", async () => {
      const mapping = createMockTemplate({ user_id: "user_456" });
      mockDatabaseService.query.mockResolvedValueOnce({ rows: [mapping] });

      await expect(
        service.createTemplateFromMapping("mapping_123", {
          name: "Test",
          created_by: "user_123",
        }),
      ).rejects.toThrow("Access denied");
    });
  });

  describe("Helper Methods", () => {
    describe("calculateFieldOverlap", () => {
      it("should calculate field overlap correctly", () => {
        const source = ["first_name", "last_name"];
        const target = ["firstName", "lastName"];

        const overlap = (service as any).calculateFieldOverlap(
          source[0],
          target,
        );

        expect(overlap).toBeGreaterThan(0);
      });
    });

    describe("calculateTemplateConfidence", () => {
      it("should calculate confidence with usage boost", () => {
        const baseConfidence = 0.8;
        const usageCount = 10;

        const confidence = (service as any).calculateTemplateConfidence(
          baseConfidence,
          usageCount,
        );

        expect(confidence).toBeGreaterThan(baseConfidence);
        expect(confidence).toBeLessThanOrEqual(1);
      });
    });

    describe("generateSuggestionReason", () => {
      it("should generate appropriate reason text", () => {
        const reason = (service as any).generateSuggestionReason(
          "first_name",
          "firstName",
          0.9,
        );

        expect(reason).toContain("High confidence");
        expect(reason).toContain("first_name");
        expect(reason).toContain("firstName");
      });

      it("should handle zero overlaps", () => {
        const reason = (service as any).generateSuggestionReason(
          "field1",
          "field2",
          0,
        );

        expect(reason).toContain("Low confidence");
      });
    });

    describe("normalizeFieldName", () => {
      it("should normalize field names correctly", () => {
        const normalized = (service as any).normalizeFieldName("First_Name");

        expect(normalized).toBe("firstname");
      });

      it("should remove special characters", () => {
        const normalized = (service as any).normalizeFieldName(
          "field-name_123",
        );

        expect(normalized).toBe("fieldname123");
      });
    });
  });

  describe("Performance Tests", () => {
    it("should handle large template sets efficiently", async () => {
      const largeTemplateSet = Array.from({ length: 1000 }, (_, i) =>
        createMockTemplate({ id: `template_${i}` }),
      );
      mockDatabaseService.query.mockResolvedValue({ rows: largeTemplateSet });

      const startTime = Date.now();
      const result = await service.getTemplates();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.templates).toHaveLength(1000);
    });
  });

  describe("Edge Cases", () => {
    it("should handle empty parameters gracefully", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await expect(service.getTemplates({})).resolves.not.toThrow();
      await expect(service.getTemplateById("")).resolves.not.toThrow();
    });

    it("should handle null/undefined inputs", async () => {
      mockDatabaseService.query.mockResolvedValue({ rows: [] });

      await expect(service.getTemplates(null as any)).resolves.not.toThrow();
      await expect(
        service.getTemplateById(undefined as any),
      ).resolves.not.toThrow();
    });
  });
});
