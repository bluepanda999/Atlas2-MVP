# Epic 7 Story 2: User Login Interface - Brownfield Addition

## User Story

As a registered user,
I want to log in to Atlas2 through a web interface,
So that I can access my account and use the platform features.

## Story Context

**Existing System Integration:**

- Integrates with: Existing authentication middleware and JWT token system
- Technology: React/TypeScript frontend, Node.js/Express API, Redis session storage
- Follows pattern: Existing authentication patterns and API response structures
- Touch points: Authentication middleware, token service, user repository, auth store

## Acceptance Criteria

**Functional Requirements:**

1. User can access a login form from the application homepage
2. Login form accepts username/email and password credentials
3. Successful authentication redirects user to the main dashboard
4. Failed login displays appropriate error messages without revealing user existence
5. "Remember Me" option maintains session across browser sessions

**Integration Requirements:** 4. Existing authentication middleware continues to work unchanged 5. New login functionality integrates with existing JWT token system 6. Session management follows existing Redis storage patterns

**Quality Requirements:** 7. Login form is responsive and follows existing UI design patterns 8. Authentication process is secure and protects against common attacks 9. Loading states provide feedback during authentication 10. Error handling is user-friendly and informative

## Technical Notes

- **Integration Approach:** New React component that integrates with existing authentication middleware
- **Existing Pattern Reference:** Follow existing auth patterns from auth middleware and API key authentication
- **Key Constraints:** Must maintain compatibility with existing JWT tokens and session management

## Definition of Done

- [ ] Functional requirements met
- [ ] Integration requirements verified
- [ ] Existing functionality regression tested
- [ ] Code follows existing patterns and standards
- [ ] Tests pass (existing and new)
- [ ] Documentation updated if applicable

## Risk and Compatibility Check

**Minimal Risk Assessment:**

- **Primary Risk:** Login flow conflicts with existing API key authentication
- **Mitigation:** Ensure both authentication methods can coexist
- **Rollback:** Remove login component if conflicts with existing auth flow

**Compatibility Verification:**

- [ ] No breaking changes to existing authentication APIs
- [ ] JWT token structure remains unchanged
- [ ] UI changes follow existing Ant Design patterns
- [ ] Performance impact is negligible

## Implementation Details

### Frontend Components

```typescript
// New component: src/components/auth/LoginForm.tsx
interface LoginFormData {
  username: string; // Can be username or email
  password: string;
  rememberMe: boolean;
}

interface LoginFormProps {
  onSuccess: (user: User, token: string) => void;
  onRegisterClick: () => void;
  onForgotPasswordClick: () => void;
}
```

### API Integration

- POST /api/auth/login endpoint (extend existing auth controller)
- Use existing UserRepository.findByEmail() and UserRepository.findById() methods
- Generate JWT tokens using existing token service
- Store refresh tokens in Redis following existing patterns

### Authentication Flow

1. Validate input format
2. Check user credentials against database
3. Generate JWT access token and refresh token
4. Store refresh token in Redis
5. Return tokens and user information
6. Update last_login_at timestamp

### Security Considerations

- Rate limiting on login endpoint
- Account lockout after failed attempts
- Secure password comparison using existing bcrypt
- CSRF protection following existing patterns
- Secure token storage in httpOnly cookies

## Testing Requirements

### Unit Tests

- Login form component testing
- Authentication logic testing
- Token generation testing
- Error handling testing

### Integration Tests

- End-to-end login flow testing
- JWT token validation testing
- Session management testing
- Authentication middleware compatibility testing

### Security Tests

- Brute force attack protection testing
- Token security testing
- Session hijacking protection testing
- Input validation testing

## Success Metrics

- Login success rate > 95%
- Average login time < 3 seconds
- Failed login attempts < 5% of total attempts
- Zero security vulnerabilities in login flow

## Integration with Existing System

### Authentication Middleware Enhancement

```typescript
// Extend existing auth.middleware.ts to support both API key and JWT auth
export const authenticateRequest = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // Try API key authentication first (existing)
  const apiKeyResult = await authenticateApiKey(req);
  if (apiKeyResult.isValid) {
    return next();
  }

  // Try JWT authentication (new)
  const jwtResult = await authenticateJWT(req);
  if (jwtResult.isValid) {
    return next();
  }

  // No valid authentication found
  return res.status(401).json({ error: "Authentication required" });
};
```

### Frontend Store Integration

```typescript
// Extend existing auth store
interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  loginMethod: "api_key" | "jwt" | null; // New field
}
```

### Database Schema Compatibility

- No changes required to existing users table
- Leverage existing password hashing and user fields
- Add optional refresh_token tracking if needed

---

_This story enhances the existing Atlas2 authentication system with user login capabilities while maintaining full compatibility with the current API key authentication system._
