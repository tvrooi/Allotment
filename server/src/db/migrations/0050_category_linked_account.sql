-- An envelope can follow an account (docs/ENVELOPE-FUNDING.md, "Envelopes linked to an
-- account"): a confirmed transfer into the account from another budget account adds to the
-- envelope, one back out takes from it. One envelope per account. The categories triggers
-- (0029) already change the funding revision when the link changes.
ALTER TABLE `categories` ADD `linked_account_id` text REFERENCES `accounts`(`id`) ON DELETE SET NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_linked_account_unique` ON `categories` (`linked_account_id`) WHERE `linked_account_id` IS NOT NULL;
