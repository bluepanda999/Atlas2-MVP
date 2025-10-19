module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/src', '<rootDir>/api', '<rootDir>/worker'],
  testMatch: [
    '**/__tests__/**/*.+(ts|tsx|js)',
    '**/*.(test|spec).+(ts|tsx|js)'
  ],
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest'
  },
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    'api/**/*.{ts,tsx}',
    'worker/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/coverage/**'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleNameMapping: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@api/(.*)$': '<rootDir>/api/$1',
    '^@worker/(.*)$': '<rootDir>/worker/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  },
  testTimeout: 30000,
  verbose: true,
  projects: [
    {
      displayName: 'unit',
      testMatch: ['<rootDir>/tests/unit/**/*.test.ts'],
      testEnvironment: 'node'
    },
    {
      displayName: 'integration',
      testMatch: ['<rootDir>/tests/integration/**/*.test.ts'],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/integration/setup.ts',
      globalTeardown: '<rootDir>/tests/integration/teardown.ts'
    },
    {
      displayName: 'e2e',
      testMatch: ['<rootDir>/tests/e2e/**/*.test.ts'],
      testEnvironment: 'node',
      globalSetup: '<rootDir>/tests/e2e/setup.ts',
      globalTeardown: '<rootDir>/tests/e2e/teardown.ts'
    }
  ]
};