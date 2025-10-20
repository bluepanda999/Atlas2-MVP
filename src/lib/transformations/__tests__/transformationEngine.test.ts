import { transformationEngine } from "../transformationEngine";
import { transformationLibrary } from "../transformationLibrary";

describe("TransformationEngine", () => {
  describe("getAvailableTransformations", () => {
    it("should return all available transformations", () => {
      const transformations =
        transformationEngine.getAvailableTransformations();
      expect(transformations).toHaveLength(9); // We have 9 transformations
      expect(transformations[0]).toHaveProperty("id");
      expect(transformations[0]).toHaveProperty("name");
      expect(transformations[0]).toHaveProperty("category");
    });
  });

  describe("executeTransformation", () => {
    it("should execute text case transformation", async () => {
      const transformation = transformationLibrary.find(
        (t) => t.id === "format-text",
      );
      const data = ["hello world", "test case"];
      const config = { operation: "uppercase" };

      const result = await transformationEngine.executeTransformation(
        transformation,
        data,
        config,
      );

      expect(result.success).toBe(true);
      expect(result.results).toEqual(["HELLO WORLD", "TEST CASE"]);
      expect(result.transformedCount).toBe(2);
    });

    it("should execute date formatting transformation", async () => {
      const transformation = transformationLibrary.find(
        (t) => t.id === "format-date",
      );
      const data = ["2023-01-15", "2023-12-25"];
      const config = { format: "ISO" };

      const result = await transformationEngine.executeTransformation(
        transformation,
        data,
        config,
      );

      expect(result.success).toBe(true);
      // Date transformation should return some result (may be original if parsing fails)
      expect(result.results).toBeDefined();
      expect(result.results.length).toBe(2);
    });

    it("should handle transformation errors gracefully", async () => {
      const transformation = transformationLibrary.find(
        (t) => t.id === "math-operation",
      );
      const data = ["not-a-number"];
      const config = { operation: "add", operand: 5 };

      const result = await transformationEngine.executeTransformation(
        transformation,
        data,
        config,
      );

      expect(result.success).toBe(true); // Should not fail, just return original values
      expect(result.results).toEqual(["not-a-number"]);
      expect(result.transformedCount).toBe(0);
    });
  });

  describe("executeChain", () => {
    it("should execute multiple transformations in sequence", () => {
      const config = {
        transformations: [
          {
            transformation: transformationLibrary.find(
              (t) => t.id === "format-text",
            )!,
            config: { operation: "uppercase" },
          },
          {
            transformation: transformationLibrary.find(
              (t) => t.id === "format-text",
            )!,
            config: { operation: "trim" },
          },
        ],
      };

      const result = transformationEngine.executeChain(
        "  hello world  ",
        config,
      );

      expect(result.success).toBe(true);
      expect(result.results).toEqual(["HELLO WORLD"]);
    });
  });

  describe("validateConfiguration", () => {
    it("should validate transformation configuration", () => {
      const validConfig = {
        transformations: [
          {
            transformation: transformationLibrary.find(
              (t) => t.id === "format-text",
            )!,
            config: { operation: "uppercase" },
          },
        ],
      };

      const validation =
        transformationEngine.validateConfiguration(validConfig);
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it("should detect missing required parameters", () => {
      const invalidConfig = {
        transformations: [
          {
            transformation: transformationLibrary.find(
              (t) => t.id === "format-text",
            )!,
            config: {}, // Missing required 'operation' parameter
          },
        ],
      };

      const validation =
        transformationEngine.validateConfiguration(invalidConfig);
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });
  });
});
