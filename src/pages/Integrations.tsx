/**
 * Integrations Page
 * Comprehensive Integration Marketplace implementing Epic 9 Stories 9.1-9.4
 *
 * Features:
 * - Story 9.1: Pre-built API Integration Catalog
 * - Story 9.2: Integration Template System
 * - Story 9.3: Community Connector Framework
 * - Story 9.4: Integration Testing Tools
 */

import React, { useState, useEffect } from "react";
import {
  Card,
  Tabs,
  Row,
  Col,
  Button,
  Input,
  Select,
  Space,
  Typography,
  Badge,
  Spin,
  message,
  Modal,
  Form,
  Rate,
  Tag,
  Divider,
  Alert,
  Progress,
  Tooltip,
  Empty,
} from "antd";
import {
  ApiOutlined,
  AppstoreOutlined,
  ThunderboltOutlined,
  TeamOutlined,
  BugOutlined,
  PlusOutlined,
  DownloadOutlined,
  PlayCircleOutlined,
} from "@ant-design/icons";
import {
  Integration,
  IntegrationDetail,
  IntegrationInstallation,
  IntegrationFilters,
  Template,
  TemplateCategory,
  ConnectorSubmission,
  SubmissionStatus,
  TestResult,
  IntegrationCategory,
} from "../types/integrations";
import integrationsService from "../services/integrations.service";

const { Title, Paragraph, Text } = Typography;
const { TabPane } = Tabs;
const { Search } = Input;
const { Option } = Select;

