# Atlas2 Development Guide

## Overview

This guide covers everything you need to know to develop, test, and deploy Atlas2. Atlas2 is a microservices application built with TypeScript, React, Node.js, PostgreSQL, and Redis.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   React App     │    │   Node.js API   │    │  Background     │
│   (Frontend)    │◄──►│   (Backend)     │◄──►│  Worker         │
│                 │    │                 │    │                 │
│   Vite + TS     │    │   Express + TS  │    │   BullMQ + TS   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │      PostgreSQL          │
                    │      (Primary Database)   │
                    └─────────────┬─────────────┘
                                 │
                    ┌─────────────▼─────────────┐
                    │         Redis             │
                    │    (Cache + Job Queue)    │
                    └───────────────────────────┘
```

## Quick Start

### Prerequisites

- **Node.js** 18+ 
- **Docker** & **Docker Compose**
- **Git**

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd atlas2

# Run the setup script
./scripts/dev-setup.sh

# Start development environment
make dev
```

### Access Points

- **Web App**: http://localhost:3000
- **API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs
- **Grafana**: http://localhost:3002 (admin/admin123)
- **Prometheus**: http://localhost:9090

## Development Workflow

### 1. Daily Development

```bash
# Start all services
make dev

# View logs
make logs

# Run tests
make test

# Stop services
make stop
```

### 2. Making Changes

```bash
# Work on your changes...

# Run linting
npm run lint

# Run tests
npm test

# Build to verify
npm run build
```

### 3. Database Operations

```bash
# Connect to database
make db-shell

# Reset database
make reset-db

# Run migrations
./scripts/migrate.sh development

# Seed test data
./scripts/seed.sh development
```

## Project Structure

```
atlas2/
├── api/                    # Backend API service
│   ├── controllers/        # Route controllers
│   ├── middleware/         # Express middleware
│   ├── repositories/       # Data access layer
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   ├── utils/             # Utility functions
│   └── tests/             # API tests
├── worker/                # Background worker service
│   ├── services/          # Worker services
│   ├── utils/             # Worker utilities
│   └── tests/             # Worker tests
├── src/                   # Frontend React app
│   ├── components/        # React components
│   ├── hooks/             # Custom hooks
│   ├── pages/             # Page components
│   ├── services/          # API services
│   ├── store/             # State management
│   ├── types/             # TypeScript types
│   └── utils/             # Frontend utilities
├── database/              # Database files
│   ├── migrations/        # Migration scripts
│   └── init.sql          # Initial schema
├── docs/                  # Documentation
├── monitoring/            # Monitoring configuration
├── scripts/               # Development scripts
└── tests/                 # Test files
    ├── unit/              # Unit tests
    ├── integration/       # Integration tests
    └── e2e/               # End-to-end tests
```

## Technology Stack

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Zustand** - State management
- **React Router** - Navigation
- **Tailwind CSS** - Styling

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **TypeScript** - Type safety
- **Winston** - Logging
- **Joi** - Validation
- **JWT** - Authentication

### Database & Cache
- **PostgreSQL** - Primary database
- **Redis** - Cache and job queue
- **BullMQ** - Job queue management

### Testing
- **Jest** - Test framework
- **Supertest** - API testing
- **Playwright** - E2E testing
- **Testing Library** - Component testing

### Monitoring
- **Prometheus** - Metrics
- **Grafana** - Visualization
- **Loki** - Log aggregation
- **Winston** - Structured logging

## Coding Standards

### TypeScript

```typescript
// Use interfaces for type definitions
interface User {
  id: string;
  email: string;
  name: string;
  createdAt: Date;
}

// Use enums for constants
enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

// Use generics for reusable components
interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}
```

### React Components

```typescript
// Use functional components with hooks
interface ButtonProps {
  children: React.ReactNode;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  onClick, 
  variant = 'primary' 
}) => {
  return (
    <button 
      className={`btn btn-${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
};
```

### API Controllers

```typescript
// Use dependency injection
export class UserController {
  constructor(
    private userService: UserService,
    private logger: Logger
  ) {}

  async getUsers(req: Request, res: Response): Promise<void> {
    try {
      const users = await this.userService.getUsers();
      res.json({ success: true, data: users });
    } catch (error) {
      this.logger.error('Failed to get users', error);
      res.status(500).json({ 
        success: false, 
        message: 'Internal server error' 
      });
    }
  }
}
```

## Testing

### Unit Tests

```typescript
// tests/unit/services/user.test.ts
import { UserService } from '@api/services/user.service';
import { mockUserRepository } from '@tests/helpers/test-utils';

