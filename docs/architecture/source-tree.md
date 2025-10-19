# Atlas2 Source Tree Structure

**Version:** 1.0.0  
**Last Updated:** October 19, 2025  

## Overview

This document describes the complete source tree structure of the Atlas2 application, explaining the purpose of each directory and file, and providing guidelines for organizing code within the project.

---

## Root Directory Structure

```
atlas2/
├── api/                          # Backend API service
├── worker/                       # Background processing service
├── src/                          # Frontend React application
├── database/                     # Database schemas and migrations
├── infrastructure/               # Docker and deployment configs
├── monitoring/                   # Monitoring and observability configs
├── docs/                         # Project documentation
├── tests/                        # Test files and fixtures
├── scripts/                      # Build and utility scripts
├── public/                       # Static assets
├── uploads/                      # File upload storage (runtime)
├── logs/                         # Application logs (runtime)
├── .env.example                  # Environment variables template
├── .dockerignore                 # Docker ignore file
├── .gitignore                    # Git ignore file
├── docker-compose.dev.yml        # Development environment
├── docker-compose.prod.yml       # Production environment
├── Dockerfile                    # Production build
├── Dockerfile.dev                # Development build
├── Dockerfile.api                # API service build
├── Dockerfile.worker             # Worker service build
├── nginx.conf                    # Nginx configuration
├── package.json                  # Node.js dependencies
├── tsconfig.json                 # TypeScript configuration
├── vite.config.ts                # Vite build configuration
└── README.md                     # Project documentation
```

---

## Frontend Structure (`src/`)

```
src/
├── components/                   # Reusable UI components
│   ├── common/                   # Generic components
│   │   ├── Button/
│   │   │   ├── Button.tsx
│   │   │   ├── Button.test.tsx
│   │   │   ├── Button.styles.ts
│   │   │   └── index.ts
│   │   ├── Input/
│   │   ├── Modal/
│   │   └── Loading/
│   ├── forms/                    # Form-specific components
│   │   ├── FileUpload/
│   │   ├── FieldMapping/
│   │   └── ApiConfig/
│   ├── layout/                   # Layout components
│   │   ├── Header/
│   │   ├── Sidebar/
│   │   ├── Footer/
│   │   └── MainLayout/
│   └── features/                 # Feature-specific components
│       ├── csv-upload/
│       ├── field-mapping/
│       ├── api-integration/
│       └── monitoring/
├── pages/                        # Page-level components
│   ├── Dashboard/
│   │   ├── Dashboard.tsx
│   │   ├── Dashboard.test.tsx
│   │   ├── components/
│   │   └── hooks/
│   ├── Upload/
│   ├── Mapping/
│   ├── Integration/
│   ├── Settings/
│   └── Auth/
├── hooks/                        # Custom React hooks
│   ├── useApi.ts                 # API call hook
│   ├── useAuth.ts                # Authentication hook
│   ├── useFileUpload.ts          # File upload hook
│   ├── useWebSocket.ts           # WebSocket hook
│   └── useLocalStorage.ts        # Local storage hook
├── store/                        # State management
│   ├── index.ts                  # Store configuration
│   ├── authStore.ts              # Authentication state
│   ├── uploadStore.ts            # Upload state
│   ├── mappingStore.ts           # Mapping state
│   └── settingsStore.ts          # Settings state
├── services/                     # External service integrations
│   ├── api.ts                    # API client
│   ├── auth.ts                   # Authentication service
│   ├── websocket.ts              # WebSocket client
│   └── storage.ts                # Local storage service
├── utils/                        # Utility functions
│   ├── validation.ts             # Form validation
│   ├── formatting.ts             # Data formatting
│   ├── constants.ts              # Application constants
│   ├── helpers.ts                # Helper functions
│   └── types.ts                  # Type definitions
├── styles/                       # Global styles and themes
│   ├── globals.css               # Global CSS
│   ├── variables.css             # CSS variables
│   ├── themes/                   # Theme definitions
│   │   ├── light.ts
│   │   └── dark.ts
│   └── components/               # Component-specific styles
├── assets/                       # Static assets
│   ├── images/
│   ├── icons/
│   └── fonts/
├── types/                        # TypeScript type definitions
│   ├── api.ts                    # API types
│   ├── auth.ts                   # Authentication types
│   ├── upload.ts                 # Upload types
│   ├── mapping.ts                # Mapping types
│   └── common.ts                 # Common types
├── App.tsx                       # Root application component
├── main.tsx                      # Application entry point
└── vite-env.d.ts                # Vite type definitions
```

