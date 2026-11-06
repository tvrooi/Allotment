-- Legacy cleanup: 0011_unified_schedules copied every recurring_transactions row into schedules
-- and every transactions.recurring_transaction_id into schedule_id. Nothing has read or written
-- them since, and backups never held them. The column goes first, so no foreign key still points
-- at the table when it is dropped.
DROP INDEX IF EXISTS `transactions_recurring_idx`;
--> statement-breakpoint
ALTER TABLE `transactions` DROP COLUMN `recurring_transaction_id`;
--> statement-breakpoint
DROP TABLE IF EXISTS `recurring_transactions`;
