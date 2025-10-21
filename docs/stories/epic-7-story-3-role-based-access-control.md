# Epic 7 Story 3: Role-Based Access Control Implementation - Brownfield Addition

## User Story

As a system administrator,
I want to implement role-based access control (RBAC) for Atlas2,
So that users can only access features and data appropriate to their role.

## Story Context

**Existing System Integration:**

- Integrates with: Existing user role enum and authentication middleware
- Technology: Node.js/Express API middleware, PostgreSQL database, React frontend
- Follows pattern: Existing authentication patterns and database schema
- Touch points: Authentication middleware, user repository, frontend components, API endpoints

## Acceptance Criteria

**Functional Requirements:**

1. System supports three roles: admin, user, and viewer (extending existing enum)
2. Admin users have full access to all system features and user management
3. User role can create and manage their own mappings and processing jobs
4. Viewer role can only view data and reports without modification capabilities
5. UI components render based on user role permissions
6. API endpoints enforce role-based access control

**Integration Requirements:** 4. Existing user authentication system continues to work unchanged 5. New RBAC functionality integrates with existing authentication middleware 6. Frontend permission checks align with backend API restrictions

**Quality Requirements:** 7. Role changes take effect immediately without requiring re-login 8. Permission checks are efficient and don't impact performance 9. Unauthorized access attempts are logged for security monitoring 10. Role assignments are auditable and traceable

## Technical Notes

- **Integration Approach:** Extend existing authentication middleware with role-based authorization
- **Existing Pattern Reference:** Follow existing auth middleware patterns and user role enum
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

- **Primary Risk:** RBAC implementation breaks existing functionality
- **Mitigation:** Incremental implementation with comprehensive testing
- **Rollback:** Remove RBAC middleware if conflicts arise

**Compatibility Verification:**

- [ ] No breaking changes to existing authentication APIs
- [ ] Database schema changes are additive only
- [ ] UI changes follow existing permission patterns
- [ ] Performance impact is negligible

## Implementation Details

### Database Schema Enhancement

```sql
-- Add viewer role to existing enum
ALTER TYPE user_role ADD VALUE 'viewer';

-- Add role assignment tracking table
CREATE TABLE user_role_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role NOT NULL,
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(user_id, is_active)
);
```

### Permission System

```typescript
// Extend existing UserRole enum
export enum UserRole {
  ADMIN = "admin",
  USER = "user",
  VIEWER = "viewer",
}

// New permission definitions
export interface Permission {
  resource: string;
  action: string;
  conditions?: Record<string, any>;
}

export const ROLE_PERMISSIONS = {
  [UserRole.ADMIN]: [
    { resource: "*", action: "*" }, // Full access
  ],
  [UserRole.USER]: [
    { resource: "mappings", action: ["create", "read", "update", "delete"] },
    { resource: "jobs", action: ["create", "read", "update", "delete"] },
    { resource: "files", action: ["create", "read", "delete"] },
    { resource: "profile", action: ["read", "update"] },
  ],
  [UserRole.VIEWER]: [
    { resource: "mappings", action: ["read"] },
    { resource: "jobs", action: ["read"] },
    { resource: "files", action: ["read"] },
    { resource: "profile", action: ["read"] },
  ],
};
```

### Authentication Middleware Enhancement

```typescript
// Extend existing auth.middleware.ts
export const authorize = (requiredPermissions: Permission[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user; // Set by existing auth middleware

    if (!user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const userPermissions = ROLE_PERMISSIONS[user.role] || [];
    const hasPermission = checkPermissions(
      userPermissions,
      requiredPermissions,
      user,
    );

    if (!hasPermission) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    next();
  };
};

function checkPermissions(
  userPermissions: Permission[],
  requiredPermissions: Permission[],
  user: User,
): boolean {
  // Implementation of permission checking logic
  return requiredPermissions.every((required) =>
    userPermissions.some((userPerm) =>
      matchesPermission(userPerm, required, user),
    ),
  );
}
```

