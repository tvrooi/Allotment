-- Files (docs/FILES.md): a library of documents, each linked to any number of transactions,
-- categories, goals and accounts. Every existing receipt becomes a document with the same id.
CREATE TABLE `documents` (
	`id` text PRIMARY KEY NOT NULL,
	`file_id` text NOT NULL,
	`file_name` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`description` text,
	`document_date` text,
	`important` integer DEFAULT 0 NOT NULL,
	`starred` integer DEFAULT 0 NOT NULL,
	`search_text` text,
	`text_status` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `documents_file_idx` ON `documents` (`file_id`);
--> statement-breakpoint
CREATE INDEX `documents_created_idx` ON `documents` (`created_at`);
--> statement-breakpoint
CREATE TABLE `document_links` (
	`id` text PRIMARY KEY NOT NULL,
	`document_id` text NOT NULL REFERENCES `documents`(`id`) ON DELETE CASCADE,
	`transaction_id` text REFERENCES `transactions`(`id`) ON DELETE CASCADE,
	`category_id` text REFERENCES `categories`(`id`) ON DELETE CASCADE,
	`goal_id` text REFERENCES `goals`(`id`) ON DELETE CASCADE,
	`account_id` text REFERENCES `accounts`(`id`) ON DELETE CASCADE,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `document_links_document_idx` ON `document_links` (`document_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `document_links_transaction_idx` ON `document_links` (`transaction_id`,`document_id`) WHERE transaction_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `document_links_category_idx` ON `document_links` (`category_id`,`document_id`) WHERE category_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `document_links_goal_idx` ON `document_links` (`goal_id`,`document_id`) WHERE goal_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX `document_links_account_idx` ON `document_links` (`account_id`,`document_id`) WHERE account_id IS NOT NULL;
--> statement-breakpoint
CREATE TABLE `document_tags` (
	`document_id` text NOT NULL REFERENCES `documents`(`id`) ON DELETE CASCADE,
	`tag_id` text NOT NULL REFERENCES `tags`(`id`) ON DELETE CASCADE,
	PRIMARY KEY(`document_id`, `tag_id`)
);
--> statement-breakpoint
CREATE INDEX `document_tags_tag_idx` ON `document_tags` (`tag_id`);
--> statement-breakpoint
ALTER TABLE `receipt_files` ADD `on_disk` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `budget_settings` ADD `files_cap_mb` integer;
--> statement-breakpoint
ALTER TABLE `receipts` ADD `document_id` text REFERENCES `documents`(`id`) ON DELETE CASCADE;
--> statement-breakpoint
INSERT INTO `documents` (`id`, `file_id`, `file_name`, `mime_type`, `size`, `created_at`, `updated_at`)
	SELECT `id`, `file_id`, `file_name`, `mime_type`, `size`, `created_at`, `updated_at` FROM `receipts`;
--> statement-breakpoint
UPDATE `receipts` SET `document_id` = `id`;
--> statement-breakpoint
CREATE INDEX `receipts_document_idx` ON `receipts` (`document_id`);
