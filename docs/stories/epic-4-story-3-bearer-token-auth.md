# Story 4.3: Bearer Token Authentication - Brownfield Addition

## User Story

As a developer,
I want to configure Bearer token authentication for my API integrations,
So that I can securely access APIs that require token-based authentication like JWT or OAuth2.

## Story Context

**Existing System Integration:**
- Integrates with: API client generation (Epic 2), API key authentication (Story 4.1), Basic authentication (Story 4.2)
- Technology: Node.js backend with authentication middleware, React frontend for token configuration, JWT validation
- Follows pattern: Authentication frameworks, credential management patterns, security standards
- Touch points: Authentication API, token storage, client configuration, security validation

## Acceptance Criteria

**Functional Requirements:**
1. Bearer token authentication configuration with support for JWT and opaque tokens
2. Secure token storage with encryption and optional expiration handling
3. Multiple token configurations per client with naming and description capabilities
4. Token validation and testing with real API endpoint verification
5. Automatic Authorization header injection with "Bearer " prefix

**Integration Requirements:**
4. Existing authentication patterns remain unchanged (new Bearer token auth extends framework)
5. New functionality follows existing security and credential management patterns
6. Integration with API clients maintains current authentication injection patterns

**Quality Requirements:**
7. Token encryption uses industry-standard algorithms (AES-256)
8. Token validation completes within 3 seconds for test endpoints (including JWT parsing)
9. Authentication injection adds <5ms overhead to API calls
10. All token operations are audited and logged securely

## Technical Notes

- **Integration Approach:** Bearer token authentication integrates with existing authentication framework and client generation
- **Existing Pattern Reference:** Follow established credential management and security patterns
- **Key Constraints:** Must maintain security, support JWT validation, handle token expiration

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
- **Primary Risk:** Token exposure through logs or invalid JWT validation
- **Mitigation:** Implement encryption, secure token handling, and comprehensive JWT validation
- **Rollback:** Disable Bearer token authentication and fall back to manual token management if issues occur

**Compatibility Verification:**
- [ ] No breaking changes to existing authentication framework
- [ ] Bearer token auth follows existing security patterns
- [ ] Token storage uses existing encryption standards
- [ ] Client injection maintains existing authentication patterns

## Story Points Estimation

**Estimation:** 5 points
- Bearer token authentication engine: 2 points
- JWT validation and parsing: 2 points
- Client injection integration: 1 point

## Dependencies

- API client generation (Epic 2)
- API key authentication (Story 4.1)
- Basic authentication (Story 4.2)

## Testing Requirements

**Unit Tests:**
- Bearer token authentication logic
- JWT parsing and validation
- Token encryption/decryption
- Client injection mechanisms

**Integration Tests:**
- End-to-end authentication flow
- Real API endpoint testing
- Token storage and retrieval
- Security audit verification

**Security Tests:**
- JWT validation security
- Token expiration handling
- Encryption strength verification
- Audit logging completeness

## Implementation Notes

