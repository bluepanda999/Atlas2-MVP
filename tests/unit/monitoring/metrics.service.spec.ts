import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../../../../src/services/monitoring/metrics.service';

describe('MetricsService', () => {
  let service: MetricsService;
  let mockRegistry: any;

  beforeEach(async () => {
    mockRegistry = {
      metrics: jest.fn().mockResolvedValue('# HELP test_metric Test metric\ntest_metric 1\n'),
      getSingleMetric: jest.fn().mockReturnValue({
        get: jest.fn().mockResolvedValue([
          { value: 10, labels: { method: 'GET', route: '/test' } },
          { value: 5, labels: { method: 'POST', route: '/test' } },
        ]),
      }),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [MetricsService],
    })
    .overrideProvider('prom-client')
    .useValue({
      register: {
        collectDefaultMetrics: jest.fn(),
        metrics: jest.fn().mockResolvedValue(''),
      },
      Counter: jest.fn().mockImplementation(() => ({
        inc: jest.fn(),
        get: jest.fn().mockResolvedValue([]),
      })),
      Histogram: jest.fn().mockImplementation(() => ({
        observe: jest.fn(),
        get: jest.fn().mockResolvedValue([]),
      })),
      Gauge: jest.fn().mockImplementation(() => ({
        set: jest.fn(),
        get: jest.fn().mockResolvedValue([]),
      })),
      Registry: jest.fn().mockImplementation(() => mockRegistry),
    })
    .compile();

    service = module.get<MetricsService>(MetricsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('HTTP Metrics', () => {
    it('should increment HTTP requests', () => {
      const incSpy = jest.spyOn(service as any, 'httpRequestsTotal', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementHttpRequests('GET', '/test', '200');

      expect(incSpy).toHaveBeenCalled();
    });

    it('should observe HTTP request duration', () => {
      const observeSpy = jest.spyOn(service as any, 'httpRequestDuration', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeHttpRequestDuration('GET', '/test', '200', 0.5);

      expect(observeSpy).toHaveBeenCalledWith({ method: 'GET', route: '/test', status_code: '200' }, 0.5);
    });

    it('should observe HTTP request size', () => {
      const observeSpy = jest.spyOn(service as any, 'httpRequestSize', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeHttpRequestSize('GET', '/test', 1024);

      expect(observeSpy).toHaveBeenCalledWith({ method: 'GET', route: '/test' }, 1024);
    });

    it('should observe HTTP response size', () => {
      const observeSpy = jest.spyOn(service as any, 'httpResponseSize', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeHttpResponseSize('GET', '/test', '200', 2048);

      expect(observeSpy).toHaveBeenCalledWith({ method: 'GET', route: '/test', status_code: '200' }, 2048);
    });
  });

  describe('Authentication Metrics', () => {
    it('should increment auth attempts', () => {
      const incSpy = jest.spyOn(service as any, 'authAttempts', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementAuthAttempts('api_key', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ auth_type: 'api_key', client_id: 'client123' });
    });

    it('should increment auth failures', () => {
      const incSpy = jest.spyOn(service as any, 'authFailures', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementAuthFailures('api_key', 'invalid_key', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ auth_type: 'api_key', reason: 'invalid_key', client_id: 'client123' });
    });

    it('should increment auth successes', () => {
      const incSpy = jest.spyOn(service as any, 'authSuccesses', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementAuthSuccesses('api_key', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ auth_type: 'api_key', client_id: 'client123' });
    });

    it('should observe auth duration', () => {
      const observeSpy = jest.spyOn(service as any, 'authDuration', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeAuthDuration('api_key', 0.1);

      expect(observeSpy).toHaveBeenCalledWith({ auth_type: 'api_key' }, 0.1);
    });
  });

  describe('Upload Metrics', () => {
    it('should increment upload attempts', () => {
      const incSpy = jest.spyOn(service as any, 'uploadAttempts', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementUploadAttempts('csv', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ file_type: 'csv', client_id: 'client123' });
    });

    it('should increment upload successes', () => {
      const incSpy = jest.spyOn(service as any, 'uploadSuccesses', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementUploadSuccesses('csv', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ file_type: 'csv', client_id: 'client123' });
    });

    it('should increment upload failures', () => {
      const incSpy = jest.spyOn(service as any, 'uploadFailures', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementUploadFailures('csv', 'invalid_format', 'client123');

      expect(incSpy).toHaveBeenCalledWith({ file_type: 'csv', reason: 'invalid_format', client_id: 'client123' });
    });

    it('should observe upload duration', () => {
      const observeSpy = jest.spyOn(service as any, 'uploadDuration', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeUploadDuration('csv', 30);

      expect(observeSpy).toHaveBeenCalledWith({ file_type: 'csv' }, 30);
    });

    it('should observe upload size', () => {
      const observeSpy = jest.spyOn(service as any, 'uploadSize', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeUploadSize('csv', 1048576);

      expect(observeSpy).toHaveBeenCalledWith({ file_type: 'csv' }, 1048576);
    });

    it('should set active uploads', () => {
      const setSpy = jest.spyOn(service as any, 'activeUploads', 'get').mockReturnValue({
        set: jest.fn(),
      });

      service.setActiveUploads(5);

      expect(setSpy).toHaveBeenCalledWith(5);
    });
  });

  describe('Database Metrics', () => {
    it('should set active DB connections', () => {
      const setSpy = jest.spyOn(service as any, 'dbConnectionsActive', 'get').mockReturnValue({
        set: jest.fn(),
      });

      service.setDbConnectionsActive(10);

      expect(setSpy).toHaveBeenCalledWith(10);
    });

    it('should observe DB query duration', () => {
      const observeSpy = jest.spyOn(service as any, 'dbQueryDuration', 'get').mockReturnValue({
        observe: jest.fn(),
      });

      service.observeDbQueryDuration('SELECT', 'users', 0.05);

      expect(observeSpy).toHaveBeenCalledWith({ query_type: 'SELECT', table: 'users' }, 0.05);
    });

    it('should increment DB query errors', () => {
      const incSpy = jest.spyOn(service as any, 'dbQueryErrors', 'get').mockReturnValue({
        inc: jest.fn(),
      });

      service.incrementDbQueryErrors('SELECT', 'users', 'connection_timeout');

      expect(incSpy).toHaveBeenCalledWith({ query_type: 'SELECT', table: 'users', error_type: 'connection_timeout' });
    });
  });

  describe('System Metrics', () => {
    it('should set memory usage', () => {
      const setSpy = jest.spyOn(service as any, 'memoryUsage', 'get').mockReturnValue({
        set: jest.fn(),
      });

      service.setMemoryUsage('heap_used', 134217728);

      expect(setSpy).toHaveBeenCalledWith({ type: 'heap_used' }, 134217728);
    });

    it('should set CPU usage', () => {
      const setSpy = jest.spyOn(service as any, 'cpuUsage', 'get').mockReturnValue({
        set: jest.fn(),
      });

      service.setCpuUsage(75.5);

      expect(setSpy).toHaveBeenCalledWith(75.5);
    });

    it('should set disk usage', () => {
      const setSpy = jest.spyOn(service as any, 'diskUsage', 'get').mockReturnValue({
        set: jest.fn(),
      });

      service.setDiskUsage('/', 107374182400);

      expect(setSpy).toHaveBeenCalledWith({ mount_point: '/' }, 107374182400);
    });
  });

  describe('Custom Metrics', () => {
    it('should create custom counter', () => {
      const counter = service.createCustomCounter('custom_counter', 'A custom counter', ['label1', 'label2']);
      
      expect(counter).toBeDefined();
      expect(counter.inc).toBeDefined();
    });

    it('should create custom histogram', () => {
      const histogram = service.createCustomHistogram('custom_histogram', 'A custom histogram', ['label1'], [1, 5, 10]);
      
      expect(histogram).toBeDefined();
      expect(histogram.observe).toBeDefined();
    });

    it('should create custom gauge', () => {
      const gauge = service.createCustomGauge('custom_gauge', 'A custom gauge', ['label1']);
      
      expect(gauge).toBeDefined();
      expect(gauge.set).toBeDefined();
    });
  });

  describe('Health Metrics', () => {
    it('should return health metrics', () => {
      const healthMetrics = service.getHealthMetrics();
      
      expect(healthMetrics).toHaveProperty('uptime');
      expect(healthMetrics).toHaveProperty('memory');
      expect(healthMetrics).toHaveProperty('cpu');
      expect(healthMetrics).toHaveProperty('activeHandles');
      expect(healthMetrics).toHaveProperty('activeRequests');
    });
  });

  describe('Registry Operations', () => {
    it('should get metrics', async () => {
      const metrics = await service.getMetrics();
      
      expect(metrics).toBeDefined();
      expect(mockRegistry.metrics).toHaveBeenCalled();
    });

    it('should get registry', () => {
      const registry = service.getRegistry();
      
      expect(registry).toBeDefined();
      expect(registry).toBe(mockRegistry);
    });
  });
});