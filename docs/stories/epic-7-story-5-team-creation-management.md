# Epic 7 Story 5: Team Creation and Management - Brownfield Addition

## User Story

As a user,
I want to create and manage teams for collaboration,
So that I can work with other users on shared mapping configurations and processing jobs.

## Story Context

**Existing System Integration:**

- Integrates with: Existing user management system and resource ownership model
- Technology: React/TypeScript frontend, Node.js/Express API, PostgreSQL database
- Follows pattern: Existing user management patterns and resource sharing patterns
- Touch points: User repository, mapping configurations, processing jobs, authentication system

## Acceptance Criteria

**Functional Requirements:**

1. Users can create teams with name, description, and member management
2. Team creators become team administrators by default
3. Team administrators can invite other users to join the team
4. Team members can be assigned roles (admin, member, viewer) within the team
5. Teams can own shared mapping configurations and processing jobs
6. Team administrators can remove members and transfer ownership

**Integration Requirements:** 4. Existing user authentication and role system continues to work unchanged 5. Team-based access control integrates with existing RBAC system 6. Resource ownership model extends to support team ownership

**Quality Requirements:** 7. Team invitation system is secure and prevents unauthorized access 8. Team membership changes are audited and logged 9. Team resource sharing respects individual user permissions 10. Team management interface is intuitive and responsive

## Technical Notes

- **Integration Approach:** New team management system that extends existing user and resource management
- **Existing Pattern Reference:** Follow existing user management patterns and resource ownership patterns
- **Key Constraints:** Must maintain compatibility with existing user authentication and resource access patterns

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Team system conflicts with existing resource ownership model
- **Mitigation:** Careful database design and comprehensive testing of resource access
- **Rollback:** Remove team-related tables and features if conflicts arise

**Compatibility Verification:**

- [ ] No breaking changes to existing user and resource APIs
- [ ] Database schema changes are additive only
- [ ] UI changes follow existing Ant Design patterns
- [ ] Performance impact is negligible

## Implementation Details

### Database Schema Enhancement

```sql
-- Teams table
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true
);

-- Team members table
CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member', -- admin, member, viewer
    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(team_id, user_id)
);

-- Team invitations table
CREATE TABLE team_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
    invited_email VARCHAR(255) NOT NULL,
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'member',
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    accepted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Update existing tables to support team ownership
ALTER TABLE mapping_configurations
ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

ALTER TABLE processing_jobs
ADD COLUMN team_id UUID REFERENCES teams(id) ON DELETE SET NULL;

-- Create indexes
CREATE INDEX idx_teams_created_by ON teams(created_by);
CREATE INDEX idx_team_members_team_id ON team_members(team_id);
CREATE INDEX idx_team_members_user_id ON team_members(user_id);
CREATE INDEX idx_team_invitations_token ON team_invitations(token);
CREATE INDEX idx_team_invitations_email ON team_invitations(invited_email);
```

### Team Management Types

```typescript
export interface Team {
  id: string;
  name: string;
  description?: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
  memberCount?: number;
}

export interface TeamMember {
  id: string;
  teamId: string;
  userId: string;
  role: TeamRole;
  invitedBy?: string;
  joinedAt: Date;
  isActive: boolean;
  user?: User;
}

export enum TeamRole {
  ADMIN = "admin",
  MEMBER = "member",
  VIEWER = "viewer",
}

export interface TeamInvitation {
  id: string;
  teamId: string;
  invitedEmail: string;
  invitedBy: string;
  role: TeamRole;
  token: string;
  expiresAt: Date;
  acceptedAt?: Date;
  createdAt: Date;
  team?: Team;
  inviter?: User;
}

export interface TeamCreateRequest {
  name: string;
  description?: string;
}

export interface TeamInviteRequest {
  teamId: string;
  email: string;
  role: TeamRole;
}
```

### Team Repository

