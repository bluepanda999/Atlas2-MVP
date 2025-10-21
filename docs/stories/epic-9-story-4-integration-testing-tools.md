# Story 9.4: Integration Testing Tools - Brownfield Addition

## User Story

As a developer,
I want comprehensive automated testing tools for API integrations,
So that I can validate connectivity, performance, and reliability before deploying to production.

## Story Context

**Existing System Integration:**

- Integrates with: Pre-built integration catalog (Story 9.1), integration template system (Story 9.2), community connectors (Story 9.3), client generation engine (Epic 2)
- Technology: Node.js backend with Express.js, React frontend with TypeScript, testing frameworks, monitoring and observability tools
- Follows pattern: Automated testing workflows, test result reporting, performance monitoring, error handling standards
- Touch points: Integration testing API, test execution engine, test result storage, monitoring system, notification service

## Acceptance Criteria

**Functional Requirements:**

1. Automated connectivity testing for all integration endpoints with authentication validation
2. Performance testing including response time, throughput, and load testing capabilities
3. Schema validation testing to ensure request/response compliance with OpenAPI specifications
4. Security testing for authentication, authorization, and data protection validation
5. Regression testing suite to detect breaking changes in API updates

**Integration Requirements:** 4. Existing client generation functionality remains unchanged (testing validates generated clients) 5. New functionality follows existing monitoring and observability patterns 6. Integration with authentication system maintains current security testing standards 7. Test results integrate with existing monitoring and notification systems

**Quality Requirements:** 7. Test execution completes within 30 seconds for basic validation tests 8. Performance testing provides accurate metrics with 5% margin of error 9. Test coverage includes 95%+ of critical integration paths 10. All test results include detailed error reporting and remediation suggestions

## Technical Notes

- **Integration Approach:** Testing framework extends existing monitoring capabilities with specialized integration validation and automated test execution
- **Existing Pattern Reference:** Follow established testing patterns, monitoring data structures, and error reporting formats
- **Key Constraints:** Must handle various authentication methods, support different API types, provide actionable test results

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested (client generation, authentication, monitoring)
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (testing guides, API docs)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Test execution impacting production systems or causing rate limiting issues
- **Mitigation:** Sandboxed testing environment, rate limiting controls, test data isolation, configurable test intensity
- **Rollback:** Disable automated testing, maintain manual testing capabilities, preserve existing monitoring

**Compatibility Verification:**

- [ ] No breaking changes to existing client generation APIs
- [ ] Database changes are additive only (new test results tables)
- [ ] Testing service follows existing microservice patterns
- [ ] Monitoring integration uses existing metrics and alerting

## Story Points Estimation

**Estimation:** 16 points

- Test execution engine: 5 points
- Connectivity and authentication testing: 3 points
- Performance and load testing: 3 points
- Schema validation testing: 2 points
- Test result reporting and UI: 2 points
- Security testing integration: 1 point

## Dependencies

- Pre-built integration catalog (Story 9.1)
- Integration template system (Story 9.2)
- Community connectors (Story 9.3)
- Client generation engine (Epic 2)
- Authentication system (Epic 4)
- Monitoring and observability system

## Testing Requirements

**Unit Tests:**

- Test execution engine logic
- Connectivity testing algorithms
- Performance measurement accuracy
- Schema validation rules

**Integration Tests:**

- End-to-end test workflows
- Authentication testing integration
- Performance testing accuracy
- Test result reporting

**Performance Tests:**

- Test execution speed
- Concurrent test capacity
- Memory usage during testing
- Database performance with test results

## Implementation Notes

**Integration Testing Service:**

