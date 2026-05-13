-- Option 1B: relay escrow users pre-register contact set and packet bundle in SaaS.
-- When escrow triggers, SaaS creates a relay_escrow release run using these SaaS-side records.

ALTER TABLE "relay_escrow_materials" ADD COLUMN IF NOT EXISTS "escrow_contact_ids" jsonb NOT NULL DEFAULT '[]';
--> statement-breakpoint
ALTER TABLE "relay_escrow_materials" ADD COLUMN IF NOT EXISTS "escrow_packet_id" uuid REFERENCES "packets"("id") ON DELETE SET NULL;
