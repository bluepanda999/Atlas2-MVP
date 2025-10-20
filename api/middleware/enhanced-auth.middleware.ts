import { Request, Response, NextFunction } from 'express';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors';
import { BasicAuthService } from '../services/basic-auth.service';
import { BearerTokenService } from '../services/bearer-token.service';
import { LoggingService } from '../services/logging.service';

// Extend Request interface to include user and authentication info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
      auth?: {
        method: 'basic' | 'bearer';
        sessionId?: string;
        scopes?: string[];
      };
    }
  }
}

export interface AuthMiddlewareConfig {
  enableBasicAuth: boolean;
  enableBearerAuth: boolean;
  requireSecureConnection: boolean;
  allowedAuthMethods: ('basic' | 'bearer')[];
  defaultAuthMethod: 'basic' | 'bearer' | 'any';
  skipPaths: string[];
  rateLimitByIP: boolean;
  logAuthenticationAttempts: boolean;
}

export class EnhancedAuthMiddleware {
  private readonly config: AuthMiddlewareConfig;
  private readonly logger = new Logger(EnhancedAuthMiddleware.name);

  constructor(
    private userRepository: UserRepository,
    private basicAuthService: BasicAuthService,
    private bearerTokenService: BearerTokenService,
    private loggingService: LoggingService,
  ) {
    this.config = this.initializeConfig();
  }

  private initializeConfig(): AuthMiddlewareConfig {
    return {
      enableBasicAuth: process.env.ENABLE_BASIC_AUTH !== 'false',
      enableBearerAuth: process.env.ENABLE_BEARER_AUTH !== 'false',
      requireSecureConnection: process.env.REQUIRE_SECURE_AUTH !== 'false',
      allowedAuthMethods: (process.env.ALLOWED_AUTH_METHODS || 'basic,bearer').split(',') as ('basic' | 'bearer')[],
      defaultAuthMethod: (process.env.DEFAULT_AUTH_METHOD as any) || 'any',
      skipPaths: (process.env.AUTH_SKIP_PATHS || '/health,/health/live,/health/ready,/metrics').split(','),
      rateLimitByIP: process.env.AUTH_RATE_LIMIT_BY_IP !== 'false',
      logAuthenticationAttempts: process.env.LOG_AUTH_ATTEMPTS !== 'false',
    };
  }

  // Main authentication middleware that tries both methods
  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip authentication for certain paths
      if (this.shouldSkipPath(req.path)) {
        return next();
      }

