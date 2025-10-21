# Epic 7 Story 6: Team Resource Sharing and Collaboration - Brownfield Addition

## User Story

As a team member,
I want to share and collaborate on mapping configurations and processing jobs with my team,
So that we can work together efficiently and maintain consistent data transformation processes.

## Story Context

**Existing System Integration:**

- Integrates with: Existing mapping configurations, processing jobs, and team management system
- Technology: React/TypeScript frontend, Node.js/Express API, PostgreSQL database
- Follows pattern: Existing resource ownership patterns and team-based access control
- Touch points: Mapping configurations, processing jobs, team management, RBAC system

## Acceptance Criteria

**Functional Requirements:**

1. Team members can create mapping configurations owned by the team
2. Team members can create processing jobs using team-owned mapping configurations
3. Team members can view and edit team resources based on their team role
4. Team admins can manage resource ownership and transfer between personal and team
5. Team resources are clearly distinguished from personal resources in the UI
6. Activity tracking shows which team member modified shared resources

**Integration Requirements:** 4. Existing mapping and job functionality continues to work unchanged 5. Team-based resource access integrates with existing RBAC system 6. Resource ownership model supports both individual and team ownership

**Quality Requirements:** 7. Team resource permissions are enforced consistently across all interfaces 8. Resource sharing maintains data integrity and prevents conflicts 9. Team collaboration features are intuitive and don't complicate individual workflows 10. All team resource activities are audited and traceable

## Technical Notes

- **Integration Approach:** Extend existing resource ownership model to support team ownership
- **Existing Pattern Reference:** Follow existing mapping configuration and processing job patterns
- **Key Constraints:** Must maintain compatibility with existing individual resource ownership and access patterns

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Team resource sharing conflicts with existing individual resource access
- **Mitigation:** Careful permission design and comprehensive testing of resource access scenarios
- **Rollback:** Remove team ownership features if conflicts with existing resource access

**Compatibility Verification:**

- [ ] No breaking changes to existing mapping and job APIs
- [ ] Database schema changes are additive only
- [ ] UI changes follow existing resource management patterns
- [ ] Performance impact is negligible

## Implementation Details

### Enhanced Resource Ownership Model

```typescript
// Extend existing resource interfaces
interface ResourceOwner {
  type: "user" | "team";
  id: string;
  name: string;
}

interface MappingConfiguration {
  id: string;
  name: string;
  description?: string;
  owner: ResourceOwner;
  userId?: string; // Deprecated, kept for compatibility
  teamId?: string; // New field
  mappings: any[];
  transformationRules: any[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  lastModifiedBy: string;
}

interface ProcessingJob {
  id: string;
  fileName: string;
  fileSize: number;
  status: JobStatus;
  owner: ResourceOwner;
  userId?: string; // Deprecated, kept for compatibility
  teamId?: string; // New field
  mappingId?: string;
  progress: number;
  recordsProcessed: number;
  totalRecords?: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

### Enhanced Mapping Repository

```typescript
export class MappingRepository {
  // Existing methods...

