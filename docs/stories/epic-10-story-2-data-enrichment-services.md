# Story 10.2: Data Enrichment Services - Brownfield Addition

## User Story

As a data analyst,
I want to enrich transformed data with external data sources and reference data,
So that I can enhance data quality and add valuable context during the transformation process.

## Story Context

**Existing System Integration:**

- Integrates with: Transformation engine (Story 3.2), external API clients, caching system
- Technology: Node.js backend with HTTP clients, caching layer, rate limiting, error handling
- Follows pattern: Service integration patterns, caching strategies, error recovery
- Touch points: Transformation pipeline, external APIs, cache service, monitoring

## Acceptance Criteria

**Functional Requirements:**

1. Data enrichment service that connects to external APIs and reference data sources
2. Configurable enrichment rules with field mapping and transformation logic
3. Caching system for enriched data to improve performance and reduce API calls
4. Rate limiting and quota management for external API usage
5. Fallback strategies when external services are unavailable
6. Enrichment preview and testing interface

**Integration Requirements:** 4. Existing transformation pipeline continues to work unchanged (enrichment adds value) 5. New functionality follows existing service integration and error handling patterns 6. Integration with transformation engine maintains current processing flow

**Quality Requirements:** 7. Enrichment processing adds <50ms overhead per row 8. Cache hit rate >80% for frequently accessed enrichment data 9. API rate limiting compliance with 99% success rate 10. Graceful degradation when external services are unavailable

## Technical Notes

