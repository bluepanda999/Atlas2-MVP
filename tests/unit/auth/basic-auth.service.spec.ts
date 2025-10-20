import { Test, TestingModule } from '@nestjs/testing';
import { BasicAuthService } from '../../../../api/services/basic-auth.service';
import { UserRepository } from '../../../../api/repositories/user.repository';
import { LoggingService } from '../../../../api/services/logging.service';
import { AppError } from '../../../../api/utils/errors';

describe('BasicAuthService', () => {
  let service: BasicAuthService;
  let userRepository: jest.Mocked<UserRepository>;
  let loggingService: jest.Mocked<LoggingService>;

  const mockUser = {
    id: 'user-123',
    email: 'test@example.com',
    password: '$2a$12$hashedpassword',
    role: 'user',
    isActive: true,
  };

  beforeEach(async () => {
    const mockUserRepository = {
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      updateLastLogin: jest.fn(),
    };

    const mockLoggingService = {
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BasicAuthService,
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

    service = module.get<BasicAuthService>(BasicAuthService);
    userRepository = module.get(UserRepository);
    loggingService = module.get(LoggingService);
  });

  describe('authenticate', () => {
    const context = {
      ipAddress: '192.168.1.1',
      userAgent: 'Test-Agent',
    };

    it('should authenticate successfully with valid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);

      const result = await service.authenticate(
        { username: 'test@example.com', password: 'password123' },
        context
      );

      expect(result).toEqual({
        userId: 'user-123',
        email: 'test@example.com',
        role: 'user',
        isAuthenticated: true,
      });
      expect(userRepository.updateLastLogin).toHaveBeenCalledWith('user-123');
      expect(loggingService.info).toHaveBeenCalled();
    });

    it('should reject invalid credentials', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

      await expect(
        service.authenticate(
          { username: 'test@example.com', password: 'wrongpassword' },
          context
        )
      ).rejects.toThrow(AppError);

      expect(loggingService.warn).toHaveBeenCalled();
    });

    it('should reject non-existent user', async () => {
      userRepository.findByEmail.mockResolvedValue(null);

      await expect(
        service.authenticate(
          { username: 'nonexistent@example.com', password: 'password123' },
          context
        )
      ).rejects.toThrow(AppError);
    });

    it('should reject inactive user', async () => {
      const inactiveUser = { ...mockUser, isActive: false };
      userRepository.findByEmail.mockResolvedValue(inactiveUser);

      await expect(
        service.authenticate(
          { username: 'test@example.com', password: 'password123' },
          context
        )
      ).rejects.toThrow(AppError);
    });

    it('should reject user with restricted role', async () => {
      const adminUser = { ...mockUser, role: 'admin' };
      userRepository.findByEmail.mockResolvedValue(adminUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(true);

      await expect(
        service.authenticate(
          { username: 'admin@example.com', password: 'password123' },
          context
        )
      ).rejects.toThrow(AppError);
    });

    it('should handle missing username or password', async () => {
      await expect(
        service.authenticate({ username: '', password: 'password123' }, context)
      ).rejects.toThrow(AppError);

      await expect(
        service.authenticate({ username: 'test@example.com', password: '' }, context)
      ).rejects.toThrow(AppError);
    });

    it('should enforce rate limiting', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        try {
          await service.authenticate(
            { username: 'test@example.com', password: 'wrongpassword' },
            context
          );
        } catch (error) {
          // Expected to fail
        }
      }

      // Should be locked out now
      await expect(
        service.authenticate(
          { username: 'test@example.com', password: 'password123' },
          context
        )
      ).rejects.toThrow(AppError);
    });
  });

  describe('generateChallengeHeader', () => {
    it('should generate correct challenge header', () => {
      const header = service.generateChallengeHeader();
      expect(header).toBe('Basic realm="Atlas2 API", charset="UTF-8"');
    });
  });

  describe('getAuthenticationAttempts', () => {
    it('should return authentication attempts', async () => {
      // Make some attempts first
      try {
        await service.authenticate(
          { username: 'test@example.com', password: 'wrong' },
          { ipAddress: '192.168.1.1' }
        );
      } catch (error) {
        // Expected
      }

      const attempts = await service.getAuthenticationAttempts();
      expect(Array.isArray(attempts)).toBe(true);
    });
  });

  describe('isUserLockedOut', () => {
    it('should check if user is locked out', async () => {
      userRepository.findByEmail.mockResolvedValue(mockUser);
      jest.spyOn(require('bcryptjs'), 'compare').mockResolvedValue(false);

      // Make multiple failed attempts
      for (let i = 0; i < 6; i++) {
        try {
          await service.authenticate(
            { username: 'test@example.com', password: 'wrongpassword' },
            { ipAddress: '192.168.1.1' }
          );
        } catch (error) {
          // Expected to fail
        }
      }

      const isLockedOut = await service.isUserLockedOut(
        'test@example.com',
        '192.168.1.1'
      );
      expect(isLockedOut).toBe(true);
    });
  });

  describe('getRemainingAttempts', () => {
    it('should return remaining attempts', () => {
      const remaining = service.getRemainingAttempts('test@example.com', '192.168.1.1');
      expect(remaining).toBe(5); // Default max attempts
    });
  });

  describe('configuration', () => {
    it('should return current config', () => {
      const config = service.getConfig();
      expect(config).toHaveProperty('enabled');
      expect(config).toHaveProperty('realm');
      expect(config).toHaveProperty('maxAttempts');
    });

    it('should update config', () => {
      service.updateConfig({ maxAttempts: 10 });
      const config = service.getConfig();
      expect(config.maxAttempts).toBe(10);
    });
  });
});