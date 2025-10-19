# Story 4.1: API Key Authentication - Brownfield Addition

## User Story

As a developer,
I want to configure API key authentication for my API integrations,
So that I can securely access APIs that require key-based authentication.

## Story Context

**Existing System Integration:**
- Integrates with: API client generation (Epic 2), field mapping interface (Epic 3), credential management system
- Technology: Node.js backend with authentication middleware, React frontend for credential configuration, secure storage
- Follows pattern: Authentication frameworks, credential management patterns, security standards
- Touch points: Authentication API, credential storage, client configuration, security validation

## Acceptance Criteria

**Functional Requirements:**
1. API key authentication configuration with support for header, query parameter, and cookie locations
2. Secure credential storage with encryption at rest and in memory protection
3. Multiple API key management per client with naming and description capabilities
4. Key validation and testing with real API endpoint verification
5. Automatic key injection into generated API clients without exposing credentials in code

**Integration Requirements:**
4. Existing authentication patterns remain unchanged (new API key auth extends framework)
5. New functionality follows existing security and credential management patterns
6. Integration with API clients maintains current authentication injection patterns

**Quality Requirements:**
7. Credential encryption uses industry-standard algorithms (AES-256)
8. Key validation completes within 2 seconds for test endpoints
9. Authentication injection adds <10ms overhead to API calls
10. All credential operations are audited and logged securely

## Technical Notes

- **Integration Approach:** API key authentication integrates with existing authentication framework and client generation
- **Existing Pattern Reference:** Follow established credential management and security patterns
- **Key Constraints:** Must maintain security, support multiple key locations, provide automatic injection

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Security audit completed
- [ ] Documentation updated (authentication guide)

## Risk and Compatibility Check

**Minimal Risk Assessment:**
- **Primary Risk:** Credential exposure through logs or memory dumps
- **Mitigation:** Implement encryption, secure memory handling, and comprehensive audit logging
- **Rollback:** Disable API key authentication and fall back to manual credential management if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing authentication framework
- [ ] API key auth follows existing security patterns
- [ ] Credential storage uses existing encryption standards
- [ ] Client injection maintains existing authentication patterns

## Story Points Estimation

**Estimation:** 5 points
- API key authentication engine: 2 points
- Secure credential storage: 2 points
- Client injection integration: 1 point

## Dependencies

- API client generation (Epic 2)
- Authentication framework foundation
- Secure credential storage system

## Testing Requirements

**Unit Tests:**
- API key authentication logic
- Credential encryption/decryption
- Key validation algorithms
- Client injection mechanisms

**Integration Tests:**
- End-to-end authentication flow
- Real API endpoint testing
- Credential storage and retrieval
- Security audit verification

**Security Tests:**
- Encryption strength verification
- Memory protection validation
- Audit logging completeness
- Access control testing

## Implementation Notes

