# Story 5.4: Analytics Dashboard - Brownfield Addition

## User Story

As a system administrator,
I want a comprehensive analytics dashboard with performance metrics, trend analysis, and optimization insights,
So that I can monitor system health, identify bottlenecks, and make data-driven decisions.

## Story Context

**Existing System Integration:**
- Integrates with: Progress monitoring (Story 5.1), error reporting (Story 5.2), job queue management (Story 5.3)
- Technology: Node.js backend with analytics engine, React frontend with data visualization, time-series database
- Follows pattern: Analytics frameworks, data visualization standards, performance monitoring patterns
- Touch points: Analytics API, metrics collection, visualization components, reporting system

## Acceptance Criteria

**Functional Requirements:**
1. Real-time performance dashboard with system metrics, job throughput, and error rates
2. Interactive data visualization with charts, graphs, and heatmaps for trend analysis
3. Customizable time ranges and filtering options for focused analysis
4. Automated insights and recommendations based on performance patterns
5. Export capabilities for reports and data in multiple formats (PDF, CSV, JSON)

**Integration Requirements:**
4. Existing monitoring patterns remain unchanged (analytics dashboard aggregates existing metrics)
5. New functionality follows existing data collection and visualization patterns
6. Integration with all monitoring systems maintains current data flow patterns

**Quality Requirements:**
7. Dashboard loads within 3 seconds with complex visualizations
8. Real-time data updates refresh every 5 seconds without performance impact
9. Interactive charts respond within 200ms to user interactions
10. Analytics data retains for 90 days with efficient querying and aggregation

## Technical Notes

