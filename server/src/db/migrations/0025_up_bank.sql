CREATE TABLE `up_connections` (
  `id` text PRIMARY KEY NOT NULL,
  `access_token` text NOT NULL,
  `sync_status` text DEFAULT 'good' NOT NULL,
  `sync_error` text,
  `last_synced_at` text,
  `created_at` text DEFAULT (datetime('now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `up_account_mappings` (
  `id` text PRIMARY KEY NOT NULL,
  `connection_id` text NOT NULL REFERENCES `up_connections`(`id`) ON DELETE cascade,
  `up_account_id` text NOT NULL,
  `name` text NOT NULL,
  `account_type` text NOT NULL,
  `account_id` text REFERENCES `accounts`(`id`) ON DELETE set null,
  `is_enabled` integer DEFAULT 1 NOT NULL
);
