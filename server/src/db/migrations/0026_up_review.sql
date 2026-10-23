ALTER TABLE `up_connections` ADD `poll_interval_minutes` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `up_connections` ADD `last_attempt_at` text;
--> statement-breakpoint
ALTER TABLE `up_connections` ADD `last_completed_at` text;
--> statement-breakpoint
ALTER TABLE `up_connections` ADD `next_sync_at` text;
--> statement-breakpoint
ALTER TABLE `up_connections` ADD `failure_count` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `up_account_mappings` ADD `initialized_at` text;
--> statement-breakpoint
CREATE TABLE `up_source_records` (
  `imported_id` text PRIMARY KEY NOT NULL,
  `account_id` text NOT NULL REFERENCES `accounts`(`id`) ON DELETE cascade,
  `transaction_id` text REFERENCES `transactions`(`id`) ON DELETE set null,
  `source_json` text NOT NULL,
  `previous_json` text,
  `review_state` text DEFAULT 'reviewed' NOT NULL,
  `revision` integer DEFAULT 1 NOT NULL,
  `seen_in_latest` integer DEFAULT 1 NOT NULL,
  `last_seen_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `up_source_review` ON `up_source_records` (`review_state`, `last_seen_at`);