- **Integration Approach:** Analytics dashboard integrates with existing monitoring through data aggregation
- **Existing Pattern Reference:** Follow established analytics frameworks and visualization patterns
- **Key Constraints:** Must provide real-time updates, handle large datasets, support interactive visualizations

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (analytics guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Analytics queries impacting system performance during peak usage
- **Mitigation:** Implement efficient data aggregation, caching, and off-peak processing
- **Rollback:** Disable real-time analytics and fall back to basic metrics if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing monitoring systems
- [ ] Analytics dashboard follows existing data patterns
- [ ] Visualization components use existing chart libraries
- [ ] Data aggregation integrates with existing storage

## Story Points Estimation

**Estimation:** 5 points
- Analytics engine: 2 points
- Dashboard interface: 2 points
- Data visualization: 1 point

## Dependencies

- Progress monitoring (Story 5.1)
- Error reporting (Story 5.2)
- Job queue management (Story 5.3)
- Time-series database foundation

## Testing Requirements

**Unit Tests:**
- Analytics calculation algorithms
- Data aggregation functions
- Metric collection accuracy
- Visualization data preparation

**Integration Tests:**
- End-to-end dashboard functionality
- Real-time data updates
- Export capabilities
- Interactive chart behavior

**Performance Tests:**
- Dashboard loading speed
- Chart rendering performance
- Data query responsiveness
- Concurrent user capacity

## Implementation Notes

**Analytics Engine:**
```javascript
class AnalyticsEngine {
  constructor(options = {}) {
    this.metricsCollector = new MetricsCollector(options);
    this.dataAggregator = new DataAggregator(options);
    this.insightsGenerator = new InsightsGenerator(options);
    this.reportGenerator = new ReportGenerator(options);
    this.timeSeriesDB = new TimeSeriesDB(options);
  }

  async getDashboardData(timeRange, filters = {}) {
    try {
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - this.parseTimeRange(timeRange));

      const [
        systemMetrics,
        jobMetrics,
        errorMetrics,
        queueMetrics,
        userMetrics
      ] = await Promise.all([
        this.getSystemMetrics(startTime, endTime, filters),
        this.getJobMetrics(startTime, endTime, filters),
        this.getErrorMetrics(startTime, endTime, filters),
        this.getQueueMetrics(startTime, endTime, filters),
        this.getUserMetrics(startTime, endTime, filters)
      ]);

      return {
        timeRange: { startTime, endTime },
        systemMetrics,
        jobMetrics,
        errorMetrics,
        queueMetrics,
        userMetrics,
        insights: await this.insightsGenerator.generateInsights({
          systemMetrics,
          jobMetrics,
          errorMetrics,
          queueMetrics,
          userMetrics
        }),
        lastUpdated: new Date()
      };
    } catch (error) {
      console.error('Failed to get dashboard data:', error);
      throw error;
    }
  }

  async getSystemMetrics(startTime, endTime, filters) {
    const metrics = await this.timeSeriesDB.query('system_metrics', {
      startTime,
      endTime,
      aggregation: '1m', // 1-minute intervals
      filters
    });

    return {
      cpu: this.aggregateMetric(metrics, 'cpu_usage'),
      memory: this.aggregateMetric(metrics, 'memory_usage'),
      disk: this.aggregateMetric(metrics, 'disk_usage'),
      network: this.aggregateMetric(metrics, 'network_io'),
      uptime: this.getSystemUptime(metrics)
    };
  }

  async getJobMetrics(startTime, endTime, filters) {
    const metrics = await this.timeSeriesDB.query('job_metrics', {
      startTime,
      endTime,
      aggregation: '5m',
      filters
    });

    return {
      throughput: this.calculateThroughput(metrics),
      successRate: this.calculateSuccessRate(metrics),
      averageDuration: this.calculateAverageDuration(metrics),
      jobTypes: this.getJobTypeBreakdown(metrics),
      trends: this.calculateJobTrends(metrics)
    };
  }

  async getErrorMetrics(startTime, endTime, filters) {
    const metrics = await this.timeSeriesDB.query('error_metrics', {
      startTime,
      endTime,
      aggregation: '5m',
      filters
    });

    return {
      errorRate: this.calculateErrorRate(metrics),
      errorCategories: this.getErrorCategoryBreakdown(metrics),
      topErrors: this.getTopErrors(metrics),
      resolutionTime: this.calculateAverageResolutionTime(metrics),
      trends: this.calculateErrorTrends(metrics)
    };
  }

  async getQueueMetrics(startTime, endTime, filters) {
    const metrics = await this.timeSeriesDB.query('queue_metrics', {
      startTime,
      endTime,
      aggregation: '1m',
      filters
    });

    return {
      queueDepth: this.getQueueDepth(metrics),
      waitTime: this.getAverageWaitTime(metrics),
      processingTime: this.getAverageProcessingTime(metrics),
      queueUtilization: this.getQueueUtilization(metrics),
      bottlenecks: this.identifyBottlenecks(metrics)
    };
  }

  async getUserMetrics(startTime, endTime, filters) {
    const metrics = await this.timeSeriesDB.query('user_metrics', {
      startTime,
      endTime,
      aggregation: '1h',
      filters
    });

    return {
      activeUsers: this.getActiveUsers(metrics),
      userActivity: this.getUserActivity(metrics),
      featureUsage: this.getFeatureUsage(metrics),
      userSatisfaction: this.getUserSatisfaction(metrics)
    };
  }

  aggregateMetric(metrics, metricName) {
    const values = metrics.map(m => m[metricName]).filter(v => v !== null);
    
    if (values.length === 0) {
      return { current: 0, average: 0, min: 0, max: 0, trend: 'stable' };
    }

    const current = values[values.length - 1];
    const average = values.reduce((sum, val) => sum + val, 0) / values.length;
    const min = Math.min(...values);
    const max = Math.max(...values);
    
    // Calculate trend
    const trend = this.calculateTrend(values);

    return {
      current: this.roundToTwo(current),
      average: this.roundToTwo(average),
      min: this.roundToTwo(min),
      max: this.roundToTwo(max),
      trend
    };
  }

  calculateThroughput(metrics) {
    const completedJobs = metrics.filter(m => m.status === 'completed');
    const timeSpan = (metrics[metrics.length - 1].timestamp - metrics[0].timestamp) / 1000 / 60; // minutes
    
    return {
      jobsPerMinute: this.roundToTwo(completedJobs.length / timeSpan),
      jobsPerHour: this.roundToTwo((completedJobs.length / timeSpan) * 60),
      daily: this.roundToTwo((completedJobs.length / timeSpan) * 60 * 24)
    };
  }

  calculateSuccessRate(metrics) {
    const totalJobs = metrics.length;
    const successfulJobs = metrics.filter(m => m.status === 'completed').length;
    
    return {
      percentage: this.roundToTwo((successfulJobs / totalJobs) * 100),
      successful: successfulJobs,
      failed: totalJobs - successfulJobs,
      total: totalJobs
    };
  }

  calculateAverageDuration(metrics) {
    const completedJobs = metrics.filter(m => m.status === 'completed' && m.duration);
    const durations = completedJobs.map(m => m.duration);
    
    if (durations.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    durations.sort((a, b) => a - b);
    const median = durations[Math.floor(durations.length / 2)];
    
    return {
      average: this.roundToTwo(durations.reduce((sum, d) => sum + d, 0) / durations.length),
      median: this.roundToTwo(median),
      min: this.roundToTwo(Math.min(...durations)),
      max: this.roundToTwo(Math.max(...durations))
    };
  }

  getJobTypeBreakdown(metrics) {
    const typeCounts = {};
    
    metrics.forEach(metric => {
      if (metric.jobType) {
        typeCounts[metric.jobType] = (typeCounts[metric.jobType] || 0) + 1;
      }
    });

    const total = Object.values(typeCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(typeCounts).map(([type, count]) => ({
      type,
      count,
      percentage: this.roundToTwo((count / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }

  calculateJobTrends(metrics) {
    const timeWindows = this.groupByTimeWindow(metrics, '1h');
    const trends = {};

    Object.entries(timeWindows).forEach(([timeWindow, windowMetrics]) => {
      const completed = windowMetrics.filter(m => m.status === 'completed').length;
      const failed = windowMetrics.filter(m => m.status === 'failed').length;
      
      trends[timeWindow] = {
        completed,
        failed,
        total: windowMetrics.length,
        successRate: this.roundToTwo((completed / windowMetrics.length) * 100)
      };
    });

    return trends;
  }

  calculateErrorRate(metrics) {
    const totalOperations = metrics.length;
    const errors = metrics.filter(m => m.isError).length;
    
    return {
      percentage: this.roundToTwo((errors / totalOperations) * 100),
      errors,
      total: totalOperations,
      trend: this.calculateErrorTrend(metrics)
    };
  }

  getErrorCategoryBreakdown(metrics) {
    const categoryCounts = {};
    
    metrics.filter(m => m.isError).forEach(metric => {
      if (metric.category) {
        categoryCounts[metric.category] = (categoryCounts[metric.category] || 0) + 1;
      }
    });

    const total = Object.values(categoryCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(categoryCounts).map(([category, count]) => ({
      category,
      count,
      percentage: this.roundToTwo((count / total) * 100)
    })).sort((a, b) => b.count - a.count);
  }

  getTopErrors(metrics) {
    const errorCounts = {};
    
    metrics.filter(m => m.isError).forEach(metric => {
      const key = `${metric.category}:${metric.type}`;
      errorCounts[key] = (errorCounts[key] || 0) + 1;
    });

    return Object.entries(errorCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([errorType, count]) => ({
        errorType,
        count
      }));
  }

  calculateTrend(values) {
    if (values.length < 2) return 'stable';
    
    const recent = values.slice(-Math.min(10, values.length));
    const older = values.slice(-Math.min(20, values.length), -Math.min(10, values.length));
    
    if (older.length === 0) return 'stable';
    
    const recentAvg = recent.reduce((sum, val) => sum + val, 0) / recent.length;
    const olderAvg = older.reduce((sum, val) => sum + val, 0) / older.length;
    
    const change = ((recentAvg - olderAvg) / olderAvg) * 100;
    
    if (change > 5) return 'increasing';
    if (change < -5) return 'decreasing';
    return 'stable';
  }

  calculateErrorTrend(metrics) {
    const errorMetrics = metrics.filter(m => m.isError);
    return this.calculateTrend(errorMetrics.map(m => 1)); // Error count trend
  }

  groupByTimeWindow(metrics, windowSize) {
    const windows = {};
    
    metrics.forEach(metric => {
      const windowStart = this.getTimeWindow(metric.timestamp, windowSize);
      const key = windowStart.toISOString();
      
      if (!windows[key]) {
        windows[key] = [];
      }
      
      windows[key].push(metric);
    });

    return windows;
  }

  getTimeWindow(timestamp, windowSize) {
    const date = new Date(timestamp);
    
    switch (windowSize) {
      case '1h':
        date.setMinutes(0, 0, 0);
        break;
      case '1d':
        date.setHours(0, 0, 0, 0);
        break;
      default:
        return date;
    }
    
    return date;
  }

  parseTimeRange(timeRange) {
    const ranges = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000
    };

    return ranges[timeRange] || ranges['24h'];
  }

  roundToTwo(value) {
    return Math.round(value * 100) / 100;
  }

  async exportData(data, format, filters = {}) {
    try {
      switch (format) {
        case 'csv':
          return await this.reportGenerator.generateCSV(data, filters);
        case 'json':
          return await this.reportGenerator.generateJSON(data, filters);
        case 'pdf':
          return await this.reportGenerator.generatePDF(data, filters);
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Failed to export data:', error);
      throw error;
    }
  }
}
```

**Analytics Dashboard:**
```javascript
const AnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [timeRange, setTimeRange] = useState('24h');
  const [filters, setFilters] = useState({});
  const [loading, setLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [selectedMetric, setSelectedMetric] = useState(null);

  useEffect(() => {
    loadDashboardData();
  }, [timeRange, filters]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      loadDashboardData();
    }, 5000); // Refresh every 5 seconds

    return () => clearInterval(interval);
  }, [timeRange, filters, autoRefresh]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      const analyticsEngine = new AnalyticsEngine();
      const data = await analyticsEngine.getDashboardData(timeRange, filters);
      setDashboardData(data);
    } catch (error) {
      showError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async (format) => {
    try {
      const analyticsEngine = new AnalyticsEngine();
      const exportData = await analyticsEngine.exportData(dashboardData, format, filters);
      
      // Download the file
      const blob = new Blob([exportData], { 
        type: format === 'json' ? 'application/json' : 'text/csv' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${new Date().toISOString().split('T')[0]}.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      showSuccess(`Data exported as ${format.toUpperCase()}`);
    } catch (error) {
      showError('Failed to export data');
    }
  };

  if (!dashboardData) {
    return <div className="loading">Loading dashboard...</div>;
  }

  return (
    <div className="analytics-dashboard">
      <div className="dashboard-header">
        <h3>Analytics Dashboard</h3>
        <div className="header-controls">
          <div className="time-range-selector">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
            >
              <option value="1h">Last Hour</option>
              <option value="6h">Last 6 Hours</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
            </select>
          </div>
          
          <div className="auto-refresh-toggle">
            <label>
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              Auto Refresh
            </label>
          </div>
          
          <div className="export-controls">
            <button onClick={() => handleExport('csv')}>Export CSV</button>
            <button onClick={() => handleExport('json')}>Export JSON</button>
            <button onClick={() => handleExport('pdf')}>Export PDF</button>
          </div>
          
          <button onClick={loadDashboardData} disabled={loading}>
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Insights Panel */}
      {dashboardData.insights && (
        <InsightsPanel insights={dashboardData.insights} />
      )}

      {/* System Metrics Overview */}
      <div className="metrics-overview">
        <h4>System Performance</h4>
        <div className="metrics-grid">
          <MetricCard
            title="CPU Usage"
            value={dashboardData.systemMetrics.cpu.current}
            unit="%"
            trend={dashboardData.systemMetrics.cpu.trend}
            details={dashboardData.systemMetrics.cpu}
            onClick={() => setSelectedMetric('cpu')}
          />
          
          <MetricCard
            title="Memory Usage"
            value={dashboardData.systemMetrics.memory.current}
            unit="%"
            trend={dashboardData.systemMetrics.memory.trend}
            details={dashboardData.systemMetrics.memory}
            onClick={() => setSelectedMetric('memory')}
          />
          
          <MetricCard
            title="Job Throughput"
            value={dashboardData.jobMetrics.throughput.jobsPerHour}
            unit="jobs/hr"
            trend={dashboardData.jobMetrics.trends}
            details={dashboardData.jobMetrics.throughput}
            onClick={() => setSelectedMetric('throughput')}
          />
          
          <MetricCard
            title="Success Rate"
            value={dashboardData.jobMetrics.successRate.percentage}
            unit="%"
            trend={dashboardData.jobMetrics.successRate.percentage > 95 ? 'stable' : 'decreasing'}
            details={dashboardData.jobMetrics.successRate}
            onClick={() => setSelectedMetric('success_rate')}
          />
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-section">
        <div className="chart-row">
          <div className="chart-container">
            <h5>System Performance Over Time</h5>
            <SystemPerformanceChart 
              data={dashboardData.systemMetrics}
              timeRange={timeRange}
            />
          </div>
          
          <div className="chart-container">
            <h5>Job Processing Trends</h5>
            <JobTrendsChart 
              data={dashboardData.jobMetrics}
              timeRange={timeRange}
            />
          </div>
        </div>
        
        <div className="chart-row">
          <div className="chart-container">
            <h5>Error Analysis</h5>
            <ErrorAnalysisChart 
              data={dashboardData.errorMetrics}
              timeRange={timeRange}
            />
          </div>
          
          <div className="chart-container">
            <h5>Queue Performance</h5>
            <QueuePerformanceChart 
              data={dashboardData.queueMetrics}
              timeRange={timeRange}
            />
          </div>
        </div>
      </div>

      {/* Detailed Metrics */}
      <div className="detailed-metrics">
        <div className="metrics-tabs">
          <TabButton active={selectedMetric === 'jobs'} onClick={() => setSelectedMetric('jobs')}>
            Job Metrics
          </TabButton>
          <TabButton active={selectedMetric === 'errors'} onClick={() => setSelectedMetric('errors')}>
            Error Analysis
          </TabButton>
          <TabButton active={selectedMetric === 'queues'} onClick={() => setSelectedMetric('queues')}>
            Queue Analysis
          </TabButton>
          <TabButton active={selectedMetric === 'users'} onClick={() => setSelectedMetric('users')}>
            User Activity
          </TabButton>
        </div>
        
        <div className="metrics-content">
          {selectedMetric === 'jobs' && (
            <JobMetricsDetails data={dashboardData.jobMetrics} />
          )}
          {selectedMetric === 'errors' && (
            <ErrorMetricsDetails data={dashboardData.errorMetrics} />
          )}
          {selectedMetric === 'queues' && (
            <QueueMetricsDetails data={dashboardData.queueMetrics} />
          )}
          {selectedMetric === 'users' && (
            <UserMetricsDetails data={dashboardData.userMetrics} />
          )}
        </div>
      </div>

      {/* Last Updated */}
      <div className="dashboard-footer">
        <span>Last updated: {new Date(dashboardData.lastUpdated).toLocaleString()}</span>
      </div>
    </div>
  );
};
```

**Metric Card Component:**
```javascript
const MetricCard = ({ title, value, unit, trend, details, onClick }) => {
  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      case 'stable': return '➡️';
      default: return '➡️';
    }
  };

  const getTrendColor = (trend) => {
    switch (trend) {
      case 'increasing': return '#28a745';
      case 'decreasing': return '#dc3545';
      case 'stable': return '#6c757d';
      default: return '#6c757d';
    }
  };

  return (
    <div className="metric-card" onClick={onClick}>
      <div className="metric-header">
        <h5>{title}</h5>
        <span className="trend-icon" style={{ color: getTrendColor(trend) }}>
          {getTrendIcon(trend)}
        </span>
      </div>
      
      <div className="metric-value">
        <span className="value">{typeof value === 'number' ? value.toFixed(1) : value}</span>
        <span className="unit">{unit}</span>
      </div>
      
      {details && (
        <div className="metric-details">
          <div className="detail-item">
            <span>Avg:</span>
            <span>{details.average?.toFixed(1) || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span>Min:</span>
            <span>{details.min?.toFixed(1) || 'N/A'}</span>
          </div>
          <div className="detail-item">
            <span>Max:</span>
            <span>{details.max?.toFixed(1) || 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
};
```

**Insights Panel:**
```javascript
const InsightsPanel = ({ insights }) => {
  if (!insights || insights.length === 0) {
    return null;
  }

  const getInsightIcon = (type) => {
    switch (type) {
      case 'performance': return '⚡';
      case 'error': return '⚠️';
      case 'optimization': return '💡';
      case 'trend': return '📊';
      default: return 'ℹ️';
    }
  };

  const getInsightColor = (severity) => {
    switch (severity) {
      case 'critical': return '#dc3545';
      case 'warning': return '#ffc107';
      case 'info': return '#17a2b8';
      default: return '#6c757d';
    }
  };

  return (
    <div className="insights-panel">
      <h4>Insights & Recommendations</h4>
      <div className="insights-list">
        {insights.map((insight, index) => (
          <div key={index} className="insight-item">
            <div className="insight-header">
              <span className="insight-icon">{getInsightIcon(insight.type)}</span>
              <span className="insight-title">{insight.title}</span>
              <span 
                className="insight-severity"
                style={{ color: getInsightColor(insight.severity) }}
              >
                {insight.severity.toUpperCase()}
              </span>
            </div>
            
            <div className="insight-description">
              {insight.description}
            </div>
            
            {insight.recommendations && (
              <div className="insight-recommendations">
                <strong>Recommendations:</strong>
                <ul>
                  {insight.recommendations.map((rec, i) => (
                    <li key={i}>{rec}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {insight.impact && (
              <div className="insight-impact">
                <strong>Impact:</strong> {insight.impact}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
```

**Chart Components:**
```javascript
const SystemPerformanceChart = ({ data, timeRange }) => {
  const chartData = {
    labels: generateTimeLabels(timeRange),
    datasets: [
      {
        label: 'CPU Usage (%)',
        data: data.cpu.history || [],
        borderColor: '#007bff',
        backgroundColor: 'rgba(0, 123, 255, 0.1)',
        tension: 0.4
      },
      {
        label: 'Memory Usage (%)',
        data: data.memory.history || [],
        borderColor: '#28a745',
        backgroundColor: 'rgba(40, 167, 69, 0.1)',
        tension: 0.4
      }
    ]
  };

  return (
    <div className="chart-wrapper">
      <Line data={chartData} options={{
        responsive: true,
        scales: {
          y: {
            beginAtZero: true,
            max: 100
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }} />
    </div>
  );
};

const JobTrendsChart = ({ data, timeRange }) => {
  const chartData = {
    labels: generateTimeLabels(timeRange),
    datasets: [
      {
        label: 'Completed Jobs',
        data: data.trends ? Object.values(data.trends).map(t => t.completed) : [],
        backgroundColor: '#28a745'
      },
      {
        label: 'Failed Jobs',
        data: data.trends ? Object.values(data.trends).map(t => t.failed) : [],
        backgroundColor: '#dc3545'
      }
    ]
  };

  return (
    <div className="chart-wrapper">
      <Bar data={chartData} options={{
        responsive: true,
        scales: {
          x: {
            stacked: true
          },
          y: {
            stacked: true,
            beginAtZero: true
          }
        }
      }} />
    </div>
  );
};

const ErrorAnalysisChart = ({ data, timeRange }) => {
  const chartData = {
    labels: data.errorCategories ? data.errorCategories.map(c => c.category) : [],
    datasets: [
      {
        label: 'Errors by Category',
        data: data.errorCategories ? data.errorCategories.map(c => c.count) : [],
        backgroundColor: [
          '#dc3545',
          '#fd7e14',
          '#ffc107',
          '#17a2b8',
          '#6f42c1'
        ]
      }
    ]
  };

  return (
    <div className="chart-wrapper">
      <Pie data={chartData} options={{
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          }
        }
      }} />
    </div>
  );
};

const QueuePerformanceChart = ({ data, timeRange }) => {
  const chartData = {
    labels: generateTimeLabels(timeRange),
    datasets: [
      {
        label: 'Queue Depth',
        data: data.queueDepth || [],
        borderColor: '#ffc107',
        backgroundColor: 'rgba(255, 193, 7, 0.1)',
        tension: 0.4,
        yAxisID: 'y'
      },
      {
        label: 'Average Wait Time (s)',
        data: data.waitTime || [],
        borderColor: '#17a2b8',
        backgroundColor: 'rgba(23, 162, 184, 0.1)',
        tension: 0.4,
        yAxisID: 'y1'
      }
    ]
  };

  return (
    <div className="chart-wrapper">
      <Line data={chartData} options={{
        responsive: true,
        scales: {
          y: {
            type: 'linear',
            display: true,
            position: 'left',
            beginAtZero: true
          },
          y1: {
            type: 'linear',
            display: true,
            position: 'right',
            beginAtZero: true,
            grid: {
              drawOnChartArea: false
            }
          }
        }
      }} />
    </div>
  );
};

// Helper function to generate time labels
function generateTimeLabels(timeRange) {
  const labels = [];
  const now = new Date();
  const intervals = getTimeIntervals(timeRange);
  
  for (let i = intervals - 1; i >= 0; i--) {
    const time = new Date(now.getTime() - (i * getTimeIntervalMs(timeRange)));
    labels.push(time.toLocaleTimeString());
  }
  
  return labels;
}

function getTimeIntervals(timeRange) {
  const intervals = {
    '1h': 12,
    '6h': 12,
    '24h': 24,
    '7d': 7,
    '30d': 30
  };
  
  return intervals[timeRange] || 24;
}

function getTimeIntervalMs(timeRange) {
  const intervalMs = {
    '1h': 5 * 60 * 1000,
    '6h': 30 * 60 * 1000,
    '24h': 60 * 60 * 1000,
    '7d': 24 * 60 * 60 * 1000,
    '30d': 24 * 60 * 60 * 1000
  };
  
  return intervalMs[timeRange] || 60 * 60 * 1000;
}
```

**Error Handling:**
- Data loading failures: Graceful degradation with cached data
- Chart rendering errors: Fallback to simple metric displays
- Export failures: User-friendly error messages with retry options
- Real-time update failures: Continue with static data

## Success Criteria

- Dashboard loads within 3 seconds with complex visualizations
- Real-time data updates refresh every 5 seconds without performance impact
- Interactive charts respond within 200ms to user interactions
- Analytics data retains for 90 days with efficient querying
- Export functionality works for CSV, JSON, and PDF formats

## Monitoring and Observability

**Metrics to Track:**
- Dashboard loading performance
- Chart rendering times
- Data query response times
- User interaction patterns

**Alerts:**
- Dashboard loading time >5 seconds
- Chart rendering failures
- Data query timeouts
- Export generation failures

## Integration Points

**Upstream:**
- All monitoring systems (data aggregation)
- Time-series database (historical data)
- Metrics collector (real-time data)

**Downstream:**
- Visualization library (chart rendering)
- Export service (report generation)
- Alert system (insights notifications)

## Analytics Features

**Real-time Monitoring:**
- Live system metrics
- Job processing status
- Error tracking
- Resource utilization

**Data Visualization:**
- Interactive charts and graphs
- Heatmaps and trend analysis
- Performance comparisons
- Historical data views

**Insights Generation:**
- Automated anomaly detection
- Performance recommendations
- Optimization suggestions
- Predictive analytics

**Reporting:**
- Customizable time ranges
- Multiple export formats
- Scheduled reports
- Data filtering options