import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service';
import { ApiResponse } from '../types/api';
import { LoginRequest, RegisterRequest, AuthResponse } from '../types/auth';

export class AuthController {
  constructor(private authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result: AuthResponse = await this.authService.login(loginData);
      
      const response: ApiResponse<AuthResponse> = {
        success: true,
        data: result,
        message: 'Login successful',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  register = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const registerData: RegisterRequest = req.body;
      const result: AuthResponse = await this.authService.register(registerData);
      
      const response: ApiResponse<AuthResponse> = {
        success: true,
        data: result,
        message: 'Registration successful',
      };
      
      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const result: AuthResponse = await this.authService.refreshToken(refreshToken);
      
      const response: ApiResponse<AuthResponse> = {
        success: true,
        data: result,
        message: 'Token refreshed successfully',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (userId) {
        await this.authService.logout(userId);
      }
      
      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Logout successful',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  getProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const user = await this.authService.getProfile(userId);
      
      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
        message: 'Profile retrieved successfully',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  updateProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const updates = req.body;
      const user = await this.authService.updateProfile(userId, updates);
      
      const response: ApiResponse<typeof user> = {
        success: true,
        data: user,
        message: 'Profile updated successfully',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        throw new Error('User not authenticated');
      }
      
      const { currentPassword, newPassword } = req.body;
      await this.authService.changePassword(userId, currentPassword, newPassword);
      
      const response: ApiResponse<null> = {
        success: true,
        data: null,
        message: 'Password changed successfully',
      };
      
      res.json(response);
    } catch (error) {
      next(error);
    }
  };
}