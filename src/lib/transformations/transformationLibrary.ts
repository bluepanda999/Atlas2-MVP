import {
  Transformation,
  TransformationCategory,
  ParameterType,
  TransformationContext,
  TransformationResult,
} from "./types";
import { parseISO } from "date-fns";

// Formatting Transformations
const formatDate: Transformation = {
  id: "format-date",
  name: "Format Date",
  category: TransformationCategory.FORMATTING,
  description: "Convert date to specified format",
  parameters: [
    {
      name: "format",
      type: ParameterType.SELECT,
      required: true,
      options: ["ISO", "US", "EU", "custom"],
      defaultValue: "ISO",
      description: "Date format to use",
    },
    {
      name: "customFormat",
      type: ParameterType.STRING,
      required: false,
      placeholder: "yyyy-MM-dd",
      description: "Custom date format (when format is custom)",
    },
  ],
  execute: (value, [format, customFormat]) => {
    if (!value) return value;

    try {
      const date =
        typeof value === "string" ? parseISO(value) : new Date(value);
      if (isNaN(date.getTime())) return value;

      switch (format) {
        case "ISO":
          return date.toISOString();
        case "US":
          return format(date, "MM/dd/yyyy");
        case "EU":
          return format(date, "dd/MM/yyyy");
        case "custom":
          return customFormat ? format(date, customFormat) : value;
        default:
          return value;
      }
    } catch {
      return value;
    }
  },
};

const formatText: Transformation = {
  id: "format-text",
  name: "Format Text",
  category: TransformationCategory.FORMATTING,
  description: "Apply text formatting (case, trim, etc.)",
  parameters: [
    {
      name: "operation",
      type: ParameterType.SELECT,
      required: true,
      options: ["uppercase", "lowercase", "title", "trim", "normalize"],
      defaultValue: "lowercase",
      description: "Text operation to apply",
    },
  ],
  execute: (value, [operation]) => {
    if (typeof value !== "string") return value;

    switch (operation) {
      case "uppercase":
        return value.toUpperCase();
      case "lowercase":
        return value.toLowerCase();
      case "title":
        return value.replace(
          /\w\S*/g,
          (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase(),
        );
      case "trim":
        return value.trim();
      case "normalize":
        return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      default:
        return value;
    }
  },
};

const formatNumber: Transformation = {
  id: "format-number",
  name: "Format Number",
  category: TransformationCategory.FORMATTING,
  description: "Format number with decimals and separators",
  parameters: [
    {
      name: "decimals",
      type: ParameterType.NUMBER,
      required: false,
      defaultValue: 2,
      description: "Number of decimal places",
    },
    {
      name: "thousandsSeparator",
      type: ParameterType.BOOLEAN,
      required: false,
      defaultValue: true,
      description: "Add thousands separator",
    },
    {
      name: "currency",
      type: ParameterType.SELECT,
      required: false,
      options: ["none", "USD", "EUR", "GBP"],
      defaultValue: "none",
      description: "Currency format",
    },
  ],
  execute: (
    value,
    [decimals = 2, thousandsSeparator = true, currency = "none"],
  ) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return value;

    let formatted = num.toFixed(decimals);

    if (thousandsSeparator) {
      const parts = formatted.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      formatted = parts.join(".");
    }

    switch (currency) {
      case "USD":
        return `$${formatted}`;
      case "EUR":
        return `€${formatted}`;
      case "GBP":
        return `£${formatted}`;
      default:
        return formatted;
    }
  },
};

// Calculation Transformations
const mathOperation: Transformation = {
  id: "math-operation",
  name: "Math Operation",
  category: TransformationCategory.CALCULATION,
  description: "Apply mathematical operation",
  parameters: [
    {
      name: "operation",
      type: ParameterType.SELECT,
      required: true,
      options: ["add", "subtract", "multiply", "divide", "modulo", "power"],
      defaultValue: "add",
      description: "Mathematical operation",
    },
    {
      name: "operand",
      type: ParameterType.NUMBER,
      required: true,
      defaultValue: 0,
      description: "Number to operate with",
    },
  ],
  execute: (value, [operation, operand]) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return value;

    switch (operation) {
      case "add":
        return num + operand;
      case "subtract":
        return num - operand;
      case "multiply":
        return num * operand;
      case "divide":
        return operand !== 0 ? num / operand : value;
      case "modulo":
        return operand !== 0 ? num % operand : value;
      case "power":
        return Math.pow(num, operand);
      default:
        return value;
    }
  },
};

const percentage: Transformation = {
  id: "percentage",
  name: "Percentage",
  category: TransformationCategory.CALCULATION,
  description: "Convert to percentage or calculate percentage",
  parameters: [
    {
      name: "operation",
      type: ParameterType.SELECT,
      required: true,
      options: ["to-percentage", "of", "increase", "decrease"],
      defaultValue: "to-percentage",
      description: "Percentage operation",
    },
    {
      name: "value",
      type: ParameterType.NUMBER,
      required: false,
      description: "Value for percentage calculation",
    },
  ],
  execute: (value, [operation, value2]) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    if (isNaN(num)) return value;

    switch (operation) {
      case "to-percentage":
        return num * 100;
      case "of":
        return value2 ? (num / 100) * value2 : value;
      case "increase":
        return value2 ? num + (num * value2) / 100 : value;
      case "decrease":
        return value2 ? num - (num * value2) / 100 : value;
      default:
        return value;
    }
  },
};

