import { execSync } from 'child_process';

export default async function globalTeardown() {
  console.log('🧹 Tearing down integration test environment...');

  try {
    // Clean up test database
    console.log('🗑️  Cleaning up test database...');
    execSync('docker-compose -f docker-compose.test.yml down -v', { stdio: 'inherit' });

    console.log('✅ Integration test environment cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup integration test environment:', error);
  }
}