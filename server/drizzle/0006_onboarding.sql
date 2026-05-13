-- Phase 4: onboarding state table
-- Tracks per-user onboarding progress and preferred product path.
-- metadata must NOT contain plaintext PII.

CREATE TABLE IF NOT EXISTS "user_onboarding" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "preferred_product" text NOT NULL DEFAULT 'undecided',
  "current_step" text NOT NULL DEFAULT 'start',
  "completed_at" timestamp,
  "metadata" jsonb,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_onboarding"
  ADD CONSTRAINT "user_onboarding_user_id_users_id_fk"
  FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
