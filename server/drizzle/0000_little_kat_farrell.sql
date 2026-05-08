CREATE TABLE "audit_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" uuid,
	"switch_id" uuid,
	"event_type" text NOT NULL,
	"actor_type" text NOT NULL,
	"actor_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contact_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"switch_id" uuid NOT NULL,
	"packet_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"claim_token" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"notified_at" timestamp,
	"opened_at" timestamp,
	"verified_at" timestamp,
	"accepted_at" timestamp,
	"packet_downloaded_at" timestamp,
	"key_viewed_at" timestamp,
	"acknowledged_at" timestamp,
	"expires_at" timestamp NOT NULL,
	"escalated_at" timestamp,
	"failed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contact_claims_claim_token_unique" UNIQUE("claim_token")
);
--> statement-breakpoint
CREATE TABLE "contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"full_name_encrypted" text NOT NULL,
	"relationship_encrypted" text,
	"priority_order" integer NOT NULL,
	"email_encrypted" text NOT NULL,
	"phone_encrypted" text,
	"telegram_handle_encrypted" text,
	"preferred_channels" jsonb DEFAULT '["email"]'::jsonb NOT NULL,
	"confirmation_window_hours" integer DEFAULT 48 NOT NULL,
	"claim_pin_hash" text,
	"backup_notes_encrypted" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "encryption_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"purpose" text NOT NULL,
	"key_material_encrypted" text NOT NULL,
	"algorithm" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"rotated_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "estate_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"institution_name_encrypted" text,
	"account_type_encrypted" text,
	"reference_hint_encrypted" text,
	"asset_description_encrypted" text,
	"location_notes_encrypted" text,
	"executor_notes_encrypted" text,
	"sensitive_flag" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "packets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"switch_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"encryption_algorithm" text DEFAULT 'aes-256-gcm' NOT NULL,
	"key_id" text NOT NULL,
	"content_hash" text NOT NULL,
	"encrypted_object_hash" text,
	"storage_provider" text,
	"storage_bucket" text,
	"storage_object_key" text,
	"storage_region" text,
	"deletion_status" text,
	"last_verified_at" timestamp,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relay_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"api_key_hash" text NOT NULL,
	"label" text,
	"last_heartbeat_at" timestamp,
	"last_heartbeat_data" jsonb,
	"offline_alert_sent_at" timestamp,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "release_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"triggering_switch_id" uuid NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"active_packet_id" uuid,
	"current_contact_claim_id" uuid,
	"suppressed_switch_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"stripe_customer_id" text NOT NULL,
	"stripe_subscription_id" text,
	"plan" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp,
	"cancelled_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "switches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"trigger_at" timestamp,
	"heartbeat_interval_days" integer,
	"next_check_in_due_at" timestamp,
	"warning_starts_at" timestamp,
	"grace_period_hours" integer DEFAULT 72 NOT NULL,
	"warning_window_days" integer DEFAULT 3 NOT NULL,
	"last_check_in_at" timestamp,
	"last_packet_sync_at" timestamp,
	"selected_contact_ids" jsonb DEFAULT '[]'::jsonb,
	"selected_estate_item_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trust_acknowledgements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"mode" text NOT NULL,
	"version" text NOT NULL,
	"accepted_at" timestamp DEFAULT now() NOT NULL,
	"ip_hash" text,
	"user_agent_hash" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"display_name" text NOT NULL,
	"password_hash" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"email_verify_token" text,
	"email_verify_token_expires_at" timestamp,
	"password_reset_token_hash" text,
	"password_reset_expires_at" timestamp,
	"totp_secret_encrypted" text,
	"totp_enabled" boolean DEFAULT false NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"phone" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_packet_id_packets_id_fk" FOREIGN KEY ("packet_id") REFERENCES "public"."packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contact_claims" ADD CONSTRAINT "contact_claims_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contacts" ADD CONSTRAINT "contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "encryption_keys" ADD CONSTRAINT "encryption_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "estate_items" ADD CONSTRAINT "estate_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "packets" ADD CONSTRAINT "packets_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relay_connections" ADD CONSTRAINT "relay_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_runs" ADD CONSTRAINT "release_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_runs" ADD CONSTRAINT "release_runs_triggering_switch_id_switches_id_fk" FOREIGN KEY ("triggering_switch_id") REFERENCES "public"."switches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_runs" ADD CONSTRAINT "release_runs_active_packet_id_packets_id_fk" FOREIGN KEY ("active_packet_id") REFERENCES "public"."packets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "release_runs" ADD CONSTRAINT "release_runs_current_contact_claim_id_contact_claims_id_fk" FOREIGN KEY ("current_contact_claim_id") REFERENCES "public"."contact_claims"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "switches" ADD CONSTRAINT "switches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trust_acknowledgements" ADD CONSTRAINT "trust_acknowledgements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;