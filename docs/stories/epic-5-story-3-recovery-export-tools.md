# Story 5.3: Recovery & Export Tools - Brownfield Addition

## User Story

As a data analyst,
I want automated recovery tools and comprehensive export capabilities for my processing jobs and error reports,
So that I can quickly resume failed operations, analyze trends, and share insights with stakeholders.

## Story Context

**Existing System Integration:**

- Integrates with: Progress monitoring (Story 5.1), Error reporting (Story 5.2), CSV processing pipeline (Epic 1), API upload system (Epic 4)
- Technology: Node.js backend with recovery orchestration, React frontend for export management, automated retry mechanisms
- Follows pattern: Job recovery frameworks, export generation standards, automation orchestration patterns
- Touch points: Recovery engine, export service, job resumption API, report generation system

## Acceptance Criteria

**Functional Requirements:**

1. Automated job recovery with intelligent retry logic, checkpoint resumption, and failure pattern analysis
2. Comprehensive export tools supporting multiple formats (CSV, JSON, PDF, Excel) for jobs, errors, and analytics
3. Batch recovery operations allowing multiple job recovery with configurable priority and resource allocation
4. Scheduled export generation with automated delivery via email, API, or file storage
5. Recovery analytics with success rate tracking, failure pattern analysis, and performance optimization recommendations

**Integration Requirements:** 4. Existing job processing patterns remain unchanged (recovery tools work with existing job states) 5. New functionality follows existing export and automation patterns 6. Integration with all processing pipelines maintains current recovery and export flow patterns

**Quality Requirements:** 7. Job recovery success rate >85% for recoverable failures 8. Export generation completes within 30 seconds for datasets up to 10,000 records 9. Automated recovery adds <10% overhead to normal processing time 10. Export accuracy maintains 100% data integrity with proper formatting

## Technical Notes

