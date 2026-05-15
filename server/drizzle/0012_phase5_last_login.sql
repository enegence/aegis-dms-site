-- Phase 5 Task 6: Add last_login_at to users table for admin user detail tracking.
-- Nullable — null means the user has never logged in since this column was added.

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp;
