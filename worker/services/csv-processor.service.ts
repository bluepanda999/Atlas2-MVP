import { ProcessingJob } from '../types/upload';
import { FieldMapping, TransformationRule } from '../types/mapping';
import { DatabaseService } from './database.service';
import { UploadRepository } from '../repositories/upload.repository';
import { MappingRepository } from '../repositories/mapping.repository';
import { logger } from '../utils/logger';
import { parseCSV, validateCSVData, transformCSVData } from '../utils/csv-processor';
import { AppError } from '../utils/errors';

export interface ProcessingOptions {
  batchSize?: number;
  maxRetries?: number;
  timeout?: number;
}

export class CsvProcessorService {
  constructor(
    private databaseService: DatabaseService,
    private uploadRepository: UploadRepository,
    private mappingRepository: MappingRepository
  ) {}

  async processCsvFile(
    jobId: string,
    options: ProcessingOptions = {}
  ): Promise<void> {
    const {
      batchSize = 1000,
      maxRetries = 3,
      timeout = 300000, // 5 minutes
    } = options;

    let retryCount = 0;

    while (retryCount <= maxRetries) {
      try {
        logger.info(`Starting CSV processing for job ${jobId}`, { jobId, retryCount });

        // Get job details
        const job = await this.uploadRepository.findById(jobId);
        if (!job) {
          throw new AppError(`Job ${jobId} not found`, 404);
        }

        if (job.status !== 'pending' && job.status !== 'processing') {
          logger.warn(`Job ${jobId} is not in a processable state: ${job.status}`);
          return;
        }

        // Update job status to processing
        await this.uploadRepository.update(jobId, {
          status: 'processing',
          progress: 0,
          recordsProcessed: 0,
        });

        // Get file data
        const csvData = await this.uploadRepository.getFileData(jobId);
        if (!csvData) {
          throw new AppError('No file data found for job', 404);
        }

        // Parse CSV
        const parsedData = await parseCSV(csvData);
        logger.info(`Parsed CSV with ${parsedData.data.length} rows and ${parsedData.headers.length} columns`);

        // Validate CSV structure
        const validation = await this.validateCsvStructure(parsedData, job);
        if (!validation.isValid) {
          throw new AppError(`CSV validation failed: ${validation.errors.join(', ')}`, 400);
        }

        // Get mapping configuration if available
        let mappingConfig = null;
        if (job.mappingId) {
          mappingConfig = await this.mappingRepository.findById(job.mappingId);
        }

        // Process data in batches
        await this.processBatches(jobId, parsedData.data, mappingConfig, {
          batchSize,
          timeout,
        });

        // Mark job as completed
        await this.uploadRepository.update(jobId, {
          status: 'completed',
          progress: 100,
          recordsProcessed: parsedData.data.length,
        });

        logger.info(`Successfully completed CSV processing for job ${jobId}`);
        return;

      } catch (error) {
        retryCount++;
        logger.error(`CSV processing failed for job ${jobId} (attempt ${retryCount}/${maxRetries + 1}):`, error);

        if (retryCount > maxRetries) {
          // Mark job as failed
          await this.uploadRepository.update(jobId, {
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }

        // Wait before retrying
        await this.delay(Math.pow(2, retryCount) * 1000); // Exponential backoff
      }
    }
  }

  private async validateCsvStructure(parsedData: any, job: ProcessingJob): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if CSV has data
    if (parsedData.data.length === 0) {
      errors.push('CSV file is empty');
    }

    // Check if headers match expected structure
    if (job.csvHeaders.length > 0) {
      const missingHeaders = job.csvHeaders.filter(
        header => !parsedData.headers.includes(header)
      );
      
      if (missingHeaders.length > 0) {
        warnings.push(`Missing expected headers: ${missingHeaders.join(', ')}`);
      }
    }

    // Validate data consistency
    const headerCount = parsedData.headers.length;
    for (let i = 0; i < parsedData.data.length; i++) {
      const row = parsedData.data[i];
      const rowHeaderCount = Object.keys(row).length;
      
      if (rowHeaderCount !== headerCount) {
        warnings.push(`Row ${i + 1} has ${rowHeaderCount} columns, expected ${headerCount}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private async processBatches(
    jobId: string,
    data: any[],
    mappingConfig: any,
    options: { batchSize: number; timeout: number }
  ): Promise<void> {
    const { batchSize, timeout } = options;
    const totalRecords = data.length;
    let processedRecords = 0;

    logger.info(`Processing ${totalRecords} records in batches of ${batchSize}`);

    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      const totalBatches = Math.ceil(data.length / batchSize);

      logger.info(`Processing batch ${batchNumber}/${totalBatches} (${batch.length} records)`);

      try {
        // Apply transformations if mapping is available
        let processedBatch = batch;
        if (mappingConfig) {
          processedBatch = await this.applyTransformations(batch, mappingConfig);
        }

        // Validate batch data
        const validation = await validateCSVData(processedBatch);
        if (!validation.isValid) {
          throw new AppError(`Batch validation failed: ${validation.errors.join(', ')}`, 400);
        }

        // Process batch (this would integrate with the target API/system)
        await this.processBatch(processedBatch, {
          jobId,
          batchNumber,
          timeout,
        });

        processedRecords += batch.length;

        // Update progress
        const progress = Math.round((processedRecords / totalRecords) * 100);
        await this.uploadRepository.update(jobId, {
          progress,
          recordsProcessed: processedRecords,
        });

        logger.info(`Completed batch ${batchNumber}/${totalBatches}. Progress: ${progress}%`);

      } catch (error) {
        logger.error(`Failed to process batch ${batchNumber}:`, error);
        throw new AppError(`Batch ${batchNumber} processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`, 500);
      }
    }
  }

  private async applyTransformations(data: any[], mappingConfig: any): Promise<any[]> {
    const { mappings, transformationRules } = mappingConfig;

    let transformedData = data;

    // Apply field mappings
    if (mappings && mappings.length > 0) {
      transformedData = transformedData.map(row => {
        const mappedRow: any = {};
        
        mappings.forEach((mapping: any) => {
          if (mapping.csvHeader && mapping.apiFieldName) {
            mappedRow[mapping.apiFieldName] = row[mapping.csvHeader] || '';
          }
        });
        
        return mappedRow;
      });
    }

    // Apply transformation rules
    if (transformationRules && transformationRules.length > 0) {
      transformedData = await transformCSVData(transformedData, transformationRules);
    }

    return transformedData;
  }

  private async processBatch(
    batch: any[],
    context: { jobId: string; batchNumber: number; timeout: number }
  ): Promise<void> {
    // This is where you would integrate with the target API/system
    // For now, we'll simulate processing with a delay
    
    logger.info(`Processing batch ${context.batchNumber} with ${batch.length} records`);

    // Simulate API calls or data processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // In a real implementation, you would:
    // 1. Make API calls to the target system
    // 2. Handle rate limiting
    // 3. Retry failed requests
    // 4. Store results
    // 5. Handle errors appropriately

    logger.debug(`Batch ${context.batchNumber} processed successfully`);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Method to get processing statistics
  async getProcessingStats(jobId: string): Promise<{
    totalRecords: number;
    processedRecords: number;
    failedRecords: number;
    processingTime: number;
    estimatedTimeRemaining: number | null;
  }> {
    const job = await this.uploadRepository.findById(jobId);
    if (!job) {
      throw new AppError(`Job ${jobId} not found`, 404);
    }

    const totalRecords = job.totalRecords || 0;
    const processedRecords = job.recordsProcessed || 0;
    const failedRecords = 0; // Would track this in a real implementation
    const processingTime = job.processingTime || 0;

    // Estimate remaining time
    let estimatedTimeRemaining = null;
    if (job.status === 'processing' && processedRecords > 0) {
      const avgTimePerRecord = processingTime / processedRecords;
      const remainingRecords = totalRecords - processedRecords;
      estimatedTimeRemaining = remainingRecords * avgTimePerRecord;
    }

    return {
      totalRecords,
      processedRecords,
      failedRecords,
      processingTime,
      estimatedTimeRemaining,
    };
  }
}