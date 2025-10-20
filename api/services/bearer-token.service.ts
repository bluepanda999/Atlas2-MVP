import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors';
import { LoggingService } from './logging.service';

export interface BearerTokenPayload {
  userId: string;
  email: string;
  role: string;
  type: 'access' | 'refresh';
  sessionId?: string;
  scopes?: string[];
}

export interface BearerTokenResult {
  userId: string;
  email: string;
  role: string;
  isAuthenticated: boolean;
  tokenType: string;
  scopes?: string[];
}

export interface BearerTokenConfig {
  accessTokenExpiry: string;
  refreshTokenExpiry: string;
  issuer: string;
  audience: string;
  algorithm: jwt.Algorithm;
  requireSecureConnection: boolean;
  allowedUserRoles: string[];
  enableTokenBlacklist: boolean;
  maxActiveSessions: number;
}

export interface TokenBlacklistEntry {
  jti: string;
  userId: string;
  expiresAt: Date;
  reason: string;
  revokedAt: Date;
}

export interface ActiveSession {
  id: string;
  userId: string;
  createdAt: Date;
  lastUsedAt: Date;
  ipAddress: string;
  userAgent?: string;
  isActive: boolean;
}

@Injectable()
export class BearerTokenService {
  private readonly config: BearerTokenConfig;
  private readonly tokenBlacklist = new Map<string, TokenBlacklistEntry>();
  private readonly activeSessions = new Map<string, ActiveSession>();
  private readonly logger = new Logger(BearerTokenService.name);

  constructor(
    private userRepository: UserRepository,
    private loggingService: LoggingService,
  ) {
    this.config = this.initializeConfig();
    this.startCleanupTimer();
  }

  private initializeConfig(): BearerTokenConfig {
    return {
      accessTokenExpiry: process.env.JWT_EXPIRES_IN || '15m',
      refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
      issuer: process.env.JWT_ISSUER || 'atlas2-api',
      audience: process.env.JWT_AUDIENCE || 'atlas2-client',
      algorithm: (process.env.JWT_ALGORITHM as jwt.Algorithm) || 'HS256',
      requireSecureConnection: process.env.JWT_REQUIRE_SECURE !== 'false',
      allowedUserRoles: (process.env.JWT_ALLOWED_ROLES || 'admin,user,service').split(','),
      enableTokenBlacklist: process.env.JWT_ENABLE_BLACKLIST !== 'false',
      maxActiveSessions: parseInt(process.env.JWT_MAX_ACTIVE_SESSIONS || '10'),
    };
  }

  async authenticate(
    token: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<BearerTokenResult> {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = token.replace(/^Bearer\s+/, '');

      // Decode token without verification first to get jti
      const decoded = jwt.decode(cleanToken) as any;
      if (!decoded) {
        throw new AppError('Invalid token format', 401);
      }

      // Check if token is blacklisted
      if (this.config.enableTokenBlacklist && decoded.jti) {
        const blacklistEntry = this.tokenBlacklist.get(decoded.jti);
        if (blacklistEntry && blacklistEntry.expiresAt > new Date()) {
          throw new AppError('Token has been revoked', 401);
        }
      }

      // Verify token
      const verified = jwt.verify(cleanToken, process.env.JWT_SECRET!, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
      }) as BearerTokenPayload;

      // Get user
      const user = await this.userRepository.findById(verified.userId);
      if (!user || !user.isActive) {
        throw new AppError('Invalid token - user not found or inactive', 401);
      }

      // Check if user role is allowed for Bearer tokens
      if (!this.config.allowedUserRoles.includes(user.role)) {
        this.loggingService.warn(
          `Bearer token attempt by user with restricted role: ${user.email}`,
          { role: user.role, ipAddress: context.ipAddress },
          'BearerTokenService'
        );
        throw new AppError('Invalid token', 401);
      }

      // Update session activity
      if (verified.sessionId) {
        await this.updateSessionActivity(verified.sessionId, context);
      }

      this.loggingService.debug(
        `Bearer token authentication successful for user: ${user.email}`,
        { 
          userId: user.id, 
          tokenType: verified.type,
          sessionId: verified.sessionId,
          ipAddress: context.ipAddress 
        },
        'BearerTokenService'
      );

      return {
        userId: user.id,
        email: user.email,
        role: user.role,
        isAuthenticated: true,
        tokenType: verified.type,
        scopes: verified.scopes,
      };
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Token expired', 401);
      }
      if (error instanceof AppError) {
        throw error;
      }