**Bearer Token Authentication Manager:**
```javascript
class BearerTokenAuthManager {
  constructor(options = {}) {
    this.credentialStore = new SecureCredentialStore(options.encryption);
    this.validator = new BearerTokenValidator();
    this.jwtParser = new JWTParser();
    this.auditor = new SecurityAuditor();
  }

  async createBearerTokenConfig(clientId, config) {
    const tokenConfig = {
      id: this.generateId(),
      clientId,
      name: config.name,
      description: config.description,
      token: config.token,
      tokenType: config.tokenType || 'opaque', // jwt, opaque
      expiresAt: config.expiresAt || null,
      autoRefresh: config.autoRefresh || false,
      refreshEndpoint: config.refreshEndpoint || null,
      createdAt: new Date(),
      isActive: true
    };

    // Validate configuration
    await this.validateTokenConfig(tokenConfig);

    // Parse JWT if applicable
    if (tokenConfig.tokenType === 'jwt') {
      try {
        const parsedToken = await this.jwtParser.parse(tokenConfig.token);
        tokenConfig.jwtInfo = parsedToken;
        
        // Set expiration from JWT if not provided
        if (!tokenConfig.expiresAt && parsedToken.exp) {
          tokenConfig.expiresAt = new Date(parsedToken.exp * 1000);
        }
      } catch (error) {
        throw new Error(`Invalid JWT token: ${error.message}`);
      }
    }

    // Encrypt and store
    const encryptedConfig = await this.credentialStore.encrypt(tokenConfig);
    await this.credentialStore.store(tokenConfig.id, encryptedConfig);

    // Audit the creation
    await this.auditor.log('bearer_token_created', {
      configId: tokenConfig.id,
      clientId,
      tokenType: tokenConfig.tokenType,
      expiresAt: tokenConfig.expiresAt
    });

    return {
      id: tokenConfig.id,
      name: tokenConfig.name,
      tokenType: tokenConfig.tokenType,
      expiresAt: tokenConfig.expiresAt,
      createdAt: tokenConfig.createdAt
    };
  }

  async validateBearerToken(configId, testEndpoint) {
    const config = await this.getBearerTokenConfig(configId);
    if (!config) {
      throw new Error(`Bearer token configuration not found: ${configId}`);
    }

    // Check token expiration
    if (config.expiresAt && new Date() > config.expiresAt) {
      return {
        valid: false,
        error: 'Token has expired',
        expired: true,
        recommendations: ['Refresh the token or obtain a new one']
      };
    }

    try {
      const result = await this.validator.validateToken(config, testEndpoint);
      
      // Audit validation attempt
      await this.auditor.log('bearer_token_validation', {
        configId,
        endpoint: testEndpoint,
        success: result.valid,
        responseTime: result.responseTime
      });

      return result;
    } catch (error) {
      // Audit validation failure
      await this.auditor.log('bearer_token_validation_failed', {
        configId,
        endpoint: testEndpoint,
        error: error.message
      });
      throw error;
    }
  }

  async injectAuthentication(request, configId) {
    const config = await this.getBearerTokenConfig(configId);
    if (!config || !config.isActive) {
      throw new Error(`Invalid or inactive Bearer token configuration: ${configId}`);
    }

    // Check token expiration
    if (config.expiresAt && new Date() > config.expiresAt) {
      throw new Error(`Bearer token has expired: ${configId}`);
    }

    // Inject Bearer token
    request.headers = request.headers || {};
    request.headers['Authorization'] = `Bearer ${config.token}`;

    // Audit authentication usage
    await this.auditor.log('bearer_token_used', {
      configId,
      tokenType: config.tokenType
    });

    return request;
  }

  async refreshBearerToken(configId) {
    const config = await this.getBearerTokenConfig(configId);
    if (!config) {
      throw new Error(`Bearer token configuration not found: ${configId}`);
    }

    if (!config.autoRefresh || !config.refreshEndpoint) {
      throw new Error(`Token refresh not configured for: ${configId}`);
    }

    try {
      const newToken = await this.validator.refreshToken(config);
      
      // Update configuration with new token
      const updatedConfig = await this.updateBearerTokenConfig(configId, {
        token: newToken.token,
        expiresAt: newToken.expiresAt
      });

      // Audit token refresh
      await this.auditor.log('bearer_token_refreshed', {
        configId,
        oldExpiresAt: config.expiresAt,
        newExpiresAt: newToken.expiresAt
      });

      return updatedConfig;
    } catch (error) {
      // Audit refresh failure
      await this.auditor.log('bearer_token_refresh_failed', {
        configId,
        error: error.message
      });
      throw error;
    }
  }

  async getBearerTokenConfig(configId) {
    const encryptedConfig = await this.credentialStore.retrieve(configId);
    if (!encryptedConfig) {
      return null;
    }

    return await this.credentialStore.decrypt(encryptedConfig);
  }

  async updateBearerTokenConfig(configId, updates) {
    const existingConfig = await this.getBearerTokenConfig(configId);
    if (!existingConfig) {
      throw new Error(`Bearer token configuration not found: ${configId}`);
    }

    const updatedConfig = {
      ...existingConfig,
      ...updates,
      updatedAt: new Date()
    };

    // Parse JWT if token was updated
    if (updates.token && updatedConfig.tokenType === 'jwt') {
      try {
        const parsedToken = await this.jwtParser.parse(updatedConfig.token);
        updatedConfig.jwtInfo = parsedToken;
        
        // Update expiration from JWT if not provided
        if (!updates.expiresAt && parsedToken.exp) {
          updatedConfig.expiresAt = new Date(parsedToken.exp * 1000);
        }
      } catch (error) {
        throw new Error(`Invalid JWT token: ${error.message}`);
      }
    }

    // Validate updated configuration
    await this.validateTokenConfig(updatedConfig);

    // Encrypt and store
    const encryptedConfig = await this.credentialStore.encrypt(updatedConfig);
    await this.credentialStore.store(configId, encryptedConfig);

    // Audit the update
    await this.auditor.log('bearer_token_updated', {
      configId,
      changes: Object.keys(updates).filter(key => key !== 'token')
    });

    return updatedConfig;
  }

  async deleteBearerTokenConfig(configId) {
    const config = await this.getBearerTokenConfig(configId);
    if (!config) {
      throw new Error(`Bearer token configuration not found: ${configId}`);
    }

    // Delete from storage
    await this.credentialStore.delete(configId);

    // Audit the deletion
    await this.auditor.log('bearer_token_deleted', {
      configId,
      clientId: config.clientId
    });
  }

  async validateTokenConfig(config) {
    const errors = [];

    if (!config.name || config.name.trim() === '') {
      errors.push('Configuration name is required');
    }

    if (!config.token || config.token.trim() === '') {
      errors.push('Token is required');
    }

    if (!['jwt', 'opaque'].includes(config.tokenType)) {
      errors.push('Invalid token type. Must be jwt or opaque');
    }

    // Validate token format
    if (config.tokenType === 'jwt') {
      const parts = config.token.split('.');
      if (parts.length !== 3) {
        errors.push('Invalid JWT format. Must have 3 parts separated by dots');
      }
    }

    if (errors.length > 0) {
      throw new Error(`Bearer token configuration validation failed: ${errors.join(', ')}`);
    }
  }

  generateId() {
    return 'bt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}
```

