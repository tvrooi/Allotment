-- Separate Ready to Assign pools (owner-requested, 7 November 2026; docs/ENVELOPE-FUNDING.md):
-- an account with assign_pool = 1 funds only the categories earmarked to it. Additive.
ALTER TABLE `accounts` ADD `assign_pool` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `categories` ADD `pool_account_id` text REFERENCES accounts(id) ON DELETE set null;
