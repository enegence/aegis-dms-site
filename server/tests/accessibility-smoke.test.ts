/**
 * Accessibility Smoke Tests — Aegis DMS Site (SaaS)
 *
 * These tests verify API response shapes that impact assistive technology and
 * screen reader compatibility. All error responses must return structured JSON
 * with an 'error' field so client-side code can reliably announce errors to
 * assistive tech. Validation errors include a 'details' object with
 * 'fieldErrors' keyed by field name so form inputs can associate error messages
 * with the correct labeled control.
 *
 * Coverage:
 *   - Auth 401 responses include a structured 'error' field
 *   - CSRF 403 responses include a structured 'error' field
 *   - Registration validation errors include a 'details.fieldErrors' map
 *   - Login wrong password returns structured 'error'
 *   - Register duplicate email returns structured 'error'
 *   - Password reset unknown email returns 200 (no user enumeration)
 *   - Claim endpoint returns structured errors for invalid tokens
 *   - Health endpoint returns JSON with 'status' field
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';

describe('Accessibility — structured API error responses', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  // Registered test user for auth tests
  const testEmail = 'a11y-smoke@example.com';
  const testPassword = 'accessibility-test-pass-123';

  beforeAll(async () => {
    app = await buildApp({ testing: true });

    // Register a user so login tests can run
    await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'A11y Test User',
        email: testEmail,
        password: testPassword,
        timezone: 'UTC',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── Health endpoint ────────────────────────────────────────────────────────

  it('GET /health returns JSON with a status field', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('status');
    expect(body.status).toBe('ok');
  });

  // ── Auth 401 responses ─────────────────────────────────────────────────────

  it('POST /api/auth/login with wrong password returns 401 with structured error field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testEmail, password: 'wrong-password-xyz' },
    });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  it('GET /api/auth/me without session returns 401 with structured error field', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/auth/me' });
    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  // ── CSRF 403 responses ─────────────────────────────────────────────────────

  it('State-changing request without CSRF token returns 403 with structured error field', async () => {
    // Login to get a valid session
    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: testEmail, password: testPassword },
    });
    const cookies = String(loginRes.headers['set-cookie']);

    // Attempt state-changing request without CSRF header
    const res = await app.inject({
      method: 'POST',
      url: '/api/estate-items',
      headers: { cookie: cookies },
      payload: { category: 'Financial', title: 'CSRF A11y Test' },
    });
    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  // ── Registration validation errors ────────────────────────────────────────

  it('POST /api/auth/register with invalid payload returns 400 with error and details.fieldErrors', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: '',       // min 1 — fails
        email: 'not-an-email', // invalid email — fails
        password: 'short',     // min 8 — fails
        timezone: 'UTC',
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    // Must have a top-level error string for screen readers to announce
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    // Must include field-level detail so inputs can associate messages with labels
    expect(body).toHaveProperty('details');
    expect(body.details).toHaveProperty('fieldErrors');
    // At least one field should have an error message array
    const fieldErrors = body.details.fieldErrors as Record<string, string[]>;
    const errorFields = Object.keys(fieldErrors);
    expect(errorFields.length).toBeGreaterThan(0);
    // Each field's errors should be strings (readable by assistive tech)
    for (const field of errorFields) {
      expect(Array.isArray(fieldErrors[field])).toBe(true);
      for (const msg of fieldErrors[field]!) {
        expect(typeof msg).toBe('string');
      }
    }
  });

  it('POST /api/auth/register with duplicate email returns 409 with structured error field', async () => {
    // testEmail was registered in beforeAll — registering again should be 409
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        displayName: 'Duplicate User',
        email: testEmail,
        password: 'another-valid-pass-123',
        timezone: 'UTC',
      },
    });
    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);
  });

  // ── Password reset — no user enumeration ──────────────────────────────────

  it('POST /api/auth/request-reset with unknown email returns 200 (no enumeration)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/request-reset',
      payload: { email: 'does-not-exist-a11y@example.com' },
    });
    // Must return 200 for both valid and invalid emails — no enumeration
    expect(res.statusCode).toBe(200);
  });

  // ── Claim endpoint structured errors ──────────────────────────────────────

  it('GET /api/claim/:token with invalid token returns structured error', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/claim/totally-invalid-claim-token-that-does-not-exist',
    });
    // Claim routes return 404 for unknown tokens
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const body = JSON.parse(res.payload);
    // Must be structured JSON with an error field, not a raw stack trace or HTML
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('POST /api/claim/:token/open with invalid token returns structured error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/claim/invalid-token-open/open',
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});
