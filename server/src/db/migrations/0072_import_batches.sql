-- SEC-01: a file import is remembered, so the person can see what each one added and take that
-- file back out. Additive: one table, and a nullable column on transactions (old rows have none).
CREATE TABLE `import_batches` (
  `id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL REFERENCES `accounts`(`id`) ON DELETE CASCADE,
  `file_name` text,
  `row_count` integer NOT NULL,
  `adjusted_through` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `import_batches_account` ON `import_batches` (`account_id`);
--> statement-breakpoint
ALTER TABLE `transactions` ADD `import_batch_id` text REFERENCES import_batches(id) ON DELETE SET NULL;
--> statement-breakpoint
CREATE INDEX `transactions_import_batch_idx` ON `transactions` (`import_batch_id`);