### Component Organization Guidelines

#### Component Structure
Each component should follow this structure:
```
ComponentName/
├── ComponentName.tsx          # Main component file
├── ComponentName.test.tsx     # Unit tests
├── ComponentName.styles.ts    # Styled components or CSS
├── ComponentName.stories.tsx  # Storybook stories (optional)
├── hooks/                     # Component-specific hooks
├── utils/                     # Component-specific utilities
└── index.ts                   # Export barrel
```

#### Naming Conventions
- **Components**: PascalCase (e.g., `FileUpload`, `UserProfile`)
- **Files**: kebab-case for directories, PascalCase for component files
- **Hooks**: camelCase with `use` prefix (e.g., `useFileUpload`)
- **Utilities**: camelCase (e.g., `formatDate`, `validateEmail`)

---

## Backend API Structure (`api/`)

```
api/
├── src/
│   ├── controllers/              # Request handlers
│   │   ├── authController.ts
│   │   ├── uploadController.ts
│   │   ├── mappingController.ts
│   │   ├── transformationController.ts
│   │   └── userController.ts
│   ├── services/                 # Business logic
│   │   ├── authService.ts
│   │   ├── uploadService.ts
│   │   ├── mappingService.ts
│   │   ├── transformationService.ts
│   │   └── emailService.ts
│   ├── repositories/             # Data access layer
│   │   ├── userRepository.ts
│   │   ├── fileUploadRepository.ts
│   │   ├── mappingRepository.ts
│   │   └── jobRepository.ts
│   ├── middleware/               # Express middleware
│   │   ├── auth.ts
│   │   ├── validation.ts
│   │   ├── errorHandler.ts
│   │   ├── rateLimiter.ts
│   │   └── logging.ts
│   ├── routes/                   # Route definitions
│   │   ├── auth.ts
│   │   ├── upload.ts
│   │   ├── mapping.ts
│   │   ├── transformation.ts
│   │   ├── api.ts
│   │   └── health.ts
│   ├── models/                   # Data models
│   │   ├── User.ts
│   │   ├── FileUpload.ts
│   │   ├── FieldMapping.ts
│   │   ├── ProcessingJob.ts
│   │   └── index.ts
│   ├── utils/                    # Utility functions
│   │   ├── logger.ts
│   │   ├── validation.ts
│   │   ├── encryption.ts
│   │   ├── constants.ts
│   │   └── helpers.ts
│   ├── types/                    # TypeScript types
│   │   ├── api.ts
│   │   ├── auth.ts
│   │   ├── database.ts
│   │   └── common.ts
│   ├── config/                   # Configuration
│   │   ├── database.ts
│   │   ├── redis.ts
│   │   ├── auth.ts
│   │   └── index.ts
│   ├── tests/                    # Test files
│   │   ├── unit/
│   │   ├── integration/
│   │   └── fixtures/
│   ├── index.ts                  # Application entry point
│   └── app.ts                    # Express app setup
├── package.json                  # API-specific dependencies
├── tsconfig.json                 # TypeScript configuration
└── Dockerfile                    # Docker build file
```

### API Organization Guidelines

#### Controller Structure
```typescript
// controllers/exampleController.ts
export class ExampleController {
  constructor(
    private exampleService: ExampleService,
    private logger: Logger
  ) {}

  async getExample(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await this.exampleService.getExample(req.params.id);
      res.json({ success: true, data: result });
    } catch (error) {
      next(error);
    }
  }
}
```

