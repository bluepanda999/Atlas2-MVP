# Story 9.3: Community Connector Framework - Brownfield Addition

## User Story

As a community contributor,
I want to submit and share API connectors with the marketplace,
So that other users can benefit from my integrations and the ecosystem can grow organically.

## Story Context

**Existing System Integration:**

- Integrates with: Pre-built integration catalog (Story 9.1), integration template system (Story 9.2), authentication system (Epic 4), validation framework
- Technology: Node.js backend with Express.js, React frontend with TypeScript, security scanning tools, approval workflow system
- Follows pattern: Content moderation workflows, security validation, user reputation systems, notification systems
- Touch points: Community contribution API, connector validation service, approval workflow UI, contributor management system, notification service

## Acceptance Criteria

**Functional Requirements:**

1. Submit community connectors with OpenAPI specifications, configuration schemas, and documentation
2. Automated security scanning and validation of submitted connectors for vulnerabilities and compliance
3. Multi-stage approval workflow with automated checks, manual review, and community feedback
4. Contributor reputation system with ratings, badges, and contribution history tracking
5. Version management for community connectors with update notifications and changelog tracking

**Integration Requirements:** 4. Existing marketplace functionality remains unchanged (community connectors are separate category) 5. New functionality follows existing validation and security patterns 6. Integration with authentication system maintains current user management and permissions 7. Approval workflow uses existing notification and user management systems

**Quality Requirements:** 7. Automated security scanning completes within 5 minutes per submission 8. Manual review workflow processes submissions within 48 hours 9. Community connectors achieve 90%+ success rate after approval 10. All community contributions include comprehensive documentation and examples

## Technical Notes

- **Integration Approach:** Community framework extends existing marketplace with contribution workflow, security validation, and reputation management
- **Existing Pattern Reference:** Follow established content moderation patterns, security validation workflows, and user management systems
- **Key Constraints:** Must ensure security of community contributions, maintain quality standards, provide fair approval process

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested (marketplace, authentication, validation)
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (unit and integration tests)
- [ ] Security scanning and validation functional
- [ ] Documentation updated (contribution guidelines, approval process)

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Community submissions introducing security vulnerabilities or malicious code
- **Mitigation:** Comprehensive automated security scanning, manual review process, sandboxed testing environment, contributor verification
- **Rollback:** Disable community submissions, remove problematic connectors, maintain curated pre-built integrations

**Compatibility Verification:**

- [ ] No breaking changes to existing marketplace APIs
- [ ] Database changes are additive only (new community tables)
- [ ] Community service follows existing microservice patterns
- [ ] Security validation integrates with existing frameworks

## Story Points Estimation

**Estimation:** 21 points

- Security scanning and validation: 6 points
- Approval workflow system: 5 points
- Contributor reputation management: 4 points
- Community submission UI: 3 points
- Version management and updates: 2 points
- Testing and quality assurance: 1 point

## Dependencies

- Pre-built integration catalog (Story 9.1)
- Integration template system (Story 9.2)
- Authentication system (Epic 4)
- Security scanning tools
- Notification system
- User management system

## Testing Requirements

**Unit Tests:**

- Security scanning logic
- Approval workflow algorithms
- Reputation calculation logic
- Validation rule engines

**Integration Tests:**

- End-to-end submission workflow
- Security scanning integration
- Approval process flow
- Notification system integration

**Security Tests:**

- Malicious code detection
- Vulnerability scanning accuracy
- Sandboxed testing environment
- Access control verification

## Implementation Notes

**Community Connector Service:**

