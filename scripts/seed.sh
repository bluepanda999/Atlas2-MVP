#!/bin/bash

# Database seeding script
ENV=${1:-"development"}

echo "🌱 Seeding database for $ENV environment..."

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

echo "🗄️  Seeding database: $DATABASE_URL"

# Run seed data
node -e "
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

const pool = new Pool({ connectionString: '$DATABASE_URL' });

async function seedDatabase() {
  try {
    console.log('🌱 Starting database seeding...');

    // Seed users
    console.log('👤 Seeding users...');
    const hashedPassword = await bcrypt.hash('password123', 10);
    
    const users = [
      {
        id: uuidv4(),
        email: 'admin@example.com',
        name: 'Admin User',
        password_hash: hashedPassword,
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        email: 'user@example.com',
        name: 'Test User',
        password_hash: hashedPassword,
        role: 'user',
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    for (const user of users) {
      await pool.query(\`
        INSERT INTO users (id, email, name, password_hash, role, created_at, updated_at)
        VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
        ON CONFLICT (email) DO NOTHING
      \`, [user.id, user.email, user.name, user.password_hash, user.role, user.created_at, user.updated_at]);
    }

    // Seed workspaces
    console.log('🏢 Seeding workspaces...');
    const { rows: userRows } = await pool.query('SELECT id, email FROM users WHERE email IN (\$1, \$2)', ['admin@example.com', 'user@example.com']);
    
    const workspaces = [
      {
        id: uuidv4(),
        name: 'Demo Workspace',
        description: 'A demo workspace for testing',
        owner_id: userRows[0].id,
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        id: uuidv4(),
        name: 'Test Project',
        description: 'A test project workspace',
        owner_id: userRows[1].id,
        created_at: new Date(),
        updated_at: new Date()
      }
    ];

    for (const workspace of workspaces) {
      await pool.query(\`
        INSERT INTO workspaces (id, name, description, owner_id, created_at, updated_at)
        VALUES (\$1, \$2, \$3, \$4, \$5, \$6)
        ON CONFLICT (id) DO NOTHING
      \`, [workspace.id, workspace.name, workspace.description, workspace.owner_id, workspace.created_at, workspace.updated_at]);
    }

    // Seed workspace members
    console.log('👥 Seeding workspace members...');
    const { rows: workspaceRows } = await pool.query('SELECT id, owner_id FROM workspaces');
    
    for (const workspace of workspaceRows) {
      // Add owner as member
      await pool.query(\`
        INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
        VALUES (\$1, \$2, \$3, \$4, \$5)
        ON CONFLICT (workspace_id, user_id) DO NOTHING
      \`, [workspace.id, workspace.owner_id, 'owner', new Date(), new Date()]);

      // Add other users as members
      for (const user of userRows) {
        if (user.id !== workspace.owner_id) {
          await pool.query(\`
            INSERT INTO workspace_members (workspace_id, user_id, role, created_at, updated_at)
            VALUES (\$1, \$2, \$3, \$4, \$5)
            ON CONFLICT (workspace_id, user_id) DO NOTHING
          \`, [workspace.id, user.id, 'member', new Date(), new Date()]);
        }
      }
    }

    // Seed sample files for testing
    console.log('📁 Seeding sample files...');
    const { rows: demoWorkspace } = await pool.query('SELECT id FROM workspaces WHERE name = \$1', ['Demo Workspace']);
    
    if (demoWorkspace.length > 0) {
      const files = [
        {
          id: uuidv4(),
          workspace_id: demoWorkspace[0].id,
          filename: 'sample-data.csv',
          original_filename: 'sample-data.csv',
          file_size: 1024,
          mime_type: 'text/csv',
          status: 'completed',
          created_at: new Date(),
          updated_at: new Date()
        },
        {
          id: uuidv4(),
          workspace_id: demoWorkspace[0].id,
          filename: 'test-import.csv',
          original_filename: 'test-import.csv',
          file_size: 2048,
          mime_type: 'text/csv',
          status: 'processing',
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      for (const file of files) {
        await pool.query(\`
          INSERT INTO files (id, workspace_id, filename, original_filename, file_size, mime_type, status, created_at, updated_at)
          VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7, \$8, \$9)
          ON CONFLICT (id) DO NOTHING
        \`, [file.id, file.workspace_id, file.filename, file.original_filename, file.file_size, file.mime_type, file.status, file.created_at, file.updated_at]);
      }
    }

    // Seed sample mappings
    console.log('🗺️  Seeding sample mappings...');
    const { rows: sampleFiles } = await pool.query('SELECT id FROM files WHERE workspace_id = \$1 LIMIT 1', [demoWorkspace[0]?.id]);
    
    if (sampleFiles.length > 0) {
      const mappings = [
        {
          id: uuidv4(),
          file_id: sampleFiles[0].id,
          name: 'Sample Mapping',
          description: 'A sample field mapping configuration',
          config: {
            fields: [
              { source: 'name', target: 'full_name', required: true },
              { source: 'email', target: 'email_address', required: true },
              { source: 'phone', target: 'phone_number', required: false }
            ]
          },
          created_at: new Date(),
          updated_at: new Date()
        }
      ];

      for (const mapping of mappings) {
        await pool.query(\`
          INSERT INTO field_mappings (id, file_id, name, description, config, created_at, updated_at)
          VALUES (\$1, \$2, \$3, \$4, \$5, \$6, \$7)
          ON CONFLICT (id) DO NOTHING
        \`, [mapping.id, mapping.file_id, mapping.name, mapping.description, JSON.stringify(mapping.config), mapping.created_at, mapping.updated_at]);
      }
    }

    console.log('✅ Database seeding completed successfully');
    console.log('');
    console.log('👤 Test users created:');
    console.log('  Email: admin@example.com, Password: password123 (Admin)');
    console.log('  Email: user@example.com, Password: password123 (User)');
    console.log('');
    console.log('🏢 Demo workspace created with sample data');

  } catch (error) {
    console.error('❌ Database seeding failed:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedDatabase();
"

echo "✅ Database seeding completed"