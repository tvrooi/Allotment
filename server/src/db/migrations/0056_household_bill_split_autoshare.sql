-- A shared recurring bill can split its own way (null = the household's default split) and can
-- share its payments as they arrive: from auto_share_from on (null = off), each new payment to
-- the bill's payee is shared with the bill's split.
ALTER TABLE `household_recurring_bills` ADD COLUMN `split_json` text;
--> statement-breakpoint
ALTER TABLE `household_recurring_bills` ADD COLUMN `auto_share_from` text;