  async createTeamMapping(
    mappingData: Omit<MappingConfiguration, "id" | "createdAt" | "updatedAt">,
  ): Promise<MappingConfiguration> {
    const query = `
      INSERT INTO mapping_configurations (
        name, description, team_id, mappings, created_by, is_active
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      mappingData.name,
      mappingData.description,
      mappingData.teamId,
      JSON.stringify(mappingData.mappings),
      mappingData.createdBy,
      mappingData.isActive,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToMapping(result.rows[0]);
  }

  async getAccessibleMappings(userId: string): Promise<MappingConfiguration[]> {
    const query = `
      SELECT DISTINCT mc.*,
        CASE 
          WHEN mc.user_id = $1 THEN 'user'
          WHEN mc.team_id IS NOT NULL THEN 'team'
          ELSE 'user'
        END as owner_type,
        COALESCE(u.name, t.name) as owner_name,
        COALESCE(u.id, t.id) as owner_id
      FROM mapping_configurations mc
      LEFT JOIN users u ON mc.user_id = u.id
      LEFT JOIN teams t ON mc.team_id = t.id
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1
      WHERE (mc.user_id = $1 OR tm.user_id = $1)
        AND mc.is_active = true
      ORDER BY mc.updated_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row) => this.mapRowToMappingWithOwner(row));
  }

  async updateMappingAccess(
    mappingId: string,
    newOwnerId: string,
    ownerType: "user" | "team",
    updatedBy: string,
  ): Promise<MappingConfiguration> {
    const client = await this.db.getClient();

    try {
      await client.query("BEGIN");

      // Check permissions
      const hasPermission = await this.checkUpdatePermission(
        client,
        mappingId,
        updatedBy,
      );
      if (!hasPermission) {
        throw new Error("Insufficient permissions to update mapping ownership");
      }

      // Update ownership
      const query = `
        UPDATE mapping_configurations 
        SET user_id = CASE WHEN $2 = 'user' THEN $3 ELSE NULL END,
            team_id = CASE WHEN $2 = 'team' THEN $3 ELSE NULL END,
            updated_at = NOW(),
            last_modified_by = $4
        WHERE id = $1
        RETURNING *
      `;

      const result = await client.query(query, [
        mappingId,
        ownerType,
        newOwnerId,
        updatedBy,
      ]);

      await client.query("COMMIT");
      return this.mapRowToMappingWithOwner(result.rows[0]);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async checkUpdatePermission(
    client: any,
    mappingId: string,
    userId: string,
  ): Promise<boolean> {
    // Check if user owns the mapping or is admin of the team that owns it
    const query = `
      SELECT 
        mc.user_id,
        mc.team_id,
        tm.role as team_role
      FROM mapping_configurations mc
      LEFT JOIN team_members tm ON mc.team_id = tm.team_id AND tm.user_id = $2
      WHERE mc.id = $1
    `;

    const result = await client.query(query, [mappingId, userId]);
    if (result.rows.length === 0) return false;

    const row = result.rows[0];

    // User owns the mapping
    if (row.user_id === userId) return true;

    // User is admin of the team that owns the mapping
    if (row.team_role === "admin") return true;

    return false;
  }

  private mapRowToMappingWithOwner(row: any): MappingConfiguration {
    const owner: ResourceOwner = {
      type: row.owner_type,
      id: row.owner_id,
      name: row.owner_name,
    };

    return {
      id: row.id,
      name: row.name,
      description: row.description,
      owner,
      userId: row.user_id,
      teamId: row.team_id,
      mappings: row.mappings || [],
      transformationRules: row.transformation_rules || [],
      isActive: row.is_active,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
      lastModifiedBy: row.last_modified_by,
    };
  }
}
```

### Enhanced Processing Job Repository

```typescript
export class ProcessingJobRepository {
  // Existing methods...

  async createTeamJob(
    jobData: Omit<ProcessingJob, "id" | "createdAt" | "updatedAt">,
  ): Promise<ProcessingJob> {
    const query = `
      INSERT INTO processing_jobs (
        user_id, team_id, file_name, file_size, mapping_id, created_by
      )
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      jobData.userId,
      jobData.teamId,
      jobData.fileName,
      jobData.fileSize,
      jobData.mappingId,
      jobData.createdBy,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToJob(result.rows[0]);
  }

  async getAccessibleJobs(
    userId: string,
    options: {
      status?: JobStatus;
      limit?: number;
      offset?: number;
    } = {},
  ): Promise<{ jobs: ProcessingJob[]; total: number }> {
    const { status, limit = 50, offset = 0 } = options;

    let whereClause = `
      WHERE (pj.user_id = $1 OR pj.team_id IN (
        SELECT tm.team_id FROM team_members tm WHERE tm.user_id = $1
      ))
    `;
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (status) {
      whereClause += ` AND pj.status = $${paramIndex++}`;
      queryParams.push(status);
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM processing_jobs pj
      ${whereClause}
    `;
    const countResult = await this.db.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get jobs with owner information
    const jobsQuery = `
      SELECT DISTINCT pj.*,
        CASE 
          WHEN pj.user_id = $1 THEN 'user'
          WHEN pj.team_id IS NOT NULL THEN 'team'
          ELSE 'user'
        END as owner_type,
        COALESCE(u.name, t.name) as owner_name,
        COALESCE(u.id, t.id) as owner_id
      FROM processing_jobs pj
      LEFT JOIN users u ON pj.user_id = u.id
      LEFT JOIN teams t ON pj.team_id = t.id
      LEFT JOIN team_members tm ON t.id = tm.team_id AND tm.user_id = $1
      ${whereClause}
      ORDER BY pj.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}
    `;

    queryParams.push(limit, offset);
    const jobsResult = await this.db.query(jobsQuery, queryParams);
    const jobs = jobsResult.rows.map((row) => this.mapRowToJobWithOwner(row));

    return { jobs, total };
  }

  private mapRowToJobWithOwner(row: any): ProcessingJob {
    const owner: ResourceOwner = {
      type: row.owner_type,
      id: row.owner_id,
      name: row.owner_name,
    };

    return {
      id: row.id,
      fileName: row.file_name,
      fileSize: row.file_size,
      status: row.status,
      owner,
      userId: row.user_id,
      teamId: row.team_id,
      mappingId: row.mapping_id,
      progress: row.progress,
      recordsProcessed: row.records_processed,
      totalRecords: row.total_records,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      createdBy: row.created_by,
    };
  }
}
```

### Enhanced Mapping Controller

```typescript
export class MappingController {
  constructor(
    private mappingRepository: MappingRepository,
    private teamRepository: TeamRepository,
  ) {}

  async createMapping(req: Request, res: Response) {
    const userId = req.user.id;
    const { name, description, mappings, ownerType, ownerId } = req.body;

    let mapping;

    if (ownerType === "team") {
      // Check if user is member of the team
      const isMember = await this.teamRepository.isTeamMember(ownerId, userId);
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this team" });
      }

      mapping = await this.mappingRepository.createTeamMapping({
        name,
        description,
        teamId: ownerId,
        mappings,
        createdBy: userId,
        isActive: true,
      });
    } else {
      // Personal mapping (existing logic)
      mapping = await this.mappingRepository.create({
        name,
        description,
        userId,
        mappings,
        createdBy: userId,
        isActive: true,
      });
    }

    res.status(201).json({ mapping });
  }

  async getMappings(req: Request, res: Response) {
    const userId = req.user.id;
    const { ownerType, teamId } = req.query;

    let mappings;

    if (ownerType === "team" && teamId) {
      // Check if user is member of the team
      const isMember = await this.teamRepository.isTeamMember(
        teamId as string,
        userId,
      );
      if (!isMember) {
        return res.status(403).json({ error: "Not a member of this team" });
      }

      mappings = await this.mappingRepository.getTeamMappings(teamId as string);
    } else {
      // Get all accessible mappings (personal + team)
      mappings = await this.mappingRepository.getAccessibleMappings(userId);
    }

    res.json({ mappings });
  }

  async updateMappingOwnership(req: Request, res: Response) {
    const { mappingId } = req.params;
    const { ownerType, ownerId } = req.body;
    const userId = req.user.id;

    try {
      const mapping = await this.mappingRepository.updateMappingAccess(
        mappingId,
        ownerId,
        ownerType,
        userId,
      );

      res.json({ mapping });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }
}
```

### Frontend Resource Management

```typescript
// Enhanced mapping list component
const MappingList: React.FC = () => {
  const [mappings, setMappings] = useState<MappingConfiguration[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedOwner, setSelectedOwner] = useState<{ type: 'user' | 'team'; id: string }>({ type: 'user', id: '' });
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    loadMappings();
    loadTeams();
  }, [selectedOwner]);

  const loadMappings = async () => {
    try {
      let response;

      if (selectedOwner.type === 'team') {
        response = await mappingService.getTeamMappings(selectedOwner.id);
      } else {
        response = await mappingService.getAccessibleMappings();
      }

      setMappings(response.data.mappings);
    } catch (error) {
      message.error('Failed to load mappings');
    }
  };

  const loadTeams = async () => {
    try {
      const response = await teamService.getUserTeams();
      setTeams(response.data.teams);
    } catch (error) {
      message.error('Failed to load teams');
    }
  };

  const handleCreateMapping = async (mappingData: any) => {
    try {
      await mappingService.createMapping({
        ...mappingData,
        ownerType: selectedOwner.type,
        ownerId: selectedOwner.type === 'team' ? selectedOwner.id : undefined
      });

      message.success('Mapping created successfully');
      setShowCreateModal(false);
      loadMappings();
    } catch (error) {
      message.error('Failed to create mapping');
    }
  };

  const getOwnerDisplay = (mapping: MappingConfiguration) => {
    if (mapping.owner.type === 'team') {
      return (
        <Tag color="blue">
          <TeamOutlined /> {mapping.owner.name}
        </Tag>
      );
    } else {
      return (
        <Tag color="green">
          <UserOutlined /> Personal
        </Tag>
      );
    }
  };

  return (
    <div className="mapping-list">
      <div className="mapping-header">
        <h2>Mapping Configurations</h2>
        <div className="mapping-controls">
          <Select
            value={selectedOwner.type}
            onChange={(value) => setSelectedOwner({ type: value, id: '' })}
            style={{ width: 150, marginRight: 16 }}
          >
            <Option value="user">Personal</Option>
            <Option value="team">Team</Option>
          </Select>

          {selectedOwner.type === 'team' && (
            <Select
              value={selectedOwner.id}
              onChange={(id) => setSelectedOwner({ type: 'team', id })}
              style={{ width: 200, marginRight: 16 }}
              placeholder="Select team"
            >
              {teams.map(team => (
                <Option key={team.id} value={team.id}>{team.name}</Option>
              ))}
            </Select>
          )}

          <Button
            type="primary"
            onClick={() => setShowCreateModal(true)}
          >
            Create Mapping
          </Button>
        </div>
      </div>

      <Table
        dataSource={mappings}
        rowKey="id"
        columns={[
          {
            title: 'Name',
            dataIndex: 'name',
            key: 'name'
          },
          {
            title: 'Owner',
            key: 'owner',
            render: (_, record) => getOwnerDisplay(record)
          },
          {
            title: 'Description',
            dataIndex: 'description',
            key: 'description'
          },
          {
            title: 'Created',
            dataIndex: 'createdAt',
            key: 'createdAt',
            render: (date) => new Date(date).toLocaleDateString()
          },
          {
            title: 'Actions',
            key: 'actions',
            render: (_, record) => (
              <Space>
                <Button type="link" size="small">
                  Edit
                </Button>
                <Button type="link" size="small">
                  Duplicate
                </Button>
                <PermissionGuard
                  permissions={[
                    { resource: 'mappings', action: 'delete' },
                    { resource: 'mappings', action: 'manage_team' }
                  ]}
                >
                  <Button type="link" danger size="small">
                    Delete
                  </Button>
                </PermissionGuard>
              </Space>
            )
          }
        ]}
      />

      <Modal
        title="Create Mapping Configuration"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
        width={800}
      >
        <CreateMappingForm
          teams={teams}
          selectedOwner={selectedOwner}
          onSubmit={handleCreateMapping}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
};
```

### Activity Tracking and Collaboration Features

```typescript
// Activity tracking for team resources
export class ActivityTracker {
  async logResourceActivity(
    userId: string,
    resourceType: 'mapping' | 'job',
    resourceId: string,
    action: string,
    metadata?: any
  ) {
    const query = `
      INSERT INTO activity_log (
        user_id, resource_type, resource_id, action, metadata, created_at
      )
      VALUES ($1, $2, $3, $4, $5, NOW())
    `;

    await this.db.query(query, [userId, resourceType, resourceId, action, metadata]);
  }

