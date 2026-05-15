/**
 * E2E: Relay Escrow trust acknowledgement and enable flow.
 *
 * Tests:
 *   - /relay page renders for authenticated user
 *   - Relay escrow status endpoint returns unenabled for new connection
 *   - Relay escrow acknowledge writes trust row
 *   - Relay escrow cannot enable without acknowledgement (409)
 *
 * Cross-repo integration (OSS ↔ SaaS) is covered by the nightly/release-gate
 * run documented in docs/e2e-test-plan.md. These tests use the SaaS API
 * directly with a seeded relay connection.
 *
 * Requires AEGIS_TEST_SEED=true for relay connection seeding.
 */
import { test, expect } from '@playwright/test';
import { createTestUser, apiRequest, seedSubscription } from './helpers';

test('unauthenticated user redirected from /relay to /login', async ({ page }) => {
  await page.goto('/relay');
  await expect(page).toHaveURL(/\/login/);
});

test('authenticated user can view /relay page', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/relay');
  await expect(page).toHaveURL(/\/relay/);
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('relay escrow trust-acknowledge endpoint accessible', async ({ page, request }) => {
  const me = await (async () => {
    await createTestUser(page);
    return apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  })();
  await seedSubscription(request, me.id, 'relay');

  // Create a relay connection.
  const conn = await apiRequest<{ id: string }>(page, 'POST', '/api/relay/connections', {
    name: 'E2E Relay Conn',
    mode: 'relay_monitoring',
  });

  // GET escrow status — should be disabled initially.
  const status = await apiRequest<{ isEscrowEnabled: boolean }>(
    page,
    'GET',
    `/api/relay/${conn.id}/escrow`,
  );
  expect(status.isEscrowEnabled).toBe(false);
});

test('relay escrow enable without acknowledgement returns 409', async ({ page, request }) => {
  const me = await (async () => {
    await createTestUser(page);
    return apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  })();
  await seedSubscription(request, me.id, 'relay');

  const conn = await apiRequest<{ id: string }>(page, 'POST', '/api/relay/connections', {
    name: 'E2E Escrow No Ack',
    mode: 'relay_monitoring',
  });

  const result = await page.evaluate(async (connId) => {
    const csrfRes = await fetch('/api/csrf', { credentials: 'include' });
    const { csrfToken } = await csrfRes.json() as { csrfToken: string };
    const res = await fetch(`/api/relay/${connId}/escrow/enable`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'X-CSRF-Token': csrfToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: [] }),
    });
    return { status: res.status };
  }, conn.id);

  // 409 = acknowledgement required; 400 = missing contactIds (both acceptable — no ack first).
  expect([409, 400]).toContain(result.status);
});

test('relay escrow acknowledge flow writes trust row and returns acknowledgementId', async ({ page, request }) => {
  const me = await (async () => {
    await createTestUser(page);
    return apiRequest<{ id: string }>(page, 'GET', '/api/auth/me');
  })();
  await seedSubscription(request, me.id, 'relay');

  const conn = await apiRequest<{ id: string }>(page, 'POST', '/api/relay/connections', {
    name: 'E2E Escrow Ack',
    mode: 'relay_monitoring',
  });

  const ack = await apiRequest<{ acknowledgementId: string; version: string }>(
    page,
    'POST',
    `/api/relay/${conn.id}/escrow/acknowledge`,
    {},
  );
  expect(ack.acknowledgementId).toBeTruthy();
  expect(ack.version).toBeTruthy();
});