      // Check secure connection requirement
      if (this.config.requireSecureConnection && !this.isSecureConnection(req)) {
        throw new AppError('Secure connection required for authentication', 400);
      }

      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        this.setAuthChallengeHeader(res);
        throw new AppError('Authentication required', 401);
      }

      // Try different authentication methods based on configuration
      let authResult;
      let authMethod: 'basic' | 'bearer';

      if (authHeader.startsWith('Bearer ')) {
        if (!this.config.enableBearerAuth || !this.config.allowedAuthMethods.includes('bearer')) {
          throw new AppError('Bearer authentication not allowed', 401);
        }
        
        authResult = await this.authenticateBearer(req, authHeader);
        authMethod = 'bearer';
      } else if (authHeader.startsWith('Basic ')) {
        if (!this.config.enableBasicAuth || !this.config.allowedAuthMethods.includes('basic')) {
          throw new AppError('Basic authentication not allowed', 401);
        }
        
        authResult = await this.authenticateBasic(req, authHeader);
        authMethod = 'basic';
      } else {
        this.setAuthChallengeHeader(res);
        throw new AppError('Unsupported authentication method', 401);
      }

      // Set user and auth info on request
      req.user = {
        id: authResult.userId,
        email: authResult.email,
        role: authResult.role,
      };

      req.auth = {
        method: authMethod,
        sessionId: authResult.sessionId,
        scopes: authResult.scopes,
      };

      // Log successful authentication
      if (this.config.logAuthenticationAttempts) {
        this.loggingService.info(
          `Authentication successful via ${authMethod}`,
          { 
            userId: authResult.userId,
            email: authResult.email,
            method: authMethod,
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
          },
          'EnhancedAuthMiddleware'
        );
      }

      next();
    } catch (error) {
      // Log failed authentication
      if (this.config.logAuthenticationAttempts && error instanceof AppError) {
        this.loggingService.warn(
          `Authentication failed: ${error.message}`,
          { 
            method: this.getAuthMethodFromHeader(req.get('Authorization')),
            ipAddress: this.getClientIP(req),
            userAgent: req.get('User-Agent'),
            path: req.path,
          },
          'EnhancedAuthMiddleware'
        );
      }

      next(error);
    }
  };

  // Bearer token specific authentication
  private async authenticateBearer(req: Request, authHeader: string): Promise<any> {
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    return await this.bearerTokenService.authenticate(token, {
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
    });
  }

  // Basic authentication specific
  private async authenticateBasic(req: Request, authHeader: string): Promise<any> {
    const credentials = this.parseBasicAuth(authHeader);
    
    return await this.basicAuthService.authenticate(credentials, {
      ipAddress: this.getClientIP(req),
      userAgent: req.get('User-Agent'),
    });
  }

  // Parse Basic Auth header
  private parseBasicAuth(authHeader: string): { username: string; password: string } {
    try {
      const base64Credentials = authHeader.substring(6); // Remove 'Basic ' prefix
      const credentials = Buffer.from(base64Credentials, 'base64').toString('utf-8');
      const [username, password] = credentials.split(':');

      if (!username || !password) {
        throw new AppError('Invalid Basic authentication format', 400);
      }

      return { username, password };
    } catch (error) {
      throw new AppError('Invalid Basic authentication format', 400);
    }
  }

  // Role-based authorization
  authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      if (!roles.includes(req.user.role)) {
        this.loggingService.warn(
          `Authorization failed - insufficient permissions`,
          { 
            userId: req.user.id,
            userRole: req.user.role,
            requiredRoles: roles,
            path: req.path,
          },
          'EnhancedAuthMiddleware'
        );
        return next(new AppError('Insufficient permissions', 403));
      }

      next();
    };
  };

  // Scope-based authorization (for Bearer tokens)
  requireScopes = (requiredScopes: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      if (!req.auth || req.auth.method !== 'bearer') {
        return next(new AppError('Bearer token required for scope-based authorization', 401));
      }

      const userScopes = req.auth.scopes || [];
      const hasAllScopes = requiredScopes.every(scope => userScopes.includes(scope));

      if (!hasAllScopes) {
        this.loggingService.warn(
          `Authorization failed - insufficient scopes`,
          { 
            userId: req.user.id,
            userScopes,
            requiredScopes,
            path: req.path,
          },
          'EnhancedAuthMiddleware'
        );
        return next(new AppError('Insufficient scopes', 403));
      }

      next();
    };
  };

  // Optional authentication - doesn't fail if no auth provided
  optional = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Skip authentication for certain paths
      if (this.shouldSkipPath(req.path)) {
        return next();
      }

      const authHeader = req.headers.authorization;
      
      if (!authHeader) {
        return next(); // No auth header, continue without authentication
      }

      // Try to authenticate but don't fail if it doesn't work
      if (authHeader.startsWith('Bearer ') && this.config.enableBearerAuth) {
        try {
          const authResult = await this.authenticateBearer(req, authHeader);
          req.user = {
            id: authResult.userId,
            email: authResult.email,
            role: authResult.role,
          };
          req.auth = {
            method: 'bearer',
            sessionId: authResult.sessionId,
            scopes: authResult.scopes,
          };
        } catch (error) {
          // Ignore authentication errors for optional auth
        }
      } else if (authHeader.startsWith('Basic ') && this.config.enableBasicAuth) {
        try {
          const authResult = await this.authenticateBasic(req, authHeader);
          req.user = {
            id: authResult.userId,
            email: authResult.email,
            role: authResult.role,
          };
          req.auth = {
            method: 'basic',
          };
        } catch (error) {
          // Ignore authentication errors for optional auth
        }
      }

      next();
    } catch (error) {
      // For optional auth, always continue
      next();
    }
  };

  // Method-specific authentication
  basicOnly = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.config.enableBasicAuth) {
      throw new AppError('Basic authentication is disabled', 403);
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.set('WWW-Authenticate', this.basicAuthService.generateChallengeHeader());
      throw new AppError('Basic authentication required', 401);
    }

    const authResult = await this.authenticateBasic(req, authHeader);
    
    req.user = {
      id: authResult.userId,
      email: authResult.email,
      role: authResult.role,
    };

    req.auth = {
      method: 'basic',
    };

    next();
  };

  bearerOnly = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!this.config.enableBearerAuth) {
      throw new AppError('Bearer authentication is disabled', 403);
    }

    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new AppError('Bearer token required', 401);
    }

    const authResult = await this.authenticateBearer(req, authHeader);
    
    req.user = {
      id: authResult.userId,
      email: authResult.email,
      role: authResult.role,
    };

    req.auth = {
      method: 'bearer',
      sessionId: authResult.sessionId,
      scopes: authResult.scopes,
    };

    next();
  };

  // Helper methods
  private shouldSkipPath(path: string): boolean {
    return this.config.skipPaths.some(skipPath => {
      if (skipPath.includes('*')) {
        const regex = new RegExp(skipPath.replace(/\*/g, '.*'));
        return regex.test(path);
      }
      return path === skipPath;
    });
  }

  private isSecureConnection(req: Request): boolean {
    // Check for HTTPS
    if (req.secure || req.protocol === 'https') {
      return true;
    }

    // Check for forwarded headers (behind reverse proxy)
    const forwardedProto = req.get('X-Forwarded-Proto');
    if (forwardedProto === 'https') {
      return true;
    }

    // Check for cloudflare headers
    const cfVisitor = req.get('CF-Visitor');
    if (cfVisitor && cfVisitor.includes('"scheme":"https"')) {
      return true;
    }

    return false;
  }

  private getClientIP(req: Request): string {
    return req.get('X-Forwarded-For') || 
           req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           'unknown';
  }

  private getAuthMethodFromHeader(authHeader?: string): 'basic' | 'bearer' | 'unknown' {
    if (!authHeader) return 'unknown';
    if (authHeader.startsWith('Basic ')) return 'basic';
    if (authHeader.startsWith('Bearer ')) return 'bearer';
    return 'unknown';
  }

  private setAuthChallengeHeader(res: Response): void {
    const challenges: string[] = [];

    if (this.config.enableBasicAuth && this.config.allowedAuthMethods.includes('basic')) {
      challenges.push(this.basicAuthService.generateChallengeHeader());
    }

    if (this.config.enableBearerAuth && this.config.allowedAuthMethods.includes('bearer')) {
      challenges.push('Bearer realm="Atlas2 API"');
    }

    if (challenges.length > 0) {
      res.set('WWW-Authenticate', challenges.join(', '));
    }
  }

  // Configuration methods
  getConfig(): AuthMiddlewareConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<AuthMiddlewareConfig>): void {
    Object.assign(this.config, updates);
    this.loggingService.info(
      'Enhanced auth middleware configuration updated',
      { config: this.config },
      'EnhancedAuthMiddleware'
    );
  }
}