**API Key Authentication Manager:**
```javascript
class ApiKeyAuthManager {
  constructor(options = {}) {
    this.credentialStore = new SecureCredentialStore(options.encryption);
    this.validator = new ApiKeyValidator();
    this.auditor = new SecurityAuditor();
  }

  async createApiKeyConfig(clientId, config) {
    const keyConfig = {
      id: this.generateId(),
      clientId,
      name: config.name,
      description: config.description,
      key: config.key,
      location: config.location || 'header', // header, query, cookie
      keyName: config.keyName || 'X-API-Key',
      prefix: config.prefix || '',
      createdAt: new Date(),
      isActive: true
    };

    // Validate configuration
    await this.validateKeyConfig(keyConfig);

    // Encrypt and store
    const encryptedConfig = await this.credentialStore.encrypt(keyConfig);
    await this.credentialStore.store(keyConfig.id, encryptedConfig);

    // Audit the creation
    await this.auditor.log('api_key_created', {
      configId: keyConfig.id,
      clientId,
      location: keyConfig.location
    });

    return {
      id: keyConfig.id,
      name: keyConfig.name,
      location: keyConfig.location,
      createdAt: keyConfig.createdAt
    };
  }

  async validateApiKey(configId, testEndpoint) {
    const config = await this.getApiKeyConfig(configId);
    if (!config) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    try {
      const result = await this.validator.validateKey(config, testEndpoint);
      
      // Audit validation attempt
      await this.auditor.log('api_key_validation', {
        configId,
        endpoint: testEndpoint,
        success: result.valid,
        responseTime: result.responseTime
      });

      return result;
    } catch (error) {
      // Audit validation failure
      await this.auditor.log('api_key_validation_failed', {
        configId,
        endpoint: testEndpoint,
        error: error.message
      });
      throw error;
    }
  }

  async injectAuthentication(request, configId) {
    const config = await this.getApiKeyConfig(configId);
    if (!config || !config.isActive) {
      throw new Error(`Invalid or inactive API key configuration: ${configId}`);
    }

    switch (config.location) {
      case 'header':
        request.headers = request.headers || {};
        request.headers[config.keyName] = config.prefix + config.key;
        break;
      
      case 'query':
        request.params = request.params || {};
        request.params[config.keyName] = config.prefix + config.key;
        break;
      
      case 'cookie':
        request.cookies = request.cookies || {};
        request.cookies[config.keyName] = config.prefix + config.key;
        break;
      
      default:
        throw new Error(`Unsupported API key location: ${config.location}`);
    }

    // Audit authentication usage
    await this.auditor.log('api_key_used', {
      configId,
      location: config.location
    });

    return request;
  }

  async getApiKeyConfig(configId) {
    const encryptedConfig = await this.credentialStore.retrieve(configId);
    if (!encryptedConfig) {
      return null;
    }

    return await this.credentialStore.decrypt(encryptedConfig);
  }

  async updateApiKeyConfig(configId, updates) {
    const existingConfig = await this.getApiKeyConfig(configId);
    if (!existingConfig) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    const updatedConfig = {
      ...existingConfig,
      ...updates,
      updatedAt: new Date()
    };

    // Validate updated configuration
    await this.validateKeyConfig(updatedConfig);

    // Encrypt and store
    const encryptedConfig = await this.credentialStore.encrypt(updatedConfig);
    await this.credentialStore.store(configId, encryptedConfig);

    // Audit the update
    await this.auditor.log('api_key_updated', {
      configId,
      changes: Object.keys(updates)
    });

    return updatedConfig;
  }

  async deleteApiKeyConfig(configId) {
    const config = await this.getApiKeyConfig(configId);
    if (!config) {
      throw new Error(`API key configuration not found: ${configId}`);
    }

    // Delete from storage
    await this.credentialStore.delete(configId);

    // Audit the deletion
    await this.auditor.log('api_key_deleted', {
      configId,
      clientId: config.clientId
    });
  }

  async validateKeyConfig(config) {
    const errors = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('Configuration name is required');
    }

    if (!config.key || config.key.trim() === '') {
      errors.push('API key is required');
    }

    if (!['header', 'query', 'cookie'].includes(config.location)) {
      errors.push('Invalid location. Must be header, query, or cookie');
    }

    if (!config.keyName || config.keyName.trim() === '') {
      errors.push('Key name is required');
    }

    if (errors.length > 0) {
      throw new Error(`API key configuration validation failed: ${errors.join(', ')}`);
    }
  }

  generateId() {
    return 'ak_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
```

**API Key Validator:**
```javascript
class ApiKeyValidator {
  constructor(options = {}) {
    this.httpClient = new HttpClient(options);
    this.timeout = options.timeout || 10000;
  }

  async validateKey(config, testEndpoint) {
    const startTime = Date.now();

    try {
      // Create test request with API key
      const testRequest = {
        method: 'GET',
        url: testEndpoint,
        timeout: this.timeout
      };

      // Inject authentication
      const authManager = new ApiKeyAuthManager();
      await authManager.injectAuthentication(testRequest, config.id);

      // Make test request
      const response = await this.httpClient.request(testRequest);
      const responseTime = Date.now() - startTime;

      // Analyze response
      const analysis = this.analyzeResponse(response);

      return {
        valid: analysis.success,
        responseTime,
        statusCode: response.status,
        analysis: analysis.details,
        recommendations: analysis.recommendations
      };

    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      return {
        valid: false,
        responseTime,
        error: error.message,
        statusCode: error.response?.status,
        recommendations: this.generateErrorRecommendations(error)
      };
    }
  }

  analyzeResponse(response) {
    const success = response.status >= 200 && response.status < 300;
    
    const details = {
      statusCode: response.status,
      contentType: response.headers['content-type'],
      responseSize: JSON.stringify(response.data).length
    };

    const recommendations = [];

    if (response.status === 401) {
      recommendations.push('API key appears to be invalid or expired');
    } else if (response.status === 403) {
      recommendations.push('API key is valid but lacks permission for this endpoint');
    } else if (response.status === 429) {
      recommendations.push('Rate limit exceeded. Try again later or check rate limits');
    } else if (success) {
      recommendations.push('API key is working correctly');
    }

    return {
      success,
      details,
      recommendations
    };
  }

  generateErrorRecommendations(error) {
    const recommendations = [];

    if (error.code === 'ECONNREFUSED') {
      recommendations.push('Unable to connect to the API endpoint. Check the URL and network connectivity');
    } else if (error.code === 'ENOTFOUND') {
      recommendations.push('API endpoint hostname could not be resolved. Check the URL');
    } else if (error.code === 'ETIMEDOUT') {
      recommendations.push('Request timed out. Check network connectivity and API endpoint availability');
    } else if (error.response?.status === 401) {
      recommendations.push('API key is invalid or expired. Check the key and try again');
    } else if (error.response?.status === 403) {
      recommendations.push('API key lacks permission for this endpoint. Check key permissions');
    }

    return recommendations;
  }
}
```

