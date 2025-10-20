-- Initial schema for Atlas2 application
-- Migration: 001_initial_schema
-- Created: 2024-01-01
-- Updated: Fixed table dependency order

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types
CREATE TYPE user_role AS ENUM ('admin', 'user');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE integration_type AS ENUM ('rest_api', 'webhook', 'database');
CREATE TYPE auth_type AS ENUM ('api_key', 'bearer_token', 'basic_auth', 'oauth2');
CREATE TYPE rule_type AS ENUM ('format', 'validation', 'transformation', 'lookup');

-- Core tables (no dependencies)
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'user',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    last_logout_at TIMESTAMP WITH TIME ZONE
);

-- API configurations table (depends only on users)
CREATE TABLE api_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    type integration_type NOT NULL,
    base_url VARCHAR(500) NOT NULL,
    auth_type auth_type NOT NULL,
    auth_config JSONB NOT NULL DEFAULT '{}',
    headers JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- API fields table (depends on api_configurations)
CREATE TABLE api_fields (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    api_config_id UUID NOT NULL REFERENCES api_configurations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    description TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    format VARCHAR(100),
    validation_rules JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    UNIQUE(api_config_id, name)
);

-- Mapping configurations table (depends on users and api_configurations)
CREATE TABLE mapping_configurations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_config_id UUID REFERENCES api_configurations(id) ON DELETE SET NULL,
    mappings JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Processing jobs table (depends on users and mapping_configurations)
