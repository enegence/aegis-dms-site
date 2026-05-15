/**
 * E2E: Estate items and contacts CRUD flows.
 *
 * Tests:
 *   - Authenticated user can view /estate page
 *   - Authenticated user can create an estate item via the API and see it
 *   - Authenticated user can view /contacts page
 *   - Authenticated user can create a contact via the API and see it
 *   - Unauthenticated user is redirected away from /estate
 */
import { test, expect } from '@playwright/test';
import { createTestUser, apiRequest } from './helpers';

test('unauthenticated user redirected from /estate to /login', async ({ page }) => {
  await page.goto('/estate');
  await expect(page).toHaveURL(/\/login/);
});

test('unauthenticated user redirected from /contacts to /login', async ({ page }) => {
  await page.goto('/contacts');
  await expect(page).toHaveURL(/\/login/);
});

test('authenticated user can view /estate page', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/estate');
  await expect(page).toHaveURL(/\/estate/);
  // Page renders without fatal error.
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('authenticated user can view /contacts page', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/contacts');
  await expect(page).toHaveURL(/\/contacts/);
  await expect(page.getByText(/something went wrong/i)).not.toBeVisible();
});

test('create estate item via API and page reflects it', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/estate');

  // Create via API shortcut (avoids form-level UI coupling).
  await apiRequest(page, 'POST', '/api/estate', {
    category: 'bank',
    title: 'E2E Test Bank Account',
    institutionName: 'Test Bank',
    accountType: 'Checking',
    referenceHint: 'Account ending 1234',
    notes: '',
  });

  // Reload to pick up the new item.
  await page.reload();
  await expect(page.getByText('E2E Test Bank Account')).toBeVisible({ timeout: 5_000 });
});

test('create contact via API and page reflects it', async ({ page }) => {
  await createTestUser(page);
  await page.goto('/contacts');

  await apiRequest(page, 'POST', '/api/contacts', {
    fullName: 'E2E Contact Person',
    relationship: 'spouse',
    email: 'e2e-contact@aegistest.invalid',
    phone: '',
    telegramHandle: '',
    priority: 1,
    notes: '',
  });

  await page.reload();
  await expect(page.getByText('E2E Contact Person')).toBeVisible({ timeout: 5_000 });
});
