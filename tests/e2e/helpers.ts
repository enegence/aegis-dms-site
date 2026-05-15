/**
 * Shared E2E test helpers for Aegis DMS Site.
 *
 * These helpers wrap common actions (register, login, CSRF fetch, API
 * requests) so individual spec files stay readable.
 */
import { type Page, type APIRequestContext, expect } from '@playwright/test';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const API_BASE = process.env.API_BASE_URL || 'http://localhost:8001';

// ── Unique email factory ──────────────────────────────────────────────────────

let _counter = 0;
export function uniqueEmail(prefix = 'e2e'): string {
  _counter += 1;
  return `${prefix}+${Date.now()}${_counter}@aegistest.invalid`;
}

// ── CSRF ─────────────────────────────────────────────────────────────────────

/**
 * Fetch the CSRF token via the browser page's fetch context so the cookie
 * session is shared.
 */
export async function getCSRFToken(page: Page): Promise<string> {
  const token = await page.evaluate(async () => {
    const res = await fetch('/api/csrf', { credentials: 'include' });
    const data = (await res.json()) as { csrfToken: string };
    return data.csrfToken;
  });
  return token;
}

// ── API request helper ────────────────────────────────────────────────────────

/**
 * Make an authenticated API call from within the page context (shares
 * the browser cookie session) with automatic CSRF header.
 */
export async function apiRequest<T = unknown>(
  page: Page,
  method: string,
  path: string,
  body?: Record<string, unknown>,
): Promise<T> {
  const csrf = await getCSRFToken(page);
  const result = await page.evaluate(
    async ({ method, path, body, csrf }) => {
      const res = await fetch(path, {
        method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${res.status} ${res.statusText}: ${text}`);
      }
      return res.json() as T;
    },
    { method, path, body, csrf },
  );
  return result as T;
}

// ── Register ─────────────────────────────────────────────────────────────────

export interface TestUser {
  email: string;
  password: string;
  displayName: string;
}

/**
 * Register a new user via the UI (/register form).
 * Returns the credentials used, so subsequent helpers can log in again.
 */
export async function createTestUser(
  page: Page,
  overrides: Partial<TestUser> = {},
): Promise<TestUser> {
  const user: TestUser = {
    email: overrides.email ?? uniqueEmail(),
    password: overrides.password ?? 'TestPass12345!',
    displayName: overrides.displayName ?? 'E2E Test User',
  };

  await page.goto('/register');
  await page.getByPlaceholder('Your name').fill(user.displayName);
  await page.getByPlaceholder('Email').fill(user.email);
  await page.getByPlaceholder('Passphrase (8+ characters)').fill(user.password);
  // Accept terms — required since Task 7 added the terms acceptance checkbox.
  const termsCheckbox = page.getByRole('checkbox');
  if (await termsCheckbox.isVisible()) {
    await termsCheckbox.check();
  }
  await page.getByRole('button', { name: /create account/i }).click();

  // After registration the app redirects to /dashboard (or /onboarding).
  // Wait for navigation away from /register.
  await page.waitForURL((url) => !url.pathname.includes('/register'), {
    timeout: 10_000,
  });

  return user;
}

// ── Login ─────────────────────────────────────────────────────────────────────

/**
 * Log in via the UI (/login form).
 */
export async function loginAs(
  page: Page,
  email: string,
  password: string,
): Promise<void> {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(email);
  await page.getByPlaceholder('Passphrase').fill(password);
  await page.getByRole('button', { name: /log in/i }).click();

  await page.waitForURL((url) => !url.pathname.includes('/login'), {
    timeout: 10_000,
  });
}

// ── Logout ────────────────────────────────────────────────────────────────────

/**
 * Log out via the API (POST /api/auth/logout).
 */
export async function logout(page: Page): Promise<void> {
  await apiRequest(page, 'POST', '/api/auth/logout');
  // Navigate to home so subsequent steps start clean.
  await page.goto('/');
}

// ── Seed subscription (API shortcut) ─────────────────────────────────────────

/**
 * Give a user an active subscription via the admin seed endpoint.
 *
 * This only works when the server has the test-seed route enabled
 * (AEGIS_TEST_SEED=true).  In CI the server should be started with
 * that env var.  If the endpoint is unavailable the function logs a
 * warning but does NOT throw so the test can still run and skip
 * billing-specific assertions.
 */
export async function seedSubscription(
  request: APIRequestContext,
  userId: string,
  plan: 'relay' | 'hosted',
): Promise<void> {
  const res = await request.post(`${API_BASE}/api/test/seed-subscription`, {
    data: { userId, plan },
    headers: { 'X-Test-Secret': process.env.AEGIS_TEST_SECRET || 'test-secret' },
  });
  if (!res.ok()) {
    console.warn(
      `[helpers] seedSubscription unavailable (${res.status()}). ` +
        'Start server with AEGIS_TEST_SEED=true to enable billing tests.',
    );
  }
}
