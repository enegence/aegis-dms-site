CREATE TABLE "notification_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"relay_connection_id" uuid,
	"switch_id" uuid,
	"contact_id" uuid,
	"channel" text NOT NULL,
	"purpose" text NOT NULL,
	"status" text NOT NULL,
	"external_id" text,
	"failure_reason" text,
	"sent_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "relay_connections" ADD COLUMN "last_expected_heartbeat_at" timestamp;--> statement-breakpoint
ALTER TABLE "relay_connections" ADD COLUMN "mode" text DEFAULT 'relay_monitoring' NOT NULL;--> statement-breakpoint
ALTER TABLE "relay_connections" ADD COLUMN "revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "relay_connections" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "last_reminder_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "last_warning_sent_at" timestamp;--> statement-breakpoint
ALTER TABLE "switches" ADD COLUMN "last_evaluated_at" timestamp;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_relay_connection_id_relay_connections_id_fk" FOREIGN KEY ("relay_connection_id") REFERENCES "public"."relay_connections"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_switch_id_switches_id_fk" FOREIGN KEY ("switch_id") REFERENCES "public"."switches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_contact_id_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE set null ON UPDATE no action;