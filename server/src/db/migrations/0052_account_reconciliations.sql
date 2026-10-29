-- Remembers what each reconciliation locked and the adjustment it created, so "Undo last
-- reconciliation" reverses exactly that and nothing else.
CREATE TABLE `account_reconciliations` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  `transaction_ids` text NOT NULL,
  `adjustment_transaction_id` text,
  `adjustment_amount` integer DEFAULT 0 NOT NULL,
  `statement_balance` integer NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL,
  `undone_at` text
);
--> statement-breakpoint
CREATE INDEX `account_reconciliations_account` ON `account_reconciliations` (`account_id`);
