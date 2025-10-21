# Epic 7 Story 4: User Profile Management - Brownfield Addition

## User Story

As a logged-in user,
I want to manage my profile information and preferences,
So that I can keep my account details up to date and customize my experience.

## Story Context

**Existing System Integration:**

- Integrates with: Existing user repository and authentication system
- Technology: React/TypeScript frontend, Node.js/Express API, PostgreSQL database
- Follows pattern: Existing form components and user management patterns
- Touch points: User repository, authentication middleware, frontend store

## Acceptance Criteria

**Functional Requirements:**

1. User can view their profile information (name, email, username, role, join date)
2. User can update their name and username through a profile edit form
3. User can change their password with current password verification
4. User can view their recent activity and usage statistics
5. User can set preferences for notifications and display settings
6. User can deactivate their account with confirmation

**Integration Requirements:** 4. Existing user authentication system continues to work unchanged 5. Profile management integrates with existing user repository methods 6. Password changes follow existing security patterns and hashing

**Quality Requirements:** 7. Profile form validation ensures data integrity and format compliance 8. Password changes require current password verification for security 9. Account deactivation includes confirmation and grace period 10. All profile changes are logged for audit purposes

## Technical Notes

- **Integration Approach:** New React components that extend existing user management functionality
- **Existing Pattern Reference:** Follow existing form patterns from FileUpload.tsx and user repository patterns
- **Key Constraints:** Must maintain compatibility with existing user schema and authentication flow

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Profile changes conflict with existing authentication system
- **Mitigation:** Thorough testing of authentication flow after profile updates
- **Rollback:** Remove profile management components if conflicts arise

**Compatibility Verification:**

- [ ] No breaking changes to existing user APIs
- [ ] Database changes are additive only (if any)
- [ ] UI changes follow existing Ant Design patterns
- [ ] Performance impact is negligible

## Implementation Details

### Frontend Components

```typescript
// New component: src/components/profile/ProfileView.tsx
interface ProfileViewProps {
  user: User;
  onEdit: () => void;
  onChangePassword: () => void;
  onDeactivate: () => void;
}

// New component: src/components/profile/ProfileEdit.tsx
interface ProfileEditProps {
  user: User;
  onSave: (updates: Partial<User>) => void;
  onCancel: () => void;
}

interface ProfileFormData {
  name: string;
  username: string;
  email: string; // Read-only in edit form
}

// New component: src/components/profile/PasswordChange.tsx
interface PasswordChangeProps {
  userId: string;
  onSuccess: () => void;
  onCancel: () => void;
}

interface PasswordChangeData {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}
```

### API Endpoints

```typescript
// Extend existing auth controller
export class AuthController {
  // Existing methods...

  async getProfile(req: Request, res: Response) {
    const user = req.user;
    res.json({ user });
  }

  async updateProfile(req: Request, res: Response) {
    const userId = req.user.id;
    const { name, username } = req.body;

    // Validate input
    const updates = { name, username };

    const updatedUser = await this.userRepository.update(userId, updates);
    res.json({ user: updatedUser });
  }

  async changePassword(req: Request, res: Response) {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    // Verify current password
    const user = await this.userRepository.findById(userId);
    const isValidPassword = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isValidPassword) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userRepository.updatePassword(userId, hashedPassword);

    res.json({ message: "Password updated successfully" });
  }

  async deactivateAccount(req: Request, res: Response) {
    const userId = req.user.id;
    const { password } = req.body;

    // Verify password before deactivation
    const user = await this.userRepository.findById(userId);
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(400).json({ error: "Password is incorrect" });
    }

    // Deactivate account
    await this.userRepository.update(userId, { isActive: false });

    // Log out user
    // Clear tokens, etc.

    res.json({ message: "Account deactivated successfully" });
  }

  async getUserActivity(req: Request, res: Response) {
    const userId = req.user.id;

    // Get user statistics
    const stats = await this.getUserStatistics(userId);

    res.json({ stats });
  }

  private async getUserStatistics(userId: string) {
    // Query database for user activity
    const query = `
      SELECT 
        COUNT(DISTINCT pj.id) as total_jobs,
        COUNT(DISTINCT CASE WHEN pj.status = 'completed' THEN pj.id END) as completed_jobs,
        COUNT(DISTINCT CASE WHEN pj.status = 'failed' THEN pj.id END) as failed_jobs,
        SUM(pj.file_size) as total_file_size,
        MAX(pj.created_at) as last_job_date
      FROM processing_jobs pj
      WHERE pj.user_id = $1
    `;

    const result = await this.db.query(query, [userId]);
    return result.rows[0];
  }
}
```

### Database Schema Enhancement

```sql
-- Add user preferences table
CREATE TABLE user_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_notifications BOOLEAN NOT NULL DEFAULT true,
    push_notifications BOOLEAN NOT NULL DEFAULT true,
    theme VARCHAR(20) NOT NULL DEFAULT 'light',
    language VARCHAR(10) NOT NULL DEFAULT 'en',
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Add trigger for updated_at
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON user_preferences
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### User Preferences Management

```typescript
// Extend user interface
interface UserPreferences {
  emailNotifications: boolean;
  pushNotifications: boolean;
  theme: "light" | "dark";
  language: string;
  timezone: string;
}