const Integrations: React.FC = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("catalog");

  // Catalog state (Story 9.1)
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [selectedIntegration, setSelectedIntegration] =
    useState<IntegrationDetail | null>(null);
  const [installations, setInstallations] = useState<IntegrationInstallation[]>(
    [],
  );
  const [categories, setCategories] = useState<string[]>([]);
  const [authTypes, setAuthTypes] = useState<string[]>([]);

  // Templates state (Story 9.2)
  const [templates, setTemplates] = useState<Template[]>([]);

  // Community state (Story 9.3)
  const [submissions, setSubmissions] = useState<ConnectorSubmission[]>([]);
  const [submissionModalVisible, setSubmissionModalVisible] = useState(false);

  // Testing state (Story 9.4)
  const [testResults, setTestResults] = useState<TestResult[]>([]);

  // Forms
  const [form] = Form.useForm();

  // Load initial data
  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadIntegrations(),
        loadInstallations(),
        loadCategories(),
        loadAuthTypes(),
        loadTemplates(),
        loadSubmissions(),
      ]);
    } catch (error) {
      message.error("Failed to load integrations data");
    } finally {
      setLoading(false);
    }
  };

  // Catalog functions (Story 9.1)
  const loadIntegrations = async (filters?: IntegrationFilters) => {
    try {
      const response = await integrationsService.getIntegrations(filters);
      setIntegrations(response.integrations);
      setCategories(response.categories);
      setAuthTypes(response.authTypes);
    } catch (error) {
      console.error("Failed to load integrations:", error);
    }
  };

  const loadInstallations = async () => {
    try {
      const userInstallations = await integrationsService.getInstallations();
      setInstallations(userInstallations);
    } catch (error) {
      console.error("Failed to load installations:", error);
    }
  };

  const loadCategories = async () => {
    try {
      const cats = await integrationsService.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Failed to load categories:", error);
    }
  };

  const loadAuthTypes = async () => {
    try {
      const types = await integrationsService.getAuthTypes();
      setAuthTypes(types);
    } catch (error) {
      console.error("Failed to load auth types:", error);
    }
  };

  const handleIntegrationSelect = async (integration: Integration) => {
    try {
      const detail = await integrationsService.getIntegration(integration.id);
      setSelectedIntegration(detail);
    } catch (error) {
      message.error("Failed to load integration details");
    }
  };

  const handleInstallIntegration = async (
    integrationId: string,
    configuration: any,
    name?: string,
  ) => {
    try {
      await integrationsService.installIntegration(
        integrationId,
        configuration,
        name,
      );
      await loadInstallations();
      message.success("Integration installed successfully");
    } catch (error) {
      message.error("Failed to install integration");
    }
  };

  // Template functions (Story 9.2)
  const loadTemplates = async (category?: TemplateCategory) => {
    try {
      const response = await integrationsService.getTemplates(category);
      setTemplates(response.templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
    }
  };

  const handleTemplateSelect = async (template: Template) => {
    try {
      const detail = await integrationsService.getTemplate(template.id);
      // Template details could be shown in a modal here
      console.log("Template details:", detail);
    } catch (error) {
      message.error("Failed to load template details");
    }
  };

  // Community functions (Story 9.3)
  const loadSubmissions = async (status?: SubmissionStatus) => {
    try {
      const subs = await integrationsService.getConnectorSubmissions(status);
      setSubmissions(subs);
    } catch (error) {
      console.error("Failed to load submissions:", error);
    }
  };

  const handleSubmitConnector = async (values: any) => {
    try {
      await integrationsService.submitConnector(values);
      setSubmissionModalVisible(false);
      form.resetFields();
      await loadSubmissions();
      message.success("Connector submitted for review");
    } catch (error) {
      message.error("Failed to submit connector");
    }
  };

  // Testing functions (Story 9.4)
  const handleRunTest = async (integrationId: string, testType: string) => {
    try {
      switch (testType) {
        case "connectivity":
          await integrationsService.runConnectivityTest(integrationId);
          break;
        case "performance":
          await integrationsService.runPerformanceTest(integrationId, {
            duration: 60,
            concurrentRequests: 10,
            requestsPerBatch: 100,
          });
          break;
        case "security":
          await integrationsService.runSecurityTest(integrationId);
          break;
        default:
          await integrationsService.runTestSuite(integrationId, {
            includeConnectivity: true,
            includePerformance: true,
            includeSchemaValidation: true,
            includeSecurity: true,
          });
      }
      message.success(`${testType} test started`);
      await loadTestResults(integrationId);
    } catch (error) {
      message.error(`Failed to start ${testType} test`);
    }
  };

  const loadTestResults = async (integrationId: string) => {
    try {
      const response = await integrationsService.getTestResults(integrationId);
      setTestResults(response.results);
    } catch (error) {
      console.error("Failed to load test results:", error);
    }
  };

  // UI Components

  const IntegrationCard = ({ integration }: { integration: Integration }) => (
    <Card
      hoverable
      style={{ marginBottom: 16 }}
      actions={[
        <Tooltip title="View Details">
          <ApiOutlined onClick={() => handleIntegrationSelect(integration)} />
        </Tooltip>,
        <Tooltip title="Install">
          <DownloadOutlined
            onClick={() => handleInstallIntegration(integration.id, {})}
          />
        </Tooltip>,
        <Tooltip title="Test">
          <BugOutlined onClick={() => handleRunTest(integration.id, "suite")} />
        </Tooltip>,
      ]}
    >
      <Card.Meta
        title={
          <Space>
            {integration.name}
            {integration.isCommunity && <Tag color="blue">Community</Tag>}
          </Space>
        }
        description={
          <div>
            <Paragraph ellipsis={{ rows: 2 }}>
              {integration.description}
            </Paragraph>
            <Space wrap>
              <Tag color="blue">{integration.category}</Tag>
              {integration.authenticationTypes.map((auth) => (
                <Tag key={auth} color="green">
                  {auth}
                </Tag>
              ))}
            </Space>
            <div style={{ marginTop: 8 }}>
              <Space>
                <Rate
                  disabled
                  defaultValue={integration.rating}
                  style={{ fontSize: 14 }}
                />
                <Text type="secondary">
                  ({integration.downloadCount} downloads)
                </Text>
              </Space>
            </div>
          </div>
        }
      />
    </Card>
  );

  const TemplateCard = ({ template }: { template: Template }) => (
    <Card
      hoverable
      style={{ marginBottom: 16 }}
      actions={[
        <Tooltip title="Use Template">
          <ThunderboltOutlined onClick={() => handleTemplateSelect(template)} />
        </Tooltip>,
      ]}
    >
      <Card.Meta
        title={
          <Space>
            {template.name}
            {template.isBuiltIn && <Tag color="orange">Built-in</Tag>}
          </Space>
        }
        description={
          <div>
            <Paragraph ellipsis={{ rows: 2 }}>{template.description}</Paragraph>
            <Space wrap>
              <Tag color="purple">{template.category}</Tag>
              {template.authenticationTypes.map((auth) => (
                <Tag key={auth} color="green">
                  {auth}
                </Tag>
              ))}
            </Space>
          </div>
        }
      />
    </Card>
  );

  const SubmissionCard = ({
    submission,
  }: {
    submission: ConnectorSubmission;
  }) => (
    <Card style={{ marginBottom: 16 }}>
      <Card.Meta
        title={
          <Space>
            {submission.name}
            <Tag
              color={
                submission.status === "approved"
                  ? "green"
                  : submission.status === "rejected"
                    ? "red"
                    : submission.status === "review_pending"
                      ? "orange"
                      : "blue"
              }
            >
              {submission.status.replace("_", " ")}
            </Tag>
          </Space>
        }
        description={
          <div>
            <Paragraph ellipsis={{ rows: 2 }}>
              {submission.description}
            </Paragraph>
            <Space>
              <Text type="secondary">
                Submitted:{" "}
                {new Date(submission.submittedAt).toLocaleDateString()}
              </Text>
              {submission.securityScanResults && (
                <Tag
                  color={
                    submission.securityScanResults.status === "passed"
                      ? "green"
                      : "orange"
                  }
                >
                  Security: {submission.securityScanResults.status}
                </Tag>
              )}
            </Space>
          </div>
        }
      />
    </Card>
  );

  const TestResultCard = ({ result }: { result: TestResult }) => (
    <Card style={{ marginBottom: 16 }} size="small">
      <Space direction="vertical" style={{ width: "100%" }}>
        <Space>
          <Text strong>{result.testType.replace("_", " ").toUpperCase()}</Text>
          <Badge
            status={
              result.status === "passed"
                ? "success"
                : result.status === "failed"
                  ? "error"
                  : result.status === "running"
                    ? "processing"
                    : "default"
            }
            text={result.status.toUpperCase()}
          />
          <Text type="secondary">
            {new Date(result.startedAt).toLocaleString()}
          </Text>
        </Space>
        {result.duration && (
          <Progress
            percent={
              result.status === "running"
                ? 50
                : result.status === "passed"
                  ? 100
                  : 0
            }
            size="small"
            status={result.status === "failed" ? "exception" : "normal"}
          />
        )}
      </Space>
    </Card>
  );

  return (
    <div style={{ padding: "24px" }}>
      <Title level={2}>
        <Space>
          <ApiOutlined />
          Integration Marketplace
        </Space>
      </Title>
      <Paragraph>
        Discover, install, and manage API integrations from our comprehensive
        marketplace. Choose from pre-built integrations, templates, community
        contributions, and test your connections.
      </Paragraph>

      <Tabs activeKey={activeTab} onChange={setActiveTab}>
        {/* Story 9.1: Integration Catalog */}
        <TabPane
          tab={
            <span>
              <AppstoreOutlined />
              Integration Catalog
              <Badge count={integrations.length} style={{ marginLeft: 8 }} />
            </span>
          }
          key="catalog"
        >
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card title="Filters" size="small">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <div>
                    <Text strong>Search</Text>
                    <Search
                      placeholder="Search integrations..."
                      onSearch={(value) => loadIntegrations({ search: value })}
                      style={{ marginTop: 8 }}
                    />
                  </div>
                  <div>
                    <Text strong>Category</Text>
                    <Select
                      placeholder="Select category"
                      allowClear
                      style={{ width: "100%", marginTop: 8 }}
                      onChange={(value) =>
                        loadIntegrations({ category: value as any })
                      }
                    >
                      {categories.map((cat) => (
                        <Option key={cat} value={cat}>
                          {cat}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Text strong>Authentication</Text>
                    <Select
                      placeholder="Select auth type"
                      allowClear
                      style={{ width: "100%", marginTop: 8 }}
                      onChange={(value) =>
                        loadIntegrations({ authType: value as any })
                      }
                    >
                      {authTypes.map((type) => (
                        <Option key={type} value={type}>
                          {type}
                        </Option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Text strong>Sort By</Text>
                    <Select
                      defaultValue="popularity"
                      style={{ width: "100%", marginTop: 8 }}
                      onChange={(value) =>
                        loadIntegrations({ sort: value as any })
                      }
                    >
                      <Option value="popularity">Most Popular</Option>
                      <Option value="rating">Highest Rated</Option>
                      <Option value="updated">Recently Updated</Option>
                      <Option value="name">Name</Option>
                    </Select>
                  </div>
                </Space>
              </Card>
            </Col>
            <Col span={18}>
              <Spin spinning={loading}>
                <Row gutter={[16, 16]}>
                  {integrations.map((integration) => (
                    <Col key={integration.id} xs={24} sm={12} lg={8}>
                      <IntegrationCard integration={integration} />
                    </Col>
                  ))}
                </Row>
                {integrations.length === 0 && !loading && (
                  <Empty description="No integrations found" />
                )}
              </Spin>
            </Col>
          </Row>
        </TabPane>

        {/* Story 9.2: Template System */}
        <TabPane
          tab={
            <span>
              <ThunderboltOutlined />
              Templates
              <Badge count={templates.length} style={{ marginLeft: 8 }} />
            </span>
          }
          key="templates"
        >
          <Row gutter={[16, 16]}>
            <Col span={6}>
              <Card title="Template Categories" size="small">
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Button type="text" block onClick={() => loadTemplates()}>
                    All Templates
                  </Button>
                  {Object.values(TemplateCategory).map((category) => (
                    <Button
                      key={category}
                      type="text"
                      block
                      onClick={() => loadTemplates(category)}
                    >
                      {category.replace("_", " ").toUpperCase()}
                    </Button>
                  ))}
                </Space>
              </Card>
            </Col>
            <Col span={18}>
              <Row gutter={[16, 16]}>
                {templates.map((template) => (
                  <Col key={template.id} xs={24} sm={12} lg={8}>
                    <TemplateCard template={template} />
                  </Col>
                ))}
              </Row>
              {templates.length === 0 && (
                <Empty description="No templates found" />
              )}
            </Col>
          </Row>
        </TabPane>

        {/* Story 9.3: Community Connectors */}
        <TabPane
          tab={
            <span>
              <TeamOutlined />
              Community
              <Badge
                count={
                  submissions.filter((s) => s.status === "review_pending")
                    .length
                }
                style={{ marginLeft: 8 }}
              />
            </span>
          }
          key="community"
        >
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setSubmissionModalVisible(true)}
              >
                Submit Connector
              </Button>
              <Button onClick={() => loadSubmissions()}>Refresh</Button>
            </Space>
          </div>

          <Row gutter={[16, 16]}>
            {submissions.map((submission) => (
              <Col key={submission.id} xs={24} sm={12} lg={8}>
                <SubmissionCard submission={submission} />
              </Col>
            ))}
          </Row>
          {submissions.length === 0 && (
            <Empty description="No community submissions found" />
          )}
        </TabPane>

        {/* Story 9.4: Testing Tools */}
        <TabPane
          tab={
            <span>
              <BugOutlined />
              Testing Tools
              <Badge
                count={testResults.filter((r) => r.status === "running").length}
                style={{ marginLeft: 8 }}
              />
            </span>
          }
          key="testing"
        >
          <Alert
            message="Integration Testing"
            description="Test your integrations for connectivity, performance, security, and schema compliance."
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Row gutter={[16, 16]}>
            <Col span={12}>
              <Card title="Your Installations" size="small">
                <Space direction="vertical" style={{ width: "100%" }}>
                  {installations.map((installation) => (
                    <div
                      key={installation.id}
                      style={{
                        padding: "8px 0",
                        borderBottom: "1px solid #f0f0f0",
                      }}
                    >
                      <Space>
                        <Text strong>{installation.name}</Text>
                        <Tag
                          color={
                            installation.status === "active" ? "green" : "red"
                          }
                        >
                          {installation.status}
                        </Tag>
                        <Button
                          size="small"
                          icon={<PlayCircleOutlined />}
                          onClick={() =>
                            handleRunTest(installation.integrationId, "suite")
                          }
                        >
                          Test All
                        </Button>
                      </Space>
                    </div>
                  ))}
                  {installations.length === 0 && (
                    <Text type="secondary">
                      No installations found. Install some integrations first.
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
            <Col span={12}>
              <Card title="Recent Test Results" size="small">
                <Space direction="vertical" style={{ width: "100%" }}>
                  {testResults.slice(0, 5).map((result) => (
                    <TestResultCard key={result.id} result={result} />
                  ))}
                  {testResults.length === 0 && (
                    <Text type="secondary">
                      No test results yet. Run some tests to see results here.
                    </Text>
                  )}
                </Space>
              </Card>
            </Col>
          </Row>
        </TabPane>
      </Tabs>

      {/* Community Submission Modal */}
      <Modal
        title="Submit Community Connector"
        open={submissionModalVisible}
        onCancel={() => setSubmissionModalVisible(false)}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmitConnector}>
          <Form.Item
            name="name"
            label="Connector Name"
            rules={[{ required: true, message: "Please enter connector name" }]}
          >
            <Input placeholder="Enter connector name" />
          </Form.Item>

          <Form.Item
            name="description"
            label="Description"
            rules={[{ required: true, message: "Please enter description" }]}
          >
            <Input.TextArea rows={3} placeholder="Describe your connector" />
          </Form.Item>

          <Form.Item
            name="category"
            label="Category"
            rules={[{ required: true, message: "Please select a category" }]}
          >
            <Select placeholder="Select category">
              {Object.values(IntegrationCategory).map((cat) => (
                <Option key={cat} value={cat}>
                  {cat}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item name="repositoryUrl" label="Repository URL (Optional)">
            <Input placeholder="https://github.com/user/repo" />
          </Form.Item>

          <Form.Item
            name="license"
            label="License"
            rules={[{ required: true, message: "Please enter license" }]}
          >
            <Input placeholder="MIT, Apache 2.0, etc." />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                Submit for Review
              </Button>
              <Button onClick={() => setSubmissionModalVisible(false)}>
                Cancel
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Integration Details Modal */}
      <Modal
        title={selectedIntegration?.name}
        open={!!selectedIntegration}
        onCancel={() => setSelectedIntegration(null)}
        footer={[
          <Button key="close" onClick={() => setSelectedIntegration(null)}>
            Close
          </Button>,
          <Button
            key="install"
            type="primary"
            onClick={() => {
              if (selectedIntegration) {
                handleInstallIntegration(selectedIntegration.id, {});
                setSelectedIntegration(null);
              }
            }}
          >
            Install Integration
          </Button>,
        ]}
        width={800}
      >
        {selectedIntegration && (
          <Space direction="vertical" style={{ width: "100%" }}>
            <div>
              <Text strong>Category:</Text> {selectedIntegration.category}
            </div>
            <div>
              <Text strong>Description:</Text> {selectedIntegration.description}
            </div>
            <div>
              <Text strong>Authentication:</Text>
              <Space wrap style={{ marginLeft: 8 }}>
                {selectedIntegration.authenticationTypes.map((auth) => (
                  <Tag key={auth} color="green">
                    {auth}
                  </Tag>
                ))}
              </Space>
            </div>
            <div>
              <Text strong>Features:</Text>
              <ul>
                {selectedIntegration.features.map((feature, index) => (
                  <li key={index}>{feature}</li>
                ))}
              </ul>
            </div>
            <div>
              <Text strong>Rating:</Text>
              <Rate
                disabled
                value={selectedIntegration.rating}
                style={{ marginLeft: 8 }}
              />
              <Text type="secondary">
                ({selectedIntegration.downloadCount} downloads)
              </Text>
            </div>
            <Divider />
            <div>
              <Text strong>Documentation:</Text>
              <Paragraph>{selectedIntegration.documentation}</Paragraph>
            </div>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default Integrations;
