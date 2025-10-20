-- Database initialization script for Atlas2
-- This script sets up the database with initial data and configurations

-- Create database if it doesn't exist (for local development)
-- CREATE DATABASE IF NOT EXISTS atlas2;

-- Connect to the database
-- \c atlas2;

-- Run migrations
-- \i migrations/001_initial_schema.sql
-- \i migrations/002_add_indexes_and_constraints.sql

-- Create additional indexes for performance optimization
-- Note: Using regular CREATE INDEX instead of CONCURRENTLY for initialization
CREATE INDEX IF NOT EXISTS idx_processing_jobs_composite_search 
ON processing_jobs(user_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_api_fields_composite 
ON api_fields(api_config_id, required, name);

CREATE INDEX IF NOT EXISTS idx_transformation_rules_composite 
ON transformation_rules(mapping_id, enabled, type);

-- Create materialized views for reporting
-- Drop existing view if it exists to avoid conflicts
DROP VIEW IF EXISTS user_dashboard_stats;

CREATE MATERIALIZED VIEW user_dashboard_stats AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    COUNT(DISTINCT pj.id) as total_jobs,
    COUNT(DISTINCT CASE WHEN pj.status = 'completed' THEN pj.id END) as completed_jobs,
    COUNT(DISTINCT CASE WHEN pj.status = 'failed' THEN pj.id END) as failed_jobs,
    COUNT(DISTINCT CASE WHEN pj.status = 'processing' THEN pj.id END) as active_jobs,
    COUNT(DISTINCT CASE WHEN pj.created_at >= CURRENT_DATE THEN pj.id END) as jobs_today,
    COALESCE(SUM(pj.file_size), 0) as total_file_size,
    COALESCE(SUM(pj.records_processed), 0) as total_records_processed,
    COUNT(DISTINCT ac.id) as total_integrations,
    COUNT(DISTINCT CASE WHEN ac.is_active = true THEN ac.id END) as active_integrations,
    COUNT(DISTINCT mc.id) as total_mappings,
    MAX(pj.created_at) as last_activity
FROM users u
LEFT JOIN processing_jobs pj ON u.id = pj.user_id
LEFT JOIN api_configurations ac ON u.id = ac.user_id
LEFT JOIN mapping_configurations mc ON u.id = mc.user_id
GROUP BY u.id, u.name, u.email;

-- Create unique index for materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_dashboard_stats_user_id 
ON user_dashboard_stats(user_id);

-- Create function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_user_dashboard_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY user_dashboard_stats;
END;
$$ LANGUAGE plpgsql;

-- Create scheduled job to refresh stats (requires pg_cron extension)
-- SELECT cron.schedule('refresh-dashboard-stats', '0 */6 * * *', 'SELECT refresh_user_dashboard_stats();');

-- Create additional utility functions
CREATE OR REPLACE FUNCTION get_processing_trends(days INTEGER DEFAULT 30)
RETURNS TABLE(
    date DATE,
    jobs_created BIGINT,
    jobs_completed BIGINT,
    jobs_failed BIGINT,
    avg_processing_time DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE(pj.created_at) as date,
        COUNT(*) as jobs_created,
        COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) as jobs_completed,
        COUNT(CASE WHEN pj.status = 'failed' THEN 1 END) as jobs_failed,
        AVG(CASE WHEN pj.status = 'completed' THEN pj.processing_time END) as avg_processing_time
    FROM processing_jobs pj
    WHERE pj.created_at >= CURRENT_DATE - INTERVAL '1 day' * days
    GROUP BY DATE(pj.created_at)
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function for data retention
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS TABLE(
    audit_logs_deleted INTEGER,
    processing_results_deleted INTEGER,
    old_jobs_deleted INTEGER
) AS $$
DECLARE
    audit_retention_days INTEGER := 90;
    results_retention_days INTEGER := 30;
    jobs_retention_days INTEGER := 365;
    audit_deleted INTEGER := 0;
    results_deleted INTEGER := 0;
    jobs_deleted INTEGER := 0;
BEGIN
    -- Get retention periods from system settings if available
    BEGIN
        SELECT COALESCE((value::text::integer), 90) INTO audit_retention_days 
        FROM system_settings WHERE key = 'audit_log_retention_days';
    EXCEPTION WHEN OTHERS THEN
        audit_retention_days := 90;
    END;
    
    BEGIN
        SELECT COALESCE((value::text::integer), 30) INTO results_retention_days 
        FROM system_settings WHERE key = 'processing_results_retention_days';
    EXCEPTION WHEN OTHERS THEN
        results_retention_days := 30;
    END;
    
    BEGIN
        SELECT COALESCE((value::text::integer), 365) INTO jobs_retention_days 
        FROM system_settings WHERE key = 'jobs_retention_days';
    EXCEPTION WHEN OTHERS THEN
        jobs_retention_days := 365;
    END;
    
    -- Clean up old audit logs if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_logs') THEN
        DELETE FROM audit_logs 
        WHERE created_at < NOW() - INTERVAL '1 day' * audit_retention_days;
        GET DIAGNOSTICS audit_deleted = ROW_COUNT;
    END IF;
    
    -- Clean up old processing results if table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_results') THEN
        DELETE FROM processing_results 
        WHERE created_at < NOW() - INTERVAL '1 day' * results_retention_days;
        GET DIAGNOSTICS results_deleted = ROW_COUNT;
    END IF;
    
    -- Clean up old completed jobs if table exists (keep failed jobs longer for debugging)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'processing_jobs') THEN
        DELETE FROM processing_jobs 
        WHERE status = 'completed' 
        AND created_at < NOW() - INTERVAL '1 day' * jobs_retention_days;
        GET DIAGNOSTICS jobs_deleted = ROW_COUNT;
        
        -- Clean up associated file data if table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'file_data') THEN
            DELETE FROM file_data 
            WHERE job_id NOT IN (SELECT id FROM processing_jobs);
        END IF;
    END IF;
    
    RETURN QUERY SELECT audit_deleted, results_deleted, jobs_deleted;