```typescript
interface IntegrationTestingService {
  runConnectivityTest(integrationId: string): Promise<ConnectivityTestResult>;
  runPerformanceTest(
    integrationId: string,
    config: PerformanceTestConfig,
  ): Promise<PerformanceTestResult>;
  runSchemaValidationTest(integrationId: string): Promise<SchemaTestResult>;
  runSecurityTest(integrationId: string): Promise<SecurityTestResult>;
  runRegressionTest(
    integrationId: string,
    baselineVersion?: string,
  ): Promise<RegressionTestResult>;
  runFullTestSuite(
    integrationId: string,
    config: TestSuiteConfig,
  ): Promise<TestSuiteResult>;
  getTestResults(
    integrationId: string,
    filters?: TestResultFilters,
  ): Promise<TestResult[]>;
}

interface TestResult {
  id: string;
  integrationId: string;
  testType: TestType;
  status: TestStatus;
  startedAt: Date;
  completedAt: Date;
  duration: number;
  result: TestResultData;
  errors: TestError[];
  warnings: TestWarning[];
  metadata: Record<string, any>;
}

enum TestType {
  CONNECTIVITY = "connectivity",
  PERFORMANCE = "performance",
  SCHEMA_VALIDATION = "schema_validation",
  SECURITY = "security",
  REGRESSION = "regression",
}

enum TestStatus {
  PENDING = "pending",
  RUNNING = "running",
  PASSED = "passed",
  FAILED = "failed",
  WARNING = "warning",
  CANCELLED = "cancelled",
}

interface ConnectivityTestResult {
  endpoints: EndpointTestResult[];
  authentication: AuthenticationTestResult;
  overall: {
    successRate: number;
    totalEndpoints: number;
    successfulEndpoints: number;
    failedEndpoints: number;
  };
}

interface PerformanceTestResult {
  responseTime: {
    average: number;
    median: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
    duration: number;
  };
  errorRate: number;
  resourceUsage: {
    cpu: number;
    memory: number;
    network: number;
  };
}
```

**Test Execution Engine:**

```typescript
class TestExecutionEngine {
  async runConnectivityTest(
    integrationId: string,
  ): Promise<ConnectivityTestResult> {
    const integration = await this.getIntegration(integrationId);
    const client = await this.generateClient(integration);

    const endpointResults: EndpointTestResult[] = [];
    let successfulEndpoints = 0;

    // Test each endpoint
    for (const endpoint of integration.endpoints) {
      const result = await this.testEndpoint(client, endpoint);
      endpointResults.push(result);

      if (result.status === "passed") {
        successfulEndpoints++;
      }
    }

    // Test authentication
    const authResult = await this.testAuthentication(
      client,
      integration.authentication,
    );

    return {
      endpoints: endpointResults,
      authentication: authResult,
      overall: {
        successRate: (successfulEndpoints / integration.endpoints.length) * 100,
        totalEndpoints: integration.endpoints.length,
        successfulEndpoints,
        failedEndpoints: integration.endpoints.length - successfulEndpoints,
      },
    };
  }

  private async testEndpoint(
    client: any,
    endpoint: any,
  ): Promise<EndpointTestResult> {
    const startTime = Date.now();

    try {
      // Prepare test data
      const testData = this.generateTestData(endpoint);

      // Make request
      const response = await client.request({
        method: endpoint.method,
        url: endpoint.path,
        data: testData.body,
        params: testData.params,
        headers: testData.headers,
      });

      const duration = Date.now() - startTime;

      // Validate response
      const validation = await this.validateResponse(
        response,
        endpoint.expectedResponses,
      );

      return {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        status: validation.valid ? "passed" : "failed",
        responseTime: duration,
        statusCode: response.status,
        validation,
        errors: validation.errors || [],
      };
    } catch (error) {
      const duration = Date.now() - startTime;

      return {
        endpoint: `${endpoint.method} ${endpoint.path}`,
        status: "failed",
        responseTime: duration,
        statusCode: error.response?.status || 0,
        validation: { valid: false },
        errors: [
          {
            type: "request_failed",
            message: error.message,
            details: error.response?.data,
          },
        ],
      };
    }
  }

  async runPerformanceTest(
    integrationId: string,
    config: PerformanceTestConfig,
  ): Promise<PerformanceTestResult> {
    const integration = await this.getIntegration(integrationId);
    const client = await this.generateClient(integration);

    const results: PerformanceMeasurement[] = [];
    const errors: PerformanceError[] = [];

    // Execute concurrent requests
    const promises = [];
    for (let i = 0; i < config.concurrentRequests; i++) {
      promises.push(
        this.executePerformanceRequests(client, integration, config),
      );
    }

    const startTime = Date.now();
    const batchResults = await Promise.allSettled(promises);
    const duration = Date.now() - startTime;

    // Process results
    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(...result.value);
      } else {
        errors.push({
          type: "batch_failed",
          message: result.reason.message,
        });
      }
    }

    // Calculate metrics
    const responseTimes = results.map((r) => r.responseTime);
    const successCount = results.filter((r) => r.success).length;

    return {
      responseTime: {
        average: this.average(responseTimes),
        median: this.median(responseTimes),
        p95: this.percentile(responseTimes, 95),
        p99: this.percentile(responseTimes, 99),
        min: Math.min(...responseTimes),
        max: Math.max(...responseTimes),
      },
      throughput: {
        requestsPerSecond: (results.length / duration) * 1000,
        totalRequests: results.length,
        duration,
      },
      errorRate: ((results.length - successCount) / results.length) * 100,
      resourceUsage: await this.measureResourceUsage(integrationId),
    };
  }

  private async executePerformanceRequests(
    client: any,
    integration: any,
    config: PerformanceTestConfig,
  ): Promise<PerformanceMeasurement[]> {
    const measurements: PerformanceMeasurement[] = [];

    for (let i = 0; i < config.requestsPerBatch; i++) {
      const endpoint =
        integration.endpoints[
          Math.floor(Math.random() * integration.endpoints.length)
        ];
      const startTime = Date.now();

      try {
        const testData = this.generateTestData(endpoint);
        await client.request({
          method: endpoint.method,
          url: endpoint.path,
          data: testData.body,
          params: testData.params,
        });

        measurements.push({
          responseTime: Date.now() - startTime,
          success: true,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          timestamp: new Date(),
        });
      } catch (error) {
        measurements.push({
          responseTime: Date.now() - startTime,
          success: false,
          endpoint: `${endpoint.method} ${endpoint.path}`,
          timestamp: new Date(),
          error: error.message,
        });
      }

      // Add delay between requests
      if (config.delayBetweenRequests > 0) {
        await this.sleep(config.delayBetweenRequests);
      }
    }

    return measurements;
  }
}
```

