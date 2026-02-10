import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect, etc.)
    globals: true,

    // Test environment
    environment: 'node',

    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.config.ts',
        '**/*.config.js',
        '**/types/',
        '**/*.d.ts',
        '**/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 70,
        statements: 70,
      },
    },

    // Test file patterns
    include: ['packages/*/tests/**/*.test.ts', 'packages/*/src/**/*.test.ts'],

    // Timeout settings
    testTimeout: 10000,
    hookTimeout: 10000,
  },
})
