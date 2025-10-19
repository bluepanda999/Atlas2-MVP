import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/user.repository';
import { AppError } from '../utils/errors';

// Extend Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

export class AuthMiddleware {
  constructor(private userRepository: UserRepository) {}

  authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new AppError('Access token required', 401);
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      // Get user
      const user = await this.userRepository.findById(decoded.userId);
      if (!user || !user.isActive) {
        throw new AppError('Invalid token', 401);
      }

      // Add user to request
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };

      next();
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        next(new AppError('Invalid token', 401));
      } else {
        next(error);
      }
    }
  };

  authorize = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
      if (!req.user) {
        return next(new AppError('Authentication required', 401));
      }

      if (!roles.includes(req.user.role)) {
        return next(new AppError('Insufficient permissions', 403));
      }

      next();
    };
  };

  optional = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return next(); // No token, continue without authentication
      }

      const token = authHeader.substring(7);
      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      
      const user = await this.userRepository.findById(decoded.userId);
      if (user && user.isActive) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role,
        };
      }

      next();
    } catch (error) {
      // Ignore token errors for optional authentication
      next();
    }
  };
}