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

  if (!config.testing && process.env.NODE_ENV === 'production') {
    if (config.secretKey.includes('change-me') || config.secretKey.length < 32) {
      throw new Error('FATAL: AEGIS_SECRET_KEY is not set or too short.');
    }
    if (config.fieldEncryptionKey.includes('change-me') || config.fieldEncryptionKey.length < 32) {
      throw new Error('FATAL: AEGIS_FIELD_ENCRYPTION_KEY is not set or too short.');
    }
  }

  return config;
}
