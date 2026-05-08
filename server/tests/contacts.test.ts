import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { eq } from 'drizzle-orm';
import { buildApp } from '../src/index.js';
import { contacts } from '../src/db/schema.js';

async function getCsrf(app: Awaited<ReturnType<typeof buildApp>>, cookies: string): Promise<string> {
  const res = await app.inject({ method: 'GET', url: '/api/csrf', headers: { cookie: cookies } });
  return JSON.parse(res.payload).csrfToken;
}

describe('Contact CRUD', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  let cookies: string;
  let otherCookies: string;

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Contact Test', email: 'contact@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'contact@example.com', password: 'testpass12345' },
    });
    cookies = String(loginRes.headers['set-cookie']);

    // Second user for isolation test
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { displayName: 'Other Contact', email: 'contact-other@example.com', password: 'testpass12345', timezone: 'UTC' },
    });
    const otherLoginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: 'contact-other@example.com', password: 'testpass12345' },
    });
    otherCookies = String(otherLoginRes.headers['set-cookie']);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/contacts returns empty array for new user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/contacts',
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(Array.isArray(body.contacts)).toBe(true);
    expect(body.contacts).toHaveLength(0);
  });

  it('POST /api/contacts creates contact (201)', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Alice Smith',
        email: 'alice@example.com',
        relationship: 'Sister',
        phone: '555-1234',
        preferredChannels: ['email'],
        confirmationWindowHours: 48,
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.contact.id).toBeDefined();
    expect(body.contact.email).toBe('alice@example.com');
    expect(body.contact.fullName).toBe('Alice Smith');
  });

  it('DB stores ciphertext (not plaintext) for email', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Bob Jones',
        email: 'bob@example.com',
      },
    });
    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    const contactId = body.contact.id;

    const rows = await app.db
      .select()
      .from(contacts)
      .where(eq(contacts.id, contactId));

    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row!.emailEncrypted).not.toBe('bob@example.com');
    expect(typeof row!.emailEncrypted).toBe('string');
    expect(row!.emailEncrypted.length).toBeGreaterThan(10);
  });

  it('GET /api/contacts/:id returns decrypted contact', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Carol White',
        email: 'carol@example.com',
        relationship: 'Friend',
      },
    });
    const { contact: created } = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: 'GET',
      url: `/api/contacts/${created.id}`,
      headers: { cookie: cookies },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.contact.id).toBe(created.id);
    expect(body.contact.email).toBe('carol@example.com');
    expect(body.contact.fullName).toBe('Carol White');
  });

  it('PUT /api/contacts/:id updates email only, other fields unchanged', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Dave Brown',
        email: 'dave.old@example.com',
        relationship: 'Colleague',
      },
    });
    const { contact: created } = JSON.parse(createRes.payload);

    const putToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'PUT',
      url: `/api/contacts/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': putToken },
      payload: { email: 'dave.new@example.com' },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.contact.email).toBe('dave.new@example.com');
    // Other fields unchanged
    expect(body.contact.fullName).toBe('Dave Brown');
    expect(body.contact.relationship).toBe('Colleague');
  });

  it('DELETE /api/contacts/:id deletes; subsequent GET returns 404', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Eve Temp',
        email: 'eve.temp@example.com',
      },
    });
    const { contact: created } = JSON.parse(createRes.payload);

    const deleteToken = await getCsrf(app, cookies);
    const delRes = await app.inject({
      method: 'DELETE',
      url: `/api/contacts/${created.id}`,
      headers: { cookie: cookies, 'x-csrf-token': deleteToken },
    });
    expect(delRes.statusCode).toBe(200);
    expect(JSON.parse(delRes.payload).ok).toBe(true);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/contacts/${created.id}`,
      headers: { cookie: cookies },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('user scoping: contact created by user A not visible to user B', async () => {
    const csrfToken = await getCsrf(app, cookies);
    const createRes = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: {
        fullName: 'Frank Secret',
        email: 'frank.secret@example.com',
      },
    });
    const { contact: created } = JSON.parse(createRes.payload);

    // User B tries to access User A's contact
    const res = await app.inject({
      method: 'GET',
      url: `/api/contacts/${created.id}`,
      headers: { cookie: otherCookies },
    });
    expect(res.statusCode).toBe(404);
  });

  it('reorder: create 3 contacts, reorder reversed, GET list reflects new order', async () => {
    const csrfToken1 = await getCsrf(app, otherCookies);
    const r1 = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: otherCookies, 'x-csrf-token': csrfToken1 },
      payload: { fullName: 'First Contact', email: 'first@example.com' },
    });
    const id1 = JSON.parse(r1.payload).contact.id;

    const csrfToken2 = await getCsrf(app, otherCookies);
    const r2 = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: otherCookies, 'x-csrf-token': csrfToken2 },
      payload: { fullName: 'Second Contact', email: 'second@example.com' },
    });
    const id2 = JSON.parse(r2.payload).contact.id;

    const csrfToken3 = await getCsrf(app, otherCookies);
    const r3 = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: otherCookies, 'x-csrf-token': csrfToken3 },
      payload: { fullName: 'Third Contact', email: 'third@example.com' },
    });
    const id3 = JSON.parse(r3.payload).contact.id;

    // Reorder: reversed
    const reorderToken = await getCsrf(app, otherCookies);
    const reorderRes = await app.inject({
      method: 'POST',
      url: '/api/contacts/reorder',
      headers: { cookie: otherCookies, 'x-csrf-token': reorderToken },
      payload: { orderedIds: [id3, id2, id1] },
    });
    expect(reorderRes.statusCode).toBe(200);
    expect(JSON.parse(reorderRes.payload).ok).toBe(true);

    // GET list — should be in new order
    const listRes = await app.inject({
      method: 'GET',
      url: '/api/contacts',
      headers: { cookie: otherCookies },
    });
    const { contacts: list } = JSON.parse(listRes.payload);
    expect(list[0].id).toBe(id3);
    expect(list[1].id).toBe(id2);
    expect(list[2].id).toBe(id1);
  });

  it('reorder rejects foreign/mismatched IDs → 400', async () => {
    const fakeId = '00000000-0000-0000-0000-000000000001';
    const csrfToken = await getCsrf(app, cookies);
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacts/reorder',
      headers: { cookie: cookies, 'x-csrf-token': csrfToken },
      payload: { orderedIds: [fakeId] },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid or foreign contact IDs');
  });

  it('POST /api/contacts requires CSRF token (403 without it)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/contacts',
      headers: { cookie: cookies },
      payload: { fullName: 'No CSRF', email: 'nocsrf@example.com' },
    });
    expect(res.statusCode).toBe(403);
  });
});
