-- Receipt reading by a model the owner chooses (their own server, Anthropic or OpenAI), and
-- Up's own category kept with each Up record so categorisation can learn from the owner. Additive.
ALTER TABLE `budget_settings` ADD `receipt_reader_provider` text DEFAULT 'local' NOT NULL;
--> statement-breakpoint
-- One row: the cloud provider's API key, encrypted. Never in backups or exports.
CREATE TABLE `receipt_reader_secrets` (
	`id` integer PRIMARY KEY NOT NULL CHECK (`id` = 1),
	`api_key` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `up_source_records` ADD `up_category` text;
