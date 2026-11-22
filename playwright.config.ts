import { defineConfig } from '@playwright/test';

/** E2E: drives all three apps with mouse, keyboard and typed commands (no camera needed) and runs axe. */
const CI = !!process.env.CI;
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: CI ? 1 : 0,
  reporter: CI ? 'github' : 'list',
  use: {
    viewport: { width: 1440, height: 900 },
    ...(CI ? {} : { channel: 'chrome' }),
    launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--enable-unsafe-swiftshader'] },
  },
  webServer: [
    { command: 'npm run dev -w @hocus/room-designer', url: 'http://localhost:5281', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev -w @hocus/planet-explorer', url: 'http://localhost:5282', reuseExistingServer: true, timeout: 120_000 },
    { command: 'npm run dev -w @hocus/kitchen-board', url: 'http://localhost:5283', reuseExistingServer: true, timeout: 120_000 },
  ],
});
