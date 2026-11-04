-- Audit decision I-11: every write an access token makes is logged, and changes the owner must
-- approve arrive as proposals. Additive. Neither table is in backups (tokens are not either).
CREATE TABLE `assistant_actions` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`token_name` text NOT NULL,
	`action` text NOT NULL,
	`method` text NOT NULL,
	`path` text NOT NULL,
	`detail` text,
	`status` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assistant_actions_created` ON `assistant_actions` (`created_at`);
--> statement-breakpoint
CREATE TABLE `assistant_proposals` (
	`id` text PRIMARY KEY NOT NULL,
	`token_id` text NOT NULL,
	`token_name` text NOT NULL,
	`kind` text NOT NULL,
	`target_id` text,
	`payload` text NOT NULL,
	`note` text,
	`status` text DEFAULT 'pending' NOT NULL CHECK (`status` IN ('pending', 'applied', 'declined')),
	`result_id` text,
	`error` text,
	`created_at` text NOT NULL,
	`decided_at` text
);