describe('UserService', () => {
  let userService: UserService;

  beforeEach(() => {
    userService = new UserService(mockUserRepository);
  });

  it('should create a user', async () => {
    const userData = { email: 'test@example.com', name: 'Test' };
    const user = await userService.createUser(userData);
    
    expect(user.email).toBe(userData.email);
    expect(user.id).toBeValidUuid();
  });
});
```

### Integration Tests

```typescript
// tests/integration/api/auth.test.ts
import request from 'supertest';
import { app } from '@api/app';

describe('Auth API', () => {
  it('should authenticate user', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password' })
      .expect(200);

    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toBeDefined();
  });
});
```

### E2E Tests

```typescript
// tests/e2e/upload.test.ts
import { test, expect } from '@playwright/test';

test('should upload CSV file', async ({ page }) => {
  await page.goto('/');
  
  await page.setInputFiles('input[type="file"]', 'test-files/sample.csv');
  await page.click('[data-testid="upload-button"]');
  
  await expect(page.locator('[data-testid="upload-success"]')).toBeVisible();
});
```

## Database

### Migrations

```sql
-- database/migrations/001_add_users_table.sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(50) DEFAULT 'user',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### Running Migrations

```bash
# Development
./scripts/migrate.sh development

# Test
./scripts/migrate.sh test

# Production
./scripts/migrate.sh production
```

### Seeding Data

```bash
# Seed test data
./scripts/seed.sh development

# Seed test environment
./scripts/seed.sh test
```

## API Development

### Route Structure

```typescript
// api/routes/index.ts
import { Router } from 'express';
import authRoutes from './auth.routes';
import uploadRoutes from './upload.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/upload', uploadRoutes);

export default router;
```

### Controller Pattern

```typescript
// api/controllers/upload.controller.ts
export class UploadController {
  async uploadFile(req: Request, res: Response): Promise<void> {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ 
          success: false, 
          message: 'No file uploaded' 
        });
        return;
      }

      const result = await this.uploadService.processFile(file);
      res.json({ success: true, data: result });
    } catch (error) {
      this.logger.error('Upload failed', error);
      res.status(500).json({ 
        success: false, 
        message: 'Upload failed' 
      });
    }
  }
}
```

### Validation

```typescript
// api/middleware/validation.middleware.ts
import Joi from 'joi';

export const validateBody = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details
      });
      return;
    }
    
    next();
  };
};

// Usage
const createUserSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().min(2).max(100).required(),
  password: Joi.string().min(8).required()
});

router.post('/users', validateBody(createUserSchema), createUser);
```

## Frontend Development

### Component Structure

```typescript
// src/components/common/Button.tsx
interface ButtonProps {
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick
}) => {
  const baseClasses = 'btn';
  const variantClasses = `btn-${variant}`;
  const sizeClasses = `btn-${size}`;
  
  return (
    <button
      className={`${baseClasses} ${variantClasses} ${sizeClasses}`}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
};
```

### State Management

```typescript
// src/store/upload.ts
import { create } from 'zustand';

interface UploadState {
  uploads: Upload[];
  currentUpload: Upload | null;
  isLoading: boolean;
  error: string | null;
  
  // Actions
  setUploads: (uploads: Upload[]) => void;
  addUpload: (upload: Upload) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useUploadStore = create<UploadState>((set) => ({
  uploads: [],
  currentUpload: null,
  isLoading: false,
  error: null,
  
  setUploads: (uploads) => set({ uploads }),
  addUpload: (upload) => set((state) => ({ 
    uploads: [...state.uploads, upload] 
  })),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
```

### API Services

```typescript
// src/services/api.ts
class ApiService {
  private baseURL = import.meta.env.VITE_API_BASE_URL;

  async request<T>(
    endpoint: string, 
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseURL}${endpoint}`;
    
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.statusText}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint);
  }

  async post<T>(endpoint: string, data: any): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiService = new ApiService();
```

## Background Workers

### Job Processing

```typescript
// worker/services/csv-processor.service.ts
export class CsvProcessorService {
  async processFile(jobData: CsvJobData): Promise<void> {
    const { fileId, filePath } = jobData;
    
    try {
      this.logger.info(`Processing CSV file: ${fileId}`);
      
      // Update job status
      await this.jobService.updateJobStatus(fileId, 'processing');
      
      // Process CSV in chunks
      const stream = fs.createReadStream(filePath);
      const parser = csv.parse({ headers: true });
      
      for await (const record of stream.pipe(parser)) {
        await this.processRecord(record, fileId);
      }
      
      // Mark as completed
      await this.jobService.updateJobStatus(fileId, 'completed');
      this.logger.info(`CSV processing completed: ${fileId}`);
      
    } catch (error) {
      this.logger.error(`CSV processing failed: ${fileId}`, error);
      await this.jobService.updateJobStatus(fileId, 'failed');
      throw error;
    }
  }
}
```

### Worker Setup

```typescript
// worker/src/index.ts
import { Worker } from 'bullmq';
import { redisConnection } from './utils/redis';
import { csvProcessorService } from './services/csv-processor.service';

