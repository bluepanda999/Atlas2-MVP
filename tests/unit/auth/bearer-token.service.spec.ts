import { Test, TestingModule } from '@nestjs/testing';
import { BearerTokenService } from '../../../../api/services/bearer-token.service';
import { UserRepository } from '../../../../api/repositories/user.repository';
import { LoggingService } from '../../../../api/services/logging.service';
import { AppError } from '../../../../api/utils/errors';

describe('BearerTokenService', () => {
  let service: BearerTokenService;
  let userRepository: jest.Mocked<UserRepository>;
  let loggingService: jest.Mocked<LoggingService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    role: 'user',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findById: jest.fn(),
    };

    const mockLoggingService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BearerTokenService,
        {
          provide: UserRepository,
          useValue: mockUserRepository,
        },
        {
          provide: LoggingService,
          useValue: mockLoggingService,
        },
      ],
    }).compile();

    service = module.get<BearerTokenService>(BearerTokenService);
    userRepository = module.get(UserRepository);
    loggingService = module.get(LoggingService);

    // Set required environment variables
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  });

  describe('authenticate', () => {
    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Test-Agent',
    };

    it('should authenticate successfully with valid token', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      // Generate a valid token
      const tokenPair = await service.generateTokenPair('user-123', context);
      const result = await service.authenticate(tokenPair.accessToken, context);

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        isAuthenticated: true,
        tokenType: 'access',
        scopes: undefined,
      });
    });

    it('should reject invalid token', async () => {
      await expect(
        service.authenticate('invalid-token', context)
      ).rejects.toThrow(AppError);
    });

    it('should reject expired token', async () => {
      // Create an expired token
      const jwt = require('jsonwebtoken');
      const expiredToken = jwt.sign(
        { userId: 'user-123', type: 'access' },
        process.env.JWT_SECRET,
        { expiresIn: '-1h' }
      );

      await expect(
        service.authenticate(expiredToken, context)
      ).rejects.toThrow(AppError);
    });

    it('should reject token for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      const tokenPair = await service.generateTokenPair('user-123', context);

      await expect(
        service.authenticate(tokenPair.accessToken, context)
      ).rejects.toThrow(AppError);
    });

    it('should reject token for inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findById.mockResolvedValue(inactiveUser);

      const tokenPair = await service.generateTokenPair('user-123', context);

      await expect(
        service.authenticate(tokenPair.accessToken, context)
      ).rejects.toThrow(AppError);
    });

    it('should reject blacklisted token', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const tokenPair = await service.generateTokenPair('user-123', context);
      
      // Blacklist the token
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(tokenPair.accessToken);
      await service.revokeToken(decoded.jti, 'user-123', 'Test revocation');

      await expect(
        service.authenticate(tokenPair.accessToken, context)
      ).rejects.toThrow(AppError);
    });
  });

  describe('generateTokenPair', () => {
    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Test-Agent',
      scopes: ['read', 'write'],
    };

    it('should generate valid token pair', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.generateTokenPair('user-123', context);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('sessionId');
      expect(typeof result.accessToken).toBe('string');
      expect(typeof result.refreshToken).toBe('string');
      expect(typeof result.sessionId).toBe('string');
    });

    it('should reject for non-existent user', async () => {
      userRepository.findById.mockResolvedValue(null);

      await expect(
        service.generateTokenPair('nonexistent', context)
      ).rejects.toThrow(AppError);
    });

    it('should include scopes in access token', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const result = await service.generateTokenPair('user-123', context);
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(result.accessToken);

      expect(decoded.scopes).toEqual(['read', 'write']);
    });
  });

  describe('refreshToken', () => {
    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Test-Agent',
    };

    it('should refresh tokens successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const initialTokens = await service.generateTokenPair('user-123', context);
      const refreshedTokens = await service.refreshToken(
        initialTokens.refreshToken,
        context
      );

      expect(refreshedTokens).toHaveProperty('accessToken');
      expect(refreshedTokens).toHaveProperty('refreshToken');
      expect(refreshedTokens).toHaveProperty('sessionId');
      expect(refreshedTokens.accessToken).not.toBe(initialTokens.accessToken);
      expect(refreshedTokens.refreshToken).not.toBe(initialTokens.refreshToken);
    });

    it('should reject invalid refresh token', async () => {
      await expect(
        service.refreshToken('invalid-refresh-token', context)
      ).rejects.toThrow(AppError);
    });

    it('should reject access token used as refresh token', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const tokenPair = await service.generateTokenPair('user-123', context);

      await expect(
        service.refreshToken(tokenPair.accessToken, context)
      ).rejects.toThrow(AppError);
    });
  });

  describe('revokeToken', () => {
    it('should revoke token successfully', async () => {
      await service.revokeToken('jti-123', 'user-123', 'Test revocation');

      const blacklistedTokens = await service.getBlacklistedTokens('user-123');
      expect(blacklistedTokens).toHaveLength(1);
      expect(blacklistedTokens[0].jti).toBe('jti-123');
      expect(blacklistedTokens[0].reason).toBe('Test revocation');
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      const tokenPair = await service.generateTokenPair('user-123', {
        ipAddress: '192.168.1.1',
      });

      await service.revokeSession(tokenPair.sessionId, 'user-123');

      const sessions = await service.getActiveSessions('user-123');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('revokeAllSessions', () => {
    it('should revoke all sessions for user', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      // Create multiple sessions
      await service.generateTokenPair('user-123', { ipAddress: '192.168.1.1' });
      await service.generateTokenPair('user-123', { ipAddress: '192.168.1.2' });

      let sessions = await service.getActiveSessions('user-123');
      expect(sessions.length).toBeGreaterThan(0);

      await service.revokeAllSessions('user-123');

      sessions = await service.getActiveSessions('user-123');
      expect(sessions).toHaveLength(0);
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      userRepository.findById.mockResolvedValue(mockUser);

      await service.generateTokenPair('user-123', { ipAddress: '192.168.1.1' });
      await service.generateTokenPair('user-123', { ipAddress: '192.168.1.2' });

      const sessions = await service.getActiveSessions('user-123');
      expect(sessions.length).toBe(2);
      expect(sessions[0].userId).toBe('user-123');
    });
  });

  describe('getBlacklistedTokens', () => {
    it('should return blacklisted tokens for user', async () => {
      await service.revokeToken('jti-1', 'user-123', 'Reason 1');
      await service.revokeToken('jti-2', 'user-123', 'Reason 2');
      await service.revokeToken('jti-3', 'user-456', 'Reason 3');

      const userTokens = await service.getBlacklistedTokens('user-123');
      expect(userTokens).toHaveLength(2);

      const allTokens = await service.getBlacklistedTokens();
      expect(allTokens).toHaveLength(3);
    });
  });

  describe('configuration', () => {
    it('should return current config', () => {
      const config = service.getConfig();
      expect(config).toHaveProperty('accessTokenExpiry');
      expect(config).toHaveProperty('refreshTokenExpiry');
      expect(config).toHaveProperty('issuer');
    });

    it('should update config', () => {
      service.updateConfig({ accessTokenExpiry: '30m' });
      const config = service.getConfig();
      expect(config.accessTokenExpiry).toBe('30m');
    });
  });
});