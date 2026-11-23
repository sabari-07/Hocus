import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Flat config for Stryker (no projects). Property tests run with fewer cases per mutant to keep runs practical.
// The aliases matter: Stryker copies the repo into a sandbox, but `@hocus/*` would otherwise resolve through the
// node_modules symlinks to the ORIGINAL sources, so mutants would never be exercised.
process.env.FC_RUNS ??= '5';
const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));
export default defineConfig({
  resolve: {
    alias: {
      '@hocus/core': here('./packages/core/src/index.ts'),
      '@hocus/testkit': here('./packages/testkit/src/index.ts'),
    },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/properties/**/*.prop.test.ts'],
    exclude: ['tests/unit/mcp.test.ts'],
    setupFiles: ['tests/properties/setup.ts'],
    testTimeout: 120_000,
  },
});
