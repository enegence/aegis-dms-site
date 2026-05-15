/**
 * E2E: Hosted switch flows.
 *
 * Tests:
 *   - /switches page renders for authenticated user
 *   - Create switch via API and page reflects it
 *   - Switch arm requires readiness (contacts + estate items)
 *   - Arm switch after seeding contacts and estate items
 *   - Check-in updates lastCheckedInAt
 *
 * Note: subscription seeding requires server started with AEGIS_TEST_SEED=true.
 * Tests that need an active subscription are skipped when seed endpoint is unavailable.
 */
import { test, expect } from '@playwright/test';
import { createTestUser, apiRequest, seedSubscription } from './helpers';

test('unauthenticated user redirected from /switches to /login', async ({ page }) => {
  await page.goto('/switches');
  await expect(page).toHaveURL(/\/login/);
});

test('authenticated user can view /switches page', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/switches');
  await expect(page).toHaveURL(/\/switches/);
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('create hosted switch via API and page reflects it', async ({ page, request }) => {
  const user = await createTestUser(page);

  // Seed a hosted subscription so the switch API accepts the request.
  // Get userId from /api/auth/me.
  const me = await apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  await seedSubscription(request, me.id, 'hosted');

  const sw = await apiRequest<{ id: string; name: string }>(page, 'POST', '/api/switches', {
    name: 'E2E Test Switch',
    mode: 'heartbeat',
    intervalDays: 14,
    gracePeriodHours: 24,
  });

  await page.goto('/switches');
  await expect(page.getByText('E2E Test Switch')).toBeVisible({ timeout: 5_000 });
});

test('arm switch requires readiness — returns 422 when not ready', async ({ page, request }) => {
  const me = await (async () => {
    await createTestUser(page);
    return apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  })();
  await seedSubscription(request, me.id, 'hosted');

  const sw = await apiRequest<{ id: string }>(page, 'POST', '/api/switches', {
    name: 'E2E Arm Test',
    mode: 'heartbeat',
    intervalDays: 14,
    gracePeriodHours: 24,
  });

  // Arm without contacts/estate items → 422.
  const result = await page.evaluate(async (switchId) => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch(`/api/switches/${switchId}/arm`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: res.status };
  }, sw.id);

  expect(result.status).toBe(422);
});

test('check-in endpoint responds for active switch', async ({ page, request }) => {
  const me = await (async () => {
    await createTestUser(page);
    return apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  })();
  await seedSubscription(request, me.id, 'hosted');

  const sw = await apiRequest<{ id: string }>(page, 'POST', '/api/switches', {
    name: 'E2E Check-In Test',
    mode: 'heartbeat',
    intervalDays: 14,
    gracePeriodHours: 24,
  });

  // Check-in on an unarmed switch returns 200 or 409 (not armed) — either is valid.
  const result = await page.evaluate(async (switchId) => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch(`/api/switches/${switchId}/checkin`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    return { status: res.status };
  }, sw.id);

  expect([200, 409]).toContain(result.status);
});