CREATE TABLE processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    status job_status NOT NULL DEFAULT 'pending',
    progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
    records_processed INTEGER NOT NULL DEFAULT 0,
    total_records INTEGER,
    csv_headers JSONB,
    error_message TEXT,
    processing_time INTEGER, -- in seconds
    estimated_time_remaining INTEGER, -- in seconds
    mapping_id UUID REFERENCES mapping_configurations(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Dependent tables (depend on processing_jobs)
-- File data table (stores actual CSV content)
CREATE TABLE file_data (
    job_id UUID PRIMARY KEY REFERENCES processing_jobs(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    checksum VARCHAR(64),
    compressed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Processing results table (stores results of processed jobs)
CREATE TABLE processing_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES processing_jobs(id) ON DELETE CASCADE,
    row_number INTEGER NOT NULL,
    input_data JSONB NOT NULL,
    output_data JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    error_message TEXT,
    processing_time INTEGER, -- in milliseconds
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Transformation rules table (depends on mapping_configurations)
CREATE TABLE transformation_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mapping_id UUID NOT NULL REFERENCES mapping_configurations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type rule_type NOT NULL,
    source_field VARCHAR(255),
    target_field VARCHAR(255),
    configuration JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit log table (depends on users)
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- System settings table (no dependencies)
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(255) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_created_at ON users(created_at);

CREATE INDEX idx_processing_jobs_user_id ON processing_jobs(user_id);
CREATE INDEX idx_processing_jobs_status ON processing_jobs(status);
CREATE INDEX idx_processing_jobs_created_at ON processing_jobs(created_at);
CREATE INDEX idx_processing_jobs_mapping_id ON processing_jobs(mapping_id);

CREATE INDEX idx_api_configurations_user_id ON api_configurations(user_id);
CREATE INDEX idx_api_configurations_type ON api_configurations(type);
CREATE INDEX idx_api_configurations_is_active ON api_configurations(is_active);

CREATE INDEX idx_api_fields_api_config_id ON api_fields(api_config_id);
CREATE INDEX idx_api_fields_name ON api_fields(name);
CREATE INDEX idx_api_fields_required ON api_fields(required);

CREATE INDEX idx_mapping_configurations_user_id ON mapping_configurations(user_id);
CREATE INDEX idx_mapping_configurations_api_config_id ON mapping_configurations(api_config_id);

CREATE INDEX idx_transformation_rules_mapping_id ON transformation_rules(mapping_id);
CREATE INDEX idx_transformation_rules_type ON transformation_rules(type);
CREATE INDEX idx_transformation_rules_enabled ON transformation_rules(enabled);

CREATE INDEX idx_processing_results_job_id ON processing_results(job_id);
CREATE INDEX idx_processing_results_status ON processing_results(status);

CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

CREATE INDEX idx_system_settings_key ON system_settings(key);
CREATE INDEX idx_system_settings_is_public ON system_settings(is_public);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_jobs_updated_at BEFORE UPDATE ON processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_configurations_updated_at BEFORE UPDATE ON api_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_fields_updated_at BEFORE UPDATE ON api_fields
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_mapping_configurations_updated_at BEFORE UPDATE ON mapping_configurations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transformation_rules_updated_at BEFORE UPDATE ON transformation_rules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_processing_results_updated_at BEFORE UPDATE ON processing_results
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert default system settings
INSERT INTO system_settings (key, value, description, is_public) VALUES
('max_file_size', '3221225472', 'Maximum file size in bytes (3GB)', true),
('allowed_file_types', '["text/csv", "application/vnd.ms-excel"]', 'Allowed file types for upload', true),
('max_concurrent_jobs', '5', 'Maximum concurrent processing jobs per user', true),
('job_timeout', '3600', 'Job timeout in seconds (1 hour)', true),
('default_batch_size', '1000', 'Default batch size for CSV processing', false),
('enable_audit_logging', 'true', 'Enable audit logging', false),
('chunk_size', '1048576', 'File chunk size for streaming (1MB)', false),
('max_memory_usage', '524288000', 'Maximum memory usage per job (500MB)', false);

-- Create a default admin user (password: admin123)
-- Note: In production, this should be created through a secure process
INSERT INTO users (email, password, name, role) VALUES
('admin@atlas2.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6hsxq9w5GS', 'System Administrator', 'admin');

-- Create view for job statistics
CREATE VIEW user_dashboard_stats AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    COUNT(pj.id) as total_jobs,
    COUNT(CASE WHEN pj.status = 'completed' THEN 1 END) as completed_jobs,
    COUNT(CASE WHEN pj.status = 'failed' THEN 1 END) as failed_jobs,
    COUNT(CASE WHEN pj.status = 'processing' THEN 1 END) as processing_jobs,
    COUNT(CASE WHEN pj.status = 'pending' THEN 1 END) as pending_jobs,
    SUM(pj.file_size) as total_file_size,
    SUM(pj.records_processed) as total_records_processed,
    AVG(pj.processing_time) as avg_processing_time,
    MAX(pj.created_at) as last_job_date
FROM users u
LEFT JOIN processing_jobs pj ON u.id = pj.user_id
GROUP BY u.id, u.name, u.email;

-- Create view for system health
CREATE VIEW system_health AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE is_active = true) as active_users,
    (SELECT COUNT(*) FROM processing_jobs WHERE status = 'processing') as active_jobs,
    (SELECT COUNT(*) FROM processing_jobs WHERE status = 'pending') as pending_jobs,
    (SELECT COUNT(*) FROM processing_jobs WHERE created_at > NOW() - INTERVAL '24 hours') as jobs_last_24h,
    (SELECT COUNT(*) FROM processing_jobs WHERE status = 'failed' AND created_at > NOW() - INTERVAL '24 hours') as failed_jobs_last_24h,
    (SELECT AVG(processing_time) FROM processing_jobs WHERE status = 'completed' AND created_at > NOW() - INTERVAL '24 hours') as avg_processing_time_last_24h;

-- Add comments for documentation
COMMENT ON TABLE users IS 'User accounts and authentication information';
COMMENT ON TABLE processing_jobs IS 'CSV file processing jobs and their status';
COMMENT ON TABLE file_data IS 'Raw CSV file data storage';
COMMENT ON TABLE api_configurations IS 'External API configurations';
COMMENT ON TABLE api_fields IS 'Expected fields for API integrations';
COMMENT ON TABLE mapping_configurations IS 'Field mapping configurations';
COMMENT ON TABLE transformation_rules IS 'Data transformation rules';
COMMENT ON TABLE processing_results IS 'Results of processed data rows';
COMMENT ON TABLE audit_logs IS 'Audit trail for system actions';
COMMENT ON TABLE system_settings IS 'System-wide configuration settings';