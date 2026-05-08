import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildApp } from '../src/index.js';
import { sql } from 'drizzle-orm';

describe('Schema Phase 2', () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    app = await buildApp({ testing: true });
  });

  afterAll(async () => {
    await app.close();
  });

  it('notification_events table exists and accepts inserts', async () => {
    // With drizzle-orm/postgres-js, db.execute returns an array of rows directly
    const rows = await app.db.execute(
      sql`INSERT INTO notification_events (channel, purpose, status)
          VALUES ('email', 'relay_offline_alert', 'queued')
          RETURNING id`
    );
    expect(rows.length).toBe(1);
    expect((rows[0] as { id: string }).id).toBeDefined();
  });

  it('relay_connections has mode field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'relay_connections' AND column_name = 'mode'`
    );
    expect(rows.length).toBe(1);
  });

  it('relay_connections has last_expected_heartbeat_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'relay_connections' AND column_name = 'last_expected_heartbeat_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('relay_connections has updated_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'relay_connections' AND column_name = 'updated_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('relay_connections has revoked_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'relay_connections' AND column_name = 'revoked_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('switches has last_evaluated_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'switches' AND column_name = 'last_evaluated_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('switches has last_reminder_sent_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'switches' AND column_name = 'last_reminder_sent_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('switches has last_warning_sent_at field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'switches' AND column_name = 'last_warning_sent_at'`
    );
    expect(rows.length).toBe(1);
  });

  it('estate_items has institution_name_encrypted field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'estate_items' AND column_name = 'institution_name_encrypted'`
    );
    expect(rows.length).toBe(1);
  });

  it('contacts has full_name_encrypted field', async () => {
    const rows = await app.db.execute(
      sql`SELECT column_name FROM information_schema.columns
          WHERE table_name = 'contacts' AND column_name = 'full_name_encrypted'`
    );
    expect(rows.length).toBe(1);
  });

  it('release_runs table exists', async () => {
    const rows = await app.db.execute(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'release_runs'`
    );
    expect(rows.length).toBe(1);
  });

  it('trust_acknowledgements table exists', async () => {
    const rows = await app.db.execute(
      sql`SELECT table_name FROM information_schema.tables
          WHERE table_schema = 'public' AND table_name = 'trust_acknowledgements'`
    );
    expect(rows.length).toBe(1);
  });
});