**Secure Credential Store:**
```javascript
class SecureCredentialStore {
  constructor(encryptionOptions = {}) {
    this.algorithm = encryptionOptions.algorithm || 'aes-256-gcm';
    this.keyLength = encryptionOptions.keyLength || 32;
    this.ivLength = encryptionOptions.ivLength || 16;
    this.tagLength = encryptionOptions.tagLength || 16;
    this.storage = new Map(); // In production, use secure database
  }

  async encrypt(data) {
    const key = await this.getEncryptionKey();
    const iv = crypto.randomBytes(this.ivLength);
    
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from('api-key-credential'));
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      tag: tag.toString('hex'),
      algorithm: this.algorithm
    };
  }

  async decrypt(encryptedData) {
    const key = await this.getEncryptionKey();
    const iv = Buffer.from(encryptedData.iv, 'hex');
    const tag = Buffer.from(encryptedData.tag, 'hex');
    
    const decipher = crypto.createDecipher(encryptedData.algorithm, key);
    decipher.setAAD(Buffer.from('api-key-credential'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  async store(id, encryptedData) {
    // In production, store in secure database with proper access controls
    this.storage.set(id, {
      ...encryptedData,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  async retrieve(id) {
    // In production, retrieve from secure database with audit logging
    return this.storage.get(id) || null;
  }

  async delete(id) {
    // In production, delete from secure database with audit logging
    this.storage.delete(id);
  }

  async getEncryptionKey() {
    // In production, retrieve from secure key management system
    // For now, use a derived key from environment variable
    const secret = process.env.ENCRYPTION_SECRET || 'default-secret-change-in-production';
    return crypto.pbkdf2Sync(secret, 'salt', 10000, this.keyLength, 'sha256');
  }
}
```