```typescript
interface CommunityConnectorService {
  submitConnector(submission: ConnectorSubmission): Promise<SubmissionResult>;
  reviewConnector(
    submissionId: string,
    review: ReviewRequest,
  ): Promise<ReviewResult>;
  approveConnector(submissionId: string): Promise<ApprovalResult>;
  rejectConnector(
    submissionId: string,
    reason: string,
  ): Promise<RejectionResult>;
  getConnectorSubmissions(
    status?: SubmissionStatus,
    filters?: SubmissionFilters,
  ): Promise<ConnectorSubmission[]>;
  updateConnectorVersion(
    connectorId: string,
    update: VersionUpdate,
  ): Promise<UpdateResult>;
}

interface ConnectorSubmission {
  id: string;
  contributorId: string;
  name: string;
  description: string;
  category: string;
  tags: string[];
  openApiSpec: OpenAPISpec;
  configurationSchema: JSONSchema;
  documentation: string;
  examples: ConnectorExample[];
  version: string;
  changelog: string;
  license: string;
  repositoryUrl?: string;
  status: SubmissionStatus;
  submittedAt: Date;
  securityScanResults?: SecurityScanResult;
  validationResults?: ValidationResult;
  reviews: Review[];
}

interface SecurityScanResult {
  status: "passed" | "warning" | "failed";
  vulnerabilities: Vulnerability[];
  securityIssues: SecurityIssue[];
  recommendations: string[];
  scannedAt: Date;
  scanVersion: string;
}

interface Review {
  id: string;
  reviewerId: string;
  submissionId: string;
  status: "pending" | "approved" | "rejected" | "needs_changes";
  comments: string;
  rating: number;
  reviewedAt: Date;
}

enum SubmissionStatus {
  DRAFT = "draft",
  SUBMITTED = "submitted",
  SCANNING = "scanning",
  REVIEW_PENDING = "review_pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  PUBLISHED = "published",
}
```

**Security Scanning Implementation:**

```typescript
class SecurityScanner {
  async scanConnector(
    submission: ConnectorSubmission,
  ): Promise<SecurityScanResult> {
    const vulnerabilities: Vulnerability[] = [];
    const securityIssues: SecurityIssue[] = [];
    const recommendations: string[] = [];

    // Scan OpenAPI specification for security issues
    const specIssues = await this.scanOpenAPISpec(submission.openApiSpec);
    vulnerabilities.push(...specIssues.vulnerabilities);
    securityIssues.push(...specIssues.securityIssues);

    // Scan configuration schema for injection risks
    const schemaIssues = await this.scanConfigurationSchema(
      submission.configurationSchema,
    );
    securityIssues.push(...schemaIssues);

    // Scan documentation for malicious content
    const docIssues = await this.scanDocumentation(submission.documentation);
    securityIssues.push(...docIssues);

    // Check for known vulnerable dependencies
    const depIssues = await this.scanDependencies(submission);
    vulnerabilities.push(...depIssues);

    // Validate authentication security
    const authIssues = await this.validateAuthenticationSecurity(
      submission.openApiSpec,
    );
    securityIssues.push(...authIssues);

    // Generate recommendations
    recommendations.push(...this.generateRecommendations(securityIssues));

    const status = this.determineScanStatus(vulnerabilities, securityIssues);

    return {
      status,
      vulnerabilities,
      securityIssues,
      recommendations,
      scannedAt: new Date(),
      scanVersion: process.env.SCAN_VERSION || "1.0.0",
    };
  }

  private async scanOpenAPISpec(
    spec: OpenAPISpec,
  ): Promise<{
    vulnerabilities: Vulnerability[];
    securityIssues: SecurityIssue[];
  }> {
    const vulnerabilities: Vulnerability[] = [];
    const securityIssues: SecurityIssue[] = [];

    // Check for insecure HTTP usage
    if (spec.servers) {
      for (const server of spec.servers) {
        if (server.url.startsWith("http://")) {
          securityIssues.push({
            type: "insecure_protocol",
            severity: "medium",
            description: `Server ${server.url} uses HTTP instead of HTTPS`,
            recommendation: "Use HTTPS for all server URLs",
          });
        }
      }
    }

    // Check for missing security definitions
    if (
      !spec.components?.securitySchemes ||
      Object.keys(spec.components.securitySchemes).length === 0
    ) {
      securityIssues.push({
        type: "missing_authentication",
        severity: "high",
        description: "No authentication schemes defined",
        recommendation: "Define appropriate authentication schemes",
      });
    }

    // Check for hardcoded secrets in examples
    const secrets = this.detectSecrets(JSON.stringify(spec));
    if (secrets.length > 0) {
      vulnerabilities.push({
        type: "hardcoded_secrets",
        severity: "critical",
        description: `Hardcoded secrets detected: ${secrets.join(", ")}`,
        location: "OpenAPI specification",
      });
    }

    return { vulnerabilities, securityIssues };
  }

  private detectSecrets(content: string): string[] {
    const secretPatterns = [
      /(?:sk_|pk_|sk_test_|pk_test_)[a-zA-Z0-9]{24,}/g, // Stripe keys
      /AIza[0-9A-Za-z\\-_]{35}/g, // Google API keys
      /ghp_[a-zA-Z0-9]{36}/g, // GitHub personal access tokens
      /xoxb-[0-9]{13}-[0-9]{13}-[a-zA-Z0-9]{24}/g, // Slack bot tokens
      /[a-zA-Z0-9]{32}:[a-zA-Z0-9]{32}/g, // Basic auth patterns
    ];

    const secrets: string[] = [];
    for (const pattern of secretPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        secrets.push(...matches);
      }
    }

    return [...new Set(secrets)]; // Remove duplicates
  }

  private determineScanStatus(
    vulnerabilities: Vulnerability[],
    securityIssues: SecurityIssue[],
  ): "passed" | "warning" | "failed" {
    const criticalVulns = vulnerabilities.filter(
      (v) => v.severity === "critical",
    );
    const highVulns = vulnerabilities.filter((v) => v.severity === "high");
    const highIssues = securityIssues.filter((i) => i.severity === "high");

    if (criticalVulns.length > 0 || highVulns.length > 0) {
      return "failed";
    }

    if (highIssues.length > 0 || vulnerabilities.length > 0) {
      return "warning";
    }

    return "passed";
  }
}
```

