import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { config } from './config/config';
import { logger } from './utils/logger';
import { DatabaseService } from './services/database.service';
import { UserRepository } from './repositories/user.repository';
import { UploadRepository } from './repositories/upload.repository';
import { MappingRepository } from './repositories/mapping.repository';
import { IntegrationRepository } from './repositories/integration.repository';
import { AuthService } from './services/auth.service';
import { UploadService } from './services/upload.service';
import { MappingService } from './services/mapping.service';
import { IntegrationService } from './services/integration.service';
import { JobQueueService } from './services/job-queue.service';
import { AuthController } from './controllers/auth.controller';
import { UploadController } from './controllers/upload.controller';
import { MappingController } from './controllers/mapping.controller';
import { IntegrationController } from './controllers/integration.controller';
import { AuthMiddleware } from './middleware/auth.middleware';
import { ErrorMiddleware } from './middleware/error.middleware';
import { createRoutes } from './routes';

class Application {
  public app: express.Application;
  private databaseService: DatabaseService;
  private jobQueueService: JobQueueService;

  constructor() {
    this.app = express();
    this.databaseService = new DatabaseService();
    this.jobQueueService = new JobQueueService();
  }

  public async initialize(): Promise<void> {
    try {
      // Initialize database
      await this.databaseService.connect();
      logger.info('Database connected successfully');

      // Initialize job queue
      await this.jobQueueService.initialize();
      logger.info('Job queue initialized successfully');

      // Setup middleware
      this.setupMiddleware();

      // Setup routes
      this.setupRoutes();

      // Setup error handling
      this.setupErrorHandling();

      logger.info('Application initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors({
      origin: config.cors.origins,
      credentials: true,
    }));

    // Rate limiting
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: config.rateLimit.max, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
    });
    this.app.use('/api', limiter);

    // General middleware
    this.app.use(compression());
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
      });
      next();
    });
  }

  private setupRoutes(): void {
    // Initialize services
    const userRepository = new UserRepository(this.databaseService);
    const uploadRepository = new UploadRepository(this.databaseService);
    const mappingRepository = new MappingRepository(this.databaseService);
    const integrationRepository = new IntegrationRepository(this.databaseService);

    const authService = new AuthService(userRepository);
    const uploadService = new UploadService(uploadRepository, this.jobQueueService);
    const mappingService = new MappingService(mappingRepository);
    const integrationService = new IntegrationService(integrationRepository);

    // Initialize controllers
    const authController = new AuthController(authService);
    const uploadController = new UploadController(uploadService);
    const mappingController = new MappingController(mappingService);
    const integrationController = new IntegrationController(integrationService);

    // Initialize middleware
    const authMiddleware = new AuthMiddleware(userRepository);
    const errorMiddleware = new ErrorMiddleware();

    // Setup routes
    this.app.use('/api', createRoutes(
      authController,
      uploadController,
      mappingController,
      integrationController,
      authMiddleware,
      errorMiddleware
    ));

    // Root endpoint
    this.app.get('/', (req, res) => {
      res.json({
        name: 'Atlas2 API',
        version: process.env.npm_package_version || '1.0.0',
        status: 'running',
        timestamp: new Date().toISOString(),
      });
    });
  }

  private setupErrorHandling(): void {
    const errorMiddleware = new ErrorMiddleware();
    
    // 404 handler
    this.app.use(errorMiddleware.notFound);
    
    // Global error handler
    this.app.use(errorMiddleware.handle);
  }

  public async start(): Promise<void> {
    const port = config.port || 3000;
    
    this.app.listen(port, () => {
      logger.info(`Server running on port ${port}`);
      logger.info(`Environment: ${config.nodeEnv}`);
      logger.info(`API Base URL: http://localhost:${port}/api`);
    });
  }

  public async shutdown(): Promise<void> {
    logger.info('Shutting down application...');
    
    // Close database connection
    await this.databaseService.disconnect();
    
    // Close job queue
    await this.jobQueueService.shutdown();
    
    logger.info('Application shutdown complete');
  }
}

// Handle graceful shutdown
const app = new Application();

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await app.shutdown();
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Start the application
if (require.main === module) {
  app.initialize()
    .then(() => app.start())
    .catch((error) => {
      logger.error('Failed to start application:', error);
      process.exit(1);
    });
}

export default app;