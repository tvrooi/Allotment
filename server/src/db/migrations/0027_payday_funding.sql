CREATE TABLE `payday_plans` (
  `id` text PRIMARY KEY NOT NULL,
  `config_json` text NOT NULL,
  `archived` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payday_funding_events` (
  `id` text PRIMARY KEY NOT NULL,
  `plan_id` text NOT NULL REFERENCES `payday_plans`(`id`),
  `scheduled_date` text NOT NULL,
  `applied_date` text NOT NULL,
  `snapshot_json` text NOT NULL,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payday_event_plan_date` ON `payday_funding_events` (`plan_id`, `scheduled_date`);
--> statement-breakpoint
CREATE TABLE `payday_funding_receipts` (
  `transaction_id` text PRIMARY KEY NOT NULL,
  `event_id` text NOT NULL REFERENCES `payday_funding_events`(`id`) ON DELETE CASCADE
);