**Test API Endpoints:**

```typescript
// POST /api/integrations/:id/test/connectivity
app.post("/api/integrations/:id/test/connectivity", async (req, res) => {
  try {
    const { id } = req.params;

    // Start test execution
    const testId = await testingService.startTest(id, TestType.CONNECTIVITY);

    // Execute test asynchronously
    testingService
      .runConnectivityTest(id)
      .then((result) => testingService.saveTestResult(testId, result))
      .catch((error) => testingService.saveTestError(testId, error));

    res.json({
      testId,
      status: "started",
      message: "Connectivity test started",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to start connectivity test",
      details: error.message,
    });
  }
});

// POST /api/integrations/:id/test/performance
app.post("/api/integrations/:id/test/performance", async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;

    // Validate performance test configuration
    const validation = validatePerformanceTestConfig(config);
    if (!validation.valid) {
      return res.status(400).json({
        error: "Invalid performance test configuration",
        details: validation.errors,
      });
    }

    // Start test execution
    const testId = await testingService.startTest(
      id,
      TestType.PERFORMANCE,
      config,
    );

    // Execute test asynchronously
    testingService
      .runPerformanceTest(id, config)
      .then((result) => testingService.saveTestResult(testId, result))
      .catch((error) => testingService.saveTestError(testId, error));

    res.json({
      testId,
      status: "started",
      message: "Performance test started",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to start performance test",
      details: error.message,
    });
  }
});

// GET /api/integrations/:id/test/results
app.get("/api/integrations/:id/test/results", async (req, res) => {
  try {
    const { id } = req.params;
    const { testType, limit = 50, offset = 0 } = req.query;

    const results = await testingService.getTestResults(id, {
      testType: testType as TestType,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    res.json({
      results,
      total: results.length,
      filters: { testType, limit, offset },
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to fetch test results",
      details: error.message,
    });
  }
});

// POST /api/integrations/:id/test/suite
app.post("/api/integrations/:id/test/suite", async (req, res) => {
  try {
    const { id } = req.params;
    const { config } = req.body;

    // Start full test suite
    const suiteId = await testingService.startTestSuite(id, config);

    res.json({
      suiteId,
      status: "started",
      message: "Full test suite started",
    });
  } catch (error) {
    res.status(500).json({
      error: "Failed to start test suite",
      details: error.message,
    });
  }
});
```

