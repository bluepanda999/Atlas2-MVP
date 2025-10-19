import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const requestCounts = new Map<string, { count: number; resetTime: number }>();

const RATE_LIMIT = {
  windowMs: 60 * 1000, // 1 minute
  maxRequests: 100, // requests per window
  uploadMaxRequests: 10 // upload-specific limit
};

export const rateLimiter = (req: Request, res: Response, next: NextFunction) => {
  const clientId = req.ip || 'unknown';
  const now = Date.now();
  const isUploadRoute = req.path.includes('/upload');
  const maxRequests = isUploadRoute ? RATE_LIMIT.uploadMaxRequests : RATE_LIMIT.maxRequests;

  // Clean up old entries
  for (const [key, value] of requestCounts.entries()) {
    if (now > value.resetTime) {
      requestCounts.delete(key);
    }
  }

  // Check current client
  const clientData = requestCounts.get(clientId);
  
  if (!clientData) {
    // First request from this client
    requestCounts.set(clientId, {
      count: 1,
      resetTime: now + RATE_LIMIT.windowMs
    });
    return next();
  }

  if (now > clientData.resetTime) {
    // Window has reset
    clientData.count = 1;
    clientData.resetTime = now + RATE_LIMIT.windowMs;
    return next();
  }

  if (clientData.count >= maxRequests) {
    logger.warn(`Rate limit exceeded for ${clientId}`, {
      path: req.path,
      count: clientData.count,
      maxRequests
    });

    return res.status(429).json({
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Maximum ${maxRequests} requests per ${RATE_LIMIT.windowMs / 1000} seconds.`,
      retryAfter: Math.ceil((clientData.resetTime - now) / 1000)
    });
  }

  clientData.count++;
  next();
};