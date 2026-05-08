import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { users } from '../src/db/schema.js';
import { checkSwitchReadiness } from '../src/services/readiness.js';

describe('Switch Readiness', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let userId: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Readiness Test',
        email: 'readiness@example.com',
        password: 'testpass12345',
        timezone: 'UTC',
      },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'readiness@example.com', password: 'testpass12345' },
    });
    const meRes = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: String(loginRes.headers['set-cookie']) },
    });
    userId = JSON.parse(meRes.payload).id;
  });

  afterAll(async () => {
    await app.close();
  });

  function makeSwitch(overrides: Partial<{
    mode: string;
    triggerAt: Date | null;
    heartbeatIntervalDays: number | null;
    selectedContactIds: unknown;
    selectedEstateItemIds: unknown;
  }> = {}) {
    return {
      mode: 'trip',
      triggerAt: new Date(Date.now() + 7 * 86400000),
      heartbeatIntervalDays: null,
      selectedContactIds: ['00000000-0000-0000-0000-000000000001'],
      selectedEstateItemIds: ['00000000-0000-0000-0000-000000000002'],
      ...overrides,
    };
  }

  it('1. Fails without email verified', async () => {
    // User is not email-verified by default after registration
    const result = await checkSwitchReadiness(app.db, userId, makeSwitch());

    const emailCheck = result.checks.find((c) => c.key === 'email_verified');
    expect(emailCheck).toBeDefined();
    expect(emailCheck!.passed).toBe(false);
    expect(result.ready).toBe(false);
  });

  it('2. Fails without contacts selected', async () => {
    // Email-verify the user first so only contacts check fails
    await app.db.update(users).set({ emailVerified: true }).where(eq(users.id, userId));

    const result = await checkSwitchReadiness(
      app.db,
      userId,
      makeSwitch({ selectedContactIds: [] }),
    );

    const contactCheck = result.checks.find((c) => c.key === 'has_contacts');
    expect(contactCheck).toBeDefined();
    expect(contactCheck!.passed).toBe(false);
    expect(result.ready).toBe(false);
  });

  it('3. Fails without estate items', async () => {
    const result = await checkSwitchReadiness(
      app.db,
      userId,
      makeSwitch({ selectedEstateItemIds: [] }),
    );

    const itemCheck = result.checks.find((c) => c.key === 'has_estate_items');
    expect(itemCheck).toBeDefined();
    expect(itemCheck!.passed).toBe(false);
    expect(result.ready).toBe(false);
  });

  it('4. Fails with past triggerAt (trip mode)', async () => {
    const result = await checkSwitchReadiness(
      app.db,
      userId,
      makeSwitch({ triggerAt: new Date(Date.now() - 1000) }),
    );

    const scheduleCheck = result.checks.find((c) => c.key === 'valid_schedule');
    expect(scheduleCheck).toBeDefined();
    expect(scheduleCheck!.passed).toBe(false);
    expect(result.ready).toBe(false);
  });

  it('5. Passes when all required checks met', async () => {
    // User is already email-verified from test 2
    const result = await checkSwitchReadiness(app.db, userId, makeSwitch());

    expect(result.ready).toBe(true);

    const requiredChecks = result.checks.filter((c) => c.level === 'required');
    for (const check of requiredChecks) {
      expect(check.passed).toBe(true);
    }
  });

  it('6. Trust acknowledgement warning when missing', async () => {
    // No trust_acknowledgement row inserted — should be a warning but not block ready
    const result = await checkSwitchReadiness(app.db, userId, makeSwitch());

    expect(result.ready).toBe(true); // still ready

    const trustCheck = result.checks.find((c) => c.key === 'trust_acknowledgement');
    expect(trustCheck).toBeDefined();
    expect(trustCheck!.level).toBe('warning');
    expect(trustCheck!.passed).toBe(false);
  });
});