**Approval Workflow Service:**

```typescript
class ApprovalWorkflow {
  async processSubmission(submissionId: string): Promise<void> {
    const submission = await this.getSubmission(submissionId);

    // Update status to scanning
    await this.updateSubmissionStatus(submissionId, SubmissionStatus.SCANNING);

    // Run security scan
    const scanResult = await this.securityScanner.scanConnector(submission);
    await this.saveScanResult(submissionId, scanResult);

    if (scanResult.status === "failed") {
      await this.rejectConnector(
        submissionId,
        "Security scan failed: " +
          scanResult.vulnerabilities.map((v) => v.description).join(", "),
      );
      return;
    }

    // Update status to review pending
    await this.updateSubmissionStatus(
      submissionId,
      SubmissionStatus.REVIEW_PENDING,
    );

    // Find eligible reviewers
    const reviewers = await this.findReviewers(submission);

    // Assign reviewers
    for (const reviewer of reviewers) {
      await this.assignReviewer(submissionId, reviewer.id);
    }

    // Send notifications
    await this.notificationService.notifyReviewers(reviewers, submission);
  }

  async submitReview(
    submissionId: string,
    reviewerId: string,
    review: ReviewRequest,
  ): Promise<void> {
    // Save review
    await this.saveReview({
      id: generateId(),
      submissionId,
      reviewerId,
      status: review.status,
      comments: review.comments,
      rating: review.rating,
      reviewedAt: new Date(),
    });

    // Check if all reviews are complete
    const reviews = await this.getReviews(submissionId);
    const completedReviews = reviews.filter((r) => r.status !== "pending");

    if (completedReviews.length >= this.requiredReviews) {
      await this.evaluateSubmission(submissionId, completedReviews);
    }
  }

  private async evaluateSubmission(
    submissionId: string,
    reviews: Review[],
  ): Promise<void> {
    const approvedReviews = reviews.filter((r) => r.status === "approved");
    const rejectedReviews = reviews.filter((r) => r.status === "rejected");

    if (rejectedReviews.length >= this.rejectionThreshold) {
      await this.rejectConnector(
        submissionId,
        "Rejected by reviewer consensus",
      );
      return;
    }

    if (approvedReviews.length >= this.approvalThreshold) {
      await this.approveConnector(submissionId);
      return;
    }

    // If no consensus, request additional reviews
    await this.requestAdditionalReviews(submissionId);
  }

  private async approveConnector(submissionId: string): Promise<void> {
    const submission = await this.getSubmission(submissionId);

    // Update submission status
    await this.updateSubmissionStatus(submissionId, SubmissionStatus.APPROVED);

    // Create published connector
    const connector = await this.createPublishedConnector(submission);

    // Update contributor reputation
    await this.reputationService.awardContribution(submission.contributorId, {
      type: "connector_approved",
      connectorId: connector.id,
      points: this.calculateContributionPoints(submission),
    });

    // Send notifications
    await this.notificationService.notifyContributor(submission.contributorId, {
      type: "connector_approved",
      connectorId: connector.id,
      connectorName: connector.name,
    });

    // Notify subscribers
    await this.notifySubscribers(connector);
  }
}
```