  async getResourceActivity(resourceId: string, limit = 50) {
    const query = `
      SELECT al.*, u.name as user_name, u.username
      FROM activity_log al
      INNER JOIN users u ON al.user_id = u.id
      WHERE al.resource_id = $1
      ORDER BY al.created_at DESC
      LIMIT $2
    `;

    const result = await this.db.query(query, [resourceId, limit]);
    return result.rows;
  }
}

// Collaboration features in frontend
const ResourceCollaboration: React.FC<{ resource: MappingConfiguration }> = ({ resource }) => {
  const [activities, setActivities] = useState([]);
  const [showActivity, setShowActivity] = useState(false);

  useEffect(() => {
    if (showActivity) {
      loadActivity();
    }
  }, [showActivity, resource.id]);

  const loadActivity = async () => {
    try {
      const response = await activityService.getResourceActivity(resource.id);
      setActivities(response.data.activities);
    } catch (error) {
      message.error('Failed to load activity');
    }
  };

  return (
    <div className="resource-collaboration">
      <div className="collaboration-header">
        <h3>Collaboration</h3>
        <Button
          type="link"
          onClick={() => setShowActivity(!showActivity)}
        >
          {showActivity ? 'Hide' : 'Show'} Activity
        </Button>
      </div>

      {resource.owner.type === 'team' && (
        <div className="team-info">
          <Tag color="blue">
            <TeamOutlined /> {resource.owner.name}
          </Tag>
          <span className="team-access">
            Shared with team members
          </span>
        </div>
      )}

      {showActivity && (
        <div className="activity-timeline">
          <Timeline>
            {activities.map((activity: any) => (
              <Timeline.Item key={activity.id}>
                <div>
                  <strong>{activity.user_name}</strong> {activity.action}
                  <br />
                  <small>{new Date(activity.created_at).toLocaleString()}</small>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </div>
      )}
    </div>
  );
};
```

## Testing Requirements

### Unit Tests

- Team resource creation and access testing
- Resource ownership transfer testing
- Permission enforcement testing
- Activity tracking testing

### Integration Tests

- End-to-end team collaboration flow testing
- Resource sharing between team members testing
- Permission inheritance testing
- Concurrent resource modification testing

### Security Tests

- Unauthorized resource access testing
- Resource ownership validation testing
- Team permission boundary testing
- Data isolation between teams testing

## Success Metrics

- Team resource creation adoption rate > 70%
- Resource sharing within teams > 80% of team resources
- Collaboration efficiency improvement > 40%
- Resource access permission violations < 1%

---

_This story implements comprehensive team resource sharing and collaboration capabilities while maintaining full compatibility with the existing Atlas2 resource management and access control systems._
