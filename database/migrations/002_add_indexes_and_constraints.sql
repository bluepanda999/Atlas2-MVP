-- Additional indexes and constraints
-- Migration: 002_add_indexes_and_constraints
-- Created: 2024-01-01

-- Add composite indexes for common queries
CREATE INDEX idx_processing_jobs_user_status ON processing_jobs(user_id, status);
CREATE INDEX idx_processing_jobs_status_created ON processing_jobs(status, created_at);
CREATE INDEX idx_processing_jobs_user_created ON processing_jobs(user_id, created_at DESC);

CREATE INDEX idx_api_configurations_user_active ON api_configurations(user_id, is_active);
CREATE INDEX idx_mapping_configurations_user_api ON mapping_configurations(user_id, api_config_id);

CREATE INDEX idx_audit_logs_user_action_date ON audit_logs(user_id, action, created_at);
CREATE INDEX idx_audit_logs_resource_date ON audit_logs(resource_type, resource_id, created_at);

-- Add foreign key constraints with proper actions
ALTER TABLE processing_jobs 
ADD CONSTRAINT fk_processing_jobs_user 
FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;

ALTER TABLE processing_jobs 
ADD CONSTRAINT fk_processing_jobs_mapping 
FOREIGN KEY (mapping_id) REFERENCES mapping_configurations(id) ON DELETE SET NULL;

-- Add check constraints
ALTER TABLE users 
ADD CONSTRAINT chk_users_email 
CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

ALTER TABLE processing_jobs 
ADD CONSTRAINT chk_processing_jobs_progress 
CHECK (progress >= 0 AND progress <= 100);

ALTER TABLE processing_jobs 
ADD CONSTRAINT chk_processing_jobs_records 
CHECK (records_processed >= 0);

ALTER TABLE processing_jobs 
ADD CONSTRAINT chk_processing_jobs_status 
CHECK (status IN ('pending', 'processing', 'completed', 'failed'));

ALTER TABLE api_configurations 
ADD CONSTRAINT chk_api_configurations_url 
CHECK (base_url ~* '^https?://');

ALTER TABLE api_fields 
ADD CONSTRAINT chk_api_fields_type 
CHECK (type IN ('string', 'number', 'integer', 'boolean', 'email', 'phone', 'date', 'datetime', 'url', 'object', 'array'));

-- Add unique constraints for data integrity
ALTER TABLE api_configurations 
ADD CONSTRAINT uniq_api_configurations_user_name 
UNIQUE (user_id, name);

ALTER TABLE mapping_configurations 
ADD CONSTRAINT uniq_mapping_configurations_user_name 
UNIQUE (user_id, name);

ALTER TABLE transformation_rules 
ADD CONSTRAINT uniq_transformation_rules_mapping_name 
UNIQUE (mapping_id, name);

-- Create partial indexes for better performance on filtered queries
CREATE INDEX idx_processing_jobs_active ON processing_jobs(created_at) 
WHERE status IN ('pending', 'processing');

CREATE INDEX idx_users_active_email ON users(email) 
WHERE is_active = true;

CREATE INDEX idx_api_configurations_active ON api_configurations(user_id, created_at) 
WHERE is_active = true;

-- Create expression indexes for case-insensitive searches
CREATE INDEX idx_users_email_lower ON users(LOWER(email));
CREATE INDEX idx_api_configurations_name_lower ON api_configurations(LOWER(name));
CREATE INDEX idx_mapping_configurations_name_lower ON mapping_configurations(LOWER(name));

-- Add table partitioning for large tables (optional, for high-volume deployments)
-- This is commented out as it requires PostgreSQL 10+ and careful planning
/*
-- Partition processing_jobs by date
CREATE TABLE processing_jobs_partitioned (
    LIKE processing_jobs INCLUDING ALL
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE processing_jobs_2024_01 PARTITION OF processing_jobs_partitioned
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');

CREATE TABLE processing_jobs_2024_02 PARTITION OF processing_jobs_partitioned
    FOR VALUES FROM ('2024-02-01') TO ('2024-03-01');
*/

