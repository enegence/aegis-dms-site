import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Aegis DMS Site.
 *
 * The web Vite dev server proxies API calls to the backend at :8001,
 * so `baseURL` points at the Vite server (default :5173).  When
 * BASE_URL is set (e.g. in CI against a pre-built preview) it is used
 * instead.
 *
 * `reuseExistingServer: true` means the harness won't fail if you
 * start the dev servers manually before running the tests.
 */
export default defineConfig({
  testDir: './tests/e2e',
  testIdAttribute: 'data-testid',

  /* Retry once in CI, zero locally */
  retries: process.env.CI ? 1 : 0,

  /* Parallelism */
  fullyParallel: false,
  workers: 1,

  /* Reporter */
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:5173',
    /* Collect trace on first retry */
    trace: 'on-first-retry',
    /* Screenshot only on failure */
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /**
   * Start Vite dev server (which proxies /api → :8001) before tests.
   * reuseExistingServer lets you pre-start it for faster iteration.
   *
   * The backend server must already be running on :8001 (or started
   * separately) for API calls to succeed.
   */
  webServer: {
    command: 'npm run dev --workspace=web',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 60_000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_URL ||
        'postgresql://aegis:aegis@localhost:5432/aegis_site_test',
    },
  },
});
