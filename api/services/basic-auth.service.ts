import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors';
import { LoggingService } from './logging.service';

export interface BasicAuthCredentials {
  username: string;
  password: string;
}

export interface BasicAuthResult {
  userId: string;
  email: string;
  role: string;
  isAuthenticated: boolean;
}

export interface BasicAuthConfig {
  enabled: boolean;
  realm: string;
  maxAttempts: number;
  lockoutDuration: number; // seconds
  requireSecureConnection: boolean;
  allowedUserRoles: string[];
}

export interface AuthenticationAttempt {
  identifier: string;
  timestamp: Date;
  success: boolean;
  ipAddress: string;
  userAgent?: string;
}

@Injectable()
export class BasicAuthService {
  private readonly attempts = new Map<string, AuthenticationAttempt[]>();
  private readonly config: BasicAuthConfig;
  private readonly logger = new Logger(BasicAuthService.name);

  constructor(
    private userRepository: UserRepository,
    private loggingService: LoggingService,
  ) {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): BasicAuthConfig {
    return {
      enabled: process.env.BASIC_AUTH_ENABLED !== 'false',
      realm: process.env.BASIC_AUTH_REALM || 'Atlas2 API',
      maxAttempts: parseInt(process.env.BASIC_AUTH_MAX_ATTEMPTS || '5'),
      lockoutDuration: parseInt(process.env.BASIC_AUTH_LOCKOUT_DURATION || '900'), // 15 minutes
      requireSecureConnection: process.env.BASIC_AUTH_REQUIRE_SECURE !== 'false',
      allowedUserRoles: (process.env.BASIC_AUTH_ALLOWED_ROLES || 'admin,user').split(','),
    };
  }

