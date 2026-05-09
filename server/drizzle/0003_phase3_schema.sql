-- Phase 3 schema extensions: managed packets, relay escrow, admin roles

-- users: add role field for admin access control
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "role" text NOT NULL DEFAULT 'user';
--> statement-breakpoint

-- packets: make switch_id nullable (relay escrow packets have no local switch)
ALTER TABLE "packets" DROP CONSTRAINT IF EXISTS "packets_switch_id_switches_id_fk";
--> statement-breakpoint
ALTER TABLE "packets" ALTER COLUMN "switch_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "user_id" uuid REFERENCES "public"."users"("id") ON DELETE cascade;
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "relay_connection_id" uuid REFERENCES "public"."relay_connections"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "source_app" text NOT NULL DEFAULT 'aegis_hosted';
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "schema_version" text NOT NULL DEFAULT '1';
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "storage_version_id" text;
--> statement-breakpoint

-- contact_claims: rename claim_token to claim_token_hash (hash-only security fix)
ALTER TABLE "contact_claims" DROP CONSTRAINT IF EXISTS "contact_claims_claim_token_unique";
--> statement-breakpoint
ALTER TABLE "contact_claims" RENAME COLUMN "claim_token" TO "claim_token_hash";
--> statement-breakpoint
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_claim_token_hash_unique" UNIQUE ("claim_token_hash");
--> statement-breakpoint
-- make switch_id nullable for relay escrow claims
ALTER TABLE "contact_claims" DROP CONSTRAINT IF EXISTS "contact_claims_switch_id_switches_id_fk";
--> statement-breakpoint
ALTER TABLE "contact_claims" ALTER COLUMN "switch_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "contact_claims" ADD COLUMN IF NOT EXISTS "release_run_id" uuid;
--> statement-breakpoint

-- release_runs: make triggering_switch_id nullable (relay_escrow has no local switch)
ALTER TABLE "release_runs" DROP CONSTRAINT IF EXISTS "release_runs_triggering_switch_id_switches_id_fk";
--> statement-breakpoint
ALTER TABLE "release_runs" ALTER COLUMN "triggering_switch_id" DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE "release_runs" ADD CONSTRAINT "release_runs_triggering_switch_id_switches_id_fk" FOREIGN KEY ("triggering_switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "release_runs" ADD COLUMN IF NOT EXISTS "relay_connection_id" uuid REFERENCES "public"."relay_connections"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "release_runs" ADD COLUMN IF NOT EXISTS "source" text NOT NULL DEFAULT 'hosted';
--> statement-breakpoint

-- contact_claims: add FK to release_runs now that release_runs is extended
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_release_run_id_release_runs_id_fk" FOREIGN KEY ("release_run_id") REFERENCES "public"."release_runs"("id") ON DELETE set null ON UPDATE no action;
--> statement-breakpoint

-- notification_events: add Phase 3 fields for provider tracking and PII-free recipient ref
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "release_run_id" uuid REFERENCES "public"."release_runs"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "contact_claim_id" uuid REFERENCES "public"."contact_claims"("id") ON DELETE set null;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "provider" text;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "recipient_ref" text;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "provider_message_id" text;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "error_code" text;
--> statement-breakpoint
ALTER TABLE "notification_events" ADD COLUMN IF NOT EXISTS "error_message_redacted" text;
--> statement-breakpoint

-- relay_escrow_materials: new table for encrypted relay escrow material
CREATE TABLE IF NOT EXISTS "relay_escrow_materials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "relay_connection_id" uuid NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "material_type" text NOT NULL,
  "material_encrypted" text NOT NULL,
  "policy_version" text NOT NULL,
  "accepted_acknowledgement_id" uuid NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "revoked_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "relay_escrow_materials" ADD CONSTRAINT "relay_escrow_materials_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "relay_escrow_materials" ADD CONSTRAINT "relay_escrow_materials_relay_connection_id_relay_connections_id_fk" FOREIGN KEY ("relay_connection_id") REFERENCES "public"."relay_connections"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "relay_escrow_materials" ADD CONSTRAINT "relay_escrow_materials_accepted_acknowledgement_id_trust_acknowledgements_id_fk" FOREIGN KEY ("accepted_acknowledgement_id") REFERENCES "public"."trust_acknowledgements"("id") ON DELETE no action ON UPDATE no action;