- **Integration Approach:** Recovery and export tools integrate with existing processing pipelines through job state management and data access layers
- **Existing Pattern Reference:** Follow established job management, export generation, and automation frameworks
- **Key Constraints:** Must provide intelligent recovery, maintain data integrity, support multiple export formats

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (recovery and export guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Recovery operations causing data corruption or duplicate processing
- **Mitigation:** Implement transaction-based recovery, idempotent operations, and comprehensive validation
- **Rollback:** Disable automated recovery and maintain manual recovery options if issues occur

**Compatibility Verification:**

- [ ] No breaking changes to existing job processing
- [ ] Recovery tools follow existing job state patterns
- [ ] Export system integrates with existing data access patterns
- [ ] Automation uses existing orchestration frameworks

## Story Points Estimation

**Estimation:** 8 points

- Recovery engine: 3 points
- Export tools: 2 points
- Batch operations: 2 points
- Analytics and scheduling: 1 point

## Dependencies

- Progress monitoring (Story 5.1)
- Error reporting (Story 5.2)
- CSV processing pipeline (Epic 1)
- API upload system (Epic 4)
- Job management foundation

## Testing Requirements

**Unit Tests:**

- Recovery logic algorithms
- Export format generation
- Batch operation coordination
- Analytics calculation accuracy

**Integration Tests:**

- End-to-end recovery workflows
- Export generation and delivery
- Batch recovery operations
- Scheduled export execution

**Performance Tests:**

- Recovery operation speed
- Export generation performance
- Batch processing throughput
- Analytics calculation efficiency

## Implementation Notes

**Recovery Engine:**

```javascript
class RecoveryEngine {
  constructor(options = {}) {
    this.jobManager = options.jobManager;
    this.errorAnalyzer = options.errorAnalyzer;
    this.checkpointManager = options.checkpointManager;
    this.retryStrategy = new RetryStrategy(options.retryOptions);
    this.recoveryHistory = new RecoveryHistory(options);
  }

  async recoverJob(jobId, recoveryOptions = {}) {
    try {
      const job = await this.jobManager.getJob(jobId);
      if (!job) {
        throw new Error(`Job not found: ${jobId}`);
      }

      if (job.status !== "failed") {
        throw new Error(`Job cannot be recovered in status: ${job.status}`);
      }

      // Analyze failure to determine recovery strategy
      const failureAnalysis = await this.analyzeFailure(job);

      // Determine recovery approach
      const recoveryPlan = await this.createRecoveryPlan(
        job,
        failureAnalysis,
        recoveryOptions,
      );

      // Execute recovery
      const recoveredJob = await this.executeRecovery(job, recoveryPlan);

      // Record recovery attempt
      await this.recoveryHistory.record({
        jobId,
        originalFailure: job.error,
        recoveryPlan,
        result: recoveredJob.status === "running" ? "success" : "failed",
        timestamp: new Date(),
      });

      return recoveredJob;
    } catch (error) {
      console.error(`Failed to recover job ${jobId}:`, error);
      throw error;
    }
  }

  async analyzeFailure(job) {
    const analysis = {
      failureType: "unknown",
      recoverability: "unknown",
      recommendedAction: "manual",
      confidence: 0.5,
      context: {},
    };

    // Analyze error patterns
    if (job.error) {
      const errorAnalysis = await this.errorAnalyzer.analyze(job.error);
      Object.assign(analysis, errorAnalysis);
    }

    // Analyze job progress and checkpoints
    const checkpointAnalysis =
      await this.checkpointManager.analyzeJobProgress(job);
    analysis.context.checkpoints = checkpointAnalysis;
    analysis.context.lastSuccessfulStep = checkpointAnalysis.lastSuccessfulStep;

    // Determine recoverability
    analysis.recoverability = this.determineRecoverability(analysis);
    analysis.recommendedAction = this.getRecommendedAction(analysis);

    return analysis;
  }

  determineRecoverability(analysis) {
    // Highly recoverable failures
    if (
      analysis.failureType === "timeout" ||
      analysis.failureType === "network_error" ||
      analysis.failureType === "temporary_resource"
    ) {
      return "high";
    }

    // Moderately recoverable failures
    if (
      analysis.failureType === "data_quality" ||
      analysis.failureType === "validation_error"
    ) {
      return "medium";
    }

    // Low recoverability failures
    if (
      analysis.failureType === "security" ||
      analysis.failureType === "data_loss" ||
      analysis.failureType === "configuration_error"
    ) {
      return "low";
    }

    return "unknown";
  }

  getRecommendedAction(analysis) {
    switch (analysis.recoverability) {
      case "high":
        return "automatic_retry";
      case "medium":
        return "retry_with_adjustments";
      case "low":
        return "manual_intervention";
      default:
        return "investigation_required";
    }
  }

  async createRecoveryPlan(job, failureAnalysis, options) {
    const plan = {
      type: failureAnalysis.recommendedAction,
      steps: [],
      adjustments: {},
      priority: options.priority || "normal",
      estimatedSuccessRate: this.calculateSuccessRate(failureAnalysis),
    };

    switch (plan.type) {
      case "automatic_retry":
        plan.steps = this.createRetrySteps(job, failureAnalysis);
        break;
      case "retry_with_adjustments":
        plan.steps = this.createAdjustmentSteps(job, failureAnalysis);
        plan.adjustments = this.calculateAdjustments(failureAnalysis);
        break;
      case "manual_intervention":
        plan.steps = this.createManualSteps(job, failureAnalysis);
        break;
      default:
        plan.steps = this.createInvestigationSteps(job, failureAnalysis);
    }

    return plan;
  }

  createRetrySteps(job, failureAnalysis) {
    const steps = [];

    // Add checkpoint-based resumption if available
    if (failureAnalysis.context.lastSuccessfulStep) {
      steps.push({
        type: "resume_from_checkpoint",
        step: failureAnalysis.context.lastSuccessfulStep,
        description: `Resume from ${failureAnalysis.context.lastSuccessfulStep}`,
      });
    } else {
      steps.push({
        type: "restart_from_beginning",
        description: "Restart job from beginning",
      });
    }

    // Add retry strategy
    steps.push({
      type: "apply_retry_strategy",
      strategy: this.retryStrategy.getStrategyForFailure(
        failureAnalysis.failureType,
      ),
      description: "Apply intelligent retry strategy",
    });

    return steps;
  }

  createAdjustmentSteps(job, failureAnalysis) {
    const steps = [];

    // Add data quality fixes
    if (failureAnalysis.failureType === "data_quality") {
      steps.push({
        type: "apply_data_fixes",
        fixes: this.generateDataFixes(failureAnalysis),
        description: "Apply automated data quality fixes",
      });
    }

    // Add resource adjustments
    if (
      failureAnalysis.failureType === "timeout" ||
      failureAnalysis.failureType === "memory"
    ) {
      steps.push({
        type: "adjust_resources",
        adjustments: this.calculateResourceAdjustments(failureAnalysis),
        description: "Adjust processing resources",
      });
    }

    // Add validation adjustments
    if (failureAnalysis.failureType === "validation_error") {
      steps.push({
        type: "relax_validation",
        relaxations: this.calculateValidationRelaxations(failureAnalysis),
        description: "Adjust validation rules",
      });
    }

    return steps;
  }

  createManualSteps(job, failureAnalysis) {
    return [
      {
        type: "pause_for_intervention",
        description: "Pause job for manual intervention",
        requiredActions: this.getRequiredManualActions(failureAnalysis),
      },
      {
        type: "create_intervention_ticket",
        description: "Create support ticket for manual resolution",
        ticketDetails: this.generateTicketDetails(job, failureAnalysis),
      },
    ];
  }

  async executeRecovery(job, recoveryPlan) {
    switch (recoveryPlan.type) {
      case "automatic_retry":
        return await this.executeAutomaticRetry(job, recoveryPlan);
      case "retry_with_adjustments":
        return await this.executeAdjustedRetry(job, recoveryPlan);
      case "manual_intervention":
        return await this.executeManualRecovery(job, recoveryPlan);
      default:
        throw new Error(`Unknown recovery type: ${recoveryPlan.type}`);
    }
  }

  async executeAutomaticRetry(job, recoveryPlan) {
    // Reset job status
    job.status = "pending";
    job.error = null;
    job.recoveryAttempts = (job.recoveryAttempts || 0) + 1;
    job.lastRecoveryAttempt = new Date();

    // Apply recovery steps
    for (const step of recoveryPlan.steps) {
      await this.executeRecoveryStep(job, step);
    }

    // Restart job
    return await this.jobManager.restartJob(job.id);
  }

  async executeAdjustedRetry(job, recoveryPlan) {
    // Apply adjustments to job configuration
    const adjustedJob = { ...job };
    adjustedJob.config = { ...job.config, ...recoveryPlan.adjustments };
    adjustedJob.status = "pending";
    adjustedJob.error = null;
    adjustedJob.recoveryAttempts = (job.recoveryAttempts || 0) + 1;
    adjustedJob.lastRecoveryAttempt = new Date();

    // Apply recovery steps
    for (const step of recoveryPlan.steps) {
      await this.executeRecoveryStep(adjustedJob, step);
    }

    // Restart job with adjusted configuration
    return await this.jobManager.restartJob(adjustedJob.id, adjustedJob.config);
  }

  async executeManualRecovery(job, recoveryPlan) {
    // Set job status to manual intervention required
    job.status = "manual_intervention_required";
    job.recoveryPlan = recoveryPlan;
    job.lastRecoveryAttempt = new Date();

    // Create intervention ticket if needed
    const ticketStep = recoveryPlan.steps.find(
      (step) => step.type === "create_intervention_ticket",
    );
    if (ticketStep) {
      await this.createSupportTicket(ticketStep.ticketDetails);
    }

    // Update job
    return await this.jobManager.updateJob(job.id, job);
  }

  async executeRecoveryStep(job, step) {
    switch (step.type) {
      case "resume_from_checkpoint":
        await this.checkpointManager.setJobCheckpoint(job.id, step.step);
        break;
      case "apply_retry_strategy":
        await this.retryStrategy.applyStrategy(job.id, step.strategy);
        break;
      case "apply_data_fixes":
        await this.applyDataFixes(job.id, step.fixes);
        break;
      case "adjust_resources":
        await this.adjustJobResources(job.id, step.adjustments);
        break;
      case "relax_validation":
        await this.relaxValidationRules(job.id, step.relaxations);
        break;
      default:
        console.warn(`Unknown recovery step type: ${step.type}`);
    }
  }

  async batchRecovery(jobIds, options = {}) {
    const results = {
      successful: [],
      failed: [],
      skipped: [],
    };

    // Sort jobs by priority and dependencies
    const sortedJobs = await this.sortJobsForRecovery(jobIds, options);

    // Process jobs with concurrency control
    const concurrency = options.concurrency || 3;
    const batches = this.createBatches(sortedJobs, concurrency);

    for (const batch of batches) {
      const batchPromises = batch.map(async (jobId) => {
        try {
          const recoveredJob = await this.recoverJob(jobId, options);
          results.successful.push({
            jobId,
            status: recoveredJob.status,
            recoveryPlan: recoveredJob.recoveryPlan,
          });
        } catch (error) {
          results.failed.push({
            jobId,
            error: error.message,
          });
        }
      });

      await Promise.allSettled(batchPromises);
    }

    return results;
  }

  calculateSuccessRate(failureAnalysis) {
    const baseRates = {
      high: 0.85,
      medium: 0.6,
      low: 0.25,
      unknown: 0.4,
    };

    let successRate = baseRates[failureAnalysis.recoverability] || 0.4;

    // Adjust based on recovery attempts
    if (failureAnalysis.context.recoveryAttempts > 2) {
      successRate *= 0.7; // Reduce success rate for multiple attempts
    }

    // Adjust based on confidence
    successRate *= failureAnalysis.confidence;

    return Math.max(0.1, Math.min(0.95, successRate));
  }

  async sortJobsForRecovery(jobIds, options) {
    const jobs = await Promise.all(
      jobIds.map((id) => this.jobManager.getJob(id)),
    );

    return jobs.sort((a, b) => {
      // Priority order: critical > high > normal > low
      const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 };
      const aPriority = priorityOrder[a.priority] || 2;
      const bPriority = priorityOrder[b.priority] || 2;

      if (aPriority !== bPriority) {
        return bPriority - aPriority;
      }

      // Then by creation time (older first)
      return new Date(a.createdAt) - new Date(b.createdAt);
    });
  }

  createBatches(items, batchSize) {
    const batches = [];
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    return batches;
  }
}
```

**Export Service:**

```javascript
class ExportService {
  constructor(options = {}) {
    this.formatters = new Map();
    this.storageService = options.storageService;
    this.notificationService = options.notificationService;
    this.scheduler = options.scheduler;

    this.initializeFormatters();
  }

  initializeFormatters() {
    this.formatters.set("csv", new CSVFormatter());
    this.formatters.set("json", new JSONFormatter());
    this.formatters.set("excel", new ExcelFormatter());
    this.formatters.set("pdf", new PDFFormatter());
  }

  async exportJobs(exportRequest) {
    try {
      const { jobIds, format, options = {} } = exportRequest;

      // Validate format
      if (!this.formatters.has(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Get job data
      const jobs = await this.getJobData(jobIds, options);

      // Apply filters and transformations
      const processedJobs = this.processJobData(jobs, options);

      // Format data
      const formatter = this.formatters.get(format);
      const exportData = await formatter.formatJobs(processedJobs, options);

      // Generate export metadata
      const metadata = this.generateExportMetadata(
        exportRequest,
        processedJobs,
      );

      // Store export
      const exportResult = await this.storeExport(
        exportData,
        metadata,
        options,
      );

      // Send notifications if requested
      if (options.notify) {
        await this.sendExportNotification(exportResult, options);
      }

      return exportResult;
    } catch (error) {
      console.error("Export failed:", error);
      throw error;
    }
  }

  async exportErrors(exportRequest) {
    try {
      const { filters, format, options = {} } = exportRequest;

      // Validate format
      if (!this.formatters.has(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Get error data
      const errors = await this.getErrorData(filters, options);

      // Apply filters and transformations
      const processedErrors = this.processErrorData(errors, options);

      // Format data
      const formatter = this.formatters.get(format);
      const exportData = await formatter.formatErrors(processedErrors, options);

      // Generate export metadata
      const metadata = this.generateExportMetadata(
        exportRequest,
        processedErrors,
      );

      // Store export
      const exportResult = await this.storeExport(
        exportData,
        metadata,
        options,
      );

      // Send notifications if requested
      if (options.notify) {
        await this.sendExportNotification(exportResult, options);
      }

      return exportResult;
    } catch (error) {
      console.error("Error export failed:", error);
      throw error;
    }
  }

  async exportAnalytics(exportRequest) {
    try {
      const { type, timeRange, format, options = {} } = exportRequest;

      // Validate format
      if (!this.formatters.has(format)) {
        throw new Error(`Unsupported export format: ${format}`);
      }

      // Get analytics data
      const analytics = await this.getAnalyticsData(type, timeRange, options);

      // Process analytics data
      const processedAnalytics = this.processAnalyticsData(analytics, options);

      // Format data
      const formatter = this.formatters.get(format);
      const exportData = await formatter.formatAnalytics(
        processedAnalytics,
        options,
      );

      // Generate export metadata
      const metadata = this.generateExportMetadata(
        exportRequest,
        processedAnalytics,
      );

      // Store export
      const exportResult = await this.storeExport(
        exportData,
        metadata,
        options,
      );

      // Send notifications if requested
      if (options.notify) {
        await this.sendExportNotification(exportResult, options);
      }

      return exportResult;
    } catch (error) {
      console.error("Analytics export failed:", error);
      throw error;
    }
  }

  async scheduleExport(scheduleRequest) {
    try {
      const { type, schedule, exportConfig, options = {} } = scheduleRequest;

      // Validate schedule
      this.validateSchedule(schedule);

      // Create scheduled export
      const scheduledExport = {
        id: this.generateExportId(),
        type,
        schedule,
        exportConfig,
        status: "active",
        createdAt: new Date(),
        lastRun: null,
        nextRun: this.calculateNextRun(schedule),
        options,
      };

      // Schedule the export
      await this.scheduler.schedule({
        id: scheduledExport.id,
        schedule: schedule.cron,
        task: () => this.executeScheduledExport(scheduledExport),
        timezone: schedule.timezone || "UTC",
      });

      // Store scheduled export configuration
      await this.storageService.storeScheduledExport(scheduledExport);

      return scheduledExport;
    } catch (error) {
      console.error("Failed to schedule export:", error);
      throw error;
    }
  }

  async executeScheduledExport(scheduledExport) {
    try {
      console.log(`Executing scheduled export: ${scheduledExport.id}`);

      // Execute the export based on type
      let exportResult;
      switch (scheduledExport.type) {
        case "jobs":
          exportResult = await this.exportJobs(scheduledExport.exportConfig);
          break;
        case "errors":
          exportResult = await this.exportErrors(scheduledExport.exportConfig);
          break;
        case "analytics":
          exportResult = await this.exportAnalytics(
            scheduledExport.exportConfig,
          );
          break;
        default:
          throw new Error(`Unknown export type: ${scheduledExport.type}`);
      }

      // Update scheduled export
      scheduledExport.lastRun = new Date();
      scheduledExport.nextRun = this.calculateNextRun(scheduledExport.schedule);
      await this.storageService.updateScheduledExport(
        scheduledExport.id,
        scheduledExport,
      );

      // Send notification
      await this.sendScheduledExportNotification(scheduledExport, exportResult);

      return exportResult;
    } catch (error) {
      console.error(`Scheduled export failed: ${scheduledExport.id}`, error);

      // Update scheduled export with error
      scheduledExport.lastRun = new Date();
      scheduledExport.lastError = error.message;
      scheduledExport.nextRun = this.calculateNextRun(scheduledExport.schedule);
      await this.storageService.updateScheduledExport(
        scheduledExport.id,
        scheduledExport,
      );

      // Send error notification
      await this.sendScheduledExportErrorNotification(scheduledExport, error);
    }
  }

  async getJobData(jobIds, options) {
    // Implementation would fetch job data from database
    // This is a placeholder for the actual implementation
    return [];
  }

  async getErrorData(filters, options) {
    // Implementation would fetch error data from database
    // This is a placeholder for the actual implementation
    return [];
  }

  async getAnalyticsData(type, timeRange, options) {
    // Implementation would generate analytics data
    // This is a placeholder for the actual implementation
    return {};
  }

  processJobData(jobs, options) {
    let processedJobs = [...jobs];

    // Apply filters
    if (options.filters) {
      processedJobs = this.applyFilters(processedJobs, options.filters);
    }

    // Apply transformations
    if (options.transformations) {
      processedJobs = this.applyTransformations(
        processedJobs,
        options.transformations,
      );
    }

    // Sort data
    if (options.sort) {
      processedJobs = this.sortData(processedJobs, options.sort);
    }

    return processedJobs;
  }

  processErrorData(errors, options) {
    let processedErrors = [...errors];

    // Apply filters
    if (options.filters) {
      processedErrors = this.applyFilters(processedErrors, options.filters);
    }

    // Apply transformations
    if (options.transformations) {
      processedErrors = this.applyTransformations(
        processedErrors,
        options.transformations,
      );
    }

    // Sort data
    if (options.sort) {
      processedErrors = this.sortData(processedErrors, options.sort);
    }

    return processedErrors;
  }

  processAnalyticsData(analytics, options) {
    // Process analytics data based on options
    return analytics;
  }

  generateExportMetadata(exportRequest, data) {
    return {
      id: this.generateExportId(),
      type: exportRequest.type || "custom",
      format: exportRequest.format,
      recordCount: Array.isArray(data) ? data.length : 1,
      size: JSON.stringify(data).length,
      createdAt: new Date(),
      createdBy: exportRequest.userId || "system",
      parameters: exportRequest,
    };
  }

  async storeExport(exportData, metadata, options) {
    const filename = this.generateFilename(metadata, options);

    // Store export data
    const storageResult = await this.storageService.store({
      data: exportData,
      filename,
      metadata,
      path: options.path || "exports",
    });

    return {
      id: metadata.id,
      filename,
      url: storageResult.url,
      size: metadata.size,
      recordCount: metadata.recordCount,
      createdAt: metadata.createdAt,
      downloadUrl: storageResult.downloadUrl,
    };
  }

  generateFilename(metadata, options) {
    const timestamp = new Date().toISOString().split("T")[0];
    const prefix = options.filenamePrefix || "export";
    const type = metadata.type;
    const format = metadata.format;

    return `${prefix}_${type}_${timestamp}.${format}`;
  }

  validateSchedule(schedule) {
    if (!schedule.cron) {
      throw new Error("Schedule must include cron expression");
    }

    // Validate cron expression
    if (!this.isValidCronExpression(schedule.cron)) {
      throw new Error("Invalid cron expression");
    }
  }

  isValidCronExpression(cron) {
    // Basic cron validation - would use a proper cron parser in production
    const cronRegex =
      /^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/;
    return cronRegex.test(cron);
  }

  calculateNextRun(schedule) {
    // Would use a proper cron calculator in production
    const now = new Date();
    const nextRun = new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day for now
    return nextRun;
  }

  generateExportId() {
    return (
      "export_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9)
    );
  }

  applyFilters(data, filters) {
    return data.filter((item) => {
      for (const [field, filter] of Object.entries(filters)) {
        const value = item[field];

        if (filter.equals && value !== filter.equals) {
          return false;
        }

        if (filter.contains && !value.includes(filter.contains)) {
          return false;
        }

        if (filter.gte && value < filter.gte) {
          return false;
        }

        if (filter.lte && value > filter.lte) {
          return false;
        }
      }
      return true;
    });
  }

  applyTransformations(data, transformations) {
    return data.map((item) => {
      const transformed = { ...item };

      for (const [field, transformation] of Object.entries(transformations)) {
        if (transformation.rename) {
          transformed[transformation.rename] = transformed[field];
          delete transformed[field];
        }

        if (transformation.format) {
          transformed[field] = this.formatValue(
            transformed[field],
            transformation.format,
          );
        }
      }

      return transformed;
    });
  }

  formatValue(value, format) {
    switch (format) {
      case "date":
        return new Date(value).toLocaleDateString();
      case "datetime":
        return new Date(value).toLocaleString();
      case "currency":
        return new Intl.NumberFormat("en-US", {
          style: "currency",
          currency: "USD",
        }).format(value);
      case "percentage":
        return (value * 100).toFixed(2) + "%";
      default:
        return value;
    }
  }

  sortData(data, sort) {
    return data.sort((a, b) => {
      for (const [field, direction] of Object.entries(sort)) {
        const aVal = a[field];
        const bVal = b[field];

        if (aVal < bVal) {
          return direction === "asc" ? -1 : 1;
        }
        if (aVal > bVal) {
          return direction === "asc" ? 1 : -1;
        }
      }
      return 0;
    });
  }

  async sendExportNotification(exportResult, options) {
    const notification = {
      type: "export_completed",
      exportId: exportResult.id,
      filename: exportResult.filename,
      downloadUrl: exportResult.downloadUrl,
      size: exportResult.size,
      recordCount: exportResult.recordCount,
      recipients: options.recipients || [],
      timestamp: new Date(),
    };

    await this.notificationService.send(notification);
  }

  async sendScheduledExportNotification(scheduledExport, exportResult) {
    const notification = {
      type: "scheduled_export_completed",
      scheduleId: scheduledExport.id,
      exportId: exportResult.id,
      filename: exportResult.filename,
      downloadUrl: exportResult.downloadUrl,
      recipients: scheduledExport.options.recipients || [],
      timestamp: new Date(),
    };

    await this.notificationService.send(notification);
  }

  async sendScheduledExportErrorNotification(scheduledExport, error) {
    const notification = {
      type: "scheduled_export_failed",
      scheduleId: scheduledExport.id,
      error: error.message,
      recipients: scheduledExport.options.recipients || [],
      timestamp: new Date(),
    };

    await this.notificationService.send(notification);
  }
}
```

**Recovery & Export Interface:**

```javascript
const RecoveryExportTools = ({ userId }) => {
  const [activeTab, setActiveTab] = useState("recovery");
  const [jobs, setJobs] = useState([]);
  const [selectedJobs, setSelectedJobs] = useState([]);
  const [recoveryResults, setRecoveryResults] = useState(null);
  const [exports, setExports] = useState([]);
  const [scheduledExports, setScheduledExports] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadJobs();
    loadExports();
    loadScheduledExports();
  }, []);

  const loadJobs = async () => {
    try {
      const response = await fetch(`/api/jobs?status=failed&userId=${userId}`);
      const data = await response.json();
      setJobs(data.jobs);
    } catch (error) {
      showError("Failed to load failed jobs");
    }
  };

  const loadExports = async () => {
    try {
      const response = await fetch(`/api/exports?userId=${userId}`);
      const data = await response.json();
      setExports(data.exports);
    } catch (error) {
      console.error("Failed to load exports:", error);
    }
  };

  const loadScheduledExports = async () => {
    try {
      const response = await fetch(`/api/exports/scheduled?userId=${userId}`);
      const data = await response.json();
      setScheduledExports(data.scheduledExports);
    } catch (error) {
      console.error("Failed to load scheduled exports:", error);
    }
  };

  const handleRecoverJobs = async (jobIds, options = {}) => {
    setLoading(true);
    try {
      const response = await fetch("/api/recovery/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobIds, ...options }),
      });

      const results = await response.json();
      setRecoveryResults(results);

      showSuccess(
        `Recovery completed: ${results.successful.length} successful, ${results.failed.length} failed`,
      );
      loadJobs(); // Refresh job list
    } catch (error) {
      showError("Recovery failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (exportRequest) => {
    setLoading(true);
    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...exportRequest, userId }),
      });

      const result = await response.json();
      showSuccess(`Export created: ${result.filename}`);
      loadExports(); // Refresh exports list
    } catch (error) {
      showError("Export failed: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleExport = async (scheduleRequest) => {
    setLoading(true);
    try {
      const response = await fetch("/api/exports/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...scheduleRequest, userId }),
      });

      const result = await response.json();
      showSuccess(`Export scheduled: ${result.id}`);
      loadScheduledExports(); // Refresh scheduled exports
    } catch (error) {
      showError("Failed to schedule export: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadExport = async (exportId) => {
    try {
      const exportRecord = exports.find((e) => e.id === exportId);
      if (exportRecord && exportRecord.downloadUrl) {
        window.open(exportRecord.downloadUrl, "_blank");
      }
    } catch (error) {
      showError("Failed to download export");
    }
  };

  return (
    <div className="recovery-export-tools">
      <div className="tools-header">
        <h3>Recovery & Export Tools</h3>
        <div className="tab-navigation">
          <button
            className={activeTab === "recovery" ? "active" : ""}
            onClick={() => setActiveTab("recovery")}
          >
            Job Recovery
          </button>
          <button
            className={activeTab === "export" ? "active" : ""}
            onClick={() => setActiveTab("export")}
          >
            Data Export
          </button>
          <button
            className={activeTab === "scheduled" ? "active" : ""}
            onClick={() => setActiveTab("scheduled")}
          >
            Scheduled Exports
          </button>
        </div>
      </div>

      {activeTab === "recovery" && (
        <JobRecovery
          jobs={jobs}
          selectedJobs={selectedJobs}
          setSelectedJobs={setSelectedJobs}
          recoveryResults={recoveryResults}
          onRecoverJobs={handleRecoverJobs}
          loading={loading}
        />
      )}

      {activeTab === "export" && (
        <DataExport
          exports={exports}
          onExport={handleExport}
          onDownload={handleDownloadExport}
          loading={loading}
        />
      )}

      {activeTab === "scheduled" && (
        <ScheduledExports
          scheduledExports={scheduledExports}
          onSchedule={handleScheduleExport}
          loading={loading}
        />
      )}
    </div>
  );
};
```

**Job Recovery Component:**

```javascript
const JobRecovery = ({
  jobs,
  selectedJobs,
  setSelectedJobs,
  recoveryResults,
  onRecoverJobs,
  loading,
}) => {
  const [recoveryOptions, setRecoveryOptions] = useState({
    concurrency: 3,
    priority: "normal",
    automaticRetry: true,
  });

  const handleJobSelection = (jobId) => {
    setSelectedJobs((prev) =>
      prev.includes(jobId)
        ? prev.filter((id) => id !== jobId)
        : [...prev, jobId],
    );
  };

  const handleSelectAll = () => {
    if (selectedJobs.length === jobs.length) {
      setSelectedJobs([]);
    } else {
      setSelectedJobs(jobs.map((job) => job.id));
    }
  };

  const handleRecoverSelected = () => {
    if (selectedJobs.length === 0) {
      showError("Please select jobs to recover");
      return;
    }

    onRecoverJobs(selectedJobs, recoveryOptions);
  };

  const getRecoverabilityColor = (recoverability) => {
    switch (recoverability) {
      case "high":
        return "#28a745";
      case "medium":
        return "#ffc107";
      case "low":
        return "#dc3545";
      default:
        return "#6c757d";
    }
  };

  return (
    <div className="job-recovery">
      <div className="recovery-controls">
        <div className="selection-controls">
          <button onClick={handleSelectAll}>
            {selectedJobs.length === jobs.length
              ? "Deselect All"
              : "Select All"}
          </button>
          <span className="selection-count">
            {selectedJobs.length} of {jobs.length} selected
          </span>
        </div>

        <div className="recovery-options">
          <label>
            Concurrency:
            <input
              type="number"
              min="1"
              max="10"
              value={recoveryOptions.concurrency}
              onChange={(e) =>
                setRecoveryOptions({
                  ...recoveryOptions,
                  concurrency: parseInt(e.target.value),
                })
              }
            />
          </label>

          <label>
            Priority:
            <select
              value={recoveryOptions.priority}
              onChange={(e) =>
                setRecoveryOptions({
                  ...recoveryOptions,
                  priority: e.target.value,
                })
              }
            >
              <option value="low">Low</option>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </label>

          <label>
            <input
              type="checkbox"
              checked={recoveryOptions.automaticRetry}
              onChange={(e) =>
                setRecoveryOptions({
                  ...recoveryOptions,
                  automaticRetry: e.target.checked,
                })
              }
            />
            Automatic Retry
          </label>
        </div>

        <button
          onClick={handleRecoverSelected}
          disabled={selectedJobs.length === 0 || loading}
          className="recover-button"
        >
          {loading ? "Recovering..." : `Recover ${selectedJobs.length} Jobs`}
        </button>
      </div>

      {recoveryResults && (
        <div className="recovery-results">
          <h4>Recovery Results</h4>
          <div className="results-summary">
            <div className="result-item success">
              <span className="count">{recoveryResults.successful.length}</span>
              <span className="label">Successful</span>
            </div>
            <div className="result-item failed">
              <span className="count">{recoveryResults.failed.length}</span>
              <span className="label">Failed</span>
            </div>
            <div className="result-item skipped">
              <span className="count">{recoveryResults.skipped.length}</span>
              <span className="label">Skipped</span>
            </div>
          </div>
        </div>
      )}

      <div className="jobs-list">
        {jobs.length === 0 ? (
          <div className="empty-state">No failed jobs found</div>
        ) : (
          jobs.map((job) => (
            <div
              key={job.id}
              className={`job-item ${selectedJobs.includes(job.id) ? "selected" : ""}`}
              onClick={() => handleJobSelection(job.id)}
            >
              <div className="job-header">
                <input
                  type="checkbox"
                  checked={selectedJobs.includes(job.id)}
                  onChange={() => handleJobSelection(job.id)}
                />
                <div className="job-info">
                  <h4>{job.type.replace("_", " ").toUpperCase()}</h4>
                  <span className="job-id">{job.id}</span>
                </div>
                <div className="recoverability-indicator">
                  <div
                    className="indicator-dot"
                    style={{
                      backgroundColor: getRecoverabilityColor(
                        job.recoverability,
                      ),
                    }}
                  />
                  <span>{job.recoverability || "unknown"}</span>
                </div>
              </div>

              <div className="job-details">
                <div className="detail-item">
                  <span className="label">Error:</span>
                  <span className="error-message">{job.error}</span>
                </div>

                <div className="detail-item">
                  <span className="label">Failed At:</span>
                  <span>{new Date(job.failedAt).toLocaleString()}</span>
                </div>

                <div className="detail-item">
                  <span className="label">Recovery Attempts:</span>
                  <span>{job.recoveryAttempts || 0}</span>
                </div>

                {job.estimatedSuccessRate && (
                  <div className="detail-item">
                    <span className="label">Success Rate:</span>
                    <span>{(job.estimatedSuccessRate * 100).toFixed(1)}%</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
```

**Error Handling:**

- Recovery failures: Detailed error reporting with fallback manual recovery options
- Export generation errors: Retry mechanism with format fallbacks
- Storage failures: Local backup with retry scheduling
- Notification failures: Logging with alternative delivery methods

## Success Criteria

- Job recovery success rate >85% for recoverable failures
- Export generation completes within 30 seconds for datasets up to 10,000 records
- Automated recovery adds <10% overhead to normal processing time
- Export accuracy maintains 100% data integrity with proper formatting
- Scheduled exports execute reliably with proper error handling

## Monitoring and Observability

**Metrics to Track:**

- Recovery success rates by failure type
- Export generation performance and accuracy
- Batch recovery throughput and efficiency
- Scheduled export execution reliability

**Alerts:**

- Recovery failure rates >15%
- Export generation failures
- Scheduled export missed executions
- Storage capacity warnings

## Integration Points

**Upstream:**

- Progress monitoring (job status)
- Error reporting (failure analysis)
- Job management (recovery execution)

**Downstream:**

- Storage service (export persistence)
- Notification service (alerts and delivery)
- Scheduler (automated exports)

## Recovery & Export Features

**Recovery Capabilities:**

- Intelligent failure analysis
- Automated retry with adjustments
- Checkpoint-based resumption
- Batch recovery operations

**Export Features:**

- Multiple format support (CSV, JSON, PDF, Excel)
- Advanced filtering and transformation
- Scheduled export generation
- Automated delivery options

**Analytics & Monitoring:**

- Recovery success rate tracking
- Export performance metrics
- Failure pattern analysis
- Optimization recommendations