// New repository method
export class UserRepository {
  // Existing methods...

  async getPreferences(userId: string): Promise<UserPreferences | null> {
    const query = "SELECT * FROM user_preferences WHERE user_id = $1";
    const result = await this.db.query(query, [userId]);

    if (result.rows.length === 0) {
      return this.createDefaultPreferences(userId);
    }

    return this.mapRowToPreferences(result.rows[0]);
  }

  async updatePreferences(
    userId: string,
    preferences: Partial<UserPreferences>,
  ): Promise<UserPreferences> {
    const fields = Object.keys(preferences);
    const values = fields.map((field) => preferences[field]);

    const setClause = fields
      .map((field, index) => `${this.camelToSnake(field)} = $${index + 2}`)
      .join(", ");

    const query = `
      INSERT INTO user_preferences (user_id, ${fields.map((f) => this.camelToSnake(f)).join(", ")})
      VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(", ")})
      ON CONFLICT (user_id) 
      DO UPDATE SET ${setClause}, updated_at = NOW()
      RETURNING *
    `;

    const result = await this.db.query(query, [userId, ...values]);
    return this.mapRowToPreferences(result.rows[0]);
  }

  private async createDefaultPreferences(
    userId: string,
  ): Promise<UserPreferences> {
    const defaults = {
      emailNotifications: true,
      pushNotifications: true,
      theme: "light" as const,
      language: "en",
      timezone: "UTC",
    };

    return this.updatePreferences(userId, defaults);
  }

  private mapRowToPreferences(row: any): UserPreferences {
    return {
      emailNotifications: row.email_notifications,
      pushNotifications: row.push_notifications,
      theme: row.theme,
      language: row.language,
      timezone: row.timezone,
    };
  }
}
```

### Frontend Profile Management

```typescript
// Profile management component
const ProfileManagement: React.FC = () => {
  const { user } = useAuth();
  const [editing, setEditing] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);

  useEffect(() => {
    loadPreferences();
  }, []);

  const loadPreferences = async () => {
    try {
      const prefs = await userService.getPreferences();
      setPreferences(prefs);
    } catch (error) {
      message.error('Failed to load preferences');
    }
  };

  const handleProfileUpdate = async (updates: Partial<User>) => {
    try {
      await userService.updateProfile(updates);
      message.success('Profile updated successfully');
      setEditing(false);
    } catch (error) {
      message.error('Failed to update profile');
    }
  };

  const handlePasswordChange = async (passwordData: PasswordChangeData) => {
    try {
      await userService.changePassword(passwordData);
      message.success('Password changed successfully');
      setChangingPassword(false);
    } catch (error) {
      message.error('Failed to change password');
    }
  };

  const handlePreferencesUpdate = async (newPreferences: Partial<UserPreferences>) => {
    try {
      const updated = await userService.updatePreferences(newPreferences);
      setPreferences(updated);
      message.success('Preferences updated successfully');
    } catch (error) {
      message.error('Failed to update preferences');
    }
  };

  return (
    <div className="profile-management">
      <Tabs defaultActiveKey="profile">
        <TabPane tab="Profile Information" key="profile">
          {editing ? (
            <ProfileEdit
              user={user}
              onSave={handleProfileUpdate}
              onCancel={() => setEditing(false)}
            />
          ) : (
            <ProfileView
              user={user}
              onEdit={() => setEditing(true)}
              onChangePassword={() => setChangingPassword(true)}
              onDeactivate={handleAccountDeactivation}
            />
          )}
        </TabPane>

        <TabPane tab="Preferences" key="preferences">
          <PreferencesForm
            preferences={preferences}
            onSave={handlePreferencesUpdate}
          />
        </TabPane>

        <TabPane tab="Activity" key="activity">
          <UserActivity userId={user.id} />
        </TabPane>
      </Tabs>

      <Modal
        title="Change Password"
        open={changingPassword}
        onCancel={() => setChangingPassword(false)}
        footer={null}
      >
        <PasswordChange
          userId={user.id}
          onSuccess={handlePasswordChange}
          onCancel={() => setChangingPassword(false)}
        />
      </Modal>
    </div>
  );
};
```

## Testing Requirements

### Unit Tests

- Profile form component testing
- Profile update API testing
- Password change functionality testing
- Preferences management testing

### Integration Tests

- End-to-end profile management flow testing
- Database integration testing
- Authentication flow after profile updates
- Preferences persistence testing

### Security Tests

- Password change security testing
- Profile update authorization testing
- Account deactivation security testing
- Input validation and sanitization testing

## Success Metrics

- Profile update success rate > 95%
- Password change completion rate > 90%
- Profile form validation error rate < 5%
- User satisfaction with profile management > 4.0/5.0

---

_This story implements comprehensive user profile management while maintaining full compatibility with the existing Atlas2 authentication system and user management features._
