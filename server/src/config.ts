import { config as loadDotenv } from 'dotenv';
import { resolve } from 'path';

loadDotenv({ path: resolve(process.cwd(), '../.env') });

export interface AppConfig {
  port: number;
  host: string;
  databaseUrl: string;
  secretKey: string;
  fieldEncryptionKey: string;
  baseUrl: string;
  adminEmails: string[];
  stripe: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
    relayPriceId: string;
    hostedPriceId: string;
  };
  postmark: {
    apiToken: string;
    fromEmail: string;
  };
  telegram: {
    botToken: string;
  };
  storage: {
    endpoint: string;        // AEGIS_STORAGE_ENDPOINT (empty = AWS)
    region: string;          // AEGIS_STORAGE_REGION, default 'auto'
    bucket: string;          // AEGIS_STORAGE_BUCKET
    accessKeyId: string;     // AEGIS_STORAGE_ACCESS_KEY_ID
    secretAccessKey: string; // AEGIS_STORAGE_SECRET_ACCESS_KEY
    prefix: string;          // AEGIS_STORAGE_PREFIX, default 'packets/'
    forcePathStyle: boolean; // AEGIS_STORAGE_FORCE_PATH_STYLE, default false
  };
  testing: boolean;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const config = {
    port: parseInt(process.env.AEGIS_PORT || '8001', 10),
    host: process.env.AEGIS_HOST || '0.0.0.0',
    databaseUrl: process.env.DATABASE_URL || 'postgresql://aegis:aegis@localhost:5432/aegis_site',
    secretKey: process.env.AEGIS_SECRET_KEY || 'dev-secret-key-change-me',
    fieldEncryptionKey: process.env.AEGIS_FIELD_ENCRYPTION_KEY || 'dev-field-key-change-me-32bytes!!',
    baseUrl: process.env.AEGIS_BASE_URL || 'http://localhost:8001',
    adminEmails: process.env.AEGIS_ADMIN_EMAILS
      ? process.env.AEGIS_ADMIN_EMAILS.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
      : [],
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY || '',
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || '',
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      relayPriceId: process.env.STRIPE_RELAY_PRICE_ID || '',
      hostedPriceId: process.env.STRIPE_HOSTED_PRICE_ID || '',
    },
    postmark: {
      apiToken: process.env.POSTMARK_API_TOKEN || '',
      fromEmail: process.env.POSTMARK_FROM_EMAIL || 'noreply@aegisdms.life',
    },
    telegram: {
      botToken: process.env.AEGIS_TELEGRAM_BOT_TOKEN || '',
    },
    storage: {
      endpoint: process.env.AEGIS_STORAGE_ENDPOINT || '',
      region: process.env.AEGIS_STORAGE_REGION || 'auto',
      bucket: process.env.AEGIS_STORAGE_BUCKET || '',
      accessKeyId: process.env.AEGIS_STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.AEGIS_STORAGE_SECRET_ACCESS_KEY || '',
      prefix: process.env.AEGIS_STORAGE_PREFIX || 'packets/',
      forcePathStyle: process.env.AEGIS_STORAGE_FORCE_PATH_STYLE === 'true',
    },
    testing: false,
    ...overrides,
  };

  return config;
}

/**
 * Validates that all required secrets and config values are set for production.
 * Throws a descriptive error if any required value is missing or still set to a default.
 * Must be called at server startup when NODE_ENV === 'production'.
 */
export function validateProductionConfig(config: AppConfig): void {
  const errors: string[] = [];

  // AEGIS_SECRET_KEY
  if (!config.secretKey || config.secretKey.includes('change-me') || config.secretKey.length < 32) {
    errors.push('AEGIS_SECRET_KEY must be set, must not be the default value, and must be >= 32 characters');
  }

  // AEGIS_FIELD_ENCRYPTION_KEY
  if (!config.fieldEncryptionKey || config.fieldEncryptionKey.includes('change-me') || config.fieldEncryptionKey.length < 32) {
    errors.push('AEGIS_FIELD_ENCRYPTION_KEY must be set, must not be the default value, and must be >= 32 characters');
  }

  // AEGIS_BASE_URL — must not be localhost
  if (!config.baseUrl || /^https?:\/\/localhost/i.test(config.baseUrl)) {
    errors.push('AEGIS_BASE_URL must be set to a non-localhost URL (e.g. https://app.aegisdms.life)');
  }

  // DATABASE_URL — must not be the default localhost URL
  const defaultDbUrl = 'postgresql://aegis:aegis@localhost:5432/aegis_site';
  if (!config.databaseUrl || config.databaseUrl === defaultDbUrl || /localhost/.test(config.databaseUrl)) {
    errors.push('DATABASE_URL must be set to a non-localhost PostgreSQL URL');
  }

  // Stripe
  if (!config.stripe.secretKey) {
    errors.push('STRIPE_SECRET_KEY must be set');
  }
  if (!config.stripe.webhookSecret) {
    errors.push('STRIPE_WEBHOOK_SECRET must be set');
  }

  // Postmark
  if (!config.postmark.apiToken) {
    errors.push('POSTMARK_API_TOKEN must be set');
  }
  if (!config.postmark.fromEmail) {
    errors.push('POSTMARK_FROM_EMAIL must be set');
  }

  if (errors.length > 0) {
    throw new Error(
      `FATAL: Production configuration is invalid. Fix the following before starting:\n` +
      errors.map(e => `  - ${e}`).join('\n')
    );
  }
}
