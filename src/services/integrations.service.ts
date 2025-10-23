/**
 * Integrations Service
 * API service for Integration Marketplace functionality
 * Implements Epic 9: Integration Marketplace Stories 9.1-9.4
 */

import { apiClient } from "./api";
import message from "antd/es/message";
import {
  Integration,
  IntegrationDetail,
  IntegrationInstallation,
  IntegrationFilters,
  Template,
  TemplateDetail,
  TemplateCategory,
  TemplateConfig,
  TemplateResult,
  ValidationResult,
  ConnectorSubmission,
  SubmissionStatus,
  SecurityScanResult,
  ContributorReputation,
  TestResult,
  PerformanceTestConfig,
  TestSuiteConfig,
  InstallationResult,
  PerformanceTestResult,
  ConnectivityTestResult,
} from "../types/integrations";

class IntegrationsService {
  // Integration Catalog (Story 9.1)

  async getIntegrations(
    filters?: IntegrationFilters,
  ): Promise<{
    integrations: Integration[];
    total: number;
    categories: string[];
    authTypes: string[];
  }> {
    try {
      const response = (await apiClient.get("/marketplace/integrations", {
        params: filters,
      })) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch integrations:", error);
      throw error;
    }
  }

  async getIntegration(id: string): Promise<IntegrationDetail> {
    try {
      const response = (await apiClient.get(
        `/marketplace/integrations/${id}`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch integration:", error);
      throw error;
    }
  }

  async installIntegration(
    integrationId: string,
    configuration: any,
    name?: string,
  ): Promise<InstallationResult> {
    try {
      const response = (await apiClient.post(
        `/marketplace/integrations/${integrationId}/install`,
        {
          configuration,
          name,
        },
      )) as any;
      message.success("Integration installed successfully");
      return response.data;
    } catch (error) {
      message.error("Failed to install integration");
      throw error;
    }
  }

  async searchIntegrations(
    query: string,
    filters?: IntegrationFilters,
  ): Promise<Integration[]> {
    try {
      const response = (await apiClient.get("/marketplace/integrations", {
        params: { ...filters, search: query },
      })) as any;
      return response.data.integrations;
    } catch (error) {
      console.error("Failed to search integrations:", error);
      throw error;
    }
  }

  // Template System (Story 9.2)

  async getTemplates(
    category?: TemplateCategory,
  ): Promise<{ templates: Template[]; categories: string[] }> {
    try {
      const response = (await apiClient.get("/marketplace/templates", {
        params: { category },
      })) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch templates:", error);
      throw error;
    }
  }

  async getTemplate(id: string): Promise<TemplateDetail> {
    try {
      const response = (await apiClient.get(
        `/marketplace/templates/${id}`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch template:", error);
      throw error;
    }
  }

  async applyTemplate(
    templateId: string,
    configuration: TemplateConfig,
  ): Promise<TemplateResult> {
    try {
      const response = (await apiClient.post(
        `/marketplace/templates/${templateId}/apply`,
        {
          configuration,
        },
      )) as any;
      message.success("Template applied successfully");
      return response.data;
    } catch (error) {
      message.error("Failed to apply template");
      throw error;
    }
  }

  async validateTemplate(
    templateId: string,
    configuration: TemplateConfig,
  ): Promise<ValidationResult> {
    try {
      const response = (await apiClient.post(
        `/marketplace/templates/${templateId}/validate`,
        {
          configuration,
        },
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to validate template:", error);
      throw error;
    }
  }

  // Community Connectors (Story 9.3)

  async submitConnector(
    submission: Partial<ConnectorSubmission>,
  ): Promise<ConnectorSubmission> {
    try {
      const response = (await apiClient.post(
        "/community/connectors/submit",
        submission,
      )) as any;
      message.success("Connector submitted for review");
      return response.data;
    } catch (error) {
      message.error("Failed to submit connector");
      throw error;
    }
  }

  async getConnectorSubmissions(
    status?: SubmissionStatus,
  ): Promise<ConnectorSubmission[]> {
    try {
      const response = (await apiClient.get(
        "/community/connectors/submissions",
        {
          params: { status },
        },
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch submissions:", error);
      throw error;
    }
  }

  async getContributorReputation(
    userId: string,
  ): Promise<ContributorReputation> {
    try {
      const response = (await apiClient.get(
        `/community/contributors/${userId}/reputation`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch contributor reputation:", error);
      throw error;
    }
  }

  async reviewConnector(submissionId: string, review: any): Promise<void> {
    try {
      await apiClient.post(
        `/community/connectors/${submissionId}/review`,
        review,
      );
      message.success("Review submitted");
    } catch (error) {
      message.error("Failed to submit review");
      throw error;
    }
  }

  async getSecurityScanResult(
    submissionId: string,
  ): Promise<SecurityScanResult> {
    try {
      const response = (await apiClient.get(
        `/community/connectors/${submissionId}/security-scan`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch security scan result:", error);
      throw error;
    }
  }

  // Testing Tools (Story 9.4)

  async runConnectivityTest(integrationId: string): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/connectivity`,
      )) as any;
      message.success("Connectivity test started");
      return response.data.testId;
    } catch (error) {
      message.error("Failed to start connectivity test");
      throw error;
    }
  }

  async runPerformanceTest(
    integrationId: string,
    config: PerformanceTestConfig,
  ): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/performance`,
        { config },
      )) as any;
      message.success("Performance test started");
      return response.data.testId;
    } catch (error) {
      message.error("Failed to start performance test");
      throw error;
    }
  }

  async runSchemaValidationTest(integrationId: string): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/schema-validation`,
      )) as any;
      message.success("Schema validation test started");
      return response.data.testId;
    } catch (error) {
      message.error("Failed to start schema validation test");
      throw error;
    }
  }

  async runSecurityTest(integrationId: string): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/security`,
      )) as any;
      message.success("Security test started");
      return response.data.testId;
    } catch (error) {
      message.error("Failed to start security test");
      throw error;
    }
  }

  async runRegressionTest(
    integrationId: string,
    baselineVersion?: string,
  ): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/regression`,
        {
          baselineVersion,
        },
      )) as any;
      message.success("Regression test started");
      return response.data.testId;
    } catch (error) {
      message.error("Failed to start regression test");
      throw error;
    }
  }

  async runTestSuite(
    integrationId: string,
    config: TestSuiteConfig,
  ): Promise<string> {
    try {
      const response = (await apiClient.post(
        `/integrations/${integrationId}/test/suite`,
        { config },
      )) as any;
      message.success("Full test suite started");
      return response.data.suiteId;
    } catch (error) {
      message.error("Failed to start test suite");
      throw error;
    }
  }

  async getTestResults(
    integrationId: string,
    filters?: any,
  ): Promise<{ results: TestResult[]; total: number }> {
    try {
      const response = (await apiClient.get(
        `/integrations/${integrationId}/test/results`,
        { params: filters },
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch test results:", error);
      throw error;
    }
  }

  async getTestResult(testId: string): Promise<TestResult> {
    try {
      const response = (await apiClient.get(`/test/results/${testId}`)) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch test result:", error);
      throw error;
    }
  }

  async getPerformanceTestResult(
    testId: string,
  ): Promise<PerformanceTestResult> {
    try {
      const response = (await apiClient.get(
        `/test/results/${testId}/performance`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch performance test result:", error);
      throw error;
    }
  }

  async getConnectivityTestResult(
    testId: string,
  ): Promise<ConnectivityTestResult> {
    try {
      const response = (await apiClient.get(
        `/test/results/${testId}/connectivity`,
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch connectivity test result:", error);
      throw error;
    }
  }

  // Installation Management

  async getInstallations(): Promise<IntegrationInstallation[]> {
    try {
      const response = (await apiClient.get(
        "/integrations/installations",
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch installations:", error);
      throw error;
    }
  }

  async uninstallIntegration(installationId: string): Promise<void> {
    try {
      await apiClient.delete(`/integrations/installations/${installationId}`);
      message.success("Integration uninstalled successfully");
    } catch (error) {
      message.error("Failed to uninstall integration");
      throw error;
    }
  }

  async updateInstallation(
    installationId: string,
    configuration: any,
  ): Promise<void> {
    try {
      await apiClient.put(`/integrations/installations/${installationId}`, {
        configuration,
      });
      message.success("Integration updated successfully");
    } catch (error) {
      message.error("Failed to update integration");
      throw error;
    }
  }

  // Utility Methods

  async getCategories(): Promise<string[]> {
    try {
      const response = (await apiClient.get("/marketplace/categories")) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch categories:", error);
      throw error;
    }
  }

  async getAuthTypes(): Promise<string[]> {
    try {
      const response = (await apiClient.get("/marketplace/auth-types")) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch auth types:", error);
      throw error;
    }
  }

  async getPopularIntegrations(limit: number = 10): Promise<Integration[]> {
    try {
      const response = (await apiClient.get(
        "/marketplace/integrations/popular",
        {
          params: { limit },
        },
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch popular integrations:", error);
      throw error;
    }
  }

  async getRecentIntegrations(limit: number = 10): Promise<Integration[]> {
    try {
      const response = (await apiClient.get(
        "/marketplace/integrations/recent",
        {
          params: { limit },
        },
      )) as any;
      return response.data;
    } catch (error) {
      console.error("Failed to fetch recent integrations:", error);
      throw error;
    }
  }

  // Batch operations
  async batchInstallIntegrations(
    installations: Array<{
      integrationId: string;
      configuration: any;
      name?: string;
    }>,
  ): Promise<InstallationResult[]> {
    try {
      const response = (await apiClient.post(
        "/marketplace/integrations/batch-install",
        { installations },
      )) as any;
      message.success(
        `${installations.length} integrations installed successfully`,
      );
      return response.data;
    } catch (error) {
      message.error("Failed to install integrations");
      throw error;
    }
  }

  async exportIntegrationConfiguration(installationId: string): Promise<any> {
    try {
      const response = (await apiClient.get(
        `/integrations/installations/${installationId}/export`,
      )) as any;
      return response.data;
    } catch (error) {
      message.error("Failed to export configuration");
      throw error;
    }
  }

  async importIntegrationConfiguration(
    configuration: any,
  ): Promise<InstallationResult> {
    try {
      const response = (await apiClient.post("/integrations/import", {
        configuration,
      })) as any;
      message.success("Configuration imported successfully");
      return response.data;
    } catch (error) {
      message.error("Failed to import configuration");
      throw error;
    }
  }
}

// Create singleton instance
const integrationsService = new IntegrationsService();

export default integrationsService;