```typescript
export class TeamRepository {
  constructor(private db: DatabaseService) {}

  async createTeam(
    teamData: TeamCreateRequest,
    createdBy: string,
  ): Promise<Team> {
    const query = `
      INSERT INTO teams (name, description, created_by)
      VALUES ($1, $2, $3)
      RETURNING *
    `;

    const values = [teamData.name, teamData.description, createdBy];
    const result = await this.db.query(query, values);

    const team = this.mapRowToTeam(result.rows[0]);

    // Add creator as admin
    await this.addMember(team.id, createdBy, TeamRole.ADMIN, createdBy);

    return team;
  }

  async getTeamById(teamId: string): Promise<Team | null> {
    const query = "SELECT * FROM teams WHERE id = $1 AND is_active = true";
    const result = await this.db.query(query, [teamId]);

    return result.rows.length > 0 ? this.mapRowToTeam(result.rows[0]) : null;
  }

  async getUserTeams(userId: string): Promise<Team[]> {
    const query = `
      SELECT t.* FROM teams t
      INNER JOIN team_members tm ON t.id = tm.team_id
      WHERE tm.user_id = $1 AND tm.is_active = true AND t.is_active = true
      ORDER BY t.created_at DESC
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows.map((row) => this.mapRowToTeam(row));
  }

  async addMember(
    teamId: string,
    userId: string,
    role: TeamRole,
    invitedBy: string,
  ): Promise<TeamMember> {
    const query = `
      INSERT INTO team_members (team_id, user_id, role, invited_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (team_id, user_id) 
      DO UPDATE SET is_active = true, role = $3, joined_at = NOW()
      RETURNING *
    `;

    const values = [teamId, userId, role, invitedBy];
    const result = await this.db.query(query, values);

    return this.mapRowToTeamMember(result.rows[0]);
  }

  async removeMember(teamId: string, userId: string): Promise<void> {
    const query = `
      UPDATE team_members 
      SET is_active = false 
      WHERE team_id = $1 AND user_id = $2
    `;

    await this.db.query(query, [teamId, userId]);
  }

  async updateMemberRole(
    teamId: string,
    userId: string,
    role: TeamRole,
  ): Promise<TeamMember> {
    const query = `
      UPDATE team_members 
      SET role = $1 
      WHERE team_id = $2 AND user_id = $3 AND is_active = true
      RETURNING *
    `;

    const result = await this.db.query(query, [role, teamId, userId]);
    return this.mapRowToTeamMember(result.rows[0]);
  }

  async getTeamMembers(teamId: string): Promise<TeamMember[]> {
    const query = `
      SELECT tm.*, u.name, u.email, u.username
      FROM team_members tm
      INNER JOIN users u ON tm.user_id = u.id
      WHERE tm.team_id = $1 AND tm.is_active = true
      ORDER BY tm.joined_at ASC
    `;

    const result = await this.db.query(query, [teamId]);
    return result.rows.map((row) => this.mapRowToTeamMemberWithUser(row));
  }

  async createInvitation(
    invitation: Omit<TeamInvitation, "id" | "createdAt" | "token">,
  ): Promise<TeamInvitation> {
    const token = this.generateInvitationToken();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const query = `
      INSERT INTO team_invitations (team_id, invited_email, invited_by, role, token, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const values = [
      invitation.teamId,
      invitation.invitedEmail,
      invitation.invitedBy,
      invitation.role,
      token,
      expiresAt,
    ];

    const result = await this.db.query(query, values);
    return this.mapRowToTeamInvitation(result.rows[0]);
  }

  async getInvitationByToken(token: string): Promise<TeamInvitation | null> {
    const query = `
      SELECT ti.*, t.name as team_name
      FROM team_invitations ti
      INNER JOIN teams t ON ti.team_id = t.id
      WHERE ti.token = $1 AND ti.accepted_at IS NULL AND ti.expires_at > NOW()
    `;

    const result = await this.db.query(query, [token]);
    return result.rows.length > 0
      ? this.mapRowToTeamInvitation(result.rows[0])
      : null;
  }

  async acceptInvitation(token: string, userId: string): Promise<void> {
    const client = await this.db.getClient();

    try {
      await client.query("BEGIN");

      // Get invitation
      const invitationQuery =
        "SELECT * FROM team_invitations WHERE token = $1 FOR UPDATE";
      const invitationResult = await client.query(invitationQuery, [token]);

      if (invitationResult.rows.length === 0) {
        throw new Error("Invalid or expired invitation");
      }

      const invitation = this.mapRowToTeamInvitation(invitationResult.rows[0]);

      // Add member to team
      await this.addMember(
        invitation.teamId,
        userId,
        invitation.role,
        invitation.invitedBy,
      );

      // Mark invitation as accepted
      const acceptQuery = `
        UPDATE team_invitations 
        SET accepted_at = NOW() 
        WHERE id = $1
      `;
      await client.query(acceptQuery, [invitation.id]);

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private generateInvitationToken(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private mapRowToTeam(row: any): Team {
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      isActive: row.is_active,
    };
  }

  private mapRowToTeamMember(row: any): TeamMember {
    return {
      id: row.id,
      teamId: row.team_id,
      userId: row.user_id,
      role: row.role as TeamRole,
      invitedBy: row.invited_by,
      joinedAt: row.joined_at,
      isActive: row.is_active,
    };
  }

  private mapRowToTeamMemberWithUser(row: any): TeamMember {
    return {
      ...this.mapRowToTeamMember(row),
      user: {
        id: row.user_id,
        name: row.name,
        email: row.email,
        username: row.username,
      } as User,
    };
  }

  private mapRowToTeamInvitation(row: any): TeamInvitation {
    return {
      id: row.id,
      teamId: row.team_id,
      invitedEmail: row.invited_email,
      invitedBy: row.invited_by,
      role: row.role as TeamRole,
      token: row.token,
      expiresAt: row.expires_at,
      acceptedAt: row.accepted_at,
      createdAt: row.created_at,
    };
  }
}
```

### Team Controller

```typescript
export class TeamController {
  constructor(
    private teamRepository: TeamRepository,
    private userRepository: UserRepository,
    private emailService: EmailService,
  ) {}

  async createTeam(req: Request, res: Response) {
    const userId = req.user.id;
    const { name, description } = req.body;

    const team = await this.teamRepository.createTeam(
      { name, description },
      userId,
    );

    res.status(201).json({ team });
  }

  async getUserTeams(req: Request, res: Response) {
    const userId = req.user.id;

    const teams = await this.teamRepository.getUserTeams(userId);

    res.json({ teams });
  }

  async getTeam(req: Request, res: Response) {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is member of the team
    const isMember = await this.teamRepository.isTeamMember(teamId, userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    const team = await this.teamRepository.getTeamById(teamId);
    if (!team) {
      return res.status(404).json({ error: "Team not found" });
    }

    res.json({ team });
  }

  async inviteMember(req: Request, res: Response) {
    const { teamId } = req.params;
    const { email, role } = req.body;
    const inviterId = req.user.id;

    // Check if user is team admin
    const isAdmin = await this.teamRepository.isTeamAdmin(teamId, inviterId);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only team admins can invite members" });
    }

    // Check if user is already a member
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      const isMember = await this.teamRepository.isTeamMember(
        teamId,
        existingUser.id,
      );
      if (isMember) {
        return res.status(400).json({ error: "User is already a team member" });
      }
    }

    // Create invitation
    const invitation = await this.teamRepository.createInvitation({
      teamId,
      invitedEmail: email,
      invitedBy: inviterId,
      role,
    });

    // Send invitation email
    await this.emailService.sendTeamInvitation(email, invitation);

    res.status(201).json({ invitation });
  }

  async acceptInvitation(req: Request, res: Response) {
    const { token } = req.params;
    const userId = req.user.id;

    try {
      await this.teamRepository.acceptInvitation(token, userId);
      res.json({ message: "Successfully joined team" });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async getTeamMembers(req: Request, res: Response) {
    const { teamId } = req.params;
    const userId = req.user.id;

    // Check if user is member of the team
    const isMember = await this.teamRepository.isTeamMember(teamId, userId);
    if (!isMember) {
      return res.status(403).json({ error: "Access denied" });
    }

    const members = await this.teamRepository.getTeamMembers(teamId);

    res.json({ members });
  }

  async updateMemberRole(req: Request, res: Response) {
    const { teamId, memberId } = req.params;
    const { role } = req.body;
    const requesterId = req.user.id;

    // Check if requester is team admin
    const isAdmin = await this.teamRepository.isTeamAdmin(teamId, requesterId);
    if (!isAdmin) {
      return res
        .status(403)
        .json({ error: "Only team admins can update member roles" });
    }

    const updatedMember = await this.teamRepository.updateMemberRole(
      teamId,
      memberId,
      role,
    );

    res.json({ member: updatedMember });
  }

  async removeMember(req: Request, res: Response) {
    const { teamId, memberId } = req.params;
    const requesterId = req.user.id;

    // Check if requester is team admin or removing themselves
    const isAdmin = await this.teamRepository.isTeamAdmin(teamId, requesterId);
    const isSelf = requesterId === memberId;

    if (!isAdmin && !isSelf) {
      return res.status(403).json({ error: "Access denied" });
    }

    await this.teamRepository.removeMember(teamId, memberId);

    res.json({ message: "Member removed successfully" });
  }
}
```

### Frontend Team Management

```typescript
// Team management component
const TeamManagement: React.FC = () => {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const response = await teamService.getUserTeams();
      setTeams(response.data.teams);
    } catch (error) {
      message.error('Failed to load teams');
    }
  };

  const handleCreateTeam = async (teamData: TeamCreateRequest) => {
    try {
      await teamService.createTeam(teamData);
      message.success('Team created successfully');
      setShowCreateModal(false);
      loadTeams();
    } catch (error) {
      message.error('Failed to create team');
    }
  };

  const handleInviteMember = async (inviteData: TeamInviteRequest) => {
    try {
      await teamService.inviteMember(inviteData);
      message.success('Invitation sent successfully');
      setShowInviteModal(false);
    } catch (error) {
      message.error('Failed to send invitation');
    }
  };

  return (
    <div className="team-management">
      <div className="team-header">
        <h2>My Teams</h2>
        <Button
          type="primary"
          onClick={() => setShowCreateModal(true)}
        >
          Create Team
        </Button>
      </div>

      <Row gutter={[16, 16]}>
        {teams.map(team => (
          <Col key={team.id} xs={24} sm={12} lg={8}>
            <Card
              title={team.name}
              extra={
                <Button
                  type="link"
                  onClick={() => setSelectedTeam(team)}
                >
                  Manage
                </Button>
              }
            >
              <p>{team.description || 'No description'}</p>
              <p>Members: {team.memberCount || 0}</p>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Create Team Modal */}
      <Modal
        title="Create New Team"
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        footer={null}
      >
        <CreateTeamForm
          onSubmit={handleCreateTeam}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>

      {/* Team Details Modal */}
      <Modal
        title={selectedTeam?.name}
        open={!!selectedTeam}
        onCancel={() => setSelectedTeam(null)}
        footer={null}
        width={800}
      >
        {selectedTeam && (
          <TeamDetails
            team={selectedTeam}
            onInvite={() => setShowInviteModal(true)}
            onUpdate={loadTeams}
          />
        )}
      </Modal>

      {/* Invite Member Modal */}
      <Modal
        title="Invite Team Member"
        open={showInviteModal}
        onCancel={() => setShowInviteModal(false)}
        footer={null}
      >
        <InviteMemberForm
          teamId={selectedTeam?.id || ''}
          onSubmit={handleInviteMember}
          onCancel={() => setShowInviteModal(false)}
        />
      </Modal>
    </div>
  );
};
```

## Testing Requirements

### Unit Tests

- Team creation and management testing
- Team member invitation testing
- Team role management testing
- Team resource access testing

### Integration Tests

- End-to-end team collaboration flow testing
- Database integration testing
- Email invitation system testing
- Resource sharing within teams testing

### Security Tests

- Team invitation security testing
- Unauthorized team access testing
- Team role permission testing
- Resource isolation between teams testing

## Success Metrics

- Team creation success rate > 95%
- Team invitation acceptance rate > 70%
- Team collaboration efficiency improvement > 30%
- Resource sharing within teams > 80% adoption

---

_This story implements comprehensive team creation and management capabilities while maintaining full compatibility with the existing Atlas2 user management and resource access systems._
