# Story 5.1: Real-time Progress Monitoring - Brownfield Addition

## User Story

As a data analyst,
I want to monitor the progress of my CSV processing and API uploads in real-time,
So that I can track job status, identify bottlenecks, and know when operations complete.

## Story Context

**Existing System Integration:**
- Integrates with: CSV processing pipeline (Epic 1), API client generation (Epic 2), field mapping interface (Epic 3)
- Technology: Node.js backend with WebSocket support, React frontend with real-time updates, job tracking system
- Follows pattern: Real-time communication frameworks, job monitoring patterns, progress tracking standards
- Touch points: Progress monitoring API, WebSocket service, job queue, status updates

## Acceptance Criteria

**Functional Requirements:**
1. Real-time progress tracking for CSV processing, field mapping, and API upload operations
2. WebSocket-based live updates with automatic reconnection and error handling
3. Detailed job status information including current step, percentage complete, and estimated time remaining
4. Job queue management with pause, resume, and cancel capabilities
5. Historical job tracking with search, filtering, and performance analytics

**Integration Requirements:**
4. Existing job processing patterns remain unchanged (monitoring layer observes existing processes)
5. New functionality follows existing real-time communication and status reporting patterns
6. Integration with all processing pipelines maintains current job flow patterns

**Quality Requirements:**
7. Progress updates deliver within 100ms of job state changes
8. WebSocket connections handle network interruptions with automatic reconnection
9. Job queue supports 100+ concurrent jobs without performance degradation
10. Historical job data retains for 30 days with efficient search and filtering

## Technical Notes

