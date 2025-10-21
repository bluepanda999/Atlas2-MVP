-- Migration: Add mapping templates support
-- Version: 007
-- Created: October 20, 2025

-- Create mapping_templates table
CREATE TABLE IF NOT EXISTS mapping_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100) NOT NULL DEFAULT 'general',
    tags JSONB DEFAULT '[]',
    mappings JSONB NOT NULL DEFAULT '[]',
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_public BOOLEAN DEFAULT false,
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_mapping_templates_created_by ON mapping_templates(created_by);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_category ON mapping_templates(category);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_is_public ON mapping_templates(is_public);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_usage_count ON mapping_templates(usage_count DESC);
CREATE INDEX IF NOT EXISTS idx_mapping_templates_tags ON mapping_templates USING GIN(tags);

-- Create template categories table for predefined categories
CREATE TABLE IF NOT EXISTS template_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    icon VARCHAR(50),
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default categories
INSERT INTO template_categories (name, description, icon, sort_order) VALUES
('general', 'General purpose mapping templates', 'layout', 1),
('ecommerce', 'E-commerce and retail integrations', 'shopping-cart', 2),
('crm', 'Customer relationship management', 'users', 3),
('marketing', 'Marketing and analytics platforms', 'megaphone', 4),
('finance', 'Financial services and accounting', 'dollar-sign', 5),
('healthcare', 'Healthcare and medical records', 'heart', 6),
('education', 'Education and learning platforms', 'graduation-cap', 7),
('hr', 'Human resources and payroll', 'briefcase', 8),
('logistics', 'Shipping and logistics', 'truck', 9),
('social', 'Social media and communications', 'share', 10)
ON CONFLICT (name) DO NOTHING;

-- Create template usage tracking table
CREATE TABLE IF NOT EXISTS template_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES mapping_templates(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mapping_id UUID REFERENCES mapping_configurations(id) ON DELETE SET NULL,
    used_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for usage logs
CREATE INDEX IF NOT EXISTS idx_template_usage_logs_template_id ON template_usage_logs(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_logs_user_id ON template_usage_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_logs_used_at ON template_usage_logs(used_at);

-- Create template sharing table for team collaboration
CREATE TABLE IF NOT EXISTS template_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES mapping_templates(id) ON DELETE CASCADE,
    shared_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    shared_with UUID REFERENCES users(id) ON DELETE CASCADE,
    team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
    permission VARCHAR(20) DEFAULT 'view' CHECK (permission IN ('view', 'use', 'edit')),
    shared_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(template_id, shared_with)
);

-- Create indexes for template shares
CREATE INDEX IF NOT EXISTS idx_template_shares_template_id ON template_shares(template_id);
CREATE INDEX IF NOT EXISTS idx_template_shares_shared_by ON template_shares(shared_by);
CREATE INDEX IF NOT EXISTS idx_template_shares_shared_with ON template_shares(shared_with);
CREATE INDEX IF NOT EXISTS idx_template_shares_team_id ON template_shares(team_id);

-- Add updated_at trigger for mapping_templates
CREATE OR REPLACE FUNCTION update_mapping_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER mapping_templates_updated_at
    BEFORE UPDATE ON mapping_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_mapping_templates_updated_at();

-- Create view for popular templates
CREATE OR REPLACE VIEW popular_templates AS
SELECT 
    t.*,
    u.username as created_by_username,
    tc.description as category_description,
    tc.icon as category_icon,
    -- Calculate popularity score based on usage and recency
    (t.usage_count * 1.0 + 
     EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - t.created_at)) / 86400 * -0.1
    ) as popularity_score
FROM mapping_templates t
LEFT JOIN users u ON t.created_by = u.id
LEFT JOIN template_categories tc ON t.category = tc.name
WHERE t.is_public = true
ORDER BY popularity_score DESC;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON mapping_templates TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON template_categories TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON template_usage_logs TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON template_shares TO app_user;
GRANT SELECT ON popular_templates TO app_user;

-- Grant sequence permissions
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Add comments for documentation
COMMENT ON TABLE mapping_templates IS 'Stores reusable field mapping templates with auto-mapping capabilities';
COMMENT ON TABLE template_categories IS 'Predefined categories for organizing mapping templates';
COMMENT ON TABLE template_usage_logs IS 'Tracks template usage for analytics and recommendations';
COMMENT ON TABLE template_shares IS 'Manages template sharing between users and teams';
COMMENT ON VIEW popular_templates IS 'View of popular templates with calculated popularity scores';

-- Add column comments
COMMENT ON COLUMN mapping_templates.tags IS 'JSON array of tags for categorization and search';
COMMENT ON COLUMN mapping_templates.mappings IS 'JSON array of field mappings with transformations';
COMMENT ON COLUMN mapping_templates.usage_count IS 'Number of times this template has been used';
COMMENT ON COLUMN template_shares.permission IS 'Permission level: view, use, or edit';
COMMENT ON COLUMN template_shares.expires_at IS 'Optional expiration date for shared access';