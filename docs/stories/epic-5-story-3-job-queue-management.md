# Story 5.3: Job Queue Management - Brownfield Addition

## User Story

As a system administrator,
I want comprehensive job queue management with prioritization, scheduling, and resource allocation,
So that I can optimize processing throughput and manage system resources effectively.

## Story Context

**Existing System Integration:**
- Integrates with: Progress monitoring (Story 5.1), error reporting (Story 5.2), CSV processing pipeline (Epic 1)
- Technology: Node.js backend with queue management system, React frontend for queue administration, resource monitoring
- Follows pattern: Queue management frameworks, job scheduling patterns, resource allocation standards
- Touch points: Job queue API, scheduling engine, resource monitor, queue administration interface

## Acceptance Criteria

**Functional Requirements:**
1. Advanced job queue with priority levels (critical, high, normal, low) and automatic job scheduling
2. Resource management with CPU, memory, and I/O monitoring to prevent system overload
3. Job dependencies and workflow orchestration with conditional execution and parallel processing
4. Queue analytics with throughput metrics, bottleneck identification, and performance optimization suggestions
5. Administrative controls for queue management including pause, drain, and emergency stop capabilities

**Integration Requirements:**
4. Existing job processing patterns remain unchanged (queue management enhances existing processing)
5. New functionality follows existing job scheduling and resource management patterns
6. Integration with all processing pipelines maintains current job execution patterns

**Quality Requirements:**
7. Queue processing handles 1000+ concurrent jobs with efficient resource utilization
8. Job scheduling latency <100ms for queue position changes
9. Resource monitoring adds <1% overhead to processing performance
10. Queue analytics provide real-time metrics with 5-second refresh intervals

## Technical Notes

