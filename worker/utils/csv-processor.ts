import { Readable, Transform } from "stream";
import * as parse from "csv-parse";

export interface CSVProcessorOptions {
  delimiter?: string;
  quote?: string;
  escape?: string;
  headers?: boolean;
  skipEmptyLines?: boolean;
  trim?: boolean;
}

export interface CSVRow {
  [key: string]: string | number | boolean | null;
}

export class CSVProcessor {
  private options: CSVProcessorOptions;

  constructor(options: CSVProcessorOptions = {}) {
    this.options = {
      delimiter: ",",
      quote: '"',
      escape: '"',
      headers: true,
      skipEmptyLines: true,
      trim: true,
      ...options,
    };
  }

  parseCSV(csvData: string | Buffer | Readable): Promise<CSVRow[]> {
    return new Promise((resolve, reject) => {
      const results: CSVRow[] = [];

      const parser = parse.parse({
        delimiter: this.options.delimiter,
        quote: this.options.quote,
        escape: this.options.escape,
        columns: this.options.headers,
        skip_empty_lines: this.options.skipEmptyLines,
        trim: this.options.trim,
      });

      parser.on("data", (row) => {
        results.push(row);
      });

      parser.on("end", () => {
        resolve(results);
      });

      parser.on("error", (error) => {
        reject(error);
      });

      if (csvData instanceof Readable) {
        csvData.pipe(parser);
      } else {
        parser.write(csvData);
        parser.end();
      }
    });
  }

  createCSVStream(): Transform {
    return parse.parse({
      delimiter: this.options.delimiter,
      quote: this.options.quote,
      escape: this.options.escape,
      columns: this.options.headers,
      skip_empty_lines: this.options.skipEmptyLines,
      trim: this.options.trim,
    });
  }

  validateCSVData(data: CSVRow[]): {
    isValid: boolean;
    errors: string[];
    rowCount: number;
    columnCount: number;
  } {
    const errors: string[] = [];

    if (!Array.isArray(data)) {
      errors.push("CSV data must be an array");
      return { isValid: false, errors, rowCount: 0, columnCount: 0 };
    }

    if (data.length === 0) {
      errors.push("CSV data is empty");
      return { isValid: false, errors, rowCount: 0, columnCount: 0 };
    }

    const columnCount = Object.keys(data[0]).length;

    // Check for consistent column count
    for (let i = 0; i < data.length; i++) {
      const row = data[i];
      const rowColumnCount = Object.keys(row).length;

      if (rowColumnCount !== columnCount) {
        errors.push(
          `Row ${i + 1} has ${rowColumnCount} columns, expected ${columnCount}`,
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      rowCount: data.length,
      columnCount,
    };
  }
}