**Community Submission UI:**

```typescript
const CommunityConnectorSubmission: React.FC = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [submission, setSubmission] = useState<Partial<ConnectorSubmission>>({});
  const [validationResults, setValidationResults] = useState<ValidationResult | null>(null);

  const steps = [
    {
      title: 'Basic Information',
      content: <BasicInfoStep submission={submission} onChange={setSubmission} />
    },
    {
      title: 'API Specification',
      content: <ApiSpecStep submission={submission} onChange={setSubmission} onValidation={setValidationResults} />
    },
    {
      title: 'Configuration',
      content: <ConfigurationStep submission={submission} onChange={setSubmission} />
    },
    {
      title: 'Documentation',
      content: <DocumentationStep submission={submission} onChange={setSubmission} />
    },
    {
      title: 'Review & Submit',
      content: <ReviewStep submission={submission} validationResults={validationResults} />
    }
  ];

  const handleSubmit = async () => {
    try {
      setLoading(true);

      const response = await api.post('/community/connectors/submit', {
        ...submission,
        status: 'submitted'
      });

      message.success('Connector submitted for review');
      history.push(`/community/submissions/${response.data.id}`);
    } catch (error) {
      message.error('Failed to submit connector');
    } finally {
      setLoading(false);
    }
  };

  const next = () => {
    setCurrentStep(currentStep + 1);
  };

  const prev = () => {
    setCurrentStep(currentStep - 1);
  };

  return (
    <div className="community-submission">
      <Card title="Submit Community Connector" style={{ marginBottom: 24 }}>
        <Steps current={currentStep}>
          {steps.map(item => (
            <Step key={item.title} title={item.title} />
          ))}
        </Steps>

        <div className="steps-content" style={{ marginTop: 24 }}>
          {steps[currentStep].content}
        </div>

        <div className="steps-action" style={{ marginTop: 24 }}>
          {currentStep > 0 && (
            <Button style={{ margin: '0 8px' }} onClick={prev}>
              Previous
            </Button>
          )}
          {currentStep < steps.length - 1 && (
            <Button type="primary" onClick={next}>
              Next
            </Button>
          )}
          {currentStep === steps.length - 1 && (
            <Button
              type="primary"
              loading={loading}
              onClick={handleSubmit}
              disabled={!validationResults?.valid}
            >
              Submit for Review
            </Button>
          )}
        </div>
      </Card>

      <SubmissionGuidelines />
    </div>
  );
};
```

**Database Schema:**

