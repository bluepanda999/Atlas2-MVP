import { ProcessingJob } from '../types/upload';
import { FieldMapping, TransformationRule } from '../types/mapping';
import { DatabaseService } from './database.service';
import { UploadRepository } from '../repositories/upload.repository';
import { MappingRepository } from '../repositories/mapping.repository';
import { logger } from '../utils/logger';
import { AppError } from '../utils/errors';
import { createReadStream, existsSync } from 'fs';
import { parse } from 'csv-parse';
import { Transform } from 'stream';
import { pipeline } from 'stream/promises';

export interface StreamingProcessingOptions {
  chunkSize?: number; // bytes
  maxMemoryUsage?: number; // bytes
  processingSpeed?: number; // rows per second target
  delimiterDetection?: boolean;
  encodingDetection?: boolean;
  maxRetries?: number;
  timeout?: number;
}

export interface DelimiterDetectionResult {
  delimiter: string;
  confidence: number;
  sample: string;
}

export interface EncodingDetectionResult {
  encoding: string;
  confidence: number;
}

export interface MemoryStats {
  heapUsed: number;
  heapTotal: number;
  rss: number;
  external: number;
}

export interface ProcessingStats {
  totalRows: number;
  processedRows: number;
  errorRows: number;
  processingSpeed: number; // rows per second
  memoryUsage: MemoryStats;
  startTime: Date;
  estimatedTimeRemaining?: number;
}

const DEFAULT_OPTIONS: Required<StreamingProcessingOptions> = {
  chunkSize: 1024 * 1024, // 1MB
  maxMemoryUsage: 500 * 1024 * 1024, // 500MB
  processingSpeed: 10000, // 10,000 rows/second
  delimiterDetection: true,
  encodingDetection: true,
  maxRetries: 3,
  timeout: 300000, // 5 minutes
};

const COMMON_DELIMITERS = [',', ';', '\t', '|'];
const COMMON_ENCODINGS = ['utf8', 'latin1', 'ascii', 'utf16le'];

export class StreamingCsvProcessorService {
  private memoryMonitorInterval?: NodeJS.Timeout;
  private processingStats: Map<string, ProcessingStats> = new Map();

  constructor(
    private databaseService: DatabaseService,
    private uploadRepository: UploadRepository,
    private mappingRepository: MappingRepository
  ) {}

  async processCsvFile(
    jobId: string,
    filePath: string,
    options: StreamingProcessingOptions = {}
  ): Promise<void> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    let retryCount = 0;

    while (retryCount <= opts.maxRetries) {
      try {
        logger.info(`Starting streaming CSV processing for job ${jobId}`, { 
          jobId, 
          filePath, 
          options: opts 
        });

        // Validate file exists
        if (!existsSync(filePath)) {
          throw new AppError(`File not found: ${filePath}`, 404);
        }

        // Get job details
        const job = await this.uploadRepository.findById(jobId);
        if (!job) {
          throw new AppError(`Job ${jobId} not found`, 404);
        }

        if (job.status !== 'pending' && job.status !== 'processing') {
          logger.warn(`Job ${jobId} is not in a processable state: ${job.status}`);
          return;
        }

        // Initialize processing stats
        const stats: ProcessingStats = {
          totalRows: 0,
          processedRows: 0,
          errorRows: 0,
          processingSpeed: 0,
          memoryUsage: process.memoryUsage(),
          startTime: new Date(),
        };
        this.processingStats.set(jobId, stats);

        // Update job status to processing
        await this.uploadRepository.update(jobId, {
          status: 'processing',
          progress: 0,
          recordsProcessed: 0,
        });

        // Start memory monitoring
        this.startMemoryMonitoring(jobId, opts.maxMemoryUsage);

        // Detect delimiter and encoding if enabled
        let delimiter = ',';
        let encoding = 'utf8';

        if (opts.delimiterDetection) {
          const delimiterResult = await this.detectDelimiter(filePath);
          delimiter = delimiterResult.delimiter;
          logger.info(`Detected delimiter: '${delimiter}' (confidence: ${delimiterResult.confidence})`);
        }

        if (opts.encodingDetection) {
          const encodingResult = await this.detectEncoding(filePath);
          encoding = encodingResult.encoding;
          logger.info(`Detected encoding: '${encoding}' (confidence: ${encodingResult.confidence})`);
        }

        // Get mapping configuration if available
        let mappingConfig = null;
        if (job.mappingId) {
          mappingConfig = await this.mappingRepository.findById(job.mappingId);
        }

        // Process the file using streaming
        await this.processStreamingFile(jobId, filePath, {
          delimiter,
          encoding,
          mappingConfig,
          options: opts,
        });

        // Mark job as completed
        const finalStats = this.processingStats.get(jobId)!;
        await this.uploadRepository.update(jobId, {
          status: 'completed',
          progress: 100,
          recordsProcessed: finalStats.processedRows,
          processingTime: Date.now() - finalStats.startTime.getTime(),
        });

        // Cleanup
        this.stopMemoryMonitoring(jobId);
        this.processingStats.delete(jobId);

        logger.info(`Successfully completed streaming CSV processing for job ${jobId}`, {
          totalRows: finalStats.totalRows,
          processedRows: finalStats.processedRows,
          errorRows: finalStats.errorRows,
          processingTime: Date.now() - finalStats.startTime.getTime(),
        });
        return;

      } catch (error) {
        retryCount++;
        logger.error(`Streaming CSV processing failed for job ${jobId} (attempt ${retryCount}/${opts.maxRetries + 1}):`, error);

        if (retryCount > opts.maxRetries) {
          // Mark job as failed
          await this.uploadRepository.update(jobId, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
          
          // Cleanup
          this.stopMemoryMonitoring(jobId);
          this.processingStats.delete(jobId);
          
          throw error;
        }

        // Wait before retrying
        await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
      }
    }
  }