#### Service Structure
```typescript
// services/exampleService.ts
export class ExampleService {
  constructor(
    private exampleRepository: ExampleRepository,
    private logger: Logger
  ) {}

  async getExample(id: string): Promise<Example> {
    const example = await this.exampleRepository.findById(id);
    if (!example) {
      throw new NotFoundError('Example not found');
    }
    return example;
  }
}
```

---

## Worker Structure (`worker/`)

```
worker/
├── src/
│   ├── processors/               # Job processors
│   │   ├── csvProcessor.ts       # CSV file processing
│   │   ├── transformationProcessor.ts # Data transformation
│   │   ├── apiProcessor.ts       # API integration
│   │   └── reportProcessor.ts    # Report generation
│   ├── jobs/                     # Job definitions
│   │   ├── csvProcessingJob.ts
│   │   ├── transformationJob.ts
│   │   ├── apiIntegrationJob.ts
│   │   └── cleanupJob.ts
│   ├── queues/                   # Queue management
│   │   ├── jobQueue.ts
│   │   ├── priorityQueue.ts
│   │   └── deadLetterQueue.ts
│   ├── services/                 # Worker services
│   │   ├── fileService.ts
│   │   ├── validationService.ts
│   │   ├── transformationService.ts
│   │   └── notificationService.ts
│   ├── utils/                    # Worker utilities
│   │   ├── logger.ts
│   │   ├── metrics.ts
│   │   ├── errorHandler.ts
│   │   └── workerHelpers.ts
│   ├── types/                    # Worker types
│   │   ├── job.ts
│   │   ├── processor.ts
│   │   └── queue.ts
│   ├── config/                   # Worker configuration
│   │   ├── queue.ts
│   │   ├── processor.ts
│   │   └── index.ts
│   ├── tests/                    # Worker tests
│   ├── index.ts                  # Worker entry point
│   └── worker.ts                 # Worker setup
├── package.json                  # Worker-specific dependencies
├── tsconfig.json                 # TypeScript configuration
└── Dockerfile                    # Docker build file
```

---

## Database Structure (`database/`)

```
database/
├── migrations/                   # Database migrations
│   ├── 001_initial_schema.sql
│   ├── 002_add_user_sessions.sql
│   ├── 003_add_file_processing.sql
│   └── 004_add_indexes.sql
├── seeds/                        # Seed data
│   ├── users.sql
│   ├── default_settings.sql
│   └── sample_data.sql
├── functions/                    # Database functions
│   ├── update_updated_at.sql
│   ├── generate_uuid.sql
│   └── user_permissions.sql
├── triggers/                     # Database triggers
│   ├── audit_triggers.sql
│   ├── update_timestamps.sql
│   └── data_validation.sql
├── views/                        # Database views
│   ├── user_summary.sql
│   ├── job_statistics.sql
│   └── system_metrics.sql
├── procedures/                   # Stored procedures
│   ├── cleanup_old_data.sql
│   ├── generate_reports.sql
│   └── user_management.sql
├── init.sql                      # Initial database setup
├── schema.sql                    # Complete schema definition
└── README.md                     # Database documentation
```

---

## Infrastructure Structure (`infrastructure/`)

```
infrastructure/
├── docker/                       # Docker configurations
│   ├── nginx/
│   │   ├── nginx.conf
│   │   ├── ssl/
│   │   └── sites-available/
│   ├── postgres/
│   │   ├── init.sql
│   │   └── postgresql.conf
│   └── redis/
│       └── redis.conf
├── kubernetes/                   # Kubernetes manifests (future)
│   ├── namespaces/
│   ├── deployments/
│   ├── services/
│   ├── configmaps/
│   └── secrets/
├── terraform/                    # Terraform configurations (future)
│   ├── modules/
│   ├── environments/
│   └── variables/
├── scripts/                      # Deployment scripts
│   ├── deploy.sh
│   ├── backup.sh
│   ├── restore.sh
│   └── health-check.sh
└── monitoring/                   # Infrastructure monitoring
    ├── prometheus/
    ├── grafana/
    └── alertmanager/
```

