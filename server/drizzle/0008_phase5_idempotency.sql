-- Phase 5 Task 2: idempotency_keys table for release-run deduplication.
-- Keys are scoped to prevent cross-domain collisions.
-- userId FK allows per-user cascade on account deletion.
-- expiresAt is optional; expired keys should be cleaned up by a periodic job.

CREATE TABLE IF NOT EXISTS "idempotency_keys" (
  "key"         text PRIMARY KEY NOT NULL,
  "scope"       text NOT NULL,
  "user_id"     uuid REFERENCES "public"."users"("id") ON DELETE cascade,
  "result_json" jsonb,
  "created_at"  timestamp DEFAULT now() NOT NULL,
  "expires_at"  timestamp
);