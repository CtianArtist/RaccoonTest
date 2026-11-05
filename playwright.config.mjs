import { defineConfig } from '@playwright/test';

const baseURL = process.env.E2E_BASE_URL ||
  (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : undefined);
if (!baseURL) throw new Error('Set E2E_BASE_URL to the development storefront URL.');
const url = new URL(baseURL);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname))
  throw new Error('Browser tests require HTTPS (except localhost).');

export default defineConfig({
  testDir: './tests/browser',
  globalSetup: './tests/browser/setup.mjs',
  fullyParallel: false,
  workers: 1,
  retries: 0, // Mutations and payments must not be silently repeated.
  timeout: 90_000,
  expect: { timeout: 15_000 },
  outputDir: 'generated-artifacts/browser/results',
  reporter: [['list'], ['html', { outputFolder: 'generated-artifacts/browser/report', open: 'never' }]],
  use: {
    baseURL,
    browserName: 'chromium',
    // Auth cookies, Clerk testing tokens and checkout URLs must not end up in traces.
    trace: 'off',
    video: 'off',
    screenshot: 'off',
    serviceWorkers: 'block',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {},
  },
  projects: [
    { name: 'customers', testMatch: 'customers.spec.mjs' },
    { name: 'simulated-checkout', testMatch: 'simulation.spec.mjs' },
  ],
});