- **Integration Approach:** Progress monitoring integrates with existing processing pipelines through event listeners
- **Existing Pattern Reference:** Follow established WebSocket patterns and job monitoring frameworks
- **Key Constraints:** Must provide real-time updates, handle connection issues, support concurrent jobs

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (monitoring guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** WebSocket connections overwhelming server resources with many concurrent users
- **Mitigation:** Implement connection pooling, rate limiting, and efficient message broadcasting
- **Rollback:** Disable real-time updates and fall back to periodic polling if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing processing pipelines
- [ ] Progress monitoring follows existing job patterns
- [ ] WebSocket implementation uses existing communication standards
- [ ] Job queue integrates with existing processing frameworks

## Story Points Estimation

**Estimation:** 8 points
- Real-time progress tracking engine: 3 points
- WebSocket implementation: 2 points
- Job queue management: 2 points
- Historical job tracking: 1 point

## Dependencies

- CSV processing pipeline (Epic 1)
- API client generation (Epic 2)
- Field mapping interface (Epic 3)
- WebSocket infrastructure

## Testing Requirements

**Unit Tests:**
- Progress tracking algorithms
- WebSocket connection handling
- Job queue management
- Status calculation logic

**Integration Tests:**
- End-to-end progress monitoring
- WebSocket reconnection scenarios
- Concurrent job handling
- Historical data retrieval

**Performance Tests:**
- Progress update latency
- WebSocket connection capacity
- Job queue throughput
- Historical data search performance

## Implementation Notes

**Progress Monitor:**
```javascript
class ProgressMonitor {
  constructor(options = {}) {
    this.jobQueue = new JobQueue(options);
    this.webSocketServer = new WebSocketServer(options);
    this.statusCalculator = new StatusCalculator();
    this.jobHistory = new JobHistory(options);
    this.eventEmitter = new EventEmitter();
  }

  async createJob(jobType, config, userId) {
    const job = {
      id: this.generateJobId(),
      type: jobType, // csv_processing, field_mapping, api_upload
      status: 'pending',
      progress: 0,
      config,
      userId,
      createdAt: new Date(),
      updatedAt: new Date(),
      steps: this.getJobSteps(jobType),
      currentStep: 0,
      metrics: {
        totalItems: 0,
        processedItems: 0,
        errorCount: 0,
        startTime: null,
        estimatedCompletion: null
      }
    };

    // Save job to queue
    await this.jobQueue.add(job);

    // Start job processing
    await this.startJob(job);

    // Notify clients
    this.broadcastJobUpdate(job);

    return job;
  }

  async startJob(job) {
    job.status = 'running';
    job.metrics.startTime = new Date();
    job.updatedAt = new Date();

    await this.jobQueue.update(job);
    this.broadcastJobUpdate(job);

    try {
      switch (job.type) {
        case 'csv_processing':
          await this.processCSVJob(job);
          break;
        case 'field_mapping':
          await this.processFieldMappingJob(job);
          break;
        case 'api_upload':
          await this.processAPIUploadJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${job.type}`);
      }

      job.status = 'completed';
      job.progress = 100;
      job.updatedAt = new Date();
    } catch (error) {
      job.status = 'failed';
      job.error = error.message;
      job.updatedAt = new Date();
    }

    await this.jobQueue.update(job);
    await this.jobHistory.archive(job);
    this.broadcastJobUpdate(job);
  }

  async updateJobProgress(jobId, progress, step = null, metrics = {}) {
    const job = await this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    job.progress = Math.min(100, Math.max(0, progress));
    job.updatedAt = new Date();

    if (step !== null) {
      job.currentStep = step;
    }

    // Update metrics
    if (metrics.processedItems !== undefined) {
      job.metrics.processedItems = metrics.processedItems;
    }
    if (metrics.errorCount !== undefined) {
      job.metrics.errorCount = metrics.errorCount;
    }
    if (metrics.totalItems !== undefined) {
      job.metrics.totalItems = metrics.totalItems;
    }

    // Calculate estimated completion time
    job.metrics.estimatedCompletion = this.statusCalculator.calculateETA(job);

    await this.jobQueue.update(job);
    this.broadcastJobUpdate(job);
  }

  async pauseJob(jobId, userId) {
    const job = await this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.userId !== userId) {
      throw new Error('Insufficient permissions to pause this job');
    }

    if (job.status !== 'running') {
      throw new Error('Job cannot be paused in current state');
    }

    job.status = 'paused';
    job.updatedAt = new Date();

    await this.jobQueue.update(job);
    this.broadcastJobUpdate(job);

    // Signal job process to pause
    this.eventEmitter.emit(`job:pause:${jobId}`);
  }

  async resumeJob(jobId, userId) {
    const job = await this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.userId !== userId) {
      throw new Error('Insufficient permissions to resume this job');
    }

    if (job.status !== 'paused') {
      throw new Error('Job cannot be resumed in current state');
    }

    job.status = 'running';
    job.updatedAt = new Date();

    await this.jobQueue.update(job);
    this.broadcastJobUpdate(job);

    // Signal job process to resume
    this.eventEmitter.emit(`job:resume:${jobId}`);
  }

  async cancelJob(jobId, userId) {
    const job = await this.jobQueue.get(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    if (job.userId !== userId) {
      throw new Error('Insufficient permissions to cancel this job');
    }

    if (['completed', 'failed'].includes(job.status)) {
      throw new Error('Job cannot be cancelled in current state');
    }

    job.status = 'cancelled';
    job.updatedAt = new Date();

    await this.jobQueue.update(job);
    await this.jobHistory.archive(job);
    this.broadcastJobUpdate(job);

    // Signal job process to cancel
    this.eventEmitter.emit(`job:cancel:${jobId}`);
  }

  broadcastJobUpdate(job) {
    const update = {
      type: 'job_update',
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      currentStep: job.currentStep,
      metrics: job.metrics,
      updatedAt: job.updatedAt
    };

    this.webSocketServer.broadcast(`job:${job.userId}`, update);
    this.webSocketServer.broadcast(`job:${job.id}`, update);
  }

  getJobSteps(jobType) {
    const steps = {
      csv_processing: [
        'Validating file',
        'Processing headers',
        'Processing data',
        'Validating results',
        'Completing'
      ],
      field_mapping: [
        'Loading configuration',
        'Applying mappings',
        'Transforming data',
        'Validating output',
        'Completing'
      ],
      api_upload: [
        'Preparing data',
        'Uploading to API',
        'Processing responses',
        'Handling errors',
        'Completing'
      ]
    };

    return steps[jobType] || ['Processing'];
  }

  generateJobId() {
    return 'job_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
```

**Status Calculator:**
```javascript
class StatusCalculator {
  calculateETA(job) {
    if (!job.metrics.startTime || job.progress === 0) {
      return null;
    }

    const elapsed = Date.now() - job.metrics.startTime.getTime();
    const rate = job.progress / elapsed; // progress per millisecond
    
    if (rate === 0) {
      return null;
    }

    const remainingProgress = 100 - job.progress;
    const remainingTime = remainingProgress / rate;
    
    return new Date(Date.now() + remainingTime);
  }

  calculateProcessingRate(job) {
    if (!job.metrics.startTime || job.metrics.processedItems === 0) {
      return 0;
    }

    const elapsed = (Date.now() - job.metrics.startTime.getTime()) / 1000; // seconds
    return job.metrics.processedItems / elapsed; // items per second
  }

  calculateErrorRate(job) {
    if (job.metrics.processedItems === 0) {
      return 0;
    }

    return job.metrics.errorCount / job.metrics.processedItems;
  }

  getJobHealth(job) {
    const errorRate = this.calculateErrorRate(job);
    const processingRate = this.calculateProcessingRate(job);

    if (errorRate > 0.1) {
      return 'poor';
    } else if (errorRate > 0.05 || processingRate < 10) {
      return 'fair';
    } else if (errorRate > 0.01 || processingRate < 100) {
      return 'good';
    } else {
      return 'excellent';
    }
  }
}
```

**WebSocket Server:**
```javascript
class WebSocketServer {
  constructor(options = {}) {
    this.wss = new WebSocket.Server({ 
      port: options.port || 8080,
      path: '/progress'
    });
    this.clients = new Map();
    this.subscriptions = new Map();
    
    this.setupWebSocketServer();
  }

  setupWebSocketServer() {
    this.wss.on('connection', (ws, request) => {
      const clientId = this.generateClientId();
      const client = {
        id: clientId,
        ws,
        subscriptions: new Set(),
        lastPing: Date.now()
      };

      this.clients.set(clientId, client);

      ws.on('message', (message) => {
        this.handleMessage(clientId, message);
      });

      ws.on('close', () => {
        this.clients.delete(clientId);
        this.cleanupSubscriptions(clientId);
      });

      ws.on('error', (error) => {
        console.error(`WebSocket error for client ${clientId}:`, error);
        this.clients.delete(clientId);
        this.cleanupSubscriptions(clientId);
      });

      // Send welcome message
      this.sendToClient(clientId, {
        type: 'welcome',
        clientId,
        timestamp: new Date()
      });
    });

    // Setup ping/pong for connection health
    setInterval(() => {
      this.pingClients();
    }, 30000); // Every 30 seconds
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data.channel);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data.channel);
          break;
        case 'ping':
          this.sendToClient(clientId, { type: 'pong', timestamp: new Date() });
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error(`Error handling message from client ${clientId}:`, error);
    }
  }

  handleSubscription(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.add(channel);
    
    if (!this.subscriptions.has(channel)) {
      this.subscriptions.set(channel, new Set());
    }
    this.subscriptions.get(channel).add(clientId);

    this.sendToClient(clientId, {
      type: 'subscribed',
      channel,
      timestamp: new Date()
    });
  }

  handleUnsubscription(clientId, channel) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.delete(channel);
    
    const channelSubscribers = this.subscriptions.get(channel);
    if (channelSubscribers) {
      channelSubscribers.delete(clientId);
      if (channelSubscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }

    this.sendToClient(clientId, {
      type: 'unsubscribed',
      channel,
      timestamp: new Date()
    });
  }

  broadcast(channel, message) {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    const enhancedMessage = {
      ...message,
      channel,
      timestamp: new Date()
    };

    subscribers.forEach(clientId => {
      this.sendToClient(clientId, enhancedMessage);
    });
  }

  sendToClient(clientId, message) {
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    try {
      client.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error(`Error sending message to client ${clientId}:`, error);
      this.clients.delete(clientId);
      this.cleanupSubscriptions(clientId);
    }
  }

  pingClients() {
    const now = Date.now();
    
    this.clients.forEach((client, clientId) => {
      if (now - client.lastPing > 60000) { // No response for 1 minute
        client.ws.terminate();
        this.clients.delete(clientId);
        this.cleanupSubscriptions(clientId);
      } else {
        this.sendToClient(clientId, { type: 'ping', timestamp: new Date() });
      }
    });
  }

  cleanupSubscriptions(clientId) {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.subscriptions.forEach(channel => {
      const channelSubscribers = this.subscriptions.get(channel);
      if (channelSubscribers) {
        channelSubscribers.delete(clientId);
        if (channelSubscribers.size === 0) {
          this.subscriptions.delete(channel);
        }
      }
    });
  }

  generateClientId() {
    return 'client_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
```

**Progress Monitoring Interface:**
```javascript
const ProgressMonitoring = ({ userId }) => {
  const [jobs, setJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [wsConnection, setWsConnection] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all',
    type: 'all'
  });

  useEffect(() => {
    // Load initial jobs
    loadJobs();

    // Setup WebSocket connection
    const ws = new WebSocket('ws://localhost:8080/progress');
    
    ws.onopen = () => {
      console.log('WebSocket connected');
      // Subscribe to user-specific updates
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: `job:${userId}`
      }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      handleWebSocketMessage(message);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        setWsConnection(new WebSocket('ws://localhost:8080/progress'));
      }, 5000);
    };

    setWsConnection(ws);

    return () => {
      ws.close();
    };
  }, [userId]);

  const loadJobs = async () => {
    try {
      const response = await fetch(`/api/jobs?userId=${userId}`);
      const data = await response.json();
      setJobs(data.jobs);
    } catch (error) {
      showError('Failed to load jobs');
    }
  };

  const handleWebSocketMessage = (message) => {
    switch (message.type) {
      case 'job_update':
        setJobs(prevJobs => 
          prevJobs.map(job => 
            job.id === message.jobId 
              ? { ...job, ...message }
              : job
          )
        );
        break;
      default:
        console.log('Unknown WebSocket message:', message);
    }
  };

  const handleJobAction = async (action, jobId) => {
    try {
      const response = await fetch(`/api/jobs/${jobId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} job`);
      }

      showSuccess(`Job ${action}d successfully`);
    } catch (error) {
      showError(`Failed to ${action} job: ${error.message}`);
    }
  };

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (filters.status !== 'all' && job.status !== filters.status) return false;
      if (filters.type !== 'all' && job.type !== filters.type) return false;
      return true;
    });
  }, [jobs, filters]);

  return (
    <div className="progress-monitoring">
      <div className="monitoring-header">
        <h3>Progress Monitoring</h3>
        <div className="header-actions">
          <button onClick={loadJobs}>Refresh</button>
        </div>
      </div>

      <div className="monitoring-filters">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="running">Running</option>
          <option value="paused">Paused</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <select
          value={filters.type}
          onChange={(e) => setFilters({ ...filters, type: e.target.value })}
        >
          <option value="all">All Types</option>
          <option value="csv_processing">CSV Processing</option>
          <option value="field_mapping">Field Mapping</option>
          <option value="api_upload">API Upload</option>
        </select>
      </div>

      <div className="jobs-list">
        {filteredJobs.length === 0 ? (
          <div className="empty-state">No jobs found</div>
        ) : (
          filteredJobs.map(job => (
            <JobCard
              key={job.id}
              job={job}
              onSelect={setSelectedJob}
              onAction={handleJobAction}
            />
          ))
        )}
      </div>

      {selectedJob && (
        <JobDetailsModal
          job={selectedJob}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
};
```

**Job Card Component:**
```javascript
const JobCard = ({ job, onSelect, onAction }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'running': return '#007bff';
      case 'completed': return '#28a745';
      case 'failed': return '#dc3545';
      case 'paused': return '#ffc107';
      case 'cancelled': return '#6c757d';
      default: return '#6c757d';
    }
  };

  const formatDuration = (startTime) => {
    if (!startTime) return 'N/A';
    
    const duration = Date.now() - new Date(startTime).getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}h ${minutes % 60}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  return (
    <div className="job-card">
      <div className="job-header">
        <div className="job-info">
          <h4>{job.type.replace('_', ' ').toUpperCase()}</h4>
          <span className="job-id">{job.id}</span>
        </div>
        <div className="job-status">
          <div 
            className="status-indicator"
            style={{ backgroundColor: getStatusColor(job.status) }}
          />
          <span className="status-text">{job.status}</span>
        </div>
      </div>

      <div className="job-progress">
        <div className="progress-bar">
          <div 
            className="progress-fill"
            style={{ width: `${job.progress}%` }}
          />
        </div>
        <span className="progress-text">{job.progress.toFixed(1)}%</span>
      </div>

      <div className="job-details">
        <div className="detail-item">
          <span className="label">Current Step:</span>
          <span>{job.steps[job.currentStep] || 'N/A'}</span>
        </div>
        
        <div className="detail-item">
          <span className="label">Duration:</span>
          <span>{formatDuration(job.metrics.startTime)}</span>
        </div>

        {job.metrics.processedItems > 0 && (
          <div className="detail-item">
            <span className="label">Processed:</span>
            <span>{job.metrics.processedItems.toLocaleString()}</span>
          </div>
        )}

        {job.metrics.errorCount > 0 && (
          <div className="detail-item">
            <span className="label">Errors:</span>
            <span className="error-count">{job.metrics.errorCount}</span>
          </div>
        )}

        {job.metrics.estimatedCompletion && (
          <div className="detail-item">
            <span className="label">ETA:</span>
            <span>{new Date(job.metrics.estimatedCompletion).toLocaleTimeString()}</span>
          </div>
        )}
      </div>

      <div className="job-actions">
        <button onClick={() => onSelect(job)}>
          View Details
        </button>
        
        {job.status === 'running' && (
          <button onClick={() => onAction('pause', job.id)}>
            Pause
          </button>
        )}
        
        {job.status === 'paused' && (
          <button onClick={() => onAction('resume', job.id)}>
            Resume
          </button>
        )}
        
        {['running', 'paused'].includes(job.status) && (
          <button 
            onClick={() => onAction('cancel', job.id)}
            className="danger"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
};
```

**Error Handling:**
- WebSocket connection failures: Automatic reconnection with exponential backoff
- Job processing errors: Detailed error reporting with recovery suggestions
- Queue overflow: Graceful degradation and job prioritization
- Status calculation errors: Fallback to basic progress reporting

## Success Criteria

- Progress updates deliver within 100ms of job state changes
- WebSocket connections handle network interruptions with automatic reconnection
- Job queue supports 100+ concurrent jobs without performance degradation
- Historical job data retains for 30 days with efficient search
- Real-time monitoring works for all job types

## Monitoring and Observability

**Metrics to Track:**
- Job processing throughput
- WebSocket connection counts
- Progress update latency
- Job completion rates

**Alerts:**
- Job failure rate >10%
- WebSocket connection failures
- Progress update delays >500ms
- Queue depth >50 jobs

## Integration Points

**Upstream:**
- CSV processing pipeline (job creation)
- Field mapping interface (job tracking)
- API upload system (progress monitoring)

**Downstream:**
- WebSocket service (real-time updates)
- Job queue system (job management)
- Historical storage (job archiving)

## Monitoring Features

**Real-time Updates:**
- WebSocket-based communication
- Automatic reconnection handling
- Live progress tracking
- Status change notifications

**Job Management:**
- Pause/resume capabilities
- Job cancellation
- Queue prioritization
- Concurrent job handling

**Historical Analysis:**
- Job performance metrics
- Error pattern analysis
- Processing time analytics
- Success rate tracking