/**
 * E2E: Legal/trust pages and registration acceptance.
 *
 * Tests:
 *   - All legal pages render without JS errors
 *   - Register form requires terms checkbox before submit
 *   - Register form links to /terms and /privacy from the checkbox label
 *   - Pricing page links to legal pages
 */
import { test, expect } from '@playwright/test';
import { uniqueEmail } from './helpers';

const LEGAL_PAGES = [
  { path: '/terms', heading: /terms of service/i },
  { path: '/privacy', heading: /privacy policy/i },
  { path: '/security', heading: /security/i },
  { path: '/acceptable-use', heading: /acceptable use/i },
  { path: '/disclaimers', heading: /disclaimers/i },
  { path: '/data-deletion', heading: /data deletion/i },
];

for (const { path, heading } of LEGAL_PAGES) {
  test(`${path} renders heading and no fatal JS error`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByText('Aegis DMS').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible();
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
  });
}

test('legal pages have beta/draft notice', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByText(/beta notice/i).first()).toBeVisible();
});

test('legal pages cross-link to each other', async ({ page }) => {
  await page.goto('/terms');
  await expect(page.getByRole('link', { name: /privacy policy/i }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /disclaimers/i }).first()).toBeVisible();
});

test('register form shows terms checkbox', async ({ page }) => {
  await page.goto('/register');
  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).toBeVisible();
  await expect(checkbox).not.toBeChecked();
});

test('register button is disabled until terms accepted', async ({ page }) => {
  await page.goto('/register');
  await page.getByPlaceholder('Your name').fill('Terms Test');
  await page.getByPlaceholder('Email').fill(uniqueEmail('terms'));
  await page.getByPlaceholder('Passphrase (8+ characters)').fill('TestPass12345!');
  // Button should be disabled before checking the box.
  const submitBtn = page.getByRole('button', { name: /create account/i });
  await expect(submitBtn).toBeDisabled();
  // After checking, it becomes enabled.
  await page.getByRole('checkbox').check();
  await expect(submitBtn).toBeEnabled();
});

test('register form terms label links to /terms and /privacy', async ({ page }) => {
  await page.goto('/register');
  // The checkbox label should contain links to /terms and /privacy.
  await expect(page.getByRole('link', { name: /terms of service/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /privacy policy/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /disclaimers/i })).toBeVisible();
});

test('pricing page footer links to legal pages', async ({ page }) => {
  await page.goto('/pricing');
  const footer = page.locator('div').filter({ hasText: /terms.*privacy.*disclaimers/i }).last();
  await expect(footer.getByRole('link', { name: /terms/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /privacy/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /disclaimers/i })).toBeVisible();
});

test('landing page footer links to legal pages', async ({ page }) => {
  await page.goto('/');
  const footer = page.locator('footer');
  await expect(footer.getByRole('link', { name: /terms/i })).toBeVisible();
  await expect(footer.getByRole('link', { name: /privacy/i })).toBeVisible();
});
