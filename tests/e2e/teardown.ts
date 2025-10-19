import { execSync } from 'child_process';

export default async function globalTeardown() {
  console.log('🧹 Tearing down E2E test environment...');

  try {
    // Close browser
    const browser = (global as any).browser;
    if (browser) {
      await browser.close();
    }

    // Stop application stack
    console.log('🛑 Stopping application stack...');
    execSync('docker-compose -f docker-compose.test.yml down -v', { stdio: 'inherit' });

    console.log('✅ E2E test environment cleaned up');
  } catch (error) {
    console.error('❌ Failed to cleanup E2E test environment:', error);
  }
}