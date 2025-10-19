# Atlas2 Coding Standards

**Version:** 1.0.0  
**Last Updated:** October 19, 2025  

## Table of Contents
1. [General Principles](#general-principles)
2. [TypeScript Standards](#typescript-standards)
3. [React Standards](#react-standards)
4. [Node.js/Backend Standards](#nodejsbackend-standards)
5. [Database Standards](#database-standards)
6. [Testing Standards](#testing-standards)
7. [Documentation Standards](#documentation-standards)

---

## General Principles

### 1. Code Quality
- **Readability First**: Code should be self-documenting
- **Consistency**: Follow established patterns throughout
- **Simplicity**: Favor simple solutions over complex ones
- **Maintainability**: Write code that's easy to modify and extend

### 2. Performance Considerations
- **Lazy Loading**: Load resources only when needed
- **Memory Management**: Avoid memory leaks and excessive allocations
- **Async Operations**: Use non-blocking operations where possible
- **Caching**: Implement appropriate caching strategies

### 3. Security Practices
- **Input Validation**: Validate all user inputs
- **Error Handling**: Don't expose sensitive information in errors
- **Authentication**: Implement proper authentication and authorization
- **Data Protection**: Encrypt sensitive data at rest and in transit

---

## TypeScript Standards

### 1. Type Definitions
```typescript
// Use interfaces for object shapes
interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

// Use enums for constants
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  VIEWER = 'viewer'
}

// Use generic types for reusable components
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  errors?: string[];
}
```

### 2. Function Signatures
```typescript
// Use explicit return types
function processFile(file: File, options: ProcessingOptions): Promise<ProcessingResult> {
  // Implementation
}

// Use optional parameters sparingly
function createUser(userData: CreateUserRequest, options?: CreateUserOptions): Promise<User> {
  // Implementation
}

// Use function overloads for complex signatures
function formatDate(date: Date): string;
function formatDate(date: string): string;
function formatDate(date: Date | string): string {
  // Implementation
}
```

### 3. Error Handling
```typescript
// Create custom error classes
class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

// Use Result pattern for operations that can fail
type Result<T, E = Error> = {
  success: true;
  data: T;
} | {
  success: false;
  error: E;
};

async function safeOperation<T>(
  operation: () => Promise<T>
): Promise<Result<T>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error as Error };
  }
}
```

---

## React Standards

### 1. Component Structure
```typescript
// Use functional components with hooks
interface UserProfileProps {
  userId: string;
  onUpdate?: (user: User) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  userId,
  onUpdate
}) => {
  // Hooks at the top
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { showError, showSuccess } = useNotifications();

  // Effects after hooks
  useEffect(() => {
    loadUser(userId);
  }, [userId]);

  // Event handlers
  const handleUpdate = useCallback(async (userData: Partial<User>) => {
    try {
      const updatedUser = await updateUser(userId, userData);
      setUser(updatedUser);
      showSuccess('User updated successfully');
      onUpdate?.(updatedUser);
    } catch (error) {
      showError('Failed to update user');
    }
  }, [userId, onUpdate, showError, showSuccess]);

  // Helper functions
  const loadUser = async (id: string) => {
    setLoading(true);
    try {
      const userData = await getUser(id);
      setUser(userData);
    } catch (error) {
      showError('Failed to load user');
    } finally {
      setLoading(false);
    }
  };

  // Conditional rendering
  if (loading) return <LoadingSpinner />;
  if (!user) return <ErrorMessage message="User not found" />;

  // JSX
  return (
    <div className="user-profile">
      <UserHeader user={user} onUpdate={handleUpdate} />
      <UserDetails user={user} />
    </div>
  );
};
```

### 2. Custom Hooks
```typescript
// Custom hook for API calls
interface UseApiResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useApi<T>(
  apiCall: () => Promise<T>,
  dependencies: React.DependencyList = []
): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await apiCall();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }, dependencies);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
```

### 3. State Management
```typescript
// Zustand store pattern
interface AppState {
  user: User | null;
  theme: 'light' | 'dark';
  notifications: Notification[];
  
  // Actions
  setUser: (user: User | null) => void;
  setTheme: (theme: 'light' | 'dark') => void;
  addNotification: (notification: Notification) => void;
  removeNotification: (id: string) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  theme: 'light',
  notifications: [],
  
  setUser: (user) => set({ user }),
  setTheme: (theme) => set({ theme }),
  
  addNotification: (notification) => set((state) => ({
    notifications: [...state.notifications, notification]
  })),
  
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter(n => n.id !== id)
  }))
}));
```

---

## Node.js/Backend Standards

### 1. Controller Structure
```typescript
// controllers/userController.ts
export class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger
  ) {}

  async getUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await this.userService.getUserById(userId);
      
      if (!user) {
        res.status(404).json({
          error: 'Not Found',
          message: 'User not found'
        });
        return;
      }

      res.json({
        success: true,
        data: user
      });
    } catch (error) {
      this.logger.error('Error getting user', { userId, error });
      next(error);
    }
  }

  async createUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userData = CreateUserRequestSchema.parse(req.body);
      const user = await this.userService.createUser(userData);
      
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors
        });
        return;
      }
      
      next(error);
    }
  }
}
```

### 2. Service Layer
```typescript
// services/userService.ts
export class UserService {
  constructor(
    private userRepository: UserRepository,
    private emailService: EmailService,
    private logger: Logger
  ) {}

  async createUser(userData: CreateUserRequest): Promise<User> {
    // Validate business rules
    await this.validateUserCreation(userData);

    // Create user
    const user = await this.userRepository.create(userData);

    // Send welcome email
    try {
      await this.emailService.sendWelcomeEmail(user.email, user.username);
    } catch (error) {
      this.logger.warn('Failed to send welcome email', { 
        userId: user.id, 
        error 
      });
      // Don't fail the operation if email fails
    }

    this.logger.info('User created successfully', { userId: user.id });
    return user;
  }

  private async validateUserCreation(userData: CreateUserRequest): Promise<void> {
    const existingUser = await this.userRepository.findByEmail(userData.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    if (userData.password.length < 8) {
      throw new ValidationError('Password must be at least 8 characters');
    }
  }
}
```

### 3. Middleware
```typescript
// middleware/auth.ts
export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.split(' ')[1];

    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Access token required'
      });
      return;
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

// middleware/validation.ts
export const validateRequest = (schema: z.ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          error: 'Validation Error',
          message: 'Invalid request data',
          details: error.errors
        });
        return;
      }
      next(error);
    }
  };
};
```

---

## Database Standards

### 1. Schema Design
```sql
-- Use consistent naming conventions
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_active ON users(is_active) WHERE is_active = true;

-- Use foreign key constraints
CREATE TABLE file_uploads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'uploaded',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 2. Query Patterns
```typescript
// Use parameterized queries
class UserRepository {
  async findById(id: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE id = $1 AND is_active = true';
    const result = await this.pool.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1 AND is_active = true';
    const result = await this.pool.query(query, [email]);
    return result.rows[0] || null;
  }

  async create(userData: CreateUserRequest): Promise<User> {
    const query = `
      INSERT INTO users (username, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [
      userData.username,
      userData.email,
      userData.passwordHash,
      userData.role || 'user'
    ];
    const result = await this.pool.query(query, values);
    return result.rows[0];
  }

  // Use transactions for complex operations
  async updateUserWithProfile(
    userId: string,
    userData: UpdateUserRequest,
    profileData: UpdateProfileRequest
  ): Promise<User> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      
      // Update user
      const userQuery = `
        UPDATE users 
        SET username = $1, email = $2, updated_at = CURRENT_TIMESTAMP
        WHERE id = $3
        RETURNING *
      `;
      const userResult = await client.query(userQuery, [
        userData.username,
        userData.email,
        userId
      ]);
      
      // Update profile
      const profileQuery = `
        UPDATE user_profiles 
        SET first_name = $1, last_name = $2, bio = $3
        WHERE user_id = $4
      `;
      await client.query(profileQuery, [
        profileData.firstName,
        profileData.lastName,
        profileData.bio,
        userId
      ]);
      
      await client.query('COMMIT');
      return userResult.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }
}
```

---

## Testing Standards

### 1. Unit Testing
```typescript
// Use descriptive test names
describe('UserService', () => {
  let userService: UserService;
  let mockUserRepository: jest.Mocked<UserRepository>;
  let mockEmailService: jest.Mocked<EmailService>;

  beforeEach(() => {
    mockUserRepository = createMockUserRepository();
    mockEmailService = createMockEmailService();
    userService = new UserService(mockUserRepository, mockEmailService, mockLogger);
  });

  describe('createUser', () => {
    it('should create a user successfully when valid data is provided', async () => {
      // Arrange
      const userData: CreateUserRequest = {
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123'
      };
      
      const expectedUser: User = {
        id: 'user-id',
        username: userData.username,
        email: userData.email,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(null);
      mockUserRepository.create.mockResolvedValue(expectedUser);
      mockEmailService.sendWelcomeEmail.mockResolvedValue();

      // Act
      const result = await userService.createUser(userData);

      // Assert
      expect(result).toEqual(expectedUser);
      expect(mockUserRepository.findByEmail).toHaveBeenCalledWith(userData.email);
      expect(mockUserRepository.create).toHaveBeenCalledWith(userData);
      expect(mockEmailService.sendWelcomeEmail).toHaveBeenCalledWith(
        userData.email,
        userData.username
      );
    });

    it('should throw ConflictError when email already exists', async () => {
      // Arrange
      const userData: CreateUserRequest = {
        username: 'testuser',
        email: 'existing@example.com',
        password: 'password123'
      };

      const existingUser: User = {
        id: 'existing-id',
        username: 'existinguser',
        email: userData.email,
        role: 'user',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      mockUserRepository.findByEmail.mockResolvedValue(existingUser);

      // Act & Assert
      await expect(userService.createUser(userData)).rejects.toThrow(ConflictError);
      expect(mockUserRepository.create).not.toHaveBeenCalled();
    });
  });
});
```

### 2. Integration Testing
```typescript
// Test database interactions
describe('UserRepository Integration', () => {
  let pool: Pool;
  let repository: UserRepository;

  beforeAll(async () => {
    pool = new TestDatabasePool();
    repository = new UserRepository(pool);
    await setupTestDatabase(pool);
  });

  afterAll(async () => {
    await cleanupTestDatabase(pool);
    await pool.end();
  });

  beforeEach(async () => {
    await clearTestData(pool);
  });

  it('should create and retrieve user', async () => {
    // Arrange
    const userData: CreateUserRequest = {
      username: 'testuser',
      email: 'test@example.com',
      passwordHash: 'hashedpassword'
    };

    // Act
    const createdUser = await repository.create(userData);
    const retrievedUser = await repository.findById(createdUser.id);

    // Assert
    expect(retrievedUser).not.toBeNull();
    expect(retrievedUser!.username).toBe(userData.username);
    expect(retrievedUser!.email).toBe(userData.email);
    expect(retrievedUser!.passwordHash).toBe(userData.passwordHash);
  });
});
```

### 3. End-to-End Testing
```typescript
// Use Playwright for E2E tests
import { test, expect } from '@playwright/test';

test.describe('User Registration Flow', () => {
  test('should register a new user successfully', async ({ page }) => {
    // Navigate to registration page
    await page.goto('/register');

    // Fill out registration form
    await page.fill('[data-testid=username-input]', 'testuser');
    await page.fill('[data-testid=email-input]', 'test@example.com');
    await page.fill('[data-testid=password-input]', 'password123');
    await page.fill('[data-testid=confirm-password-input]', 'password123');

    // Submit form
    await page.click('[data-testid=register-button]');

    // Verify success
    await expect(page.locator('[data-testid=success-message]')).toBeVisible();
    await expect(page).toHaveURL('/dashboard');
  });

  test('should show validation errors for invalid data', async ({ page }) => {
    await page.goto('/register');

    // Submit empty form
    await page.click('[data-testid=register-button]');

    // Verify validation errors
    await expect(page.locator('[data-testid=username-error]')).toBeVisible();
    await expect(page.locator('[data-testid=email-error]')).toBeVisible();
    await expect(page.locator('[data-testid=password-error]')).toBeVisible();
  });
});
```

---

## Documentation Standards

### 1. Code Documentation
```typescript
/**
 * Processes a CSV file and transforms it according to the provided mapping.
 * 
 * @param file - The CSV file to process
 * @param mapping - Field mapping configuration
 * @param options - Processing options
 * @returns Promise that resolves to the processing result
 * 
 * @throws {ValidationError} When the file format is invalid
 * @throws {ProcessingError} When processing fails
 * 
 * @example
 * ```typescript
 * const result = await processCSV(file, mapping, {
 *   chunkSize: 1000,
 *   validateHeaders: true
 * });
 * console.log(`Processed ${result.processedRows} rows`);
 * ```
 */
export async function processCSV(
  file: File,
  mapping: FieldMapping,
  options: ProcessingOptions = {}
): Promise<ProcessingResult> {
  // Implementation
}
```

### 2. API Documentation
```typescript
/**
 * @swagger
 * /api/v1/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       404:
 *         description: User not found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
```

### 3. README Standards
Each package/module should have a README.md with:
- Purpose and scope
- Installation instructions
- Usage examples
- API documentation
- Contributing guidelines
- License information

---

## Code Review Checklist

### Before Submitting
- [ ] Code follows all style guidelines
- [ ] All tests pass (unit, integration, E2E)
- [ ] Documentation is updated
- [ ] No console.log statements in production code
- [ ] Error handling is implemented
- [ ] Security considerations are addressed

### During Review
- [ ] Code is readable and maintainable
- [ ] Business logic is correct
- [ ] Performance implications are considered
- [ ] Edge cases are handled
- [ ] Testing coverage is adequate
- [ ] Documentation is accurate

### After Approval
- [ ] Merge to develop branch
- [ ] Update changelog
- [ ] Deploy to staging environment
- [ ] Verify deployment success

---

This coding standards document should be regularly updated as the project evolves and new best practices emerge. All team members should familiarize themselves with these standards and apply them consistently across the codebase.