**API Key Configuration Interface:**
```javascript
const ApiKeyConfiguration = ({ clientId, onConfigCreated }) => {
  const [config, setConfig] = useState({
    name: '',
    description: '',
    key: '',
    location: 'header',
    keyName: 'X-API-Key',
    prefix: ''
  });
  const [validating, setValidating] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState('');
  const [validationResult, setValidationResult] = useState(null);

  const handleSave = async () => {
    try {
      const authManager = new ApiKeyAuthManager();
      const newConfig = await authManager.createApiKeyConfig(clientId, config);
      onConfigCreated(newConfig);
      showSuccess('API key configuration saved successfully');
    } catch (error) {
      showError('Failed to save API key configuration: ' + error.message);
    }
  };

  const handleTest = async () => {
    if (!testEndpoint) {
      showError('Please enter a test endpoint URL');
      return;
    }

    setValidating(true);
    try {
      // Create temporary config for testing
      const tempConfig = { ...config, id: 'temp' };
      const authManager = new ApiKeyAuthManager();
      const result = await authManager.validateApiKey(tempConfig, testEndpoint);
      setValidationResult(result);
    } catch (error) {
      setValidationResult({
        valid: false,
        error: error.message
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="api-key-configuration">
      <div className="config-header">
        <h3>API Key Authentication</h3>
        <p>Configure API key authentication for your API integration</p>
      </div>

      <div className="config-form">
        <div className="form-group">
          <label>Configuration Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="e.g., Production API Key"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={config.description}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            placeholder="Optional description of this API key configuration"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>API Key</label>
          <input
            type="password"
            value={config.key}
            onChange={(e) => setConfig({ ...config, key: e.target.value })}
            placeholder="Enter your API key"
            required
          />
        </div>

        <div className="form-group">
          <label>Key Location</label>
          <select
            value={config.location}
            onChange={(e) => setConfig({ ...config, location: e.target.value })}
          >
            <option value="header">Header</option>
            <option value="query">Query Parameter</option>
            <option value="cookie">Cookie</option>
          </select>
        </div>

        <div className="form-group">
          <label>Key Name</label>
          <input
            type="text"
            value={config.keyName}
            onChange={(e) => setConfig({ ...config, keyName: e.target.value })}
            placeholder="e.g., X-API-Key"
            required
          />
        </div>

        <div className="form-group">
          <label>Prefix (Optional)</label>
          <input
            type="text"
            value={config.prefix}
            onChange={(e) => setConfig({ ...config, prefix: e.target.value })}
            placeholder="e.g., Bearer "
          />
        </div>
      </div>

      <div className="test-section">
        <h4>Test Configuration</h4>
        <div className="test-form">
          <input
            type="url"
            value={testEndpoint}
            onChange={(e) => setTestEndpoint(e.target.value)}
            placeholder="https://api.example.com/test"
          />
          <button 
            onClick={handleTest} 
            disabled={validating || !config.key || !testEndpoint}
          >
            {validating ? 'Testing...' : 'Test API Key'}
          </button>
        </div>

        {validationResult && (
          <ValidationResult result={validationResult} />
        )}
      </div>

      <div className="config-actions">
        <button 
          onClick={handleSave}
          disabled={!config.name || !config.key}
          className="primary"
        >
          Save Configuration
        </button>
        <button onClick={() => setConfig({
          name: '',
          description: '',
          key: '',
          location: 'header',
          keyName: 'X-API-Key',
          prefix: ''
        })}>
          Reset
        </button>
      </div>
    </div>
  );
};
```

**Validation Result Component:**
```javascript
const ValidationResult = ({ result }) => {
  return (
    <div className={`validation-result ${result.valid ? 'success' : 'error'}`}>
      <div className="result-header">
        <span className="status">
          {result.valid ? '✓ Valid' : '✗ Invalid'}
        </span>
        <span className="response-time">
          {result.responseTime}ms
        </span>
        {result.statusCode && (
          <span className={`status-code ${result.valid ? 'success' : 'error'}`}>
            {result.statusCode}
          </span>
        )}
      </div>

      {result.error && (
        <div className="error-message">
          <strong>Error:</strong> {result.error}
        </div>
      )}

      {result.analysis && (
        <div className="analysis">
          <strong>Analysis:</strong>
          <ul>
            {Object.entries(result.analysis).map(([key, value]) => (
              <li key={key}>
                {key}: {JSON.stringify(value)}
              </li>
            ))}
          </ul>
        </div>
      )}

      {result.recommendations && result.recommendations.length > 0 && (
        <div className="recommendations">
          <strong>Recommendations:</strong>
          <ul>
            {result.recommendations.map((rec, index) => (
              <li key={index}>{rec}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
```

**Error Handling:**
- Invalid API keys: Clear error messages with correction suggestions
- Network failures: Retry mechanisms and fallback options
- Encryption errors: Secure fallback and error reporting
- Configuration validation: Field-specific error messages

## Success Criteria

- API key authentication works for header, query, and cookie locations
- Credentials are encrypted using AES-256 encryption
- Key validation completes within 2 seconds
- Authentication injection adds <10ms overhead
- All credential operations are audited and logged

## Monitoring and Observability

**Metrics to Track:**
- API key usage statistics
- Authentication success rates
- Validation response times
- Security audit events

**Alerts:**
- Authentication failure rate >10%
- Validation response time >5 seconds
- Unauthorized access attempts
- Credential storage errors

## Integration Points

**Upstream:**
- API client generation (authentication injection)
- Field mapping interface (credential configuration)

**Downstream:**
- Secure credential storage (persistence)
- Security auditor (audit logging)
- HTTP client infrastructure (request modification)

## Security Features

**Credential Protection:**
- AES-256 encryption at rest
- Secure memory handling
- No credential logging
- Access control and auditing

**Authentication Features:**
- Multiple key locations
- Custom key names and prefixes
- Key validation and testing
- Automatic client injection

**Audit and Compliance:**
- Comprehensive audit logging
- Access tracking
- Security event monitoring
- Compliance reporting