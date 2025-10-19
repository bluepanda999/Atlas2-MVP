import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import { fileUploadRouter } from './routes/upload';
import { apiRouter } from './routes/api';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Performance middleware
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
app.use(rateLimiter);

// Logging
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });
  next();
});

// Routes
app.use('/health', healthRouter);
app.use('/api/upload', fileUploadRouter);
app.use('/api', apiRouter);
app.use('/auth', authRouter);

// Error handling
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found`
  });
});

app.listen(PORT, () => {
  logger.info(`Atlas2 API Server running on port ${PORT}`);
});

export default app;