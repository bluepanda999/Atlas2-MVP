-- API Key Authentication Tables for PostgreSQL
-- Created for comprehensive authentication framework

-- API Clients Table
CREATE TABLE IF NOT EXISTS api_clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    contact_email VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_clients
CREATE INDEX IF NOT EXISTS idx_api_clients_active ON api_clients(is_active);
CREATE INDEX IF NOT EXISTS idx_api_clients_email ON api_clients(contact_email);

-- API Key Configurations Table
CREATE TABLE IF NOT EXISTS api_key_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES api_clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    api_key TEXT NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    permissions JSONB,
    rate_limit JSONB,
    expires_at TIMESTAMP WITH TIME ZONE,
    last_used_at TIMESTAMP WITH TIME ZONE,
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for api_key_configs
CREATE INDEX IF NOT EXISTS idx_api_key_client_id ON api_key_configs(client_id);
CREATE INDEX IF NOT EXISTS idx_api_key_active ON api_key_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_api_key_expires ON api_key_configs(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_key_prefix ON api_key_configs(key_prefix);

-- Authentication Audit Log Table
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    config_id UUID NOT NULL,
    config_type VARCHAR(20) NOT NULL CHECK (config_type IN ('api_key', 'basic_auth', 'bearer_token')),
    action VARCHAR(50) NOT NULL,
    user_id UUID,
    ip_address VARCHAR(45),
    user_agent TEXT,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for auth_audit_log
CREATE INDEX IF NOT EXISTS idx_auth_audit_config_id ON auth_audit_log(config_id);
CREATE INDEX IF NOT EXISTS idx_auth_audit_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_auth_audit_created ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_auth_audit_type ON auth_audit_log(config_type);

-- Insert default API client for testing
INSERT INTO api_clients (id, name, description, contact_email) 
VALUES ('default-client', 'Default Client', 'Default API client for internal use', 'admin@atlas2.com')
ON CONFLICT (id) DO NOTHING;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_api_clients_updated_at BEFORE UPDATE ON api_clients 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_api_key_configs_updated_at BEFORE UPDATE ON api_key_configs 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();