      this.loggingService.error(
        'Bearer token authentication error',
        error.stack,
        'BearerTokenService',
        { ipAddress: context.ipAddress }
      );
      throw new AppError('Authentication failed', 500);
    }
  }

  async generateTokenPair(
    userId: string,
    context: { ipAddress: string; userAgent?: string; scopes?: string[] }
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    const user = await this.userRepository.findById(userId);
    if (!user || !user.isActive) {
      throw new AppError('User not found or inactive', 404);
    }

    // Check session limit
    await this.enforceSessionLimit(userId);

    // Generate session ID
    const sessionId = this.generateSessionId();

    // Create session
    const session: ActiveSession = {
      id: sessionId,
      userId,
      createdAt: new Date(),
      lastUsedAt: new Date(),
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      isActive: true,
    };
    this.activeSessions.set(sessionId, session);

    // Generate tokens
    const accessToken = this.generateAccessToken(user, sessionId, context.scopes);
    const refreshToken = this.generateRefreshToken(user, sessionId);

    this.loggingService.info(
      `Token pair generated for user: ${user.email}`,
      { 
        userId: user.id, 
        sessionId,
        ipAddress: context.ipAddress,
        scopes: context.scopes 
      },
      'BearerTokenService'
    );

    return {
      accessToken,
      refreshToken,
      sessionId,
    };
  }

  async refreshToken(
    refreshToken: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<{ accessToken: string; refreshToken: string; sessionId: string }> {
    try {
      // Remove 'Bearer ' prefix if present
      const cleanToken = refreshToken.replace(/^Bearer\s+/, '');

      // Verify refresh token
      const verified = jwt.verify(cleanToken, process.env.JWT_REFRESH_SECRET!, {
        issuer: this.config.issuer,
        audience: this.config.audience,
        algorithms: [this.config.algorithm],
      }) as BearerTokenPayload;

      // Ensure it's a refresh token
      if (verified.type !== 'refresh') {
        throw new AppError('Invalid token type', 401);
      }

      // Get user
      const user = await this.userRepository.findById(verified.userId);
      if (!user || !user.isActive) {
        throw new AppError('Invalid token - user not found or inactive', 401);
      }

      // Get session
      const session = this.activeSessions.get(verified.sessionId!);
      if (!session || !session.isActive || session.userId !== verified.userId) {
        throw new AppError('Invalid session', 401);
      }

      // Revoke old refresh token
      if (verified.jti) {
        await this.revokeToken(verified.jti, verified.userId, 'Token refresh');
      }

      // Generate new token pair
      return await this.generateTokenPair(verified.userId, context);
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new AppError('Invalid refresh token', 401);
      }
      if (error instanceof jwt.TokenExpiredError) {
        throw new AppError('Refresh token expired', 401);
      }
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Token refresh failed', 500);
    }
  }

  async revokeToken(jti: string, userId: string, reason: string): Promise<void> {
    const entry: TokenBlacklistEntry = {
      jti,
      userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      reason,
      revokedAt: new Date(),
    };

    this.tokenBlacklist.set(jti, entry);

    this.loggingService.info(
      `Token revoked`,
      { jti, userId, reason },
      'BearerTokenService'
    );
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session && session.userId === userId) {
      session.isActive = false;
      
      this.loggingService.info(
        `Session revoked`,
        { sessionId, userId },
        'BearerTokenService'
      );
    }
  }

  async revokeAllSessions(userId: string): Promise<void> {
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.userId === userId) {
        session.isActive = false;
      }
    }

    this.loggingService.info(
      `All sessions revoked for user`,
      { userId },
      'BearerTokenService'
    );
  }

  private generateAccessToken(
    user: any,
    sessionId: string,
    scopes?: string[]
  ): string {
    const payload: BearerTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'access',
      sessionId,
      scopes,
    };

    return jwt.sign(payload, process.env.JWT_SECRET!, {
      expiresIn: this.config.accessTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: this.config.algorithm,
      jwtid: this.generateJti(),
    });
  }

  private generateRefreshToken(user: any, sessionId: string): string {
    const payload: BearerTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role,
      type: 'refresh',
      sessionId,
    };

    return jwt.sign(payload, process.env.JWT_REFRESH_SECRET!, {
      expiresIn: this.config.refreshTokenExpiry,
      issuer: this.config.issuer,
      audience: this.config.audience,
      algorithm: this.config.algorithm,
      jwtid: this.generateJti(),
    });
  }

  private generateSessionId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private generateJti(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private async updateSessionActivity(
    sessionId: string,
    context: { ipAddress: string; userAgent?: string }
  ): Promise<void> {
    const session = this.activeSessions.get(sessionId);
    if (session && session.isActive) {
      session.lastUsedAt = new Date();
      // Note: In production, you might want to update IP address only if it changes
      // for security monitoring
    }
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessions = Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId && session.isActive);

    if (userSessions.length >= this.config.maxActiveSessions) {
      // Revoke oldest session
      const oldestSession = userSessions.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
      oldestSession.isActive = false;

      this.loggingService.info(
        `Oldest session revoked due to limit`,
        { sessionId: oldestSession.id, userId },
        'BearerTokenService'
      );
    }
  }

  private startCleanupTimer(): void {
    // Clean up expired entries every hour
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60 * 60 * 1000);
  }

  private cleanupExpiredEntries(): void {
    const now = new Date();

    // Clean up expired blacklist entries
    for (const [jti, entry] of this.tokenBlacklist.entries()) {
      if (entry.expiresAt <= now) {
        this.tokenBlacklist.delete(jti);
      }
    }

    // Clean up old inactive sessions (older than 30 days)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (!session.isActive && session.lastUsedAt <= thirtyDaysAgo) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  async getActiveSessions(userId: string): Promise<ActiveSession[]> {
    return Array.from(this.activeSessions.values())
      .filter(session => session.userId === userId && session.isActive)
      .sort((a, b) => b.lastUsedAt.getTime() - a.lastUsedAt.getTime());
  }

  async getBlacklistedTokens(userId?: string): Promise<TokenBlacklistEntry[]> {
    let entries = Array.from(this.tokenBlacklist.values());
    
    if (userId) {
      entries = entries.filter(entry => entry.userId === userId);
    }

    return entries.sort((a, b) => b.revokedAt.getTime() - a.revokedAt.getTime());
  }

  getConfig(): BearerTokenConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<BearerTokenConfig>): void {
    Object.assign(this.config, updates);
    this.loggingService.info(
      'Bearer token configuration updated',
      { config: this.config },
      'BearerTokenService'
    );
  }

  // Cleanup method for graceful shutdown
  onModuleDestroy(): void {
    this.tokenBlacklist.clear();
    this.activeSessions.clear();
  }
}