---

## Monitoring Structure (`monitoring/`)

```
monitoring/
├── prometheus/
│   ├── prometheus.yml            # Prometheus configuration
│   ├── rules/                    # Alerting rules
│   │   ├── application.yml
│   │   ├── infrastructure.yml
│   │   └── business.yml
│   └── targets/                  # Service discovery
├── grafana/
│   ├── dashboards/               # Grafana dashboards
│   │   ├── overview.json
│   │   ├── application.json
│   │   ├── infrastructure.json
│   │   └── business.json
│   ├── datasources/              # Data source configurations
│   │   └── prometheus.yml
│   └── provisioning/             # Auto-provisioning configs
│       ├── dashboards/
│       └── datasources/
├── alertmanager/
│   ├── alertmanager.yml          # Alert manager configuration
│   └── templates/                # Alert templates
└── logs/                         # Log aggregation configs
    ├── fluentd/
    ├── elasticsearch/
    └── kibana/
```

---

## Documentation Structure (`docs/`)

```
docs/
├── architecture/                 # Architecture documentation
│   ├── architecture.md          # Main architecture document
│   ├── coding-standards.md      # Coding standards
│   ├── tech-stack.md            # Technology stack
│   ├── source-tree.md           # Source tree structure
│   └── api/                     # API documentation
│       ├── openapi.yaml
│       └── postman-collection.json
├── deployment/                   # Deployment documentation
│   ├── deployment.md            # Deployment guide
│   ├── docker.md                # Docker setup
│   ├── kubernetes.md            # Kubernetes setup
│   └── monitoring.md            # Monitoring setup
├── development/                  # Development documentation
│   ├── getting-started.md       # Getting started guide
│   ├── contributing.md          # Contributing guidelines
│   ├── testing.md               # Testing guidelines
│   └── troubleshooting.md       # Troubleshooting guide
├── user/                         # User documentation
│   ├── user-guide.md            # User guide
│   ├── api-reference.md         # API reference
│   └── faq.md                   # Frequently asked questions
├── epics/                        # Epic definitions
│   ├── epic-1-csv-upload-processing.md
│   ├── epic-2-api-client-generation.md
│   └── ...
├── stories/                      # User stories
│   ├── epic-1-story-1-csv-upload-interface.md
│   └── ...
└── assets/                       # Documentation assets
    ├── images/
    ├── diagrams/
    └── screenshots/
```

---

## Test Structure (`tests/`)

```
tests/
├── unit/                         # Unit tests
│   ├── components/               # Component tests
│   ├── services/                 # Service tests
│   ├── utils/                    # Utility tests
│   └── hooks/                    # Hook tests
├── integration/                  # Integration tests
│   ├── api/                      # API integration tests
│   ├── database/                 # Database integration tests
│   └── workflows/                # Workflow tests
├── e2e/                          # End-to-end tests
│   ├── auth/                     # Authentication flows
│   ├── upload/                   # File upload flows
│   ├── mapping/                  # Field mapping flows
│   └── integration/              # API integration flows
├── fixtures/                     # Test data
│   ├── csv/                      # Sample CSV files
│   ├── json/                     # JSON test data
│   └── images/                   # Test images
├── mocks/                        # Mock implementations
│   ├── api.ts                    # API mocks
│   ├── database.ts               # Database mocks
│   └── services.ts               # Service mocks
├── utils/                        # Test utilities
│   ├── setup.ts                  # Test setup
│   ├── helpers.ts                # Test helpers
│   └── assertions.ts             # Custom assertions
└── config/                       # Test configuration
    ├── jest.config.js            # Jest configuration
    ├── playwright.config.ts      # Playwright configuration
    └── test-setup.ts             # Global test setup
```

---

## Scripts Structure (`scripts/`)