  private async detectDelimiter(filePath: string): Promise<DelimiterDetectionResult> {
    return new Promise((resolve, reject) => {
      const sampleSize = 1024 * 10; // 10KB sample
      const results: Array<{ delimiter: string; score: number }> = [];

      createReadStream(filePath, { start: 0, end: sampleSize })
        .pipe(parse({ auto_parse: false, skip_empty_lines: true }))
        .on('data', (row, index) => {
          if (index === 0) return; // Skip header row for scoring

          COMMON_DELIMITERS.forEach(delimiter => {
            const score = this.calculateDelimiterConsistency(row, delimiter);
            results.push({ delimiter, score });
          });
        })
        .on('end', () => {
          // Average scores for each delimiter
          const delimiterScores = COMMON_DELIMITERS.map(delimiter => {
            const delimiterResults = results.filter(r => r.delimiter === delimiter);
            const avgScore = delimiterResults.reduce((sum, r) => sum + r.score, 0) / delimiterResults.length;
            return { delimiter, score: avgScore };
          });

          // Find best delimiter
          const best = delimiterScores.sort((a, b) => b.score - a.score)[0];
          
          resolve({
            delimiter: best.delimiter,
            confidence: best.score,
            sample: `Best delimiter: '${best.delimiter}' with score ${best.score.toFixed(2)}`,
          });
        })
        .on('error', reject);
    });
  }

  private calculateDelimiterConsistency(row: string[], delimiter: string): number {
    if (row.length <= 1) return 0;

    // Count occurrences of delimiter in each field
    let delimiterCounts = 0;
    let totalFields = 0;

    row.forEach(field => {
      const count = (field.match(new RegExp(`\\${delimiter}`, 'g')) || []).length;
      delimiterCounts += count;
      totalFields++;
    });

    // Calculate consistency (higher is better)
    const avgCount = totalFields > 0 ? delimiterCounts / totalFields : 0;
    return avgCount;
  }

  private async detectEncoding(filePath: string): Promise<EncodingDetectionResult> {
    // Simple encoding detection - in production, you'd use a more sophisticated library
    return new Promise((resolve) => {
      // For now, default to utf8 with high confidence
      // In a real implementation, you'd:
      // 1. Read a sample of the file
      // 2. Try decoding with different encodings
      // 3. Check for invalid character sequences
      // 4. Use statistical analysis for better detection
      
      resolve({
        encoding: 'utf8',
        confidence: 0.95,
      });
    });
  }

