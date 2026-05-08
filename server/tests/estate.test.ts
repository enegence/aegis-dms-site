import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { estateItems } from '../src/db/schema.js';
import { auditEvents } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Estate Item CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Estate Test', email: 'estate@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'estate@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Second user for isolation test
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Other Estate', email: 'estate-other@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'estate-other@example.com', password: 'testpass12345' },
    });
    otherCookies = String(otherLoginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/estate-items returns empty array for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/estate-items',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(0);
  });

  it('POST /api/estate-items creates item with all optional fields (201)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        category: 'financial',
        title: 'Chase Checking',
        institutionName: 'Chase Bank',
        accountType: 'Checking',
        referenceHint: 'Account ending 1234',
        assetDescription: 'Primary checking account',
        locationNotes: 'Online only',
        executorNotes: 'Contact branch manager John',
        sensitiveFlag: true,
        sortOrder: 1,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.item.id).toBeDefined();
    expect(body.item.category).toBe('financial');
    expect(body.item.title).toBe('Chase Checking');
    expect(body.item.institutionName).toBe('Chase Bank');
    expect(body.item.accountType).toBe('Checking');
    expect(body.item.referenceHint).toBe('Account ending 1234');
    expect(body.item.assetDescription).toBe('Primary checking account');
    expect(body.item.locationNotes).toBe('Online only');
    expect(body.item.executorNotes).toBe('Contact branch manager John');
    expect(body.item.sensitiveFlag).toBe(true);
    expect(body.item.sortOrder).toBe(1);
  });

  it('DB stores encrypted values (not plaintext) for sensitive fields', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        category: 'property',
        title: 'My House',
        institutionName: 'Wells Fargo Mortgage',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const itemId = body.item.id;

    // Query DB directly
    const rows = await app.db
      .select()
      .from(estateItems)
      .where(eq(estateItems.id, itemId));

    expect(rows).toHaveLength(1);
    const row = rows[0];
    // Stored value must NOT be the plaintext
    expect(row.institutionNameEncrypted).not.toBe('Wells Fargo Mortgage');
    // Must be a non-null string (the ciphertext)
    expect(typeof row.institutionNameEncrypted).toBe('string');
    expect(row.institutionNameEncrypted!.length).toBeGreaterThan(10);
  });

  it('GET /api/estate-items/:id returns item with decrypted values', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'insurance', title: 'Life Insurance', institutionName: 'MetLife' },
    });
    const { item: created } = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/estate-items/${created.id}`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.item.id).toBe(created.id);
    expect(body.item.title).toBe('Life Insurance');
    expect(body.item.institutionName).toBe('MetLife');
  });

  it('PUT /api/estate-items/:id updates item (partial update)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'legal', title: 'Original Title', institutionName: 'Law Office' },
    });
    const { item: created } = JSON.parse(createRes.payload);

    const putToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/estate-items/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': putToken },
      payload: { title: 'Updated Title' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.item.title).toBe('Updated Title');
    // institutionName should still be present (untouched)
    expect(body.item.institutionName).toBe('Law Office');
    expect(body.item.category).toBe('legal');
  });

  it('DELETE /api/estate-items/:id deletes item; subsequent GET returns 404', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'other', title: 'To Be Deleted' },
    });
    const { item: created } = JSON.parse(createRes.payload);

    const deleteToken = await getCsrf(app, cookies);
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/estate-items/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': deleteToken },
    });
    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).ok).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/estate-items/${created.id}`,
      headers: { cookie: cookies },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('user scoping: item created by user A is not visible to user B', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { category: 'financial', title: 'User A Secret Account' },
    });
    const { item: created } = JSON.parse(createRes.payload);

    // User B tries to access
    const res = await app.inject({
      method: 'GET',
      url: `/api/estate-items/${created.id}`,
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  it('audit event for estate_item_created contains no PII', async () => {
    const csrfToken = await getCsrf(app, cookies);
    await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        category: 'financial',
        title: 'Audit Test Item',
        institutionName: 'SuperSecretBank',
        executorNotes: 'Call John at 555-1234',
      },
    });

    // Query audit log for estate_item_created events
    const events = await app.db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.eventType, 'estate_item_created'));

    expect(events.length).toBeGreaterThan(0);
    const latest = events[events.length - 1];
    const metaStr = JSON.stringify(latest.metadata);

    // Should NOT contain plaintext PII
    expect(metaStr).not.toContain('SuperSecretBank');
    expect(metaStr).not.toContain('Call John at 555-1234');
    // Should contain non-PII info
    expect(metaStr).toContain('itemId');
    expect(metaStr).toContain('category');
  });

  it('GET /api/estate-items requires auth (401 without session)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/estate-items',
    });
    expect(res.statusCode).toBe(401);
  });

  it('POST /api/estate-items requires CSRF token (403 without it)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies },
      payload: { category: 'financial', title: 'No CSRF Item' },
    });
    expect(res.statusCode).toBe(403);
  });
});
