# Database Schema for Atlas2

This directory contains the database schema, migrations, and initialization scripts for the Atlas2 application.

## Structure

```
database/
├── migrations/
│   ├── 001_initial_schema.sql      # Initial database schema
│   ├── 002_add_indexes_and_constraints.sql  # Performance optimizations
│   └── ...                         # Future migrations
├── init.sql                        # Database initialization script
└── README.md                       # This file
```

## Database Tables

### Core Tables

- **users** - User accounts and authentication
- **processing_jobs** - CSV file processing jobs
- **file_data** - Raw CSV file storage
- **api_configurations** - External API configurations
- **api_fields** - Expected fields for API integrations
- **mapping_configurations** - Field mapping configurations
- **transformation_rules** - Data transformation rules
- **processing_results** - Results of processed data rows

### Supporting Tables

- **audit_logs** - Audit trail for system actions
- **system_settings** - System-wide configuration settings

## Views and Materialized Views

### Views

- **job_statistics** - Job statistics per user
- **system_health** - System health metrics

### Materialized Views

- **user_dashboard_stats** - User dashboard statistics (refreshed periodically)

## Key Features

### Security

- Row Level Security (RLS) enabled for multi-tenant data isolation
- User roles with appropriate permissions
- Audit logging for all data changes

### Performance

- Comprehensive indexing strategy
- Composite indexes for common query patterns
- Materialized views for reporting
- Partitioning support (commented out, ready for high-volume deployments)

### Data Integrity

- Foreign key constraints with proper cascade actions
- Check constraints for data validation
- Unique constraints to prevent duplicates
- Trigger-based validation

## Setup Instructions

### Local Development

1. Install PostgreSQL (version 13+ recommended)
2. Create the database:
   ```sql
   CREATE DATABASE atlas2;
   ```

3. Run the initialization script:
   ```bash
   psql -d atlas2 -f database/init.sql
   ```

### Production Deployment

1. Set up PostgreSQL with appropriate security settings
2. Create database users with limited privileges:
   - `atlas2_app` - Application user (read/write)
   - `atlas2_readonly` - Reporting user (read-only)

3. Run migrations in order:
   ```bash
   psql -d atlas2 -f database/migrations/001_initial_schema.sql
   psql -d atlas2 -f database/migrations/002_add_indexes_and_constraints.sql
   psql -d atlas2 -f database/init.sql
   ```

## Configuration

### System Settings

Key system settings can be configured via the `system_settings` table:

- `max_file_size` - Maximum file size in bytes (default: 50MB)
- `allowed_file_types` - Allowed file types for upload
- `max_concurrent_jobs` - Maximum concurrent processing jobs per user
- `job_timeout` - Job timeout in seconds
- `audit_log_retention_days` - Retention period for audit logs

### Environment Variables

The application expects these environment variables:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/atlas2
DATABASE_POOL_SIZE=20
DATABASE_TIMEOUT=30000
```

## Maintenance

### Regular Tasks

1. **Refresh materialized views**:
   ```sql
   SELECT refresh_user_dashboard_stats();
   ```

2. **Clean up old data**:
   ```sql
   SELECT * FROM cleanup_old_data();
   ```

3. **Update statistics**:
   ```sql
   ANALYZE;
   ```

### Monitoring

Monitor these key metrics:

- Table sizes and growth rates
- Index usage and bloat
- Query performance
- Connection pool usage
- Disk space usage

## Backup and Recovery

### Backup Strategy

1. **Regular full backups**:
   ```bash
   pg_dump -d atlas2 -f backup_$(date +%Y%m%d).sql
   ```

2. **Point-in-time recovery** (if using WAL archiving):
   ```bash
   pg_basebackup -D /backup/base -Ft -z -P
   ```

### Recovery

1. **Restore from backup**:
   ```bash
   psql -d atlas2_new -f backup_20240101.sql
   ```

2. **Point-in-time recovery** (if available):
   ```bash
   pg_ctl start -D /backup/base
   ```

## Migration Process

### Creating New Migrations

1. Create a new migration file with sequential numbering:
   ```
   003_add_new_feature.sql
   ```

2. Include both UP and DOWN operations:
   ```sql
   -- UP operations
   ALTER TABLE users ADD COLUMN new_field VARCHAR(100);

   -- DOWN operations (commented or in separate file)
   -- ALTER TABLE users DROP COLUMN new_field;
   ```

3. Test migration on staging environment first

### Running Migrations

Use a migration tool like Flyway or Liquibase for production:
```bash
flyway migrate -url=jdbc:postgresql://localhost:5432/atlas2 -user=atlas2_app -password=***
```

## Performance Tuning

### Index Optimization

1. Monitor index usage:
   ```sql
   SELECT * FROM pg_stat_user_indexes;
   ```

2. Remove unused indexes:
   ```sql
   DROP INDEX IF EXISTS unused_index_name;
   ```

3. Rebuild fragmented indexes:
   ```sql
   REINDEX INDEX CONCURRENTLY index_name;
   ```

### Query Optimization

1. Analyze slow queries:
   ```sql
   SELECT * FROM pg_stat_statements ORDER BY mean_time DESC LIMIT 10;
   ```

2. Update table statistics:
   ```sql
   ANALYZE table_name;
   ```

## Security Considerations

1. **Regular security updates** - Keep PostgreSQL updated
2. **Connection encryption** - Use SSL/TLS for connections
3. **Access control** - Principle of least privilege
4. **Audit logging** - Monitor all data access
5. **Data encryption** - Consider column-level encryption for sensitive data

## Troubleshooting

### Common Issues

1. **Connection issues**:
   - Check PostgreSQL service status
   - Verify connection string and credentials
   - Check firewall settings

2. **Performance issues**:
   - Check for long-running queries
   - Monitor system resources
   - Review index usage

3. **Lock issues**:
   ```sql
   SELECT * FROM pg_locks WHERE NOT granted;
   ```

### Debugging

1. Enable query logging:
   ```sql
   ALTER SYSTEM SET log_statement = 'all';
   SELECT pg_reload_conf();
   ```

2. Monitor activity:
   ```sql
   SELECT * FROM pg_stat_activity;
   ```

## Schema Documentation

For detailed field information and relationships, refer to the inline comments in the migration files or use a database documentation tool like SchemaSpy.