**JWT Parser:**
```javascript
class JWTParser {
  constructor(options = {}) {
    this.skipSignatureValidation = options.skipSignatureValidation || true; // For parsing only
  }

  async parse(token) {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('JWT must have 3 parts');
      }

      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
      const signature = parts[2];

      // Validate basic JWT structure
      this.validateJWTStructure(header, payload);

      return {
        header,
        payload,
        signature,
        expiresAt: payload.exp ? new Date(payload.exp * 1000) : null,
        issuedAt: payload.iat ? new Date(payload.iat * 1000) : null,
        notBefore: payload.nbf ? new Date(payload.nbf * 1000) : null,
        issuer: payload.iss,
        audience: payload.aud,
        subject: payload.sub,
        scopes: payload.scope ? payload.scope.split(' ') : (payload.scp || [])
      };
    } catch (error) {
      throw new Error(`JWT parsing failed: ${error.message}`);
    }
  }

  validateJWTStructure(header, payload) {
    // Validate header
    if (!header.typ || !header.alg) {
      throw new Error('Invalid JWT header: missing typ or alg');
    }

    if (header.typ !== 'JWT' && header.typ !== 'jwt') {
      throw new Error(`Invalid JWT type: ${header.typ}`);
    }

    // Validate payload timestamps
    const now = Math.floor(Date.now() / 1000);

    if (payload.exp && payload.exp < now) {
      throw new Error('JWT has expired');
    }

    if (payload.nbf && payload.nbf > now) {
      throw new Error('JWT is not yet valid');
    }

    if (payload.iat && payload.iat > now) {
      throw new Error('JWT issued in the future');
    }
  }

  isExpired(tokenInfo) {
    if (!tokenInfo.expiresAt) {
      return false; // No expiration set
    }
    return new Date() > tokenInfo.expiresAt;
  }

  getTimeToExpiry(tokenInfo) {
    if (!tokenInfo.expiresAt) {
      return null; // No expiration set
    }
    return tokenInfo.expiresAt.getTime() - Date.now();
  }
}
```

