#!/bin/bash

# Database migration script
ENV=${1:-"development"}

echo "🔄 Running database migrations for $ENV environment..."

case $ENV in
  "development")
    DATABASE_URL="postgresql://atlas2:password@localhost:5432/atlas2_dev"
    ;;
  "test")
    DATABASE_URL="postgresql://test:test@localhost:5433/atlas2_test"
    ;;
  "production")
    if [ -z "$DATABASE_URL" ]; then
      echo "❌ DATABASE_URL environment variable is required for production"
      exit 1
    fi
    ;;
  *)
    echo "❌ Unknown environment: $ENV"
    echo "Usage: $0 [development|test|production]"
    exit 1
    ;;
esac

echo "🗄️  Migrating database: $DATABASE_URL"

# Run migrations using node-postgres directly
node -e "
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({ connectionString: '$DATABASE_URL' });

async function runMigrations() {
  try {
    console.log('📂 Reading migration files...');
    const migrationsDir = path.join(__dirname, '../database/migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    console.log(\`📋 Found \${migrationFiles.length} migration files\`);

    // Create migrations table if it doesn't exist
    await pool.query(\`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    \`);

    // Get executed migrations
    const { rows: executedMigrations } = await pool.query(
      'SELECT filename FROM migrations ORDER BY filename'
    );
    const executedFiles = executedMigrations.map(row => row.filename);

    // Run pending migrations
    for (const file of migrationFiles) {
      if (!executedFiles.includes(file)) {
        console.log(\`🔄 Running migration: \${file}\`);
        
        const migrationSQL = fs.readFileSync(
          path.join(migrationsDir, file),
          'utf8'
        );

        await pool.query('BEGIN');
        try {
          await pool.query(migrationSQL);
          await pool.query(
            'INSERT INTO migrations (filename) VALUES ($1)',
            [file]
          );
          await pool.query('COMMIT');
          console.log(\`✅ Migration completed: \${file}\`);
        } catch (error) {
          await pool.query('ROLLBACK');
          throw error;
        }
      } else {
        console.log(\`⏭️  Skipping already executed migration: \${file}\`);
      }
    }

    console.log('✅ All migrations completed successfully');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigrations();
"

echo "✅ Database migrations completed"