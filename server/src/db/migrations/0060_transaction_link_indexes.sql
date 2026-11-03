-- Split parts, transfer pairs and payees are looked up by these columns; without an index each
-- lookup read the whole table.
CREATE INDEX IF NOT EXISTS `transactions_parent_idx` ON `transactions` (`parent_transaction_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_transfer_idx` ON `transactions` (`transfer_transaction_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `transactions_payee_idx` ON `transactions` (`payee_id`);