**Bearer Token Validator:**
```javascript
class BearerTokenValidator {
  constructor(options = {}) {
    this.httpClient = new HttpClient(options);
    this.timeout = options.timeout || 10000;
  }

  async validateToken(config, testEndpoint) {
    const startTime = Date.now();

    try {
      // Create test request with Bearer token
      const testRequest = {
        method: 'GET',
        url: testEndpoint,
        timeout: this.timeout
      };

      // Inject authentication
      const authManager = new BearerTokenAuthManager();
      await authManager.injectAuthentication(testRequest, config.id);

      // Make test request
      const response = await this.httpClient.request(testRequest);
      const responseTime = Date.now() - startTime;

      // Analyze response
      const analysis = this.analyzeResponse(response, config);

      return {
        valid: analysis.success,
        responseTime,
        statusCode: response.status,
        analysis: analysis.details,
        recommendations: analysis.recommendations,
        tokenInfo: config.jwtInfo || null
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

  async refreshToken(config) {
    if (!config.refreshEndpoint) {
      throw new Error('No refresh endpoint configured');
    }

    try {
      const refreshRequest = {
        method: 'POST',
        url: config.refreshEndpoint,
        headers: {
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      };

      // Add current token to refresh request if needed
      if (config.refreshToken) {
        refreshRequest.data = {
          refresh_token: config.refreshToken
        };
      }

      const response = await this.httpClient.request(refreshRequest);

      if (response.status >= 200 && response.status < 300) {
        const newTokenData = response.data;
        
        return {
          token: newTokenData.access_token || newTokenData.token,
          expiresAt: newTokenData.expires_in ? 
            new Date(Date.now() + (newTokenData.expires_in * 1000)) : 
            null,
          refreshToken: newTokenData.refresh_token
        };
      } else {
        throw new Error(`Token refresh failed with status: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  analyzeResponse(response, config) {
    const success = response.status >= 200 && response.status < 300;
    
    const details = {
      statusCode: response.status,
      contentType: response.headers['content-type'],
      responseSize: JSON.stringify(response.data).length
    };

    // Add JWT-specific analysis
    if (config.tokenType === 'jwt' && config.jwtInfo) {
      const jwtParser = new JWTParser();
      details.timeToExpiry = jwtParser.getTimeToExpiry(config.jwtInfo);
      details.isExpired = jwtParser.isExpired(config.jwtInfo);
    }

    const recommendations = [];

    if (response.status === 401) {
      if (config.tokenType === 'jwt' && details.isExpired) {
        recommendations.push('JWT token has expired. Refresh the token or obtain a new one');
      } else {
        recommendations.push('Bearer token is invalid or expired');
      }
    } else if (response.status === 403) {
      recommendations.push('Token is valid but lacks permission for this endpoint');
    } else if (response.status === 429) {
      recommendations.push('Rate limit exceeded. Try again later or check rate limits');
    } else if (success) {
      recommendations.push('Bearer token authentication is working correctly');
      
      if (config.tokenType === 'jwt' && details.timeToExpiry && details.timeToExpiry < 300000) {
        recommendations.push('JWT token will expire soon. Consider refreshing it');
      }
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
      recommendations.push('Bearer token is invalid or expired. Check the token and try again');
    } else if (error.response?.status === 403) {
      recommendations.push('Token is valid but lacks permission for this endpoint. Check token scopes');
    }

    return recommendations;
  }
}
```

**Bearer Token Configuration Interface:**
```javascript
const BearerTokenConfiguration = ({ clientId, onConfigCreated }) => {
  const [config, setConfig] = useState({
    name: '',
    description: '',
    token: '',
    tokenType: 'opaque',
    expiresAt: '',
    autoRefresh: false,
    refreshEndpoint: ''
  });
  const [validating, setValidating] = useState(false);
  const [testEndpoint, setTestEndpoint] = useState('');
  const [validationResult, setValidationResult] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [showToken, setShowToken] = useState(false);

  const handleTokenChange = async (value) => {
    setConfig({ ...config, token: value });
    
    // Auto-detect JWT and parse if applicable
    if (value.includes('.')) {
      try {
        const jwtParser = new JWTParser();
        const parsed = await jwtParser.parse(value);
        setTokenInfo(parsed);
        setConfig(prev => ({
          ...prev,
          tokenType: 'jwt',
          expiresAt: parsed.expiresAt ? parsed.expiresAt.toISOString().slice(0, 16) : ''
        }));
      } catch (error) {
        setTokenInfo(null);
        setConfig(prev => ({ ...prev, tokenType: 'opaque' }));
      }
    } else {
      setTokenInfo(null);
      setConfig(prev => ({ ...prev, tokenType: 'opaque' }));
    }
  };

  const handleSave = async () => {
    try {
      const authManager = new BearerTokenAuthManager();
      const newConfig = await authManager.createBearerTokenConfig(clientId, {
        name: config.name,
        description: config.description,
        token: config.token,
        tokenType: config.tokenType,
        expiresAt: config.expiresAt ? new Date(config.expiresAt) : null,
        autoRefresh: config.autoRefresh,
        refreshEndpoint: config.refreshEndpoint
      });
      onConfigCreated(newConfig);
      showSuccess('Bearer token configuration saved successfully');
    } catch (error) {
      showError('Failed to save Bearer token configuration: ' + error.message);
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
      const tempConfig = { 
        ...config, 
        id: 'temp',
        expiresAt: config.expiresAt ? new Date(config.expiresAt) : null,
        jwtInfo: tokenInfo
      };
      const authManager = new BearerTokenAuthManager();
      const result = await authManager.validateBearerToken(tempConfig, testEndpoint);
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
    <div className="bearer-token-configuration">
      <div className="config-header">
        <h3>Bearer Token Authentication</h3>
        <p>Configure Bearer token authentication for JWT or opaque tokens</p>
      </div>

      <div className="config-form">
        <div className="form-group">
          <label>Configuration Name</label>
          <input
            type="text"
            value={config.name}
            onChange={(e) => setConfig({ ...config, name: e.target.value })}
            placeholder="e.g., Production JWT Token"
            required
          />
        </div>

        <div className="form-group">
          <label>Description</label>
          <textarea
            value={config.description}
            onChange={(e) => setConfig({ ...config, description: e.target.value })}
            placeholder="Optional description of this Bearer token configuration"
            rows={3}
          />
        </div>

        <div className="form-group">
          <label>Token</label>
          <div className="token-input">
            <textarea
              value={config.token}
              onChange={(e) => handleTokenChange(e.target.value)}
              placeholder="Enter your Bearer token (JWT or opaque token)"
              rows={3}
              required
            />
            <button
              type="button"
              className="toggle-token"
              onClick={() => setShowToken(!showToken)}
            >
              {showToken ? 'Hide' : 'Show'}
            </button>
          </div>
          <div className="token-type-indicator">
            Detected Type: <span className="token-type">{config.tokenType.toUpperCase()}</span>
          </div>
        </div>

        {tokenInfo && (
          <div className="jwt-info">
            <h4>JWT Information</h4>
            <div className="jwt-details">
              <div className="jwt-field">
                <label>Issuer:</label>
                <span>{tokenInfo.issuer || 'Not specified'}</span>
              </div>
              <div className="jwt-field">
                <label>Subject:</label>
                <span>{tokenInfo.subject || 'Not specified'}</span>
              </div>
              <div className="jwt-field">
                <label>Issued At:</label>
                <span>{tokenInfo.issuedAt ? tokenInfo.issuedAt.toLocaleString() : 'Not specified'}</span>
              </div>
              <div className="jwt-field">
                <label>Expires At:</label>
                <span>{tokenInfo.expiresAt ? tokenInfo.expiresAt.toLocaleString() : 'Never'}</span>
              </div>
              {tokenInfo.scopes.length > 0 && (
                <div className="jwt-field">
                  <label>Scopes:</label>
                  <div className="scopes">
                    {tokenInfo.scopes.map((scope, index) => (
                      <span key={index} className="scope">{scope}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Expiration Date (Optional)</label>
          <input
            type="datetime-local"
            value={config.expiresAt}
            onChange={(e) => setConfig({ ...config, expiresAt: e.target.value })}
          />
          <small>Leave empty if token doesn't expire or expiration is embedded in JWT</small>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={config.autoRefresh}
              onChange={(e) => setConfig({ ...config, autoRefresh: e.target.checked })}
            />
            Enable Auto Refresh
          </label>
          <small>Automatically refresh the token when it expires</small>
        </div>

        {config.autoRefresh && (
          <div className="form-group">
            <label>Refresh Endpoint</label>
            <input
              type="url"
              value={config.refreshEndpoint}
              onChange={(e) => setConfig({ ...config, refreshEndpoint: e.target.value })}
              placeholder="https://api.example.com/auth/refresh"
            />
          </div>
        )}
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
            disabled={validating || !config.token || !testEndpoint}
          >
            {validating ? 'Testing...' : 'Test Token'}
          </button>
        </div>

        {validationResult && (
          <ValidationResult result={validationResult} />
        )}
      </div>

      <div className="config-actions">
        <button 
          onClick={handleSave}
          disabled={!config.name || !config.token}
          className="primary"
        >
          Save Configuration
        </button>
        <button onClick={() => setConfig({
          name: '',
          description: '',
          token: '',
          tokenType: 'opaque',
          expiresAt: '',
          autoRefresh: false,
          refreshEndpoint: ''
        })}>
          Reset
        </button>
      </div>
    </div>
  );
};
```

**Error Handling:**
- Invalid JWT tokens: Detailed parsing error messages
- Expired tokens: Clear expiration warnings and refresh suggestions
- Network failures: Retry mechanisms and fallback options
- Configuration validation: Field-specific error messages

## Success Criteria

- Bearer token authentication works for both JWT and opaque tokens
- Tokens are encrypted using AES-256 encryption
- JWT parsing and validation works correctly
- Token validation completes within 3 seconds
- Authentication injection adds <5ms overhead

## Monitoring and Observability

**Metrics to Track:**
- Bearer token usage statistics
- Token expiration rates
- Authentication success rates
- JWT validation performance

**Alerts:**
- Authentication failure rate >10%
- Token expiration rate >20%
- Validation response time >5 seconds
- JWT parsing errors

## Integration Points

**Upstream:**
- API client generation (authentication injection)
- API key authentication (shared patterns)
- Basic authentication (shared patterns)

**Downstream:**
- Secure credential storage (persistence)
- Security auditor (audit logging)
- HTTP client infrastructure (request modification)

## Token Features

**JWT Support:**
- Automatic JWT detection and parsing
- Token expiration monitoring
- Claims validation
- Scope verification

**Opaque Token Support:**
- Secure token storage
- Manual expiration handling
- Token refresh capabilities
- Validation testing

**Security Features:**
- Token encryption at rest
- Secure transmission
- No token logging
- Access control and auditing

**Token Management:**
- Multiple token configurations
- Auto-refresh capabilities
- Expiration warnings
- Token rotation support