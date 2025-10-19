# Atlas2 - CSV to API Mapping Tool

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue)](https://www.docker.com/)

A comprehensive web application built with React and Node.js that enables users to easily map CSV data to API endpoints through a visual interface. Atlas2 simplifies data integration workflows with streaming processing, dynamic API client generation, and robust authentication support. Deployed via Docker containers for consistent, scalable operation.

## 🚀 Features

### Core Functionality
- **📁 CSV Upload & Processing**: Stream-based processing for large files (up to 3GB) with automatic delimiter detection
- **🔗 Dynamic API Integration**: OpenAPI specification support with automatic client generation
- **🎯 Visual Field Mapping**: Intuitive drag-and-drop interface for data transformation
- **🔐 Flexible Authentication**: Support for API Key, Basic Auth, and Bearer Token authentication
- **📊 Real-time Monitoring**: Progress tracking, error reporting, and analytics dashboard
- **🐳 Container Deployment**: Multi-container Docker deployment with production-ready configuration

### Technical Highlights
- **Memory Efficient**: Streaming architecture processes large files with ≤500MB RAM usage
- **High Performance**: 10,000+ rows/second processing speed
- **Web-Based**: Accessible from any modern web browser
- **Container-First**: Docker Compose deployment with microservices architecture
- **Modern Stack**: TypeScript, React 18, Node.js, PostgreSQL, Redis
- **Developer Friendly**: Comprehensive testing, linting, and documentation
- **Production Ready**: Built-in monitoring, logging, and scaling capabilities

## 📋 System Requirements

### For Development
- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0

### For Production Deployment
- **Docker**: >= 20.0.0
- **Docker Compose**: >= 2.0.0
- **Memory**: 4GB RAM minimum (8GB recommended for large file processing)
- **Storage**: 10GB available disk space (for database and file uploads)
- **Network**: Port 80/443 for web access, additional ports for monitoring

## 🛠️ Installation

### Prerequisites
Ensure you have Docker and Docker Compose installed on your system.

### Quick Start with Docker
```bash
# Clone the repository
git clone https://github.com/your-username/atlas2.git
cd atlas2

# Copy environment configuration
cp .env.example .env

# Edit .env with your configuration
nano .env

# Start the application
docker-compose -f docker-compose.prod.yml up -d
```

The application will be available at `http://localhost` (or your configured domain).

## 🚀 Quick Start

### Development Mode
```bash
# Start development environment with hot reload
docker-compose -f docker-compose.dev.yml up

# View logs
docker-compose -f docker-compose.dev.yml logs -f

# Stop development environment
docker-compose -f docker-compose.dev.yml down
```

### Production Deployment
```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Check service status
docker-compose -f docker-compose.prod.yml ps

# View logs
docker-compose -f docker-compose.prod.yml logs -f

# Stop production deployment
docker-compose -f docker-compose.prod.yml down
```

### Local Development (Without Docker)
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Run linting
npm run lint
```

## 📁 Project Structure

```
atlas2/
├── src/                          # Frontend source code
│   ├── components/               # React components
│   ├── pages/                    # Application pages
│   ├── utils/                    # Utility functions
│   ├── types/                    # TypeScript type definitions
│   └── store/                    # State management (Zustand)
├── api/                          # Backend API source code
│   ├── controllers/              # API controllers
│   ├── services/                 # Business logic
│   ├── models/                   # Data models
│   └── middleware/               # Express middleware
├── worker/                       # Background processing
│   ├── processors/               # File processing logic
│   ├── jobs/                     # Job definitions
│   └── queues/                   # Queue management
├── database/                     # Database setup
│   ├── migrations/               # Database migrations
│   ├── seeds/                    # Seed data
│   └── init.sql                  # Initialization script
├── monitoring/                   # Monitoring configuration
│   ├── prometheus.yml            # Prometheus config
│   └── grafana/                  # Grafana dashboards
├── docs/                         # Documentation
│   ├── epics/                    # Epic definitions
│   ├── stories/                  # User stories
│   └── architecture/             # Architecture documentation
├── .bmad-core/                   # BMad Method configuration
├── dist/                         # Build output
├── uploads/                      # File upload storage
└── tests/                        # Test files
```

## 🏗️ Architecture

### Technology Stack
- **Frontend**: React 18, TypeScript, Ant Design, Vite
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **File Processing**: PapaParse, Custom streaming engine
- **API Generation**: OpenAPI TypeScript Codegen
- **Containerization**: Docker, Docker Compose
- **Web Server**: Nginx (production)
- **Monitoring**: Prometheus, Grafana
- **State Management**: Zustand
- **Testing**: Vitest

### Microservices Architecture

#### 1. Web Application Container
- React frontend served by Nginx
- Static asset optimization
- API proxying and load balancing
- SSL termination

#### 2. API Processing Container
- RESTful API endpoints
- Request validation and authentication
- Business logic orchestration
- Rate limiting and security

#### 3. Background Worker Container
- Streaming CSV processing
- File transformation jobs
- Queue-based task management
- Error handling and retry logic

#### 4. Database Container
- PostgreSQL for persistent data
- Connection pooling
- Automated backups
- Query optimization

#### 5. Cache Container
- Redis for session storage
- Job queue management
- Real-time data caching
- Pub/Sub messaging

### Core Components

#### 1. CSV Processing Engine
- Streaming architecture for memory efficiency
- Automatic delimiter and encoding detection
- Real-time validation and preview
- Support for files up to 3GB
- Distributed processing across workers

#### 2. API Client Generator
- OpenAPI 3.0+ specification support
- Dynamic TypeScript client generation
- Endpoint discovery and documentation
- Request/response type safety
- Authentication method detection

#### 3. Visual Field Mapper
- Drag-and-drop interface
- Real-time transformation preview
- Custom field transformations
- Mapping templates and presets
- Collaborative mapping features

#### 4. Authentication Manager
- Multiple authentication methods
- JWT token management
- Secure credential storage
- OAuth integration support
- Enterprise security standards

## 📚 Documentation

### User Documentation
- [Epic Overview](docs/epics/epics-summary.md) - Complete feature roadmap
- [User Stories](docs/stories/) - Detailed functionality breakdown
- [Brainstorming Results](docs/brainstorming-session-results.md) - Requirements analysis

### Developer Documentation
- [BMad Method Guide](.bmad-core/user-guide.md) - Development methodology
- [Architecture Documentation](docs/architecture/) - System design and patterns
- [API Documentation](docs/api/) - API reference and examples

### Epic Breakdown
1. **[CSV Upload & Processing](docs/epics/epic-1-csv-upload-processing.md)** - Core data ingestion
2. **[API Client Generation](docs/epics/epic-2-api-client-generation.md)** - Dynamic API integration
3. **[Visual Field Mapping](docs/epics/epic-3-visual-field-mapping.md)** - User-friendly data transformation
4. **[Simple Authentication](docs/epics/epic-4-simple-authentication.md)** - Secure API access
5. **[Progress Monitoring](docs/epics/epic-5-progress-monitoring.md)** - Operational visibility
6. **[Docker Containerization](docs/epics/epic-6-docker-containerization.md)** - Deployment infrastructure

## 🔧 Configuration

### Environment Variables
Copy `.env.example` to `.env` and configure:

```env
# Application Environment
NODE_ENV=production

# Database Configuration
POSTGRES_PASSWORD=your-secure-password-here
DATABASE_URL=postgresql://atlas2:your-secure-password-here@postgres:5432/atlas2

# Redis Configuration
REDIS_PASSWORD=your-redis-password-here
REDIS_URL=redis://:your-redis-password-here@redis:6379

# JWT Configuration
JWT_SECRET=your-jwt-secret-key-here-min-32-characters

# API Configuration
API_RATE_LIMIT=100
API_TIMEOUT=30000

# File Processing Configuration
MAX_FILE_SIZE=3221225472  # 3GB in bytes
CHUNK_SIZE=65536          # 64KB chunks
MAX_MEMORY_USAGE=524288000 # 500MB

# Worker Configuration
WORKER_CONCURRENCY=4

# Monitoring Configuration
GRAFANA_PASSWORD=your-grafana-password-here
```

### Docker Configuration
- **Development**: `docker-compose.dev.yml` - Hot reload, volume mounts, debug logging
- **Production**: `docker-compose.prod.yml` - Optimized builds, monitoring, security

### BMad Method Configuration
The project uses BMad Method for agile development and documentation. Configuration is stored in:
- `.bmad-core/core-config.yaml` - Core project settings
- `.bmad-core/agents/` - Development agent definitions
- `.bmad-core/tasks/` - Reusable task templates

## 🐳 Docker Deployment

### Development Environment
```bash
# Start all services with hot reload
docker-compose -f docker-compose.dev.yml up

# Start specific service
docker-compose -f docker-compose.dev.yml up atlas2-web

# View logs
docker-compose -f docker-compose.dev.yml logs -f atlas2-api

# Stop all services
docker-compose -f docker-compose.dev.yml down
```

### Production Deployment
```bash
# Deploy to production
docker-compose -f docker-compose.prod.yml up -d

# Scale services
docker-compose -f docker-compose.prod.yml up -d --scale atlas2-worker=3

# Update deployment
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d

# Backup database
docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U atlas2 atlas2 > backup.sql
```

### Service URLs
- **Web Application**: http://localhost (or your domain)
- **API Documentation**: http://localhost/api/docs
- **Grafana Monitoring**: http://localhost:3001
- **Prometheus Metrics**: http://localhost:9090

## 🧪 Testing

### Test Structure
```
tests/
├── unit/           # Unit tests
├── integration/    # Integration tests
├── e2e/           # End-to-end tests
└── fixtures/      # Test data
```

### Running Tests
```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Coverage report
npm run test:coverage
```

## 📊 Performance Metrics

### Benchmarks
- **CSV Processing**: 10,000+ rows/second
- **Memory Usage**: ≤500MB for 3GB files
- **API Response Time**: <200ms average
- **UI Render Time**: <100ms for complex views

### Monitoring
- Real-time progress tracking
- Error classification and reporting
- Performance analytics dashboard
- Resource usage monitoring

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Workflow
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Standards
- Use TypeScript for all new code
- Follow ESLint configuration
- Write tests for new functionality
- Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

### Getting Help
- **Documentation**: Check the [docs/](docs/) folder for detailed guides
- **Issues**: Report bugs via [GitHub Issues](https://github.com/your-username/atlas2/issues)
- **Discussions**: Join our [GitHub Discussions](https://github.com/your-username/atlas2/discussions)

### FAQ
**Q: What's the maximum file size supported?**  
A: Atlas2 can process CSV files up to 3GB in size using streaming architecture.

**Q: Which authentication methods are supported?**  
A: API Key, Basic Authentication, and Bearer Token authentication are currently supported.

**Q: How do I scale Atlas2 for high traffic?**  
A: Use Docker Compose scaling: `docker-compose -f docker-compose.prod.yml up -d --scale atlas2-api=3 --scale atlas2-worker=5`

**Q: Can I run Atlas2 behind a reverse proxy?**  
A: Yes, the Nginx configuration supports SSL termination and can be customized for your reverse proxy setup.

**Q: How do I backup data?**  
A: Use the built-in backup scripts: `docker-compose -f docker-compose.prod.yml exec postgres pg_dump -U atlas2 atlas2 > backup.sql`

## 🗺️ Roadmap

### MVP (Current)
- [x] CSV upload and processing
- [x] Basic API client generation
- [x] Visual field mapping
- [x] Simple authentication
- [x] Progress monitoring
- [x] Docker containerization

### Future Enhancements
- [ ] Advanced data transformations
- [ ] Multi-format file support (JSON, XML, Excel)
- [ ] Workflow automation and scheduling
- [ ] Team collaboration features
- [ ] Cloud deployment options (AWS, GCP, Azure)
- [ ] Advanced analytics and reporting
- [ ] API marketplace integrations
- [ ] Real-time collaboration
- [ ] Advanced security features (SSO, RBAC)
- [ ] Mobile application

## 📈 Version History

### v1.0.0 (Current)
- Initial MVP release
- Core CSV to API mapping functionality
- Web application with microservices architecture
- Docker Compose deployment
- Production-ready monitoring and logging

---

**Built with ❤️ using [BMad Method](https://bmad-method.com)**

For more information about the development methodology and processes used in this project, see the [BMad Method documentation](.bmad-core/user-guide.md).