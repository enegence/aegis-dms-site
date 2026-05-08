ALTER TABLE "notification_events" DROP CONSTRAINT "notification_events_user_id_users_id_fk";
--> statement-breakpoint
ALTER TABLE "notification_events" ADD CONSTRAINT "notification_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "notification_events_user_id_idx" ON "notification_events" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "notification_events_relay_id_idx" ON "notification_events" USING btree ("relay_connection_id");--> statement-breakpoint
CREATE INDEX "notification_events_switch_id_idx" ON "notification_events" USING btree ("switch_id");