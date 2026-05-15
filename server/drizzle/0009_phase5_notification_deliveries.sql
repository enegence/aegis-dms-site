-- Phase 5 Task 3: notification_deliveries table for delivery tracking, retry, and backoff.
-- Status values: queued | sending | sent | delivered | failed_retryable | failed_permanent | cancelled
-- payloadHash allows detecting content changes without storing the payload itself.

CREATE TABLE IF NOT EXISTS "notification_deliveries" (
  "id"                          uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "release_run_id"              uuid REFERENCES "public"."release_runs"("id") ON DELETE cascade,
  "claim_id"                    uuid,
  "contact_id"                  uuid NOT NULL,
  "channel"                     text NOT NULL,
  "provider"                    text NOT NULL,
  "status"                      text NOT NULL DEFAULT 'queued',
  "attempt_count"               integer NOT NULL DEFAULT 0,
  "last_attempt_at"             timestamp,
  "next_attempt_at"             timestamp,
  "provider_message_id"         text,
  "last_error_code"             text,
  "last_error_message_redacted" text,
  "payload_hash"                text,
  "created_at"                  timestamp DEFAULT now() NOT NULL,
  "updated_at"                  timestamp DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "notification_deliveries_release_run_id_idx"
  ON "notification_deliveries"("release_run_id");

CREATE INDEX IF NOT EXISTS "notification_deliveries_status_next_attempt_idx"
  ON "notification_deliveries"("status", "next_attempt_at");

CREATE INDEX IF NOT EXISTS "notification_deliveries_provider_message_id_idx"
  ON "notification_deliveries"("provider_message_id");
