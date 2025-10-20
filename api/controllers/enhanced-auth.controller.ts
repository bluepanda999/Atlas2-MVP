import { 
  Controller, 
  Post, 
  Get, 
  Delete, 
  Body, 
  Headers, 
  Query, 
  Req, 
  Res,
  HttpCode,
  HttpStatus,
  ValidationPipe
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiQuery } from '@nestjs/swagger';
import { 
  LoginRequest, 
  RegisterRequest, 
  AuthResponse, 
  ChangePasswordRequest 
} from '../types/auth';
import { AuthService } from '../services/auth.service';
import { BasicAuthService } from '../services/basic-auth.service';
import { BearerTokenService } from '../services/bearer-token.service';
import { LoggingService } from '../services/logging.service';

@ApiTags('authentication')
@Controller('auth')
export class EnhancedAuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly basicAuthService: BasicAuthService,
    private readonly bearerTokenService: BearerTokenService,
    private readonly loggingService: LoggingService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({ status: 200, description: 'Login successful', type: AuthResponse })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body(ValidationPipe) loginData: LoginRequest,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const result = await this.authService.login(loginData);
    
    this.loggingService.info(
      `User logged in successfully: ${result.user.email}`,
      { 
        userId: result.user.id,
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
      },
      'EnhancedAuthController'
    );

    return result;
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully', type: AuthResponse })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async register(
    @Body(ValidationPipe) registerData: RegisterRequest,
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const result = await this.authService.register(registerData);
    
    this.loggingService.info(
      `User registered successfully: ${result.user.email}`,
      { 
        userId: result.user.id,
        ipAddress: this.getClientIP(req),
        userAgent: req.get('User-Agent'),
      },
      'EnhancedAuthController'
    );

    return result;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully', type: AuthResponse })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() body: { refreshToken: string },
    @Req() req: Request,
  ): Promise<AuthResponse> {
    const result = await this.authService.refreshToken(body.refreshToken);
    
    this.loggingService.info(
      `Token refreshed for user: ${result.user.email}`,
      { 
        userId: result.user.id,
        ipAddress: this.getClientIP(req),
      },
      'EnhancedAuthController'
    );

    return result;
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 200, description: 'Logout successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.authService.logout(req.user.id);
    
    // Revoke current session if using bearer token
    if (req.auth?.method === 'bearer' && req.auth.sessionId) {
      await this.bearerTokenService.revokeSession(req.auth.sessionId, req.user.id);
    }
    
    this.loggingService.info(
      `User logged out: ${req.user.email}`,
      { 
        userId: req.user.id,
        method: req.auth?.method,
        sessionId: req.auth?.sessionId,
      },
      'EnhancedAuthController'
    );

    return { message: 'Logout successful' };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Logout from all sessions' })
  @ApiResponse({ status: 200, description: 'Logout from all sessions successful' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logoutAll(
    @Req() req: Request,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.authService.logout(req.user.id);
    await this.bearerTokenService.revokeAllSessions(req.user.id);
    
    this.loggingService.info(
      `User logged out from all sessions: ${req.user.email}`,
      { userId: req.user.id },
      'EnhancedAuthController'
    );

    return { message: 'Logout from all sessions successful' };
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() req: Request): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return await this.authService.getProfile(req.user.id);
  }

  @Post('profile')
  @ApiOperation({ summary: 'Update user profile' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async updateProfile(
    @Body() updates: any,
    @Req() req: Request,
  ): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return await this.authService.updateProfile(req.user.id, updates);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @Body(ValidationPipe) changePasswordData: ChangePasswordRequest,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.authService.changePassword(
      req.user.id,
      changePasswordData.currentPassword,
      changePasswordData.newPassword
    );
    
    this.loggingService.info(
      `Password changed for user: ${req.user.email}`,
      { userId: req.user.id },
      'EnhancedAuthController'
    );

    return { message: 'Password changed successfully' };
  }

  // Basic Auth specific endpoints
  @Get('basic/test')
  @ApiOperation({ summary: 'Test Basic authentication' })
  @ApiHeader({ name: 'Authorization', description: 'Basic credentials' })
  @ApiResponse({ status: 200, description: 'Basic authentication successful' })
  @ApiResponse({ status: 401, description: 'Basic authentication failed' })
  async testBasicAuth(@Req() req: Request): Promise<any> {
    return {
      message: 'Basic authentication successful',
      user: req.user,
      auth: req.auth,
    };
  }

  @Get('basic/attempts')
  @ApiOperation({ summary: 'Get Basic authentication attempts' })
  @ApiQuery({ name: 'identifier', required: false })
  @ApiQuery({ name: 'ipAddress', required: false })
  @ApiResponse({ status: 200, description: 'Authentication attempts retrieved' })
  async getBasicAuthAttempts(
    @Query('identifier') identifier?: string,
    @Query('ipAddress') ipAddress?: string,
  ): Promise<any> {
    return await this.basicAuthService.getAuthenticationAttempts(identifier, ipAddress);
  }

  @Delete('basic/attempts')
  @ApiOperation({ summary: 'Clear Basic authentication attempts' })
  @ApiQuery({ name: 'identifier', required: true })
  @ApiQuery({ name: 'ipAddress', required: true })
  @ApiResponse({ status: 200, description: 'Authentication attempts cleared' })
  async clearBasicAuthAttempts(
    @Query('identifier') identifier: string,
    @Query('ipAddress') ipAddress: string,
  ): Promise<{ message: string }> {
    await this.basicAuthService.clearAuthenticationAttempts(identifier, ipAddress);
    return { message: 'Authentication attempts cleared' };
  }

  // Bearer Token specific endpoints
  @Get('bearer/test')
  @ApiOperation({ summary: 'Test Bearer token authentication' })
  @ApiHeader({ name: 'Authorization', description: 'Bearer token' })
  @ApiResponse({ status: 200, description: 'Bearer authentication successful' })
  @ApiResponse({ status: 401, description: 'Bearer authentication failed' })
  async testBearerAuth(@Req() req: Request): Promise<any> {
    return {
      message: 'Bearer authentication successful',
      user: req.user,
      auth: req.auth,
    };
  }

  @Get('bearer/sessions')
  @ApiOperation({ summary: 'Get active sessions' })
  @ApiResponse({ status: 200, description: 'Active sessions retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getActiveSessions(@Req() req: Request): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return await this.bearerTokenService.getActiveSessions(req.user.id);
  }

  @Delete('bearer/sessions/:sessionId')
  @ApiOperation({ summary: 'Revoke specific session' })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async revokeSession(
    @Param('sessionId') sessionId: string,
    @Req() req: Request,
  ): Promise<{ message: string }> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    await this.bearerTokenService.revokeSession(sessionId, req.user.id);
    
    this.loggingService.info(
      `Session revoked by user: ${req.user.email}`,
      { userId: req.user.id, sessionId },
      'EnhancedAuthController'
    );

    return { message: 'Session revoked successfully' };
  }

  @Get('bearer/blacklist')
  @ApiOperation({ summary: 'Get blacklisted tokens' })
  @ApiResponse({ status: 200, description: 'Blacklisted tokens retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getBlacklistedTokens(@Req() req: Request): Promise<any> {
    if (!req.user) {
      throw new UnauthorizedException();
    }

    return await this.bearerTokenService.getBlacklistedTokens(req.user.id);
  }

  // Configuration endpoints
  @Get('config')
  @ApiOperation({ summary: 'Get authentication configuration' })
  @ApiResponse({ status: 200, description: 'Configuration retrieved' })
  async getAuthConfig(): Promise<any> {
    return {
      basic: this.basicAuthService.getConfig(),
      bearer: this.bearerTokenService.getConfig(),
    };
  }

  // Health check for authentication system
  @Get('health')
  @ApiOperation({ summary: 'Check authentication system health' })
  @ApiResponse({ status: 200, description: 'Authentication system healthy' })
  async healthCheck(): Promise<any> {
    return {
      status: 'healthy',
      timestamp: new Date(),
      services: {
        basicAuth: this.basicAuthService.getConfig().enabled,
        bearerAuth: this.bearerTokenService.getConfig().allowedUserRoles.length > 0,
      },
    };
  }

  // Helper methods
  private getClientIP(req: Request): string {
    return req.get('X-Forwarded-For') || 
           req.get('X-Real-IP') || 
           req.connection.remoteAddress || 
           req.socket.remoteAddress || 
           'unknown';
  }
}