// Conditional Transformations
const conditionalValue: Transformation = {
  id: "conditional-value",
  name: "Conditional Value",
  category: TransformationCategory.CONDITIONAL,
  description: "Return different values based on conditions",
  parameters: [
    {
      name: "condition",
      type: ParameterType.EXPRESSION,
      required: true,
      placeholder: "value > 100",
      description: "Condition to evaluate",
    },
    {
      name: "trueValue",
      type: ParameterType.STRING,
      required: true,
      description: "Value when condition is true",
    },
    {
      name: "falseValue",
      type: ParameterType.STRING,
      required: true,
      description: "Value when condition is false",
    },
  ],
  execute: (value, [condition, trueValue, falseValue]) => {
    try {
      // Simple condition evaluation for common cases
      const safeCondition = condition.replace(/value/g, JSON.stringify(value));
      const result = Function('"use strict"; return (' + safeCondition + ")")();
      return result ? trueValue : falseValue;
    } catch {
      return value;
    }
  },
};

const replaceValue: Transformation = {
  id: "replace-value",
  name: "Replace Value",
  category: TransformationCategory.CONDITIONAL,
  description: "Replace values based on conditions",
  parameters: [
    {
      name: "find",
      type: ParameterType.STRING,
      required: true,
      description: "Value to find",
    },
    {
      name: "replace",
      type: ParameterType.STRING,
      required: true,
      description: "Replacement value",
    },
    {
      name: "isRegex",
      type: ParameterType.BOOLEAN,
      required: false,
      defaultValue: false,
      description: "Treat find as regular expression",
    },
    {
      name: "ignoreCase",
      type: ParameterType.BOOLEAN,
      required: false,
      defaultValue: true,
      description: "Ignore case when matching",
    },
  ],
  execute: (value, [find, replace, isRegex = false, ignoreCase = true]) => {
    if (typeof value !== "string") return value;

    try {
      if (isRegex) {
        const flags = ignoreCase ? "gi" : "g";
        const regex = new RegExp(find, flags);
        return value.replace(regex, replace);
      } else {
        if (ignoreCase) {
          const regex = new RegExp(
            find.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
            "gi",
          );
          return value.replace(regex, replace);
        }
        return value.split(find).join(replace);
      }
    } catch {
      return value;
    }
  },
};

// Lookup Transformations
const lookupTable: Transformation = {
  id: "lookup-table",
  name: "Lookup Table",
  category: TransformationCategory.LOOKUP,
  description: "Map values using a lookup table",
  parameters: [
    {
      name: "lookupData",
      type: ParameterType.ARRAY,
      required: true,
      description: "Lookup data as key-value pairs",
    },
    {
      name: "defaultValue",
      type: ParameterType.STRING,
      required: false,
      description: "Default value when no match found",
    },
  ],
  execute: (value, [lookupData, defaultValue]) => {
    if (!Array.isArray(lookupData)) return value;

    const lookup = lookupData.reduce(
      (acc, item) => {
        if (
          item &&
          typeof item === "object" &&
          "key" in item &&
          "value" in item
        ) {
          acc[item.key] = item.value;
        }
        return acc;
      },
      {} as Record<string, any>,
    );

    return lookup[String(value)] ?? defaultValue ?? value;
  },
};

// Custom Transformation
const customExpression: Transformation = {
  id: "custom-expression",
  name: "Custom Expression",
  category: TransformationCategory.CUSTOM,
  description: "Apply custom JavaScript expression",
  parameters: [
    {
      name: "expression",
      type: ParameterType.EXPRESSION,
      required: true,
      placeholder: "value * 2 + 10",
      description: "JavaScript expression to evaluate",
    },
  ],
  execute: (value, [expression]) => {
    try {
      // Create a safe execution context
      const safeExpression = expression.replace(
        /value/g,
        JSON.stringify(value),
      );
      const result = Function(
        '"use strict"; const value = ' +
          JSON.stringify(value) +
          "; return (" +
          safeExpression +
          ")",
      )();
      return result;
    } catch (error) {
      console.warn("Custom expression failed:", error);
      return value;
    }
  },
};

// Transformation Library
export const transformationLibrary: Transformation[] = [
  // Formatting
  formatDate,
  formatText,
  formatNumber,

  // Calculations
  mathOperation,
  percentage,

  // Conditionals
  conditionalValue,
  replaceValue,

  // Lookups
  lookupTable,

  // Custom
  customExpression,
];

export const getTransformation = (id: string): Transformation | undefined => {
  return transformationLibrary.find((t) => t.id === id);
};

export const getTransformationsByCategory = (
  category: TransformationCategory,
): Transformation[] => {
  return transformationLibrary.filter((t) => t.category === category);
};

export const executeTransformation = (
  id: string,
  value: any,
  params: any[],
  context?: TransformationContext,
): TransformationResult => {
  const transformation = getTransformation(id);
  if (!transformation) {
    return {
      success: false,
      results: Array.isArray(value) ? value : [value],
      totalCount: Array.isArray(value) ? value.length : 1,
      transformedCount: 0,
      error: `Transformation "${id}" not found`,
      errors: [
        {
          fieldId: context?.fieldName || "",
          transformationId: id,
          type: "validation",
          message: `Transformation "${id}" not found`,
          severity: "error",
        },
      ],
      warnings: [],
    };
  }

  try {
    const result = transformation.execute(value, params, context);
    return {
      success: true,
      results: Array.isArray(result) ? result : [result],
      totalCount: Array.isArray(result) ? result.length : 1,
      transformedCount: Array.isArray(result) ? result.length : 1,
      errors: [],
      warnings: [],
    };
  } catch (error) {
    return {
      success: false,
      results: Array.isArray(value) ? value : [value],
      totalCount: Array.isArray(value) ? value.length : 1,
      transformedCount: 0,
      error: error instanceof Error ? error.message : "Unknown error",
      errors: [
        {
          fieldId: context?.fieldName || "",
          transformationId: id,
          type: "runtime",
          message: error instanceof Error ? error.message : "Unknown error",
          severity: "error",
        },
      ],
      warnings: [],
    };
  }
};
