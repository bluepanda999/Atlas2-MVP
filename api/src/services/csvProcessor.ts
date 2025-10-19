import { logger } from '../utils/logger';
import { File } from 'multer';
import Papa from 'papaparse';

export interface ProcessingJob {
  id: string;
  filename: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  totalRows?: number;
  processedRows?: number;
  errors?: string[];
  createdAt: Date;
  updatedAt: Date;
}

// In-memory job storage (should be replaced with Redis/database)
const jobs = new Map<string, ProcessingJob>();

export async function processCSVFile(file: File): Promise<ProcessingJob> {
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
  processFileAsync(jobId, file.path).catch(error => {
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

async function processFileAsync(jobId: string, filePath: string): Promise<void> {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);

  job.status = 'processing';
  job.updatedAt = new Date();

  return new Promise((resolve, reject) => {
    let processedRows = 0;
    let totalRows = 0;

    Papa.parse(filePath, {
      header: true,
      skipEmptyLines: true,
      chunk: (results, parser) => {
        try {
          // Process chunk
          const chunk = results.data as any[];
          processedRows += chunk.length;

          // Update job progress
          job.processedRows = processedRows;
          job.progress = totalRows > 0 ? (processedRows / totalRows) * 100 : 0;
          job.updatedAt = new Date();

          // Simulate processing time
          // In real implementation, this would validate, transform, and prepare data
          logger.debug(`Processed chunk of ${chunk.length} rows for job ${jobId}`);

        } catch (error) {
          parser.abort();
          reject(error);
        }
      },
      complete: () => {
        job.status = 'completed';
        job.progress = 100;
        job.updatedAt = new Date();
        logger.info(`Completed processing job ${jobId}: ${processedRows} rows`);
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
    });
  });
}

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}