/**
 * Deployment readiness tests (Phase 5 Task 11).
 *
 * Validates the production config validation logic in src/config.ts.
 * These are pure unit tests — no DB, no server startup.
 */

import { describe, it, expect } from 'vitest';
import { loadConfig, validateProductionConfig, type AppConfig } from '../src/config.js';

// ── Helper to build a valid production config ────────────────────────────────

function validProductionConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return loadConfig({
    secretKey: 'production-secret-key-that-is-definitely-long-enough',
    fieldEncryptionKey: 'production-field-encryption-key-is-32-chars!!',
    baseUrl: 'https://app.aegisdms.life',
    databaseUrl: 'postgresql://aegis:pass@db.railway.internal:5432/aegis_prod',
    stripe: {
      secretKey: 'sk_live_test',
      publishableKey: 'pk_live_test',
      webhookSecret: 'whsec_test',
      relayPriceId: 'price_relay',
      hostedPriceId: 'price_hosted',
    },
    postmark: {
      apiToken: 'test-postmark-token',
      fromEmail: 'noreply@aegisdms.life',
    },
    telegram: { botToken: '' },
    ...overrides,
  });
}

// ── SESSION_SECRET (mapped to secretKey) ─────────────────────────────────────

describe('validateProductionConfig — secretKey', () => {
  it('accepts a valid secret key >= 32 chars', () => {
    const config = validProductionConfig();
    expect(() => validateProductionConfig(config)).not.toThrow();
  });

  it('rejects a secret key that is too short (< 32 chars)', () => {
    const config = validProductionConfig({ secretKey: 'short' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_SECRET_KEY/);
  });

  it('rejects a secret key containing "change-me"', () => {
    const config = validProductionConfig({ secretKey: 'dev-secret-key-change-me-long-enough!!' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_SECRET_KEY/);
  });

  it('rejects an empty secret key', () => {
    const config = validProductionConfig({ secretKey: '' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_SECRET_KEY/);
  });
});

// ── FIELD_ENCRYPTION_KEY ──────────────────────────────────────────────────────

describe('validateProductionConfig — fieldEncryptionKey', () => {
  it('rejects field encryption key containing "change-me"', () => {
    const config = validProductionConfig({
      fieldEncryptionKey: 'dev-field-key-change-me-32bytes!!',
    });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_FIELD_ENCRYPTION_KEY/);
  });

  it('rejects field encryption key shorter than 32 chars', () => {
    const config = validProductionConfig({ fieldEncryptionKey: 'tooshort' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_FIELD_ENCRYPTION_KEY/);
  });

  it('accepts a valid 32+ char key without "change-me"', () => {
    const config = validProductionConfig({
      fieldEncryptionKey: 'aaaabbbbccccddddeeeeffffgggghhhh',
    });
    expect(() => validateProductionConfig(config)).not.toThrow();
  });
});

// ── BASE_URL ─────────────────────────────────────────────────────────────────

describe('validateProductionConfig — baseUrl', () => {
  it('rejects localhost base URL', () => {
    const config = validProductionConfig({ baseUrl: 'http://localhost:8001' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_BASE_URL/);
  });

  it('rejects https://localhost base URL', () => {
    const config = validProductionConfig({ baseUrl: 'https://localhost' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_BASE_URL/);
  });

  it('rejects an empty base URL', () => {
    const config = validProductionConfig({ baseUrl: '' });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_BASE_URL/);
  });

  it('accepts a production HTTPS URL', () => {
    const config = validProductionConfig({ baseUrl: 'https://app.aegisdms.life' });
    expect(() => validateProductionConfig(config)).not.toThrow();
  });
});

// ── DATABASE_URL ──────────────────────────────────────────────────────────────

describe('validateProductionConfig — databaseUrl', () => {
  it('rejects default localhost database URL', () => {
    const config = validProductionConfig({
      databaseUrl: 'postgresql://aegis:aegis@localhost:5432/aegis_site',
    });
    expect(() => validateProductionConfig(config)).toThrow(/DATABASE_URL/);
  });

  it('rejects any localhost database URL', () => {
    const config = validProductionConfig({
      databaseUrl: 'postgresql://user:pass@localhost:5432/mydb',
    });
    expect(() => validateProductionConfig(config)).toThrow(/DATABASE_URL/);
  });

  it('accepts a non-localhost database URL', () => {
    const config = validProductionConfig({
      databaseUrl: 'postgresql://aegis:pass@db.railway.internal:5432/aegis_prod',
    });
    expect(() => validateProductionConfig(config)).not.toThrow();
  });
});

// ── Stripe ────────────────────────────────────────────────────────────────────

describe('validateProductionConfig — stripe', () => {
  it('rejects missing stripe secret key', () => {
    const config = validProductionConfig({
      stripe: {
        secretKey: '',
        publishableKey: 'pk_live_test',
        webhookSecret: 'whsec_test',
        relayPriceId: 'price_relay',
        hostedPriceId: 'price_hosted',
      },
    });
    expect(() => validateProductionConfig(config)).toThrow(/STRIPE_SECRET_KEY/);
  });

  it('rejects missing stripe webhook secret', () => {
    const config = validProductionConfig({
      stripe: {
        secretKey: 'sk_live_test',
        publishableKey: 'pk_live_test',
        webhookSecret: '',
        relayPriceId: 'price_relay',
        hostedPriceId: 'price_hosted',
      },
    });
    expect(() => validateProductionConfig(config)).toThrow(/STRIPE_WEBHOOK_SECRET/);
  });
});

// ── Postmark ──────────────────────────────────────────────────────────────────

describe('validateProductionConfig — postmark', () => {
  it('rejects missing postmark API token', () => {
    const config = validProductionConfig({
      postmark: { apiToken: '', fromEmail: 'noreply@aegisdms.life' },
    });
    expect(() => validateProductionConfig(config)).toThrow(/POSTMARK_API_TOKEN/);
  });

  it('rejects missing postmark from email', () => {
    const config = validProductionConfig({
      postmark: { apiToken: 'some-token', fromEmail: '' },
    });
    expect(() => validateProductionConfig(config)).toThrow(/POSTMARK_FROM_EMAIL/);
  });
});

// ── Multiple errors ───────────────────────────────────────────────────────────

describe('validateProductionConfig — multiple errors', () => {
  it('collects all errors and throws once', () => {
    const config = validProductionConfig({
      secretKey: 'short',
      postmark: { apiToken: '', fromEmail: '' },
    });
    let err: Error | null = null;
    try {
      validateProductionConfig(config);
    } catch (e) {
      err = e as Error;
    }
    expect(err).not.toBeNull();
    expect(err!.message).toContain('AEGIS_SECRET_KEY');
    expect(err!.message).toContain('POSTMARK_API_TOKEN');
  });
});

// ── secretKey length boundary ─────────────────────────────────────────────────

describe('validateProductionConfig — secretKey length boundary', () => {
  it('accepts exactly 32 character key', () => {
    const exactly32 = 'a'.repeat(32);
    const config = validProductionConfig({ secretKey: exactly32 });
    expect(() => validateProductionConfig(config)).not.toThrow();
  });

  it('rejects 31 character key', () => {
    const tooShort = 'a'.repeat(31);
    const config = validProductionConfig({ secretKey: tooShort });
    expect(() => validateProductionConfig(config)).toThrow(/AEGIS_SECRET_KEY/);
  });
});