```
scripts/
├── build/                        # Build scripts
│   ├── build.sh                  # Main build script
│   ├── build-frontend.sh         # Frontend build
│   ├── build-backend.sh          # Backend build
│   └── build-worker.sh           # Worker build
├── deploy/                       # Deployment scripts
│   ├── deploy-dev.sh             # Development deployment
│   ├── deploy-prod.sh            # Production deployment
│   ├── rollback.sh               # Rollback script
│   └── health-check.sh           # Health check script
├── database/                     # Database scripts
│   ├── migrate.sh                # Migration script
│   ├── seed.sh                   # Seeding script
│   ├── backup.sh                 # Backup script
│   └── restore.sh                # Restore script
├── development/                  # Development scripts
│   ├── setup.sh                  # Development setup
│   ├── start-dev.sh              # Start development
│   ├── test.sh                   # Run tests
│   └── lint.sh                   # Run linting
└── maintenance/                  # Maintenance scripts
    ├── cleanup.sh                # Cleanup script
    ├── update-dependencies.sh    # Update dependencies
    └── security-scan.sh          # Security scan
```

---

## File Naming Conventions

### General Rules
- **Files**: kebab-case for most files (e.g., `user-service.ts`)
- **Components**: PascalCase (e.g., `UserProfile.tsx`)
- **Directories**: kebab-case (e.g., `user-management/`)
- **Constants**: UPPER_SNAKE_CASE (e.g., `API_BASE_URL`)
- **Variables**: camelCase (e.g., `userName`)
- **Classes**: PascalCase (e.g., `UserService`)

### Specific Patterns

#### React Components
```
ComponentName/
├── ComponentName.tsx
├── ComponentName.test.tsx
├── ComponentName.styles.ts
└── index.ts
```

#### API Endpoints
```
routes/
├── auth.ts           # Authentication routes
├── users.ts          # User management routes
├── uploads.ts        # File upload routes
└── mappings.ts       # Field mapping routes
```

#### Database Files
```
database/
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_add_sessions.sql
│   └── 003_add_indexes.sql
├── seeds/
│   ├── development.sql
│   └── production.sql
└── functions/
    ├── update_timestamp.sql
    └── generate_uuid.sql
```

---

## Import/Export Patterns

### Frontend Imports
```typescript
// Absolute imports with path mapping
import { Button } from '@/components/common/Button';
import { useAuth } from '@/hooks/useAuth';
import { User } from '@/types/auth';
import { formatDate } from '@/utils/formatting';

// Relative imports for co-located files
import { ComponentStyles } from './Component.styles';
import { useComponentLogic } from './hooks';
```

### Backend Imports
```typescript
// Standard imports
import express from 'express';
import { UserService } from '../services/UserService';
import { User } from '../models/User';
import { validateUser } from '../utils/validation';

// Index barrel imports
import { Controller, Service, Repository } from '../types';
```

---

## Environment Configuration

### Environment Files
```
.env.example                    # Template for all environments
.env.development                # Development variables
.env.staging                   # Staging variables
.env.production                # Production variables
.env.test                      # Test variables
```

### Configuration Structure
```typescript
config/
├── database.ts                 # Database configuration
├── redis.ts                    # Redis configuration
├── auth.ts                     # Authentication configuration
├── app.ts                      # Application configuration
└── index.ts                    # Configuration exports
```

---

## Best Practices

### Directory Organization
1. **Group by Feature**: Organize files by feature rather than type
2. **Keep it Flat**: Avoid deep nesting (max 3-4 levels)
3. **Consistent Structure**: Use similar patterns across modules
4. **Index Files**: Use index.ts for clean imports

### File Organization
1. **Single Responsibility**: Each file has one clear purpose
2. **Small Files**: Keep files focused and manageable
3. **Logical Grouping**: Group related files together
4. **Clear Naming**: Use descriptive names

### Import Organization
1. **Order Imports**: External libraries first, then internal
2. **Use Path Mapping**: Prefer absolute imports over relative
3. **Avoid Cycles**: Be careful with circular dependencies
4. **Export Clearly**: Use explicit exports

This source tree structure provides a solid foundation for the Atlas2 application, promoting maintainability, scalability, and developer productivity. Regular reviews and refinements ensure the structure continues to meet the project's evolving needs.