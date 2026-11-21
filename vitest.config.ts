import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'unit', include: ['tests/unit/**/*.test.ts', 'tests/properties/regressions/**/*.test.ts'] } },
      { test: { name: 'properties', include: ['tests/properties/**/*.prop.test.ts'], testTimeout: 120_000 } },
      { test: { name: 'replays', include: ['tests/replays/**/*.test.ts'] } },
    ],
  },
});