- **Integration Approach:** Enrichment services integrate as transformation steps in existing pipeline
- **Existing Pattern Reference:** Follow established service integration and caching patterns
- **Key Constraints:** Must maintain performance, handle external service failures, respect API limits

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Performance benchmarks met
- [ ] Documentation updated (enrichment services guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** External service dependencies causing transformation failures
- **Mitigation:** Implement caching, fallback strategies, and robust error handling
- **Rollback:** Disable enrichment services and continue with basic transformations

**Compatibility Verification:**

- [ ] No breaking changes to existing transformation pipeline
- [ ] Enrichment services follow existing service integration patterns
- [ ] Caching integrates with existing performance optimization
- [ ] Error handling maintains existing logging and monitoring

## Story Points Estimation

**Estimation:** 6 points

- Enrichment service framework: 2 points
- External API integration: 2 points
- Caching and performance optimization: 1 point
- Rate limiting and error handling: 1 point

## Dependencies

- Transformation engine (Story 3.2)
- External API clients (Epic 2)
- Caching system
- Monitoring service

## Testing Requirements

**Unit Tests:**

- Enrichment service logic
- API client integration
- Cache operations
- Rate limiting enforcement

**Integration Tests:**

- End-to-end enrichment workflow
- External service failure scenarios
- Cache performance under load
- Rate limiting compliance

**Performance Tests:**

- Enrichment processing speed
- Cache hit rates
- Memory usage during enrichment
- Concurrent enrichment capacity

## Implementation Notes

**Data Enrichment Manager:**

```javascript
class DataEnrichmentManager {
  constructor(options = {}) {
    this.enrichers = new Map();
    this.cache = new EnrichmentCache(options.cache);
    this.rateLimiter = new RateLimiter(options.rateLimit);
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.metrics = new EnrichmentMetrics();
  }

  async registerEnricher(config) {
    const enricher = new DataEnricher(config, {
      cache: this.cache,
      rateLimiter: this.rateLimiter,
      circuitBreaker: this.circuitBreaker,
      metrics: this.metrics,
    });

    this.enrichers.set(config.id, enricher);
    return enricher;
  }

  async enrichData(data, enrichmentRules) {
    const enrichedData = { ...data };
    const enrichmentResults = [];

    for (const rule of enrichmentRules) {
      const enricher = this.enrichers.get(rule.enricherId);
      if (!enricher) {
        throw new Error(`Enricher ${rule.enricherId} not found`);
      }

      try {
        const startTime = Date.now();
        const result = await enricher.enrich(
          this.extractValue(data, rule.sourceField),
          rule.config,
        );

        const processingTime = Date.now() - startTime;
        this.metrics.recordEnrichment(rule.enricherId, processingTime, true);

        // Apply enrichment result
        this.applyEnrichment(enrichedData, rule.targetField, result);
        enrichmentResults.push({
          rule: rule.id,
          success: true,
          result,
          processingTime,
        });
      } catch (error) {
        this.metrics.recordEnrichment(rule.enricherId, 0, false);

        // Apply fallback strategy
        const fallbackResult = await this.applyFallback(data, rule, error);
        if (fallbackResult) {
          this.applyEnrichment(enrichedData, rule.targetField, fallbackResult);
        }

        enrichmentResults.push({
          rule: rule.id,
          success: false,
          error: error.message,
          fallback: fallbackResult,
        });
      }
    }

    return {
      data: enrichedData,
      enrichments: enrichmentResults,
    };
  }

  extractValue(data, fieldPath) {
    return fieldPath.split(".").reduce((obj, key) => obj?.[key], data);
  }

  applyEnrichment(data, targetField, result) {
    if (targetField.includes(".")) {
      // Handle nested field paths
      const keys = targetField.split(".");
      const lastKey = keys.pop();
      const target = keys.reduce((obj, key) => {
        if (!obj[key]) obj[key] = {};
        return obj[key];
      }, data);
      target[lastKey] = result.value;
    } else {
      data[targetField] = result.value;
    }
  }

  async applyFallback(data, rule, error) {
    switch (rule.fallbackStrategy) {
      case "skip":
        return null;
      case "default":
        return rule.defaultValue;
      case "reference":
        return await this.getReferenceValue(rule.referenceTable, data);
      case "cached":
        return await this.cache.get(this.getCacheKey(data, rule));
      default:
        return null;
    }
  }

  getCacheKey(data, rule) {
    const sourceValue = this.extractValue(data, rule.sourceField);
    return `enrichment:${rule.enricherId}:${sourceValue}`;
  }

  async getReferenceValue(referenceTable, data) {
    // Implementation for reference data lookup
    return null;
  }

  getMetrics() {
    return this.metrics.getMetrics();
  }
}
```

**Data Enricher:**

```javascript
class DataEnricher {
  constructor(config, dependencies) {
    this.id = config.id;
    this.name = config.name;
    this.type = config.type;
    this.config = config;
    this.cache = dependencies.cache;
    this.rateLimiter = dependencies.rateLimiter;
    this.circuitBreaker = dependencies.circuitBreaker;
    this.metrics = dependencies.metrics;

    // Initialize API client based on type
    this.apiClient = this.createApiClient(config);
  }

  async enrich(value, enrichmentConfig) {
    const cacheKey = this.getCacheKey(value, enrichmentConfig);

    // Check cache first
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Apply rate limiting
    await this.rateLimiter.acquire();

    // Execute enrichment through circuit breaker
    const result = await this.circuitBreaker.execute(async () => {
      return this.performEnrichment(value, enrichmentConfig);
    });

    // Cache the result
    await this.cache.set(cacheKey, result, this.config.cacheTTL || 3600);

    return result;
  }

  async performEnrichment(value, config) {
    switch (this.type) {
      case "rest_api":
        return await this.enrichFromRestAPI(value, config);
      case "graphql":
        return await this.enrichFromGraphQL(value, config);
      case "database":
        return await this.enrichFromDatabase(value, config);
      case "reference":
        return await this.enrichFromReference(value, config);
      case "webhook":
        return await this.enrichFromWebhook(value, config);
      default:
        throw new Error(`Unsupported enricher type: ${this.type}`);
    }
  }

  async enrichFromRestAPI(value, config) {
    const url = this.buildUrl(config.endpoint, value, config);
    const headers = this.buildHeaders(config.headers, config);
    const params = this.buildParams(config.params, value, config);

    try {
      const response = await this.apiClient.get(url, {
        headers,
        params,
        timeout: config.timeout || 5000,
      });

      return this.extractEnrichmentData(response.data, config.mapping);
    } catch (error) {
      throw new EnrichmentError(`REST API enrichment failed: ${error.message}`);
    }
  }

  async enrichFromGraphQL(value, config) {
    const query = this.buildGraphQLQuery(config.query, value, config);
    const variables = this.buildGraphQLVariables(
      config.variables,
      value,
      config,
    );

    try {
      const response = await this.apiClient.post(
        config.endpoint,
        {
          query,
          variables,
        },
        {
          headers: config.headers,
          timeout: config.timeout || 5000,
        },
      );

      return this.extractEnrichmentData(response.data, config.mapping);
    } catch (error) {
      throw new EnrichmentError(`GraphQL enrichment failed: ${error.message}`);
    }
  }

  async enrichFromDatabase(value, config) {
    // Database enrichment implementation
    const query = this.buildDatabaseQuery(config.query, value, config);

    try {
      const result = await this.database.query(query);
      return this.extractEnrichmentData(result, config.mapping);
    } catch (error) {
      throw new EnrichmentError(`Database enrichment failed: ${error.message}`);
    }
  }

  async enrichFromReference(value, config) {
    const referenceData = await this.loadReferenceData(config.referenceTable);
    const key = this.extractReferenceKey(value, config.keyField);

    return referenceData[key] || config.defaultValue;
  }

  async enrichFromWebhook(value, config) {
    const payload = this.buildWebhookPayload(value, config);

    try {
      const response = await this.apiClient.post(config.webhookUrl, payload, {
        headers: config.headers,
        timeout: config.timeout || 10000,
      });

      return this.extractEnrichmentData(response.data, config.mapping);
    } catch (error) {
      throw new EnrichmentError(`Webhook enrichment failed: ${error.message}`);
    }
  }

  createApiClient(config) {
    const axios = require("axios");

    return axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 5000,
      headers: {
        "User-Agent": "Atlas2-DataEnricher/1.0",
        ...config.defaultHeaders,
      },
    });
  }

  buildUrl(endpoint, value, config) {
    return endpoint.replace("{value}", encodeURIComponent(value));
  }

  buildHeaders(templateHeaders, config) {
    const headers = { ...templateHeaders };

    // Replace placeholders in headers
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        headers[key] = value.replace("{value}", config.apiKey || "");
      }
    }

    return headers;
  }

  buildParams(templateParams, value, config) {
    const params = { ...templateParams };

    // Replace placeholders in params
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === "string") {
        params[key] = value.replace("{value}", encodeURIComponent(value));
      }
    }

    return params;
  }

  buildGraphQLQuery(template, value, config) {
    return template.replace("{value}", JSON.stringify(value));
  }

  buildGraphQLVariables(template, value, config) {
    const variables = { ...template };

    for (const [key, value] of Object.entries(variables)) {
      if (typeof value === "string" && value.includes("{value}")) {
        variables[key] = value.replace("{value}", value);
      }
    }

    return variables;
  }

  buildDatabaseQuery(template, value, config) {
    return template.replace("{value}", value);
  }

  buildWebhookPayload(value, config) {
    const payload = { ...config.payloadTemplate };

    // Replace value placeholders
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === "string" && value.includes("{value}")) {
        payload[key] = value.replace("{value}", value);
      }
    }

    return payload;
  }

  extractEnrichmentData(data, mapping) {
    if (!mapping) {
      return { value: data };
    }

    if (typeof mapping === "string") {
      return { value: this.extractNestedValue(data, mapping) };
    }

    if (typeof mapping === "object") {
      const result = {};
      for (const [targetKey, sourcePath] of Object.entries(mapping)) {
        result[targetKey] = this.extractNestedValue(data, sourcePath);
      }
      return { value: result };
    }

    return { value: data };
  }

  extractNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => current?.[key], obj);
  }

  getCacheKey(value, config) {
    return `${this.id}:${JSON.stringify(value)}:${JSON.stringify(config)}`;
  }

  async loadReferenceData(referenceTable) {
    // Load reference data from cache or storage
    return (await this.cache.get(`reference:${referenceTable}`)) || {};
  }

  extractReferenceKey(value, keyField) {
    if (typeof value === "object" && keyField in value) {
      return value[keyField];
    }
    return value;
  }
}
```

**Enrichment Cache:**

```javascript
class EnrichmentCache {
  constructor(options = {}) {
    this.redis = require("redis").createClient(options.redis);
    this.defaultTTL = options.defaultTTL || 3600;
    this.keyPrefix = options.keyPrefix || "enrichment:";
  }

  async get(key) {
    try {
      const fullKey = this.keyPrefix + key;
      const value = await this.redis.get(fullKey);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error("Cache get error:", error);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.setex(fullKey, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Cache set error:", error);
      return false;
    }
  }

  async del(key) {
    try {
      const fullKey = this.keyPrefix + key;
      await this.redis.del(fullKey);
      return true;
    } catch (error) {
      console.error("Cache delete error:", error);
      return false;
    }
  }

  async clear(pattern = "*") {
    try {
      const fullPattern = this.keyPrefix + pattern;
      const keys = await this.redis.keys(fullPattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
      return keys.length;
    } catch (error) {
      console.error("Cache clear error:", error);
      return 0;
    }
  }

  async getStats() {
    try {
      const info = await this.redis.info("memory");
      const keyspace = await this.redis.info("keyspace");

      return {
        memory: this.parseMemoryInfo(info),
        keys: this.parseKeyspaceInfo(keyspace),
      };
    } catch (error) {
      console.error("Cache stats error:", error);
      return null;
    }
  }

  parseMemoryInfo(info) {
    const lines = info.split("\r\n");
    const memory = {};

    for (const line of lines) {
      if (line.startsWith("used_memory:")) {
        memory.used = parseInt(line.split(":")[1]);
      } else if (line.startsWith("used_memory_human:")) {
        memory.usedHuman = line.split(":")[1];
      }
    }

    return memory;
  }

  parseKeyspaceInfo(info) {
    const lines = info.split("\r\n");
    const keys = {};

    for (const line of lines) {
      if (line.startsWith("db")) {
        const [db, stats] = line.split(":");
        const matches = stats.match(/keys=(\d+)/);
        if (matches) {
          keys[db] = parseInt(matches[1]);
        }
      }
    }

    return keys;
  }
}
```

**Rate Limiter:**

```javascript
class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute
    this.maxRequests = options.maxRequests || 100;
    this.buckets = new Map();

    // Cleanup old buckets periodically
    setInterval(() => this.cleanup(), this.windowMs);
  }

  async acquire(key = "default") {
    const now = Date.now();
    const bucket = this.getBucket(key, now);

    if (bucket.count >= this.maxRequests) {
      const resetTime = bucket.windowStart + this.windowMs;
      const waitTime = resetTime - now;

      throw new RateLimitError(
        `Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`,
      );
    }

    bucket.count++;
    return true;
  }

  getBucket(key, now) {
    if (!this.buckets.has(key)) {
      this.buckets.set(key, {
        count: 0,
        windowStart: now,
      });
    }

    const bucket = this.buckets.get(key);

    // Reset window if expired
    if (now - bucket.windowStart >= this.windowMs) {
      bucket.count = 0;
      bucket.windowStart = now;
    }

    return bucket;
  }

  cleanup() {
    const now = Date.now();
    const expiredKeys = [];

    for (const [key, bucket] of this.buckets.entries()) {
      if (now - bucket.windowStart >= this.windowMs * 2) {
        expiredKeys.push(key);
      }
    }

    for (const key of expiredKeys) {
      this.buckets.delete(key);
    }
  }

  getStats() {
    const stats = {};
    const now = Date.now();

    for (const [key, bucket] of this.buckets.entries()) {
      const remainingTime = Math.max(
        0,
        this.windowMs - (now - bucket.windowStart),
      );
      stats[key] = {
        count: bucket.count,
        maxRequests: this.maxRequests,
        remainingRequests: Math.max(0, this.maxRequests - bucket.count),
        resetTime: bucket.windowStart + this.windowMs,
        remainingTime,
      };
    }

    return stats;
  }
}
```

**Circuit Breaker:**

```javascript
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000;
    this.monitoringPeriod = options.monitoringPeriod || 10000;

    this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.successCount = 0;
  }

  async execute(operation) {
    if (this.state === "OPEN") {
      if (Date.now() - this.lastFailureTime >= this.recoveryTimeout) {
        this.state = "HALF_OPEN";
        this.successCount = 0;
      } else {
        throw new CircuitBreakerError("Circuit breaker is OPEN");
      }
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === "HALF_OPEN") {
      this.successCount++;
      if (this.successCount >= 3) {
        this.state = "CLOSED";
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
    };
  }

  reset() {
    this.state = "CLOSED";
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
  }
}
```

## Success Criteria

- Data enrichment services successfully integrate with external APIs
- Caching system improves performance with >80% hit rate
- Rate limiting prevents API quota violations
- Graceful degradation when external services fail
- Enrichment processing adds minimal overhead to transformation pipeline

## Monitoring and Observability

**Metrics to Track:**

- Enrichment success rates by service
- API response times and error rates
- Cache hit rates and memory usage
- Rate limiting statistics

**Alerts:**

- Enrichment success rate <90%
- API response time >5 seconds
- Cache hit rate <70%
- Rate limit violations

## Integration Points

**Upstream:**

- Transformation engine (enrichment triggers)
- Configuration service (enrichment rules)

**Downstream:**

- External APIs (data sources)
- Cache service (performance optimization)
- Monitoring service (metrics and alerts)
