import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { eq } from 'drizzle-orm';

// Mock stripe service before importing app
vi.mock('../src/services/stripe.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/services/stripe.js')>();
  return {
    ...actual,
    getStripe: vi.fn().mockReturnValue({}),
    createPortalSession: vi.fn().mockResolvedValue('https://billing.stripe.com/mock-portal'),
  };
});

import { buildApp } from '../src/index.js';
import { users, subscriptions } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Billing Portal Route', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Portal Test User',
        email: 'portal@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'portal@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Get userId from DB
    const [u] = await app.db.select({ id: users.id }).from(users).where(eq(users.email, 'portal@example.com'));
    userId = u!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /api/billing/portal returns mock portal URL when subscription exists', async () => {
    // Insert a subscription row with stripeCustomerId
    await app.db.insert(subscriptions).values({
      userId,
      stripeCustomerId: 'cus_test123',
      plan: 'relay',
      status: 'active',
    });

    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { returnUrl: 'https://example.com/settings' },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.url).toBe('https://billing.stripe.com/mock-portal');
  });

  it('POST /api/billing/portal requires auth (401 without cookie)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      payload: { returnUrl: 'https://example.com/settings' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/billing/portal requires CSRF token (403 without it)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers: { cookie: cookies },
      payload: { returnUrl: 'https://example.com/settings' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('POST /api/billing/portal returns 400 when no subscription exists', async () => {
    // Create a fresh user with no subscription
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'No Sub User',
        email: 'portal-nosub@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'portal-nosub@example.com', password: 'testpass12345' },
    });
    const noSubCookies = String(loginRes.headers['set-cookie']);
    const csrfToken = await getCsrf(app, noSubCookies);

    const res = await app.inject({
      method: 'POST',
      url: '/api/billing/portal',
      headers: { cookie: noSubCookies, 'x-csrf-token': csrfToken },
      payload: { returnUrl: 'https://example.com/settings' },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('No billing account found');
  });
});
