import { execSync } from 'child_process';
import { config } from 'dotenv';

// Load test environment
config({ path: '.env.test' });

// Test database configuration
const TEST_DB_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/atlas2_test';
const TEST_REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379/1';

export default async function globalSetup() {
  console.log('🔧 Setting up integration test environment...');

  try {
    // Start test database if not running
    console.log('🗄️  Starting test database...');
    execSync('docker-compose -f docker-compose.test.yml up -d postgres-test redis-test', { stdio: 'inherit' });

    // Wait for database to be ready
    console.log('⏳ Waiting for database...');
    await waitForDatabase();

    // Run database migrations
    console.log('🔄 Running database migrations...');
    execSync(`DATABASE_URL="${TEST_DB_URL}" npm run migrate:test`, { stdio: 'inherit' });

    // Seed test data
    console.log('🌱 Seeding test data...');
    execSync(`DATABASE_URL="${TEST_DB_URL}" npm run seed:test`, { stdio: 'inherit' });

    console.log('✅ Integration test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup integration test environment:', error);
    process.exit(1);
  }
}

async function waitForDatabase(): Promise<void> {
  const maxAttempts = 30;
  const delay = 1000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      execSync(`pg_isready -d "${TEST_DB_URL}"`, { stdio: 'pipe' });
      return;
    } catch {
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw new Error('Database not ready after maximum attempts');
}