### Frontend Permission Components

```typescript
// New component: src/components/auth/PermissionGuard.tsx
interface PermissionGuardProps {
  permissions: Permission[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export const PermissionGuard: React.FC<PermissionGuardProps> = ({
  permissions,
  children,
  fallback = null
}) => {
  const { user } = useAuth();

  const hasPermission = checkUserPermissions(user, permissions);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
};

// Hook for permission checking
export const usePermissions = () => {
  const { user } = useAuth();

  const hasPermission = (permissions: Permission[]) => {
    return checkUserPermissions(user, permissions);
  };

  return { hasPermission };
};
```

### API Endpoint Protection

```typescript
// Example: Protect mapping endpoints
router.get(
  "/mappings",
  authenticate, // Existing auth middleware
  authorize([{ resource: "mappings", action: "read" }]), // New RBAC middleware
  mappingController.getAllMappings,
);

router.post(
  "/mappings",
  authenticate,
  authorize([{ resource: "mappings", action: "create" }]),
  mappingController.createMapping,
);

router.delete(
  "/mappings/:id",
  authenticate,
  authorize([{ resource: "mappings", action: "delete" }]),
  mappingController.deleteMapping,
);
```

### UI Component Integration

```typescript
// Example: Conditional rendering based on permissions
const MappingActions: React.FC<{ mapping: Mapping }> = ({ mapping }) => {
  const { hasPermission } = usePermissions();

  return (
    <div>
      <PermissionGuard
        permissions={[{ resource: 'mappings', action: 'read' }]}
      >
        <Button onClick={() => viewMapping(mapping)}>View</Button>
      </PermissionGuard>

      <PermissionGuard
        permissions={[{ resource: 'mappings', action: 'update' }]}
      >
        <Button onClick={() => editMapping(mapping)}>Edit</Button>
      </PermissionGuard>

      <PermissionGuard
        permissions={[{ resource: 'mappings', action: 'delete' }]}
      >
        <Button danger onClick={() => deleteMapping(mapping)}>Delete</Button>
      </PermissionGuard>
    </div>
  );
};
```

## Testing Requirements

### Unit Tests

- Permission checking logic testing
- Role assignment functionality testing
- Middleware authorization testing
- Frontend permission component testing

### Integration Tests

- End-to-end RBAC flow testing
- API endpoint protection testing
- UI component rendering based on permissions
- Role change propagation testing

### Security Tests

- Privilege escalation attempt testing
- Unauthorized access attempt testing
- Permission bypass testing
- Role assignment security testing

## Success Metrics

- Unauthorized access attempts blocked: 100%
- Permission check performance: < 10ms per request
- Role change propagation time: < 5 seconds
- Zero privilege escalation vulnerabilities

## Administrative Features

### Role Management Interface

```typescript
// Admin interface for role management
interface RoleManagementProps {
  users: User[];
  onRoleChange: (userId: string, newRole: UserRole) => void;
}

const RoleManagement: React.FC<RoleManagementProps> = ({ users, onRoleChange }) => {
  return (
    <Table dataSource={users}>
      <Column title="User" dataIndex="name" key="name" />
      <Column title="Email" dataIndex="email" key="email" />
      <Column title="Current Role" dataIndex="role" key="role" />
      <Column
        title="Actions"
        key="actions"
        render={(text, record: User) => (
          <PermissionGuard permissions={[{ resource: 'users', action: 'update' }]}>
            <Select
              value={record.role}
              onChange={(newRole) => onRoleChange(record.id, newRole)}
            >
              <Option value={UserRole.USER}>User</Option>
              <Option value={UserRole.VIEWER}>Viewer</Option>
              <Option value={UserRole.ADMIN}>Admin</Option>
            </Select>
          </PermissionGuard>
        )}
      />
    </Table>
  );
};
```

---

_This story implements comprehensive role-based access control while maintaining full compatibility with the existing Atlas2 authentication system and user management features._
