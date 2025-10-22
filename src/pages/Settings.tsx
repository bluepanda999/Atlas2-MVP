import React, { useState, useEffect } from "react";
import { Layout } from "../components/layout";
import { Button, Modal } from "../components/common";
import { apiService } from "../services/api";
import { storage } from "../utils/helpers";

// Types following Story 2.4 patterns
interface EndpointConfiguration {
  id: string;
  name: string;
  baseUrl: string;
  environment: "development" | "staging" | "production";
  authentication: {
    type: "none" | "api_key" | "basic_auth" | "bearer_token";
    credentials?: {
      apiKey?: string;
      headerName?: string;
      username?: string;
      password?: string;
      token?: string;
    };
  };
  headers?: Record<string, string>;
  timeout: number;
  retryAttempts: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ValidationResult {
  valid: boolean;
  responseTime: number;
  statusCode?: number;
  error?: string;
  analysis?: any;
  recommendations?: string[];
}

const Settings: React.FC = () => {
  const [configurations, setConfigurations] = useState<EndpointConfiguration[]>(
    [],
  );
  const [selectedConfig, setSelectedConfig] =
    useState<EndpointConfiguration | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingConfig, setEditingConfig] =
    useState<EndpointConfiguration | null>(null);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [validationResult, setValidationResult] =
    useState<ValidationResult | null>(null);
  const [testEndpoint, setTestEndpoint] = useState("");
  const [environment, setEnvironment] = useState<
    "development" | "staging" | "production"
  >("development");

  // Form state following Story 2.4 patterns
  const [formData, setFormData] = useState<Partial<EndpointConfiguration>>({
    name: "",
    baseUrl: "",
    environment: "development",
    authentication: {
      type: "none",
    },
    timeout: 30000,
    retryAttempts: 3,
    isActive: false,
  });

  useEffect(() => {
    loadConfigurations();
  }, []);

  const loadConfigurations = async () => {
    try {
      // Try to load from API first, fallback to localStorage
      let configs: EndpointConfiguration[] = [];

      try {
        const response = await apiService.getApiConfigurations();
        configs = response.data || [];
      } catch (apiError) {
        // Fallback to localStorage for development
        const stored = storage.get("endpoint-configurations");
        configs = stored || [];
      }

      setConfigurations(configs);

      // Set active configuration
      const activeConfig = configs.find((c) => c.isActive);
      if (activeConfig) {
        setSelectedConfig(activeConfig);
      }
    } catch (error) {
      console.error("Failed to load configurations:", error);
    }
  };