  private async processStreamingFile(
    jobId: string,
    filePath: string,
    context: {
      delimiter: string;
      encoding: string;
      mappingConfig: any;
      options: Required<StreamingProcessingOptions>;
    }
  ): Promise<void> {
    const { delimiter, encoding, mappingConfig, options } = context;
    const stats = this.processingStats.get(jobId)!;
    
    let rowIndex = 0;
    let headers: string[] = [];
    let headerProcessed = false;

    // Create processing transform stream
    const processor = new Transform({
      objectMode: true,
      transform: async (row: string[], encoding, callback) => {
        try {
          // Process header
          if (!headerProcessed) {
            headers = row;
            headerProcessed = true;
            stats.totalRows = 0; // Will be updated as we process
            callback();
            return;
          }

          rowIndex++;
          stats.totalRows++;

          // Convert row to object
          const rowObject: Record<string, string> = {};
          headers.forEach((header, index) => {
            rowObject[header] = row[index] || '';
          });

          // Apply transformations if mapping is available
          let processedRow = rowObject;
          if (mappingConfig) {
            processedRow = await this.applyRowTransformations(rowObject, mappingConfig);
          }

          // Validate row
          const validation = await this.validateRow(processedRow);
          if (!validation.isValid) {
            stats.errorRows++;
            logger.warn(`Row ${rowIndex} validation failed:`, validation.errors);
            // Continue processing other rows
          }

          stats.processedRows++;

          // Update progress periodically
          if (rowIndex % 1000 === 0) {
            await this.updateProgress(jobId, stats);
          }

          // Rate limiting to control processing speed
          if (options.processingSpeed > 0) {
            const targetTimePerRow = 1000 / options.processingSpeed; // ms per row
            const actualTimePerRow = 10; // Estimate actual processing time
            const delayTime = Math.max(0, targetTimePerRow - actualTimePerRow);
            
            if (delayTime > 0) {
              await this.delay(delayTime);
            }
          }

          callback();
        } catch (error) {
          stats.errorRows++;
          logger.error(`Error processing row ${rowIndex}:`, error);
          callback(error);
        }
      },
    });

    // Create and execute the processing pipeline
    try {
      await pipeline(
        createReadStream(filePath, { encoding: encoding as BufferEncoding }),
        parse({
          delimiter,
          skip_empty_lines: true,
          trim: true,
        }),
        processor
      );

      // Final progress update
      await this.updateProgress(jobId, stats);
      
    } catch (error) {
      throw new AppError(`Streaming processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
    }
  }

  private async applyRowTransformations(row: Record<string, string>, mappingConfig: any): Promise<Record<string, string>> {
    const { mappings, transformationRules } = mappingConfig;
    let transformedRow = { ...row };

    // Apply field mappings
    if (mappings && mappings.length > 0) {
      const mappedRow: Record<string, string> = {};
      
      mappings.forEach((mapping: FieldMapping) => {
        if (mapping.csvHeader && mapping.apiFieldName) {
          mappedRow[mapping.apiFieldName] = transformedRow[mapping.csvHeader] || '';
        }
      });
      
      transformedRow = mappedRow;
    }

    // Apply transformation rules
    if (transformationRules && transformationRules.length > 0) {
      for (const rule of transformationRules) {
        transformedRow = await this.applyTransformationRule(transformedRow, rule);
      }
    }

    return transformedRow;
  }

  private async applyTransformationRule(row: Record<string, string>, rule: TransformationRule): Promise<Record<string, string>> {
    // Apply transformation based on rule type
    switch (rule.type) {
      case 'data_type':
        return this.applyDataTypeTransformation(row, rule);
      case 'format':
        return this.applyFormatTransformation(row, rule);
      case 'conditional':
        return this.applyConditionalTransformation(row, rule);
      default:
        return row;
    }
  }

  private applyDataTypeTransformation(row: Record<string, string>, rule: TransformationRule): Record<string, string> {
    const { sourceField, targetType } = rule;
    if (!sourceField || !targetType) return row;

    const value = row[sourceField];
    if (!value) return row;

    try {
      switch (targetType) {
        case 'number':
          row[sourceField] = parseFloat(value).toString();
          break;
        case 'integer':
          row[sourceField] = parseInt(value).toString();
          break;
        case 'boolean':
          row[sourceField] = ['true', '1', 'yes', 'on'].includes(value.toLowerCase()).toString();
          break;
        case 'date':
          // Basic date parsing - in production, use a proper date library
          const date = new Date(value);
          row[sourceField] = date.toISOString();
          break;
        default:
          // Keep as string
          break;
      }
    } catch (error) {
      logger.warn(`Failed to transform ${sourceField} to ${targetType}:`, error);
    }

    return row;
  }

  private applyFormatTransformation(row: Record<string, string>, rule: TransformationRule): Record<string, string> {
    const { sourceField, format } = rule;
    if (!sourceField || !format) return row;

    const value = row[sourceField];
    if (!value) return row;

    try {
      // Basic format transformations
      switch (format) {
        case 'uppercase':
          row[sourceField] = value.toUpperCase();
          break;
        case 'lowercase':
          row[sourceField] = value.toLowerCase();
          break;
        case 'trim':
          row[sourceField] = value.trim();
          break;
        default:
          // Custom format would be handled here
          break;
      }
    } catch (error) {
      logger.warn(`Failed to apply format ${format} to ${sourceField}:`, error);
    }

    return row;
  }

  private applyConditionalTransformation(row: Record<string, string>, rule: TransformationRule): Record<string, string> {
    const { sourceField, condition, thenValue, elseValue } = rule;
    if (!sourceField || !condition) return row;

    const value = row[sourceField];
    if (!value) return row;

    try {
      // Simple condition evaluation - in production, use a proper expression parser
      let conditionMet = false;
      
      if (condition.includes('equals')) {
        const [, expectedValue] = condition.split('equals').map(s => s.trim());
        conditionMet = value === expectedValue;
      } else if (condition.includes('contains')) {
        const [, expectedValue] = condition.split('contains').map(s => s.trim());
        conditionMet = value.includes(expectedValue);
      }

      row[sourceField] = conditionMet ? (thenValue || value) : (elseValue || value);
    } catch (error) {
      logger.warn(`Failed to apply conditional transformation to ${sourceField}:`, error);
    }

    return row;
  }

  private async validateRow(row: Record<string, string>): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic validation
    Object.entries(row).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        warnings.push(`Field '${key}' is null or undefined`);
      }
    });

    // More sophisticated validation would go here
    // - Data type validation
    // - Format validation
    // - Business rule validation

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async updateProgress(jobId: string, stats: ProcessingStats): Promise<void> {
    const progress = stats.totalRows > 0 ? Math.round((stats.processedRows / stats.totalRows) * 100) : 0;
    
    // Calculate processing speed
    const elapsedMs = Date.now() - stats.startTime.getTime();
    stats.processingSpeed = elapsedMs > 0 ? (stats.processedRows / (elapsedMs / 1000)) : 0;

    // Estimate remaining time
    if (stats.processingSpeed > 0 && stats.processedRows > 0) {
      const remainingRows = stats.totalRows - stats.processedRows;
      stats.estimatedTimeRemaining = remainingRows / stats.processingSpeed * 1000; // ms
    }

    await this.uploadRepository.update(jobId, {
      progress,
      recordsProcessed: stats.processedRows,
      estimatedTimeRemaining: stats.estimatedTimeRemaining,
    });
  }

  private startMemoryMonitoring(jobId: string, maxMemoryUsage: number): void {
    this.memoryMonitorInterval = setInterval(() => {
      const memUsage = process.memoryUsage();
      
      // Check if we're approaching memory limit
      if (memUsage.heapUsed > maxMemoryUsage * 0.9) { // 90% threshold
        logger.warn(`Memory usage approaching limit for job ${jobId}:`, {
          heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
          maxMemory: Math.round(maxMemoryUsage / 1024 / 1024) + 'MB',
        });
        
        // Trigger garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }

      // Update stats
      const stats = this.processingStats.get(jobId);
      if (stats) {
        stats.memoryUsage = memUsage;
      }
    }, 5000); // Check every 5 seconds
  }

  private stopMemoryMonitoring(jobId: string): void {
    if (this.memoryMonitorInterval) {
      clearInterval(this.memoryMonitorInterval);
      this.memoryMonitorInterval = undefined;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Public method to get processing statistics
  async getProcessingStats(jobId: string): Promise<ProcessingStats | null> {
    return this.processingStats.get(jobId) || null;
  }

  // Method to pause/resume processing (for large files)
  async pauseProcessing(jobId: string): Promise<void> {
    // Implementation would depend on the specific streaming approach
    // This is a placeholder for the interface
    logger.info(`Pausing processing for job ${jobId}`);
  }

  async resumeProcessing(jobId: string): Promise<void> {
    // Implementation would depend on the specific streaming approach
    // This is a placeholder for the interface
    logger.info(`Resuming processing for job ${jobId}`);
  }
}