-- Phase 5 Task 4: Account deletion flow columns on users table.
-- deletion_token_hash: SHA-256 of the one-time deletion confirmation token (never plaintext).
-- deletion_token_expires_at: 15-minute expiry, same pattern as password reset.
-- pending_deletion: true after request-deletion, false after cancellation or completion.
-- deleted_at: set when account is actually deleted (user row anonymized, data purged).

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "deletion_token_hash"     text,
  ADD COLUMN IF NOT EXISTS "deletion_token_expires_at" timestamp,
  ADD COLUMN IF NOT EXISTS "pending_deletion"         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "deleted_at"               timestamp;
