import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ErrorTrackingService } from '../services/error-tracking.service';

@Injectable()
export class ErrorTrackingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ErrorTrackingMiddleware.name);

  constructor(private readonly errorTrackingService: ErrorTrackingService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    // Store original end function
    const originalEnd = res.end;

    // Override end function to capture errors
    res.end = function(this: Response, ...args: any[]) {
      // Check if there was an error
      if (res.statusCode >= 400) {
        const error = new Error(`HTTP ${res.statusCode}: ${req.method} ${req.url}`);
        
        ErrorTrackingMiddleware.prototype.errorTrackingService.trackError(error, {
          type: 'HttpError',
          severity: res.statusCode >= 500 ? 'high' : 'medium',
          context: {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            headers: req.headers,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
          userContext: {
            id: (req as any).user?.id,
            sessionId: (req as any).sessionId,
            userAgent: req.headers['user-agent'],
            ip: req.ip,
          },
          tags: ['http', `status-${res.statusCode}`],
          requestId: (req as any).requestId,
        });
      }

      // Call original end function
      return originalEnd.apply(this, args);
    };

    next();
  }
}

// Global error handler filter
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class GlobalErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalErrorFilter.name);

  constructor(private readonly errorTrackingService: ErrorTrackingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;
    let error: Error;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        message = (exceptionResponse as any).message || exception.message;
      } else {
        message = exception.message;
      }
      
      error = new Error(message);
    } else if (exception instanceof Error) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = exception.message;
      error = exception;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      error = new Error(String(exception));
    }

    // Track the error
    this.errorTrackingService.trackError(error, {
      type: exception instanceof HttpException ? 'HttpException' : 'UnhandledError',
      severity: status >= 500 ? 'critical' : status >= 400 ? 'high' : 'medium',
      context: {
        method: request.method,
        url: request.url,
        statusCode: status,
        headers: request.headers,
        body: request.body,
        query: request.query,
        params: request.params,
        controller: request.route?.path,
        action: request.method,
      },
      userContext: {
        id: (request as any).user?.id,
        email: (request as any).user?.email,
        role: (request as any).user?.role,
        sessionId: (request as any).sessionId,
        userAgent: request.headers['user-agent'],
        ip: request.ip,
      },
      tags: [
        'exception',
        exception instanceof HttpException ? 'http-exception' : 'unhandled',
        `status-${status}`,
        request.method.toLowerCase(),
      ],
      requestId: (request as any).requestId,
    });

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      error.stack,
      'GlobalErrorFilter'
    );

    // Send error response
    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message: status === 500 ? 'Internal server error' : message,
      requestId: (request as any).requestId,
    };

    response.status(status).json(errorResponse);
  }
}