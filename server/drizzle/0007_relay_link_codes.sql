-- Phase 4 Task 3: relay_link_codes table.
-- Stores short-lived one-time codes that allow an OSS instance to securely link
-- to Relay without ever exposing the API key in a URL.
-- codeHash is SHA-256 of the plaintext code; plaintext is never stored.
-- state is echoed from the browser session and validated at exchange time.

CREATE TABLE IF NOT EXISTS "relay_link_codes" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "code_hash" text NOT NULL,
  "callback_url" text NOT NULL,
  "state" text NOT NULL,
  "nonce" text NOT NULL,
  "label" text,
  "expires_at" timestamp NOT NULL,
  "used_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relay_link_codes"
  ADD CONSTRAINT "relay_link_codes_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