**React Testing Dashboard:**

```typescript
const IntegrationTestingDashboard: React.FC<{ integrationId: string }> = ({ integrationId }) => {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTests, setActiveTests] = useState<ActiveTest[]>([]);

  useEffect(() => {
    loadTestResults();
    const interval = setInterval(loadTestResults, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, [integrationId]);

  const loadTestResults = async () => {
    try {
      const response = await api.get(`/integrations/${integrationId}/test/results`);
      setTestResults(response.data.results);

      // Update active tests
      const active = response.data.results.filter(r => r.status === TestStatus.RUNNING);
      setActiveTests(active);
    } catch (error) {
      console.error('Failed to load test results:', error);
    }
  };

  const runConnectivityTest = async () => {
    try {
      setLoading(true);
      const response = await api.post(`/integrations/${integrationId}/test/connectivity`);
      message.success('Connectivity test started');
      loadTestResults();
    } catch (error) {
      message.error('Failed to start connectivity test');
    } finally {
      setLoading(false);
    }
  };

  const runPerformanceTest = async () => {
    try {
      setLoading(true);
      const config = {
        concurrentRequests: 10,
        requestsPerBatch: 100,
        delayBetweenRequests: 100
      };
      const response = await api.post(`/integrations/${integrationId}/test/performance`, { config });
      message.success('Performance test started');
      loadTestResults();
    } catch (error) {
      message.error('Failed to start performance test');
    } finally {
      setLoading(false);
    }
  };

  const runFullTestSuite = async () => {
    try {
      setLoading(true);
      const config = {
        includeConnectivity: true,
        includePerformance: true,
        includeSchemaValidation: true,
        includeSecurity: true
      };
      const response = await api.post(`/integrations/${integrationId}/test/suite`, { config });
      message.success('Full test suite started');
      loadTestResults();
    } catch (error) {
      message.error('Failed to start test suite');
    } finally {
      setLoading(false);
    }
  };

  const getTestStatusColor = (status: TestStatus) => {
    switch (status) {
      case TestStatus.PASSED: return 'green';
      case TestStatus.FAILED: return 'red';
      case TestStatus.WARNING: return 'orange';
      case TestStatus.RUNNING: return 'blue';
      default: return 'gray';
    }
  };

  return (
    <div className="integration-testing-dashboard">
      <Card title="Integration Testing" style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<ApiOutlined />}
            onClick={runConnectivityTest}
            loading={loading}
          >
            Run Connectivity Test
          </Button>
          <Button
            icon={<DashboardOutlined />}
            onClick={runPerformanceTest}
            loading={loading}
          >
            Run Performance Test
          </Button>
          <Button
            icon={<CheckCircleOutlined />}
            onClick={runFullTestSuite}
            loading={loading}
          >
            Run Full Test Suite
          </Button>
        </Space>

        {activeTests.length > 0 && (
          <Alert
            message="Tests Running"
            description={`${activeTests.length} test(s) currently in progress`}
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}
      </Card>

      <Card title="Recent Test Results">
        <Table
          dataSource={testResults}
          rowKey="id"
          pagination={{ pageSize: 10 }}
          columns={[
            {
              title: 'Test Type',
              dataIndex: 'testType',
              key: 'testType',
              render: (type) => type.replace('_', ' ').toUpperCase()
            },
            {
              title: 'Status',
              dataIndex: 'status',
              key: 'status',
              render: (status) => (
                <Tag color={getTestStatusColor(status)}>
                  {status.toUpperCase()}
                </Tag>
              )
            },
            {
              title: 'Duration',
              dataIndex: 'duration',
              key: 'duration',
              render: (duration) => `${duration}ms`
            },
            {
              title: 'Started',
              dataIndex: 'startedAt',
              key: 'startedAt',
              render: (date) => new Date(date).toLocaleString()
            },
            {
              title: 'Actions',
              key: 'actions',
              render: (_, record) => (
                <Button
                  size="small"
                  onClick={() => viewTestDetails(record.id)}
                >
                  View Details
                </Button>
              )
            }
          ]}
        />
      </Card>
    </div>
  );
};
```