  const saveConfiguration = async () => {
    if (!formData.name || !formData.baseUrl) {
      alert("Name and Base URL are required");
      return;
    }

    setLoading(true);
    try {
      const config: EndpointConfiguration = {
        id: editingConfig?.id || `config_${Date.now()}`,
        name: formData.name!,
        baseUrl: formData.baseUrl!,
        environment: formData.environment || "development",
        authentication: formData.authentication || { type: "none" },
        headers: formData.headers || {},
        timeout: formData.timeout || 30000,
        retryAttempts: formData.retryAttempts || 3,
        isActive: formData.isActive || false,
        createdAt: editingConfig?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Validate URL
      try {
        new URL(config.baseUrl);
      } catch {
        throw new Error("Invalid Base URL format");
      }

      let updatedConfigs: EndpointConfiguration[];

      if (editingConfig) {
        // Update existing configuration
        updatedConfigs = configurations.map((c) =>
          c.id === editingConfig.id ? config : c,
        );
      } else {
        // Add new configuration
        updatedConfigs = [...configurations, config];
      }

      // If setting as active, deactivate others
      if (config.isActive) {
        updatedConfigs = updatedConfigs.map((c) => ({
          ...c,
          isActive: c.id === config.id,
        }));
      }

      // Try to save to API first
      try {
        if (editingConfig) {
          await apiService.updateApiConfiguration(config.id, config);
        } else {
          await apiService.createApiConfiguration(config);
        }
      } catch (apiError) {
        // Fallback to localStorage
        storage.set("endpoint-configurations", updatedConfigs);
      }

      setConfigurations(updatedConfigs);

      if (config.isActive) {
        setSelectedConfig(config);
        // Update API service base URL
        updateApiServiceConfig(config);
      }

      setShowForm(false);
      setEditingConfig(null);
      resetForm();

      alert("Configuration saved successfully!");
    } catch (error) {
      alert(`Failed to save configuration: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const deleteConfiguration = async (configId: string) => {
    if (!confirm("Are you sure you want to delete this configuration?")) {
      return;
    }

    try {
      let updatedConfigs = configurations.filter((c) => c.id !== configId);

      // Try to delete from API first
      try {
        await apiService.deleteApiConfiguration(configId);
      } catch (apiError) {
        // Fallback to localStorage
        storage.set("endpoint-configurations", updatedConfigs);
      }

      setConfigurations(updatedConfigs);

      // If deleted config was active, clear selection
      if (selectedConfig?.id === configId) {
        setSelectedConfig(null);
      }

      alert("Configuration deleted successfully!");
    } catch (error) {
      alert(`Failed to delete configuration: ${error.message}`);
    }
  };

  const setActiveConfiguration = async (config: EndpointConfiguration) => {
    try {
      const updatedConfigs = configurations.map((c) => ({
        ...c,
        isActive: c.id === config.id,
      }));

      // Update API service
      updateApiServiceConfig(config);

      // Try to save to API first
      try {
        await apiService.updateApiConfiguration(config.id, {
          ...config,
          isActive: true,
        });
      } catch (apiError) {
        // Fallback to localStorage
        storage.set("endpoint-configurations", updatedConfigs);
      }

      setConfigurations(updatedConfigs);
      setSelectedConfig(config);

      alert(`Active configuration set to: ${config.name}`);
    } catch (error) {
      alert(`Failed to set active configuration: ${error.message}`);
    }
  };

  const updateApiServiceConfig = (config: EndpointConfiguration) => {
    // Update the API service base URL dynamically
    if (typeof window !== "undefined") {
      window.localStorage.setItem("atlas2-api-base-url", config.baseUrl);
      // Force reload to apply new configuration
      window.location.reload();
    }
  };

  const testConnection = async () => {
    if (!testEndpoint) {
      alert("Please enter a test endpoint URL");
      return;
    }

    setTesting(true);
    setValidationResult(null);

    try {
      const startTime = Date.now();

      // Create test request based on authentication
      const testUrl = testEndpoint.startsWith("http")
        ? testEndpoint
        : `${formData.baseUrl}${testEndpoint}`;

      // Use the API service to test connection
      try {
        const response = await fetch(testUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            // Add authentication headers based on config
            ...(formData.authentication?.type === "api_key" &&
              formData.authentication.credentials?.apiKey && {
                [formData.authentication.credentials.headerName || "X-API-Key"]:
                  formData.authentication.credentials.apiKey,
              }),
            ...(formData.authentication?.type === "bearer_token" &&
              formData.authentication.credentials?.token && {
                Authorization: `Bearer ${formData.authentication.credentials.token}`,
              }),
          },
          signal: AbortSignal.timeout(10000),
        });

        const responseTime = Date.now() - startTime;
        const valid = response.status >= 200 && response.status < 300;

        setValidationResult({
          valid,
          responseTime,
          statusCode: response.status,
          analysis: {
            contentType: response.headers.get("content-type"),
            responseSize: response.headers.get("content-length"),
          },
          recommendations: valid
            ? [
                "Connection successful!",
                "Endpoint is accessible and responding correctly",
              ]
            : [
                response.status === 401
                  ? "Authentication failed - check credentials"
                  : response.status === 403
                    ? "Access forbidden - check permissions"
                    : response.status === 404
                      ? "Endpoint not found - check URL"
                      : response.status >= 500
                        ? "Server error - try again later"
                        : "Unexpected response - check endpoint configuration",
              ],
        });
      } catch (error) {
        const responseTime = Date.now() - startTime;
        setValidationResult({
          valid: false,
          responseTime,
          error: error.message,
          recommendations: [
            error.message.includes("fetch")
              ? "Network error - check URL and connectivity"
              : error.message.includes("timeout")
                ? "Request timed out - check endpoint availability"
                : "Connection failed - verify configuration and try again",
          ],
        });
      }
    } finally {
      setTesting(false);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      baseUrl: "",
      environment: "development",
      authentication: { type: "none" },
      timeout: 30000,
      retryAttempts: 3,
      isActive: false,
    });
    setValidationResult(null);
    setTestEndpoint("");
  };

  const openEditForm = (config: EndpointConfiguration) => {
    setEditingConfig(config);
    setFormData(config);
    setShowForm(true);
  };

  const openNewForm = () => {
    setEditingConfig(null);
    resetForm();
    setShowForm(true);
  };

  return (
    <Layout
      title="Settings"
      subtitle="Configure API endpoints and application settings"
    >
      <div className="space-y-6">
        {/* Active Configuration Display */}
        {selectedConfig && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">
                Active Configuration
              </h2>
              <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                ACTIVE
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Name</p>
                <p className="text-sm text-gray-900">{selectedConfig.name}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Base URL</p>
                <p className="text-sm text-gray-900 truncate">
                  {selectedConfig.baseUrl}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">Environment</p>
                <p className="text-sm text-gray-900 capitalize">
                  {selectedConfig.environment}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600">
                  Authentication
                </p>
                <p className="text-sm text-gray-900 capitalize">
                  {selectedConfig.authentication.type.replace("_", " ")}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Configuration List */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              API Endpoint Configurations
            </h2>
            <Button onClick={openNewForm} variant="primary">
              Add Configuration
            </Button>
          </div>

          {configurations.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No endpoint configurations found.</p>
              <p className="text-sm text-gray-400 mt-2">
                Add your first API endpoint configuration to get started.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {configurations.map((config) => (
                <div key={config.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3">
                        <h3 className="text-medium font-medium text-gray-900">
                          {config.name}
                        </h3>
                        {config.isActive && (
                          <span className="px-2 py-1 text-xs font-medium text-green-800 bg-green-100 rounded-full">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {config.baseUrl}
                      </p>
                      <div className="flex items-center space-x-4 mt-2 text-xs text-gray-500">
                        <span>Environment: {config.environment}</span>
                        <span>
                          Auth: {config.authentication.type.replace("_", " ")}
                        </span>
                        <span>Timeout: {config.timeout}ms</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {!config.isActive && (
                        <Button
                          onClick={() => setActiveConfiguration(config)}
                          variant="outline"
                          size="sm"
                        >
                          Set Active
                        </Button>
                      )}
                      <Button
                        onClick={() => openEditForm(config)}
                        variant="outline"
                        size="sm"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteConfiguration(config.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Configuration Form Modal */}
      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title={editingConfig ? "Edit Configuration" : "Add Configuration"}
        size="xl"
      >
        <div className="space-y-6">
          {/* Basic Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Basic Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Configuration Name *
                </label>
                <input
                  type="text"
                  value={formData.name || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Production API"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Environment
                </label>
                <select
                  value={formData.environment || "development"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      environment: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="development">Development</option>
                  <option value="staging">Staging</option>
                  <option value="production">Production</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Base URL *
                </label>
                <input
                  type="url"
                  value={formData.baseUrl || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, baseUrl: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://api.example.com"
                />
              </div>
            </div>
          </div>

          {/* Authentication Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Authentication
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Authentication Type
                </label>
                <select
                  value={formData.authentication?.type || "none"}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      authentication: { type: e.target.value as any },
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="none">None</option>
                  <option value="api_key">API Key</option>
                  <option value="basic_auth">Basic Auth</option>
                  <option value="bearer_token">Bearer Token</option>
                </select>
              </div>

              {formData.authentication?.type === "api_key" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      API Key
                    </label>
                    <input
                      type="password"
                      value={formData.authentication.credentials?.apiKey || ""}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authentication: {
                            ...formData.authentication!,
                            credentials: {
                              ...formData.authentication!.credentials,
                              apiKey: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter API key"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Header Name
                    </label>
                    <input
                      type="text"
                      value={
                        formData.authentication.credentials?.headerName ||
                        "X-API-Key"
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authentication: {
                            ...formData.authentication!,
                            credentials: {
                              ...formData.authentication!.credentials,
                              headerName: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="X-API-Key"
                    />
                  </div>
                </div>
              )}

              {formData.authentication?.type === "basic_auth" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={
                        formData.authentication.credentials?.username || ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authentication: {
                            ...formData.authentication!,
                            credentials: {
                              ...formData.authentication!.credentials,
                              username: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter username"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Password
                    </label>
                    <input
                      type="password"
                      value={
                        formData.authentication.credentials?.password || ""
                      }
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          authentication: {
                            ...formData.authentication!,
                            credentials: {
                              ...formData.authentication!.credentials,
                              password: e.target.value,
                            },
                          },
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter password"
                    />
                  </div>
                </div>
              )}

              {formData.authentication?.type === "bearer_token" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Bearer Token
                  </label>
                  <input
                    type="password"
                    value={formData.authentication.credentials?.token || ""}
                    onChange={(e) =>
                      setFormData({
                        ...formData,
                        authentication: {
                          ...formData.authentication!,
                          credentials: {
                            ...formData.authentication!.credentials,
                            token: e.target.value,
                          },
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter bearer token"
                  />
                </div>
              )}
            </div>
          </div>

          {/* Connection Test */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Test Connection
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Test Endpoint
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={testEndpoint}
                    onChange={(e) => setTestEndpoint(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="/health or https://api.example.com/test"
                  />
                  <Button
                    onClick={testConnection}
                    disabled={testing || !formData.baseUrl}
                    variant="outline"
                  >
                    {testing ? "Testing..." : "Test Connection"}
                  </Button>
                </div>
              </div>

              {validationResult && (
                <div
                  className={`p-4 rounded-md ${validationResult.valid ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`font-medium ${validationResult.valid ? "text-green-800" : "text-red-800"}`}
                    >
                      {validationResult.valid
                        ? "✓ Connection Successful"
                        : "✗ Connection Failed"}
                    </span>
                    <div className="flex items-center space-x-4 text-sm">
                      <span
                        className={
                          validationResult.valid
                            ? "text-green-600"
                            : "text-red-600"
                        }
                      >
                        {validationResult.responseTime}ms
                      </span>
                      {validationResult.statusCode && (
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${
                            validationResult.statusCode >= 200 &&
                            validationResult.statusCode < 300
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {validationResult.statusCode}
                        </span>
                      )}
                    </div>
                  </div>

                  {validationResult.error && (
                    <p className="text-sm text-red-700 mb-2">
                      {validationResult.error}
                    </p>
                  )}

                  {validationResult.recommendations && (
                    <div className="text-sm">
                      <p className="font-medium text-gray-700 mb-1">
                        Recommendations:
                      </p>
                      <ul className="list-disc list-inside space-y-1">
                        {validationResult.recommendations.map((rec, index) => (
                          <li
                            key={index}
                            className={
                              validationResult.valid
                                ? "text-green-700"
                                : "text-red-700"
                            }
                          >
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Advanced Settings */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Advanced Settings
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Timeout (ms)
                </label>
                <input
                  type="number"
                  value={formData.timeout || 30000}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      timeout: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="1000"
                  max="300000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Retry Attempts
                </label>
                <input
                  type="number"
                  value={formData.retryAttempts || 3}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      retryAttempts: parseInt(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  max="10"
                />
              </div>
            </div>
            <div className="mt-4">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isActive || false}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700">
                  Set as active configuration
                </span>
              </label>
            </div>
          </div>

          {/* Form Actions */}
          <div className="flex justify-end space-x-3 pt-4 border-t">
            <Button onClick={() => setShowForm(false)} variant="outline">
              Cancel
            </Button>
            <Button
              onClick={saveConfiguration}
              disabled={loading || !formData.name || !formData.baseUrl}
              variant="primary"
            >
              {loading
                ? "Saving..."
                : editingConfig
                  ? "Update Configuration"
                  : "Save Configuration"}
            </Button>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default Settings;
