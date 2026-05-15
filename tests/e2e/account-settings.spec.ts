/**
 * E2E: Account settings — data export and account deletion flows.
 *
 * Tests:
 *   - /app/settings page renders for authenticated user
 *   - Export data endpoint responds with JSON archive
 *   - Account deletion flow — requires password confirmation
 *   - Account deletion flow — incorrect password rejected
 */
import { test, expect } from '@playwright/test';
import { createTestUser, apiRequest, getCSRFToken } from './helpers';

test('unauthenticated user redirected from /app/settings to /login', async ({ page }) => {
  await page.goto('/app/settings');
  await expect(page).toHaveURL(/\/login/);
});

test('authenticated user can view /app/settings page', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/app/settings');
  await expect(page).toHaveURL(/\/app\/settings/);
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('export data endpoint returns JSON archive', async ({ page }) => {
  await createTestUser(page);

  // Call the export endpoint via the page context.
  const result = await page.evaluate(async () => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch('/api/account/export', {
      method: 'GET',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken },
    });
    return { status: res.status, contentType: res.headers.get('content-type') };
  });

  expect(result.status).toBe(200);
  expect(result.contentType).toMatch(/application\/json/);
});

test('account deletion rejected with wrong password', async ({ page }) => {
  const user = await createTestUser(page);

  const result = await page.evaluate(async (password) => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ password }),
    });
    return { status: res.status };
  }, 'wrong-password-999');

  expect(result.status).toBe(401);
});

test('account deletion succeeds with correct password and logs out', async ({ page }) => {
  const user = await createTestUser(page);

  const result = await page.evaluate(async (password) => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch('/api/account/delete', {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-Token': csrfToken,
      },
      body: JSON.stringify({ password }),
    });
    return { status: res.status };
  }, user.password);

  expect(result.status).toBe(200);

  // After deletion, the user should be unauthenticated.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});