**Database Schema:**

```sql
-- Test results
CREATE TABLE integration_test_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES api_clients(id),
  test_type VARCHAR(50) NOT NULL,
  status VARCHAR(20) NOT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  duration INTEGER,
  result JSONB,
  errors JSONB,
  warnings JSONB,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance test measurements
CREATE TABLE performance_test_measurements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  test_result_id UUID NOT NULL REFERENCES integration_test_results(id),
  endpoint VARCHAR(255) NOT NULL,
  response_time INTEGER NOT NULL,
  success BOOLEAN NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT
);

-- Test schedules
CREATE TABLE integration_test_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES api_clients(id),
  test_type VARCHAR(50) NOT NULL,
  schedule_config JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  last_run TIMESTAMP,
  next_run TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_test_results_integration ON integration_test_results(integration_id);
CREATE INDEX idx_test_results_type_status ON integration_test_results(test_type, status);
CREATE INDEX idx_test_results_created_at ON integration_test_results(created_at DESC);
CREATE INDEX idx_performance_measurements_test ON performance_test_measurements(test_result_id);
CREATE INDEX idx_test_schedules_integration ON integration_test_schedules(integration_id);
```

**Test Configuration Examples:**

**Connectivity Test Configuration:**

```typescript
interface ConnectivityTestConfig {
  endpoints?: string[]; // Specific endpoints to test, empty = all
  timeout?: number; // Request timeout in milliseconds
  retryAttempts?: number; // Number of retry attempts
  testAuthentication?: boolean; // Test authentication endpoints
  validateResponses?: boolean; // Validate response schemas
}
```

**Performance Test Configuration:**

```typescript
interface PerformanceTestConfig {
  duration?: number; // Test duration in seconds
  concurrentRequests?: number; // Number of concurrent requests
  requestsPerBatch?: number; // Requests per concurrent batch
  delayBetweenRequests?: number; // Delay between requests in ms
  endpoints?: string[]; // Specific endpoints to test
  rampUpTime?: number; // Time to ramp up to full load
}
```

## Success Criteria

- Automated connectivity testing validates 100% of integration endpoints
- Performance testing provides accurate metrics within 5% margin of error
- Schema validation testing detects 95%+ of specification violations
- Security testing identifies common authentication and authorization issues
- Test execution completes within specified time limits

## Monitoring and Observability

**Metrics to Track:**

- Test execution frequency and success rates
- Performance benchmark trends over time
- Integration reliability and uptime metrics
- Test failure patterns and root causes
- Resource usage during test execution

**Alerts:**

- Connectivity test failure rate >10%
- Performance degradation >20% from baseline
- Security test failures
- Test execution timeouts
- Resource usage exceeding thresholds

## Integration Points

**Upstream:**

- Integration management UI (test initiation)
- Authentication system (test credentials)

**Downstream:**

- Monitoring system (test metrics)
- Notification system (test alerts)
- Client generation service (test clients)
- Database (test result storage)

## Security Considerations

**Test Security:**

- Test data isolation from production data
- Secure handling of authentication credentials during testing
- Rate limiting to prevent abuse during testing
- Audit logging for all test activities
- Sandboxed test execution environment

**Data Protection:**

- Encryption of sensitive test data
- Access control based on user permissions
- Test result retention policies
- Compliance with data protection regulations
- Secure test data disposal

## Performance Considerations

**Test Execution:**

- Efficient resource usage during test execution
- Configurable test intensity to prevent system overload
- Parallel test execution for improved performance
- Caching of test configurations and results
- Optimized database queries for test data

**Scalability:**

- Support for testing multiple integrations concurrently
- Horizontal scaling of test execution engine
- Efficient storage and retrieval of test results
- Load balancing for test execution
- Resource monitoring and auto-scaling
