-- Email-trust pipeline (see src/lib/leads/email-trust.ts).
--
-- `email_trust` mirrors the EmailTrust union:
--   "verified" | "guessed" | "unverified" | "invalid" | NULL
-- Stored as plain text (not an enum) so adding categories is a
-- code-only change. The /leads filter rail's "Email trust" facet
-- queries this column directly.
--
-- `email_validated_at` lets the weekly cron skip rows already
-- classified inside its window.
ALTER TABLE "leads" ADD COLUMN "email_trust" text;--> statement-breakpoint
ALTER TABLE "leads" ADD COLUMN "email_validated_at" timestamp with time zone;