- **Integration Approach:** Job queue management integrates with existing processing through enhanced scheduling
- **Existing Pattern Reference:** Follow established queue management and resource monitoring frameworks
- **Key Constraints:** Must provide efficient scheduling, prevent resource exhaustion, support complex workflows

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (queue management guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Queue management overhead impacting processing performance
- **Mitigation:** Implement efficient scheduling algorithms, resource pooling, and configurable queue depth
- **Rollback:** Disable advanced queue features and fall back to basic FIFO processing if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing job processing
- [ ] Queue management follows existing scheduling patterns
- [ ] Resource monitoring integrates with existing system metrics
- [ ] Job dependencies use existing workflow patterns

## Story Points Estimation

**Estimation:** 8 points
- Job queue engine: 3 points
- Resource management system: 2 points
- Job dependency management: 2 points
- Queue analytics dashboard: 1 point

## Dependencies

- Progress monitoring (Story 5.1)
- Error reporting (Story 5.2)
- CSV processing pipeline (Epic 1)
- Resource monitoring foundation

## Testing Requirements

**Unit Tests:**
- Job queue algorithms
- Priority scheduling logic
- Resource allocation functions
- Dependency resolution

**Integration Tests:**
- End-to-end queue processing
- Resource monitoring integration
- Job dependency workflows
- Queue administration functions

**Performance Tests:**
- Queue throughput under load
- Resource utilization efficiency
- Scheduling latency measurement
- Concurrent job handling

## Implementation Notes

**Job Queue Manager:**
```javascript
class JobQueueManager {
  constructor(options = {}) {
    this.queues = new Map();
    this.resourceMonitor = new ResourceMonitor(options);
    this.scheduler = new JobScheduler(options);
    this.dependencyManager = new JobDependencyManager(options);
    this.analytics = new QueueAnalytics(options);
    this.adminControls = new QueueAdminControls(options);
    
    this.initializeQueues();
    this.startResourceMonitoring();
  }

  initializeQueues() {
    const queueConfigs = [
      { name: 'critical', priority: 4, maxConcurrency: 2 },
      { name: 'high', priority: 3, maxConcurrency: 5 },
      { name: 'normal', priority: 2, maxConcurrency: 10 },
      { name: 'low', priority: 1, maxConcurrency: 3 }
    ];

    queueConfigs.forEach(config => {
      this.queues.set(config.name, new PriorityQueue({
        name: config.name,
        priority: config.priority,
        maxConcurrency: config.maxConcurrency
      }));
    });
  }

  async enqueueJob(job, options = {}) {
    try {
      // Validate job
      this.validateJob(job);
      
      // Determine queue based on priority or options
      const queueName = options.queue || this.determineQueue(job);
      const queue = this.queues.get(queueName);
      
      if (!queue) {
        throw new Error(`Invalid queue: ${queueName}`);
      }

      // Check dependencies
      if (job.dependencies && job.dependencies.length > 0) {
        await this.dependencyManager.validateDependencies(job.dependencies);
      }

      // Check resource availability
      const canSchedule = await this.scheduler.canSchedule(job);
      if (!canSchedule && !options.force) {
        throw new Error('Insufficient resources to schedule job');
      }

      // Add job to queue
      const queuedJob = {
        ...job,
        id: job.id || this.generateJobId(),
        queueName,
        status: 'queued',
        queuedAt: new Date(),
        priority: options.priority || this.determinePriority(job),
        estimatedDuration: options.estimatedDuration || this.estimateJobDuration(job),
        resourceRequirements: options.resourceRequirements || this.estimateResourceRequirements(job)
      };

      await queue.enqueue(queuedJob);

      // Record analytics
      await this.analytics.recordJobQueued(queuedJob);

      // Attempt to schedule immediately if resources available
      await this.processQueue(queueName);

      return queuedJob;
    } catch (error) {
      await this.analytics.recordJobEnqueueError(job, error);
      throw error;
    }
  }

  async processQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    // Check if queue is paused
    if (queue.paused) {
      return;
    }

    // Get available resources
    const availableResources = await this.resourceMonitor.getAvailableResources();
    
    // Get jobs that can be scheduled
    const schedulableJobs = await this.getSchedulableJobs(queue, availableResources);
    
    // Schedule jobs up to concurrency limit
    const concurrencyLimit = queue.maxConcurrency;
    const currentlyRunning = await this.getRunningJobCount(queueName);
    const availableSlots = concurrencyLimit - currentlyRunning;

    for (let i = 0; i < Math.min(schedulableJobs.length, availableSlots); i++) {
      const job = schedulableJobs[i];
      await this.scheduleJob(job);
    }
  }

  async getSchedulableJobs(queue, availableResources) {
    const jobs = await queue.peek(50); // Get next 50 jobs
    const schedulableJobs = [];

    for (const job of jobs) {
      // Check if dependencies are satisfied
      if (job.dependencies && job.dependencies.length > 0) {
        const dependenciesSatisfied = await this.dependencyManager.checkDependencies(job.dependencies);
        if (!dependenciesSatisfied) {
          continue;
        }
      }

      // Check resource requirements
      const canSchedule = await this.scheduler.canScheduleWithResources(job, availableResources);
      if (canSchedule) {
        schedulableJobs.push(job);
      }
    }

    return schedulableJobs;
  }

  async scheduleJob(job) {
    try {
      // Update job status
      job.status = 'running';
      job.startedAt = new Date();
      
      // Remove from queue
      const queue = this.queues.get(job.queueName);
      await queue.dequeue(job.id);

      // Allocate resources
      await this.resourceMonitor.allocateResources(job.id, job.resourceRequirements);

      // Record analytics
      await this.analytics.recordJobStarted(job);

      // Start job execution
      this.executeJob(job);
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      await this.analytics.recordJobFailed(job, error);
      throw error;
    }
  }

  async executeJob(job) {
    try {
      // Execute job based on type
      let result;
      switch (job.type) {
        case 'csv_processing':
          result = await this.executeCSVProcessingJob(job);
          break;
        case 'field_mapping':
          result = await this.executeFieldMappingJob(job);
          break;
        case 'api_upload':
          result = await this.executeAPIUploadJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      // Mark job as completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;

      // Release resources
      await this.resourceMonitor.releaseResources(job.id);

      // Record analytics
      await this.analytics.recordJobCompleted(job);

      // Check for dependent jobs
      await this.dependencyManager.notifyJobCompleted(job.id);

      // Process queue for next jobs
      await this.processQueue(job.queueName);

    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.failedAt = new Date();

      // Release resources
      await this.resourceMonitor.releaseResources(job.id);

      // Record analytics
      await this.analytics.recordJobFailed(job, error);

      // Process queue for next jobs
      await this.processQueue(job.queueName);
    }
  }

  async pauseQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    queue.paused = true;
    await this.analytics.recordQueuePaused(queueName);
  }

  async resumeQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    queue.paused = false;
    await this.analytics.recordQueueResumed(queueName);
    
    // Process queue immediately
    await this.processQueue(queueName);
  }

  async drainQueue(queueName) {
    const queue = this.queues.get(queueName);
    if (!queue) {
      throw new Error(`Queue not found: ${queueName}`);
    }

    // Stop accepting new jobs
    queue.draining = true;

    // Wait for running jobs to complete
    const runningJobs = await this.getRunningJobs(queueName);
    await Promise.all(runningJobs.map(job => this.waitForJobCompletion(job.id)));

    // Mark queue as drained
    queue.drained = true;
    await this.analytics.recordQueueDrained(queueName);
  }

  async getQueueStatus() {
    const status = {};

    for (const [name, queue] of this.queues) {
      const jobs = await queue.getAll();
      const runningJobs = jobs.filter(job => job.status === 'running');
      const queuedJobs = jobs.filter(job => job.status === 'queued');

      status[name] = {
        size: jobs.length,
        running: runningJobs.length,
        queued: queuedJobs.length,
        paused: queue.paused,
        draining: queue.draining,
        maxConcurrency: queue.maxConcurrency
      };
    }

    return status;
  }

  determineQueue(job) {
    // Determine queue based on job characteristics
    if (job.priority === 'critical' || job.type === 'security') {
      return 'critical';
    } else if (job.priority === 'high' || job.urgent) {
      return 'high';
    } else if (job.priority === 'low') {
      return 'low';
    } else {
      return 'normal';
    }
  }

  determinePriority(job) {
    if (job.priority) {
      const priorityMap = { critical: 4, high: 3, normal: 2, low: 1 };
      return priorityMap[job.priority] || 2;
    }

    // Determine priority based on job type and characteristics
    if (job.type === 'security' || job.urgent) {
      return 4;
    } else if (job.type === 'api_upload' && job.size > 1000000) {
      return 3;
    } else {
      return 2;
    }
  }

  estimateJobDuration(job) {
    // Base duration estimates by job type (in seconds)
    const baseDurations = {
      csv_processing: 60,
      field_mapping: 30,
      api_upload: 45
    };

    let duration = baseDurations[job.type] || 60;

    // Adjust based on job size
    if (job.size) {
      const sizeMultiplier = Math.log10(job.size) / 6; // Logarithmic scaling
      duration *= sizeMultiplier;
    }

    return Math.max(duration, 10); // Minimum 10 seconds
  }

  estimateResourceRequirements(job) {
    const baseRequirements = {
      cpu: 0.5,
      memory: 512, // MB
      io: 0.3
    };

    let requirements = { ...baseRequirements };

    // Adjust based on job characteristics
    if (job.type === 'csv_processing' && job.size) {
      requirements.memory = Math.min(512 + (job.size / 1000), 2048); // Scale with file size
      requirements.cpu = Math.min(1.0, 0.5 + (job.size / 10000));
    }

    if (job.type === 'api_upload') {
      requirements.io = 0.8; // Higher I/O for network operations
    }

    return requirements;
  }

  validateJob(job) {
    if (!job.type) {
      throw new Error('Job type is required');
    }

    if (!job.config) {
      throw new Error('Job configuration is required');
    }

    if (job.userId && typeof job.userId !== 'string') {
      throw new Error('User ID must be a string');
    }
  }

  generateJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  startResourceMonitoring() {
    setInterval(async () => {
      const resources = await this.resourceMonitor.getCurrentResources();
      
      // Trigger queue processing if resources become available
      for (const [queueName] of this.queues) {
        await this.processQueue(queueName);
      }
    }, 5000); // Check every 5 seconds
  }
}
```

**Resource Monitor:**
```javascript
class ResourceMonitor {
  constructor(options = {}) {
    this.thresholds = {
      maxCPU: options.maxCPU || 0.8,
      maxMemory: options.maxMemory || 0.8,
      maxIO: options.maxIO || 0.8
    };
    this.allocatedResources = new Map();
    this.monitoringInterval = options.monitoringInterval || 5000;
  }

  async getCurrentResources() {
    const usage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();
    
    // Get system resource usage (platform-specific)
    const systemResources = await this.getSystemResources();

    return {
      cpu: {
        used: this.calculateCPUUsage(cpuUsage),
        total: systemResources.cpus,
        available: systemResources.cpus - this.calculateCPUUsage(cpuUsage)
      },
      memory: {
        used: usage.heapUsed,
        total: usage.heapTotal,
        systemTotal: systemResources.totalMemory,
        available: systemResources.totalMemory - usage.heapUsed
      },
      io: {
        read: systemResources.io.read,
        write: systemResources.io.write
      },
      timestamp: new Date()
    };
  }

  async getAvailableResources() {
    const current = await this.getCurrentResources();
    const allocated = this.calculateAllocatedResources();

    return {
      cpu: Math.max(0, current.cpu.available - allocated.cpu),
      memory: Math.max(0, current.memory.available - allocated.memory),
      io: Math.max(0, 1 - allocated.io) // I/O as percentage
    };
  }

  async allocateResources(jobId, requirements) {
    const available = await this.getAvailableResources();
    
    // Check if resources are available
    if (requirements.cpu > available.cpu) {
      throw new Error(`Insufficient CPU: required ${requirements.cpu}, available ${available.cpu}`);
    }
    
    if (requirements.memory > available.memory) {
      throw new Error(`Insufficient memory: required ${requirements.memory}MB, available ${available.memory}MB`);
    }
    
    if (requirements.io > available.io) {
      throw new Error(`Insufficient I/O: required ${requirements.io}, available ${available.io}`);
    }

    // Allocate resources
    this.allocatedResources.set(jobId, {
      ...requirements,
      allocatedAt: new Date()
    });

    return true;
  }

  async releaseResources(jobId) {
    this.allocatedResources.delete(jobId);
    return true;
  }

  calculateAllocatedResources() {
    let totalCPU = 0;
    let totalMemory = 0;
    let totalIO = 0;

    for (const allocation of this.allocatedResources.values()) {
      totalCPU += allocation.cpu;
      totalMemory += allocation.memory;
      totalIO += allocation.io;
    }

    return {
      cpu: totalCPU,
      memory: totalMemory,
      io: totalIO
    };
  }

  calculateCPUUsage(cpuUsage) {
    // Convert CPU usage to percentage
    const totalUsage = cpuUsage.user + cpuUsage.system;
    return (totalUsage / 1000000) / 1000; // Convert to seconds, then to percentage
  }

  async getSystemResources() {
    // In production, use system information library
    // For now, return mock data
    return {
      cpus: require('os').cpus().length,
      totalMemory: require('os').totalmem(),
      io: {
        read: 0,
        write: 0
      }
    };
  }

  getResourceUtilization() {
    const allocated = this.calculateAllocatedResources();
    const current = this.getCurrentResources();

    return {
      cpu: allocated.cpu / current.cpu.total,
      memory: allocated.memory / current.memory.systemTotal,
      io: allocated.io
    };
  }

  isResourcePressureHigh() {
    const utilization = this.getResourceUtilization();
    
    return (
      utilization.cpu > this.thresholds.maxCPU ||
      utilization.memory > this.thresholds.maxMemory ||
      utilization.io > this.thresholds.maxIO
    );
  }
}
```

**Job Scheduler:**
```javascript
class JobScheduler {
  constructor(options = {}) {
    this.schedulingStrategies = {
      fifo: this.fifoStrategy.bind(this),
      priority: this.priorityStrategy.bind(this),
      shortest_job_first: this.shortestJobFirstStrategy.bind(this),
      resource_aware: this.resourceAwareStrategy.bind(this)
    };
    
    this.currentStrategy = options.strategy || 'priority';
  }

  async canSchedule(job) {
    const resourceMonitor = new ResourceMonitor();
    const availableResources = await resourceMonitor.getAvailableResources();
    
    return this.canScheduleWithResources(job, availableResources);
  }

  async canScheduleWithResources(job, availableResources) {
    // Check basic resource requirements
    if (job.resourceRequirements) {
      if (job.resourceRequirements.cpu > availableResources.cpu) {
        return false;
      }
      
      if (job.resourceRequirements.memory > availableResources.memory) {
        return false;
      }
      
      if (job.resourceRequirements.io > availableResources.io) {
        return false;
      }
    }

    // Check system-wide resource pressure
    const resourceMonitor = new ResourceMonitor();
    if (resourceMonitor.isResourcePressureHigh()) {
      // Only allow critical jobs during high resource pressure
      return job.priority === 'critical';
    }

    return true;
  }

  async selectNextJob(queue, availableResources) {
    const strategy = this.schedulingStrategies[this.currentStrategy];
    if (!strategy) {
      throw new Error(`Unknown scheduling strategy: ${this.currentStrategy}`);
    }

    return await strategy(queue, availableResources);
  }

  async fifoStrategy(queue, availableResources) {
    const jobs = await queue.peek(10);
    return jobs.find(job => this.canScheduleWithResources(job, availableResources));
  }

  async priorityStrategy(queue, availableResources) {
    const jobs = await queue.peek(20);
    
    // Sort by priority (higher first)
    jobs.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    return jobs.find(job => this.canScheduleWithResources(job, availableResources));
  }

  async shortestJobFirstStrategy(queue, availableResources) {
    const jobs = await queue.peek(20);
    
    // Sort by estimated duration (shorter first)
    jobs.sort((a, b) => (a.estimatedDuration || 60) - (b.estimatedDuration || 60));
    
    return jobs.find(job => this.canScheduleWithResources(job, availableResources));
  }

  async resourceAwareStrategy(queue, availableResources) {
    const jobs = await queue.peek(20);
    
    // Score jobs based on resource efficiency and priority
    const scoredJobs = jobs.map(job => ({
      job,
      score: this.calculateResourceScore(job, availableResources)
    }));
    
    // Sort by score (highest first)
    scoredJobs.sort((a, b) => b.score - a.score);
    
    const bestJob = scoredJobs.find(item => 
      this.canScheduleWithResources(item.job, availableResources)
    );
    
    return bestJob ? bestJob.job : null;
  }

  calculateResourceScore(job, availableResources) {
    let score = 0;
    
    // Priority component (0-40 points)
    score += (job.priority || 2) * 10;
    
    // Resource efficiency component (0-30 points)
    if (job.resourceRequirements) {
      const cpuEfficiency = 1 - (job.resourceRequirements.cpu / availableResources.cpu);
      const memoryEfficiency = 1 - (job.resourceRequirements.memory / availableResources.memory);
      score += (cpuEfficiency + memoryEfficiency) * 15;
    }
    
    // Wait time component (0-20 points)
    if (job.queuedAt) {
      const waitMinutes = (Date.now() - job.queuedAt.getTime()) / (1000 * 60);
      score += Math.min(waitMinutes / 10, 20); // Max 20 points after 10 minutes
    }
    
    // Size component (0-10 points)
    if (job.size) {
      const sizeScore = Math.max(0, 10 - Math.log10(job.size));
      score += sizeScore;
    }
    
    return score;
  }

  setStrategy(strategy) {
    if (!this.schedulingStrategies[strategy]) {
      throw new Error(`Unknown scheduling strategy: ${strategy}`);
    }
    
    this.currentStrategy = strategy;
  }

  getStrategy() {
    return this.currentStrategy;
  }
}
```

**Queue Management Dashboard:**
```javascript
const QueueManagementDashboard = () => {
  const [queueStatus, setQueueStatus] = useState({});
  const [resources, setResources] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadQueueStatus();
    loadResources();
    loadAnalytics();
    
    // Set up real-time updates
    const interval = setInterval(() => {
      loadQueueStatus();
      loadResources();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const loadQueueStatus = async () => {
    try {
      const response = await fetch('/api/queue/status');
      const data = await response.json();
      setQueueStatus(data);
    } catch (error) {
      console.error('Failed to load queue status:', error);
    }
  };

  const loadResources = async () => {
    try {
      const response = await fetch('/api/resources');
      const data = await response.json();
      setResources(data);
    } catch (error) {
      console.error('Failed to load resources:', error);
    }
  };

  const loadAnalytics = async () => {
    try {
      const response = await fetch('/api/queue/analytics');
      const data = await response.json();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleQueueAction = async (queueName, action) => {
    try {
      const response = await fetch(`/api/queue/${queueName}/${action}`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} queue`);
      }

      showSuccess(`Queue ${action}d successfully`);
      loadQueueStatus();
    } catch (error) {
      showError(`Failed to ${action} queue: ${error.message}`);
    }
  };

  return (
    <div className="queue-management-dashboard">
      <div className="dashboard-header">
        <h3>Queue Management</h3>
        <div className="header-actions">
          <button onClick={loadQueueStatus}>Refresh</button>
        </div>
      </div>

      {/* Resource Overview */}
      {resources && (
        <div className="resource-overview">
          <div className="resource-card">
            <h4>CPU Usage</h4>
            <div className="resource-bar">
              <div 
                className="resource-fill cpu"
                style={{ width: `${(resources.cpu.used / resources.cpu.total) * 100}%` }}
              />
            </div>
            <span>{resources.cpu.used.toFixed(1)} / {resources.cpu.total}</span>
          </div>
          
          <div className="resource-card">
            <h4>Memory Usage</h4>
            <div className="resource-bar">
              <div 
                className="resource-fill memory"
                style={{ width: `${(resources.memory.used / resources.memory.systemTotal) * 100}%` }}
              />
            </div>
            <span>{(resources.memory.used / 1024 / 1024).toFixed(1)}MB / {(resources.memory.systemTotal / 1024 / 1024).toFixed(1)}MB</span>
          </div>
        </div>
      )}

      {/* Queue Status */}
      <div className="queue-status">
        <h4>Queue Status</h4>
        <div className="queue-grid">
          {Object.entries(queueStatus).map(([name, status]) => (
            <QueueCard
              key={name}
              name={name}
              status={status}
              onSelect={setSelectedQueue}
              onAction={handleQueueAction}
            />
          ))}
        </div>
      </div>

      {/* Analytics Overview */}
      {analytics && (
        <div className="analytics-overview">
          <h4>Performance Analytics</h4>
          <div className="analytics-grid">
            <div className="analytics-card">
              <h5>Total Processed</h5>
              <span className="analytics-value">{analytics.totalProcessed}</span>
            </div>
            <div className="analytics-card">
              <h5>Average Wait Time</h5>
              <span className="analytics-value">{analytics.averageWaitTime}s</span>
            </div>
            <div className="analytics-card">
              <h5>Throughput</h5>
              <span className="analytics-value">{analytics.throughput}/min</span>
            </div>
            <div className="analytics-card">
              <h5>Success Rate</h5>
              <span className="analytics-value">{(analytics.successRate * 100).toFixed(1)}%</span>
            </div>
          </div>
        </div>
      )}

      {/* Queue Details Modal */}
      {selectedQueue && (
        <QueueDetailsModal
          queueName={selectedQueue}
          onClose={() => setSelectedQueue(null)}
        />
      )}
    </div>
  );
};
```

**Queue Card Component:**
```javascript
const QueueCard = ({ name, status, onSelect, onAction }) => {
  const getStatusColor = (queueStatus) => {
    if (queueStatus.paused) return '#ffc107';
    if (queueStatus.draining) return '#fd7e14';
    if (queueStatus.running > 0) return '#28a745';
    return '#6c757d';
  };

  const getUtilizationPercentage = () => {
    return (status.running / status.maxConcurrency) * 100;
  };

  return (
    <div className="queue-card">
      <div className="queue-header">
        <h4>{name.charAt(0).toUpperCase() + name.slice(1)}</h4>
        <div 
          className="status-indicator"
          style={{ backgroundColor: getStatusColor(status) }}
        />
      </div>

      <div className="queue-metrics">
        <div className="metric">
          <span className="label">Total Jobs:</span>
          <span className="value">{status.size}</span>
        </div>
        
        <div className="metric">
          <span className="label">Running:</span>
          <span className="value">{status.running}</span>
        </div>
        
        <div className="metric">
          <span className="label">Queued:</span>
          <span className="value">{status.queued}</span>
        </div>
        
        <div className="metric">
          <span className="label">Concurrency:</span>
          <span className="value">{status.running}/{status.maxConcurrency}</span>
        </div>
      </div>

      <div className="utilization-bar">
        <div 
          className="utilization-fill"
          style={{ width: `${getUtilizationPercentage()}%` }}
        />
      </div>

      <div className="queue-status-text">
        {status.paused && <span className="status-text paused">Paused</span>}
        {status.draining && <span className="status-text draining">Draining</span>}
        {status.running === 0 && !status.paused && !status.draining && 
          <span className="status-text idle">Idle</span>}
        {status.running > 0 && !status.paused && !status.draining && 
          <span className="status-text active">Active</span>}
      </div>

      <div className="queue-actions">
        <button onClick={() => onSelect(name)}>
          View Details
        </button>
        
        {!status.paused && (
          <button onClick={() => onAction(name, 'pause')}>
            Pause
          </button>
        )}
        
        {status.paused && (
          <button onClick={() => onAction(name, 'resume')}>
            Resume
          </button>
        )}
        
        {!status.draining && (
          <button onClick={() => onAction(name, 'drain')} className="warning">
            Drain
          </button>
        )}
      </div>
    </div>
  );
};
```

**Error Handling:**
- Queue overflow: Automatic job prioritization and resource throttling
- Resource exhaustion: Graceful degradation and job queuing
- Scheduling failures: Fallback to FIFO strategy
- Monitoring errors: Continue operation with reduced visibility

## Success Criteria

- Queue processing handles 1000+ concurrent jobs efficiently
- Job scheduling latency <100ms for queue position changes
- Resource monitoring adds <1% overhead to processing performance
- Queue analytics provide real-time metrics with 5-second refresh
- Administrative controls work for pause, drain, and emergency operations

## Monitoring and Observability

**Metrics to Track:**
- Queue throughput and depth
- Resource utilization rates
- Job scheduling latency
- Queue processing efficiency

**Alerts:**
- Queue depth >100 jobs
- Resource utilization >80%
- Scheduling failures >5%
- Queue processing stalls

## Integration Points

**Upstream:**
- All job processing pipelines (queue integration)
- Progress monitoring (job status updates)

**Downstream:**
- Resource monitoring system (resource allocation)
- Analytics engine (performance metrics)
- Administrative interface (queue controls)

## Queue Management Features

**Scheduling:**
- Multiple scheduling strategies
- Priority-based processing
- Resource-aware scheduling
- Dependency management

**Resource Management:**
- CPU and memory allocation
- I/O bandwidth management
- Resource pressure detection
- Automatic throttling

**Administrative Controls:**
- Queue pause/resume
- Drain operations
- Emergency stop
- Configuration management

**Analytics:**
- Real-time performance metrics
- Throughput monitoring
- Bottleneck identification
- Optimization suggestions