```sql
-- Community connector submissions
CREATE TABLE community_connector_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contributor_id UUID NOT NULL REFERENCES users(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[],
  open_api_spec JSONB NOT NULL,
  configuration_schema JSONB NOT NULL,
  documentation TEXT,
  examples JSONB,
  version VARCHAR(50) NOT NULL,
  changelog TEXT,
  license VARCHAR(100),
  repository_url VARCHAR(500),
  status VARCHAR(50) NOT NULL DEFAULT 'draft',
  submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security scan results
CREATE TABLE security_scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES community_connector_submissions(id),
  status VARCHAR(20) NOT NULL,
  vulnerabilities JSONB,
  security_issues JSONB,
  recommendations TEXT[],
  scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  scan_version VARCHAR(50)
);

-- Reviews
CREATE TABLE connector_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES community_connector_submissions(id),
  reviewer_id UUID NOT NULL REFERENCES users(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  comments TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  reviewed_at TIMESTAMP,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Published community connectors
CREATE TABLE published_connectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES community_connector_submissions(id),
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[],
  open_api_spec JSONB NOT NULL,
  configuration_schema JSONB NOT NULL,
  documentation TEXT,
  examples JSONB,
  version VARCHAR(50) NOT NULL,
  contributor_id UUID NOT NULL REFERENCES users(id),
  download_count INTEGER DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Contributor reputation
CREATE TABLE contributor_reputation (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  points INTEGER DEFAULT 0,
  level VARCHAR(50) DEFAULT 'beginner',
  badges TEXT[],
  contributions_count INTEGER DEFAULT 0,
  approved_contributions INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_community_submissions_status ON community_connector_submissions(status);
CREATE INDEX idx_community_submissions_contributor ON community_connector_submissions(contributor_id);
CREATE INDEX idx_published_connectors_category ON published_connectors(category);
CREATE INDEX idx_published_connectors_rating ON published_connectors(rating DESC);
CREATE INDEX idx_connector_reviews_submission ON connector_reviews(submission_id);
CREATE INDEX idx_connector_reviews_reviewer ON connector_reviews(reviewer_id);
```

**Contributor Reputation System:**

```typescript
interface ReputationService {
  calculateReputation(userId: string): Promise<ReputationScore>;
  awardContribution(
    userId: string,
    contribution: ContributionAward,
  ): Promise<void>;
  getLeaderboard(limit?: number): Promise<LeaderboardEntry[]>;
  getUserBadges(userId: string): Promise<Badge[]>;
}

interface ReputationScore {
  userId: string;
  points: number;
  level: ReputationLevel;
  badges: Badge[];
  contributionsCount: number;
  approvedContributions: number;
  averageRating: number;
}

enum ReputationLevel {
  BEGINNER = "beginner",
  CONTRIBUTOR = "contributor",
  TRUSTED = "trusted",
  EXPERT = "expert",
  MASTER = "master",
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  awardedAt: Date;
}

const REPUTATION_THRESHOLDS = {
  [ReputationLevel.BEGINNER]: 0,
  [ReputationLevel.CONTRIBUTOR]: 100,
  [ReputationLevel.TRUSTED]: 500,
  [ReputationLevel.EXPERT]: 1500,
  [ReputationLevel.MASTER]: 5000,
};

const CONTRIBUTION_POINTS = {
  connector_submitted: 10,
  connector_approved: 50,
  connector_highly_rated: 25,
  bug_report: 5,
  documentation_improvement: 15,
  community_help: 20,
};
```

## Success Criteria

- Community submission workflow processes submissions within 48 hours
- Automated security scanning detects 95%+ of common vulnerabilities
- Approved community connectors achieve 90%+ success rate
- Contributor reputation system drives quality contributions
- Community generates 10+ new connectors per month after launch

## Monitoring and Observability

**Metrics to Track:**

- Community submission volume and approval rate
- Security scan effectiveness and false positive rates
- Reviewer performance and turnaround times
- Contributor engagement and retention
- Community connector usage and quality metrics

**Alerts:**

- Security scan failures >20%
- Review backlog >50 submissions
- Approval time >72 hours
- Community connector success rate <85%

## Integration Points

**Upstream:**

- Community submission UI (contributor input)
- Authentication system (contributor verification)

**Downstream:**

- Security scanning service (vulnerability detection)
- Approval workflow (review process)
- Published connectors (marketplace integration)
- Notification system (status updates)

## Security Considerations

**Submission Security:**

- Comprehensive automated security scanning
- Sandboxed testing environment
- Manual security review for all submissions
- Regular vulnerability database updates
- Incident response for security issues

**Contributor Verification:**

- Identity verification for contributors
- Reputation-based trust levels
- Rate limiting for submissions
- Anti-spam and abuse detection
- Legal compliance and license verification

**Data Protection:**

- Secure storage of submission data
- Encryption of sensitive information
- Access control based on reputation levels
- Audit logging for all community activities
- GDPR and privacy regulation compliance
