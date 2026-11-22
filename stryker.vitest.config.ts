import { defineConfig } from 'vitest/config';

// Flat config for Stryker (no projects). Property tests run with fewer cases per mutant to keep runs practical.
process.env.FC_RUNS ??= '5';
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/properties/**/*.prop.test.ts'],
    exclude: ['tests/unit/mcp.test.ts'],
    setupFiles: ['tests/properties/setup.ts'],
    testTimeout: 120_000,
  },
});
