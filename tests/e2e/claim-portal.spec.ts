/**
 * E2E: Claim portal flows.
 *
 * Tests:
 *   - Invalid claim token shows a generic failure message (not a 500/crash)
 *   - Valid claim URL renders the claim page (stubbed via route mock)
 */
import { test, expect } from '@playwright/test';

// ── Invalid token ─────────────────────────────────────────────────────────────

test('invalid claim token shows generic failure — not a 500 error', async ({ page }) => {
  // The server returns 404 for an unknown token. The UI should show a
  // human-friendly "not found" message rather than a blank screen or stack trace.
  await page.route('/api/claim/status/*', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Claim not found' }),
    });
  });

  await page.goto('/claim/invalid-token-that-does-not-exist');

  // Should not show an unhandled JS exception or blank screen.
  await expect(page.getByText(/500|TypeError|unhandled/i)).not.toBeVisible({ timeout: 5_000 });

  // Should show some kind of "not found" or "unavailable" messaging.
  // ClaimLanding shows "Claim Unavailable" for unknown tokens.
  await expect(
    page.getByText(/unavailable|not found|expired|no longer available|error/i).first(),
  ).toBeVisible({ timeout: 8_000 });
});

// ── Valid claim (stubbed) ─────────────────────────────────────────────────────

test('valid claim token renders claim landing page', async ({ page }) => {
  const fakeToken = 'valid-test-token-e2e';

  // Stub the claim status endpoint to return an in-progress claim.
  await page.route(`/api/claim/status/${fakeToken}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'claim-test-id',
        status: 'pending',
        expiresAt: new Date(Date.now() + 86_400_000).toISOString(), // +1 day
        notifiedAt: new Date().toISOString(),
        openedAt: null,
        verifiedAt: null,
        acceptedAt: null,
        packetDownloadedAt: null,
        keyViewedAt: null,
        acknowledgedAt: null,
        ownerDisplayName: 'Test Owner',
      }),
    });
  });

  await page.goto(`/claim/${fakeToken}`);

  // The claim landing should render content from the stub.
  // ClaimLanding shows the owner name and an "Open Claim" button for pending claims.
  await expect(page.getByText(/test owner|open claim|pending/i).first()).toBeVisible({
    timeout: 8_000,
  });
});

// ── Terminal states ───────────────────────────────────────────────────────────

test('already acknowledged claim shows "Claim Complete" message', async ({ page }) => {
  const token = 'already-acknowledged-token';

  await page.route(`/api/claim/status/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'claim-ack-id',
        status: 'acknowledged',
        expiresAt: null,
        notifiedAt: new Date().toISOString(),
        openedAt: new Date().toISOString(),
        verifiedAt: new Date().toISOString(),
        acceptedAt: new Date().toISOString(),
        packetDownloadedAt: new Date().toISOString(),
        keyViewedAt: new Date().toISOString(),
        acknowledgedAt: new Date().toISOString(),
        ownerDisplayName: null,
      }),
    });
  });

  await page.goto(`/claim/${token}`);

  await expect(page.getByText(/claim complete|already acknowledged/i).first()).toBeVisible({
    timeout: 8_000,
  });
});

test('expired claim shows "Claim Expired" message', async ({ page }) => {
  const token = 'expired-claim-token';

  await page.route(`/api/claim/status/${token}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'claim-exp-id',
        status: 'expired',
        expiresAt: new Date(Date.now() - 1000).toISOString(),
        notifiedAt: new Date().toISOString(),
        openedAt: null,
        verifiedAt: null,
        acceptedAt: null,
        packetDownloadedAt: null,
        keyViewedAt: null,
        acknowledgedAt: null,
        ownerDisplayName: null,
      }),
    });
  });

  await page.goto(`/claim/${token}`);

  await expect(page.getByText(/claim expired|expired/i).first()).toBeVisible({
    timeout: 8_000,
  });
});
