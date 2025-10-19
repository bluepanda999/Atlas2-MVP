-- Streaming Upload Tables for PostgreSQL
-- Created for 3GB file upload capability

-- Upload Sessions Table
CREATE TABLE IF NOT EXISTS upload_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    file_name VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_path TEXT NOT NULL,
    user_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'initialized' CHECK (status IN ('initialized', 'uploading', 'paused', 'completed', 'failed', 'cancelled')),
    uploaded_bytes BIGINT DEFAULT 0,
    error TEXT,
    chunk_size INTEGER DEFAULT 65536,
    total_chunks INTEGER,
    completed_chunks INTEGER DEFAULT 0,
    upload_speed DOUBLE PRECISION,
    estimated_time_remaining DOUBLE PRECISION,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for upload_sessions
CREATE INDEX IF NOT EXISTS idx_upload_sessions_user_id ON upload_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_status ON upload_sessions(status);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_created_at ON upload_sessions(created_at);
CREATE INDEX IF NOT EXISTS idx_upload_sessions_file_name ON upload_sessions(file_name);

-- Create trigger for updated_at
CREATE TRIGGER update_upload_sessions_updated_at BEFORE UPDATE ON upload_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample upload session for testing (optional)
-- INSERT INTO upload_sessions (id, file_name, original_name, file_size, mime_type, file_path, status)
-- VALUES ('test-upload-1', 'test-file.csv', 'test-file.csv', 1024, 'text/csv', '/uploads/test-upload-1_test-file.csv', 'initialized')
-- ON CONFLICT (id) DO NOTHING;