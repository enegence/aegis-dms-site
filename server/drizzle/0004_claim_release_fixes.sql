-- Phase 3 review fixes: packet release linkage and encrypted hosted key material

ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "release_run_id" uuid;
--> statement-breakpoint
ALTER TABLE "packets" ADD COLUMN IF NOT EXISTS "packet_key_encrypted" text;
--> statement-breakpoint
ALTER TABLE "packets" DROP CONSTRAINT IF EXISTS "packets_release_run_id_release_runs_id_fk";
