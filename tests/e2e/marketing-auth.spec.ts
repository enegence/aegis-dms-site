/**
 * E2E: Marketing pages and authentication flows.
 *
 * Tests:
 *   - Landing page renders with product name
 *   - Pricing page renders
 *   - Register form creates an account (sees dashboard or onboarding)
 *   - Login / logout round-trip
 *   - Password-reset does not leak account existence
 */
import { test, expect } from '@playwright/test';
import { createTestUser, loginAs, logout, uniqueEmail } from './helpers';

// ── Landing page ──────────────────────────────────────────────────────────────

test('landing page renders with product name', async ({ page }) => {
  await page.goto('/');
  // The nav bar has "Aegis DMS" as brand text.
  await expect(page.getByText('Aegis DMS').first()).toBeVisible();
  // At least one of the product names from the PRODUCTS list is visible.
  await expect(page.getByText('Aegis Core').first()).toBeVisible();
});

test('landing page has a link to pricing and register', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: /pricing/i }).first()).toBeVisible();
  // Both relay and hosted CTAs link to /register
  const registerLinks = page.getByRole('link', { name: /get started|create account/i });
  await expect(registerLinks.first()).toBeVisible();
});

// ── Pricing page ──────────────────────────────────────────────────────────────

test('pricing page renders', async ({ page }) => {
  await page.goto('/pricing');
  // The nav has the brand.
  await expect(page.getByText('Aegis DMS').first()).toBeVisible();
  // Page renders without a fatal JS error — check for no "Something went wrong".
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

// ── Register ──────────────────────────────────────────────────────────────────

test('register form creates account and redirects away from /register', async ({ page }) => {
  const user = await createTestUser(page);
  // After registration the URL should no longer be /register.
  expect(page.url()).not.toContain('/register');
  // The user should see some authenticated content (dashboard or onboarding).
  const url = page.url();
  expect(url.includes('/dashboard') || url.includes('/onboarding')).toBe(true);
});

test('register form shows validation error for short password', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('Your name').fill('Short Pass User');
  await page.getByPlaceholder('Email').fill(uniqueEmail());
  await page.getByPlaceholder('Passphrase (8+ characters)').fill('short');
  await page.getByRole('button', { name: /create account/i }).click();
  // HTML5 minLength or browser validation should prevent submit,
  // or the server returns an error. Either way we stay on /register.
  await page.waitForTimeout(500);
  expect(page.url()).toContain('/register');
});

// ── Login / logout ────────────────────────────────────────────────────────────

test('login and logout round-trip', async ({ page }) => {
  // Register a fresh user via the helper (logs in automatically).
  const user = await createTestUser(page);
  // We should now be on /dashboard or /onboarding (authenticated).
  expect(page.url()).not.toContain('/login');

  // Log out and verify redirect to public page.
  await logout(page);
  // After logout, navigating to /dashboard should redirect to /login.
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login/);
});

test('login with wrong password shows error message', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill('nosuchuser@aegistest.invalid');
  await page.getByPlaceholder('Passphrase').fill('wrongpassword');
  await page.getByRole('button', { name: /log in/i }).click();
  // Should see an error message and remain on /login.
  await expect(page.getByText(/invalid|incorrect|failed|wrong/i).first()).toBeVisible({
    timeout: 5_000,
  });
  expect(page.url()).toContain('/login');
});

// ── Password reset ────────────────────────────────────────────────────────────

test('password reset request shows same message for existing email', async ({ page }) => {
  // Register a real user first.
  const user = await createTestUser(page);
  await logout(page);

  await page.goto('/forgot-password');
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByRole('button', { name: /send reset link/i }).click();
  const successText = await page
    .getByText(/check your email|sent a password reset/i)
    .first()
    .textContent({ timeout: 5_000 });
  expect(successText).toBeTruthy();
});

test('password reset request shows same message for non-existent email', async ({ page }) => {
  await page.goto('/forgot-password');
  await page.getByPlaceholder('Email').fill('doesnotexist@aegistest.invalid');
  await page.getByRole('button', { name: /send reset link/i }).click();
  // Server must return the same success message regardless of whether
  // the account exists (no account-existence leak).
  const successText = await page
    .getByText(/check your email|sent a password reset/i)
    .first()
    .textContent({ timeout: 5_000 });
  expect(successText).toBeTruthy();
});
