import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { LoginRequest, RegisterRequest, AuthResponse, User } from '../types/auth';
import { AppError } from '../utils/errors';

export class AuthService {
  constructor(private userRepository: UserRepository) {}

  async login(loginData: LoginRequest): Promise<AuthResponse> {
    const { email, password } = loginData;

    // Find user by email
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new AppError('Invalid credentials', 401);
    }

    // Check if user is active
    if (!user.isActive) {
      throw new AppError('Account is deactivated', 401);
    }

    // Generate tokens
    const token = this.generateToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async register(registerData: RegisterRequest): Promise<AuthResponse> {
    const { email, password, name, role = 'user' } = registerData;

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(email);
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    // Hash password
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create user
    const user = await this.userRepository.create({
      email,
      password: hashedPassword,
      name,
      role,
      isActive: true,
    });

    // Generate tokens
    const token = this.generateToken(user.id);
    const refreshToken = this.generateRefreshToken(user.id);

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      token,
      refreshToken,
    };
  }

  async refreshToken(refreshToken: string): Promise<AuthResponse> {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { userId: string };
      
      // Find user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('Invalid refresh token', 401);
      }

      // Generate new tokens
      const token = this.generateToken(user.id);
      const newRefreshToken = this.generateRefreshToken(user.id);

      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;

      return {
        user: userWithoutPassword,
        token,
        refreshToken: newRefreshToken,
      };
    } catch (error) {
      throw new AppError('Invalid refresh token', 401);
    }
  }

  async logout(userId: string): Promise<void> {
    // In a real implementation, you might want to invalidate the refresh token
    // by storing it in a blacklist or using a token store
    await this.userRepository.updateLastLogout(userId);
  }

  async getProfile(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async updateProfile(userId: string, updates: Partial<User>): Promise<User> {
    // Don't allow password updates through this method
    const { password, ...safeUpdates } = updates;

    const user = await this.userRepository.update(userId, safeUpdates);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Return user data without password
    const { password: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new AppError('Current password is incorrect', 400);
    }

    // Hash new password
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await this.userRepository.updatePassword(userId, hashedNewPassword);
  }

  private generateToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_SECRET!,
      { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
    );
  }

  private generateRefreshToken(userId: string): string {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
    );
  }
}