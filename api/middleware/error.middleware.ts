import { Request, Response, NextFunction } from 'express';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

export class ErrorMiddleware {
  handle = (error: Error, req: Request, res: Response, next: NextFunction): void => {
    let statusCode = 500;
    let message = 'Internal server error';
    let details: any = undefined;

    // Handle known application errors
    if (error instanceof AppError) {
      statusCode = error.statusCode;
      message = error.message;
      details = error.details;
    }
    // Handle validation errors
    else if (error.name === 'ValidationError') {
      statusCode = 400;
      message = 'Validation failed';
      details = error.message;
    }
    // Handle JWT errors
    else if (error.name === 'JsonWebTokenError') {
      statusCode = 401;
      message = 'Invalid token';
    }
    else if (error.name === 'TokenExpiredError') {
      statusCode = 401;
      message = 'Token expired';
    }
    // Handle database errors
    else if (error.name === 'QueryResultError') {
      statusCode = 404;
      message = 'Resource not found';
    }
    // Handle multer errors
    else if (error.name === 'MulterError') {
      if (error.message.includes('File too large')) {
        statusCode = 413;
        message = 'File too large';
      } else if (error.message.includes('Unexpected field')) {
        statusCode = 400;
        message = 'Invalid file field';
      } else {
        statusCode = 400;
        message = 'File upload error';
      }
    }

    // Log error
    logger.error('API Error:', {
      error: error.message,
      stack: error.stack,
      url: req.url,
      method: req.method,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      userId: req.user?.id,
    });

    // Send error response
    const errorResponse = {
      success: false,
      error: {
        message,
        ...(details && { details }),
        ...(process.env.NODE_ENV === 'development' && {
          stack: error.stack,
          originalError: error.message,
        }),
      },
      timestamp: new Date().toISOString(),
    };

    res.status(statusCode).json(errorResponse);
  };

  notFound = (req: Request, res: Response, next: NextFunction): void => {
    const error = new AppError(`Route ${req.originalUrl} not found`, 404);
    next(error);
  };

  // Async error wrapper
  asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
    return (req: Request, res: Response, next: NextFunction) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  };
}