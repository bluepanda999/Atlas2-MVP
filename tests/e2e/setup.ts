import { execSync } from 'child_process';
import { chromium, Browser, Page } from 'playwright';

export default async function globalSetup() {
  console.log('🔧 Setting up E2E test environment...');

  try {
    // Start full application stack
    console.log('🚀 Starting application stack...');
    execSync('docker-compose -f docker-compose.test.yml up -d', { stdio: 'inherit' });

    // Wait for application to be ready
    console.log('⏳ Waiting for application...');
    await waitForApplication();

    // Setup browser
    console.log('🌐 Setting up browser...');
    const browser = await chromium.launch({
      headless: process.env.CI === 'true',
      args: ['--no-sandbox', '--disable-dev-shm-usage']
    });

    // Store browser instance for tests
    (global as any).browser = browser;

    console.log('✅ E2E test environment ready');
  } catch (error) {
    console.error('❌ Failed to setup E2E test environment:', error);
    process.exit(1);
  }
}

async function waitForApplication(): Promise<void> {
  const maxAttempts = 60;
  const delay = 2000;

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch('http://localhost:3000/health');
      if (response.ok) {
        // Also check API
        const apiResponse = await fetch('http://localhost:3001/health');
        if (apiResponse.ok) {
          return;
        }
      }
    } catch {
      // Continue waiting
    }

    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error('Application not ready after maximum attempts');
}