  async authenticate(
    credentials: BasicAuthCredentials,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<BasicAuthResult> {
    // Check if Basic Auth is enabled
    if (!this.config.enabled) {
      throw new AppError('Basic authentication is disabled', 403);
    }

    const { username, password } = credentials;

    // Validate input
    if (!username || !password) {
      await this.recordAttempt(username, false, context.ipAddress, context.userAgent);
      throw new AppError('Username and password are required', 400);
    }

    // Check for rate limiting/lockout
    await this.checkRateLimit(username, context.ipAddress);

    try {
      // Find user by email or username
      const user = await this.findUser(username);
      if (!user) {
        await this.recordAttempt(username, false, context.ipAddress, context.userAgent);
        throw new AppError('Invalid credentials', 401);
      }

      // Check if user role is allowed for Basic Auth
      if (!this.config.allowedUserRoles.includes(user.role)) {
        await this.recordAttempt(username, false, context.ipAddress, context.userAgent);
        this.loggingService.warn(
          `Basic auth attempt by user with restricted role: ${user.email}`,
          { role: user.role, ipAddress: context.ipAddress },
          'BasicAuthService'
        );
        throw new AppError('Invalid credentials', 401);
      }

      // Check if user is active
      if (!user.isActive) {
        await this.recordAttempt(username, false, context.ipAddress, context.userAgent);
        throw new AppError('Account is deactivated', 401);
      }

      // Verify password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        await this.recordAttempt(username, false, context.ipAddress, context.userAgent);
        throw new AppError('Invalid credentials', 401);
      }

      // Record successful attempt
      await this.recordAttempt(username, true, context.ipAddress, context.userAgent);

      // Update last login
      await this.userRepository.updateLastLogin(user.id);

      this.loggingService.info(
        `Basic authentication successful for user: ${user.email}`,
        { userId: user.id, ipAddress: context.ipAddress },
        'BasicAuthService'
      );

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        isAuthenticated: true,
      };
    } catch (error) {
      if (error instanceof AppError) {
        throw error;
      }
      
      this.loggingService.error(
        'Basic authentication error',
        error.stack,
        'BasicAuthService',
        { username, ipAddress: context.ipAddress }
      );
      throw new AppError('Authentication failed', 500);
    }
  }

  private async findUser(identifier: string): Promise<any> {
    // Try to find by email first, then by username if supported
    let user = await this.userRepository.findByEmail(identifier);
    
    if (!user) {
      // If username field is supported, try that
      try {
        user = await this.userRepository.findByUsername(identifier);
      } catch (error) {
        // Username lookup not supported, continue with email only
      }
    }
    
    return user;
  }

  private async checkRateLimit(identifier: string, ipAddress: string): Promise<void> {
    const key = `${identifier}:${ipAddress}`;
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the lockout window
    const cutoffTime = new Date(Date.now() - this.config.lockoutDuration * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoffTime);

    // Update attempts with filtered list
    this.attempts.set(key, recentAttempts);

    // Count failed attempts
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);

    if (failedAttempts.length >= this.config.maxAttempts) {
      const lockoutExpires = new Date(
        Math.max(...recentAttempts.map(a => a.timestamp.getTime())) + 
        this.config.lockoutDuration * 1000
      );

      this.loggingService.warn(
        `Basic auth rate limit exceeded for identifier: ${identifier}`,
        { 
          identifier, 
          ipAddress, 
          failedAttempts: failedAttempts.length,
          lockoutExpires,
        },
        'BasicAuthService'
      );

      throw new AppError(
        `Too many failed attempts. Account locked until ${lockoutExpires.toISOString()}`,
        429
      );
    }
  }

  private async recordAttempt(
    identifier: string,
    success: boolean,
    ipAddress: string,
    userAgent?: string
  ): Promise<void> {
    const key = `${identifier}:${ipAddress}`;
    const attempts = this.attempts.get(key) || [];

    const attempt: AuthenticationAttempt = {
      identifier,
      timestamp: new Date(),
      success,
      ipAddress,
      userAgent,
    };

    attempts.push(attempt);
    this.attempts.set(key, attempts);

    // Log the attempt
    if (success) {
      this.loggingService.debug(
        `Basic auth successful attempt recorded`,
        { identifier, ipAddress },
        'BasicAuthService'
      );
    } else {
      this.loggingService.warn(
        `Basic auth failed attempt recorded`,
        { identifier, ipAddress },
        'BasicAuthService'
      );
    }
  }

  generateChallengeHeader(): string {
    return `Basic realm="${this.config.realm}", charset="UTF-8"`;
  }

  async getAuthenticationAttempts(
    identifier?: string,
    ipAddress?: string
  ): Promise<AuthenticationAttempt[]> {
    let allAttempts: AuthenticationAttempt[] = [];

    // Collect all attempts
    for (const [key, attempts] of this.attempts.entries()) {
      const [keyIdentifier, keyIpAddress] = key.split(':');
      
      if (identifier && keyIdentifier !== identifier) continue;
      if (ipAddress && keyIpAddress !== ipAddress) continue;
      
      allAttempts.push(...attempts);
    }

    // Sort by timestamp (newest first)
    return allAttempts.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async clearAuthenticationAttempts(identifier: string, ipAddress: string): Promise<void> {
    const key = `${identifier}:${ipAddress}`;
    this.attempts.delete(key);
    
    this.loggingService.info(
      `Basic auth attempts cleared for identifier: ${identifier}`,
      { identifier, ipAddress },
      'BasicAuthService'
    );
  }

  async isUserLockedOut(identifier: string, ipAddress: string): Promise<boolean> {
    try {
      await this.checkRateLimit(identifier, ipAddress);
      return false;
    } catch (error) {
      if (error instanceof AppError && error.statusCode === 429) {
        return true;
      }
      return false;
    }
  }

  getRemainingAttempts(identifier: string, ipAddress: string): number {
    const key = `${identifier}:${ipAddress}`;
    const attempts = this.attempts.get(key) || [];

    // Remove old attempts outside the lockout window
    const cutoffTime = new Date(Date.now() - this.config.lockoutDuration * 1000);
    const recentAttempts = attempts.filter(attempt => attempt.timestamp > cutoffTime);

    // Count failed attempts
    const failedAttempts = recentAttempts.filter(attempt => !attempt.success);

    return Math.max(0, this.config.maxAttempts - failedAttempts.length);
  }

  getConfig(): BasicAuthConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BasicAuthConfig>): void {
    Object.assign(this.config, updates);
    this.loggingService.info(
      'Basic auth configuration updated',
      { config: this.config },
      'BasicAuthService'
    );
  }

  // Cleanup method for graceful shutdown
  onModuleDestroy(): void {
    this.attempts.clear();
  }
}