const csvWorker = new Worker(
  'csv-processing',
  async (job) => {
    await csvProcessorService.processFile(job.data);
  },
  {
    connection: redisConnection,
    concurrency: 5,
  }
);

csvWorker.on('completed', (job) => {
  console.log(`Job completed: ${job.id}`);
});

csvWorker.on('failed', (job, err) => {
  console.error(`Job failed: ${job.id}`, err);
});
```

## Environment Configuration

### Development (.env)

```bash
# Database
DATABASE_URL=postgresql://atlas2:password@localhost:5432/atlas2_dev

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key

# File Upload
MAX_FILE_SIZE=3221225472  # 3GB
UPLOAD_DIR=./uploads

# API
API_PORT=3001
API_HOST=localhost

# Frontend
VITE_API_BASE_URL=http://localhost:3001
VITE_MAX_FILE_SIZE=3221225472
```

### Production (.env.production)

```bash
# Use production database URL
DATABASE_URL=postgresql://user:pass@prod-db:5432/atlas2_prod

# Use production Redis
REDIS_URL=redis://prod-redis:6379

# Strong JWT secret
JWT_SECRET=your-production-jwt-secret

# Production settings
NODE_ENV=production
API_PORT=3001
API_HOST=0.0.0.0

# CORS
CORS_ORIGIN=https://your-domain.com
```

## Deployment

### Docker Build

```bash
# Build all services
docker-compose -f docker-compose.prod.yml build

# Deploy to production
docker-compose -f docker-compose.prod.yml up -d
```

### Environment Setup

```bash
# Production environment
export NODE_ENV=production
export DATABASE_URL=postgresql://...
export REDIS_URL=redis://...
export JWT_SECRET=your-production-secret
```

### Health Checks

```bash
# Check API health
curl http://localhost:3001/health

# Check worker health
curl http://localhost:3002/health

# Database connection
docker exec postgres pg_isready
```

## Troubleshooting

### Common Issues

#### Database Connection Failed
```bash
# Check database status
docker-compose ps postgres

# Check logs
docker-compose logs postgres

# Reset database
make reset-db
```

#### Redis Connection Failed
```bash
# Check Redis status
docker-compose ps redis

# Test connection
docker-compose exec redis redis-cli ping
```

#### Build Failures
```bash
# Clear node modules
rm -rf node_modules api/node_modules worker/node_modules

# Reinstall dependencies
npm install && cd api && npm install && cd ../worker && npm install

# Rebuild
docker-compose build --no-cache
```

#### Test Failures
```bash
# Check test environment
docker-compose -f docker-compose.test.yml ps

# Run specific test
npm test -- --testNamePattern="specific test"

# Debug tests
npm run test:debug
```

### Performance Issues

#### Slow API Response
1. Check database query performance
2. Add database indexes
3. Implement caching
4. Use connection pooling

#### High Memory Usage
1. Profile memory usage
2. Check for memory leaks
3. Optimize batch processing
4. Monitor garbage collection

#### Database Locks
1. Identify long-running transactions
2. Optimize queries
3. Use proper isolation levels
4. Implement retry logic

## Best Practices

### Code Quality
- Use TypeScript for type safety
- Write comprehensive tests
- Use ESLint and Prettier
- Implement proper error handling
- Use meaningful variable names

### Security
- Validate all inputs
- Use parameterized queries
- Implement proper authentication
- Use HTTPS in production
- Keep dependencies updated

### Performance
- Use database indexes
- Implement caching strategies
- Optimize bundle size
- Use lazy loading
- Monitor performance metrics

### Monitoring
- Use structured logging
- Track key metrics
- Set up alerts
- Monitor error rates
- Use distributed tracing

## Contributing

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/new-feature

# Make changes...
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/new-feature
```

### Commit Messages

```
feat: add new feature
fix: fix bug in authentication
docs: update API documentation
test: add unit tests for user service
refactor: improve code structure
```

### Code Review

- Ensure tests pass
- Check code coverage
- Verify documentation
- Review security implications
- Validate performance impact

## Resources

### Documentation
- [React Documentation](https://react.dev/)
- [Node.js Documentation](https://nodejs.org/docs/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Redis Documentation](https://redis.io/documentation)

### Tools
- [TypeScript](https://www.typescriptlang.org/)
- [Jest](https://jestjs.io/)
- [Playwright](https://playwright.dev/)
- [Docker](https://docs.docker.com/)
- [Grafana](https://grafana.com/docs/)

### Community
- [Stack Overflow](https://stackoverflow.com/)
- [GitHub Discussions](https://github.com/features/discussions)
- [Reddit r/node](https://www.reddit.com/r/node/)
- [Reddit r/reactjs](https://www.reddit.com/r/reactjs/)