END;
$$ LANGUAGE plpgsql;

-- Insert additional system settings (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        INSERT INTO system_settings (key, value, description, is_public) VALUES
        ('audit_log_retention_days', '90', 'Retention period for audit logs in days', false),
        ('processing_results_retention_days', '30', 'Retention period for processing results in days', false),
        ('jobs_retention_days', '365', 'Retention period for completed jobs in days', false),
        ('max_concurrent_jobs_per_user', '5', 'Maximum concurrent jobs per user', true),
        ('api_rate_limit_per_minute', '60', 'API rate limit per minute per user', true),
        ('enable_file_compression', 'true', 'Enable file compression for storage', false),
        ('default_csv_delimiter', '","', 'Default CSV delimiter', false),
        ('max_csv_rows', '1000000', 'Maximum number of rows in CSV file', true),
        ('enable_real_time_processing', 'true', 'Enable real-time processing updates', false),
        ('notification_email_enabled', 'true', 'Enable email notifications', false),
        ('environment', '"development"', 'Current environment', false)
        ON CONFLICT (key) DO NOTHING;
    END IF;
END $$;

-- Create sample data for development (only in non-production environments)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') AND
       EXISTS (SELECT 1 FROM system_settings WHERE key = 'environment' AND value = '"development"') THEN
        
        -- Create sample user if users table exists
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
            INSERT INTO users (email, password, name, role) VALUES
            ('demo@atlas2.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5GS', 'Demo User', 'user')
            ON CONFLICT (email) DO NOTHING;
            
            -- Create sample API configuration if tables exist
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_configurations') THEN
                INSERT INTO api_configurations (user_id, name, description, type, base_url, auth_type, auth_config) VALUES
                ((SELECT id FROM users WHERE email = 'demo@atlas2.com'), 'Sample CRM API', 'Sample CRM integration for testing', 'rest_api', 'https://api.crm.example.com', 'api_key', '{"api_key": "sample_key"}')
                ON CONFLICT DO NOTHING;
            END IF;
            
            -- Create sample mapping configuration if tables exist
            IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'mapping_configurations') THEN
                INSERT INTO mapping_configurations (user_id, name, description, mappings) VALUES
                ((SELECT id FROM users WHERE email = 'demo@atlas2.com'), 'Customer Import Mapping', 'Mapping for customer data import', '[
                    {
                        "id": "mapping-1",
                        "csvHeader": "Name",
                        "apiFieldId": "1",
                        "apiFieldName": "fullName",
                        "required": true
                    },
                    {
                        "id": "mapping-2", 
                        "csvHeader": "Email",
                        "apiFieldId": "2",
                        "apiFieldName": "emailAddress",
                        "required": true
                    }
                ]')
                ON CONFLICT DO NOTHING;
            END IF;
        END IF;
    END IF;
END $$;

-- Create database user for application (adjust permissions as needed)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas2_app') THEN
        CREATE ROLE atlas2_app WITH LOGIN PASSWORD 'secure_password_here';
        -- Grant permissions on current database
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO atlas2_app', current_database());
        GRANT USAGE ON SCHEMA public TO atlas2_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO atlas2_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO atlas2_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO atlas2_app;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO atlas2_app;
    END IF;
END $$;

-- Create read-only user for reporting
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'atlas2_readonly') THEN
        CREATE ROLE atlas2_readonly WITH LOGIN PASSWORD 'readonly_password_here';
        -- Grant permissions on current database
        EXECUTE format('GRANT CONNECT ON DATABASE %I TO atlas2_readonly', current_database());
        GRANT USAGE ON SCHEMA public TO atlas2_readonly;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas2_readonly;
        ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO atlas2_readonly;
    END IF;
END $$;

-- Final setup and validation
DO $$
DECLARE
    table_count INTEGER;
    index_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Count tables
    SELECT COUNT(*) INTO table_count 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    
    -- Count indexes
    SELECT COUNT(*) INTO index_count 
    FROM pg_indexes 
    WHERE schemaname = 'public';
    
    -- Count triggers
    SELECT COUNT(*) INTO trigger_count 
    FROM information_schema.triggers 
    WHERE trigger_schema = 'public';
    
    RAISE NOTICE 'Database initialization completed:';
    RAISE NOTICE '- Tables created: %', table_count;
    RAISE NOTICE '- Indexes created: %', index_count;
    RAISE NOTICE '- Triggers created: %', trigger_count;
    RAISE NOTICE '- Materialized views: user_dashboard_stats';
    RAISE NOTICE '- System settings initialized';
    RAISE NOTICE '- Sample data created (development mode)';
END $$;

-- Set database version (only if table exists)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_settings') THEN
        INSERT INTO system_settings (key, value, description, is_public) VALUES
        ('database_version', '"1.0.0"', 'Database schema version', false)
        ON CONFLICT (key) DO UPDATE SET value = '"1.0.0"';
    END IF;
END $$;