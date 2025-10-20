import { logger } from '../utils/logger';
import { File } from 'multer';
import Papa from 'papaparse';
import fs from 'fs';
import { createReadStream } from 'fs';
import { inspect } from 'util';

export interface ProcessingJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  errors?: string[];
  csvHeaders?: string[];
  delimiter?: string;
  encoding?: string;
  memoryUsage?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CsvProcessingOptions {
  chunkSize?: number;
  maxMemoryUsage?: number;
  encoding?: string;
  delimiter?: string;
}

// In-memory job storage (should be replaced with Redis/database)
const jobs = new Map<string, ProcessingJob>();

// Memory monitoring for POC
const MEMORY_THRESHOLD = 500 * 1024 * 1024; // 500MB

export async function processCSVFile(
  file: File, 
  options: CsvProcessingOptions = {}
): Promise<ProcessingJob> {
  const jobId = generateJobId();
  const job: ProcessingJob = {
    id: jobId,
    filename: file.filename,
    status: 'pending',
    progress: 0,
    createdAt: new Date(),
    updatedAt: new Date()
  };

  jobs.set(jobId, job);

  // Start processing asynchronously
  processFileAsync(jobId, file.path, options).catch(error => {
    logger.error(`Failed to process job ${jobId}:`, error);
    const job = jobs.get(jobId);
    if (job) {
      job.status = 'failed';
      job.errors = [error.message];
      job.updatedAt = new Date();
    }
  });

  return job;
}

export function getJobStatus(jobId: string): ProcessingJob | undefined {
  return jobs.get(jobId);
}

async function processFileAsync(
  jobId: string, 
  filePath: string, 
  options: CsvProcessingOptions
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  job.status = 'processing';
  job.updatedAt = new Date();

  try {
    // Step 1: Detect delimiter and encoding
    logger.info(`Detecting CSV format for job ${jobId}`);
    const { delimiter, encoding, headers } = await detectCsvFormat(filePath);
    
    job.delimiter = delimiter;
    job.encoding = encoding;
    job.csvHeaders = headers;
    job.updatedAt = new Date();

    // Step 2: Process with streaming
    logger.info(`Starting streaming processing for job ${jobId} with delimiter: ${delimiter}`);
    await processWithStreaming(jobId, filePath, { ...options, delimiter, encoding });

  } catch (error) {
    job.status = 'failed';
    job.errors = [error.message];
    job.updatedAt = new Date();
    throw error;
  }
}

async function detectCsvFormat(filePath: string): Promise<{
  delimiter: string;
  encoding: string;
  headers: string[];
}> {
  return new Promise((resolve, reject) => {
    const sampleSize = 1024 * 10; // 10KB sample
    const buffer = Buffer.alloc(sampleSize);
    
    try {
      const fd = fs.openSync(filePath, 'r');
      const bytesRead = fs.readSync(fd, buffer, 0, sampleSize, 0);
      fs.closeSync(fd);
      
      const sample = buffer.toString('utf8', 0, bytesRead);
      
      // Detect delimiter
      const delimiters = [',', ';', '\t', '|'];
      const delimiterCounts = delimiters.map(del => ({
        delimiter: del,
        count: (sample.match(new RegExp(`\\${del}`, 'g')) || []).length
      }));
      
      const detectedDelimiter = delimiterCounts.reduce((a, b) => 
        a.count > b.count ? a : b
      ).delimiter;
      
      // Extract headers from first line
      const firstLine = sample.split('\n')[0];
      const headers = firstLine.split(detectedDelimiter).map(h => h.trim().replace(/^"|"$/g, ''));
      
      resolve({
        delimiter: detectedDelimiter,
        encoding: 'utf8', // POC simplification
        headers
      });
      
    } catch (error) {
      reject(new Error(`Failed to detect CSV format: ${error.message}`));
    }
  });
}

async function processWithStreaming(
  jobId: string,
  filePath: string,
  options: CsvProcessingOptions
): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  return new Promise((resolve, reject) => {
    let processedRows = 0;
    let totalRows = 0;
    let chunkCount = 0;

    const config: Papa.ParseConfig = {
      delimiter: options.delimiter || ',',
      header: true,
      skipEmptyLines: true,
      chunkSize: options.chunkSize || 1024 * 1024, // 1MB chunks
      chunk: (results, parser) => {
        try {
          chunkCount++;
          const chunk = results.data as any[];
          processedRows += chunk.length;

          // Memory monitoring for POC
          const memoryUsage = process.memoryUsage();
          job.memoryUsage = memoryUsage.heapUsed;
          
          // Check memory threshold
          if (memoryUsage.heapUsed > MEMORY_THRESHOLD) {
            logger.warn(`Memory usage threshold exceeded for job ${jobId}: ${memoryUsage.heapUsed / 1024 / 1024}MB`);
            // In production, you might pause processing or trigger cleanup
          }

          // Update job progress
          job.processedRows = processedRows;
          job.totalRows = totalRows;
          job.progress = totalRows > 0 ? Math.min((processedRows / totalRows) * 100, 99) : 0;
          job.updatedAt = new Date();

          // Simulate data processing (validation, transformation)
          // In real implementation, this would:
          // - Validate data types
          // - Apply transformations
          // - Prepare for API upload
          logger.debug(`Processed chunk ${chunkCount} of ${chunk.length} rows for job ${jobId}`);

          // Force garbage collection periodically (Node.js needs --expose-gc flag)
          if (chunkCount % 10 === 0) {
            if (global.gc) {
              global.gc();
            }
          }

        } catch (error) {
          logger.error(`Error processing chunk for job ${jobId}:`, error);
          parser.abort();
          reject(error);
        }
      },
      complete: () => {
        job.status = 'completed';
        job.progress = 100;
        job.totalRows = processedRows;
        job.updatedAt = new Date();
        
        const finalMemory = process.memoryUsage();
        logger.info(`Completed processing job ${jobId}: ${processedRows} rows, final memory: ${finalMemory.heapUsed / 1024 / 1024}MB`);
        resolve();
      },
      error: (error) => {
        job.status = 'failed';
        job.errors = [error.message];
        job.updatedAt = new Date();
        reject(error);
      },
      step: (row, parser) => {
        totalRows++;
      }
    };

    // Start streaming parse
    Papa.parse(filePath, config);
  });
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// Utility function for memory monitoring
export function getMemoryUsage(): { heap: number; external: number; rss: number } {
  const usage = process.memoryUsage();
  return {
    heap: usage.heapUsed,
    external: usage.external,
    rss: usage.rss
  };
}