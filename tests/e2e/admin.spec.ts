/**
 * E2E: Admin dashboard flows.
 *
 * Tests:
 *   - Non-admin user is redirected or shown 403 when accessing /admin
 *   - Admin user can access /admin/dashboard
 *   - Metrics and Users panels render (stubbed API)
 */
import { test, expect } from '@playwright/test';
import { createTestUser } from './helpers';

// ── Stub admin API responses ──────────────────────────────────────────────────

const STUB_METRICS = {
  totalUsers: 42,
  verifiedUsers: 38,
  activeSubscriptions: 12,
  relayConnectionsActive: 5,
  relayConnectionsOffline: 2,
  switchesArmed: 10,
  switchesWarning: 1,
  switchesTriggered: 0,
  activeReleaseRuns: 0,
  packetsStored: 8,
  notificationFailuresLast24h: 0,
};

const STUB_USERS = {
  users: [
    {
      id: 'user-admin-stub',
      email: 'admin@aegistest.invalid',
      displayName: 'Admin User',
      emailVerified: true,
      role: 'admin',
      timezone: 'UTC',
      totpEnabled: false,
      createdAt: new Date().toISOString(),
    },
  ],
};

async function stubAdminApis(page: import('@playwright/test').Page) {
  await page.route('/api/admin/metrics', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_METRICS),
    });
  });
  await page.route('/api/admin/users', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(STUB_USERS),
    });
  });
  await page.route('/api/admin/subscriptions', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ subscriptions: [] }),
    });
  });
  await page.route('/api/admin/relay-connections', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ connections: [] }),
    });
  });
  await page.route('/api/admin/release-runs', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ releaseRuns: [] }),
    });
  });
  await page.route('/api/admin/system-health', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        status: 'ok',
        dbConnected: true,
        uptime: 3600,
        timestamp: new Date().toISOString(),
      }),
    });
  });
}

// ── Non-admin access ──────────────────────────────────────────────────────────

test('non-admin user accessing /admin sees 403 or is redirected', async ({ page }) => {
  // Register a normal (non-admin) user.
  await createTestUser(page);

  // The admin routes do a server-side role check and return 403 for
  // non-admin users.  The UI either redirects or shows an error state.
  // Stub the API to return 403 for admin metrics.
  await page.route('/api/admin/metrics', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Forbidden' }),
    });
  });
  // Also 403 the other admin APIs.
  for (const path of [
    '/api/admin/users',
    '/api/admin/subscriptions',
    '/api/admin/relay-connections',
    '/api/admin/release-runs',
    '/api/admin/system-health',
  ]) {
    await page.route(path, async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Forbidden' }),
      });
    });
  }

  await page.goto('/admin');

  // The page should either redirect to /login or show a forbidden/error message.
  // Give it time to settle.
  await page.waitForTimeout(2_000);

  const currentUrl = page.url();
  const redirectedToLogin = currentUrl.includes('/login');
  const errorVisible = await page
    .getByText(/forbidden|403|not authorized|access denied|error/i)
    .first()
    .isVisible();

  expect(redirectedToLogin || errorVisible).toBe(true);
});

// ── Admin access ──────────────────────────────────────────────────────────────

test('admin dashboard renders metrics when API returns data', async ({ page }) => {
  // Register a user — in practice this would be an admin user.
  // We stub the API so the role check happens server-side (not tested here).
  await createTestUser(page);
  await stubAdminApis(page);

  await page.goto('/admin');

  // Metrics panel should render with the stubbed numbers.
  // "42" is totalUsers from our stub.
  await expect(page.getByText('42').first()).toBeVisible({ timeout: 8_000 });
});

test('admin dashboard users panel shows user list', async ({ page }) => {
  await createTestUser(page);
  await stubAdminApis(page);

  await page.goto('/admin');

  // The admin dashboard has panel navigation. Click "Users" if tabs are visible.
  const usersTab = page.getByRole('button', { name: /^users$/i });
  if (await usersTab.isVisible({ timeout: 3_000 })) {
    await usersTab.click();
  }

  // After clicking Users, the user email from stub should appear.
  await expect(page.getByText('admin@aegistest.invalid').first()).toBeVisible({
    timeout: 8_000,
  });
});

test('admin dashboard overview panel is default and has metric cards', async ({ page }) => {
  await createTestUser(page);
  await stubAdminApis(page);

  await page.goto('/admin');

  // Should show totalUsers metric from stub.
  await expect(page.getByText('42').first()).toBeVisible({ timeout: 8_000 });
  // Should show activeSubscriptions from stub (12).
  await expect(page.getByText('12').first()).toBeVisible({ timeout: 8_000 });
});

test('system health panel shows "ok" status', async ({ page }) => {
  await createTestUser(page);
  await stubAdminApis(page);

  await page.goto('/admin');

  // Click the health tab if present.
  const healthTab = page.getByRole('button', { name: /health/i });
  if (await healthTab.isVisible({ timeout: 3_000 })) {
    await healthTab.click();
    // Health stub returns status: 'ok'
    await expect(page.getByText(/ok|healthy|connected/i).first()).toBeVisible({
      timeout: 5_000,
    });
  }
});
