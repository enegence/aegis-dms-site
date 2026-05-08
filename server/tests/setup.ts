import postgres from 'postgres';
import { config } from 'dotenv';
import { resolve } from 'path';

config({ path: resolve(process.cwd(), '../.env') });

export async function setup() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://aegis:aegis@localhost:5432/aegis_site';
  const client = postgres(connectionString, { max: 1 });

  await client`TRUNCATE users, sessions, subscriptions, relay_connections, stripe_webhook_events, estate_items, contacts, switches, packets, contact_claims, release_runs, audit_events, encryption_keys, trust_acknowledgements, notification_events CASCADE`;

  await client.end();
}
