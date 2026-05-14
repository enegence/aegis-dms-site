import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';
import { subscriptions } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

async function registerAndLogin(
  app: Awaited<ReturnType<typeof buildApp>>,
  email: string,
): Promise<string> {
  await app.inject({
    method: 'POST',
    url: '/api/auth/register',
    payload: {
      displayName: 'Onboarding Test',
      email,
      password: 'testpass12345',
      timezone: 'UTC',
    },
  });
  const loginRes = await app.inject({
    method: 'POST',
    url: '/api/auth/login',
    payload: { email, password: 'testpass12345' },
  });
  return String(loginRes.headers['set-cookie']);
}

describe('Onboarding routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
    cookies = await registerAndLogin(app, 'onboarding@example.com');
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/onboarding ──────────────────────────────────────────────────────

  describe('GET /api/onboarding', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/onboarding' });
      expect(res.statusCode).toBe(401);
    });

    it('returns onboarding state for a new user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: cookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body).toHaveProperty('preferredProduct');
      expect(body).toHaveProperty('currentStep');
      expect(body).toHaveProperty('completedAt');
      expect(body).toHaveProperty('subscription');
      expect(body).toHaveProperty('nextRoute');
      // New user has no subscription — should get billing CTA
      expect(body.subscription.plan).toBeNull();
      expect(body.nextRoute).toBe('/app/billing');
      // completedAt starts null
      expect(body.completedAt).toBeNull();
    });

    it('defaults preferredProduct to undecided for new user', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: cookies },
      });
      const body = JSON.parse(res.payload);
      expect(body.preferredProduct).toBe('undecided');
    });
  });

  // ── PUT /api/onboarding/preferred-product ────────────────────────────────────

  describe('PUT /api/onboarding/preferred-product', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/onboarding/preferred-product',
        payload: { preferredProduct: 'hosted' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for missing CSRF token', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/onboarding/preferred-product',
        headers: { cookie: cookies },
        payload: { preferredProduct: 'hosted' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('sets preferredProduct to relay', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/onboarding/preferred-product',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { preferredProduct: 'relay' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.preferredProduct).toBe('relay');
    });

    it('sets preferredProduct to hosted', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/onboarding/preferred-product',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { preferredProduct: 'hosted' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.preferredProduct).toBe('hosted');
    });

    it('rejects invalid preferredProduct value', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'PUT',
        url: '/api/onboarding/preferred-product',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { preferredProduct: 'invalid-value' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/onboarding/complete-step ──────────────────────────────────────

  describe('POST /api/onboarding/complete-step', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete-step',
        payload: { step: 'explain_trust_model' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for missing CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete-step',
        headers: { cookie: cookies },
        payload: { step: 'explain_trust_model' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('records a completed step and updates currentStep', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete-step',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { step: 'explain_trust_model' },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.currentStep).toBe('explain_trust_model');
    });

    it('rejects empty step', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete-step',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: { step: '' },
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // ── POST /api/onboarding/complete ────────────────────────────────────────────

  describe('POST /api/onboarding/complete', () => {
    it('returns 401 for unauthenticated requests', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete',
        payload: {},
      });
      expect(res.statusCode).toBe(401);
    });

    it('returns 403 for missing CSRF token', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete',
        headers: { cookie: cookies },
        payload: {},
      });
      expect(res.statusCode).toBe(403);
    });

    it('marks onboarding as complete and sets completedAt', async () => {
      const csrf = await getCsrf(app, cookies);
      const res = await app.inject({
        method: 'POST',
        url: '/api/onboarding/complete',
        headers: { cookie: cookies, 'x-csrf-token': csrf },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.completedAt).not.toBeNull();
      // Verify it's a valid ISO timestamp
      expect(new Date(body.completedAt).getTime()).toBeGreaterThan(0);
    });
  });

  // ── Plan-aware routing (subscription-based nextRoute) ────────────────────────

  describe('Plan-aware route resolution', () => {
    it('inactive subscription gets billing CTA (nextRoute = /app/billing)', async () => {
      // Fresh user with no subscription
      const freshCookies = await registerAndLogin(app, 'onboarding-nosub@example.com');
      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: freshCookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nextRoute).toBe('/app/billing');
    });

    it('relay subscription gets relay next step (nextRoute = /relay)', async () => {
      // Simulate a relay subscription in the DB by injecting a test sub row
      const relayCookies = await registerAndLogin(app, 'onboarding-relay@example.com');

      // Get userId from /api/auth/me
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: relayCookies },
      });
      const { id: userId } = JSON.parse(meRes.payload);

      // Insert relay subscription directly into DB via drizzle
      await app.db.insert(subscriptions).values({
        userId,
        stripeCustomerId: 'cus_test_relay',
        plan: 'relay',
        status: 'active',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: relayCookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.subscription.plan).toBe('relay');
      expect(body.nextRoute).toBe('/relay');
    });

    it('hosted subscription gets hosted next step (nextRoute = /dashboard)', async () => {
      const hostedCookies = await registerAndLogin(app, 'onboarding-hosted@example.com');

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: hostedCookies },
      });
      const { id: userId } = JSON.parse(meRes.payload);

      await app.db.insert(subscriptions).values({
        userId,
        stripeCustomerId: 'cus_test_hosted',
        plan: 'hosted',
        status: 'active',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: hostedCookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.subscription.plan).toBe('hosted');
      expect(body.nextRoute).toBe('/dashboard');
    });

    it('both relay and hosted subscriptions active → nextRoute = /dashboard', async () => {
      const bothCookies = await registerAndLogin(app, 'onboarding-both@example.com');

      const meRes = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: bothCookies },
      });
      const { id: userId } = JSON.parse(meRes.payload);

      await app.db.insert(subscriptions).values({
        userId,
        stripeCustomerId: 'cus_test_both_relay',
        plan: 'relay',
        status: 'active',
      });
      await app.db.insert(subscriptions).values({
        userId,
        stripeCustomerId: 'cus_test_both_hosted',
        plan: 'hosted',
        status: 'active',
      });

      const res = await app.inject({
        method: 'GET',
        url: '/api/onboarding',
        headers: { cookie: bothCookies },
      });
      expect(res.statusCode).toBe(200);
      const body = JSON.parse(res.payload);
      expect(body.nextRoute).toBe('/dashboard');
    });
  });
});
