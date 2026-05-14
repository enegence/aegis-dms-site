/**
 * E2E: Hosted onboarding flow.
 *
 * Tests:
 *   - User sees product picker on first onboarding visit
 *   - After selecting Hosted, trust model step is shown
 *   - Trust acknowledgement CTA is present
 *   - Checklist steps appear after acknowledging
 *   - Deep links to /contacts, /estate, /switches are present in checklist
 */
import { test, expect } from '@playwright/test';
import { createTestUser } from './helpers';

// ── Stub onboarding API responses ─────────────────────────────────────────────

/**
 * Stub GET /api/onboarding to return the given state.
 */
async function stubOnboarding(
  page: import('@playwright/test').Page,
  state: Record<string, unknown>,
) {
  await page.route('/api/onboarding', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(state),
      });
    } else {
      // Allow PUT/POST through (or fulfill with the updated state).
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...state, currentStep: 'trust_acknowledgement' }),
      });
    }
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test('new user sees product picker on /onboarding', async ({ page }) => {
  await createTestUser(page);

  // Stub onboarding to show undecided state (first visit).
  await stubOnboarding(page, {
    preferredProduct: 'undecided',
    currentStep: 'product_selection',
    completedAt: null,
    subscription: { plan: null, status: null, hasRelay: false, hasHosted: false },
    nextRoute: '/onboarding',
  });

  await page.goto('/onboarding');

  // Product picker shows both options.
  await expect(page.getByText('Aegis Hosted').first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByText('Aegis Relay').first()).toBeVisible({ timeout: 8_000 });
});

test('hosted onboarding shows trust model step', async ({ page }) => {
  await createTestUser(page);

  await stubOnboarding(page, {
    preferredProduct: 'hosted',
    currentStep: 'explain_trust_model',
    completedAt: null,
    subscription: { plan: 'hosted', status: 'active', hasRelay: false, hasHosted: true },
    nextRoute: '/onboarding',
  });

  await page.goto('/onboarding');

  // Should show the trust model heading.
  await expect(page.getByText(/how hosted trust works/i)).toBeVisible({ timeout: 8_000 });
});

test('hosted onboarding trust acknowledgement CTA is present', async ({ page }) => {
  await createTestUser(page);

  await stubOnboarding(page, {
    preferredProduct: 'hosted',
    currentStep: 'trust_acknowledgement',
    completedAt: null,
    subscription: { plan: 'hosted', status: 'active', hasRelay: false, hasHosted: true },
    nextRoute: '/onboarding',
  });

  await page.goto('/onboarding');

  // The acknowledgement step should show a CTA button to proceed / acknowledge.
  await expect(page.getByText(/acknowledge the trust model/i)).toBeVisible({ timeout: 8_000 });
  // A button or link to continue.
  const ackButton = page.getByRole('button', { name: /i understand|acknowledge|accept|continue/i });
  await expect(ackButton.first()).toBeVisible({ timeout: 5_000 });
});

test('hosted onboarding checklist shows deep links to contacts and estate', async ({ page }) => {
  await createTestUser(page);

  // Simulate being past trust_acknowledgement, at create_contact step.
  await stubOnboarding(page, {
    preferredProduct: 'hosted',
    currentStep: 'create_contact',
    completedAt: null,
    subscription: { plan: 'hosted', status: 'active', hasRelay: false, hasHosted: true },
    nextRoute: '/onboarding',
  });

  await page.goto('/onboarding');

  // Add your first contact step.
  await expect(page.getByText(/add your first contact/i)).toBeVisible({ timeout: 8_000 });

  // A link/button to /contacts should be present.
  const contactsLink = page.getByRole('link', { name: /contacts/i });
  await expect(contactsLink.first()).toBeVisible({ timeout: 5_000 });
});

test('hosted onboarding estate step shows link to /estate', async ({ page }) => {
  await createTestUser(page);

  await stubOnboarding(page, {
    preferredProduct: 'hosted',
    currentStep: 'create_estate_item',
    completedAt: null,
    subscription: { plan: 'hosted', status: 'active', hasRelay: false, hasHosted: true },
    nextRoute: '/onboarding',
  });

  await page.goto('/onboarding');

  await expect(page.getByText(/add your first estate item/i)).toBeVisible({ timeout: 8_000 });
  const estateLink = page.getByRole('link', { name: /estate/i });
  await expect(estateLink.first()).toBeVisible({ timeout: 5_000 });
});
