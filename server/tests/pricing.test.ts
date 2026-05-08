import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('GET /api/pricing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns pricing plans without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/pricing' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.plans).toBeDefined();
    expect(body.plans.length).toBe(2);
    expect(body.plans[0].id).toBe('relay');
    expect(body.plans[1].id).toBe('hosted');
    // price may be null if Stripe/env not configured
    expect(body.plans[0].price === null || body.plans[0].price > 0).toBe(true);
    expect(body.plans[0].interval).toBe('month');
    expect(body.plans[0].features).toBeDefined();
    expect(Array.isArray(body.plans[0].features)).toBe(true);
  });
});