-- Create trigger functions for data validation
CREATE OR REPLACE FUNCTION validate_file_size()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.file_size > (SELECT (value::text::integer) FROM system_settings WHERE key = 'max_file_size') THEN
        RAISE EXCEPTION 'File size exceeds maximum allowed size';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_validate_file_size
    BEFORE INSERT OR UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION validate_file_size();

-- Create function to clean up old audit logs
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs(retention_days INTEGER DEFAULT 90)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM audit_logs 
    WHERE created_at < NOW() - INTERVAL '1 day' * retention_days;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user quota usage
CREATE OR REPLACE FUNCTION get_user_quota_usage(user_uuid UUID)
RETURNS TABLE(
    total_jobs BIGINT,
    total_file_size BIGINT,
    jobs_today BIGINT,
    file_size_today BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(pj.id) as total_jobs,
        COALESCE(SUM(pj.file_size), 0) as total_file_size,
        COUNT(CASE WHEN pj.created_at >= CURRENT_DATE THEN 1 END) as jobs_today,
        COALESCE(SUM(CASE WHEN pj.created_at >= CURRENT_DATE THEN pj.file_size ELSE 0 END), 0) as file_size_today
    FROM processing_jobs pj
    WHERE pj.user_id = user_uuid;
END;
$$ LANGUAGE plpgsql;

-- Create function to update job statistics
CREATE OR REPLACE FUNCTION update_job_statistics()
RETURNS TRIGGER AS $$
BEGIN
    -- Update job progress based on processing results
    IF TG_TABLE_NAME = 'processing_results' THEN
        UPDATE processing_jobs 
        SET 
            records_processed = (
                SELECT COUNT(*) 
                FROM processing_results 
                WHERE job_id = NEW.job_id AND status = 'completed'
            ),
            progress = CASE 
                WHEN (SELECT total_records FROM processing_jobs WHERE id = NEW.job_id) > 0 THEN
                    ROUND(
                        (SELECT COUNT(*) FROM processing_results WHERE job_id = NEW.job_id AND status = 'completed')::decimal / 
                        (SELECT total_records FROM processing_jobs WHERE id = NEW.job_id) * 100
                    )
                ELSE 0
            END
        WHERE id = NEW.job_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic statistics updates
CREATE TRIGGER trigger_update_job_statistics
    AFTER INSERT OR UPDATE ON processing_results
    FOR EACH ROW EXECUTE FUNCTION update_job_statistics();

-- Skip RLS (Row Level Security) policies for now - will be added later with proper role setup
-- ALTER TABLE processing_jobs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE api_configurations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mapping_configurations ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE transformation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_transformation_rules_policy ON transformation_rules
    FOR ALL TO authenticated_users
    USING (mapping_id IN (
        SELECT id FROM mapping_configurations 
        WHERE user_id = current_setting('app.current_user_id')::uuid
    ));

-- Admin policies to access all data
CREATE POLICY admin_processing_jobs_policy ON processing_jobs
    FOR ALL TO admin_users
    USING (true);

CREATE POLICY admin_api_configurations_policy ON api_configurations
    FOR ALL TO admin_users
    USING (true);

CREATE POLICY admin_mapping_configurations_policy ON mapping_configurations
    FOR ALL TO admin_users
    USING (true);

CREATE POLICY admin_transformation_rules_policy ON transformation_rules
    FOR ALL TO admin_users
    USING (true);

-- Create roles for RLS
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated_users') THEN
        CREATE ROLE authenticated_users;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'admin_users') THEN
        CREATE ROLE admin_users;
    END IF;
END
$$;

-- Grant permissions
GRANT authenticated_users TO admin_users;
GRANT USAGE ON SCHEMA public TO authenticated_users;
GRANT USAGE ON SCHEMA public TO admin_users;

-- Add comments for new objects
COMMENT ON FUNCTION cleanup_old_audit_logs IS 'Cleans up audit logs older than specified retention period';
COMMENT ON FUNCTION get_user_quota_usage IS 'Returns quota usage statistics for a user';
COMMENT ON FUNCTION update_job_statistics IS 'Updates job statistics based on processing results';
COMMENT ON TRIGGER trigger_validate_file_size ON processing_jobs IS 'Validates file size against system limits';
COMMENT ON TRIGGER trigger_update_job_statistics ON processing_results IS 'Updates job progress automatically';