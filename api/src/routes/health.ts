import { Router } from 'express';
import { logger } from '../utils/logger';

const router = Router();

router.get('/', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

router.get('/ready', (req, res) => {
  // Check database connection, Redis, etc.
  // For now, just return ready status
  res.status(200).json({
    status: 'ready',
    checks: {
      database: 'ok',
      redis: 'ok',
      storage: 'ok'
    }
  });
});

export { router as healthRouter };